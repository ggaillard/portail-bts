-- ═══════════════════════════════════════════════════════════════════════════
--  LES ÉNONCÉS DU QUIZ BTS2, EN BASE
--
--  Les 35 questions du quiz PlaylistApp ne vivaient que dans docs/index.html.
--  Le portail n'avait donc que les clés à afficher : la « Réussite par
--  question » disait « q-3-2 » au lieu de la question, et le panneau « Les
--  questions de cette séance » restait vide sur les séances de TP.
--
--  ATTENTION à la clé : « q-3-2 » signifie bloc 3, question 2. Le premier
--  nombre est l'indice du BLOC de quiz, pas le numéro du TP — il y a sept
--  blocs pour cinq TP, le TP1 et le TP2 en ayant deux chacun :
--
--      bloc 0 → TP0                 bloc 4 → TP2 (Relations)
--      bloc 1 → TP1 (POO)           bloc 5 → TP3
--      bloc 2 → TP1 (LINQ)          bloc 6 → TP4
--      bloc 3 → TP2 (ORM)
--
--  « bonne_reponse » porte la lettre juste, pour votre relecture. Elle ne
--  sert PAS à noter : le tableau de bord corrige lui-même et envoie « ok »
--  ou « ko », et c'est cette valeur que le portail lit. Ne pas s'étonner de
--  voir « correct » à false sur ces lignes, ni chercher à « réparer » cela.
--
--  Rejouable sans risque : rien n'est écrasé, seules les questions absentes
--  sont ajoutées.
--
--  À coller dans Supabase → SQL Editor → Run. Après QUIZ_RECLASSEMENT.sql.
-- ═══════════════════════════════════════════════════════════════════════════

