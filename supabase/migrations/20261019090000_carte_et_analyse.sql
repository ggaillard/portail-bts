-- ═══════════════════════════════════════════════════════════════════════════
--  OÙ EN EST CHACUN, ET CE QUE LA SÉANCE APPREND — pendant et après l'heure
--  (19/10/2026)
--
--  ─── Le constat ──────────────────────────────────────────────────────────
--  Depuis le parcours guidé (20261019060000), une séance est une SUITE
--  d'étapes — dix questions posées dans les actes et un point de passage à la
--  fin de chacun. La base en connaissait les réponses, pas l'ORDRE : elle ne
--  pouvait donc dire ni « le 07 est sur la question 6 depuis 9 min », ni
--  « huit étudiants sont arrêtés au même endroit », ni, après l'heure,
--  « l'acte III a duré 17 min pour 12 prévues ».
--
--  ─── Ce que pose ce fichier ──────────────────────────────────────────────
--  1. `etapes_seance` : l'ordre des étapes d'une séance, tel que la page les
--     pose. Écrit par le générateur de chaque séance (qui relit la trace :
--     ancres `tdc-ici` et fins d'actes). Sans lignes, on retombe sur l'ordre
--     des séances 1 à 4 : les points de passage, puis le quiz.
--  2. `carte_parcours(seance)` — PENDANT l'heure : élève par élève, l'état de
--     chaque étape (juste, faux, fait, pas encore), l'étape où il est et
--     depuis combien de temps ; étape par étape, combien l'ont passée, combien
--     y sont en ce moment, et le « bouchon » s'il y en a un.
--  3. `analyse_seance(seance)` — APRÈS l'heure : ce que la séance apprend sur
--     elle-même (actes plus longs que prévu, questions ratées et leur
--     distracteur, questions qu'on va chercher ailleurs, où les étudiants se
--     sont arrêtés), et, étudiant par étudiant, ce qu'il faut reprendre et
--     pourquoi.
--
--  ─── Les règles qu'on garde ──────────────────────────────────────────────
--  Des phrases, jamais un score. Le n° 99 exclu. Les clés `pre-`, `appel-`,
--  `humeur-` hors du quiz. Une étape non posée ne compte pour personne. Une
--  durée ne se lit qu'à partir de cinq étudiants : en dessous, un seul lent
--  fait la médiane. Nominatif, donc gardé par `est_enseignant()` et jamais
--  projeté.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. L'ordre des étapes ─────────────────────────────────────────────────
create table if not exists public.etapes_seance (
  seance_id bigint not null references public.seances(id) on delete cascade,
  rang      int    not null,
  cle       text   not null check (cle ~ '^(q[0-9]+|acte-[0-9]+)$'),
  primary key (seance_id, rang),
  unique (seance_id, cle)
);
alter table public.etapes_seance enable row level security;
-- Aucune politique : l'ordre n'est pas un secret, mais rien ne le lit en
-- direct — tout passe par les deux fonctions ci-dessous.

-- Les étapes d'une séance, dans l'ordre, avec ce qu'il faut pour les lire.
-- Repli sans `etapes_seance` : les points de passage par acte, puis les
-- questions du quiz par numéro — c'est exactement ce que voit un étudiant sur
-- les séances 1 à 4, où le quiz est à l'épilogue.
create or replace function public.etapes_de(p_seance_id bigint)
returns table (rang int, cle text, acte int, typ text, intitule text, options text[],
               bonne text, fin_min int)
language sql stable security definer set search_path = public as $$
  with brut as (
    select es.rang::bigint as ordre, es.cle from public.etapes_seance es
     where es.seance_id = p_seance_id
    union all
    select x.ordre, x.cle from (
      select 1000 + pp.acte as ordre, 'acte-' || pp.acte as cle
        from public.points_passage pp where pp.seance_id = p_seance_id
      union all
      select 2000 + substring(co.question from 2)::int, co.question
        from public.corriges co
       where co.seance_id = p_seance_id and co.question ~ '^q[0-9]+$') x
     where not exists (select 1 from public.etapes_seance e2 where e2.seance_id = p_seance_id)
  )
  select (row_number() over (order by b.ordre))::int,
         b.cle,
         case when b.cle like 'acte-%' then substring(b.cle from 6)::int end,
         case when b.cle like 'acte-%' then 'passage' else 'question' end,
         coalesce(co.intitule, pp.intitule),
         coalesce(co.options, pp.options),
         coalesce(co.bonne_reponse, pp.bonne),
         pp.fin_min
    from brut b
    left join public.corriges co on co.seance_id = p_seance_id and co.question = b.cle
    left join public.points_passage pp on pp.seance_id = p_seance_id and b.cle = 'acte-' || pp.acte
$$;
revoke all on function public.etapes_de(bigint) from public, anon, authenticated;

-- Le libellé court d'une étape : « Q6 », « Acte III ».
create or replace function public.libelle_etape(p_cle text)
returns text language sql immutable as $$
  select case
    when p_cle ~ '^q[0-9]+$' then 'Q' || substring(p_cle from 2)
    when p_cle ~ '^acte-[0-9]+$' then 'Acte ' ||
      (array['I','II','III','IV','V','VI','VII','VIII'])[substring(p_cle from 6)::int]
    else p_cle end
$$;

-- Où l'on s'arrête, en français : « au point de passage de l'acte III »,
-- « à la question 6 ».
create or replace function public.lieu_etape(p_cle text)
returns text language sql immutable as $$
  select case
    when p_cle ~ '^acte-[0-9]+$' then 'au point de passage de l''acte ' ||
      (array['I','II','III','IV','V','VI','VII','VIII'])[substring(p_cle from 6)::int]
    when p_cle ~ '^q[0-9]+$' then 'à la question ' || substring(p_cle from 2)
    else p_cle end
$$;

-- Ce que chaque étudiant a fait de chaque étape, une ligne par geste.
create or replace function public.gestes_etapes(p_seance_id bigint)
returns table (eleve_id bigint, cle text, reponse text, correct boolean, quand timestamptz)
language sql stable security definer set search_path = public as $$
  select r.eleve_id, r.question, r.reponse, r.correct, r.updated_at
    from public.reponses r
   where r.seance_id = p_seance_id and r.question ~ '^q[0-9]+$'
  union all
  select pa.eleve_id, 'acte-' || pa.acte, pa.reponse, pa.correct, pa.fait_le
    from public.passages pa where pa.seance_id = p_seance_id
$$;
revoke all on function public.gestes_etapes(bigint) from public, anon, authenticated;

-- ─── 2. Pendant l'heure : la carte du parcours ─────────────────────────────
create or replace function public.carte_parcours(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s      public.seances;
  v_appel  bigint;
  v_qa     text;
  v_n      int;
  v_res    jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero >= 90 or v_s.nature = 'projet' then
    return jsonb_build_object('ok', false, 'motif', 'pas_un_cours');
  end if;
  select count(*) into v_n from public.etapes_de(p_seance_id);
  if v_n = 0 then return jsonb_build_object('ok', false, 'motif', 'sans_etapes'); end if;

  select s.id into v_appel from public.seances s where s.classe_id = v_s.classe_id and s.numero = 99;
  v_qa := 'appel-' || to_char(coalesce(v_s.demarree_le::date, current_date), 'YYYY-MM-DD');

  with et as (select * from public.etapes_de(p_seance_id)),
  el as (
    select e.id, e.numero, e.avatar,
           exists (select 1 from public.reponses r where r.eleve_id = e.id
                    and r.seance_id = v_appel and r.question = v_qa) as appel
      from public.eleves e where e.classe_id = v_s.classe_id and e.numero <> '99'
  ),
  g as (select * from public.gestes_etapes(p_seance_id)),
  -- La grille : une case par (élève, étape).
  cases as (
    select el.id as eleve_id, et.rang, et.cle, g.correct, g.quand,
           case when g.cle is null then '.'
                when g.correct is true then 'J'
                when g.correct is false then 'F'
                else 'X' end as code
      from el cross join et
      left join g on g.eleve_id = el.id and g.cle = et.cle
  ),
  -- L'étape où chacun EST : la première sans réponse. Depuis quand : son
  -- dernier geste, ou le démarrage s'il n'a encore rien fait.
  ou as (
    select c.eleve_id,
           min(c.rang) filter (where c.code = '.') as ici,
           max(c.quand) as dernier,
           count(*) filter (where c.code <> '.')::int as faites
      from cases c group by c.eleve_id
  ),
  sorties as (
    select sp.eleve_id, count(distinct sp.cle)::int as n
      from public.sorties_page sp where sp.seance_id = p_seance_id group by sp.eleve_id
  ),
  eleves as (
    select el.id, el.numero, el.avatar, el.appel,
           (el.appel or ou.faites > 0) as present,
           ou.ici, ou.faites,
           case when ou.ici is not null and v_s.ouverte and v_s.demarree_le is not null
                 and (el.appel or ou.faites > 0)
                then floor(extract(epoch from now() - coalesce(ou.dernier, v_s.demarree_le)) / 60)::int
           end as depuis,
           coalesce(so.n, 0) as sorties,
           (select string_agg(c.code, '' order by c.rang) from cases c where c.eleve_id = el.id) as cases,
           exists (select 1 from public.mains m where m.eleve_id = el.id and m.seance_id = p_seance_id
                     and m.baissee_le is null and m.vue_le is null) as main
      from el join ou on ou.eleve_id = el.id
      left join sorties so on so.eleve_id = el.id
  ),
  -- Étape par étape : passée par combien, juste pour combien, et combien y
  -- sont EN CE MOMENT (les présents seulement).
  par_etape as (
    select et.rang, et.cle, et.acte, et.typ, et.intitule, et.fin_min,
           count(*) filter (where c.code <> '.')::int as passes,
           count(*) filter (where c.code = 'J')::int  as justes,
           count(*) filter (where c.code = 'F')::int  as faux,
           (select count(*) from eleves x where x.present and x.ici = et.rang)::int as ici,
           (select count(*) from eleves x where x.present and x.ici = et.rang and x.depuis >= 5)::int as ici_5min,
           (select count(distinct sp.eleve_id) from public.sorties_page sp
             where sp.seance_id = p_seance_id and sp.cle = et.cle)::int as sorties
      from et left join cases c on c.rang = et.rang
     group by et.rang, et.cle, et.acte, et.typ, et.intitule, et.fin_min
  )
  select jsonb_build_object(
    'ok', true, 'seance_id', v_s.id, 'numero', v_s.numero,
    'code', (select c.code from public.classes c where c.id = v_s.classe_id),
    'ouverte', v_s.ouverte,
    'minutes', case when v_s.demarree_le is not null and v_s.ouverte
                    then floor(extract(epoch from now() - v_s.demarree_le) / 60)::int end,
    'inscrits', (select count(*) from eleves),
    'presents', (select count(*) from eleves where present),
    'finis', (select count(*) from eleves where present and ici is null),
    'etapes', (select jsonb_agg(jsonb_build_object(
                 'rang', p.rang, 'cle', p.cle, 'libelle', public.libelle_etape(p.cle),
                 'acte', p.acte, 'type', p.typ, 'intitule', p.intitule, 'fin_min', p.fin_min,
                 'passes', p.passes, 'justes', p.justes, 'faux', p.faux,
                 'ici', p.ici, 'ici_5min', p.ici_5min, 'sorties', p.sorties)
               order by p.rang) from par_etape p),
    -- Les plus en arrière d'abord, puis ceux qui y sont depuis le plus
    -- longtemps : l'ordre dans lequel on va les voir. Les absents à la fin.
    'eleves', (select jsonb_agg(jsonb_build_object(
                 'eleve_id', x.id, 'numero', x.numero, 'avatar', x.avatar, 'present', x.present,
                 'appel', x.appel, 'ici', x.ici,
                 'ici_cle', (select e2.cle from et e2 where e2.rang = x.ici),
                 'faites', x.faites, 'depuis', x.depuis, 'sorties', x.sorties,
                 'main', x.main, 'cases', x.cases)
               order by (not x.present), coalesce(x.ici, 9999), x.depuis desc nulls last, x.numero)
               from eleves x),
    -- Le bouchon : au moins trois présents, et au moins le quart d'entre
    -- eux, sur la même étape. En dessous, ce n'est pas un endroit qui
    -- coince, c'est le rythme de chacun.
    'bouchon', (select jsonb_build_object('rang', p.rang, 'cle', p.cle,
                   'libelle', public.libelle_etape(p.cle), 'acte', p.acte,
                   'ici', p.ici, 'ici_5min', p.ici_5min, 'intitule', p.intitule)
                  from par_etape p
                 where p.ici >= 3
                   and p.ici * 4 >= (select count(*) from eleves where present)
                 order by p.ici desc, p.rang limit 1)
  ) into v_res;
  return v_res;
end; $$;
revoke all on function public.carte_parcours(bigint) from public, anon;
grant execute on function public.carte_parcours(bigint) to authenticated;

-- ─── 3. Après l'heure : ce que la séance apprend, et à chacun ──────────────
create or replace function public.analyse_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s        public.seances;
  v_appel    bigint;
  v_jour     date;
  v_qa       text;
  v_qh       text;
  v_n        int;
  v_presents int;
  v_res      jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero >= 90 or v_s.nature = 'projet' then
    return jsonb_build_object('ok', false, 'motif', 'pas_un_cours');
  end if;
  select count(*) into v_n from public.etapes_de(p_seance_id);
  if v_n = 0 then return jsonb_build_object('ok', false, 'motif', 'sans_etapes'); end if;

  v_jour := coalesce(v_s.demarree_le::date, current_date);
  v_qa   := 'appel-'  || to_char(v_jour, 'YYYY-MM-DD');
  v_qh   := 'humeur-' || to_char(v_jour, 'YYYY-MM-DD');
  select s.id into v_appel from public.seances s where s.classe_id = v_s.classe_id and s.numero = 99;

  with et as (select * from public.etapes_de(p_seance_id)),
  el as (
    select e.id, e.numero,
           exists (select 1 from public.reponses r where r.eleve_id = e.id
                    and r.seance_id = v_appel and r.question = v_qa) as appel,
           (select r.reponse from public.reponses r where r.eleve_id = e.id
              and r.seance_id = v_appel and r.question = v_qh limit 1) as humeur
      from public.eleves e where e.classe_id = v_s.classe_id and e.numero <> '99'
  ),
  g as (select * from public.gestes_etapes(p_seance_id)),
  -- Chaque geste avec le précédent DANS L'ORDRE DE LA PAGE : la durée d'une
  -- étape, c'est le temps entre la réponse à l'étape d'avant et la sienne —
  -- donc la lecture du passage qui y mène, plus la réponse. Le premier geste
  -- part du démarrage de la séance.
  suite as (
    select g.eleve_id, et.rang, et.cle, g.reponse, g.correct, g.quand,
           extract(epoch from g.quand - coalesce(
             lag(g.quand) over (partition by g.eleve_id order by et.rang),
             case when et.rang = 1 then v_s.demarree_le end)) as duree_s,
           lag(et.rang) over (partition by g.eleve_id order by et.rang) as rang_avant
      from g join et on et.cle = g.cle
  ),
  durees as (
    -- Une durée ne compte que si l'étape d'avant est bien l'étape
    -- précédente (pas de trou), et si elle est plausible : entre 0 et 40 min.
    select s.* from suite s
     where s.duree_s is not null and s.duree_s between 0 and 2400
       and (s.rang = 1 or s.rang_avant = s.rang - 1)
  ),
  lus as (select gl.eleve_id, gl.cle from public.gestes_lus(p_seance_id) gl
           where gl.lecture is not null and gl.ecart_s is not null and gl.ecart_s < gl.lecture),
  sorties as (select sp.eleve_id, sp.cle, sum(sp.secondes)::int as s
                from public.sorties_page sp where sp.seance_id = p_seance_id group by 1, 2),
  presents as (
    select el.* from el
     where el.appel or exists (select 1 from g where g.eleve_id = el.id)
  ),
  -- ── Les actes : prévu contre réel ──
  actes as (
    select et.acte, et.cle, et.intitule,
           et.fin_min - coalesce(lag(et.fin_min) over (order by et.acte), 0) as prevu_min,
           (select count(*) from public.passages pa
             where pa.seance_id = p_seance_id and pa.acte = et.acte)::int as passes
      from et where et.typ = 'passage'
  ),
  actes_reels as (
    -- Durée réelle d'un acte pour un étudiant : de son passage de l'acte
    -- précédent (ou du démarrage) à son passage de celui-ci.
    select a.acte, a.prevu_min, a.passes,
           (select percentile_cont(0.5) within group (order by d.minutes) from (
              select extract(epoch from p2.fait_le - coalesce(p1.fait_le, v_s.demarree_le)) / 60 as minutes
                from public.passages p2
                left join public.passages p1 on p1.eleve_id = p2.eleve_id and p1.seance_id = p2.seance_id
                                            and p1.acte = p2.acte - 1
               where p2.seance_id = p_seance_id and p2.acte = a.acte
                 and (p2.acte = 1 or p1.id is not null)
                 and coalesce(p1.fait_le, v_s.demarree_le) is not null) d
             where d.minutes between 0 and 60) as reel_min,
           (select count(*) from public.passages p2
              left join public.passages p1 on p1.eleve_id = p2.eleve_id and p1.seance_id = p2.seance_id
                                          and p1.acte = p2.acte - 1
             where p2.seance_id = p_seance_id and p2.acte = a.acte
               and (p2.acte = 1 or p1.id is not null)
               and coalesce(p1.fait_le, v_s.demarree_le) is not null)::int as mesures
      from actes a
  ),
  -- ── Les questions ──
  questions as (
    select et.rang, et.cle, et.acte, et.intitule, et.options, et.bonne,
           (select count(*) from g where g.cle = et.cle)::int as repondants,
           (select count(*) from g where g.cle = et.cle and g.correct is true)::int as justes,
           (select jsonb_object_agg(x.reponse, x.n) from (
              select g.reponse, count(*)::int as n from g where g.cle = et.cle group by 1) x) as choix,
           (select percentile_cont(0.5) within group (order by d.duree_s) from durees d
             where d.cle = et.cle) as mediane_s,
           (select count(*) from lus where lus.cle = et.cle)::int as sans_lire,
           (select count(*) from sorties so where so.cle = et.cle)::int as sorties,
           (select array_agg(k.rang order by k.rang) from public.concepts k
             where k.seance_id = p_seance_id and substring(et.cle from 2)::int = any(k.questions)) as concepts
      from et where et.typ = 'question'
  ),
  q2 as (
    select q.*,
           case when q.repondants > 0 then round(100.0 * q.justes / q.repondants)::int end as taux,
           (select x.l from (select key as l, value::int as n from jsonb_each_text(coalesce(q.choix, '{}'::jsonb))) x
             where x.l <> coalesce(q.bonne, '') and x.l ~ '^[A-D]$'
             order by x.n desc, x.l limit 1) as piege,
           (select max(value::int) from jsonb_each_text(coalesce(q.choix, '{}'::jsonb)) x
             where key <> coalesce(q.bonne, '') and key ~ '^[A-D]$') as piege_n
      from questions q
  ),
  -- ── Les étudiants ──
  eleves as (
    select el.id, el.numero, el.appel, el.humeur,
           (el.appel or exists (select 1 from g where g.eleve_id = el.id)) as present,
           (select count(*) from g where g.eleve_id = el.id)::int as faites,
           (select count(*) from g where g.eleve_id = el.id and g.cle like 'q%' and g.correct is not null)::int as notees,
           (select count(*) from g where g.eleve_id = el.id and g.cle like 'q%' and g.correct is true)::int as justes,
           (select min(et.rang) from et where not exists (
              select 1 from g where g.eleve_id = el.id and g.cle = et.cle)) as arret,
           (select array_agg(substring(g.cle from 2)::int order by substring(g.cle from 2)::int)
              from g where g.eleve_id = el.id and g.cle like 'q%' and g.correct is false) as fausses,
           (select count(*) from lus where lus.eleve_id = el.id)::int as sans_lire,
           (select count(*) from sorties so where so.eleve_id = el.id)::int as sorties_q,
           (select coalesce(sum(so.s), 0) from sorties so where so.eleve_id = el.id)::int as sorties_s,
           (select count(*) from public.mains m where m.eleve_id = el.id and m.seance_id = p_seance_id)::int as mains,
           (select sum(d.duree_s) from durees d where d.eleve_id = el.id) as duree_s,
           (select count(*) from durees d where d.eleve_id = el.id)::int as duree_n,
           (select count(*) from public.reponses r
              join public.reponses c on c.eleve_id = r.eleve_id and c.seance_id = r.seance_id
                                    and c.question = r.question || '-c'
             where r.eleve_id = el.id and r.seance_id = p_seance_id
               and r.question ~ '^pre-[0-9]+$' and r.correct is false and c.reponse = 'A')::int as sur_faux
      from el
  ),
  -- La durée « normale » : la médiane de ceux qui ont TOUT fait. Comparer
  -- quelqu'un qui s'est arrêté à l'acte II à ceux qui ont fini n'a pas de sens.
  repere as (
    select percentile_cont(0.5) within group (order by e.duree_s) as duree_med,
           count(*)::int as n
      from eleves e where e.present and e.arret is null and e.duree_n >= v_n - 1
  ),
  diag as (
    select e.*,
           (select array_agg(distinct k.rang order by k.rang) from public.concepts k
             where k.seance_id = p_seance_id and k.questions && coalesce(e.fausses, '{}')) as concepts_ko,
           array_remove(array[
             case when not e.present then
               jsonb_build_object('gravite', 'info', 'texte', 'Absent : la séance est à rattraper')
             end,
             case when e.present and e.arret is not null then
               jsonb_build_object('gravite', 'attention', 'texte',
                 case when e.faites = 0 then 'Présent, mais aucune étape faite'
                      else 'S''est arrêté ' || public.lieu_etape((select et.cle from et where et.rang = e.arret)) ||
                           ' (' || e.faites || ' étape' || case when e.faites > 1 then 's' else '' end ||
                           ' sur ' || v_n || ')' end)
             end,
             case when e.notees >= 4 and e.justes * 2 < e.notees then
               jsonb_build_object('gravite', 'attention', 'texte',
                 e.justes || ' réponse' || case when e.justes > 1 then 's' else '' end ||
                 ' juste' || case when e.justes > 1 then 's' else '' end || ' sur ' || e.notees || ' au quiz')
             end,
             case when e.humeur = 'D' or e.humeur like '😕%' then
               jsonb_build_object('gravite', 'attention', 'texte', 'Se disait « perdu » en arrivant')
             end,
             case when e.sorties_q >= 2 or e.sorties_s > 60 then
               jsonb_build_object('gravite', 'attention', 'texte',
                 'A quitté la page pendant ' || e.sorties_q || ' question' ||
                 case when e.sorties_q > 1 then 's' else '' end || ' (' || e.sorties_s || ' s)')
             when e.sorties_q = 1 then
               jsonb_build_object('gravite', 'a_suivre', 'texte',
                 'A quitté la page pendant une question (' || e.sorties_s || ' s)')
             end,
             case when e.sans_lire >= 3 then
               jsonb_build_object('gravite', 'a_suivre', 'texte',
                 e.sans_lire || ' réponses sans le temps de lire')
             end,
             case when e.arret is null and r.n >= 5 and e.duree_n >= v_n - 1
                       and e.duree_s >= 1.5 * r.duree_med then
               jsonb_build_object('gravite', 'a_suivre', 'texte',
                 'A mis ' || replace(to_char(e.duree_s / r.duree_med, 'FM9.0'), '.', ',') ||
                 ' fois plus de temps que la classe')
             end,
             case when e.sur_faux >= 2 then
               jsonb_build_object('gravite', 'a_suivre', 'texte',
                 'Sûr de lui et faux sur ' || e.sur_faux || ' notions du contrôle d''entrée')
             end,
             case when e.mains > 0 then
               jsonb_build_object('gravite', 'info', 'texte',
                 'A levé la main ' || case when e.mains = 1 then 'une fois' else e.mains || ' fois' end)
             end
           ], null) as raisons
      from eleves e cross join repere r
  ),
  -- ── Les points à améliorer dans la séance elle-même ──
  points as (
    select * from (
      -- Un acte nettement plus long que prévu.
      select 1 as ordre, 'attention' as gravite,
             'L''acte ' || (array['I','II','III','IV','V','VI','VII','VIII'])[a.acte] ||
             ' a duré ' || round(a.reel_min)::int || ' min en médiane, pour ' || a.prevu_min ||
             ' prévues : à alléger, ou à couper en deux.' as texte
        from actes_reels a
       where a.mesures >= 5 and a.prevu_min > 0 and a.reel_min > a.prevu_min * 1.3 + 2
      union all
      -- Une question ratée, avec son distracteur s'il est partagé.
      select 2, case when q.taux < 40 then 'attention' else 'a_suivre' end,
             'Question ' || substring(q.cle from 2) || ' : ' || q.taux || ' % juste (' || q.justes ||
             ' sur ' || q.repondants || ')' ||
             case when q.piege is not null and q.piege_n * 100 >= 35 * q.repondants then
               ' — ' || q.piege_n || ' ont choisi « ' ||
               coalesce(q.options[ascii(q.piege) - 64], q.piege) ||
               ' » : une idée fausse partagée, à reprendre en début de séance suivante.'
             else ' : à reprendre en début de séance suivante.' end
        from q2 q where q.repondants >= 5 and q.taux < 50
      union all
      -- Une question qu'on va chercher ailleurs.
      select 3, 'a_suivre',
             'Question ' || substring(q.cle from 2) || ' : ' || q.sorties ||
             ' étudiants ont quitté la page pour y répondre. La réponse est-elle bien dans la page ?'
        from q2 q
       where q.sorties >= 3 and q.sorties * 10 >= (select count(*) from presents)
      union all
      -- Une question répondue sans lire par beaucoup : trop devinable.
      select 4, 'a_suivre',
             'Question ' || substring(q.cle from 2) || ' : ' || q.sans_lire ||
             ' réponses sans le temps de lire. Les options se devinent-elles ?'
        from q2 q
       where q.repondants >= 5 and q.sans_lire * 4 >= q.repondants
      union all
      -- Où ceux qui n'ont pas fini se sont arrêtés.
      select 5, case when x.n * 5 >= (select count(*) from presents) then 'attention' else 'a_suivre' end,
             x.n || ' étudiant' || case when x.n > 1 then 's' else '' end ||
             ' présent' || case when x.n > 1 then 's' else '' end || ' n''' ||
             case when x.n > 1 then 'ont' else 'a' end || ' pas fini' ||
             case when x.lieu is not null then ' — le plus souvent arrêtés ' || x.lieu ||
                  ' : la fin d''heure est trop chargée, ou cette étape bloque.' else '.' end
        from (select count(*)::int as n,
                     (select public.lieu_etape(et.cle) from et where et.rang = (
                        select mode() within group (order by d2.arret) from diag d2
                         where d2.present and d2.arret is not null and d2.faites > 0)) as lieu
                from diag d where d.present and d.arret is not null) x
       where x.n >= 2
      union all
      -- Des mains levées concentrées sur un acte.
      select 6, 'a_suivre',
             m.n || ' mains levées à l''acte ' ||
             (array['I','II','III','IV','V','VI','VII','VIII'])[m.acte] || ' : un passage à réexpliquer.'
        from (select acte, count(*)::int as n from public.mains
               where seance_id = p_seance_id and acte is not null group by acte) m
       where m.n >= 2
      union all
      -- Une question réussie par tous, très vite : elle ne mesure plus rien.
      select 7, 'info',
             'Question ' || substring(q.cle from 2) || ' : réussie par tous (' || q.repondants ||
             ') — elle ne départage plus personne ; la garder seulement si elle rassure.'
        from q2 q where q.repondants >= 8 and q.justes = q.repondants
    ) p
  )
  select jsonb_build_object(
    'ok', true, 'seance_id', v_s.id, 'numero', v_s.numero, 'titre', v_s.titre,
    'code', (select c.code from public.classes c where c.id = v_s.classe_id),
    'jouee', v_s.demarree_le is not null or exists (select 1 from g),
    'inscrits', (select count(*) from el),
    'presents', (select count(*) from presents),
    'finis', (select count(*) from diag where present and arret is null),
    'etapes', v_n,
    'duree_mediane_min', (select round((duree_med / 60)::numeric) from repere where n >= 5),
    'points', coalesce((select jsonb_agg(jsonb_build_object('gravite', p.gravite, 'texte', p.texte)
                         order by case p.gravite when 'attention' then 0 when 'a_suivre' then 1 else 2 end, p.ordre)
                         from points p), '[]'::jsonb),
    'actes', coalesce((select jsonb_agg(jsonb_build_object(
                'acte', a.acte, 'prevu_min', a.prevu_min, 'passes', a.passes, 'mesures', a.mesures,
                'reel_min', case when a.mesures >= 5 then round(a.reel_min::numeric, 1) end)
              order by a.acte) from actes_reels a), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
                'cle', q.cle, 'numero', substring(q.cle from 2)::int, 'acte', q.acte,
                'intitule', q.intitule, 'options', q.options, 'bonne', q.bonne,
                'repondants', q.repondants, 'justes', q.justes, 'taux', q.taux,
                'piege', q.piege, 'piege_n', q.piege_n,
                'mediane_s', case when q.repondants >= 5 then round(q.mediane_s::numeric) end,
                'sans_lire', q.sans_lire, 'sorties', q.sorties, 'concepts', q.concepts)
              order by q.rang) from q2 q), '[]'::jsonb),
    'concepts', coalesce((select jsonb_agg(jsonb_build_object(
                'rang', k.rang, 'intitule', k.intitule, 'questions', k.questions)
              order by k.rang) from public.concepts k where k.seance_id = p_seance_id), '[]'::jsonb),
    'eleves', coalesce((select jsonb_agg(jsonb_build_object(
                'eleve_id', d.id, 'numero', d.numero, 'present', d.present, 'faites', d.faites,
                'notees', d.notees, 'justes', d.justes,
                'arret', case when d.arret is not null then
                           (select et.cle from et where et.rang = d.arret) end,
                'fausses', coalesce(to_jsonb(d.fausses), '[]'::jsonb),
                'concepts_ko', coalesce(to_jsonb(d.concepts_ko), '[]'::jsonb),
                'raisons', to_jsonb(d.raisons),
                'priorite', case
                   when not d.present then 'absent'
                   when exists (select 1 from unnest(d.raisons) r where r->>'gravite' = 'attention') then 'a_revoir'
                   when exists (select 1 from unnest(d.raisons) r where r->>'gravite' = 'a_suivre') then 'a_surveiller'
                   else 'ok' end)
              order by case
                   when not d.present then 3
                   when exists (select 1 from unnest(d.raisons) r where r->>'gravite' = 'attention') then 0
                   when exists (select 1 from unnest(d.raisons) r where r->>'gravite' = 'a_suivre') then 1
                   else 2 end, d.numero) from diag d), '[]'::jsonb)
  ) into v_res;
  return v_res;
