-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 6 DU BTS1 — les points de passage, un par acte
--
--  Produit par outils/seances/seance06/generer.py. Un ATELIER : chaque point
--  porte sur le dépôt de l'étudiant, on n'y répond qu'en ayant fait l'étape.
--  Fin d'acte = 3 min d'accueil + les durées de la trace (dernier acte à la
--  46e minute). Après un premier passage, seule l'explication change, jamais
--  la bonne lettre — la règle du 16/09.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
    (1, 'Votre dépôt', 9, 'Dans tests/test_avancement.py de VOTRE dépôt, combien y a-t-il de fonctions de test ?', array['2', '3', '4', '5'], 'C', 'Quatre règles : projet vide, tout fait, annulées mises de côté, projet entièrement annulé.'),
    (2, 'Le fichier du pipeline', 21, 'Dans l''onglet Actions de votre dépôt, quelle étape de votre premier pipeline est rouge ?', array['Récupérer le code', 'Installer Python', 'Installer les dépendances', 'Lancer les tests'], 'D', 'Les tests : le code ne respecte pas la règle des tâches annulées. L''étape du rapport n''a pas été lancée.'),
    (3, 'Lire la croix rouge', 30, 'Dans le journal de l''étape rouge, que dit la ligne AssertionError ?', array['assert 75 == 60', 'assert 60 == 75', 'assert 47 == 60', 'assert 0 == 75'], 'B', 'Le code a obtenu 60 (3 sur 5), le test attendait 75 (3 sur 4) : l''annulée a été comptée.'),
    (4, 'Corriger par une pull request', 43, 'Après la fusion, que dit la dernière étape du pipeline de main ?', array['Avancement de la refonte du site : 60 %', 'Avancement de la refonte du site : 47 %', 'Avancement de la refonte du site : 75 %', 'Avancement de la refonte du site : 72 %'], 'A', '60 % : 18 tâches faites sur les 30 qui comptent. La direction lisait 47 % parce que les 8 annulées étaient comptées.'),
    (5, 'Rendre', 46, null::text, null::text[], null::text, null::text)
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 6
on conflict (seance_id, acte) do update
   set titre       = excluded.titre,
       fin_min     = excluded.fin_min,
       intitule    = excluded.intitule,
       options     = excluded.options,
       explication = excluded.explication,
       bonne       = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.bonne else excluded.bonne end;

do $$
declare n int;
begin
  select count(*) into n from public.points_passage pp
    join public.seances s on s.id = pp.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if n < 5 then raise exception 'séance 6 : % point(s) de passage, 5 attendus', n; end if;
end $$;
