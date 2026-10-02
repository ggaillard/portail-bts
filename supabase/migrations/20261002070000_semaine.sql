-- ═══════════════════════════════════════════════════════════════════════════
--  LA SEMAINE (02/10/2026)
--
--  Demandé par G le 02/10 : en fin de semaine, savoir d'un coup d'œil et
--  depuis le téléphone qui a décroché, qui progresse, ce qu'il faut reprendre
--  lundi, où en est chacun face à l'échéance d'un projet, qui travaille entre
--  deux cours, et comment va la classe — l'humeur, appel après appel.
--
--  Le compte rendu porte sur UNE séance, le carnet sur TOUT le semestre (un
--  tableau large, illisible sur un téléphone) et « Sur le semestre » sur les
--  trois dernières séances. Aucun ne répondait à « et cette semaine ? ».
--
--  Quatre fonctions, toutes gardées par est_enseignant() :
--
--    · meteo_classe(classe, du, au)   — l'humeur de chaque jour d'appel, pour la
--      classe (répartition) et par étudiant. ☀️ en forme · 🌤 ça va ·
--      🌧 fatigué · ⛈ perdu. Un jour = un appel : les TP du BTS2 ne sont
--      jamais « démarrés », mais l'appel, lui, a lieu ;
--    · trajectoires_classe(classe)   — pour chaque module qui a une échéance,
--      les jalons franchis par chacun comparés à ce qu'une progression
--      régulière aurait donné à cette date ;
--    · semaine_classe(classe, jour)  — la semaine (lundi → dimanche) qui
--      contient ce jour : chiffres de la classe et de la semaine d'avant,
--      séances jouées, élèves à revoir (avec des RAISONS, jamais un score),
--      élèves en progrès, notions à reprendre, travail hors séance, météo,
--      trajectoires ;
--    · _semaine_eleves(), _raisons_semaine() — leurs briques, non exposées.
--
--  Règles habituelles : n° 99 exclu ; `pre-`, `appel-`, `humeur-` et les
--  certitudes `-c` hors réussite ; un jalon = clé `tp…` à 'true' / 'ok' ;
--  réussite sur les séances < 90 seulement — une révision (90-98) est un
--  entraînement, elle compte dans le travail hors séance, pas dans la note.
--
--  « HORS SÉANCE » = un geste fait un jour où l'étudiant n'a pas répondu à
--  l'appel, ou plus de quatre heures après sa réponse à l'appel du jour. C'est
--  une approximation, et elle est écrite ici pour qu'on sache la lire : les
--  TP du BTS2 ne sont jamais « démarrés », seul l'appel date la présence.
--
--  Rejouable sans risque : que des create or replace.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Les briques : une semaine, élève par élève ────────────────────────────
create or replace function public._semaine_eleves(p_classe_id bigint, p_du date, p_au date)
returns table (
  eleve_id bigint, numero text, avatar text,
  appels int, presents int, humeurs text,
  jouees int, muettes int[], gestes int,
  evaluees int, justes int, jalons int,
  hors int, jours_hors int, trop_vite int)
