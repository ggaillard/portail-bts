-- ═══════════════════════════════════════════════════════════════════════════
--  PRÉALABLES — ce que la chaîne de migrations suppose déjà présent
--
--  Le socle du portail a été posé à la main en août 2026, avant qu'il existe
--  une chaîne de migrations : tables classes / eleves / seances / corriges /
--  reponses / enseignants, et la fonction est_enseignant().
--
--  Cette migration NE CRÉE RIEN. Elle vérifie, et échoue avec un message
--  lisible si quelque chose manque. C'est délibéré : est_enseignant() décide
--  qui voit les données de la classe entière. La recréer à l'aveugle sur une
--  base de production, avec un corps deviné, serait le pire endroit où se
--  tromper. Si elle manque, c'est qu'on n'est pas sur la bonne base.
--
--  Sur une base neuve, poser d'abord le socle historique, puis lancer la
--  chaîne. L'historique du dépôt garde SQL_PORTAIL.md pour cela.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_manque text := '';
  v_table   text;
begin
  foreach v_table in array array['classes','eleves','seances','corriges','reponses']
  loop
    if to_regclass('public.' || v_table) is null then
      v_manque := v_manque || '  · table public.' || v_table || E'\n';
    end if;
  end loop;

  if to_regprocedure('public.est_enseignant()') is null then
    v_manque := v_manque || E'  · fonction public.est_enseignant()\n';
  end if;

  if v_manque <> '' then
    raise exception E'Préalables absents sur cette base :\n%\nCette chaîne de migrations suppose le socle posé en août 2026. Vérifiez que vous visez bien le projet Supabase du portail.', v_manque;
  end if;
end $$;
