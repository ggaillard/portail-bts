-- ═══════════════════════════════════════════════════════════════════════════
--  LE CARNET D'UNE CLASSE — élèves × séances, comme un carnet de notes
--
--  Refonte du 28/09, lot « après la séance ». Le portail savait tout dire
--  d'UNE séance et presque rien d'un élève sur la durée : un décrochage sur
--  trois séances ne se voyait qu'en ouvrant les trois l'une après l'autre.
--
--  `carnet_classe(classe_id)` rend, en un appel :
--    · les séances jouées (< 90, démarrées ou déjà répondues), dans l'ordre ;
--    · pour chaque élève (hors n° 99), séance par séance : réponses, réussite,
--      jalons franchis ; et sa présence aux appels posés.
--
--  Calculé en base et non dans la page : une classe de 31 sur 14 séances,
--  c'est 5 000 lignes de réponses — au-delà des 1 000 que rend une lecture
--  REST par défaut. Une page qui compterait elle-même compterait faux, sans
--  le dire.
--
--  Les règles habituelles, les mêmes que partout :
--    · `pre-%` (contrôle d'entrée), `appel-%`, `humeur-%` hors réussite ;
--    · une réponse évaluée : `correct` renseigné, ou `ok` / `ko` ;
--    · un jalon : clé `tp…` à 'true' ou 'ok' ;
--    · `numero <> '99'` : le compte d'essai n'est pas un élève.
--
--  Rejouable sans risque (une fonction, pas de donnée).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.carnet_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_appel bigint; v_poses int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select id into v_appel from public.seances where classe_id = p_classe_id and numero = 99;
  select count(*) into v_poses from public.corriges
   where seance_id = v_appel and question like 'appel-%';

  return (
    with el as (
      select e.id, e.numero, e.avatar from public.eleves e
       where e.classe_id = p_classe_id and e.numero <> '99'
    ),
    se as (
      select s.id, s.numero, s.titre, s.nature, s.jalons, s.module_id, s.demarree_le,
             (select count(*) from public.corriges co
               where co.seance_id = s.id and co.question not like 'pre-%') as questions
        from public.seances s
       where s.classe_id = p_classe_id and s.numero < 90
         and (s.demarree_le is not null
              or exists (select 1 from public.reponses r join el on el.id = r.eleve_id
                          where r.seance_id = s.id))
    ),
    agg as (
      select r.eleve_id, r.seance_id,
             count(*) filter (where r.question not like 'pre-%'
                                and r.question not like 'appel-%'
                                and r.question not like 'humeur-%')          as n,
             count(*) filter (where r.question not like 'pre-%'
                                and r.question not like 'appel-%'
                                and r.question not like 'humeur-%'
                                and (r.correct is not null or r.reponse in ('ok', 'ko'))) as ev,
             count(*) filter (where r.question not like 'pre-%'
                                and r.question not like 'appel-%'
                                and r.question not like 'humeur-%'
                                and (r.correct is true or r.reponse = 'ok')) as ok,
             count(*) filter (where r.question like 'tp%'
                                and r.reponse in ('true', 'ok'))             as jal,
             max(r.updated_at)                                              as dernier
        from public.reponses r
        join el on el.id = r.eleve_id
        join se on se.id = r.seance_id
       group by r.eleve_id, r.seance_id
    ),
    pres as (
      select r.eleve_id, count(distinct r.question) as presents
        from public.reponses r join el on el.id = r.eleve_id
       where r.seance_id = v_appel and r.question like 'appel-%'
       group by r.eleve_id
    )
    select jsonb_build_object(
      'ok', true,
      'appels', v_poses,
      'seances', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', se.id, 'numero', se.numero, 'titre', se.titre, 'nature', se.nature,
                   'jalons', se.jalons, 'module_id', se.module_id, 'demarree_le', se.demarree_le,
                   'questions', se.questions)
                   order by se.numero) from se), '[]'::jsonb),
      'eleves', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', el.id, 'numero', el.numero, 'avatar', el.avatar,
                   'presents', coalesce(p.presents, 0),
                   'cases', coalesce((select jsonb_object_agg(a.seance_id::text, jsonb_build_object(
                              'n', a.n, 'ev', a.ev, 'ok', a.ok, 'jal', a.jal, 'dernier', a.dernier))
                              from agg a where a.eleve_id = el.id), '{}'::jsonb))
                   order by el.numero)
                  from el left join pres p on p.eleve_id = el.id), '[]'::jsonb)
    )
  );
end; $$;

grant execute on function public.carnet_classe(bigint) to authenticated;

-- ─── Ce qui doit tenir ─────────────────────────────────────────────────────
--  Sur une base neuve, est_enseignant() répond vrai (bouchon du workflow) :
--  on vérifie le COMPORTEMENT. Sur la vraie base, pendant la migration, il
--  répond faux : on vérifie seulement que la fonction existe et refuse.
do $$
declare v jsonb; v_id bigint; n int;
begin
  select id into v_id from public.classes where code = 'BTS1-DEV-2026';
  if v_id is null then raise notice 'Pas de BTS1 : carnet non vérifié.'; return; end if;
  v := public.carnet_classe(v_id);
  if not public.est_enseignant() then
    if (v->>'motif') is distinct from 'refus' then
      raise exception 'carnet_classe() ne refuse pas hors session enseignante';
    end if;
    raise notice 'carnet_classe() : comportement non vérifié ici (pas de session enseignante).';
    return;
  end if;
  if not (v->>'ok')::boolean then raise exception 'carnet_classe() : %', v; end if;
  select count(*) into n from jsonb_array_elements(v->'eleves') x where x->>'numero' = '99';
  if n > 0 then raise exception 'carnet_classe() compte le n° 99'; end if;
  select count(*) into n from jsonb_array_elements(v->'seances') x where (x->>'numero')::int >= 90;
  if n > 0 then raise exception 'carnet_classe() rend % séance(s) 90-99', n; end if;

  raise notice 'Carnet en place : % élève(s), % séance(s) jouée(s).',
    jsonb_array_length(v->'eleves'), jsonb_array_length(v->'seances');

  -- Un contrôle d'entrée ne compte pas : on en pose un, dans un bloc annulé.
  begin
    insert into public.reponses (eleve_id, seance_id, question, reponse, correct)
    select e.id, s.id, 'pre-01', 'A', true
      from public.eleves e, public.seances s
     where e.classe_id = v_id and e.numero <> '99' and s.classe_id = v_id and s.numero = 1
     order by e.numero limit 1;
    v := public.carnet_classe(v_id);
    select count(*) into n from jsonb_array_elements(v->'eleves') x,
           jsonb_each(x->'cases') c where (c.value->>'n')::int > 0 or (c.value->>'ok')::int > 0;
    if n > 0 then raise exception 'carnet_classe() compte une réponse de contrôle d''entrée'; end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;
end $$;
