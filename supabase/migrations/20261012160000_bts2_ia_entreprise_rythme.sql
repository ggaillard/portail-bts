-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — IA EN ENTREPRISE : LE QUESTIONNAIRE SUIT LE NOUVEAU RYTHME
--
--  Le 12/10 à 14 h 30, le module a été étalé sur mardi, mercredi et jeudi
--  (20261012150000_bts2_seance24_avancee.sql). L'introduction et les thèmes
--  du questionnaire « IA en entreprise — auto-évaluation » parlaient encore de
--  « mercredi » et « jeudi » : ils parlent désormais des séances 25 et 26.
--
--  Rien n'est réécrit dès qu'une réponse existe (ni le modèle, ni l'affectation).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_rep int;
begin
  select id into v_id from public.modeles where cle = 'autoeval-ia-entreprise';
  if v_id is null then
    raise notice 'autoeval-ia-entreprise absent : rien à faire.';
    return;
  end if;
  select count(*) into v_rep
    from public.reponses r join public.seances s on s.id = r.seance_id
   where s.modele_id = v_id;
  if v_rep > 0 then
    raise notice 'autoeval-ia-entreprise : % réponse(s), rien n''est réécrit.', v_rep;
    return;
  end if;

  update public.modeles
     set intro = 'Seize questions : 1 à 8 avec la séance 25 (agent, orchestration, souveraineté), '
              || '9 à 16 avec la séance 26 (RAG, workflow, décision). Choisissez, dites si vous étiez '
              || 'sûr, puis lisez la correction. Rien n''est noté : recommencez autant que vous voulez.'
   where id = v_id;

  update public.modele_questions
     set theme = replace(replace(theme, 'Mer · ', 'S25 · '), 'Jeu · ', 'S26 · ')
   where modele_id = v_id and (theme like 'Mer · %' or theme like 'Jeu · %');

  update public.corriges c
     set theme = replace(replace(c.theme, 'Mer · ', 'S25 · '), 'Jeu · ', 'S26 · ')
    from public.seances s
   where s.id = c.seance_id and s.modele_id = v_id
     and (c.theme like 'Mer · %' or c.theme like 'Jeu · %');
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.modele_questions mq join public.modeles mo on mo.id = mq.modele_id
   where mo.cle = 'autoeval-ia-entreprise' and (mq.theme like 'Mer · %' or mq.theme like 'Jeu · %');
  if n > 0 and not exists (select 1 from public.reponses r join public.seances s on s.id = r.seance_id
                            join public.modeles mo on mo.id = s.modele_id
                           where mo.cle = 'autoeval-ia-entreprise') then
    raise exception 'autoeval-ia-entreprise : % thème(s) encore en jours', n;
  end if;
end $$;
