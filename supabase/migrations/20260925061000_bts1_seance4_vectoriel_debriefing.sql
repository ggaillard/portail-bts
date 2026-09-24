-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 4 DU BTS1 — l'arrivée des bases vectorielles (25/09/2026)
--
--  Produit par outils/seances/seance04/vectoriel.py. Les cinq concepts : le cinquième est la base
--  vectorielle. Écrits par migration_definir_concepts(), réponse LUE.
--
--  La séance 4 n'a pas encore été jouée : ses migrations d'origine (060000,
--  061000, 071000) sont appliquées, mais personne n'y a répondu. On les met à
--  jour ici — une migration appliquée ne se réécrit pas — et CHAQUE écriture
--  refuse de toucher à ce que des étudiants auraient déjà répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Les cycles de vie — la cascade découvre ses erreurs à la fin, le V met un test en face de chaque étape, l''agile livre souvent pour corriger tôt. [1 2]',
      'La culture DevOps — automatiser, mesurer, collaborer : abattre le mur entre ceux qui écrivent le code et ceux qui le font tourner. [3 10]',
      'Le commit — un instantané daté, signé et expliqué, qui reste sur le poste tant qu''on ne l''a pas poussé. [4 6 10]',
      'Branche, pull request, retour en arrière — on travaille à côté, on fait relire, on fusionne ; un nouveau commit défait le précédent sans effacer l''histoire. [5 7]',
      'Une base vectorielle — elle compare des sens, pas des mots ; son index est fabriqué par un modèle, daté, et se versionne avec lui. [8 9]'));
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'concepts de la séance 4 non écrits : %', v_r;
    end if;
  end if;
end $$;
