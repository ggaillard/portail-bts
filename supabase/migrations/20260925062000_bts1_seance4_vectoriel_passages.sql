-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 4 DU BTS1 — l'arrivée des bases vectorielles (25/09/2026)
--
--  Produit par outils/seances/seance04/vectoriel.py. Cinq points de passage, un par acte ; l'acte IV
--  est la base vectorielle. Fin d'acte = 3 min d'accueil + les durées de la
--  trace ; le dernier acte finit à la 45e minute, le quiz garde le reste.
--
--  La séance 4 n'a pas encore été jouée : ses migrations d'origine (060000,
--  061000, 071000) sont appliquées, mais personne n'y a répondu. On les met à
--  jour ici — une migration appliquée ne se réécrit pas — et CHAQUE écriture
--  refuse de toucher à ce que des étudiants auraient déjà répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
    (1, 'Trois façons de mener un projet', 12, 'Le client voit un morceau qui fonctionne toutes les deux semaines. De quel cycle s''agit-il ?', array['la cascade', 'le cycle en V', 'l''agile', 'aucun des trois'], 'C', 'De petites itérations montrées au client : c''est l''agile. On se trompe tôt, donc moins cher.'),
    (2, 'Le mur entre deux équipes', 20, 'La correction de Thomas n''existait que sur son poste. Quel geste DevOps a manqué ?', array['mesurer', 'collaborer', 'automatiser', 'documenter'], 'B', 'Collaborer, c''est d''abord une source unique du code, partagée par tous.'),
    (3, 'Git, la mémoire du code', 34, 'Quelle commande envoie un commit du poste vers le dépôt partagé ?', array['git commit', 'git merge', 'git revert', 'git push'], 'D', 'Sans push, le commit reste sur la machine où il est né. C''est le geste qui a manqué à Thomas.'),
    (4, 'La base qui cherche par le sens', 43, 'Léa demande « le nouveau site » ; l''assistant trouve « Refonte du site ». Sur quoi s''appuie-t-il ?', array['sur les mots communs aux deux textes', 'sur la proximité de leurs vecteurs', 'sur l''identifiant du projet 42', 'sur la date du document'], 'B', 'Les deux textes n''ont presque aucun mot en commun, mais le même sens : leurs vecteurs sont proches.'),
    (5, 'Ouvrez le capot', 45, null::text, null::text[], null::text, null::text)
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 4
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  if n not in (0, 5) then raise exception 'séance 4 : % point(s) de passage, attendu 5', n; end if;
end $$;
