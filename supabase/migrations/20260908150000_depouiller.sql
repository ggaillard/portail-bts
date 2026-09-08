-- ═══════════════════════════════════════════════════════════════════════════
--  DÉPOUILLER N'IMPORTE QUEL QUESTIONNAIRE
--
--  connaissance_classe() et stage_classe() font la même chose sur deux numéros
--  écrits en dur. Un questionnaire écrit depuis le portail n'aurait donc eu
--  aucune vue de dépouillement : on pourrait le poser, l'allumer, recevoir les
--  réponses — et ne jamais les voir. Autant ne pas l'écrire.
--
--  depouiller_questionnaire(seance_id) prend la séance plutôt que le numéro.
--  Même sortie que connaissance_classe(), à laquelle elle est calquée : le
--  portail sait déjà l'afficher.
--
--  Les deux anciennes fonctions restent, inchangées.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.depouiller_questionnaire(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s public.seances;
  v_m public.modeles;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero not between 90 and 98 then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;
  select * into v_m from public.modeles where id = v_s.modele_id;

  return (
    with q as (
      select co.question, co.intitule, co.options
        from public.corriges co where co.seance_id = v_s.id
    ),
    -- Le compte d'essai n° 99 est exclu ici comme partout : deux écrans qui
    -- donnent deux effectifs pour la même classe, c'est un écran de trop.
    eleves as (
      select e.id, e.numero, e.avatar
        from public.eleves e
       where e.classe_id = v_s.classe_id and e.numero <> '99'
    ),
    rep as (
      select r.question, r.reponse, e.numero
        from public.reponses r
        join eleves e on e.id = r.eleve_id
       where r.seance_id = v_s.id
    ),
    dist as (
      select q.question, q.intitule, q.options,
             coalesce((select jsonb_object_agg(t.reponse, t.n) from (
                 select reponse, count(*) as n from rep
                  where rep.question = q.question group by reponse) t),
               '{}'::jsonb) as compte,
             -- « qui » donne les numéros derrière chaque réponse : savoir que
             -- trois étudiants n'ont pas d'ordinateur ne sert à rien si on
             -- ignore lesquels.
             coalesce((select jsonb_object_agg(t.reponse, t.nums) from (
                 select reponse, jsonb_agg(numero order by numero) as nums from rep
                  where rep.question = q.question group by reponse) t),
               '{}'::jsonb) as qui
        from q
    ),
    etat as (
      select e.numero, e.avatar, count(r.question) as faites
        from eleves e
        left join public.reponses r on r.eleve_id = e.id and r.seance_id = v_s.id
       group by e.numero, e.avatar
    )
    select jsonb_build_object(
      'ok', true,
      'seance_id', v_s.id,
      'titre',     coalesce(v_m.titre, v_s.titre),
      'mode',      coalesce(v_m.mode, 'sequentiel'),
      'ouvert',    v_s.ouverte,
      'total_questions', (select count(*) from q),
      'inscrits',        (select count(*) from etat),
      'termines',        (select count(*) from etat
                           where faites >= (select count(*) from q)
                             and (select count(*) from q) > 0),
      'questions', coalesce((select jsonb_agg(jsonb_build_object(
                     'question', question, 'intitule', intitule,
                     'options',  to_jsonb(options),
                     'compte',   compte,
                     'qui',      qui) order by question) from dist), '[]'::jsonb),
      'eleves',    coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar, 'faites', faites)
                   order by numero) from etat), '[]'::jsonb))
  );
end; $$;

grant execute on function public.depouiller_questionnaire(bigint) to authenticated;
