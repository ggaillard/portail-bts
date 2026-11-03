-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — les points de passage, un par acte
--
--  Produit par outils/seances/seance05/generer.py. L'heure attendue de fin
--  d'acte (`fin_min`, minutes depuis « Démarrer la séance ») n'est pas saisie :
--  elle se déduit des durées écrites dans les titres d'actes de la trace, plus
--  trois minutes d'accueil. `controler.py fiche` vérifie qu'il y a un point par
--  acte daté, et que les titres concordent.
--
--  Réécrire un point est libre tant que personne ne l'a passé ; après, seul
--  le texte change, jamais la bonne lettre — la règle du 16/09 : on ne
--  réécrit pas après coup ce que les étudiants ont répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
    (1, 'Douze lignes, une sautée', 9, 'Mardi, la page d''accueil est tombée. Quelle ligne de la check-list avait sauté ?', array['récupérer main', 'redémarrer le service', 'lancer les tests', 'prévenir l''équipe'], 'C', 'Les tests n''avaient pas été lancés : « on n''avait pas le temps ». Une machine, elle, a toujours le temps.'),
    (2, 'La chaîne qui s''arrête au premier rouge', 23, 'Dans quel ordre un pipeline enchaîne-t-il ses étapes ?', array['test, build, déploiement', 'build, test, déploiement', 'déploiement, test, build', 'build, déploiement, test'], 'B', 'On construit, on teste, et seulement si tout est vert, on déploie.'),
    (3, 'Le colis standardisé', 35, 'Le poste de Thomas a Python 3.12, le serveur Python 3.8. Qu''apporte le conteneur ?', array['la même version de Python partout', 'une mise à jour automatique du serveur', 'un code compatible avec toutes les versions', 'la suppression de Python sur le serveur'], 'A', 'La version est écrite dans l''image : elle voyage avec le code.'),
    (4, 'La chaîne écrite dans le dépôt', 43, 'Dans un workflow, quel mot dit QUAND la chaîne se lance ?', array['jobs', 'steps', 'needs', 'on'], 'D', 'on : l''événement déclencheur. jobs et steps disent quoi et comment, needs dans quel ordre.'),
    (5, 'Ouvrez le capot', 45, null, null, null, null)
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 5
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if n < 5 then raise exception 'séance 5 : % point(s) de passage, 5 attendus', n; end if;
end $$;
