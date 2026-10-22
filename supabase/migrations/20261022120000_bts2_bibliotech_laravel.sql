-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — MODULE « SP LARAVEL — BIBLIOTECH » : HUIT SÉANCES DE 2 H
--
--  Situation professionnelle Laravel, reprise et refondue pour 2026-2027 :
--  une application de médiathèque (fictive) que les étudiants REPRENNENT et
--  font évoluer, une demande de la médiathèque par séance.
--  Dépôt modèle ggaillard/bibliotech-laravel (« Use this template ») ;
--  dépôt enseignant ggaillard/bibliotech-laravel-prof (corrigé, tags
--  fin-seance-01 à 08, évaluations).
--
--    31 · routes, contrôleurs, vues          35 · authentification et rôles
--    32 · base de données et Eloquent        36 · emprunts et règles de gestion
--    33 · gestion : lister et ajouter        37 · API REST
--    34 · gestion : modifier, supprimer      38 · qualité, sécurité, mise en ligne
--
--  ⚠️ Numéros 31-38 choisis libres d'après les migrations connues au 22/10
--  (0-4, 11-16, 21-26). Si le module de modélisation les a pris, décaler ici
--  avant de pousser : rien d'autre ne dépend de ces numéros.
--
--  Séances « projet » : on les suit en missions, cochées par les étudiants
--  (clés tpNN-mK, réponse 'true', comme PlaylistApp). Chaque mission « tests mK »
--  correspond à un groupe de tests du dépôt : la case ne se coche que si le
--  groupe est vert.
--
--  Contrôle d'entrée sur chacune des huit séances : cinq notions (pre-01 à
--  pre-05) + leurs cinq questions de certitude. Les notions de la séance N sont
--  les « Concepts à connaître » de la séance N-1 (la 31 porte sur les
--  prérequis). Le contrôle appartient à la séance qu'il précède.
--
--  Tout est créé FERMÉ, CACHÉ, contrôles ÉTEINTS, sans échéance : la date se
--  pose dans Préparer (planning), le contrôle se propose le jour même.
--  Rejouable : rien n'est réécrit dès qu'une réponse existe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Le module ──────────────────────────────────────────────────────────
insert into public.modules (classe_id, code, titre, description, icone, depot, depot_enseignant, site, ordre)
select c.id, 'bibliotech-laravel', 'SP Laravel — BiblioTech',
       'Reprendre et faire évoluer l''application Laravel d''une médiathèque : catalogue, gestion, comptes, emprunts, API, mise en ligne. Huit séances de 2 h.',
       '📚', 'https://github.com/ggaillard/bibliotech-laravel',
       'https://github.com/ggaillard/bibliotech-laravel-prof',
       null, 7
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.modules m
                    where m.classe_id = c.id
                      and (m.code = 'bibliotech-laravel' or m.depot ilike '%/bibliotech-laravel'));

-- ─── 1. Les huit séances ───────────────────────────────────────────────────
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min, nature, jalons)
select c.id, v.numero, v.titre, false, false, 120, 'projet', v.jalons
  from public.classes c
 cross join (values
   (31, 'SP Laravel (1/8) : routes, contrôleurs, vues', 6),
   (32, 'SP Laravel (2/8) : base de données et Eloquent', 5),
   (33, 'SP Laravel (3/8) : gestion, lister et ajouter', 4),
   (34, 'SP Laravel (4/8) : gestion, modifier et supprimer', 5),
   (35, 'SP Laravel (5/8) : authentification et rôles', 5),
   (36, 'SP Laravel (6/8) : emprunts et règles de gestion', 6),
   (37, 'SP Laravel (7/8) : API REST', 6),
   (38, 'SP Laravel (8/8) : qualité, sécurité, mise en ligne', 6)
 ) as v(numero, titre, jalons)
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = v.numero);

update public.seances s
   set module_id = m.id
  from public.classes c, public.modules m
 where c.id = s.classe_id and m.classe_id = c.id
   and c.code = 'BTS2-SLAM-2026' and m.code = 'bibliotech-laravel'
   and s.numero between 31 and 38 and s.module_id is null;

