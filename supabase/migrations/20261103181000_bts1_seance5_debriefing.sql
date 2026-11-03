-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — les cinq concepts, projetés en fin d'heure
--
--  Produit par outils/seances/seance05/generer.py. Écrits par
--  migration_definir_concepts() (20260924061000), réponse LUE : un refus fait
--  échouer la migration au lieu de passer au vert sans rien écrire.
--
--  Rejouable sans risque : réécrire les concepts est libre, aucune réponse
--  d'élève n'y est attachée.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_id is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 5 en base';
  end if;
  v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Déployer à la main — chaque geste repose sur la mémoire de quelqu''un : on oublie, on ne refait jamais pareil ; ce qui se répète se confie à une machine. [1 10]',
      'Le pipeline CI/CD — build, tests, préproduction, production, enchaînés à chaque push ; au premier rouge, rien n''est livré. [2 3 5]',
      'Les tests automatisés — unitaire pour une fonction, intégration pour des morceaux qui se parlent, bout en bout pour le parcours d''un utilisateur. [4]',
      'Le conteneur — le Dockerfile est la recette, l''image le modèle figé, le conteneur l''image en marche : le code tourne pareil partout. [6 7 8]',
      'Le workflow — le pipeline écrit dans le dépôt : on dit quand, jobs et steps disent quoi et comment ; il se versionne comme le code. [9 10]'));
  if not coalesce((v_r->>'ok')::boolean, false) then
    raise exception 'concepts de la séance 5 non écrits : %', v_r;
  end if;
end $$;
