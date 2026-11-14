-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 6 DU BTS1 — les cinq concepts, projetés en fin d'heure
--
--  Produit par outils/seances/seance06/generer.py. Écrits par
--  migration_definir_concepts() (20260924061000), réponse LUE : un refus fait
--  échouer la migration au lieu de passer au vert sans rien écrire.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if v_id is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 6 en base';
  end if;
  v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Son dépôt depuis un modèle — même départ pour tous, un historique et un pipeline à soi. [1]',
      'Le fichier de workflow — on dit quand, runs-on sur quelle machine, steps quoi et dans quel ordre ; il est versionné avec le code. [2 3]',
      'Lire une croix rouge — l''étape, le test, puis l''écart entre l''obtenu et l''attendu. [4 5]',
      'Corriger le code, pas le test — le test dit la règle ; on ne le change que si la règle change. [6 9]',
      'La pull request vérifiée — le pipeline tourne sur la branche avant la fusion : on ne fusionne que du vert. [7 8 10]'));
  if not coalesce((v_r->>'ok')::boolean, false) then
    raise exception 'concepts de la séance 6 non écrits : %', v_r;
  end if;
end $$;
