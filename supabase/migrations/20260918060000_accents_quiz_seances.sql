-- ═══════════════════════════════════════════════════════════════════════════
--  Les accents des quiz de séance — 18/09/2026
--
--  CE QUE CE FICHIER CORRIGE
--
--  Les 268 textes de quiz des séances 1, 2 et 3 — intitulés, options,
--  explications — ont été écrits SANS AUCUN ACCENT. « une attaque informatique
--  venue de l'exterieur », « le probleme vient de qui ? », « Materiel »,
--  « Donnees ». Cent pour cent d'entre eux : mesuré, pas estimé.
--
--  Ce ne sont pas des chaînes internes. C'est ce que trente étudiants lisent
--  sur leur téléphone pendant une évaluation, dans un BTS de la filière
--  Économie-Gestion. Les contrôles ne l'ont jamais vu parce qu'ils comparent
--  page et base après avoir NORMALISÉ les accents (`lire.plat`), précisément
--  pour ne pas crier sur une différence typographique — ce qui est la bonne
--  règle pour comparer deux sources, et qui les rendait aveugles à une source
--  fausse des deux côtés.
--
--  CE QUI NE CHANGE PAS
--
--  · `bonne_reponse` n'est pas touchée. Les étudiants répondent par une LETTRE,
--    et l'ordre des options est conservé à l'identique : aucune réponse déjà
--    enregistrée ne change de valeur, ni de justesse.
--  · Aucun mot n'est réécrit. La vérification est mécanique : le texte de ce
--    fichier, privé de ses signes diacritiques, redonne caractère pour
--    caractère le texte d'origine. 162 textes distincts, 0 altéré.
--
--  REJOUABLE
--
--  Cette migration pose des valeurs, elle n'en dérive aucune : la rejouer une
--  deuxième fois écrit exactement la même chose. C'est ce que vérifie le
--  travail « verifier » de supabase.yml.
--
--  LES MIGRATIONS D'ORIGINE NE SONT PAS MODIFIÉES : une migration déjà
--  appliquée ne se réécrit pas. Sur une base neuve, celle-ci s'exécute après
--  elles et le résultat est le même.
-- ═══════════════════════════════════════════════════════════════════════════

