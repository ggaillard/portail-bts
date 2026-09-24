-- ═══════════════════════════════════════════════════════════════════════════
--  « À aller voir » — quatre ajustements après le premier essai (24/09/2026)
--
--  `20260924070000_suivi_temps_reel.sql` est déjà appliquée en production :
--  une migration appliquée ne se réécrit pas. Les deux fonctions sont donc
--  redéfinies ici, en entier — c'est cette version qui gagne.
--
--  Ce que le rejeu sur une classe simulée a montré :
--
--  1. « Sur le semestre » comptait la séance EN COURS parmi les séances
--     jouées : à la 5e minute d'une heure, toute la classe était « une séance
--     sans aucune réponse ». Une séance jouée est démarrée ET plus en cours.
--  2. Une séance où l'étudiant n'avait passé que des points de passage
--     comptait comme muette : les passages comptent désormais comme une
--     réponse.
--  3. Sur un TP, huit minutes sans rien n'est pas un silence : une mission se
--     mesure en dizaines de minutes. Le seuil y passe à vingt.
--  4. Les deux fonctions rendent le code de la classe, pour que le portail
--     retrouve le prénom (correspondance locale au navigateur, jamais en
--     base) ; et « il y a 0 min » devient « à l'instant ».
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.vigilance_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s        public.seances;
  v_appel    bigint;
  v_jour     date;
  v_qa       text;
  v_qh       text;
  v_min      numeric;
  v_nb_actes int;
  v_attendu  int := 0;
  v_qz       int;
  v_silence  int := 8;     -- minutes sans rien, pendant que la séance tourne
                           -- (vingt sur un TP : une mission se mesure en
                           -- dizaines de minutes, pas en questions)
  v_grace    int := 3;     -- minutes accordées après la fin prévue d'un acte
  v_rapide   int := 5;     -- secondes entre deux réponses du quiz
  v_eleves   jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero is null or v_s.numero >= 90 then
    return jsonb_build_object('ok', false, 'motif', 'pas_un_cours');
  end if;

  if v_s.nature = 'projet' then v_silence := 20; end if;

  v_jour := coalesce(v_s.demarree_le::date, current_date);
  v_qa   := 'appel-'  || to_char(v_jour, 'YYYY-MM-DD');
  v_qh   := 'humeur-' || to_char(v_jour, 'YYYY-MM-DD');
  select s.id into v_appel from public.seances s
   where s.classe_id = v_s.classe_id and s.numero = 99;

  -- Le temps ne compte que pendant une séance démarrée ET ouverte : relire
  -- une séance close le lendemain ne doit pas déclarer toute la classe
  -- silencieuse depuis vingt heures.
  if v_s.demarree_le is not null and v_s.ouverte then
    v_min := extract(epoch from now() - v_s.demarree_le) / 60;
  end if;

  select count(*) into v_nb_actes from public.points_passage where seance_id = p_seance_id;
  if v_min is not null then
    select count(*) into v_attendu from public.points_passage
     where seance_id = p_seance_id and fin_min + v_grace <= v_min;
  end if;
  select count(*) into v_qz from public.corriges
   where seance_id = p_seance_id and question ~ '^q[0-9]+$';

  with el as (
    select e.id, e.numero, e.avatar from public.eleves e
     where e.classe_id = v_s.classe_id and e.numero <> '99'
  ),
  base as (
    select el.id, el.numero, el.avatar,
      exists (select 1 from public.reponses r where r.eleve_id = el.id
               and r.seance_id = v_appel and r.question = v_qa)              as appel,
      (select r.reponse from public.reponses r where r.eleve_id = el.id
         and r.seance_id = v_appel and r.question = v_qh limit 1)            as humeur,
      (select count(*) from public.passages pa
        where pa.eleve_id = el.id and pa.seance_id = p_seance_id)::int      as passes,
      (select max(pa.acte) from public.passages pa
        where pa.eleve_id = el.id and pa.seance_id = p_seance_id)            as dernier_acte,
      (select count(distinct r.question) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = p_seance_id
          and r.question ~ '^q[0-9]+$')::int                                 as quiz,
      greatest(
        (select max(r.updated_at) from public.reponses r
          where r.eleve_id = el.id and (r.seance_id = p_seance_id
             or (r.seance_id = v_appel and r.question in (v_qa, v_qh)))),
        (select max(pa.fait_le) from public.passages pa
          where pa.eleve_id = el.id and pa.seance_id = p_seance_id),
        (select max(m.levee_le) from public.mains m
          where m.eleve_id = el.id and m.seance_id = p_seance_id))           as dernier,
      -- Les trois derniers gestes évalués, quiz et points de passage mêlés,
      -- dans l'ordre où ils ont été faits.
      (select array_agg(t.ok order by t.quand desc) from (
         select r.correct as ok, r.updated_at as quand from public.reponses r
          where r.eleve_id = el.id and r.seance_id = p_seance_id
            and r.question ~ '^q[0-9]+$' and r.correct is not null
         union all
         select pa.correct, pa.fait_le from public.passages pa
          where pa.eleve_id = el.id and pa.seance_id = p_seance_id and pa.correct is not null
         order by 2 desc limit 3) t)                                         as derniers,
      (select count(*) from (
         select r.updated_at - lag(r.updated_at) over (order by r.updated_at) as ecart
           from public.reponses r
          where r.eleve_id = el.id and r.seance_id = p_seance_id
            and r.question ~ '^q[0-9]+$') g
        where g.ecart < make_interval(secs => v_rapide))::int               as rapides,
      (select count(*) from public.reponses r
         join public.reponses c on c.eleve_id = r.eleve_id and c.seance_id = r.seance_id
                               and c.question = r.question || '-c'
        where r.eleve_id = el.id and r.seance_id = p_seance_id
          and r.question ~ '^pre-[0-9]+$' and r.correct is false
          and c.reponse = 'A')::int                                          as sur_faux,
      (select jsonb_build_object('id', m.id, 'acte', m.acte, 'mot', m.mot,
                                 'depuis', floor(extract(epoch from now() - m.levee_le) / 60)::int,
                                 'vue', m.vue_le is not null)
         from public.mains m
        where m.eleve_id = el.id and m.seance_id = p_seance_id and m.baissee_le is null
        order by m.levee_le desc limit 1)                                    as main
      from el
  ),
  raisons as (
    select b.*,
      array_remove(array[
        case when b.main is not null and not (b.main->>'vue')::boolean then
          jsonb_build_object('cle', 'main', 'gravite', 'urgent', 'texte',
            'Main levée' || coalesce(' à l''acte ' || (b.main->>'acte'), '') ||
            case when (b.main->>'depuis')::int < 1 then ', à l''instant'
                 else ', il y a ' || (b.main->>'depuis') || ' min' end ||
            case when coalesce(b.main->>'mot', '') <> '' then ' — « ' || (b.main->>'mot') || ' »' else '' end)
        end,
        case when b.humeur = 'D' or b.humeur like '😕%' then
          jsonb_build_object('cle', 'perdu', 'gravite', 'urgent',
            'texte', 'A répondu « perdu, j''ai besoin d''aide » en arrivant')
        end,
        case when v_min is not null and v_min >= 10 and (b.appel or b.dernier is not null)
                  and (v_qz = 0 or b.quiz < v_qz)
                  and (b.dernier is null or b.dernier < now() - make_interval(mins => v_silence)) then
          jsonb_build_object('cle', 'silence', 'gravite', 'attention', 'texte',
            case when b.dernier is null then 'Pointé, mais rien depuis le début de la séance'
                 else 'Plus rien depuis ' ||
                      floor(extract(epoch from now() - b.dernier) / 60)::int || ' min' end)
        end,
        case when v_attendu > 0 and b.passes < v_attendu and (b.appel or b.dernier is not null) then
          jsonb_build_object('cle', 'retard', 'gravite', 'attention', 'texte',
            'Acte ' || v_attendu || ' attendu, ' ||
            case when b.passes = 0 then 'aucun acte passé'
                 else 'en est à l''acte ' || b.dernier_acte end)
        end,
        case when array_length(b.derniers, 1) = 3 and not (true = any(b.derniers)) then
          jsonb_build_object('cle', 'serie', 'gravite', 'attention',
            'texte', 'Trois réponses fausses d''affilée')
        end,
        case when b.rapides >= 3 then
          jsonb_build_object('cle', 'rapide', 'gravite', 'a_suivre', 'texte',
            b.rapides || ' réponses du quiz à moins de ' || v_rapide || ' s d''écart — lues ?')
        end,
        case when b.sur_faux >= 2 then
          jsonb_build_object('cle', 'sur_faux', 'gravite', 'a_suivre', 'texte',
            'Sûr de lui et faux sur ' || b.sur_faux || ' notions du contrôle d''entrée')
        end,
        case when not b.appel and b.dernier is not null and v_s.demarree_le is not null then
          jsonb_build_object('cle', 'pas_pointe', 'gravite', 'info',
            'texte', 'Actif sans avoir répondu à l''appel')
        end
      ], null) as r
      from base b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'eleve_id', x.id, 'numero', x.numero, 'avatar', x.avatar,
           'appel', x.appel, 'passes', x.passes, 'quiz', x.quiz,
           'dernier', x.dernier, 'main', x.main,
           'raisons', to_jsonb(x.r),
           'rang', (select min(case g->>'gravite' when 'urgent' then 0 when 'attention' then 1
                                                  when 'a_suivre' then 2 else 3 end)
                      from unnest(x.r) g))
         order by x.numero), '[]'::jsonb)
    into v_eleves
    from raisons x;

  return jsonb_build_object('ok', true,
    'seance_id', v_s.id, 'numero', v_s.numero,
    'code', (select c.code from public.classes c where c.id = v_s.classe_id),
    'minutes', case when v_min is not null then floor(v_min)::int end,
    'duree_min', v_s.duree_min,
    'nb_actes', v_nb_actes, 'attendu_acte', v_attendu, 'quiz_sur', v_qz,
    'seuils', jsonb_build_object('silence_min', v_silence, 'grace_min', v_grace,
                                 'rapide_s', v_rapide),
    'actes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'acte', p.acte, 'titre', p.titre, 'fin_min', p.fin_min,
               'question', p.intitule is not null,
               'faits',  (select count(*) from public.passages pa
                            join public.eleves e on e.id = pa.eleve_id and e.numero <> '99'
                           where pa.seance_id = p.seance_id and pa.acte = p.acte),
               'justes', (select count(*) from public.passages pa
                            join public.eleves e on e.id = pa.eleve_id and e.numero <> '99'
                           where pa.seance_id = p.seance_id and pa.acte = p.acte
                             and pa.correct))
             order by p.acte)
        from public.points_passage p where p.seance_id = p_seance_id), '[]'::jsonb),
    'inscrits', jsonb_array_length(v_eleves),
    'eleves', v_eleves);
