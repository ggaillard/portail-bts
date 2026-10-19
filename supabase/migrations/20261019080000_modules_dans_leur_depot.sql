-- ═══════════════════════════════════════════════════════════════════════════
--  CHAQUE MODULE DANS SON DÉPÔT — les consignes quittent portail-bts (19/10/2026)
--
--  La règle du 28/09 dit : un module, un dépôt. Deux modules du BTS2 la
--  tenaient à moitié : leur kit vivait bien dans leur dépôt modèle, mais leurs
--  consignes étaient publiées par portail-bts (`distance/*.html`), avec une
--  SECONDE copie du kit et deux archives zip — trois exemplaires de la même
--  chose, qui ne pouvaient que diverger.
--
--  Désormais :
--    · Projet IA à domicile → https://ggaillard.github.io/BTS2-Projet-IA/
--    · IA en entreprise     → https://ggaillard.github.io/BTS2-IA-Entreprise/
--  publiés par GitHub Pages depuis le dossier docs/ de chaque dépôt ; le zip
--  est celui que GitHub fabrique (archive/refs/heads/main.zip). Les anciennes
--  adresses de portail-bts redirigent : les liens déjà envoyés marchent.
--
--  Cette migration ne change que `modules.site`, et seulement s'il pointe
--  encore sur l'ancienne adresse : un réglage fait depuis le portail entre
--  deux ne sera pas écrasé.
--
--  ⚠️ À fusionner APRÈS avoir activé GitHub Pages sur les deux dépôts
--  (Settings → Pages → Deploy from a branch → main → /docs) et vérifié que
--  les deux adresses répondent : sinon « Vos projets » mène à une 404.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

update public.modules
   set site = 'https://ggaillard.github.io/BTS2-Projet-IA/'
 where code = 'projet-ia'
   and site = 'https://ggaillard.github.io/portail-bts/distance/projet-ia.html';

update public.modules
   set site = 'https://ggaillard.github.io/BTS2-IA-Entreprise/'
 where code = 'ia-entreprise'
   and site = 'https://ggaillard.github.io/portail-bts/distance/ia-entreprise.html';

-- Aucun module ne doit plus être publié par portail-bts : le site d'un module
-- est celui de son dépôt. Écrit comme un contrôle, pour que le prochain
-- module qui s'installerait dans distance/ rende la chaîne rouge.
do $$
declare n int;
begin
  select count(*) into n from public.modules
   where site like 'https://ggaillard.github.io/portail-bts/%';
  if n > 0 then
    raise exception '% module(s) encore publiés par portail-bts — le site d''un module est celui de son dépôt', n;
  end if;
end $$;
