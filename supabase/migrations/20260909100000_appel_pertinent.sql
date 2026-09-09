-- ═══════════════════════════════════════════════════════════════════════════
--  L'APPEL DIT CE QU'IL FAUT SAVOIR, ET RIEN DE FAUX
--
--  Trois défauts vus sur la carte du 09/09 :
--
--   1. Le compte d'essai n° 99 comptait comme absent. Tous les jours, pour
--      toutes les classes. « 8 absents » quand il y en avait 7, et un effectif
--      de 32 pour 31 étudiants. Le filtre `numero <> '99'` existe partout
--      ailleurs — préflight, semestre, questionnaires — et manquait ici.
--
--   2. Aucun dénominateur. « 24 présents » ne dit pas s'il en manque un ou
--      douze. « 24 / 31 » se lit sans réfléchir.
--
--   3. Aucune mémoire. Une absence isolée et une quatrième absence de suite
--      demandent deux gestes différents, et la carte ne les distinguait pas.
--      appel_classe() compte désormais, pour chaque absent, combien d'appels
--      il a manqués depuis le début de l'année, et depuis combien de jours
--      on ne l'a pas vu.
--
--  Aucun nom n'entre en base : la fonction ne rend que des numéros. La
--  correspondance numéro → prénom vit dans le navigateur de l'enseignant.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.appel_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seance   bigint;
  v_q        text := 'appel-' || to_char(current_date, 'YYYY-MM-DD');
  v_intitule text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select id into v_seance from public.seances
   where classe_id = p_classe_id and numero = 99;
  if not found then return jsonb_build_object('ok', false, 'motif', 'pas_de_seance'); end if;

  select intitule into v_intitule from public.corriges
   where seance_id = v_seance and question = v_q;
  if not found then
    return jsonb_build_object('ok', true, 'pose', false);
  end if;

  return (
    -- Le compte d'essai n° 99 n'est pas un étudiant. Il l'était pour cette
    -- fonction, et pour elle seule.
    with inscrits as (
      select e.id, e.numero, e.avatar
        from public.eleves e
       where e.classe_id = p_classe_id and e.numero <> '99'
    ),

    -- Tous les appels déjà posés à cette classe, celui du jour compris. C'est
    -- le dénominateur de l'assiduité : sans lui, « 3 absences » ne dit pas si
    -- c'est sur quatre séances ou sur trente.
    appels as (
      select co.question, co.question::text as jour
        from public.corriges co
       where co.seance_id = v_seance
         and co.question like 'appel-2%'          -- « appel-modele » exclu
    ),

    -- Qui a répondu à quoi, sur toute l'année.
    vus as (
      select r.eleve_id, r.question,
             to_char(r.updated_at at time zone 'Europe/Paris', 'HH24:MI') as heure,
             r.updated_at
        from public.reponses r
        join inscrits i on i.id = r.eleve_id
       where r.seance_id = v_seance and r.question like 'appel-2%'
    ),

    etat as (
      select i.numero, i.avatar,
             (select heure from vus v where v.eleve_id = i.id and v.question = v_q) as heure,
             (select updated_at from vus v where v.eleve_id = i.id and v.question = v_q) as quand,
             (select count(*) from appels)                                     as appels_poses,
             (select count(*) from vus v where v.eleve_id = i.id)              as venus,
             -- Le dernier appel auquel il a répondu, celui du jour excepté :
             -- « vu pour la dernière fois le… » n'a de sens que pour un absent.
             (select max(substring(v.question from 7)::date)
                from vus v where v.eleve_id = i.id and v.question <> v_q)      as derniere_venue
        from inscrits i
    )

    select jsonb_build_object(
      'ok', true, 'pose', true, 'intitule', v_intitule,
      'inscrits', (select count(*) from inscrits),
      'appels_poses', (select count(*) from appels),
      'presents', coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar, 'heure', heure)
                   order by quand) from etat where heure is not null), '[]'::jsonb),
      'absents',  coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar,
                     -- manquees : combien d'appels posés il n'a pas honorés.
                     'manquees', appels_poses - venus,
                     'sur',      appels_poses,
                     'depuis',   case when derniere_venue is not null
                                      then current_date - derniere_venue end,
                     'jamais',   venus = 0)
                   order by numero) from etat where heure is null), '[]'::jsonb))
  );
end; $$;

grant execute on function public.appel_classe(bigint) to authenticated;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
do $$
declare v jsonb; v_cl bigint; n int;
begin
  select id into v_cl from public.classes where code = 'BTS1-DEV-2026';
  if v_cl is null then
    raise notice 'Pas de classe BTS1-DEV-2026 : controle passe.';
    return;
  end if;
  v := public.appel_classe(v_cl);
  if (v->>'ok')::boolean is not true then
    raise notice 'appel_classe : %', v->>'motif'; return;
  end if;

  select count(*) into n from public.eleves
   where classe_id = v_cl and numero <> '99';
  if (v->>'pose')::boolean and (v->>'inscrits')::int <> n then
    raise exception 'appel_classe rend % inscrits, attendu %', v->>'inscrits', n;
  end if;

  if exists (select 1 from jsonb_array_elements(coalesce(v->'absents','[]'::jsonb)) x
              where x->>'numero' = '99')
     or exists (select 1 from jsonb_array_elements(coalesce(v->'presents','[]'::jsonb)) x
              where x->>'numero' = '99') then
    raise exception 'le compte d''essai n° 99 apparait encore dans l''appel';
  end if;
  raise notice 'Appel : n° 99 exclu, % inscrits.', v->>'inscrits';
end $$;