end; $$;
grant execute on function public.vigilance_seance(bigint) to authenticated;

-- ─── 6. Les élèves à suivre sur le semestre ────────────────────────────────
--
--  Ce qu'une séance ne voit pas : la répétition. Quatre règles, sur les trois
--  derniers appels et les trois dernières séances JOUÉES (démarrées) :
--
--    · absent à deux des trois derniers appels ;
--    · deux séances jouées sans y avoir répondu à rien ;
--    · moins de 40 % de réussite au quiz, sur au moins six réponses ;
--    · sûr de lui et faux sur trois notions de contrôle d'entrée ou plus.
--
--  Un étudiant en avance n'est jamais signalé pour cela : les règles ne
--  regardent que ce qui a été joué.
create or replace function public.eleves_a_suivre(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_appel bigint; v_jours date[]; v_jouees bigint[]; v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select id into v_appel from public.seances where classe_id = p_classe_id and numero = 99;

  select coalesce(array_agg(j order by j desc), '{}') into v_jours from (
    select distinct substring(co.question from 7)::date as j
      from public.corriges co
     where co.seance_id = v_appel and co.question ~ '^appel-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and substring(co.question from 7)::date <= current_date
     order by 1 desc limit 3) t;

  -- Jouée = démarrée, et plus en cours : la séance de l'heure n'est pas encore
  -- « une séance sans réponse » pour qui n'a pas fini de lire l'acte I.
  select coalesce(array_agg(id order by demarree_le desc), '{}') into v_jouees from (
    select id, demarree_le from public.seances
     where classe_id = p_classe_id and numero < 90 and demarree_le is not null
       and (not ouverte or demarree_le::date < current_date)
     order by demarree_le desc limit 3) t;

  with el as (
    select e.id, e.numero, e.avatar from public.eleves e
     where e.classe_id = p_classe_id and e.numero <> '99'
  ),
  m as (
    select el.*,
      (select count(*) from unnest(v_jours) j
        where not exists (select 1 from public.reponses r
                           where r.eleve_id = el.id and r.seance_id = v_appel
                             and r.question = 'appel-' || to_char(j, 'YYYY-MM-DD')))::int as absences,
      (select count(*) from unnest(v_jouees) s
        where not exists (select 1 from public.reponses r
                           where r.eleve_id = el.id and r.seance_id = s)
          and not exists (select 1 from public.passages pa
                           where pa.eleve_id = el.id and pa.seance_id = s))::int         as muettes,
      (select count(*) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = any(v_jouees)
          and r.question ~ '^q[0-9]+$' and r.correct is not null)::int                  as evaluees,
      (select count(*) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = any(v_jouees)
          and r.question ~ '^q[0-9]+$' and r.correct)::int                              as justes,
      (select count(*) from public.reponses r
         join public.reponses c on c.eleve_id = r.eleve_id and c.seance_id = r.seance_id
                               and c.question = r.question || '-c'
        where r.eleve_id = el.id and r.seance_id = any(v_jouees)
          and r.question ~ '^pre-[0-9]+$' and r.correct is false and c.reponse = 'A')::int as sur_faux
      from el
  ),
  r as (
    select m.*, array_remove(array[
      case when cardinality(v_jours) >= 2 and m.absences >= 2 then
        'Absent à ' || m.absences || ' des ' || cardinality(v_jours) || ' derniers appels' end,
      case when m.muettes >= 2 then
        m.muettes || ' des ' || cardinality(v_jouees) || ' dernières séances sans aucune réponse' end,
      case when m.evaluees >= 6 and m.justes * 100 < m.evaluees * 40 then
        round(m.justes * 100.0 / m.evaluees) || ' % de réussite au quiz sur les dernières séances' end,
      case when m.sur_faux >= 3 then
        'Sûr de lui et faux sur ' || m.sur_faux || ' notions de contrôle d''entrée' end
    ], null) as raisons
      from m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'eleve_id', r.id, 'numero', r.numero, 'avatar', r.avatar,
           'raisons', to_jsonb(r.raisons))
         order by cardinality(r.raisons) desc, r.numero)
         filter (where cardinality(r.raisons) > 0), '[]'::jsonb)
    into v_res from r;

  return jsonb_build_object('ok', true,
    'code', (select c.code from public.classes c where c.id = p_classe_id),
    'appels', cardinality(v_jours), 'seances', cardinality(v_jouees),
    'eleves', v_res);
end; $$;
grant execute on function public.eleves_a_suivre(bigint) to authenticated;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('vigilance_seance', 'eleves_a_suivre');
  if v_n <> 2 then raise exception 'vigilance : % fonction(s) sur 2', v_n; end if;
  if not public.est_enseignant() then
    raise notice 'Fonctions redéfinies. Comportement non vérifié ici : session non enseignante.';
  end if;
end $$;