end; $$;
revoke all on function public.analyse_seance(bigint) from public, anon;
grant execute on function public.analyse_seance(bigint) to authenticated;

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
--  L'existence partout. Le comportement seulement si `est_enseignant()`
--  répond vrai (en CI, où elle est bouchonnée) — et dans un bloc qui finit en
--  exception : tout ce qu'il écrit pour l'essai est annulé, on ne garde que
--  le verdict.
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('etapes_de', 'gestes_etapes', 'carte_parcours', 'analyse_seance', 'libelle_etape', 'lieu_etape');
  if v_n <> 6 then raise exception 'carte et analyse : % fonction(s) sur 6', v_n; end if;
  select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = 'etapes_seance';
  if v_n <> 0 then raise exception 'etapes_seance : % politique(s), attendu 0', v_n; end if;
  if has_function_privilege('anon', 'public.analyse_seance(bigint)', 'execute') then
    raise exception 'analyse_seance est exécutable par anon — elle est nominative';
  end if;
  if public.libelle_etape('acte-3') <> 'Acte III' or public.libelle_etape('q10') <> 'Q10' then
    raise exception 'libelle_etape : % / %', public.libelle_etape('acte-3'), public.libelle_etape('q10');
  end if;
end $$;

do $$
declare
  v_cl bigint; v_s bigint; v_e int[]; v_r jsonb; v_a jsonb; i int; v_id bigint;
