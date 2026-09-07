-- ═══════════════════════════════════════════════════════════════════════════
--  LES SÉANCES DE COURS DU BTS1
--
--  Constat : la classe BTS1-DEV-2026 n'avait AUCUNE séance de cours en base.
--  Ni la séance 1, ni ses dix corrigés. Conséquences en chaîne :
--
--   · le site du cours appelle repondre(seance_id, 'q1', 'B') — sans séance,
--     l'envoi échoue et aucune réponse n'est enregistrée ;
--   · le portail n'a rien à afficher : ni progression, ni réussite ;
--   · le pré-vol annonce « Aucun corrigé pour cette séance ».
--
--  Ce script crée les séances et leurs corrigés. Les dix questions sont
--  exactement celles du bloc « Réviser après la séance » de chaque page :
--  c'est docs/seances/seance-NN.md du dépôt BTS1_S1_B1_DEV qui fait foi, et
--  les clés q1 à q10 sont celles que docs/assets/suivi.js construit en lisant
--  la numérotation du quiz. Modifier l'ordre des options dans la page oblige
--  à modifier la bonne réponse ici — les deux ne se devinent pas l'un l'autre.
--
--  Bonnes réponses réparties sur A, B, C et D : une classe repère très vite
--  un motif. Séance 1 : A2 B3 C3 D2. Séance 2 : A2 B3 C3 D2.
--
--  Séances de nature « cours » : la cadence attendue est durée ÷ nombre de
--  questions, soit 55 ÷ 10 ≈ 5,5 min par question. C'est ce qui alimente la
--  ligne de rythme pendant l'heure.
--
--  Rejouable sans risque : rien n'est écrasé, seul ce qui manque est ajouté.
--
--  À coller dans Supabase → SQL Editor → Run. Après SEANCE.sql (colonnes
--  duree_min et nature) et INTITULES.sql (colonnes intitule et options).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les deux séances ───────────────────────────────────────────────────
--  Fermées à la création : c'est le bouton « Démarrer la séance » du portail
--  qui les ouvre le jour venu. Une séance ouverte trop tôt, c'est une classe
--  qui répond au quiz la veille.
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min, nature)
select c.id, v.numero, v.titre, false, false, 55, 'cours'
  from public.classes c
  cross join (values
      (1, 'Seance 1 - 03 h 47 : metiers du dev et 5 composants du SI'),
      (2, 'Seance 2 - A la seconde pres : du web statique au temps reel')
    ) as v(numero, titre)
 where c.code = 'BTS1-DEV-2026'                    -- <<< À MODIFIER
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = v.numero);

