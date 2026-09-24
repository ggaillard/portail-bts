-- ═══════════════════════════════════════════════════════════════════════════
--  LE SUIVI EN TEMPS RÉEL — points de passage, main levée, « À aller voir »,
--  élèves à suivre sur le semestre (24/09/2026)
--
--  ─── Le constat ──────────────────────────────────────────────────────────
--  Le quiz est à la fin de la trace. Pendant les actes — de la 10e à la 50e
--  minute environ — le portail ne recevait RIEN : l'appel, l'humeur et le
--  contrôle d'entrée étaient faits, le quiz pas commencé. Un étudiant qui
--  décrochait à l'acte I n'apparaissait qu'à la 50e minute, et la ligne de
--  rythme annonçait toute la classe « en retard » pendant trois quarts
--  d'heure. Cent pour cent en ligne : pas de visage, pas de main levée.
--
--  ─── Ce que pose ce fichier ──────────────────────────────────────────────
--  1. `points_passage` : un point par acte, avec l'heure à laquelle l'acte
--     devrait être fini (`fin_min`, en minutes depuis « Démarrer la séance »)
--     et, facultativement, une question. Écrits par la migration de chaque
--     séance, depuis les durées d'actes de la trace.
--  2. `passages` : qui a passé quel point, quand, juste ou faux.
--  3. `mains` : « Je bloque ici », envoyé par l'étudiant ; « vu », posé par
--     l'enseignant. Le seul signal que l'étudiant CHOISIT d'envoyer.
--  4. `vigilance_seance()` : pour chaque étudiant, les RAISONS d'aller le voir
--     — jamais un score. Chaque raison est une phrase.
--  5. `eleves_a_suivre()` : la même chose à l'échelle du semestre.
--
--  ─── Pourquoi des tables à part, et pas des clés dans `reponses` ─────────
--  Une clé de plus dans `reponses` (« a-01 ») aurait dû être exclue, une par
--  une, de semestre(), questions_seance(), preflight_seance(),
--  parcours_seance() et du portail — c'est exactement ce que le préfixe
--  « pre- » a coûté le 10/09. Ici, rien de ce qui existe ne voit ces lignes :
--  aucun taux de réussite ne peut en être faussé.
--
--  ─── Ce qui n'est JAMAIS montré ──────────────────────────────────────────
--  Les raisons sont nominatives : elles ne sortent que par des fonctions
--  gardées par `est_enseignant()`, et l'écran projeté ne les lit pas.
--  La bonne lettre d'un point de passage n'est lisible par personne : aucune
--  politique de lecture sur les trois tables, tout passe par des fonctions.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les tables ─────────────────────────────────────────────────────────
create table if not exists public.points_passage (
  id          bigint generated always as identity primary key,
  seance_id   bigint not null references public.seances(id) on delete cascade,
  acte        int    not null,
  titre       text   not null,
  fin_min     int    not null,
  intitule    text,
  options     text[],
  bonne       text,
  explication text,
  unique (seance_id, acte)
);

create table if not exists public.passages (
  id        bigint generated always as identity primary key,
  seance_id bigint not null references public.seances(id) on delete cascade,
  eleve_id  bigint not null references public.eleves(id)  on delete cascade,
  acte      int    not null,
  reponse   text,
  correct   boolean,
  fait_le   timestamptz not null default now(),
  unique (eleve_id, seance_id, acte)
);
create index if not exists passages_seance_idx on public.passages(seance_id);

create table if not exists public.mains (
  id         bigint generated always as identity primary key,
  seance_id  bigint not null references public.seances(id) on delete cascade,
  eleve_id   bigint not null references public.eleves(id)  on delete cascade,
  acte       int,
  mot        text   not null default '',
  levee_le   timestamptz not null default now(),
  vue_le     timestamptz,
  baissee_le timestamptz
);
create index if not exists mains_seance_idx on public.mains(seance_id);

-- Aucune politique : RLS activée sans rien d'autre, c'est « personne ne lit
-- directement ». Tout passe par les fonctions ci-dessous.
alter table public.points_passage enable row level security;
alter table public.passages       enable row level security;
alter table public.mains          enable row level security;

-- ─── 2. Qui est l'étudiant, pour cette séance ──────────────────────────────
--  Le même lien que qui_suis_je() — auth.uid() → eleves.auth_id — restreint à
--  la classe de la séance : on ne répond pas pour une autre classe.
create or replace function public.eleve_de_seance(p_seance_id bigint)
returns bigint language sql stable security definer set search_path = public as $$
  select e.id
    from public.eleves e
    join public.seances s on s.classe_id = e.classe_id
   where s.id = p_seance_id and e.auth_id = auth.uid()
   limit 1;
