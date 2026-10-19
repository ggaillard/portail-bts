-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — « Mardi, 14 h 02 » (19/10/2026)
--
--  Produit par outils/seances/seance05/generer.py. Un point de passage par acte ; fin d'acte =
--  3 min d'accueil + les durées de la trace (dernier acte à la 46e minute).
--  Réécrire un point est libre tant que personne ne l'a passé ; après, seul
--  le texte de l'explication change — la règle du 16/09.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
    (1, 'La chaîne qui ne dort pas', 14, 'Dans un pipeline, où se placent les tests ?', array['après le déploiement en production', 'entre l''installation des dépendances et le déploiement', 'avant même de récupérer le code poussé', 'à la place de la préproduction'], 'B', 'On teste avant de déployer, jamais après : un test rouge doit arrêter la chaîne avant qu''elle n''atteigne quiconque.'),
    (2, 'Trois étages de tests', 23, 'Quel test aurait vu la page d''accueil en erreur 500 ?', array['le test unitaire de la fonction d''arrondi', 'un test qui lit seulement la base des projets', 'le test de bout en bout qui ouvre l''accueil', 'aucun test ne peut voir une erreur 500'], 'C', 'Seul le bout en bout voit ce que voit l''utilisateur : il ouvre l''accueil et lit la réponse du serveur.'),
    (3, 'La boîte qui voyage', 35, 'Dans le Dockerfile de DevSecure, quelle ligne fixe la version de Python ?', array['la ligne 4', 'la ligne 6', 'la ligne 5', 'la ligne 1'], 'D', 'FROM python:3.12-slim : la base de l''image fixe la version, la même sur tous les postes.'),
    (4, 'Lire un pipeline', 44, 'Thomas pousse sur sa branche correctif. Le pipeline de Maya se lance-t-il ?', array['oui, à chaque push, quelle que soit la branche', 'non : il ne se déclenche que sur la branche main', 'oui, mais sans lancer les tests', 'non : il faut toujours le lancer à la main'], 'B', 'Le bloc on ne déclenche que sur main. D''où l''usage d''ajouter pull_request, pour tester avant le merge.'),
    (5, 'Ouvrez le capot', 46, null::text, null::text[], null::text, null::text)
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 5
on conflict (seance_id, acte) do update
   set titre = excluded.titre, fin_min = excluded.fin_min,
       intitule    = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.intitule else excluded.intitule end,
       options     = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.options else excluded.options end,
       bonne       = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.bonne else excluded.bonne end,
       explication = excluded.explication;

do $$
declare n int;
begin
  select count(*) into n from public.points_passage pp
    join public.seances s on s.id = pp.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if n not in (0, 5) then raise exception 'séance 5 : % point(s) de passage, attendu 5', n; end if;
end $$;