language sql stable security definer set search_path = public as $$
  with
  appel as (select id from public.seances where classe_id = p_classe_id and numero = 99),
  el as (
    select e.id, e.numero, e.avatar from public.eleves e
     where e.classe_id = p_classe_id and e.numero <> '99'
  ),
  jours as (
    -- Les jours d'appel posés dans la période, jusqu'à aujourd'hui.
    select distinct substring(co.question from 7)::date as j
      from public.corriges co
     where co.seance_id = (select id from appel)
       and co.question ~ '^appel-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and substring(co.question from 7)::date >= p_du
       and substring(co.question from 7)::date <  p_au
       and substring(co.question from 7)::date <= current_date
  ),
  pointe as (
    -- L'heure à laquelle chacun a répondu à l'appel, jour par jour.
    select r.eleve_id, substring(r.question from 7)::date as j, min(r.updated_at) as quand
      from public.reponses r
     where r.seance_id = (select id from appel) and r.question like 'appel-%'
       and substring(r.question from 7)::date >= p_du
       and substring(r.question from 7)::date <  p_au
     group by 1, 2
  ),
  jouees as (
    select s.id, s.numero, s.demarree_le::date as j from public.seances s
     where s.classe_id = p_classe_id and s.numero < 90
       and s.demarree_le >= p_du and s.demarree_le < p_au
  ),
  -- Tous les gestes de la période : réponses (hors appel, humeur, certitudes)
  -- et points de passage, toutes séances de la classe confondues.
  gestes as (
    select r.eleve_id, r.seance_id, s.numero as snum, r.question as cle, r.reponse,
           r.correct, r.updated_at as quand
      from public.reponses r
      join public.seances s on s.id = r.seance_id and s.classe_id = p_classe_id
     where s.numero <> 99
       and r.updated_at >= p_du and r.updated_at < p_au
       and r.question not like 'appel-%' and r.question not like 'humeur-%'
       and r.question not like '%-c'
    union all
    select pa.eleve_id, pa.seance_id, s.numero, 'acte-' || pa.acte, pa.reponse,
           pa.correct, pa.fait_le
      from public.passages pa
      join public.seances s on s.id = pa.seance_id and s.classe_id = p_classe_id
     where pa.fait_le >= p_du and pa.fait_le < p_au
  ),
  lus as (
    -- Le même test que vigilance_seance() : moins de temps_lecture() depuis
    -- le geste précédent, dans la même séance, sur les mêmes clés (envoyées
    -- au moment de répondre — voir gestes_lus()). Séances < 90 seulement : un
    -- second tour de révision se refait vite, et c'est normal.
    select x.eleve_id, count(*)::int as n from (
      select g.eleve_id,
             public.temps_lecture(coalesce(co.intitule, pp.intitule),
                                  coalesce(co.options, pp.options))              as lecture,
             extract(epoch from g.quand - lag(g.quand)
                     over (partition by g.eleve_id, g.seance_id order by g.quand)) as ecart
        from gestes g
        left join public.corriges co on co.seance_id = g.seance_id and co.question = g.cle
        left join public.points_passage pp on pp.seance_id = g.seance_id
                  and g.cle = 'acte-' || pp.acte
       where (g.cle ~ '^(q[0-9]+|pre-[0-9]+)$' or g.cle like 'acte-%') and g.snum < 90) x
     where x.lecture is not null and x.ecart is not null and x.ecart < x.lecture
     group by 1
  )
  select el.id, el.numero, el.avatar,
    (select count(*) from jours)::int,
    (select count(*) from pointe p where p.eleve_id = el.id
        and p.j in (select j from jours))::int,
    (select string_agg(left(r.reponse, 1), '' order by r.question)
       from public.reponses r
      where r.eleve_id = el.id and r.seance_id = (select id from appel)
        and r.question like 'humeur-%'
        and substring(r.question from 8)::date >= p_du
        and substring(r.question from 8)::date <  p_au),
    (select count(*) from jouees)::int,
    -- Présent le jour d'une séance jouée, et rien dans cette séance.
    coalesce((select array_agg(jo.numero order by jo.numero) from jouees jo
       where exists (select 1 from pointe p where p.eleve_id = el.id and p.j = jo.j)
         and not exists (select 1 from public.reponses r
                          where r.eleve_id = el.id and r.seance_id = jo.id
                            and r.question not like 'pre-%')
         and not exists (select 1 from public.passages pa
                          where pa.eleve_id = el.id and pa.seance_id = jo.id)), '{}'),
    (select count(*) from gestes g where g.eleve_id = el.id)::int,
    (select count(*) from gestes g where g.eleve_id = el.id and g.snum < 90
        and g.cle not like 'pre-%' and g.cle not like 'acte-%'
        and (g.correct is not null or g.reponse in ('ok', 'ko')))::int,
    (select count(*) from gestes g where g.eleve_id = el.id and g.snum < 90
        and g.cle not like 'pre-%' and g.cle not like 'acte-%'
        and (g.correct is true or g.reponse = 'ok'))::int,
    (select count(*) from gestes g where g.eleve_id = el.id
        and g.cle like 'tp%' and g.reponse in ('true', 'ok'))::int,
    (select count(*) from gestes g where g.eleve_id = el.id
        and not exists (select 1 from pointe p where p.eleve_id = el.id
                         and p.j = g.quand::date
                         and g.quand >= p.quand - interval '30 minutes'
                         and g.quand <  p.quand + interval '4 hours'))::int,
    (select count(distinct g.quand::date) from gestes g where g.eleve_id = el.id
        and not exists (select 1 from pointe p where p.eleve_id = el.id
                         and p.j = g.quand::date
                         and g.quand >= p.quand - interval '30 minutes'
                         and g.quand <  p.quand + interval '4 hours'))::int,
    coalesce((select l.n from lus l where l.eleve_id = el.id), 0)
  from el
$$;
revoke all on function public._semaine_eleves(bigint, date, date) from public, anon, authenticated;

