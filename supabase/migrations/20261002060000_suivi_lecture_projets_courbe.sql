-- ═══════════════════════════════════════════════════════════════════════════
--  LE SUIVI PENDANT L'HEURE, DEUXIÈME LOT (02/10/2026)
--
--  Demandé par G le 02/10 : « pas assez d'indicateurs de suivi de séance, en
--  temps réel et en fin de semaine ; suivre les avancements et détecter les
--  étudiants en difficulté depuis le téléphone ». Ce fichier porte le temps
--  réel ; la semaine est dans 20261002070000, les équipes dans 20261002080000.
--
--  1. LE TEMPS DE LECTURE. `temps_lecture(intitulé, options)` : le temps qu'il
--     faut pour lire une question et ses options, selon leur longueur —
--     3,5 mots par seconde, entre 4 et 25 secondes. La MÊME formule vit dans
--     js/lecture.js (portail) et dans docs/assets/suivi.js (site du BTS1),
--     qui gardent les options grisées pendant ce temps. Ici, on compte ce qui
--     est passé quand même : une réponse donnée moins de temps_lecture()
--     après le geste précédent de l'étudiant dans la séance.
--     Elle remplace la règle « 3 réponses à moins de 5 s d'écart », qui ne
--     savait pas qu'une question de trois lignes ne se lit pas en 5 s.
--
--  2. LES SÉANCES DE PROJET. Jusqu'ici, une seule règle de temps sur un TP :
--     le silence de 20 min. Deux règles s'ajoutent, sur les missions (clés
--     `tp…` à 'true' / 'ok', comme partout) :
--       · RETARD — la moitié ou moins des missions de la médiane du groupe,
--         une fois que le groupe en a validé deux ;
--       · BLOQUÉ — aucune mission validée depuis 25 min, pendant qu'un tiers
--         du groupe au moins en valide. Pas affiché en même temps que le
--         silence : « plus rien depuis 30 min » dit déjà tout.
--
--  3. L'HUMEUR « fatigué » devient une information (« perdu » restait seul,
--     en urgent). Et la séance rend l'humeur de chacun et sa répartition.
--
--  4. `courbe_seance()` : minute par minute, l'avancement médian des présents
--     comparé à l'attendu, et le nombre d'étudiants actifs sur les cinq
--     dernières minutes. C'est ce qui manquait pour lire « la classe a
--     décroché à partir de la 30e minute ».
--
--  Rejouable sans risque : que des create or replace.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le temps de lecture ────────────────────────────────────────────────
--  Une seule formule, recopiée à l'identique dans js/lecture.js et dans le
--  suivi.js des sites de cours. Changer l'une, c'est changer les trois.
create or replace function public.temps_lecture(p_intitule text, p_options text[] default null)
returns int language sql immutable as $$
  select case
    when coalesce(btrim(p_intitule), '') = '' then null
    else least(25, greatest(4, ceil(
      coalesce(array_length(regexp_split_to_array(
        btrim(p_intitule || ' ' || coalesce(array_to_string(p_options, ' '), '')), '\s+'), 1), 0)
      / 3.5)::int))
  end
$$;
grant execute on function public.temps_lecture(text, text[]) to anon, authenticated;

-- Les gestes évalués d'un étudiant dans une séance, chacun avec son temps de
-- lecture et l'écart au geste précédent : le quiz d'une séance de cours
-- (`q1`…`q10`), le contrôle d'entrée (`pre-NN`) et les points de passage —
-- tout ce qui est ENVOYÉ AU MOMENT où l'on répond. Les certitudes (`-c`),
-- l'appel, l'humeur et les missions cochées n'en sont pas : on ne lit pas une
-- case « j'ai fini ». Le quiz de PlaylistApp (`q-3-2`) non plus : le tableau
-- de bord du BTS2 l'envoie par paquets (à la connexion, puis 700 ms après un
-- clic), donc l'heure enregistrée est celle de l'envoi, pas de la réponse —
-- vingt réponses de la veille arriveraient « à une seconde d'écart ».
create or replace function public.gestes_lus(p_seance_id bigint)
returns table (eleve_id bigint, cle text, quand timestamptz, lecture int, ecart_s numeric)
language sql stable security definer set search_path = public as $$
  with g as (
    select r.eleve_id, r.question as cle, r.updated_at as quand,
           public.temps_lecture(co.intitule, co.options) as lecture
      from public.reponses r
      left join public.corriges co on co.seance_id = r.seance_id and co.question = r.question
     where r.seance_id = p_seance_id
       and r.question ~ '^(q[0-9]+|pre-[0-9]+)$'
    union all
    select pa.eleve_id, 'acte-' || pa.acte, pa.fait_le,
           public.temps_lecture(pp.intitule, pp.options)
      from public.passages pa
      join public.points_passage pp on pp.seance_id = pa.seance_id and pp.acte = pa.acte
     where pa.seance_id = p_seance_id
  )
  select g.eleve_id, g.cle, g.quand, g.lecture,
         extract(epoch from g.quand - lag(g.quand) over (partition by g.eleve_id order by g.quand))
    from g
