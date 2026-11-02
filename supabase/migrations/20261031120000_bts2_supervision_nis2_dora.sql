-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — MODULE « SP CENTRE DE SUPERVISION NIS 2 · DORA » : HUIT SÉANCES DE 2 H
--
--  Situation professionnelle Laravel : le centre de supervision d'un
--  infogéreur-hébergeur (Sevranne Datacenter, fictif), entité importante au sens
--  de NIS 2 et prestataire TIC de trois entités financières soumises à DORA, sur
--  le poste à quatre moniteurs. Les étudiants REPRENNENT la version laissée par un
--  développeur et la font évoluer, une demande par séance.
--  Dépôt modèle ggaillard/supervision-nis2-dora (« Use this template ») ;
--  dépôt enseignant ggaillard/supervision-nis2-dora-prof (corrigé, branches
--  fin-seance-01 à 08, évaluations).
--
--  ⚠️ Numéros 61-68 choisis libres d'après les migrations connues au 31/10
--  (0-4, 11-16, 21-26, 31-38, 41-48, 51-58). À VÉRIFIER en production avant de
--  pousser ; si l'un est pris, changer PREMIERE dans outils/portail.py et régénérer.
--
--  Même écriture que 20261028140000_bts2_supervision_crc.sql : missions tpNN-mK
--  cochées par les étudiants, contrôle d'entrée de cinq notions + certitude par
--  séance (les « À retenir » de la séance précédente ; la 61 porte sur les
--  prérequis). Tout est créé FERMÉ, CACHÉ, contrôles ÉTEINTS, sans échéance.
--  Rejouable : rien n'est réécrit dès qu'une réponse existe.
--  Fichier généré par outils/portail.py : ne pas le modifier à la main.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Le module ──────────────────────────────────────────────────────────
insert into public.modules (classe_id, code, titre, description, icone, depot, depot_enseignant, site, ordre)
select c.id, 'supervision-nis2-dora', 'SP Laravel — Centre de supervision (NIS 2, DORA)',
       'Reprendre et faire évoluer l''outil du centre de supervision d''un hébergeur sur le poste à quatre moniteurs : ordre de rétablissement et GTR, dépendances et reprise des données, journal d''incident, incident important et notifications NIS 2 à l''ANSSI, synchronisation des écrans, rôles, aide à la classification DORA des clients financiers, registre et concentration, écrits de l''incident, audit, exercice et retour d''expérience. Huit séances de 2 h.',
       '📡', 'https://github.com/ggaillard/supervision-nis2-dora',
       'https://github.com/ggaillard/supervision-nis2-dora-prof',
       null, 10
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.modules m
                    where m.classe_id = c.id
                      and (m.code = 'supervision-nis2-dora' or m.depot ilike '%/supervision-nis2-dora'));

-- ─── 1. Les huit séances ───────────────────────────────────────────────────
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min, nature, jalons)
select c.id, v.numero, v.titre, false, false, 120, 'projet', v.jalons
  from public.classes c
 cross join (values
   (61, 'SP Centre de supervision (1/8) : moniteur 1, les services et leur GTR', 6),
   (62, 'SP Centre de supervision (2/8) : dépendances et historique', 6),
   (63, 'SP Centre de supervision (3/8) : moniteur 2, le journal d''incident', 6),
   (64, 'SP Centre de supervision (4/8) : incident important (NIS 2) et notifications', 6),
   (65, 'SP Centre de supervision (5/8) : les quatre moniteurs synchronisés', 6),
   (66, 'SP Centre de supervision (6/8) : sécurité et rôles', 6),
   (67, 'SP Centre de supervision (7/8) : moniteur 4, tiers et clients financiers (DORA)', 7),
   (68, 'SP Centre de supervision (8/8) : l''exercice : audit, tests, RETEX', 7)
 ) as v(numero, titre, jalons)
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = v.numero);