-- Les raisons d'une semaine. Une seule écriture des seuils, appliquée à la
-- semaine affichée ET à celle d'avant (pour savoir qui est NOUVEAU).
create or replace function public._raisons_semaine(
  p_appels int, p_presents int, p_muettes int[], p_evaluees int, p_justes int,
  p_trop_vite int, p_humeurs text, p_prec_eval int default null, p_prec_justes int default null)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x) filter (where x is not null), '[]'::jsonb) from (values
    (case when p_appels >= 1 and p_presents = 0 then
       jsonb_build_object('cle', 'absent', 'gravite', 'attention', 'texte',
         case when p_appels = 1 then 'Absent au seul appel de la semaine'
              else 'Absent aux ' || p_appels || ' appels de la semaine' end)
     when p_appels - p_presents >= 2 then
       jsonb_build_object('cle', 'absent', 'gravite', 'attention', 'texte',
         'Absent à ' || (p_appels - p_presents) || ' des ' || p_appels || ' appels')
     end),
    (case when cardinality(p_muettes) >= 1 then
       jsonb_build_object('cle', 'muet', 'gravite', 'attention', 'texte',
         'Présent, mais rien fait à la séance' ||
         case when cardinality(p_muettes) > 1 then 's ' else ' ' end ||
         array_to_string(p_muettes, ', '))
     end),
    (case when p_evaluees >= 4 and p_justes * 100 < p_evaluees * 40 then
       jsonb_build_object('cle', 'reussite', 'gravite', 'attention', 'texte',
         round(p_justes * 100.0 / p_evaluees) || ' % de réussite (' ||
         p_justes || ' sur ' || p_evaluees || ')')
     end),
    (case when p_evaluees >= 4 and coalesce(p_prec_eval, 0) >= 4
           and p_prec_justes * 100.0 / p_prec_eval - p_justes * 100.0 / p_evaluees >= 25 then
       jsonb_build_object('cle', 'baisse', 'gravite', 'attention', 'texte',
         'Réussite en baisse : ' || round(p_prec_justes * 100.0 / p_prec_eval) || ' % → ' ||
         round(p_justes * 100.0 / p_evaluees) || ' %')
     end),
    (case when position('D' in coalesce(p_humeurs, '')) > 0 then
       jsonb_build_object('cle', 'perdu', 'gravite', 'attention', 'texte',
         'S''est dit « perdu »' ||
         case when length(p_humeurs) - length(replace(p_humeurs, 'D', '')) > 1
              then ' ' || (length(p_humeurs) - length(replace(p_humeurs, 'D', ''))) || ' fois'
              else '' end)
     end),
    (case when length(coalesce(p_humeurs, '')) - length(replace(coalesce(p_humeurs, ''), 'C', '')) >= 2 then
       jsonb_build_object('cle', 'fatigue', 'gravite', 'a_suivre', 'texte',
         'Fatigué à ' || (length(p_humeurs) - length(replace(p_humeurs, 'C', ''))) || ' appels')
     end),
    (case when p_trop_vite >= 4 then
       jsonb_build_object('cle', 'lecture', 'gravite', 'a_suivre', 'texte',
         p_trop_vite || ' réponses sans le temps de lire')
     end)
  ) t(x)
$$;
revoke all on function public._raisons_semaine(int, int, int[], int, int, int, text, int, int) from public, anon, authenticated;

