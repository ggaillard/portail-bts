-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 4 DU BTS1 — les points de passage, un par acte
--
--  Produit par outils/seances/seance04/generer.py. L'heure attendue de fin
--  d'acte (`fin_min`, minutes depuis « Démarrer la séance ») n'est pas saisie :
--  elle se déduit des durées écrites dans les titres d'actes de la trace, plus
--  sept minutes d'accueil. `controler.py fiche` vérifie qu'il y a un point par
--  acte daté, et que les titres concordent.
--
--  Réécrire un point est libre tant que personne ne l'a passé ; après, seul
--  le texte change, jamais la bonne lettre — la règle du 16/09 : on ne
--  réécrit pas après coup ce que les étudiants ont répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
@@PASSAGES@@
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 4
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  -- « au moins 4 » et non « 4 » : depuis le 25/09, la séance 4 a cinq actes
  -- (20260925062000). Au rejeu de la chaîne, ce fichier passe AVANT celui-là
  -- et trouve cinq points : ce n'est pas une panne, c'est la suite.
  if n < 4 then raise exception 'séance 4 : % point(s) de passage, au moins 4 attendus', n; end if;
end $$;
