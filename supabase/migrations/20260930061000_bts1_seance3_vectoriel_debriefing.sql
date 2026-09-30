-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 3 DU BTS1 — les concepts, avec la base vectorielle (30/09)
--
--  Six concepts au lieu de cinq : la base vectorielle devient le cinquième,
--  mesuré sur la question 9 ; le lac et l'entrepôt ne sont plus mesurés que
--  sur les questions 7 et 8. Copie exacte de la section « Concepts à
--  connaître » de docs/seances/seance-03.md — le job `fiche` compare.
--
--  Écrits par migration_definir_concepts(), réponse LUE. Aucune réponse
--  d'élève n'est attachée à un concept : réécrire est libre.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Une base relationnelle — des tables, une clé par ligne, des jointures pour les relier. [1 2 3]',
      'Un schéma souple (NoSQL) — on accepte des formes variables et on répète plutôt que de joindre. [4 5 6]',
      'Choisir entre SQL et NoSQL — la question est « qu''est-ce qui doit être garanti ici ? ». [4 6]',
      'Lac et entrepôt — le lac garde tout brut ; l''entrepôt range à l''avance les réponses aux questions connues. [7 8]',
      'Une base vectorielle — un modèle change chaque texte en vecteur ; la base répond à « qu''est-ce qui ressemble à… ? », pas à « qu''est-ce qui est égal à… ? ». [9]',
      'Un chiffre sans date ni source n''est pas une information — 60, 47 et 72 étaient justes tous les trois, et le 47 de l''assistant venait de l''entrepôt. [10]'));
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'concepts de la séance 3 non écrits : %', v_r;
    end if;
  end if;
end $$;
