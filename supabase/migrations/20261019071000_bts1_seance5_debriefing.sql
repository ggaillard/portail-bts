-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — « Mardi, 14 h 02 » (19/10/2026)
--
--  Produit par outils/seances/seance05/generer.py. Les cinq concepts, écrits par
--  migration_definir_concepts() (20260924061000) — réponse LUE : un
--  `perform` la jetterait, et la migration serait verte sans rien écrire.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'L''intégration continue — à chaque push, une machine propre reconstruit le projet depuis le dépôt seul et lance les tests. [1 10]',
      'Le pipeline — des étapes enchaînées ; une étape rouge arrête la suite, et rien n''arrive en production. [2 8]',
      'Les étages de tests — unitaire, intégration, bout en bout ; on essaie d''abord en préproduction. [3 4]',
      'Image et conteneur — l''image est le modèle figé et versionné, le conteneur son exécution ; le Dockerfile en est la recette. [5 6 7]',
      'Automatiser ce qui se répète — tests, images, index : ce qui doit être refait à chaque changement est écrit dans un fichier et fait par une machine. [9 10]'));
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'concepts de la séance 5 non écrits : %', v_r;
    end if;
  end if;
end $$;