with q(tp, cle, bonne, intitule, options) as (values

  -- ── 🚀 TP0 — Environnement — bloc 0, séance 0 ──
  (0::int, 'q-0-0', 'A',
   'Que résout un environnement décrit (Dev Container) ?',
   array['Le « ça marche chez moi » : un environnement identique pour tous',
          'La lenteur du réseau',
          'Le manque de mémoire']),
  (0::int, 'q-0-1', 'B',
   'Différence entre une image et un conteneur ?',
   array['Ce sont des synonymes',
          'L''image est le modèle figé, le conteneur une instance en exécution',
          'Le conteneur est le modèle, l''image l''instance']),
  (0::int, 'q-0-2', 'A',
   'À quoi sert le fichier devcontainer.json ?',
   array['À décrire l''environnement (image, outils, extensions)',
          'À stocker les chansons',
          'À lancer les tests']),
  (0::int, 'q-0-3', 'B',
   '🌳 Choix : coder tout de suite sans rien installer ?',
   array['Installation locale',
          'GitHub Codespaces',
          'Impossible']),
  (0::int, 'q-0-4', 'A',
   'Pourquoi un environnement reproductible aide-t-il en équipe ?',
   array['Tout le monde a la même configuration',
          'Ça accélère internet',
          'Ça supprime les tests']),

  -- ── 📘 TP1 — POO & Collections — bloc 1, séance 1 ──
  (1::int, 'q-1-0', 'A',
   'Quelle est la différence entre une classe et un objet ?',
   array['La classe est le moule, l''objet une instance concrète',
          'L''objet est le moule, la classe une instance',
          'Ce sont des synonymes']),
  (1::int, 'q-1-1', 'B',
   'Pourquoi rendre le champ _chansons privé dans Playlist ?',
   array['Pour gagner de la mémoire',
          'Pour l''encapsulation : forcer le passage par AjouterChanson',
          'Pour accélérer le tri']),
  (1::int, 'q-1-2', 'B',
   'Quelle collection garde l''ordre d''insertion ?',
   array['Dictionary',
          'List',
          'Aucune des deux']),
  (1::int, 'q-1-3', 'B',
   '🌳 Choix : retrouver très souvent une chanson par son identifiant unique. Quelle structure ?',
   array['List (on parcourt)',
          'Dictionary (accès direct par clé)',
          'Un tableau trié']),
  (1::int, 'q-1-4', 'B',
   '🌳 Choix : garder l''ordre ET autoriser les doublons. Quelle structure ?',
   array['Dictionary',
          'List',
          'Un ensemble (Set)']),

  -- ── 📘 TP1 — LINQ — bloc 2, séance 1 ──
  (1::int, 'q-2-0', 'B',
   'Que fait .Where(c => c.Note >= 4) ?',
   array['Trie par note',
          'Filtre les chansons notées 4 ou plus',
          'Compte les chansons']),
  (1::int, 'q-2-1', 'A',
   'Comment obtenir les 3 mieux notées ?',
   array['.OrderByDescending(c=>c.Note).Take(3)',
          '.Where(c=>c.Note==3)',
          '.Select(c=>c.Note).Top(3)']),
  (1::int, 'q-2-2', 'B',
   'Différence entre Where et Select ?',
   array['Where transforme, Select filtre',
          'Where filtre, Select transforme (projette)',
          'Les deux trient']),
  (1::int, 'q-2-3', 'B',
   '🌳 Choix : les données sont déjà dans une List en mémoire. SQL ou LINQ ?',
   array['SQL',
          'LINQ',
          'Ni l''un ni l''autre']),
  (1::int, 'q-2-4', 'B',
   '🌳 Choix : une table de 5 millions de lignes, on veut le top 10. Que faire ?',
   array['Tout charger en mémoire puis trier en LINQ',
          'Laisser la base trier via son index (SQL / LINQ-to-EF)',
          'C''est impossible']),

  -- ── 📗 TP2 — ORM & Migrations — bloc 3, séance 2 ──
  (2::int, 'q-3-0', 'A',
   'Que signifie ORM ?',
   array['Object Relational Mapping',
          'Online Resource Manager',
          'Ordered Record Model']),
  (2::int, 'q-3-1', 'B',
   'À quoi correspond un DbSet<Chanson> ?',
   array['Une requête HTTP',
          'Une table en base de données',
          'Un fichier de config']),
  (2::int, 'q-3-2', 'B',
   'Dans quel ordre ajoute-t-on une colonne ?',
   array['Modifier la base puis le code',
          'Modifier le modèle C#, migrations add, database update',
          'database update puis migrations add']),
  (2::int, 'q-3-3', 'A',
   'Quelle méthode enregistre réellement les changements en base ?',
   array['SaveChangesAsync()',
          'ToList()',
          'Add()']),
  (2::int, 'q-3-4', 'B',
   '🌳 Choix : faire évoluer le schéma sans perdre les données, en équipe. Quel outil ?',
   array['Modifier la base à la main',
          'Les migrations (versionnées dans Git)',
          'Supprimer puis recréer la base']),

  -- ── 📗 TP2 — Relations — bloc 4, séance 2 ──
  (2::int, 'q-4-0', 'B',
   'Comment modélise-t-on une relation N-N ?',
   array['Avec une clé étrangère simple',
          'Avec une table de liaison',
          'C''est impossible']),
  (2::int, 'q-4-1', 'A',
   'Exemple de relation 1-N dans le projet ?',
   array['Un artiste possède plusieurs chansons',
          'Une chanson a plusieurs artistes uniques',
          'Deux playlists identiques']),
  (2::int, 'q-4-2', 'A',
   'Qu''est-ce qu''une clé étrangère ?',
   array['Une colonne qui référence la clé d''une autre table',
          'Un mot de passe de la base',
          'Un index de tri']),
  (2::int, 'q-4-3', 'B',
   'Que porte souvent la table de liaison en plus des deux clés ?',
   array['Rien d''autre',
          'La position / l''ordre dans la playlist',
          'Le mot de passe']),
  (2::int, 'q-4-4', 'B',
   '🌳 Choix : une chanson peut être dans plusieurs playlists et une playlist contient plusieurs chansons. Quelle relation ?',
   array['1-N',
          'N-N (via table de liaison)',
          '1-1']),

  -- ── 📕 TP3 — REST & SOA — bloc 5, séance 3 ──
  (3::int, 'q-5-0', 'B',
   'Quel verbe et quel code pour créer une ressource ?',
   array['GET, 200',
          'POST, 201',
          'PUT, 204']),
  (3::int, 'q-5-1', 'B',
   'Que signifie un code 404 ?',
   array['Succès',
          'Ressource introuvable',
          'Erreur serveur']),
  (3::int, 'q-5-2', 'B',
   'Rôle du Repository dans SOA ?',
   array['Gérer le web',
          'Accéder aux données',
          'Afficher l''IHM']),
  (3::int, 'q-5-3', 'B',
   'HTTP est un protocole…',
   array['avec état (il retient chaque requête)',
          'sans état (chaque requête est indépendante)',
          'orienté connexion permanente']),
  (3::int, 'q-5-4', 'B',
   '🌳 Choix : besoin de notifications temps réel bidirectionnelles. Quelle techno ?',
   array['REST classique',
          'WebSocket',
          'SOAP']),

  -- ── 🎏 TP4 — EOA — bloc 6, séance 4 ──
  (4::int, 'q-6-0', 'B',
   'Quel problème l''EOA résout-elle ?',
   array['La lenteur du réseau',
          'Le couplage fort',
          'Le manque de mémoire']),
  (4::int, 'q-6-1', 'B',
   'Pour ajouter une notification, faut-il modifier le Controller ?',
   array['Oui, toujours',
          'Non : on crée et abonne un nouveau handler',
          'Oui, mais juste une ligne']),
  (4::int, 'q-6-2', 'B',
   'SOA et EOA sont…',
   array['concurrentes',
          'complémentaires',
          'identiques']),
  (4::int, 'q-6-3', 'B',
   '🌳 Choix : à la création, journaliser + stats + e-mail sans alourdir le Controller. Quelle approche ?',
   array['Tout mettre dans le Controller (SOA direct)',
          'Publier un événement, les handlers réagissent (EOA)',
          'Ne rien faire']),
  (4::int, 'q-6-4', 'A',
   '🌳 Choix : un endpoint avec UN seul effet, immédiat et connu. Quelle approche ?',
   array['Un appel direct (SOA), plus simple',
          'Forcément l''EOA',
          'Plusieurs bus d''événements'])
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options)
select s.id, q.cle, q.bonne, q.intitule, q.options
  from q
  join public.classes c on c.code = 'BTS2-SLAM-2026'          -- <<< À MODIFIER
  join public.seances s on s.classe_id = c.id and s.numero = q.tp
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── Contrôle : cinq questions par séance de TP, trente-cinq en tout ───────
select s.numero as tp, count(*) as questions_de_quiz
  from public.corriges co
  join public.seances s on s.id = co.seance_id
  join public.classes c on c.id = s.classe_id
 where c.code = 'BTS2-SLAM-2026' and co.question like 'q-%'
 group by s.numero order by s.numero;