$$;
revoke all on function public.gestes_lus(bigint) from public, anon, authenticated;

-- ─── 2 et 3. « À aller voir », troisième version ───────────────────────────
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
  v_bloque   int := 25;    -- minutes sans mission validée, sur un projet
  v_mediane  numeric;      -- missions validées, médiane des présents
  v_avancent int := 0;     -- présents qui ont validé une mission récemment
  v_presents int := 0;
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
  lus as (
    -- Une réponse est « sans le temps de lire » quand elle arrive moins de
    -- temps_lecture() après le geste précédent. Le premier geste de la
    -- séance n'a pas de précédent : il ne compte jamais.
    select g.eleve_id, count(*)::int as n,
           array_agg(g.cle order by g.quand) as cles
      from public.gestes_lus(p_seance_id) g
     where g.lecture is not null and g.ecart_s is not null and g.ecart_s < g.lecture
     group by g.eleve_id
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
      (select count(distinct r.question) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = p_seance_id
          and r.question like 'tp%' and r.reponse in ('true', 'ok'))::int    as missions,
      (select max(r.updated_at) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = p_seance_id
          and r.question like 'tp%' and r.reponse in ('true', 'ok'))         as derniere_mission,
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
      coalesce(lus.n, 0)                                                     as trop_vite,
      lus.cles                                                               as trop_vite_cles,
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
      from el left join lus on lus.eleve_id = el.id
  ),
  groupe as (
    -- Le repère d'un projet : ce que fait le groupe PRÉSENT, pas un barème.
    -- Un étudiant en avance tire la médiane vers le haut sans que personne
    -- ne devienne « en retard » pour autant : la règle exige la MOITIÉ.
    select coalesce(percentile_cont(0.5) within group (order by b.missions), 0)::numeric as mediane,
           count(*) filter (where b.derniere_mission >= now() - make_interval(mins => v_bloque))::int as avancent,
           count(*)::int as presents
      from base b where b.appel or b.dernier is not null
  ),
  drapeaux as (
    select b.*, g.mediane, g.avancent, g.presents,
      (v_min is not null and v_min >= 10 and (b.appel or b.dernier is not null)
        and (v_qz = 0 or b.quiz < v_qz)
        and (b.dernier is null or b.dernier < now() - make_interval(mins => v_silence))) as muet
      from base b cross join groupe g
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
        case when b.muet then
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
        -- Projet : la moitié ou moins de ce que fait le groupe présent.
        case when v_s.nature = 'projet' and v_min is not null and v_min >= 15
                  and b.mediane >= 2 and b.missions * 2 <= b.mediane
                  and (b.appel or b.dernier is not null) then
          jsonb_build_object('cle', 'retard_missions', 'gravite', 'attention', 'texte',
            case when b.missions = 0 then 'Aucune mission validée'
                 when b.missions = 1 then '1 mission validée'
                 else b.missions || ' missions validées' end ||
            ', le groupe en est à ' ||
            replace(regexp_replace(to_char(b.mediane, 'FM999990.0'), '\.0$', ''), '.', ','))
        end,
        -- Projet : plus rien de validé, pendant qu'un tiers du groupe avance.
        -- Pas en même temps que le silence, qui dit déjà tout.
        case when v_s.nature = 'projet' and v_min is not null and v_min >= v_bloque
                  and not b.muet and (b.appel or b.dernier is not null)
                  and (v_s.jalons is null or b.missions < v_s.jalons)
                  and coalesce(b.derniere_mission, v_s.demarree_le) < now() - make_interval(mins => v_bloque)
                  and b.avancent >= greatest(2, ceil(b.presents / 3.0)) then
          jsonb_build_object('cle', 'bloque', 'gravite', 'attention', 'texte',
            case when b.derniere_mission is null
                      or b.derniere_mission < v_s.demarree_le
                 then 'Aucune mission validée depuis le début de la séance'
                 else 'Aucune mission validée depuis ' ||
                      floor(extract(epoch from now() - b.derniere_mission) / 60)::int || ' min' end ||
            ', pendant que ' || b.avancent || ' autres avancent')
        end,
        case when array_length(b.derniers, 1) = 3 and not (true = any(b.derniers)) then
          jsonb_build_object('cle', 'serie', 'gravite', 'attention',
            'texte', 'Trois réponses fausses d''affilée')
        end,
        case when b.trop_vite >= 2 then
          jsonb_build_object('cle', 'lecture',
            'gravite', case when b.trop_vite >= 4 then 'attention' else 'a_suivre' end,
            'texte', b.trop_vite || ' réponses sans le temps de lire (' ||
              array_to_string(b.trop_vite_cles[1:5], ', ') ||
              case when cardinality(b.trop_vite_cles) > 5 then '…' else '' end || ')')
        end,
        case when b.sur_faux >= 2 then
          jsonb_build_object('cle', 'sur_faux', 'gravite', 'a_suivre', 'texte',
            'Sûr de lui et faux sur ' || b.sur_faux || ' notions du contrôle d''entrée')
        end,
        case when b.humeur = 'C' or b.humeur like '😴%' then
          jsonb_build_object('cle', 'fatigue', 'gravite', 'info',
            'texte', 'A répondu « fatigué » en arrivant')
        end,
        case when not b.appel and b.dernier is not null and v_s.demarree_le is not null then
          jsonb_build_object('cle', 'pas_pointe', 'gravite', 'info',
            'texte', 'Actif sans avoir répondu à l''appel')
        end
      ], null) as r
      from drapeaux b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'eleve_id', x.id, 'numero', x.numero, 'avatar', x.avatar,
           'appel', x.appel, 'humeur', x.humeur, 'passes', x.passes, 'quiz', x.quiz,
           'missions', x.missions, 'trop_vite', x.trop_vite,
           'dernier', x.dernier, 'main', x.main,
           'raisons', to_jsonb(x.r),
           'rang', (select min(case g->>'gravite' when 'urgent' then 0 when 'attention' then 1
                                                  when 'a_suivre' then 2 else 3 end)
                      from unnest(x.r) g))
         order by x.numero), '[]'::jsonb),
         max(x.mediane), max(x.avancent)
    into v_eleves, v_mediane, v_avancent
    from raisons x;

  return jsonb_build_object('ok', true,
    'seance_id', v_s.id, 'numero', v_s.numero, 'nature', v_s.nature,
    'code', (select c.code from public.classes c where c.id = v_s.classe_id),
    'minutes', case when v_min is not null then floor(v_min)::int end,
    'duree_min', v_s.duree_min,
    'nb_actes', v_nb_actes, 'attendu_acte', v_attendu, 'quiz_sur', v_qz,
    'jalons', v_s.jalons, 'mediane_missions', v_mediane, 'avancent', v_avancent,
    'trop_vite', (select coalesce(sum((x->>'trop_vite')::int), 0) from jsonb_array_elements(v_eleves) x),
    'humeurs', (select coalesce(jsonb_object_agg(h, n), '{}'::jsonb) from (
                  select left(x->>'humeur', 1) as h, count(*) as n
                    from jsonb_array_elements(v_eleves) x
                   where x->>'humeur' is not null group by 1) t),
    'seuils', jsonb_build_object('silence_min', v_silence, 'grace_min', v_grace,
                                 'bloque_min', v_bloque, 'lecture', 'selon la longueur'),
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

-- ─── 4. La courbe de l'heure ───────────────────────────────────────────────
--  Minute par minute depuis le démarrage :
--    · avance  — l'avancement MÉDIAN des présents, en % de ce que la séance
--      demande (actes + quiz sur un cours, missions sur un projet) ;
--    · attendu — ce que la cadence prévoit à cette minute : les actes à leur
--      fin prévue, puis le quiz réparti sur le temps qui reste ; un projet
--      avance en ligne droite sur sa durée ;
--    · actifs  — combien d'étudiants ont fait un geste dans les cinq
--      dernières minutes. C'est cette série qui montre un décrochage : la
--      médiane, elle, ne redescend jamais.
--  Présents = pointés à l'appel du jour, ou actifs dans la séance. Un
--  étudiant qui avait de l'avance la garde à la minute 0.
create or replace function public.courbe_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s      public.seances;
  v_appel  bigint;
  v_qa     text;
  v_fin    int;       -- dernière minute tracée
  v_actes  int; v_fin_actes int; v_quiz int; v_total int;
  v_points jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.demarree_le is null then
    return jsonb_build_object('ok', false, 'motif', 'pas_demarree');
  end if;

  select s.id into v_appel from public.seances s
   where s.classe_id = v_s.classe_id and s.numero = 99;
  v_qa := 'appel-' || to_char(v_s.demarree_le::date, 'YYYY-MM-DD');

  select count(*), coalesce(max(fin_min), 0) into v_actes, v_fin_actes
    from public.points_passage where seance_id = p_seance_id;
  select count(*) into v_quiz from public.corriges
   where seance_id = p_seance_id and question ~ '^q[0-9]+$';
  v_total := case when v_s.nature = 'projet' then coalesce(nullif(v_s.jalons, 0), 0)
                  else v_actes + v_quiz end;
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'motif', 'rien_a_mesurer');
  end if;

  -- Jusqu'à maintenant pendant l'heure ; après, jusqu'à la fin prévue plus
  -- vingt minutes. Jamais plus de trois heures : un projet ouvert toute la
  -- journée ne doit pas produire mille points.
  v_fin := least(180, case
    when v_s.ouverte then floor(extract(epoch from now() - v_s.demarree_le) / 60)::int
    else v_s.duree_min + 20 end);
  v_fin := greatest(v_fin, 0);

  with el as (
    select e.id from public.eleves e
     where e.classe_id = v_s.classe_id and e.numero <> '99'
  ),
  gestes as (
    -- Ce qui fait AVANCER : un acte passé, une question du quiz, une mission.
    select r.eleve_id, r.updated_at as quand, 1 as unite
      from public.reponses r join el on el.id = r.eleve_id
     where r.seance_id = p_seance_id
       and ((v_s.nature = 'projet' and r.question like 'tp%' and r.reponse in ('true', 'ok'))
         or (v_s.nature <> 'projet' and r.question ~ '^q[0-9]+$'))
    union all
    select pa.eleve_id, pa.fait_le, 1
      from public.passages pa join el on el.id = pa.eleve_id
     where pa.seance_id = p_seance_id and v_s.nature <> 'projet'
  ),
  activite as (
    -- Ce qui montre qu'on est là : tout geste dans la séance, main levée comprise.
    select r.eleve_id, r.updated_at as quand from public.reponses r join el on el.id = r.eleve_id
     where r.seance_id = p_seance_id
    union all
    select pa.eleve_id, pa.fait_le from public.passages pa join el on el.id = pa.eleve_id
     where pa.seance_id = p_seance_id
    union all
    select m.eleve_id, m.levee_le from public.mains m join el on el.id = m.eleve_id
     where m.seance_id = p_seance_id
  ),
  presents as (
    select distinct r.eleve_id from public.reponses r join el on el.id = r.eleve_id
     where r.seance_id = v_appel and r.question = v_qa
    union
    select distinct a.eleve_id from activite a
  ),
  minutes as (select generate_series(0, v_fin) as m),
  par_eleve as (
    select mn.m, p.eleve_id,
           (select count(*) from gestes g
             where g.eleve_id = p.eleve_id
               and g.quand <= v_s.demarree_le + make_interval(mins => mn.m)) as faits
      from minutes mn cross join presents p
  ),
  serie as (
    select mn.m,
      (select percentile_cont(0.5) within group (order by least(pe.faits, v_total))
         from par_eleve pe where pe.m = mn.m) as mediane,
      (select count(distinct a.eleve_id) from activite a
        where a.quand >  v_s.demarree_le + make_interval(mins => mn.m - 5)
          and a.quand <= v_s.demarree_le + make_interval(mins => mn.m)) as actifs
      from minutes mn
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'm', s.m,
           'avance', round(coalesce(s.mediane, 0) * 100.0 / v_total),
           'attendu', round(100.0 * least(v_total, case
              when v_s.nature = 'projet' then v_total * s.m::numeric / greatest(v_s.duree_min, 1)
              else (select count(*) from public.points_passage pp
                     where pp.seance_id = p_seance_id and pp.fin_min <= s.m)
                   + case when v_quiz = 0 or s.m <= v_fin_actes then 0
                          else floor((s.m - v_fin_actes) * v_quiz::numeric
                                     / greatest(1, v_s.duree_min - v_fin_actes)) end
              end) / v_total),
           'actifs', s.actifs) order by s.m), '[]'::jsonb)
    into v_points from serie s;

  return jsonb_build_object('ok', true, 'seance_id', v_s.id, 'nature', v_s.nature,
    'duree_min', v_s.duree_min, 'ouverte', v_s.ouverte, 'unites', v_total,
    'presents', (select count(*) from (
       select distinct r.eleve_id from public.reponses r
         join public.eleves e on e.id = r.eleve_id and e.classe_id = v_s.classe_id and e.numero <> '99'
        where (r.seance_id = v_appel and r.question = v_qa) or r.seance_id = p_seance_id
       union
       select pa.eleve_id from public.passages pa
         join public.eleves e on e.id = pa.eleve_id and e.numero <> '99'
        where pa.seance_id = p_seance_id) t),
    'points', v_points);