$$;
revoke all on function public.eleve_de_seance(bigint) from public, anon, authenticated;

-- ─── 3. Côté étudiant ──────────────────────────────────────────────────────
--  Les points de la séance, SANS la bonne lettre, avec ce que l'étudiant en a
--  déjà fait. La correction n'est rendue que pour un point déjà passé — même
--  règle que `mes_questionnaires()`.
create or replace function public.mes_points_passage(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_e bigint; v_s public.seances;
begin
  v_e := public.eleve_de_seance(p_seance_id);
  if v_e is null then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  select * into v_s from public.seances where id = p_seance_id;
  return jsonb_build_object(
    'ok', true,
    'ouverte', v_s.ouverte,
    'points', coalesce((
      select jsonb_agg(jsonb_build_object(
               'acte', p.acte, 'titre', p.titre,
               'intitule', p.intitule, 'options', p.options,
               'fait', pa.id is not null,
               'reponse', pa.reponse, 'correct', pa.correct,
               'bonne', case when pa.id is not null then p.bonne end,
               'explication', case when pa.id is not null then p.explication end)
             order by p.acte)
        from public.points_passage p
        left join public.passages pa
               on pa.seance_id = p.seance_id and pa.acte = p.acte and pa.eleve_id = v_e
       where p.seance_id = p_seance_id), '[]'::jsonb),
    'main', (select jsonb_build_object('id', m.id, 'acte', m.acte, 'mot', m.mot,
                                       'levee_le', m.levee_le, 'vue', m.vue_le is not null)
               from public.mains m
              where m.seance_id = p_seance_id and m.eleve_id = v_e and m.baissee_le is null
              order by m.levee_le desc limit 1));
end; $$;
grant execute on function public.mes_points_passage(bigint) to authenticated;

--  Passer un point. La PREMIÈRE réponse compte : la rejouer ne la remplace
--  pas. C'est un point de mesure, pas un exercice — ce qu'on veut savoir,
--  c'est ce que l'étudiant avait compris en sortant de l'acte.
create or replace function public.passer_acte(p_seance_id bigint, p_acte int, p_reponse text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e bigint; v_p public.points_passage; v_pa public.passages; v_ouverte boolean;
begin
  v_e := public.eleve_de_seance(p_seance_id);
  if v_e is null then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  select ouverte into v_ouverte from public.seances where id = p_seance_id;
  if not coalesce(v_ouverte, false) then
    return jsonb_build_object('ok', false, 'motif', 'fermee');
  end if;
  select * into v_p from public.points_passage where seance_id = p_seance_id and acte = p_acte;
  if not found then return jsonb_build_object('ok', false, 'motif', 'point'); end if;
  if v_p.intitule is not null and upper(coalesce(p_reponse, '')) not in ('A', 'B', 'C', 'D') then
    return jsonb_build_object('ok', false, 'motif', 'reponse');
  end if;

  insert into public.passages (seance_id, eleve_id, acte, reponse, correct)
  values (p_seance_id, v_e, p_acte,
          case when v_p.intitule is null then 'fait' else upper(p_reponse) end,
          case when v_p.bonne is null then null else upper(p_reponse) = v_p.bonne end)
  on conflict (eleve_id, seance_id, acte) do nothing;

  -- Passer un acte, c'est aussi s'être débloqué : une main restée levée sur
  -- un acte qu'on vient de finir n'a plus rien à dire à l'enseignant.
  update public.mains set baissee_le = now()
   where seance_id = p_seance_id and eleve_id = v_e and baissee_le is null
     and acte is not null and acte <= p_acte;

  select * into v_pa from public.passages
   where seance_id = p_seance_id and eleve_id = v_e and acte = p_acte;
  return jsonb_build_object('ok', true, 'reponse', v_pa.reponse, 'correct', v_pa.correct,
                            'bonne', v_p.bonne, 'explication', v_p.explication);
end; $$;
grant execute on function public.passer_acte(bigint, int, text) to authenticated;

create or replace function public.lever_main(p_seance_id bigint, p_acte int, p_mot text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e bigint; v_id bigint; v_ouverte boolean;
begin
  v_e := public.eleve_de_seance(p_seance_id);
  if v_e is null then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  select ouverte into v_ouverte from public.seances where id = p_seance_id;
  if not coalesce(v_ouverte, false) then
    return jsonb_build_object('ok', false, 'motif', 'fermee');
  end if;
  -- Une seule main levée à la fois : la nouvelle remplace l'ancienne.
  update public.mains set baissee_le = now()
   where seance_id = p_seance_id and eleve_id = v_e and baissee_le is null;
  insert into public.mains (seance_id, eleve_id, acte, mot)
  values (p_seance_id, v_e, p_acte, left(btrim(coalesce(p_mot, '')), 140))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end; $$;
grant execute on function public.lever_main(bigint, int, text) to authenticated;

create or replace function public.baisser_main(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e bigint;
begin
  v_e := public.eleve_de_seance(p_seance_id);
  if v_e is null then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  update public.mains set baissee_le = now()
   where seance_id = p_seance_id and eleve_id = v_e and baissee_le is null;
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.baisser_main(bigint) to authenticated;

-- ─── 4. Côté enseignant : « vu » ───────────────────────────────────────────
create or replace function public.main_vue(p_main_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  update public.mains set vue_le = coalesce(vue_le, now()) where id = p_main_id;
  return jsonb_build_object('ok', found);
end; $$;
grant execute on function public.main_vue(bigint) to authenticated;

-- ─── 5. « À aller voir » — les raisons, séance par séance ──────────────────
--
--  Chaque règle est une phrase, et chaque phrase dit ce qu'on a vu, pas ce
--  qu'on en conclut. Quatre gravités, dans l'ordre où l'on se déplace :
--
--    urgent     main levée, humeur « perdu »       — l'étudiant l'a dit
--    attention  silence, retard d'acte, 3 erreurs  — il se passe quelque chose
--    a_suivre   réponses trop rapides, sûr et faux — à regarder, pas à courir
--    info       actif sans avoir pointé            — à corriger dans l'appel
--
--  Ce qui n'est PAS une raison : être en avance, et être absent. Les absents
--  ont leur carte, l'appel ; les répéter ici noierait les présents qu'on peut
--  encore aider.
--
--  Les seuils sont écrits une fois, ici, et renvoyés avec le résultat : le
--  portail les affiche au lieu de les réécrire.
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
            ', il y a ' || (b.main->>'depuis') || ' min' ||
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

  select coalesce(array_agg(id order by demarree_le desc), '{}') into v_jouees from (
    select id, demarree_le from public.seances
     where classe_id = p_classe_id and numero < 90 and demarree_le is not null
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
                           where r.eleve_id = el.id and r.seance_id = s))::int          as muettes,
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
    'appels', cardinality(v_jours), 'seances', cardinality(v_jouees),
    'eleves', v_res);
end; $$;
grant execute on function public.eleves_a_suivre(bigint) to authenticated;

-- ─── 7. Contrôle ───────────────────────────────────────────────────────────
--  L'existence partout ; le comportement seulement si `est_enseignant()`
--  répond vrai — sinon, on dit pourquoi on ne le vérifie pas (règle du 16/09).
do $$
declare v_n int; v_s bigint; v_cl bigint; v_r jsonb;
begin
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('mes_points_passage', 'passer_acte', 'lever_main', 'baisser_main',
                       'main_vue', 'vigilance_seance', 'eleves_a_suivre', 'eleve_de_seance');
  if v_n <> 8 then raise exception 'suivi en temps réel : % fonction(s) sur 8', v_n; end if;

  -- La bonne lettre ne doit être lisible par personne en direct.
  select count(*) into v_n from pg_policies
   where schemaname = 'public' and tablename in ('points_passage', 'passages', 'mains');
  if v_n <> 0 then raise exception '% politique(s) sur les tables du suivi : la bonne lettre fuirait', v_n; end if;

  if not public.est_enseignant() then
    raise notice 'Fonctions du suivi en place. Comportement non vérifié ici : '
                 'session non enseignante (rôle postgres, sans auth.uid()).';
    return;
  end if;

  select s.id, s.classe_id into v_s, v_cl
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 1;
  if v_s is null then return; end if;

  v_r := public.vigilance_seance(v_s);
  if not (v_r->>'ok')::boolean then raise exception 'vigilance_seance refuse : %', v_r; end if;
  select count(*) into v_n from public.eleves where classe_id = v_cl and numero <> '99';
  if (v_r->>'inscrits')::int <> v_n then
    raise exception 'vigilance : % lignes pour % étudiants (le n° 99 est-il compté ?)',
      (v_r->>'inscrits')::int, v_n;
  end if;
  v_r := public.eleves_a_suivre(v_cl);
  if not (v_r->>'ok')::boolean then raise exception 'eleves_a_suivre refuse : %', v_r; end if;
end $$;