-- ─── 2. Séance 1 — « 03 h 47 » ─────────────────────────────────────────────
with q(numero, cle, bonne, intitule, options, explication) as (values

  (1::int, 'q1', 'D',
   'Le modele de Laudon decrit un SI en 5 composants. Lequel n''en fait pas partie ?',
   array['Materiel', 'Logiciel', 'Donnees', 'Benefice'],
   'Les cinq sont Materiel, Logiciel, Donnees, Procedures, Humain — MLDPP. Le benefice est un resultat, pas un composant.'),

  (1, 'q2', 'B',
   'Le code d''une application releve de quel composant ?',
   array['Materiel', 'Logiciel', 'Donnees', 'Procedures'],
   'Le developpeur agit sur le Logiciel. Retenez surtout la suite : ses choix touchent les quatre autres lettres.'),

  (1, 'q3', 'C',
   'Une seule personne connait la procedure de redemarrage. Cela releve de quel composant ?',
   array['Materiel', 'Logiciel', 'Humain', 'Donnees'],
   'Un seul detenteur du savoir est un point de rupture — un SPOF. Le savoir non partage est un probleme humain, pas technique.'),

  (1, 'q4', 'A',
   'La culture DevOps rapproche quels deux mondes ?',
   array['Developpement + Operations', 'Design + Operations', 'Data + Options', 'Developpement + Design'],
   'Dev pour developpement, Ops pour operations : ceux qui ecrivent le code et ceux qui le font tourner.'),

  (1, 'q5', 'C',
   'Quelle culture integre la securite des la conception ?',
   array['DataOps', 'MLOps', 'DevSecOps', 'SecuWeb'],
   'DevSecOps : le Sec s''intercale entre Dev et Ops, parce que la securite ne s''ajoute pas a la fin.'),

  (1, 'q6', 'B',
   'Quelle culture industrialise la donnee : pipelines, ETL, qualite ?',
   array['DevOps', 'DataOps', 'MLOps', 'DevSecOps'],
   'DataOps, la culture de Lea. Sa question : qu''est-ce qu''on a perdu, et les donnees sont-elles coherentes ?'),

  (1, 'q7', 'A',
   'Quelle culture met un modele d''IA en production de facon fiable ?',
   array['MLOps', 'DevOps', 'DataOps', 'WebOps'],
   'MLOps, la culture de Noah. Un modele entraine sur des donnees corrompues apprend du bruit.'),

  (1, 'q8', 'D',
   'Git est un outil de quelle nature ?',
   array['base de donnees', 'messagerie', 'conteneurisation', 'gestion de versions'],
   'Git garde l''historique du code et permet de revenir en arriere. C''est le socle du geste DevOps.'),

  (1, 'q9', 'C',
   'Dans l''enquete DevSecure, quelle etait la cause premiere de la panne ?',
   array['une attaque', 'un serveur defectueux', 'une ligne de code ecrite sans vision systeme', 'une erreur de la base'],
   'La panne a commence onze semaines plus tot, avec un log ecrit a chaque action. Le code marchait ; il ne voyait pas le reste du systeme.'),

  (1, 'q10', 'B',
   'Quel est le point commun des quatre cultures Ops ?',
   array['elles utilisent Docker', 'automatiser, tester, surveiller, pouvoir revenir en arriere', 'elles concernent la securite', 'elles sont reservees aux grandes entreprises'],
   'Seul l''objet change : le code, la securite, la donnee, l''IA. Le reflexe, lui, est le meme.'),

-- ─── 3. Séance 2 — « À la seconde près » ───────────────────────────────────

  (2, 'q1', 'B',
   'Dans une conversation entre un navigateur et un serveur, qui parle en premier ?',
   array['Le serveur', 'Le client', 'L''un ou l''autre', 'Le reseau'],
   'Le client demande, le serveur repond. C''est vrai partout — sauf en WebSocket, ou la ligne reste ouverte.'),

  (2, 'q2', 'C',
   'Quelle methode HTTP sert a creer une ressource ?',
   array['GET', 'DELETE', 'POST', 'PUT'],
   'GET lit, POST cree, PUT remplace, DELETE supprime. La meme adresse, quatre verbes.'),

  (2, 'q3', 'A',
   'Un code de statut qui commence par 5 signifie que le probleme vient de qui ?',
   array['du serveur', 'du client', 'du navigateur', 'du mot de passe'],
   'Le chiffre des centaines dit qui est en tort : 4xx c''est le client, 5xx c''est le serveur. Confondre les deux fait chercher du mauvais cote.'),

  (2, 'q4', 'D',
   'Une page demandee n''existe pas. Que renvoie le serveur ?',
   array['200', '500', '301', '404'],
   '404 Not Found : la ressource demandee n''existe pas. C''est le client qui s''est trompe d''adresse, donc 4xx.'),

  (2, 'q5', 'A',
   'Vous demandez une page reservee sans etre connecte. Que renvoie le serveur ?',
   array['401', '404', '200', '500'],
   '401 Unauthorized. Attention au piege : en 404 la chose n''existe pas, en 401 elle existe et on vous la refuse.'),

  (2, 'q6', 'B',
   'A quoi sert AJAX ?',
   array['garder une connexion ouverte en permanence', 'mettre a jour une partie de la page sans la recharger', 'securiser les mots de passe', 'stocker des donnees sur le serveur'],
   'AJAX evite l''ecran blanc, mais c''est toujours le client qui demande. Le serveur, lui, se tait.'),

  (2, 'q7', 'C',
   'Quelle technique fait apparaitre un message sans que l''utilisateur clique ?',
   array['la page complete', 'AJAX', 'WebSocket', 'le responsive'],
   'La question qui decide : qui sait qu''il y a du nouveau ? Si c''est le serveur, il faut une ligne ouverte.'),

  (2, 'q8', 'D',
   'Que renvoie le plus souvent une API REST ?',
   array['une page HTML complete', 'une image', 'un fichier a telecharger', 'de la donnee en JSON'],
   'Une API ne renvoie pas ce qu''on voit, elle renvoie ce qu''on sait. La mise en forme est le travail du client.'),

  (2, 'q9', 'B',
   'Dans une API REST, que designe l''adresse /api/projets/42 ?',
   array['la 42e page du site', 'une ressource precise, le projet 42', 'une erreur', 'un dossier sur le serveur'],
   'Chaque chose a une adresse. C''est la premiere des trois idees de REST.'),

  (2, 'q10', 'C',
   'Pourquoi les 9 400 utilisateurs de DevSecure ont-ils vu la panne a la meme seconde ?',
   array['ils rechargeaient tous la page au meme moment', 'le serveur leur a envoye un mail', 'chacun avait une connexion ouverte en permanence, coupee d''un coup', 'c''est une coincidence'],
   'Le temps reel qui fait la qualite de l''application est exactement ce qui a rendu la panne instantanee et totale.')

)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'          -- <<< À MODIFIER
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── 3 bis. Rattraper des corrigés déjà présents mais incomplets ───────────
--  Un corrigé peut exister sans intitulé ni options : c'est le cas si la
--  séance a été créée à la main avant ce script, ou par un essai. L'insert
--  ci-dessus l'aurait laissé tel quel — vide à l'écran. On le complète.
--
--  Ne touche à la bonne réponse que si l'intitulé manquait, c'est-à-dire si
--  la ligne n'avait jamais été renseignée. Une bonne réponse deja saisie
--  n'est jamais ecrasee en silence.
--
--  Attention : « correct » est calculé par repondre() au moment de la
--  réponse. Corriger une bonne_reponse après coup ne recalcule pas les
--  réponses déjà données — à ne faire que sur une séance non encore jouée.
with q(numero, cle, bonne, intitule, options, explication) as (values
  (1::int, 'q1', 'D',
   'Le modele de Laudon decrit un SI en 5 composants. Lequel n''en fait pas partie ?',
   array['Materiel', 'Logiciel', 'Donnees', 'Benefice'],
   'Les cinq sont Materiel, Logiciel, Donnees, Procedures, Humain — MLDPP. Le benefice est un resultat, pas un composant.'),

  (1, 'q2', 'B',
   'Le code d''une application releve de quel composant ?',
   array['Materiel', 'Logiciel', 'Donnees', 'Procedures'],
   'Le developpeur agit sur le Logiciel. Retenez surtout la suite : ses choix touchent les quatre autres lettres.'),

  (1, 'q3', 'C',
   'Une seule personne connait la procedure de redemarrage. Cela releve de quel composant ?',
   array['Materiel', 'Logiciel', 'Humain', 'Donnees'],
   'Un seul detenteur du savoir est un point de rupture — un SPOF. Le savoir non partage est un probleme humain, pas technique.'),

  (1, 'q4', 'A',
   'La culture DevOps rapproche quels deux mondes ?',
   array['Developpement + Operations', 'Design + Operations', 'Data + Options', 'Developpement + Design'],
   'Dev pour developpement, Ops pour operations : ceux qui ecrivent le code et ceux qui le font tourner.'),

  (1, 'q5', 'C',
   'Quelle culture integre la securite des la conception ?',
   array['DataOps', 'MLOps', 'DevSecOps', 'SecuWeb'],
   'DevSecOps : le Sec s''intercale entre Dev et Ops, parce que la securite ne s''ajoute pas a la fin.'),

  (1, 'q6', 'B',
   'Quelle culture industrialise la donnee : pipelines, ETL, qualite ?',
   array['DevOps', 'DataOps', 'MLOps', 'DevSecOps'],
   'DataOps, la culture de Lea. Sa question : qu''est-ce qu''on a perdu, et les donnees sont-elles coherentes ?'),

  (1, 'q7', 'A',
   'Quelle culture met un modele d''IA en production de facon fiable ?',
   array['MLOps', 'DevOps', 'DataOps', 'WebOps'],
   'MLOps, la culture de Noah. Un modele entraine sur des donnees corrompues apprend du bruit.'),

  (1, 'q8', 'D',
   'Git est un outil de quelle nature ?',
   array['base de donnees', 'messagerie', 'conteneurisation', 'gestion de versions'],
   'Git garde l''historique du code et permet de revenir en arriere. C''est le socle du geste DevOps.'),

  (1, 'q9', 'C',
   'Dans l''enquete DevSecure, quelle etait la cause premiere de la panne ?',
   array['une attaque', 'un serveur defectueux', 'une ligne de code ecrite sans vision systeme', 'une erreur de la base'],
   'La panne a commence onze semaines plus tot, avec un log ecrit a chaque action. Le code marchait ; il ne voyait pas le reste du systeme.'),

  (1, 'q10', 'B',
   'Quel est le point commun des quatre cultures Ops ?',
   array['elles utilisent Docker', 'automatiser, tester, surveiller, pouvoir revenir en arriere', 'elles concernent la securite', 'elles sont reservees aux grandes entreprises'],
   'Seul l''objet change : le code, la securite, la donnee, l''IA. Le reflexe, lui, est le meme.'),

-- ─── 3. Séance 2 — « À la seconde près » ───────────────────────────────────

  (2, 'q1', 'B',
   'Dans une conversation entre un navigateur et un serveur, qui parle en premier ?',
   array['Le serveur', 'Le client', 'L''un ou l''autre', 'Le reseau'],
   'Le client demande, le serveur repond. C''est vrai partout — sauf en WebSocket, ou la ligne reste ouverte.'),

  (2, 'q2', 'C',
   'Quelle methode HTTP sert a creer une ressource ?',
   array['GET', 'DELETE', 'POST', 'PUT'],
   'GET lit, POST cree, PUT remplace, DELETE supprime. La meme adresse, quatre verbes.'),

  (2, 'q3', 'A',
   'Un code de statut qui commence par 5 signifie que le probleme vient de qui ?',
   array['du serveur', 'du client', 'du navigateur', 'du mot de passe'],
   'Le chiffre des centaines dit qui est en tort : 4xx c''est le client, 5xx c''est le serveur. Confondre les deux fait chercher du mauvais cote.'),

  (2, 'q4', 'D',
   'Une page demandee n''existe pas. Que renvoie le serveur ?',
   array['200', '500', '301', '404'],
   '404 Not Found : la ressource demandee n''existe pas. C''est le client qui s''est trompe d''adresse, donc 4xx.'),

  (2, 'q5', 'A',
   'Vous demandez une page reservee sans etre connecte. Que renvoie le serveur ?',
   array['401', '404', '200', '500'],
   '401 Unauthorized. Attention au piege : en 404 la chose n''existe pas, en 401 elle existe et on vous la refuse.'),

  (2, 'q6', 'B',
   'A quoi sert AJAX ?',
   array['garder une connexion ouverte en permanence', 'mettre a jour une partie de la page sans la recharger', 'securiser les mots de passe', 'stocker des donnees sur le serveur'],
   'AJAX evite l''ecran blanc, mais c''est toujours le client qui demande. Le serveur, lui, se tait.'),

  (2, 'q7', 'C',
   'Quelle technique fait apparaitre un message sans que l''utilisateur clique ?',
   array['la page complete', 'AJAX', 'WebSocket', 'le responsive'],
   'La question qui decide : qui sait qu''il y a du nouveau ? Si c''est le serveur, il faut une ligne ouverte.'),

  (2, 'q8', 'D',
   'Que renvoie le plus souvent une API REST ?',
   array['une page HTML complete', 'une image', 'un fichier a telecharger', 'de la donnee en JSON'],
   'Une API ne renvoie pas ce qu''on voit, elle renvoie ce qu''on sait. La mise en forme est le travail du client.'),

  (2, 'q9', 'B',
   'Dans une API REST, que designe l''adresse /api/projets/42 ?',
   array['la 42e page du site', 'une ressource precise, le projet 42', 'une erreur', 'un dossier sur le serveur'],
   'Chaque chose a une adresse. C''est la premiere des trois idees de REST.'),

  (2, 'q10', 'C',
   'Pourquoi les 9 400 utilisateurs de DevSecure ont-ils vu la panne a la meme seconde ?',
   array['ils rechargeaient tous la page au meme moment', 'le serveur leur a envoye un mail', 'chacun avait une connexion ouverte en permanence, coupee d''un coup', 'c''est une coincidence'],
   'Le temps reel qui fait la qualite de l''application est exactement ce qui a rendu la panne instantanee et totale.')
)
update public.corriges co
   set intitule      = q.intitule,
       options       = q.options,
       explication   = coalesce(co.explication, q.explication),
       bonne_reponse = case when co.intitule is null then q.bonne
                            else co.bonne_reponse end
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'          -- <<< À MODIFIER
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where co.seance_id = s.id
   and co.question  = q.cle
   and (co.intitule is null or co.options is null);

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
--  Attendu : dix questions par séance, et les bonnes réponses réparties.
select s.numero as seance,
       count(*)                                    as questions,
       count(*) filter (where co.bonne_reponse = 'A') as a,
       count(*) filter (where co.bonne_reponse = 'B') as b,
       count(*) filter (where co.bonne_reponse = 'C') as c,
       count(*) filter (where co.bonne_reponse = 'D') as d,
       count(*) filter (where co.intitule is null)    as sans_intitule,
       count(*) filter (where co.options   is null)   as sans_options
  from public.corriges co
  join public.seances s  on s.id = co.seance_id
  join public.classes cl on cl.id = s.classe_id
 where cl.code = 'BTS1-DEV-2026' and s.numero in (1, 2)
 group by s.numero order by s.numero;

-- ═══════════════════════════════════════════════════════════════════════════
--  LE JOUR DE LA SÉANCE
--
--  Ne pas ouvrir la séance ici : le portail le fait, et c'est mieux ainsi.
--  Suivi d'une séance → choisir la séance → « Avant de commencer » vérifie que
--  tout est en place, puis « Démarrer la séance » ouvre et lance le chrono.
--
--  Pour clore à la main si besoin :
--    update public.seances s set ouverte = false
--      from public.classes c
--     where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 1;
-- ═══════════════════════════════════════════════════════════════════════════