begin
  if not public.est_enseignant() then
    raise notice 'Carte et analyse en place. Comportement non vérifié ici : session non enseignante.';
    return;
  end if;
  begin
    -- Une classe d'essai, une séance de trois étapes : q1, acte-1, q2.
    insert into public.classes (code, nom, annee) values ('ESSAI-CARTE', 'essai', 'essai') returning id into v_cl;
    insert into public.seances (classe_id, numero, titre, ouverte, demarree_le)
    values (v_cl, 1, 'essai', true, now() - interval '30 min') returning id into v_s;
    insert into public.corriges (seance_id, question, bonne_reponse, intitule, options) values
      (v_s, 'q1', 'A', 'Un ?', array['a','b','c','d']),
      (v_s, 'q2', 'B', 'Deux ?', array['a','b','c','d']);
    insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne)
    values (v_s, 1, 'Un', 10, 'Acte ?', array['a','b','c','d'], 'C');
    insert into public.etapes_seance values (v_s, 1, 'q1'), (v_s, 2, 'acte-1'), (v_s, 3, 'q2');
    for i in 1..6 loop
      insert into public.eleves (classe_id, numero) values (v_cl, lpad(i::text, 2, '0')) returning id into v_id;
      v_e := v_e || v_id::int;
    end loop;
    -- 01 à 04 : q1 juste à 5 min ; 01 et 02 passent l'acte ; 01 finit.
    -- 05 : q1 faux. 06 : rien du tout (absent).
    for i in 1..5 loop
      insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
      values (v_e[i], v_s, 'q1', case when i = 5 then 'B' else 'A' end, i <> 5, now() - interval '25 min');
    end loop;
    insert into public.passages (seance_id, eleve_id, acte, reponse, correct, fait_le)
    values (v_s, v_e[1], 1, 'C', true, now() - interval '20 min'),
           (v_s, v_e[2], 1, 'A', false, now() - interval '19 min');
    insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
    values (v_e[1], v_s, 'q2', 'B', true, now() - interval '15 min');

    v_r := public.carte_parcours(v_s);
    if not (v_r->>'ok')::boolean then raise exception 'carte refusée : %', v_r; end if;
    if (v_r->>'presents')::int <> 5 then raise exception 'carte : % présents, attendu 5', v_r->>'presents'; end if;
    if (v_r->>'finis')::int <> 1 then raise exception 'carte : % finis, attendu 1', v_r->>'finis'; end if;
    -- Trois sont sur l'acte I (03, 04, 05) : c'est le bouchon.
    if v_r->'bouchon'->>'cle' is distinct from 'acte-1' or (v_r->'bouchon'->>'ici')::int <> 3 then
      raise exception 'carte : bouchon %', v_r->'bouchon';
    end if;
    -- Le premier listé est le plus en arrière : un des trois de l'acte I ;
    -- l'absent est le dernier, et sa ligne n'a que des points.
    if v_r->'eleves'->0->>'ici_cle' <> 'acte-1' then raise exception 'carte : ordre %', v_r->'eleves'->0; end if;
    if v_r->'eleves'->5->>'numero' <> '06' or v_r->'eleves'->5->>'cases' <> '...' then
      raise exception 'carte : l''absent %', v_r->'eleves'->5;
    end if;
    if (select x->>'cases' from jsonb_array_elements(v_r->'eleves') x
         where x->>'numero' = '02') is distinct from 'JF.' then
      raise exception 'carte : cases du 02 %', v_r->'eleves';
    end if;

    v_a := public.analyse_seance(v_s);
    if not (v_a->>'ok')::boolean then raise exception 'analyse refusée : %', v_a; end if;
    if (v_a->>'presents')::int <> 5 or (v_a->>'finis')::int <> 1 then
      raise exception 'analyse : présents %, finis %', v_a->>'presents', v_a->>'finis';
    end if;
    -- Quatre présents n'ont pas fini : la phrase le dit, avec le lieu.
    if not exists (select 1 from jsonb_array_elements(v_a->'points') p
                    where p->>'texte' like '4 étudiants présents n''ont pas fini%arrêtés au point de passage de l''acte I :%') then
      raise exception 'analyse : arrêts non dits — %', v_a->'points';
    end if;
    -- Le 05 a répondu faux à q1, s'est arrêté : à revoir ; le 06 est absent.
    if (select x->>'priorite' from jsonb_array_elements(v_a->'eleves') x where x->>'numero' = '05') <> 'a_revoir'
       or (select x->>'priorite' from jsonb_array_elements(v_a->'eleves') x where x->>'numero' = '06') <> 'absent'
       or (select x->>'priorite' from jsonb_array_elements(v_a->'eleves') x where x->>'numero' = '01') <> 'ok' then
      raise exception 'analyse : priorités %', v_a->'eleves';
    end if;
    if (select (x->'fausses')->>0 from jsonb_array_elements(v_a->'eleves') x where x->>'numero' = '05') <> '1' then
      raise exception 'analyse : fausses du 05 %', v_a->'eleves';
    end if;
    raise exception 'ESSAI-OK';
  exception when others then
    if sqlerrm <> 'ESSAI-OK' then raise; end if;
  end;
  raise notice 'Carte du parcours et analyse : comportement vérifié sur une classe d''essai (annulée).';
end $$;