end; $$;
grant execute on function public.courbe_seance(bigint) to authenticated;

-- ─── Ce qui doit tenir ─────────────────────────────────────────────────────
--  Existence partout ; comportement seulement quand est_enseignant() répond
--  vrai (base d'essai de la CI). Sur la vraie base, pendant la migration, la
--  session n'est pas enseignante : on le dit au lieu de conclure.
do $$
declare v jsonb; v_c bigint; v_s bigint; v_e bigint; v_e2 bigint; n int; t text;
begin
  -- La formule, des deux côtés de l'écran : 18 mots (le « ? » compte) → 6 s ;
  -- vide → aucun délai.
  if public.temps_lecture('Dans une API REST, quel verbe HTTP lit une ressource sans la modifier ?',
                          array['GET', 'POST', 'PUT', 'DELETE']) <> 6 then
    raise exception 'temps_lecture() : % s pour 18 mots, attendu 6',
      public.temps_lecture('Dans une API REST, quel verbe HTTP lit une ressource sans la modifier ?',
                           array['GET', 'POST', 'PUT', 'DELETE']);
  end if;
  if public.temps_lecture('', null) is not null then
    raise exception 'temps_lecture() exige un délai sur une question vide';
  end if;
  if public.temps_lecture('Oui ?', null) <> 4 then raise exception 'temps_lecture() : plancher de 4 s absent'; end if;
  if public.temps_lecture(repeat('mot ', 200), null) <> 25 then raise exception 'temps_lecture() : plafond de 25 s absent'; end if;
  -- 30 mots → 9 s : c'est ici que le diviseur (3,5 mots par seconde) se voit.
  -- outils/t_indicateurs.mjs pose la même question à js/lecture.js.
  if public.temps_lecture(btrim(repeat('mot ', 30)), null) <> 9 then
    raise exception 'temps_lecture() : % s pour 30 mots, attendu 9', public.temps_lecture(btrim(repeat('mot ', 30)), null);
  end if;

  if not public.est_enseignant() then
    raise notice 'vigilance_seance() et courbe_seance() redéfinies. Comportement non vérifié ici : session non enseignante.';
    return;
  end if;

  select id into v_c from public.classes where code = 'BTS1-DEV-2026';
  if v_c is null then raise notice 'Pas de BTS1 : comportement non vérifié.'; return; end if;

  -- Tout ce qui suit est posé puis annulé.
  begin
    select id into v_s from public.seances where classe_id = v_c and numero = 1;
    update public.seances set demarree_le = now() - interval '30 minutes', ouverte = true where id = v_s;
    select id into v_e  from public.eleves where classe_id = v_c and numero = '01';
    select id into v_e2 from public.eleves where classe_id = v_c and numero = '02';

    -- Le 01 répond q1, puis q2 deux secondes après : q2 ne s'est pas lue.
    -- Puis q3 trois secondes après. Le 02 prend son temps.
    insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at) values
      (v_e,  v_s, 'q1', 'A', true,  now() - interval '20 minutes'),
      (v_e,  v_s, 'q2', 'A', false, now() - interval '20 minutes' + interval '2 seconds'),
      (v_e,  v_s, 'q3', 'A', false, now() - interval '20 minutes' + interval '5 seconds'),
      (v_e2, v_s, 'q1', 'B', true,  now() - interval '20 minutes'),
      (v_e2, v_s, 'q2', 'B', true,  now() - interval '19 minutes');

    v := public.vigilance_seance(v_s);
    select x->>'trop_vite' into t from jsonb_array_elements(v->'eleves') x where x->>'numero' = '01';
    if t is distinct from '2' then raise exception 'vigilance : le 01 a % réponse(s) trop vite, attendu 2', t; end if;
    select x->>'trop_vite' into t from jsonb_array_elements(v->'eleves') x where x->>'numero' = '02';
    if t is distinct from '0' then raise exception 'vigilance : le 02 a lu, on lui compte % réponse(s) trop vite', t; end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x, jsonb_array_elements(x->'raisons') r
     where x->>'numero' = '01' and r->>'cle' = 'lecture';
    if n <> 1 then raise exception 'vigilance : la raison « lecture » manque au 01'; end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x, jsonb_array_elements(x->'raisons') r
     where r->>'cle' = 'rapide';
    if n > 0 then raise exception 'vigilance : l''ancienne règle « rapide » est encore là'; end if;

    v := public.courbe_seance(v_s);
    if not (v->>'ok')::boolean then raise exception 'courbe_seance() : %', v; end if;
    if jsonb_array_length(v->'points') < 30 then
      raise exception 'courbe_seance() : % points pour 30 minutes', jsonb_array_length(v->'points');
    end if;
    -- À la 15e minute, personne n'avait rien fait ; à la 30e, deux présents
    -- ont 3 et 2 réponses sur 10 : médiane 2,5 → 25 %.
    select (p->>'avance')::int into n from jsonb_array_elements(v->'points') p where (p->>'m')::int = 30;
    if n <> 25 then raise exception 'courbe_seance() : avancement % %% à la 30e minute, attendu 25', n; end if;
    select (p->>'actifs')::int into n from jsonb_array_elements(v->'points') p where (p->>'m')::int = 11;
    if n <> 2 then raise exception 'courbe_seance() : % actif(s) à la 11e minute, attendu 2', n; end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;

  -- Un projet : la médiane du groupe, le retard et le blocage.
  select id into v_c from public.classes where code = 'BTS2-SLAM-2026';
  begin
    select id into v_s from public.seances where classe_id = v_c and numero = 1;
    update public.seances set demarree_le = now() - interval '50 minutes', ouverte = true,
                              nature = 'projet', jalons = 5 where id = v_s;
    -- 01 à 04 avancent (4 missions, dont une récente) ; 05 a une mission,
    -- validée il y a 40 min, et répond encore à une question de jalon : il est
    -- là, il bute. 06 fait autre chose (une question récente) sans rien
    -- valider. Un 05 SANS geste récent serait « silencieux », pas « bloqué ».
    insert into public.reponses (eleve_id, seance_id, question, reponse, updated_at)
    select e.id, v_s, 'tp1-m' || k, 'true', now() - make_interval(mins => 45 - k * 10)
      from public.eleves e, generate_series(1, 4) k
     where e.classe_id = v_c and e.numero in ('01', '02', '03', '04');
    insert into public.reponses (eleve_id, seance_id, question, reponse, updated_at)
    select e.id, v_s, 'tp1-m1', 'true', now() - interval '40 minutes'
      from public.eleves e where e.classe_id = v_c and e.numero = '05';
    insert into public.reponses (eleve_id, seance_id, question, reponse, updated_at)
    select e.id, v_s, 'jalon-1', 'A', now() - interval '2 minutes'
      from public.eleves e where e.classe_id = v_c and e.numero in ('05', '06');

    v := public.vigilance_seance(v_s);
    if (v->>'mediane_missions')::numeric <> 4 then
      raise exception 'vigilance projet : médiane %, attendu 4', v->>'mediane_missions';
    end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x, jsonb_array_elements(x->'raisons') r
     where x->>'numero' = '05' and r->>'cle' in ('retard_missions', 'bloque');
    if n <> 2 then raise exception 'vigilance projet : le 05 devrait être en retard ET bloqué (% raison(s))', n; end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x, jsonb_array_elements(x->'raisons') r
     where x->>'numero' = '06' and r->>'cle' = 'retard_missions';
    if n <> 1 then raise exception 'vigilance projet : le 06 n''a rien validé, il devrait être en retard'; end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x, jsonb_array_elements(x->'raisons') r
     where x->>'numero' in ('01', '02', '03', '04') and r->>'cle' in ('retard_missions', 'bloque');
    if n > 0 then raise exception 'vigilance projet : un étudiant qui avance est signalé'; end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;
  raise notice 'Lecture, projets et courbe : comportement vérifié.';
end $$;