-- ─── 2. Les missions ───────────────────────────────────────────────────────
insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
select s.id, 'tp' || s.numero || '-m' || m.ordre, m.ordre, m.libelle, m.niveau, m.verbe
  from public.seances s
  join public.classes c on c.id = s.classe_id
  join (values
    (31, 1, 'Trajet d''une requête suivi : six réponses écrites au journal', 'guide', 'Concevoir'),
    (31, 2, 'Page Contact nommée, lien dans le menu (tests m2)', 'guide', 'Concevoir'),
    (31, 3, 'Liste des catégories avec leur nombre de livres (tests m3)', 'semi', 'Concevoir'),
    (31, 4, 'Livres d''une catégorie, 404 sur slug inconnu (tests m4)', 'semi', 'Concevoir'),
    (31, 5, 'Page 404 à l''image du site (bonus)', 'autonome', 'Concevoir'),
    (31, 6, 'seance-01 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (32, 1, 'Table et modèle Auteur, nom_complet, fabrique (tests m1)', 'guide', 'Concevoir'),
    (32, 2, 'Reprise des données : auteur_id, transfert, ancienne colonne supprimée (tests m2)', 'guide', 'Piloter'),
    (32, 3, 'Seeders sans doublon, recherche par auteur (tests m3)', 'semi', 'Concevoir'),
    (32, 4, 'Page d''un auteur (bonus)', 'autonome', 'Concevoir'),
    (32, 5, 'seance-02 et socle au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (33, 1, 'Contrôleur resource, liste paginée par 15 (tests m1)', 'guide', 'Concevoir'),
    (33, 2, 'Formulaire d''ajout validé, message flash (tests m2)', 'guide', 'Sécuriser'),
    (33, 3, 'Fiche par liaison de modèle, LivreRequest (tests m3)', 'semi', 'Concevoir'),
    (33, 4, 'seance-03 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (34, 1, 'Modifier un livre, ISBN unique sauf le sien (tests m1)', 'guide', 'Concevoir'),
    (34, 2, 'Supprimer un livre : DELETE, CSRF, confirmation (tests m2)', 'guide', 'Sécuriser'),
    (34, 3, 'CRUD des catégories et règle de suppression (tests m3)', 'semi', 'Concevoir'),
    (34, 4, 'Filtres conservés dans la pagination (bonus)', 'autonome', 'Concevoir'),
    (34, 5, 'seance-04 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (35, 1, 'Rôles, connexion, déconnexion (tests m1)', 'guide', 'Sécuriser'),
    (35, 2, 'Gestion protégée par auth et rôle, comptes de démo (tests m2)', 'guide', 'Sécuriser'),
    (35, 3, 'Inscription d''un adhérent, rôle non falsifiable (tests m3)', 'semi', 'Sécuriser'),
    (35, 4, 'Message neutre et limitation des tentatives (tests m4)', 'semi', 'Sécuriser'),
    (35, 5, 'seance-03 à 05 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (36, 1, 'Table emprunts, modèle, relations, scope enCours (tests m1)', 'guide', 'Concevoir'),
    (36, 2, 'Emprunter : service, transaction, livre indisponible (tests m2)', 'guide', 'Piloter'),
    (36, 3, 'Règles : livre emprunté, trois emprunts maximum (tests m3)', 'semi', 'Sécuriser'),
    (36, 4, 'Mes emprunts, retour par le personnel (tests m4)', 'semi', 'Concevoir'),
    (36, 5, 'Page des retards (bonus)', 'autonome', 'Piloter'),
    (36, 6, 'seance-06 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (37, 1, 'install:api, GET /api/livres avec LivreResource (tests m1)', 'guide', 'Concevoir'),
    (37, 2, 'GET /api/livres/{livre}, 404 en JSON (tests m2)', 'guide', 'Concevoir'),
    (37, 3, 'Filtres catégorie et disponibilité (tests m3)', 'semi', 'Concevoir'),
    (37, 4, 'POST protégé : 401, 403, 201, 422 (tests m4)', 'semi', 'Sécuriser'),
    (37, 5, 'Obtenir un jeton (bonus)', 'autonome', 'Sécuriser'),
    (37, 6, 'seance-07 au vert, commit poussé, journal écrit', 'guide', 'Mesurer'),
    (38, 1, 'Faille XSS trouvée, prouvée, corrigée (tests m1)', 'semi', 'Sécuriser'),
    (38, 2, 'Deux tests personnels qui échouent quand on casse le code (tests m2)', 'guide', 'Mesurer'),
    (38, 3, 'Style Pint au vert dans Actions', 'guide', 'Mesurer'),
    (38, 4, 'Application en ligne, configuration de production, recette', 'semi', 'Piloter'),
    (38, 5, 'Fiche de réalisation E5 complétée', 'guide', 'Piloter'),
    (38, 6, 'Toutes les séances au vert dans Actions, journal-bilan écrit', 'guide', 'Mesurer')
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

select pg_temp.poser_controle(31, '[{"q": "Un navigateur demande la page /livres. Qui produit le HTML renvoyé ?", "o": ["Le navigateur, à partir du fichier PHP qu''il télécharge", "Le serveur, qui exécute le code PHP puis répond", "La base de données, directement", "Le fichier HTML écrit à l''avance pour chaque livre"], "b": "B", "x": "Le PHP s''exécute sur le serveur ; le navigateur ne reçoit que le résultat."}, {"q": "Quelle méthode HTTP utilise-t-on pour envoyer un formulaire qui crée un enregistrement ?", "o": ["POST", "GET", "HEAD", "OPTIONS"], "b": "A", "x": "GET sert à lire ; une création passe par POST (les données vont dans le corps de la requête)."}, {"q": "En PHP, que désigne $this à l''intérieur d''une méthode ?", "o": ["La classe elle-même, partagée par tous les objets", "La dernière variable déclarée", "L''objet sur lequel la méthode a été appelée", "Le fichier PHP en cours d''exécution"], "b": "C", "x": "$this est l''exemplaire courant : $livre->titre dans la classe s''écrit $this->titre."}, {"q": "Une table livres a une colonne categorie_id. Pour afficher chaque titre avec le nom de sa catégorie, il faut :", "o": ["deux SELECT sans lien entre eux", "un GROUP BY sur categorie_id", "un DELETE des catégories inutiles", "une jointure entre livres et categories"], "b": "D", "x": "La clé étrangère categorie_id relie chaque livre à une ligne de categories : JOIN … ON."}, {"q": "Que fait git push ?", "o": ["Il enregistre vos fichiers modifiés dans un commit", "Il envoie vos commits locaux vers le dépôt distant (GitHub)", "Il récupère les commits de GitHub", "Il annule le dernier commit"], "b": "B", "x": "commit enregistre en local, push publie sur GitHub, pull récupère."}]'::jsonb);
select pg_temp.poser_controle(32, '[{"q": "Dans BiblioTech, qui interroge la base pour afficher le catalogue ?", "o": ["Le contrôleur, par le modèle Livre", "La vue Blade, avec une boucle @foreach", "La route, dans routes/web.php", "Le gabarit layouts/app"], "b": "A", "x": "MVC : le contrôleur interroge le modèle et transmet les données ; la vue ne fait que présenter."}, {"q": "Pourquoi écrire route(''contact'') plutôt que ''/contact'' dans une vue ?", "o": ["C''est plus rapide à l''exécution", "Cela protège le lien contre le CSRF", "Sinon la page renvoie une erreur 404", "Si l''URL change dans routes/web.php, tous les liens suivent"], "b": "D", "x": "Le nom de route est un identifiant stable ; l''URL peut évoluer sans casser les liens."}, {"q": "Avec la route /categories/{slug}, l''URL /categories/policier transmet au contrôleur :", "o": ["la catégorie Policier déjà chargée depuis la base", "l''id numérique de la catégorie", "la chaîne « policier » en argument de la méthode", "rien : il faut la lire dans $_GET"], "b": "C", "x": "Un paramètre de route arrive tel quel, en texte ; c''est au code de chercher la catégorie."}, {"q": "Categorie::where(''slug'', $slug)->firstOrFail() sur un slug inexistant :", "o": ["renvoie null et la vue plante plus loin", "renvoie une page 404", "crée la catégorie manquante", "renvoie la première catégorie de la table"], "b": "B", "x": "OrFail lève une exception que Laravel transforme en 404 : pas d''erreur 500, pas de page blanche."}, {"q": "À quoi sert @extends(''layouts.app'') en tête d''une vue ?", "o": ["À hériter de la mise en page commune et à n''écrire que sa section", "À importer une classe PHP dans la vue", "À protéger la vue par mot de passe", "À inclure une autre vue au milieu de la page"], "b": "A", "x": "Héritage Blade : un seul gabarit (menu, pied de page), chaque vue remplit @section(''content'')."}]'::jsonb);
select pg_temp.poser_controle(33, '[{"q": "Une migration a déjà été appliquée sur le serveur. Il faut ajouter une colonne :", "o": ["on modifie la migration existante et on relance migrate", "on ajoute la colonne à la main dans phpMyAdmin", "on écrit une nouvelle migration", "on supprime la base et on recommence"], "b": "C", "x": "Une migration déjà jouée ne sera pas rejouée ailleurs : on fait évoluer le schéma par une nouvelle."}, {"q": "Dans la relation « un auteur a écrit plusieurs livres », où se trouve la clé étrangère ?", "o": ["Dans auteurs : livre_id", "Dans livres : auteur_id", "Dans une table pivot auteur_livre", "Dans les deux tables"], "b": "B", "x": "La clé étrangère est toujours du côté « plusieurs » (1,1 au MCD)."}, {"q": "Le modèle Livre porte auteur_id. Sa relation vers Auteur s''écrit :", "o": ["hasMany(Auteur::class)", "hasOne(Auteur::class)", "belongsToMany(Auteur::class)", "belongsTo(Auteur::class)"], "b": "D", "x": "Le côté qui porte la clé étrangère « appartient à » ; l''autre côté « a plusieurs » (hasMany)."}, {"q": "Afficher 20 livres et leur auteur sans with(''auteur'') déclenche :", "o": ["21 requêtes SQL", "1 requête SQL", "2 requêtes SQL", "40 requêtes SQL"], "b": "A", "x": "1 pour les livres + 1 par livre pour son auteur : le problème N + 1. with() le ramène à 2."}, {"q": "Remplacer une colonne texte par une clé étrangère sur une base en service se fait en :", "o": ["supprimant la table puis la recréant", "renommant la colonne texte en auteur_id", "ajoutant la colonne, transférant les données, supprimant l''ancienne", "vidant la table et relançant les seeders"], "b": "C", "x": "On ne vide pas une base en service : ajouter, transférer, supprimer, dans une seule migration."}]'::jsonb);
select pg_temp.poser_controle(34, '[{"q": "Combien de routes Route::resource(''livres'', …) déclare-t-elle ?", "o": ["4", "5", "10", "7"], "b": "D", "x": "index, create, store, show, edit, update, destroy."}, {"q": "Pourquoi la validation dans le contrôleur est-elle indispensable, même si le champ porte required en HTML ?", "o": ["Une requête peut être envoyée sans passer par le formulaire du navigateur", "Le required HTML ne fonctionne pas avec Bootstrap", "Laravel refuse les formulaires sans validation", "Pour que old() fonctionne"], "b": "A", "x": "curl, un formulaire modifié ou une API contournent le navigateur : seule la validation serveur protège."}, {"q": "La validation échoue. Que fait old(''titre'') dans le formulaire réaffiché ?", "o": ["Il remet la valeur enregistrée en base", "Il remet ce que l''utilisateur avait saisi", "Il affiche le message d''erreur", "Il vide le champ"], "b": "B", "x": "La saisie est gardée en session le temps d''une requête : on corrige sans tout retaper."}, {"q": "show(Livre $livre) et l''URL /gestion/livres/999 où le livre 999 n''existe pas :", "o": ["$livre vaut null", "$livre est un livre vide", "Laravel renvoie 404 sans entrer dans la méthode", "Une erreur 500 s''affiche"], "b": "C", "x": "Liaison de modèle : Laravel cherche le livre de l''URL et répond 404 s''il ne le trouve pas."}, {"q": "->with(''success'', ''Livre ajouté.'') après une redirection :", "o": ["dépose le message en session pour la requête suivante seulement", "enregistre le message dans la table livres", "l''affiche dans la console", "le garde jusqu''à la déconnexion"], "b": "A", "x": "Un message flash vit une seule requête : affiché une fois, puis effacé."}]'::jsonb);
select pg_temp.poser_controle(35, '[{"q": "Un formulaire HTML ne connaît que GET et POST. Comment Laravel reçoit-il un PUT ?", "o": ["Le navigateur convertit POST en PUT tout seul", "Par un paramètre ?method=PUT dans l''URL", "Grâce au jeton @csrf", "Par un champ caché _method généré par @method(''PUT'')"], "b": "D", "x": "Le formulaire part en POST ; Laravel lit _method et traite la requête comme un PUT."}, {"q": "Un formulaire POST sans @csrf est envoyé. Laravel répond :", "o": ["404 Not Found", "419 Page Expired", "403 Forbidden", "200, la donnée est enregistrée"], "b": "B", "x": "Sans jeton CSRF valide, la requête est refusée : elle pourrait venir d''un site tiers."}, {"q": "En modification, old(''titre'', $livre->titre) affiche :", "o": ["la saisie précédente si la validation a échoué, sinon le titre actuel", "toujours le titre actuel", "toujours la saisie précédente", "le titre du livre précédent"], "b": "A", "x": "Deuxième argument : la valeur par défaut, utilisée quand il n''y a pas de saisie à remettre."}, {"q": "Pourquoi Rule::unique(''livres'', ''isbn'')->ignore($livre) en modification ?", "o": ["Pour autoriser deux livres avec le même ISBN", "Pour ignorer l''ISBN s''il est vide", "Pour que le livre ne soit pas en conflit avec son propre ISBN", "Pour accélérer la validation"], "b": "C", "x": "Sans ignore(), garder son ISBN inchangé déclenche « déjà pris »… par soi-même."}, {"q": "Une catégorie contient des livres. Où vérifier qu''on ne la supprime pas ?", "o": ["Nulle part : la clé étrangère suffit", "Dans le code, avant de supprimer, avec un message clair", "Dans la vue, en masquant le bouton", "Dans le seeder"], "b": "B", "x": "La base protège (erreur SQL) mais l''utilisatrice doit recevoir un message compréhensible."}]'::jsonb);
select pg_temp.poser_controle(36, '[{"q": "Un adhérent connecté ouvre /gestion/livres. Code attendu :", "o": ["401", "302 vers /connexion", "403", "404"], "b": "C", "x": "Il est authentifié (on sait qui il est) mais pas autorisé : 403."}, {"q": "Que contient la colonne password de la table users ?", "o": ["Le mot de passe chiffré, que l''on peut déchiffrer", "Le mot de passe en clair", "Le jeton de session", "L''empreinte bcrypt du mot de passe"], "b": "D", "x": "On ne stocke jamais un mot de passe : on stocke son haché, et on compare avec Hash::check."}, {"q": "Dans ->middleware([''auth'', ''role:bibliothecaire,admin'']), pourquoi auth en premier ?", "o": ["Le contrôle de rôle a besoin d''un utilisateur connecté", "L''ordre n''a aucune importance", "auth est plus rapide", "role ne fonctionne qu''en deuxième position par convention"], "b": "A", "x": "role lit $request->user() : il faut d''abord être sûr qu''il existe."}, {"q": "Pourquoi role n''est-il pas dans les champs remplissables du modèle User ?", "o": ["Parce qu''il a une valeur par défaut", "Un champ role=admin ajouté au formulaire d''inscription serait enregistré", "Parce qu''il est indexé", "Parce que Laravel l''interdit"], "b": "B", "x": "Affectation de masse : ne rendre remplissable que ce qu''un formulaire a le droit de fixer."}, {"q": "La règle exists:users sur l''e-mail du formulaire de connexion est une faiblesse car :", "o": ["elle ralentit la connexion", "elle empêche de se connecter", "elle désactive le CSRF", "elle révèle quels e-mails ont un compte"], "b": "D", "x": "Message différent pour un e-mail inconnu = énumération des comptes."}]'::jsonb);
select pg_temp.poser_controle(37, '[{"q": "EMPRUNTER relie ADHÉRENT et LIVRE et porte des dates. Au niveau physique, elle devient :", "o": ["une table emprunts avec deux clés étrangères", "une colonne emprunte_par dans livres", "une colonne livres_empruntes dans users", "un fichier de log"], "b": "A", "x": "Association porteuse de données, répétable pour un même couple : une table à part entière."}, {"q": "Où placer la règle « 3 emprunts en cours maximum » ?", "o": ["Dans la vue, en masquant le bouton", "Dans le contrôleur web seulement", "Dans une classe de service appelée par le site et l''API", "Dans le seeder"], "b": "C", "x": "Un seul endroit, appelé par tous les points d''entrée : la règle ne peut pas être contournée."}, {"q": "Dans DB::transaction, une exception est levée après la création de l''emprunt :", "o": ["l''emprunt reste, le livre reste disponible", "l''emprunt est annulé, rien n''est enregistré", "l''emprunt reste, le livre devient indisponible", "Laravel réessaie automatiquement"], "b": "B", "x": "Tout ou rien : un rollback annule les écritures déjà faites dans la transaction."}, {"q": "Le service lève EmpruntImpossible. Que fait le contrôleur ?", "o": ["Il laisse l''erreur s''afficher en page 500", "Il crée l''emprunt quand même", "Il déconnecte l''adhérent", "Il l''attrape et redirige avec un message error"], "b": "D", "x": "La règle refuse par une exception ; le contrôleur la traduit en message pour l''adhérent."}, {"q": "Que renvoie Emprunt::enCours() ?", "o": ["Les emprunts créés aujourd''hui", "Les emprunts en retard", "Les emprunts dont rendu_le est NULL", "Tous les emprunts triés par date"], "b": "C", "x": "Un scope nomme une condition métier : enCours() = whereNull(''rendu_le'')."}]'::jsonb);
select pg_temp.poser_controle(38, '[{"q": "Quel code HTTP pour une création réussie par POST /api/livres ?", "o": ["200", "201", "204", "302"], "b": "B", "x": "201 Created : la ressource a été créée."}, {"q": "Un appel sans jeton à POST /api/livres reçoit :", "o": ["401", "403", "404", "422"], "b": "A", "x": "Non authentifié : 401. Un adhérent authentifié mais non autorisé recevrait 403."}, {"q": "Pourquoi une API Resource plutôt que return Livre::all() ?", "o": ["Pour que la réponse soit plus rapide", "Parce que Livre::all() ne renvoie pas de JSON", "Pour éviter le CSRF", "Pour choisir les champs exposés et garder un contrat stable"], "b": "D", "x": "La Resource est le contrat : on n''expose pas les colonnes internes et la table peut évoluer."}, {"q": "Où se trouve l''identité de l''appelant dans une requête d''API ?", "o": ["Dans le cookie de session", "Dans l''URL, ?user=12", "Dans l''en-tête Authorization: Bearer <jeton>", "Dans le corps JSON, champ role"], "b": "C", "x": "Une API ne garde pas de session : chaque requête porte son jeton."}, {"q": "Une liste d''API paginée contient data, links et meta. Que donne meta ?", "o": ["La page courante, le total, la taille de page", "Les livres de la page", "Les liens vers les autres pages", "Les erreurs de validation"], "b": "A", "x": "data : les éléments ; links : précédente/suivante ; meta : où l''on en est."}]'::jsonb);

-- ─── Vérification à la main, en lecture seule ──────────────────────────────
--  select s.numero, s.titre, count(distinct m.id) as missions,
--         count(distinct co.question) filter (where co.question not like '%-c') as notions
--    from public.seances s
--    join public.classes c on c.id = s.classe_id
--    left join public.missions m on m.seance_id = s.id
--    left join public.corriges co on co.seance_id = s.id and co.question like 'pre-%'
--   where c.code = 'BTS2-SLAM-2026' and s.numero between 31 and 38
--   group by s.numero, s.titre order by s.numero;

