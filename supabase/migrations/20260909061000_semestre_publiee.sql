-- ═══════════════════════════════════════════════════════════════════════════
--  « LE SEMESTRE » CONNAÎT MAINTENANT LA PUBLICATION
--
--  semestre() rendait l'état de chaque séance mais pas son identifiant ni son
--  état de publication. Sans identifiant, la carte ne peut pas basculer la
--  publication ; sans l'état, elle ne sait pas quoi basculer.
--
--  Le corps est repris tel quel depuis 20260908090000_semestre.sql, à deux
--  lignes près. Le fichier d'origine n'est pas modifié : la chaîne se rejoue
--  dans l'ordre, et c'est cette version-ci qui gagne — comme le veut la règle
--  déjà écrite pour preflight_seance().
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.semestre()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  return (
  with

  -- L'effectif réel : le compte d'essai n° 99 n'est pas un étudiant.
  effectif as (
    select classe_id, count(*)::int as inscrits
      from public.eleves where numero <> '99' group by classe_id
  ),

  -- Les réponses qui comptent, séance par séance.
  --  · « évaluée » : une question de quiz, corrigée. L'humeur et l'appel n'en
  --    sont pas — on ne réussit pas une présence.
  --  · « jalon franchi » : une case cochée du parcours BTS2, clé « tp… »
  --    valant « true ». Voir CLAUDE.md, ce point a déjà coûté deux erreurs.
  rep as (
    select r.seance_id,
           r.eleve_id,
           (r.correct is not null or r.reponse in ('ok', 'ko'))
             and r.question not like 'humeur-%'
             and r.question not like 'appel-%'                as evaluee,
           (r.correct is true or r.reponse = 'ok')            as juste,
           (r.question like 'tp%' and r.reponse = 'true')     as jalon,
           r.updated_at
      from public.reponses r
      join public.eleves e on e.id = r.eleve_id
     where e.numero <> '99'
  ),

  parseance as (
    select s.id, s.classe_id, s.numero, s.titre, s.nature, s.notee, s.ouverte,
           s.publiee, s.jalons, s.echeance, s.duree_min,
           (select count(*) from public.corriges co where co.seance_id = s.id)::int as corriges,
           (select count(distinct rp.eleve_id) from rep rp where rp.seance_id = s.id)::int as repondants,
           (select count(*) from rep rp where rp.seance_id = s.id and rp.evaluee)::int as evaluees,
           (select count(*) from rep rp where rp.seance_id = s.id and rp.evaluee and rp.juste)::int as justes,
           (select count(*) from rep rp where rp.seance_id = s.id and rp.jalon)::int as jalons_franchis,
           (select max(rp.updated_at) from rep rp where rp.seance_id = s.id) as dernier
      from public.seances s
     where s.numero < 90
  ),

  calcul as (
    select p.*,
           e.inscrits,
           case
             when p.corriges = 0 and p.nature = 'cours' then 'a_produire'
             when p.repondants = 0                      then 'prete'
             when p.ouverte                             then 'en_cours'
             else                                            'jouee'
           end as etat,
           case when p.evaluees > 0
                then round(p.justes * 100.0 / p.evaluees)::int end as reussite,
           -- Avancement d'un projet : jalons franchis rapportés au total
           -- déclaré, sur l'effectif entier — pas sur les seuls actifs, sinon
           -- une classe où trois étudiants travaillent affiche 100 %.
           case when p.nature = 'projet' and coalesce(p.jalons, 0) > 0 and e.inscrits > 0
                then round(p.jalons_franchis * 100.0 / (p.jalons * e.inscrits))::int end as avancement
      from parseance p
      left join effectif e on e.classe_id = p.classe_id
  )

  select jsonb_build_object(
    'ok', true,
    'classes', coalesce((
      select jsonb_agg(cl order by cl->>'code')
        from (
          select jsonb_build_object(
            'code',     c.code,
            'nom',      c.nom,
            'inscrits', coalesce(max(k.inscrits), 0),
            'total',    count(k.id),
            'pretes',   count(*) filter (where k.etat in ('prete', 'en_cours', 'jouee')),
            'jouees',   count(*) filter (where k.etat = 'jouee'),
            'seances',  coalesce(jsonb_agg(jsonb_build_object(
                          'seance_id',   k.id,
                          'numero',      k.numero,
                          'publiee',     k.publiee,
                          'titre',       k.titre,
                          'nature',      k.nature,
                          'notee',       k.notee,
                          'ouverte',     k.ouverte,
                          'etat',        k.etat,
                          'corriges',    k.corriges,
                          'repondants',  k.repondants,
                          'inscrits',    k.inscrits,
                          'reussite',    k.reussite,
                          'avancement',  k.avancement,
                          'jalons',      k.jalons,
                          'echeance',    k.echeance,
                          'dernier', to_char(k.dernier at time zone 'Europe/Paris', 'DD/MM'))
                        order by k.numero), '[]'::jsonb)) as cl
            from public.classes c
            join calcul k on k.classe_id = c.id
           where c.code not like 'DEMO%'
           group by c.id, c.code, c.nom
        ) t), '[]'::jsonb)));
end; $$;

grant execute on function public.semestre() to authenticated;
