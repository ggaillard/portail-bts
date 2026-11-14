-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 7 DU BTS1 — les points de passage, un par acte
--
--  Produit par outils/seances/seance06/generer.py. Un point par acte daté.
--  Fin d'acte = 3 min d'accueil + les durées de la trace (dernier acte à la
--  48e minute). Après un premier passage, seule l'explication change, jamais
--  la bonne lettre — la règle du 16/09.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
    (1, 'Vulnérabilité, menace, risque', 13, 'Dans la matrice de l''acte I, un risque de vraisemblance 2 et d''impact 3 vaut :', array['3', '6', '5', '9'], 'B', '2 × 3 = 6 : la case « élevé ». À traiter avant les risques moyens.'),
    (2, 'Quand la saisie devient du code', 25, 'Quel caractère de la saisie a « fermé » le texte prévu dans la requête de mercredi ?', array['le signe égal', 'le mot OR', 'l''apostrophe', 'le chiffre 1'], 'C', 'L''apostrophe referme le texte que le code avait ouvert : tout ce qui suit est lu comme du SQL.'),
    (3, 'Les familles du top 10', 37, 'Un étudiant change id=12 en id=13 dans l''adresse de son bulletin et lit celui d''un camarade. Quelle famille OWASP ?', array['l''injection', 'les défaillances cryptographiques', 'la chaîne d''approvisionnement logicielle', 'le contrôle d''accès'], 'D', 'Le serveur ne vérifie pas qui demande : contrôle d''accès défaillant, A01, en tête du Top 10.'),
    (4, 'Sécurisé dès la conception', 45, 'Quel test aurait viré au rouge mercredi, avant la mise en production ?', array['la recherche « '' OR ''1''=''1 » ne rend aucun projet', 'la recherche « refonte » rend trois projets', 'la page d''accueil s''affiche', 'le rapport 42 s''ouvre pour son propre client'], 'A', 'Le seul test qui joue l''attaque. Les trois autres étaient déjà verts, et le sont restés.'),
    (5, 'Ouvrez le capot', 48, null::text, null::text[], null::text, null::text)
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 7
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 7;
  if n < 5 then raise exception 'séance 7 : % point(s) de passage, 5 attendus', n; end if;
end $$;