update public.seances s
   set module_id = m.id
  from public.classes c, public.modules m
 where c.id = s.classe_id and m.classe_id = c.id
   and c.code = 'BTS2-SLAM-2026' and m.code = 'supervision-nis2-dora'
   and s.numero between 61 and 68 and s.module_id is null;

-- ─── 2. Les missions ───────────────────────────────────────────────────────
insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
select s.id, 'tp' || s.numero || '-m' || m.ordre, m.ordre, m.libelle, m.niveau, m.verbe
  from public.seances s
  join public.classes c on c.id = s.classe_id
  join (values
    (61, 1, 'Trajet d''un événement suivi : six réponses écrites au carnet', 'guide', 'Concevoir'),
    (61, 2, 'RG2 : les services dans l''ordre de rétablissement (tests m2)', 'guide', 'Piloter'),
    (61, 3, 'RG1 : durée d''indisponibilité, consommation de la GTR, jauge et niveau (tests m3)', 'semi', 'Mesurer'),
    (61, 4, 'Une tuile par état, même vide (tests m4)', 'semi', 'Concevoir'),
    (61, 5, 'Filtrer par client (bonus)', 'autonome', 'Concevoir'),
    (61, 6, 'seance-01 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (62, 1, 'Association porteuse service_composant (mode) et relations (tests m1)', 'guide', 'Concevoir'),
    (62, 2, 'Migration de reprise : ajouter, transférer, supprimer — aucune dépendance perdue (tests m2)', 'guide', 'Piloter'),
    (62, 3, 'Fiche d''un service : composants, mode, prestataire, état (tests m3)', 'semi', 'Concevoir'),
    (62, 4, 'Historique des états d''un service (tests m4)', 'semi', 'Sécuriser'),
    (62, 5, 'Impact d''un composant qui tombe (bonus)', 'autonome', 'Piloter'),
    (62, 6, 'seance-02 et socle au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (63, 1, 'Moniteur 2 : le journal d''incident, le plus récent en haut (tests m1)', 'guide', 'Concevoir'),
    (63, 2, 'Écrire au journal : Form Request, CSRF, heure de l''exercice (tests m2)', 'guide', 'Concevoir'),
    (63, 3, 'RG4 : entrées immuables, corrections par ajout (tests m3)', 'semi', 'Sécuriser'),
    (63, 4, 'Filtre et compteurs par catégorie (tests m4)', 'semi', 'Concevoir'),
    (63, 5, 'Recherche d''un mot (bonus)', 'autonome', 'Concevoir'),
    (63, 6, 'seance-03 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (64, 1, 'RG5 : critères NIS 2 ; RG6 : échéance, prérequis, statut d''une notification (tests m1)', 'guide', 'Piloter'),
    (64, 2, 'Moniteur 3 et bouton « Envoyée », écrit au journal (tests m2)', 'guide', 'Concevoir'),
    (64, 3, 'Refus 409 avec message, 404 (tests m3)', 'semi', 'Sécuriser'),
    (64, 4, 'Tout ou rien : transaction et verrou (tests m4)', 'semi', 'Sécuriser'),
    (64, 5, 'Les notifications en JSON (bonus)', 'autonome', 'Concevoir'),
    (64, 6, 'seance-04 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (65, 1, 'API d''état avec ETag et 304 (tests m1)', 'guide', 'Concevoir'),
    (65, 2, 'Moniteurs rafraîchis par zones, sans rechargement (tests m2)', 'guide', 'Concevoir'),
    (65, 3, 'API du poste lue dans config/poste.json (tests m3)', 'semi', 'Piloter'),
    (65, 4, 'RG7 : sélection partagée entre fenêtres, notifications filtrées (tests m4)', 'semi', 'Concevoir'),
    (65, 5, 'Lanceur du poste sur 4 écrans (bonus)', 'autonome', 'Piloter'),
    (65, 6, 'seance-05 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (66, 1, 'Comptes, mot de passe haché, connexion, message neutre (tests m1)', 'guide', 'Sécuriser'),
    (66, 2, 'Toute l''application protégée, 401 pour l''API, déconnexion (tests m2)', 'guide', 'Sécuriser'),
    (66, 3, 'RG8 : rôles et portefeuilles (Gates), 403 (tests m3)', 'semi', 'Sécuriser'),
    (66, 4, 'Signature par la personne connectée (tests m4)', 'semi', 'Sécuriser'),
    (66, 5, 'Freiner la force brute (bonus)', 'autonome', 'Sécuriser'),
    (66, 6, 'Toutes les séances au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (67, 1, 'Moniteur 4 : composants, état, prestataire (tests m1)', 'guide', 'Concevoir'),
    (67, 2, 'RG9 : historique et aide à la classification DORA (tests m2)', 'semi', 'Mesurer'),
    (67, 3, 'RG10 : registre des contrats et concentration (tests m3)', 'semi', 'Piloter'),
    (67, 4, 'Indicateurs de l''exercice (tests m4)', 'guide', 'Mesurer'),
    (67, 5, 'Fil des alertes (bonus)', 'autonome', 'Mesurer'),
    (67, 6, 'Supports : alerte précoce à l''ANSSI et information de PilatPay (carnet)', 'semi', 'Piloter'),
    (67, 7, 'seance-07 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (68, 1, 'Faille du webhook trouvée, prouvée, corrigée par signature HMAC (tests m1)', 'semi', 'Sécuriser'),
    (68, 2, 'Deux tests personnels qui échouent quand on casse le code (tests m2)', 'guide', 'Mesurer'),
    (68, 3, 'Style Pint au vert dans Actions', 'guide', 'Mesurer'),
    (68, 4, 'Sonde de santé, pages d''erreur, recette, retour d''expérience (tests m4)', 'semi', 'Piloter'),
    (68, 5, 'Fiche de réalisation E5 complétée', 'guide', 'Piloter'),
    (68, 6, 'Supports : projet de rapport final à l''ANSSI et rapport d''exercice (carnet)', 'semi', 'Piloter'),
    (68, 7, 'Toutes les séances au vert dans Actions, journal-bilan écrit', 'guide', 'Mesurer')
 ) as m(numero, ordre, libelle, niveau, verbe) on m.numero = s.numero
 where c.code = 'BTS2-SLAM-2026'
on conflict (seance_id, cle) do nothing;

-- ─── 3. Les contrôles d'entrée ─────────────────────────────────────────────
--  Même écriture que 20260915060000_bts2_controle_tp1.sql : creer_controle()
--  exige est_enseignant(), ce qu'une migration n'est pas.
create or replace function pg_temp.poser_controle(p_numero int, p_q jsonb)
returns void language plpgsql as $$
declare
  v_seance bigint;
  v_deja   int;
  v_n      int;
  v_max    int;
  v_total  int := jsonb_array_length(p_q);
begin
  select s.id into v_seance
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026' and s.numero = p_numero;
  if v_seance is null then
    raise notice 'Séance % absente : contrôle non posé.', p_numero;
    return;
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';
  if v_deja > 0 then
    raise notice 'Séance % : % réponse(s) au contrôle, rien n''est réécrit.', p_numero, v_deja;
    return;
  end if;

  delete from public.corriges where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, 'pre-' || lpad(x.i::text, 2, '0'), x.e->>'b', x.e->>'q',
         array(select jsonb_array_elements_text(x.e->'o')), x.e->>'x'
    from jsonb_array_elements(p_q) with ordinality as x(e, i);

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris', 'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, v_total) as i;

  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%' and question not like '%-c'
     and array_length(options, 1) = 4 and bonne_reponse in ('A','B','C','D');
  if v_n <> v_total then
    raise exception 'Séance % : % notions bien formées sur %', p_numero, v_n, v_total;
  end if;

  select max(k) into v_max from (
    select count(*) as k from public.corriges
     where seance_id = v_seance and question like 'pre-%' and question not like '%-c'
     group by bonne_reponse) t;
  if v_max > 2 then
    raise exception 'Séance % : une même lettre est bonne % fois — motif repérable', p_numero, v_max;
  end if;
end $$;

select pg_temp.poser_controle(61, '[{"q": "Dans routes/web.php, que fait Route::get(''/contact'', [PageController::class, ''contact'']) ?", "o": ["Elle crée la vue contact.blade.php", "Elle relie l''adresse /contact, en GET, à la méthode contact du contrôleur", "Elle enregistre un contact en base", "Elle redirige vers /contact"], "b": "B", "x": "Une route associe une URL et un verbe HTTP à une action de contrôleur."}, {"q": "Que renvoie Service::where(''criticite'', 1)->get() ?", "o": ["Une collection des services de criticité 1", "Le nombre de services de criticité 1", "Le premier service", "true ou false"], "b": "A", "x": "where ajoute une condition, get exécute la requête et renvoie une collection de modèles."}, {"q": "Une table notifications a une colonne contrat_id. Pour afficher chaque notification avec le nom du client :", "o": ["un GROUP BY sur contrat_id", "deux SELECT sans lien", "une jointure entre notifications et contrats", "un DELETE des notifications sans contrat"], "b": "C", "x": "La clé étrangère contrat_id relie chaque notification à une ligne de contrats : JOIN … ON."}, {"q": "Quelle méthode HTTP pour un formulaire qui enregistre une donnée ?", "o": ["GET", "HEAD", "OPTIONS", "POST"], "b": "D", "x": "GET lit sans rien modifier ; une action qui change l''état passe par POST."}, {"q": "Que fait git push ?", "o": ["Il enregistre un instantané en local", "Il récupère les commits de GitHub", "Il publie vos commits locaux sur GitHub", "Il crée une branche"], "b": "C", "x": "commit enregistre en local ; push publie sur le dépôt distant."}]'::jsonb);
select pg_temp.poser_controle(62, '[{"q": "Qu''est-ce que la GTR d''un service ?", "o": ["La durée maximale d''interruption promise au client par le contrat", "La durée moyenne des pannes de l''année", "Le nombre maximal d''incidents par mois", "Le temps de réponse d''une page"], "b": "A", "x": "Garantie de temps de rétablissement : au-delà, le contrat n''est pas tenu (pénalités)."}, {"q": "La passerelle de PilatPay (GTR 30 min) est coupée depuis 09:18. À 09:41, son niveau est :", "o": ["ok", "à risque", "hors GTR", "dégradé"], "b": "B", "x": "23 min sur 30 = 77 % : le seuil « à risque » (75 %) est atteint ; hors GTR au-delà de 100 %."}, {"q": "Pourquoi Indisponibilite::niveau() reçoit-elle l''heure en paramètre plutôt que d''appeler now() ?", "o": ["Parce que now() n''existe pas en PHP", "Pour aller plus vite", "Pour la tester à n''importe quelle heure et suivre l''heure de l''exercice", "Parce que Laravel l''interdit"], "b": "C", "x": "Une règle qui reçoit l''heure se teste seule et suit l''horloge de l''exercice."}, {"q": "Dans sortBy([fn1, fn2]), quand fn2 est-elle utilisée ?", "o": ["Toujours, avant fn1", "Jamais", "Seulement si fn1 échoue", "Seulement pour départager deux éléments égaux selon fn1"], "b": "D", "x": "La seconde comparaison ne départage qu''en cas d''égalité sur la première."}, {"q": "Une requête arrive sur /moniteur/1. Que se passe-t-il ?", "o": ["La route désigne une méthode du contrôleur, qui prépare les données et les passe à la vue Blade", "La vue Blade lit directement la base, puis appelle la route", "Le contrôleur choisit la route, puis la vue", "Le navigateur exécute le contrôleur"], "b": "A", "x": "Route → contrôleur → vue : la route trouve l''action, le contrôleur prépare, la vue affiche."}]'::jsonb);
select pg_temp.poser_controle(63, '[{"q": "L''association DÉPENDRE entre SERVICE et COMPOSANT porte un mode (bloquant, redondant). Au niveau physique :", "o": ["une colonne texte dans services", "une table service_composant dont la clé est le couple des deux identifiants", "une colonne service_id dans composants", "un fichier JSON"], "b": "B", "x": "Association porteuse : deux clés étrangères qui forment la clé primaire, plus la donnée portée."}, {"q": "Dans quel ordre une migration de reprise travaille-t-elle sur une base en service ?", "o": ["Supprimer, ajouter, transférer", "Transférer, supprimer, ajouter", "Ajouter, transférer, supprimer", "Ajouter, supprimer, transférer"], "b": "C", "x": "On ne supprime l''ancienne colonne qu''une fois les données à l''abri."}, {"q": "Où lit-on le mode d''une dépendance avec Eloquent ?", "o": ["$composant->mode", "$service->mode", "Composant::mode()", "$composant->pivot->mode"], "b": "D", "x": "withPivot(''mode'') rend la colonne de la table d''association accessible par ->pivot."}, {"q": "La reprise ne connaît pas le mode d''une dépendance écrite en texte. On met par défaut :", "o": ["« bloquant », la valeur prudente, à faire corriger", "« redondant », la plus rassurante", "rien : on ne reprend pas la dépendance", "une valeur au hasard"], "b": "A", "x": "On surestime l''impact plutôt que de le sous-estimer, puis on fait corriger."}, {"q": "Sur une base en service, migrate:fresh :", "o": ["applique seulement les nouvelles migrations", "efface toutes les tables et rejoue tout depuis zéro", "annule la dernière migration", "vérifie les migrations"], "b": "B", "x": "C''est l''outil d''une base de développement, jamais d''une base en service."}]'::jsonb);
select pg_temp.poser_controle(64, '[{"q": "Un journal d''incident électronique peut servir de preuve (code civil, art. 1366) à condition :", "o": ["qu''il soit imprimé chaque soir", "que son auteur soit identifié et qu''il soit conservé dans des conditions qui garantissent son intégrité", "qu''il soit stocké dans MySQL", "que l''heure soit saisie par chacun"], "b": "B", "x": "Identification de l''auteur (signature, séance 6) et intégrité (entrées immuables, RG4), avec l''heure mise par le serveur."}, {"q": "Que renvoie $request->validated() dans un contrôleur qui reçoit une Form Request ?", "o": ["Toute la requête", "true ou false", "Uniquement les champs validés", "Les messages d''erreur"], "b": "C", "x": "Les champs en trop, que la requête aurait ajoutés, sont écartés."}, {"q": "Un formulaire sans @csrf envoyé en POST reçoit :", "o": ["419", "404", "500", "200"], "b": "A", "x": "Laravel refuse la requête : le jeton CSRF manque (Page Expired)."}, {"q": "Comment corrige-t-on une entrée erronée du journal d''incident ?", "o": ["On la modifie", "On la supprime et on la réécrit", "On demande à l''administrateur de la base", "On ajoute une entrée qui cite celle qu''elle corrige"], "b": "D", "x": "Correction par ajout : l''erreur et sa correction restent visibles."}, {"q": "Pourquoi le modèle Journal refuse-t-il aussi les modifications (booted) ?", "o": ["Parce que les routes ne suffisent pas : un autre code pourrait modifier une entrée", "Pour accélérer les requêtes", "Parce qu''Eloquent l''exige", "Pour valider la saisie"], "b": "A", "x": "Défense en profondeur : la règle tient même si une route est ajoutée par erreur."}]'::jsonb);
select pg_temp.poser_controle(65, '[{"q": "La passerelle de PilatPay (infogérance) est totalement coupée depuis 09:18. À 09:48 pile, le critère « indisponibilité totale » de NIS 2 est-il atteint ?", "o": ["Oui : 30 minutes sont atteintes", "Non : il faut plus de 30 minutes ; il l''est juste après", "Oui, dès 09:18", "Non : il faut 24 heures"], "b": "B", "x": "Plus de 30 minutes en infogérance (règlement d''exécution 2024/2690) ; en colocation, la coupure suffit."}, {"q": "Le RSSI qualifie l''incident d''important le mardi à 09:50. Échéance de la notification d''incident à l''ANSSI ?", "o": ["mercredi 09:50", "jeudi 09:18", "vendredi 09:50", "vendredi 09:18"], "b": "C", "x": "72 h après la prise de connaissance de l''incident important (la qualification), pas après la panne. Mercredi 09:50, c''est l''alerte précoce (24 h)."}, {"q": "On demande d''envoyer la notification ANSSI alors que l''alerte précoce n''est pas partie. Réponse HTTP :", "o": ["200", "400", "404", "409"], "b": "D", "x": "La demande est bien formée mais contredit l''état actuel : Conflict."}, {"q": "Que garantit DB::transaction() autour de « notification envoyée » et de l''entrée au journal ?", "o": ["Que les deux écritures réussissent ensemble ou soient annulées ensemble", "Que la requête va plus vite", "Que l''ANSSI reçoit le message", "Que l''entrée est horodatée"], "b": "A", "x": "Tout ou rien : sans elle, une notification peut être marquée envoyée sans trace au journal."}, {"q": "À quoi sert lockForUpdate() ?", "o": ["À supprimer la ligne", "À la relire en la verrouillant : une autre transaction qui la veut attend", "À la mettre en cache", "À chiffrer la ligne"], "b": "B", "x": "Deux clics simultanés : le second attend, puis voit la notification déjà envoyée (409)."}]'::jsonb);
select pg_temp.poser_controle(66, '[{"q": "Le navigateur envoie If-None-Match avec l''ETag actuel. Le serveur répond :", "o": ["200 avec tout le contenu", "404", "304 sans contenu", "500"], "b": "C", "x": "Rien n''a changé : 304 Not Modified, corps vide."}, {"q": "Pourquoi l''heure de l''exercice (en minutes) fait-elle partie de la version ?", "o": ["Pour que la version change à chaque requête", "Pour chiffrer la réponse", "Parce que MySQL l''exige", "Parce que les écrans affichent des durées et des échéances qui dépendent de l''heure"], "b": "D", "x": "Quand l''heure avance, la consommation de la GTR et les statuts changent : les écrans doivent se mettre à jour."}, {"q": "Pourquoi ne remplacer que les zones data-zone-vivante ?", "o": ["Pour ne pas effacer un formulaire en cours de saisie, et ne pas clignoter", "Parce que fetch ne lit qu''une zone", "Pour réduire la base", "Parce que Blade l''impose"], "b": "A", "x": "Rafraîchissement partiel : le reste de la page n''est pas touché."}, {"q": "Pourquoi un BroadcastChannel suffit-il à partager la sélection entre les quatre moniteurs ?", "o": ["Parce qu''il enregistre en base", "Parce que les quatre fenêtres sont dans le même navigateur, sur le même site", "Parce qu''il passe par le serveur", "Parce qu''il utilise un WebSocket"], "b": "B", "x": "Le canal relie directement les fenêtres d''un même navigateur et d''une même origine."}, {"q": "Que renvoie /api/poste ?", "o": ["La liste des utilisateurs", "Le journal d''incident", "La configuration du poste, avec l''adresse de chaque moniteur", "L''état des composants"], "b": "C", "x": "config/poste.json enrichi des URL : le lanceur ouvre chaque fenêtre au bon endroit."}]'::jsonb);
select pg_temp.poser_controle(67, '[{"q": "Que stocke la colonne password de users ?", "o": ["Le mot de passe en clair", "Le mot de passe chiffré, déchiffrable", "Le jeton CSRF", "Une empreinte (bcrypt, salée)"], "b": "D", "x": "On vérifie une saisie en recalculant l''empreinte, sans pouvoir retrouver le mot de passe."}, {"q": "Une adresse inconnue et un mauvais mot de passe donnent le même message parce que :", "o": ["c''est plus court à coder", "deux messages différents révéleraient quels comptes existent", "Laravel ne sait afficher qu''un message", "l''ANSSI l''impose"], "b": "B", "x": "Sinon, on peut énumérer les comptes."}, {"q": "/api/etat appelée sans être connecté répond :", "o": ["401", "302 vers /connexion", "403", "200"], "b": "A", "x": "Un programme ne remplit pas de formulaire : 401, pas une redirection."}, {"q": "Léa Fournel (relation client, portefeuille CFU, PPAY, MFA) envoie la notification de la Clinique Saint-Lys. Réponse :", "o": ["409", "401", "403", "404"], "b": "C", "x": "Elle est authentifiée, mais le client n''est pas dans son portefeuille : la Gate refuse, 403."}, {"q": "Pourquoi seul le compte de la direction peut-il envoyer le rapport final à l''ANSSI ?", "o": ["Parce que le RSSI a déjà qualifié l''incident", "Pour réduire le nombre de comptes", "Parce que l''ANSSI ne lit que les messages signés du RSSI", "Parce que NIS 2 (art. 20) rend la direction responsable des mesures de cybersécurité : ce qu''elle signe l''engage"], "b": "D", "x": "La direction approuve, supervise et peut en répondre ; RG8 traduit cette responsabilité."}]'::jsonb);
select pg_temp.poser_controle(68, '[{"q": "Au sens de DORA, qui classe un incident comme « majeur » et le notifie à l''ACPR ?", "o": ["Sevranne, l''hébergeur", "L''ANSSI", "L''entité financière, cliente de Sevranne", "Le prestataire Ardoise Stockage"], "b": "C", "x": "Le client financier classe (règlement délégué 2024/1772) et notifie : 4 h après la classification, 24 h au plus après la prise de connaissance. Sevranne lui donne les éléments."}, {"q": "À 10:00, PilatPay : sa passerelle (fonction critique) est coupée, tous ses commerçants touchés, en France et en Belgique. L''aide à la classification affiche :", "o": ["majeur probable : service critique touché et deux seuils (clients, géographie)", "non : aucune malveillance n''est suspectée", "non : il faut 24 heures d''incident", "majeur : Sevranne le notifie à l''ACPR"], "b": "A", "x": "Service critique touché et au moins deux autres seuils : majeur probable. C''est PilatPay qui décide."}, {"q": "Que contient le registre d''informations que tient une entité financière (DORA, art. 28.3) ?", "o": ["Les incidents de l''année", "Ses contrats avec des prestataires TIC : services, fonctions soutenues, sous-traitants, localisation", "Les mots de passe des prestataires", "Les factures de l''hébergeur"], "b": "B", "x": "Le registre permet de voir de qui dépend chaque fonction, et où sont les données."}, {"q": "Trois services critiques dépendent, de façon bloquante, d''Ardoise Stockage. C''est :", "o": ["une redondance", "un indicateur", "une GTR", "un risque de concentration : une seule défaillance du prestataire touche les trois"], "b": "D", "x": "DORA (art. 29) demande aux entités financières d''évaluer ce risque ; RG10 le rend visible."}, {"q": "Pourquoi l''indicateur « notifications en retard » appelle-t-il Notifications::statut() ?", "o": ["Parce que c''est plus rapide", "Pour qu''un seul code décide de ce qu''est « en retard » : le moniteur 3 et l''indicateur concordent", "Parce que les indicateurs n''ont pas accès à la base", "Pour éviter les tests"], "b": "B", "x": "Recopier la règle créerait deux versions qui divergeraient."}]'::jsonb);

-- ─── Vérification à la main, en lecture seule ──────────────────────────────
--  select s.numero, s.titre, count(distinct m.id) as missions,
--         count(distinct co.question) filter (where co.question not like '%-c') as notions
--    from public.seances s
--    join public.classes c on c.id = s.classe_id
--    left join public.missions m on m.seance_id = s.id
--    left join public.corriges co on co.seance_id = s.id and co.question like 'pre-%'
--   where c.code = 'BTS2-SLAM-2026' and s.numero between 61 and 68
--   group by s.numero, s.titre order by s.numero;