-- ─── La météo de l'humeur ──────────────────────────────────────────────────
create or replace function public.meteo_classe(p_classe_id bigint, p_du date default null, p_au date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_appel bigint; v_du date; v_au date;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select id into v_appel from public.seances where classe_id = p_classe_id and numero = 99;
  v_du := coalesce(p_du, date '2000-01-01');
  v_au := coalesce(p_au, current_date + 1);

  return (
    with jours as (
      select distinct substring(co.question from 7)::date as j
        from public.corriges co
       where co.seance_id = v_appel and co.question ~ '^appel-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         and substring(co.question from 7)::date >= v_du
         and substring(co.question from 7)::date <  v_au
         and substring(co.question from 7)::date <= current_date
    ),
    h as (
      select r.eleve_id, substring(r.question from 8)::date as j, left(r.reponse, 1) as l
        from public.reponses r
        join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
       where r.seance_id = v_appel and r.question ~ '^humeur-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         and substring(r.question from 8)::date in (select j from jours)
    )
    select jsonb_build_object('ok', true,
      'options', coalesce((select to_jsonb(co.options) from public.corriges co
                            where co.seance_id = v_appel and co.question = 'humeur-modele'), '[]'::jsonb),
      'jours', coalesce((select jsonb_agg(jsonb_build_object(
          'jour', j.j,
          'seances', coalesce((select jsonb_agg(s.numero order by s.numero) from public.seances s
                                where s.classe_id = p_classe_id and s.numero < 90
                                  and s.demarree_le::date = j.j), '[]'::jsonb),
          'A', (select count(*) from h where h.j = j.j and h.l = 'A'),
          'B', (select count(*) from h where h.j = j.j and h.l = 'B'),
          'C', (select count(*) from h where h.j = j.j and h.l = 'C'),
          'D', (select count(*) from h where h.j = j.j and h.l = 'D'))
          order by j.j) from jours j), '[]'::jsonb),
      'eleves', coalesce((select jsonb_agg(jsonb_build_object(
          'eleve_id', e.id, 'numero', e.numero,
          'humeurs', coalesce((select jsonb_object_agg(h.j::text, h.l) from h where h.eleve_id = e.id), '{}'::jsonb))
          order by e.numero)
          from public.eleves e where e.classe_id = p_classe_id and e.numero <> '99'), '[]'::jsonb))
  );
end; $$;
grant execute on function public.meteo_classe(bigint, date, date) to authenticated;

-- ─── Les trajectoires vers l'échéance ──────────────────────────────────────
--  Un module de projet a une échéance (la plus tardive de ses séances) et un
--  nombre de jalons (la somme). Son DÉBUT est le premier jalon franchi par
--  quelqu'un, ou la première séance démarrée — la base ne garde pas la date
--  de création d'une séance. À une date donnée, une progression régulière
--  aurait franchi : total × (aujourd'hui − début) / (échéance − début).
--
--  Statut, rapporté à cet attendu : à jour (≥ 100 %) · juste (≥ 60 %) ·
--  en retard (≥ 30 %) · décroché (< 30 %). Avant d'attendre deux jalons, on
--  ne juge personne : « pas encore de repère ».
create or replace function public.trajectoires_classe(p_classe_id bigint, p_jour date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_jour date := coalesce(p_jour, current_date);
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return (
    with se as (
      select s.id, coalesce(s.module_id, 0) as mod, s.jalons, s.echeance, s.demarree_le
        from public.seances s
       where s.classe_id = p_classe_id and s.numero < 90 and s.nature = 'projet'
         and s.echeance is not null and coalesce(s.jalons, 0) > 0
    ),
    m as (
      select se.mod, sum(se.jalons)::int as total, max(se.echeance) as echeance,
             least(min(se.demarree_le)::date,
                   (select min(r.updated_at)::date from public.reponses r
                     where r.seance_id in (select id from se s2 where s2.mod = se.mod)
                       and r.question like 'tp%' and r.reponse in ('true', 'ok'))) as debut
        from se group by se.mod
    ),
    mm as (
      select m.*,
             case when m.debut is null then null
                  when m.echeance <= m.debut then m.total::numeric
                  else m.total * least(1, greatest(0,
                         (v_jour - m.debut)::numeric / (m.echeance - m.debut))) end as attendu
        from m
    ),
    el as (select e.id, e.numero, e.avatar from public.eleves e
            where e.classe_id = p_classe_id and e.numero <> '99'),
    faits as (
      select mm.mod, el.id as eleve_id, el.numero,
             (select count(distinct (r.seance_id, r.question)) from public.reponses r
               where r.eleve_id = el.id and r.seance_id in (select id from se where se.mod = mm.mod)
                 and r.question like 'tp%' and r.reponse in ('true', 'ok'))::int as n
        from mm cross join el
    ),
    st as (
      select f.*, mm.attendu,
             case when mm.attendu is null or mm.attendu < 2 then 'sans_repere'
                  when f.n >= mm.attendu        then 'a_jour'
                  when f.n >= mm.attendu * 0.6  then 'juste'
                  when f.n >= mm.attendu * 0.3  then 'retard'
                  else 'decroche' end as statut
        from faits f join mm on mm.mod = f.mod
    )
    select jsonb_build_object('ok', true, 'jour', v_jour,
      'modules', coalesce((select jsonb_agg(jsonb_build_object(
          'module_id', nullif(mm.mod, 0),
          'titre', coalesce((select md.titre from public.modules md where md.id = mm.mod), 'Projets'),
          'icone', (select md.icone from public.modules md where md.id = mm.mod),
          'total', mm.total, 'echeance', mm.echeance, 'debut', mm.debut,
          'attendu', round(coalesce(mm.attendu, 0), 1),
          'compte', (select jsonb_object_agg(x.statut, x.n) from (
                       select st.statut, count(*) as n from st where st.mod = mm.mod group by 1) x),
          'eleves', (select jsonb_agg(jsonb_build_object('eleve_id', st.eleve_id, 'numero', st.numero,
                                                         'faits', st.n, 'statut', st.statut)
                                      order by st.n, st.numero)
                       from st where st.mod = mm.mod))
          order by mm.echeance, mm.mod) from mm), '[]'::jsonb))
  );
end; $$;
grant execute on function public.trajectoires_classe(bigint, date) to authenticated;

-- ─── La semaine ────────────────────────────────────────────────────────────
create or replace function public.semaine_classe(p_classe_id bigint, p_jour date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_du   date := date_trunc('week', coalesce(p_jour, current_date))::date;  -- lundi
  v_au   date;
  v_prec date;
  v_traj jsonb;
  v_res  jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if not exists (select 1 from public.classes where id = p_classe_id) then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;
  v_au   := v_du + 7;
  v_prec := v_du - 7;
  -- La trajectoire se juge au dernier jour de la semaine affichée, ou à
  -- aujourd'hui si la semaine n'est pas finie.
  v_traj := public.trajectoires_classe(p_classe_id, least(current_date, v_au - 1));

  with
  cur  as (select * from public._semaine_eleves(p_classe_id, v_du, v_au)),
  prec as (select * from public._semaine_eleves(p_classe_id, v_prec, v_du)),
  -- Le pire statut de trajectoire de chacun, tous modules confondus.
  traj as (
    select (x->>'eleve_id')::bigint as eleve_id, m->>'titre' as module,
           (x->>'faits')::int as faits, round((m->>'attendu')::numeric) as attendu,
           x->>'statut' as statut,
           row_number() over (partition by x->>'eleve_id'
             order by case x->>'statut' when 'decroche' then 0 when 'retard' then 1
                                        when 'juste' then 2 else 3 end) as rang
      from jsonb_array_elements(v_traj->'modules') m, jsonb_array_elements(m->'eleves') x
  ),
  e as (
    select c.*,
      p.evaluees as p_eval, p.justes as p_justes, p.presents as p_presents, p.hors as p_hors,
      t.module, t.faits, t.attendu, t.statut,
      public._raisons_semaine(c.appels, c.presents, c.muettes, c.evaluees, c.justes,
                              c.trop_vite, c.humeurs, p.evaluees, p.justes)
      || case when t.statut = 'decroche' then jsonb_build_array(jsonb_build_object(
              'cle', 'trajectoire', 'gravite', 'attention', 'texte',
              t.module || ' : ' || t.faits || ' jalon' || case when t.faits > 1 then 's' else '' end ||
              ' sur ' || t.attendu || ' attendus à cette date'))
            when t.statut = 'retard' then jsonb_build_array(jsonb_build_object(
              'cle', 'trajectoire', 'gravite', 'a_suivre', 'texte',
              t.module || ' : ' || t.faits || ' jalon' || case when t.faits > 1 then 's' else '' end ||
              ' sur ' || t.attendu || ' attendus à cette date'))
            else '[]'::jsonb end                                                      as raisons,
      public._raisons_semaine(p.appels, p.presents, p.muettes, p.evaluees, p.justes,
                              p.trop_vite, p.humeurs)                                 as raisons_prec
      from cur c
      join prec p on p.eleve_id = c.eleve_id
      left join traj t on t.eleve_id = c.eleve_id and t.rang = 1
  ),
  e2 as (
    select e.*,
      jsonb_array_length(e.raisons) > 0 and jsonb_array_length(e.raisons_prec) = 0 as nouveau,
      coalesce(jsonb_agg(x) filter (where x is not null), '[]'::jsonb) as progres
      from e
      left join lateral (values
        (case when e.evaluees >= 4 and coalesce(e.p_eval, 0) >= 4
               and e.justes * 100.0 / e.evaluees - e.p_justes * 100.0 / e.p_eval >= 20 then
           'Réussite en hausse : ' || round(e.p_justes * 100.0 / e.p_eval) || ' % → ' ||
           round(e.justes * 100.0 / e.evaluees) || ' %' end),
        (case when e.hors >= 10 then
           'S''entraîne hors séance : ' || e.hors || ' réponses sur ' || e.jours_hors ||
           ' jour' || case when e.jours_hors > 1 then 's' else '' end end),
        (case when e.jalons >= 3 and e.statut = 'a_jour' then
           e.jalons || ' jalons franchis cette semaine, à jour sur ' || e.module end),
        (case when jsonb_array_length(e.raisons_prec) > 0 and jsonb_array_length(e.raisons) = 0
               and e.presents > 0 then
           'Signalé la semaine dernière, plus rien à redire' end)
      ) v(x) on true
     group by e.eleve_id, e.numero, e.avatar, e.appels, e.presents, e.humeurs, e.jouees,
              e.muettes, e.gestes, e.evaluees, e.justes, e.jalons, e.hors, e.jours_hors,
              e.trop_vite, e.p_eval, e.p_justes, e.p_presents, e.p_hors, e.module, e.faits,
              e.attendu, e.statut, e.raisons, e.raisons_prec
  ),
  -- La classe, cette semaine et la précédente : les mêmes sommes.
  somme as (
    select 'cur' as quand, count(*) as effectif, max(c.appels) as appels, sum(c.presents) as presents,
           sum(c.evaluees) as evaluees, sum(c.justes) as justes, sum(c.gestes) as gestes,
           sum(c.hors) as hors, count(*) filter (where c.hors > 0) as actifs_hors,
           sum(c.jalons) as jalons, sum(c.trop_vite) as trop_vite,
           sum(length(coalesce(c.humeurs, ''))) as humeurs,
           sum(length(coalesce(c.humeurs, '')) - length(replace(coalesce(c.humeurs, ''), 'D', ''))) as perdus
      from cur c
    union all
    select 'prec', count(*), max(p.appels), sum(p.presents), sum(p.evaluees), sum(p.justes),
           sum(p.gestes), sum(p.hors), count(*) filter (where p.hors > 0), sum(p.jalons),
           sum(p.trop_vite), sum(length(coalesce(p.humeurs, ''))),
           sum(length(coalesce(p.humeurs, '')) - length(replace(coalesce(p.humeurs, ''), 'D', '')))
      from prec p
  ),
  chiffres as (
    select s.quand, jsonb_build_object(
      'effectif', s.effectif, 'appels', coalesce(s.appels, 0),
      'presence', case when coalesce(s.appels, 0) * s.effectif > 0
                       then round(s.presents * 100.0 / (s.appels * s.effectif)) end,
      'reussite', case when s.evaluees > 0 then round(s.justes * 100.0 / s.evaluees) end,
      'evaluees', s.evaluees, 'gestes', s.gestes, 'hors', s.hors,
      'actifs_hors', s.actifs_hors, 'jalons', s.jalons, 'trop_vite', s.trop_vite,
      'humeurs', s.humeurs, 'perdus', s.perdus) as j
      from somme s
  ),
  -- Les séances jouées dans la semaine, avec ce qu'elles ont donné.
  jouees as (
    select s.id, s.numero, s.titre, s.nature, s.jalons, s.demarree_le,
           (select count(*) from public.corriges co where co.seance_id = s.id
             and co.question ~ '^q[0-9]+$') as questions
      from public.seances s
     where s.classe_id = p_classe_id and s.numero < 90
       and s.demarree_le >= v_du and s.demarree_le < v_au
  ),
  -- Les concepts de ces séances qui ne sont pas acquis (mêmes seuils que
  -- debriefing() : acquis ≥ 75 %, fragile 45-74 %, à revoir < 45 %).
  concepts as (
    select j.numero, c.rang, c.intitule,
           count(r.*) filter (where r.correct is not null) as rep,
           count(r.*) filter (where r.correct) as ok
      from jouees j
      join public.concepts c on c.seance_id = j.id
      left join public.reponses r on r.seance_id = j.id
            and r.question in (select 'q' || q from unnest(c.questions) q)
            and r.eleve_id in (select id from public.eleves where classe_id = p_classe_id and numero <> '99')
     group by j.numero, c.rang, c.intitule
  )
  select jsonb_build_object('ok', true,
    'code', (select code from public.classes where id = p_classe_id),
    'du', v_du, 'au', v_au - 1, 'en_cours', current_date >= v_du and current_date < v_au,
    'classe', (select j from chiffres where quand = 'cur'),
    'precedente', (select j from chiffres where quand = 'prec'),
    'seances', coalesce((select jsonb_agg(jsonb_build_object(
        'id', j.id, 'numero', j.numero, 'titre', j.titre, 'nature', j.nature,
        'jour', j.demarree_le::date,
        'actifs', (select count(distinct r.eleve_id) from public.reponses r
                     join public.eleves el on el.id = r.eleve_id and el.numero <> '99'
                    where r.seance_id = j.id and r.question not like 'pre-%'),
        'reussite', (select round(count(*) filter (where r.correct) * 100.0 / nullif(count(*), 0))
                       from public.reponses r join public.eleves el on el.id = r.eleve_id and el.numero <> '99'
                      where r.seance_id = j.id and r.question ~ '^q[0-9]+$' and r.correct is not null),
        'avancement', case when j.nature = 'projet' and coalesce(j.jalons, 0) > 0 then
            (select round(avg(least(1, n::numeric / j.jalons)) * 100) from (
               select count(distinct r.question) as n from public.reponses r
                 join public.eleves el on el.id = r.eleve_id and el.numero <> '99'
                where r.seance_id = j.id and r.question like 'tp%' and r.reponse in ('true', 'ok')
                group by r.eleve_id) t)
          when j.questions > 0 then
            (select round(avg(least(1, n::numeric / j.questions)) * 100) from (
               select count(distinct r.question) as n from public.reponses r
                 join public.eleves el on el.id = r.eleve_id and el.numero <> '99'
                where r.seance_id = j.id and r.question ~ '^q[0-9]+$'
                group by r.eleve_id) t)
          end)
        order by j.demarree_le) from jouees j), '[]'::jsonb),
    'concepts', coalesce((select jsonb_agg(jsonb_build_object(
        'seance', c.numero, 'rang', c.rang, 'intitule', c.intitule,
        'taux', round(c.ok * 100.0 / c.rep), 'reponses', c.rep,
        'etat', case when c.ok * 100 < c.rep * 45 then 'a_revoir' else 'fragile' end)
        order by c.ok * 1.0 / c.rep, c.numero, c.rang)
        from concepts c where c.rep >= 3 and c.ok * 100 < c.rep * 75), '[]'::jsonb),
    'eleves', coalesce((select jsonb_agg(jsonb_build_object(
        'eleve_id', x.eleve_id, 'numero', x.numero, 'avatar', x.avatar,
        'appels', x.appels, 'presents', x.presents, 'humeurs', x.humeurs,
        'gestes', x.gestes, 'evaluees', x.evaluees, 'justes', x.justes,
        'reussite', case when x.evaluees > 0 then round(x.justes * 100.0 / x.evaluees) end,
        'reussite_prec', case when x.p_eval > 0 then round(x.p_justes * 100.0 / x.p_eval) end,
        'jalons', x.jalons, 'hors', x.hors, 'jours_hors', x.jours_hors, 'hors_prec', x.p_hors,
        'trop_vite', x.trop_vite, 'muettes', to_jsonb(x.muettes),
        'trajectoire', case when x.statut is not null then jsonb_build_object(
            'module', x.module, 'faits', x.faits, 'attendu', x.attendu, 'statut', x.statut) end,
        'raisons', x.raisons, 'nouveau', x.nouveau, 'progres', x.progres)
        order by x.numero) from e2 x), '[]'::jsonb),
    'trajectoires', v_traj->'modules',
    'meteo', public.meteo_classe(p_classe_id, v_du, v_au)->'jours')
  into v_res;

  return v_res;
end; $$;
grant execute on function public.semaine_classe(bigint, date) to authenticated;

-- ─── Ce qui doit tenir ─────────────────────────────────────────────────────
do $$
declare v jsonb; v_c bigint; v_s bigint; v_ap bigint; n int; t text;
        v_lundi date := date_trunc('week', current_date)::date;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('semaine_classe', 'meteo_classe', 'trajectoires_classe',
                       '_semaine_eleves', '_raisons_semaine');
  if n <> 5 then raise exception 'semaine : % fonction(s) sur 5', n; end if;

  -- Les raisons se lisent sans base : on les vérifie partout.
  v := public._raisons_semaine(3, 1, '{4}', 10, 3, 5, 'BDC', 8, 7);
  select string_agg(x->>'cle', ',' order by x->>'cle') into t from jsonb_array_elements(v) x;
  if t is distinct from 'absent,baisse,lecture,muet,perdu,reussite' then
    raise exception '_raisons_semaine() : %', t;
  end if;
  if jsonb_array_length(public._raisons_semaine(2, 2, '{}', 10, 9, 0, 'AB')) <> 0 then
    raise exception '_raisons_semaine() signale un étudiant présent qui réussit';
  end if;

  if not public.est_enseignant() then
    if (public.semaine_classe(1)->>'motif') is distinct from 'refus' then
      raise exception 'semaine_classe() ne refuse pas hors session enseignante';
    end if;
    raise notice 'Semaine : comportement non vérifié ici (pas de session enseignante).';
    return;
  end if;

  select id into v_c from public.classes where code = 'BTS1-DEV-2026';
  if v_c is null then raise notice 'Pas de BTS1 : semaine non vérifiée.'; return; end if;
  select id into v_ap from public.seances where classe_id = v_c and numero = 99;

  begin
    -- Un appel ce lundi (ou aujourd'hui), deux présents ; le 01 travaille le
    -- soir sans avoir pointé ce jour-là ; le 02 est pointé et répond pendant.
    select id into v_s from public.seances where classe_id = v_c and numero = 1;
    insert into public.corriges (seance_id, question, bonne_reponse)
    values (v_ap, 'appel-' || to_char(current_date, 'YYYY-MM-DD'), 'A')
    on conflict do nothing;
    if not exists (select 1 from public.corriges where seance_id = v_ap
                    and question = 'appel-' || to_char(current_date, 'YYYY-MM-DD')) then
      insert into public.corriges (seance_id, question, bonne_reponse)
      values (v_ap, 'appel-' || to_char(current_date, 'YYYY-MM-DD'), 'A');
    end if;
    insert into public.reponses (eleve_id, seance_id, question, reponse, updated_at)
    select e.id, v_ap, 'appel-' || to_char(current_date, 'YYYY-MM-DD'), 'A', current_date + time '08:00'
      from public.eleves e where e.classe_id = v_c and e.numero in ('02', '03');
    insert into public.reponses (eleve_id, seance_id, question, reponse, updated_at)
    select e.id, v_ap, 'humeur-' || to_char(current_date, 'YYYY-MM-DD'), 'D', current_date + time '08:01'
      from public.eleves e where e.classe_id = v_c and e.numero = '03';
    insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
    select e.id, v_s, 'q' || k, 'A', k <= 4, current_date + time '08:10' + make_interval(mins => k)
      from public.eleves e, generate_series(1, 5) k where e.classe_id = v_c and e.numero = '02';
    insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
    select e.id, v_s, 'q' || k, 'A', true, current_date + time '00:30' + make_interval(mins => k)
      from public.eleves e, generate_series(1, 3) k where e.classe_id = v_c and e.numero = '01';

    v := public.semaine_classe(v_c);
    if not (v->>'ok')::boolean then raise exception 'semaine_classe() : %', v; end if;
    if (v->>'du')::date <> v_lundi then raise exception 'semaine_classe() : la semaine commence le %', v->>'du'; end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x where x->>'numero' = '99';
    if n > 0 then raise exception 'semaine_classe() compte le n° 99'; end if;

    select x->>'hors' into t from jsonb_array_elements(v->'eleves') x where x->>'numero' = '01';
    if t is distinct from '3' then raise exception 'semaine : le 01 a % geste(s) hors séance, attendu 3', t; end if;
    select x->>'hors' into t from jsonb_array_elements(v->'eleves') x where x->>'numero' = '02';
    if t is distinct from '0' then raise exception 'semaine : le 02 a travaillé pendant, on lui compte % geste(s) hors séance', t; end if;
    select x->>'reussite' into t from jsonb_array_elements(v->'eleves') x where x->>'numero' = '02';
    if t is distinct from '80' then raise exception 'semaine : réussite du 02 = %, attendu 80', t; end if;
    select count(*) into n from jsonb_array_elements(v->'eleves') x, jsonb_array_elements(x->'raisons') r
     where x->>'numero' = '03' and r->>'cle' = 'perdu';
    if n <> 1 then raise exception 'semaine : le « perdu » du 03 n''est pas signalé'; end if;
    select (j->>'D')::int into n from jsonb_array_elements(v->'meteo') j
     where (j->>'jour')::date = current_date;
    if n is distinct from 1 then raise exception 'semaine : la météo du jour compte % « perdu », attendu 1', n; end if;
    if (v->'classe'->>'presence') is null then raise exception 'semaine : présence de la classe absente'; end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;

  -- Trajectoire : le BTS2, des TP à échéance. Un étudiant à 0 jalon quand
  -- l'attendu dépasse deux est « décroché » ; avant, personne n'est jugé.
  select id into v_c from public.classes where code = 'BTS2-SLAM-2026';
  begin
    update public.seances set echeance = current_date + 30, jalons = 10, nature = 'projet'
     where classe_id = v_c and numero = 1;
    update public.seances set echeance = null where classe_id = v_c and numero <> 1;
    insert into public.reponses (eleve_id, seance_id, question, reponse, updated_at)
    select e.id, s.id, 'tp1-m' || k, 'true', now() - interval '30 days' + make_interval(days => k * 3)
      from public.eleves e, public.seances s, generate_series(1, 8) k
     where e.classe_id = v_c and e.numero = '01' and s.classe_id = v_c and s.numero = 1;
    v := public.trajectoires_classe(v_c);
    if jsonb_array_length(v->'modules') <> 1 then
      raise exception 'trajectoires : % module(s), attendu 1', jsonb_array_length(v->'modules');
    end if;
    -- Début il y a 27 jours, échéance dans 30 : attendu 10 × 27/57 ≈ 4,7.
    select x->>'statut' into t from jsonb_array_elements(v->'modules'->0->'eleves') x where x->>'numero' = '01';
    if t <> 'a_jour' then raise exception 'trajectoires : le 01 (8 jalons) est « % »', t; end if;
    select x->>'statut' into t from jsonb_array_elements(v->'modules'->0->'eleves') x where x->>'numero' = '02';
    if t <> 'decroche' then raise exception 'trajectoires : le 02 (0 jalon) est « % »', t; end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;
  raise notice 'Semaine, météo et trajectoires : comportement vérifié.';
end $$;