-- « bonne » est portée par cette table SANS JAMAIS ÊTRE ÉCRITE : l'update
-- plus bas ne touche que l'intitulé, les options et l'explication. Elle est
-- là pour les OUTILS — outils/lire.py lit toutes les migrations de séance
-- dans l'ordre pour reconstituer l'état final, et il lui faut partout la
-- même forme de tuple. Sans elle, ce fichier serait invisible aux contrôles,
-- et ils continueraient de vérifier le texte d'avant.
with q(numero, cle, bonne, intitule, options, explication) as (values
  (1, 'q2', 'B',
   'Le code d''une application relève de quel composant ?',
   array['Matériel', 'Logiciel', 'Données', 'Procédures'],
   'Le développeur agit sur le Logiciel. Retenez surtout la suite : ses choix touchent les quatre autres lettres.'),

  (1, 'q3', 'C',
   'Une seule personne connaît la procédure de redémarrage. Cela relève de quel composant ?',
   array['Matériel', 'Logiciel', 'Humain', 'Données'],
   'Un seul détenteur du savoir est un point de rupture — un SPOF. Le savoir non partagé est un problème humain, pas technique.'),

  (1, 'q4', 'A',
   'La culture DevOps rapproche quels deux mondes ?',
   array['Développement + Opérations', 'Design + Opérations', 'Data + Options', 'Développement + Design'],
   'Dev pour développement, Ops pour opérations : ceux qui écrivent le code et ceux qui le font tourner.'),

  (1, 'q5', 'C',
   'Quelle culture intègre la sécurité dès la conception ?',
   array['DataOps', 'MLOps', 'DevSecOps', 'SecuWeb'],
   'DevSecOps : le Sec s''intercale entre Dev et Ops, parce que la sécurité ne s''ajoute pas à la fin.'),

  (1, 'q6', 'B',
   'Quelle culture industrialise la donnée : pipelines, ETL, qualité ?',
   array['DevOps', 'DataOps', 'MLOps', 'DevSecOps'],
   'DataOps, la culture de Léa. Sa question : qu''est-ce qu''on a perdu, et les données sont-elles cohérentes ?'),

  (1, 'q7', 'A',
   'Quelle culture met un modèle d''IA en production de façon fiable ?',
   array['MLOps', 'DevOps', 'DataOps', 'WebOps'],
   'MLOps, la culture de Noah. Un modèle entraîné sur des données corrompues apprend du bruit.'),

  (1, 'q8', 'D',
   'Git est un outil de quelle nature ?',
   array['base de données', 'messagerie', 'conteneurisation', 'gestion de versions'],
   'Git garde l''historique du code et permet de revenir en arrière. C''est le socle du geste DevOps.'),

  (1, 'q9', 'C',
   'Dans l''enquête DevSecure, quelle était la cause première de la panne ?',
   array['une attaque informatique venue de l''extérieur', 'un serveur tombe en panne dans la nuit', 'une ligne de code écrite sans vision système', 'une erreur de saisie dans la base de données'],
   'La panne a commencé onze semaines plus tôt, avec un log écrit à chaque action. Le code marchait ; il ne voyait pas le reste du système.'),

  (1, 'q10', 'B',
   'Quel est le point commun des quatre cultures Ops ?',
   array['elles utilisent Docker', 'automatiser, tester, surveiller, pouvoir revenir en arrière', 'elles concernent la sécurité', 'elles sont réservées aux grandes entreprises'],
   'Seul l''objet change : le code, la sécurité, la donnée, l''IA. Le réflexe, lui, est le même.'),

  (2, 'q1', 'B',
   'Dans une conversation entre un navigateur et un serveur, qui parle en premier ?',
   array['Le serveur', 'Le client', 'L''un ou l''autre', 'Le réseau'],
   'Le client demande, le serveur répond. C''est vrai partout — sauf en WebSocket, où la ligne reste ouverte.'),

  (2, 'q2', 'C',
   'Quelle méthode HTTP sert à créer une ressource ?',
   array['GET', 'DELETE', 'POST', 'PUT'],
   'GET lit, POST crée, PUT remplace, DELETE supprime. La même adresse, quatre verbes.'),

  (2, 'q3', 'A',
   'Un code de statut qui commence par 5 signifie que le problème vient de qui ?',
   array['du serveur', 'du client', 'du navigateur', 'du mot de passe'],
   'Le chiffre des centaines dit qui est en tort : 4xx c''est le client, 5xx c''est le serveur. Confondre les deux fait chercher du mauvais côté.'),

  (2, 'q4', 'D',
   'Une page demandée n''existe pas. Que renvoie le serveur ?',
   array['200', '500', '301', '404'],
   '404 Not Found : la ressource demandée n''existe pas. C''est le client qui s''est trompé d''adresse, donc 4xx.'),

  (2, 'q5', 'A',
   'Vous demandez une page réservée sans être connecté. Que renvoie le serveur ?',
   array['401', '404', '200', '500'],
   '401 Unauthorized. Attention au piège : en 404 la chose n''existe pas, en 401 elle existe et on vous la refuse.'),

  (2, 'q6', 'B',
   'À quoi sert AJAX ?',
   array['garder une connexion ouverte en permanence', 'mettre à jour une partie de la page sans la recharger', 'sécuriser les mots de passe', 'stocker des données sur le serveur'],
   'AJAX évite l''écran blanc, mais c''est toujours le client qui demande. Le serveur, lui, se tait.'),

  (2, 'q7', 'C',
   'Quelle technique fait apparaître un message sans que l''utilisateur clique ?',
   array['la page complète', 'AJAX', 'WebSocket', 'le responsive'],
   'La question qui décide : qui sait qu''il y a du nouveau ? Si c''est le serveur, il faut une ligne ouverte.'),

  (2, 'q8', 'D',
   'Que renvoie le plus souvent une API REST ?',
   array['une page HTML complète', 'une image', 'un fichier à télécharger', 'de la donnée en JSON'],
   'Une API ne renvoie pas ce qu''on voit, elle renvoie ce qu''on sait. La mise en forme est le travail du client.'),

  (2, 'q9', 'B',
   'Dans une API REST, que désigne l''adresse /api/projets/42 ?',
   array['la 42e page du site', 'une ressource précise, le projet 42', 'une erreur', 'un dossier sur le serveur'],
   'Chaque chose a une adresse. C''est la première des trois idées de REST.'),

  (2, 'q10', 'C',
   'Pourquoi les 9 400 utilisateurs de DevSecure ont-ils vu la panne à la même seconde ?',
   array['Ils rechargeaient tous la page exactement au même moment', 'Le serveur a envoyé un message d''alerte à chacun d''eux', 'Chacun avait une connexion ouverte en permanence, coupée d''un coup', 'C''est une coïncidence que rien n''explique vraiment'],
   'Le temps réel qui fait la qualité de l''application est exactement ce qui a rendu la panne instantanée et totale.'),

  (3, 'q1', 'C',
   'Dans une base relationnelle, comment s''appelle la colonne qui identifie une ligne sans doublon possible ?',
   array['la clé étrangère', 'la jointure', 'la clé primaire', 'l''index'],
   'La clé primaire identifie la ligne. La clé étrangère, elle, pointe vers la clé primaire d''une autre table.'),

  (3, 'q2', 'A',
   'Comment s''appelle l''opération qui recolle deux tables reliées entre elles ?',
   array['une jointure', 'une transaction', 'une agrégation', 'une migration'],
   'La jointure suit la flèche entre deux tables et les présente comme une seule.'),

  (3, 'q3', 'D',
   'Que garantit une transaction ?',
   array['que la requête sera exécutée en moins d''une seconde', 'que les données seront compressées avant d''être écrites', 'que la base acceptera n''importe quelle forme de données', 'que l''opération se fait entièrement, ou pas du tout'],
   'Tout ou rien. Un virement retire d''un compte ET ajoute à l''autre, jamais la moitié.'),

  (3, 'q4', 'B',
   'Quel est le principal atout d''une base documentaire par rapport au relationnel ?',
   array['elle répond toujours plus vite, quel que soit le volume', 'chaque fiche peut avoir sa propre forme', 'elle garantit mieux l''exactitude des données liées', 'elle occupe beaucoup moins de place sur le disque'],
   'Schéma souple : chaque fiche peut avoir sa forme. C''est le troc du NoSQL — de la souplesse contre des garanties.'),

  (3, 'q5', 'C',
   'Quelle famille NoSQL répond le mieux à « qui connaît qui » dans un réseau ?',
   array['clé-valeur', 'document', 'graphe', 'colonnes'],
   'La question porte sur les liens, pas sur les fiches. En relationnel, « les amis des amis des amis » demande trois jointures.'),

  (3, 'q6', 'B',
   'En quoi consiste la dénormalisation ?',
   array['supprimer les doublons d''une table pour gagner de la place en base', 'accepter de répéter une information pour éviter une jointure', 'chiffrer les données sensibles avant de les enregistrer', 'répartir la base sur plusieurs machines pour tenir la charge'],
   'On accepte de répéter pour éviter la jointure. Le prix : si l''information change, il faut la changer partout.'),

  (3, 'q7', 'D',
   'Que contient un lac de données ?',
   array['uniquement des tables nettoyées et déjà rangées', 'seulement les données de l''année en cours', 'les seuls chiffres validés par la direction', 'des données brutes, versées sans schéma préalable'],
   'Brut, sans schéma, sans tri : on verse au cas où, sans savoir encore ce qu''on cherchera.'),

  (3, 'q8', 'A',
   'Qu''est-ce qui distingue un entrepôt de données d''un lac ?',
   array['on décide d''avance des questions et on range en conséquence', 'il contient toujours beaucoup moins de données', 'il n''accepte que des fichiers au format JSON', 'il ne conserve jamais rien plus de trois mois'],
   'L''entrepôt répond à des questions décidées d''avance ; le lac garde tout, y compris ce qu''on ne lira jamais.'),

  (3, 'q9', 'C',
   'Quel est le risque principal d''un lac mal tenu ?',
   array['il oblige à recharger toutes les données à chaque requête', 'il finit par refuser les nouvelles données versées', 'il devient un marécage dont plus personne ne connaît le contenu', 'il supprime automatiquement les données les plus anciennes'],
   'Un lac dans lequel personne ne range devient un marécage. Le risque est d''organisation, pas de technique.'),

  (3, 'q10', 'B',
   'Pourquoi 60, 47 et 72 peuvent-ils être justes tous les trois ?',
   array['parce que les trois systèmes sont mal synchronisés', 'parce qu''ils ne parlent ni du même moment ni de la même chose', 'parce que deux d''entre eux ne sont que des estimations', 'parce que l''un des trois chiffres a été arrondi'],
   'Un constat de maintenant, un constat consolidé de dimanche, une prévision. Un chiffre se lit avec sa date et sa source.')
)
update public.corriges co
   set intitule    = q.intitule,
       options     = q.options,
       explication = q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'          -- <<< À MODIFIER
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where co.seance_id = s.id
   and co.question  = q.cle;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
--  Attendu : zéro texte sans accent sur les séances 1 à 3.
select s.numero as seance,
       count(*) as questions,
       count(*) filter (where co.intitule    !~ '[À-ÿ]') as intitules_sans_accent,
       count(*) filter (where co.explication !~ '[À-ÿ]') as explications_sans_accent
  from public.corriges co
  join public.seances s  on s.id = co.seance_id
  join public.classes cl on cl.id = s.classe_id
 where cl.code = 'BTS1-DEV-2026' and s.numero in (1, 2, 3)
 group by s.numero order by s.numero;
