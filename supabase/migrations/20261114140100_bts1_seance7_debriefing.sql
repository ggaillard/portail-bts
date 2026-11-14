-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 7 DU BTS1 — les cinq concepts, projetés en fin d'heure
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 7;
  if v_id is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 7 en base';
  end if;
  v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Vulnérabilité, menace, risque — le défaut, ce qui peut l''exploiter, et ce qu''on y perd ; risque = vraisemblance × impact. [1 2 3]',
      'L''injection — une saisie collée dans une requête devient du code ; la parade est la requête paramétrée. [4 5]',
      'Le contrôle d''accès — IDOR et CSRF : c''est au serveur de vérifier, à chaque demande, que la personne a le droit. [6 7]',
      'Le Top 10 OWASP — dix familles de risques, une langue commune ; une bibliothèque vulnérable est une faille qu''on n''a pas écrite. [8]',
      'Sécurisé dès la conception — un test ne vérifie que ce qu''on a pensé à vérifier : on écrit aussi les tests de l''attaque. [9 10]'));
  if not coalesce((v_r->>'ok')::boolean, false) then
    raise exception 'concepts de la séance 7 non écrits : %', v_r;
  end if;
end $$;
