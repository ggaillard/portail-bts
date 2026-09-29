-- ═══════════════════════════════════════════════════════════════════════════
--  RÉVISER PLAYLISTAPP — le module entier, avant l'évaluation sur table
--
--  29/09. Vingt-quatre questions, six par TP (Console & POO, EF Core, API
--  REST, Événements), en mode `revision` avec la CERTITUDE demandée : on
--  choisit, on dit si l'on était sûr, on lit la correction ; au bout du tour,
--  un bilan thème par thème (migration 20260929060000).
--
--  D'où viennent les questions : des dix fiches concept du dépôt
--  `playlist-csharp` (cours/*.md) et du code du TP3/TP4
--  (ChansonsController.cs, EventBus.cs, Program.cs), relues le 29/09 par un
--  second lecteur contre ces sources — l'énoncé qui appelait un constructeur
--  à deux arguments, qui n'existe pas au TP1, a été corrigé ainsi. Aucune ne reprend une question du
--  contrôle d'entrée de la séance 2 ni de la révision POO du 16/09 — le
--  contrôle mesure ce qu'ils ont gardé sans aide, et réviser sur ses propres
--  questions le viderait de son sens. Une assertion le tient.
--
--  Les angles suivent l'évaluation sur table (même forme que l'interro du
--  TP1) : vocabulaire, choix justifié, lecture de code, prévoir un résultat,
--  repérer ce qui cloche.
--
--  Bonnes réponses : six A, six B, six C, six D, mélangées dans chaque thème.
--
--  **Créé FERMÉ, et rattaché à rien** : il vit jusqu'à l'évaluation, pas
--  jusqu'à la fin d'une séance. On l'allume depuis Préparer → Questionnaires.
--
--  Insert directs : `creer_modele()` exige `est_enseignant()`, ce qu'une
--  migration n'est pas. On écrit exactement ce qu'elle aurait écrit.
--  Rejouable ; ne réécrit plus rien dès qu'une réponse existe.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_cle    text := 'revision-playlistapp';
  v_id     bigint;
  v_classe bigint;
  v_s      bigint;
  v_num    int;
  v_n      int;
  v_max    int;
  v_rep    int;
begin
  -- ── 1. Le modèle ─────────────────────────────────────────────────────────
  select id into v_id from public.modeles where cle = v_cle;
  if v_id is not null then
    select count(*) into v_rep
      from public.reponses r join public.seances s on s.id = r.seance_id
     where s.modele_id = v_id;
    if v_rep > 0 then
      raise notice 'Réviser PlaylistApp : % réponse(s) déjà données, le texte '
                   'n''est pas réécrit.', v_rep;
      return;
    end if;
    delete from public.modele_corriges  where modele_id = v_id;
    delete from public.modele_questions where modele_id = v_id;
    update public.modeles set mode = 'revision', certitude = true where id = v_id;
  else
    insert into public.modeles (cle, titre, intro, mode, certitude)
    values (v_cle, 'Réviser PlaylistApp — l''évaluation sur table',
            'Vingt-quatre questions, six par TP. Choisissez, dites si vous '
            'étiez sûr, puis lisez la correction. À la fin du tour, votre '
            'bilan TP par TP vous dit quoi relire. Rien n''est noté ici : '
            'recommencez autant que vous voulez.',
            'revision', true)
    returning id into v_id;
  end if;

  -- ── 2. Les questions, avec leur thème ────────────────────────────────────
  insert into public.modele_questions (modele_id, rang, cle, intitule, options, theme)
  select v_id, q.rang, v_cle || '-' || lpad(q.rang::text, 2, '0'),
         q.intitule, q.options, q.theme
    from (values

    (1, 'TP1 · Console & POO', 'À quoi sert un constructeur, comme celui qu''appelle « new Chanson(…) » ?',
     array['À déclarer la classe Chanson pour le compilateur', 'À donner à l''objet un état de départ valide dès sa création', 'À libérer la mémoire quand l''objet n''est plus utilisé', 'À copier une chanson existante dans une nouvelle']),

    (2, 'TP1 · Console & POO', 'Que renvoie « chansons.Select(c => c.Titre) » ?',
     array['Les chansons dont le titre n''est pas vide', 'La première chanson de la liste', 'Le nombre de chansons qui ont un titre', 'Une séquence de titres, un par chanson']),

    (3, 'TP1 · Console & POO', 'Après « var r = chansons.Where(c => c.Genre == "Rock"); », quand le filtre est-il réellement exécuté ?',
     array['Au moment où l''on parcourt r', 'À la ligne du Where, immédiatement', 'À la compilation du programme', 'Jamais : Where ne fait que déclarer un type']),

    (4, 'TP1 · Console & POO', '« dico.Add(3, a); » puis « dico.Add(3, b); » sur un Dictionary<int, Chanson>. Au second Add :',
     array['b remplace a sans rien dire', 'b est rangé sous la clé 4, la suivante libre', 'Une exception est levée : la clé 3 existe déjà', 'Le dictionnaire garde a et b, rangés tous deux sous la clé 3']),

    (5, 'TP1 · Console & POO', 'Avec « var genres = new List<string> { "Rock", "Jazz", "Pop" }; », qu''affiche « Console.WriteLine(genres[1]); » ?',
     array['Jazz', 'Rock', 'Pop', 'Une erreur : il n''y a pas d''élément 1']),

    (6, 'TP1 · Console & POO', 'Que renvoie « chansons.Any(c => c.Annee < 1970) » ?',
     array['La liste de toutes les chansons sorties avant 1970, dans l''ordre', 'Le nombre de chansons sorties avant 1970', 'true si au moins une chanson est sortie avant 1970', 'La première chanson sortie avant 1970']),

    (7, 'TP2 · EF Core', 'Dans PlaylistContext, « public DbSet<Chanson> Chansons » correspond à :',
     array['Une liste de chansons chargée entièrement en mémoire au démarrage', 'Le fichier SQLite lui-même', 'Une migration qui crée la table', 'La table des chansons dans la base']),

    (8, 'TP2 · EF Core', 'Le code fait « _ctx.Chansons.Add(c); » puis s''arrête sans appeler SaveChangesAsync(). En base :',
     array['La chanson est enregistrée, SaveChangesAsync() ne sert qu''à accélérer', 'Rien n''est écrit : l''ajout n''existait qu''en mémoire', 'La chanson est enregistrée sans Id', 'Une exception bloque le programme au Add']),

    (9, 'TP2 · EF Core', 'Pour ajouter une colonne Label sans perdre les données, dans quel ordre travaille-t-on ?',
     array['Modifier la table dans SQLite, puis adapter la classe C#', 'database update, puis modifier la classe', 'Modifier la classe, migrations add, database update', 'Modifier la classe, puis recréer la base']),

    (10, 'TP2 · EF Core', 'Pourquoi met-on une date fixe dans les données initiales (seed) plutôt que DateTime.UtcNow ?',
     array['Une date qui change à chaque génération crée une migration fantôme', 'SQLite ne sait pas stocker l''heure d''un enregistrement', 'DateTime.UtcNow ne compile pas dans une méthode de seed', 'Une date fixe rend les tests unitaires plus rapides']),

    (11, 'TP2 · EF Core', 'Un artiste interprète plusieurs chansons ; une chanson n''a qu''un artiste. Où se place la clé étrangère ?',
     array['ChansonId, dans la table Artistes', 'ArtisteId, dans la table Chansons', 'Une liste d''Id de chansons dans la table Artistes', 'Dans une table de liaison ArtisteChanson']),

    (12, 'TP2 · EF Core', 'Une playlist contient plusieurs chansons, et une chanson figure dans plusieurs playlists. On stocke cela par :',
     array['Une colonne ChansonIds qui liste les Id de chansons', 'Une clé étrangère PlaylistId dans la table Chansons', 'Une copie de chaque chanson dans chaque playlist', 'Une table de liaison PlaylistChanson (PlaylistId, ChansonId)']),

    (13, 'TP3 · API REST', 'Un POST /api/chansons réussit. Le code de statut attendu est :',
     array['201 Created', '200 OK', '204 No Content', '302 Found']),

    (14, 'TP3 · API REST', 'GET /api/chansons/999, et la chanson 999 n''existe pas. GetById renvoie :',
     array['200 OK avec un corps vide', '400 Bad Request', '404 Not Found', '500 Internal Server Error']),

    (15, 'TP3 · API REST', 'Laquelle de ces requêtes n''est PAS idempotente ?',
     array['GET /api/chansons/5', 'PUT /api/chansons/5', 'DELETE /api/chansons/5', 'POST /api/chansons']),

    (16, 'TP3 · API REST', 'DELETE /api/chansons/10, et la chanson 10 figure dans une playlist. D''après le Controller du TP, la réponse est :',
     array['204 No Content', '409 Conflict', '404 Not Found', '500 Internal Server Error']),

    (17, 'TP3 · API REST', 'Dans l''API, vous remplacez SQLite par PostgreSQL. Ce qui change, et pas le Controller :',
     array['Les classes du modèle (Chanson, Playlist…)', 'Le client qui appelle l''API REST', 'Le format JSON de toutes les réponses', 'Le fournisseur de base, choisi dans Program.cs']),

    (18, 'TP3 · API REST', 'Dans « public class ChansonsController(PlaylistContext ctx) », qui fournit ctx ?',
     array['Le Controller lui-même, en appelant new PlaylistContext()', 'Le conteneur d''injection de dépendances d''ASP.NET Core', 'Le client HTTP, dans le corps de la requête', 'La migration, au démarrage de la base']),

    (19, 'TP4 · Événements', 'À chaque chanson créée, il faut journaliser, mettre à jour les statistiques, notifier… Pourquoi publier un événement plutôt que tout appeler depuis le Controller ?',
     array['Parce qu''un événement s''exécute toujours plus vite', 'Parce qu''un Controller ne peut appeler qu''une seule méthode', 'Pour que le Controller ignore ces réactions : on en ajoute sans le modifier', 'Pour que la chanson soit enregistrée deux fois']),

    (20, 'TP4 · Événements', 'Dans le patron publish/subscribe, qui distribue l''événement aux abonnés ?',
     array['Le bus d''événements (EventBus)', 'Le Controller, qui appelle chaque handler', 'Chaque handler, qui interroge les autres', 'La base de données, par un déclencheur']),

    (21, 'TP4 · Événements', 'Pour envoyer un e-mail à chaque chanson ajoutée, vous :',
     array['Ajoutez l''envoi dans la méthode Create du Controller', 'Modifiez ChansonAjouteeEvent pour qu''il envoie lui-même l''e-mail', 'Écrivez un nouveau handler et l''abonnez à ChansonAjouteeEvent', 'Créez un nouvel endpoint POST /api/emails']),

    (22, 'TP4 · Événements', 'Votre HistoriqueHandler ne réagit jamais. Que vérifiez-vous en premier ?',
     array['La table Historique dans la base SQLite', 'Que le Controller appelle bien HistoriqueHandler directement', 'Le port d''écoute de l''API (5000)', 'La ligne bus.Subscribe<…>(…) dans AddEventBus']),

    (23, 'TP4 · Événements', 'Dans Delete, pourquoi PublishAsync(new ChansonSupprimeeEvent(…)) vient-il APRÈS SaveChangesAsync() ?',
     array['Pour n''annoncer la suppression que si elle a réellement eu lieu', 'Parce que PublishAsync efface la chanson', 'Parce qu''un événement doit toujours être la dernière ligne d''une méthode', 'Pour que la réponse 204 parte plus vite']),

    (24, 'TP4 · Événements', 'Un endpoint doit lire une chanson et la renvoyer tout de suite. Vous choisissez :',
     array['Un événement publié sur le bus d''événements (EOA)', 'Un appel direct, requête-réponse (SOA)', 'Un courtier de messages (RabbitMQ)', 'Un handler abonné à ChansonLueEvent'])

    ) as q(rang, theme, intitule, options);

  -- ── 3. Les bonnes réponses et le pourquoi ────────────────────────────────
  insert into public.modele_corriges (modele_id, cle, bonne, explication)
  select v_id, v_cle || '-' || lpad(q.rang::text, 2, '0'), q.bonne, q.expl
    from (values
    (1, 'B', 'Le constructeur s''exécute une fois, au new : il remplit les champs pour que l''objet naisse cohérent, sans étape oubliée.'),
    (2, 'D', 'Select transforme chaque élément (ici, une chanson devient son titre) ; il ne filtre rien. C''est Where qui filtre.'),
    (3, 'A', 'LINQ est paresseux : la requête est une recette, elle ne s''exécute qu''au moment où l''on en consomme le résultat — foreach, ToList(), Count()…'),
    (4, 'C', 'Les clés d''un Dictionary sont uniques. Add refuse un doublon ; c''est dico[3] = b qui remplacerait la valeur.'),
    (5, 'A', 'Les positions d''une List commencent à 0 : genres[0] vaut Rock, genres[1] vaut Jazz.'),
    (6, 'C', 'Any répond par oui ou non (un bool) : existe-t-il au moins un élément qui vérifie la condition ?'),
    (7, 'D', 'Chaque DbSet représente une table. On l''interroge en LINQ, et EF Core traduit en SQL.'),
    (8, 'B', 'Le DbContext suit les changements en mémoire (état Added) ; seul SaveChangesAsync() envoie l''INSERT à la base.'),
    (9, 'C', 'On ne touche jamais la base à la main : le modèle C# change, la migration le décrit, database update l''applique.'),
    (10, 'A', 'EF Core compare le modèle à la dernière migration : une valeur qui change à chaque fois est vue comme un changement à migrer.'),
    (11, 'B', 'La clé étrangère va toujours du côté « plusieurs » : chaque chanson pointe vers son unique artiste.'),
    (12, 'D', 'Une ligne a des colonnes fixes : elle ne peut pas porter une liste. La table de liaison décompose le N-N en deux 1-N, et peut porter la Position.'),
    (13, 'A', 'Créer une ressource répond 201, avec un en-tête Location vers la nouvelle chanson — c''est ce que fait CreatedAtAction.'),
    (14, 'C', 'La ressource demandée n''existe pas : erreur côté client (4xx), 404. Un 500 voudrait dire que le serveur a planté.'),
    (15, 'D', 'Répéter un POST crée une chanson de plus à chaque fois. Répéter un GET, un PUT ou un DELETE laisse le même état final — même si la réponse diffère (un second DELETE répond 404 : il n''y a plus rien à supprimer).'),
    (16, 'B', 'La base refuse la suppression (DbUpdateException) ; le Controller l''attrape et répond 409, avec le message « retirez-la d''abord » : la demande est correcte mais contredit l''état des données.'),
    (17, 'D', 'Le Controller ne parle qu''au DbContext ; le fournisseur de base (UseSqlite) se choisit à un seul endroit, et les migrations sont propres au moteur. C''est le couplage faible.'),
    (18, 'B', 'Le Controller ne crée pas ses dépendances : on les lui injecte. C''est ce qui permet, en test, d''injecter une base InMemory.'),
    (19, 'C', 'C''est le découplage : l''émetteur annonce ce qui est arrivé, sans connaître qui réagit.'),
    (20, 'A', 'Trois rôles : l''émetteur publie, le bus distribue, les abonnés (handlers) réagissent.'),
    (21, 'C', 'Tout l''intérêt de l''EOA : un comportement de plus = un abonné de plus, sans toucher à l''émetteur.'),
    (22, 'D', 'Un handler qui n''est pas abonné, ou abonné au mauvais type d''événement, n''est jamais appelé : le bus ne distribue qu''aux abonnés du type publié.'),
    (23, 'A', 'Un événement est un fait passé. Si SaveChangesAsync échoue (chanson dans une playlist), rien n''a été supprimé : rien à annoncer.'),
    (24, 'B', 'L''appelant attend le résultat pour répondre : c''est le « fais et réponds » du SOA. L''EOA sert aux effets de bord, qui peuvent se traiter après coup.')
    ) as q(rang, bonne, expl);

  -- ── 4. L'affectation au BTS2 SLAM — fermée, rattachée à rien ─────────────
  select id into v_classe from public.classes where code = 'BTS2-SLAM-2026';
  if v_classe is null then
    raise notice 'Pas de classe BTS2-SLAM-2026 : le modèle est créé, pas affecté.';
  else
    select id into v_s from public.seances
     where classe_id = v_classe and modele_id = v_id;
    if v_s is null then
      select min(g) into v_num
        from generate_series(90, 98) g
       where not exists (select 1 from public.seances s
                          where s.classe_id = v_classe and s.numero = g);
      if v_num is null then
        raise exception 'BTS2-SLAM-2026 : la bande 90-98 est pleine.';
      end if;
      insert into public.seances (classe_id, numero, titre, notee, ouverte,
                                  duree_min, nature, modele_id)
      values (v_classe, v_num, 'Réviser PlaylistApp — l''évaluation sur table',
              false, false, 0, 'questionnaire', v_id)
      returning id into v_s;
    end if;

    delete from public.corriges where seance_id = v_s;
    insert into public.corriges (seance_id, question, bonne_reponse, explication,
                                 intitule, options, theme)
    select v_s, q.cle, mc.bonne, mc.explication, q.intitule, q.options, q.theme
      from public.modele_questions q
      join public.modele_corriges mc on mc.modele_id = q.modele_id and mc.cle = q.cle
     where q.modele_id = v_id
     order by q.rang;
  end if;

  -- ── 5. Ce qui doit tenir ─────────────────────────────────────────────────
  select count(*) into v_n from public.modele_questions where modele_id = v_id;
  if v_n <> 24 then raise exception 'Réviser PlaylistApp : % questions, attendu 24', v_n; end if;
  select count(*) into v_n from public.modele_corriges where modele_id = v_id;
  if v_n <> 24 then raise exception 'Réviser PlaylistApp : % bonnes réponses, attendu 24', v_n; end if;

  select count(*) into v_n
    from public.modele_questions q
    join public.modele_corriges mc on mc.modele_id = q.modele_id and mc.cle = q.cle
   where q.modele_id = v_id
     and ascii(mc.bonne) - 64 > coalesce(array_length(q.options, 1), 0);
  if v_n > 0 then raise exception 'Réviser PlaylistApp : % bonne(s) réponse(s) hors des options', v_n; end if;

  select count(*) into v_n from public.modele_corriges
   where modele_id = v_id and coalesce(btrim(explication), '') = '';
  if v_n > 0 then raise exception 'Réviser PlaylistApp : % question(s) sans explication', v_n; end if;

  select max(k) into v_max from (
    select count(*) as k from public.modele_corriges where modele_id = v_id group by bonne) t;
  if v_max > 6 then
    raise exception 'Réviser PlaylistApp : une même lettre est bonne % fois sur 24', v_max;
  end if;

  -- Quatre thèmes de six : c'est ce qui rend le bilan comparable d'un TP à l'autre.
  select count(*) into v_n from (
    select theme from public.modele_questions where modele_id = v_id
     group by theme having count(*) = 6) t;
  if v_n <> 4 then raise exception 'Réviser PlaylistApp : les thèmes ne sont pas quatre fois six'; end if;

  -- Aucune question reprise du contrôle d'entrée ni de la révision POO.
  select count(*) into v_n
    from public.modele_questions q
   where q.modele_id = v_id
     and (exists (select 1 from public.modele_questions o
                   join public.modeles m on m.id = o.modele_id
                  where m.cle = 'revision-poo-tp1' and o.intitule = q.intitule)
          or exists (select 1 from public.corriges co
                      where co.question like 'pre-%' and co.intitule = q.intitule));
  if v_n > 0 then
    raise exception 'Réviser PlaylistApp : % question(s) reprise(s) d''un contrôle ou de la révision POO', v_n;
  end if;

  if v_s is not null then
    if (select count(*) from public.corriges where seance_id = v_s and theme is not null) <> 24 then
      raise exception 'Réviser PlaylistApp : le thème ne suit pas les questions dans les corrigés';
    end if;
    if (select ouverte from public.seances where id = v_s) and not exists (
         select 1 from public.reponses where seance_id = v_s) then
      -- Ouvert sans réponse, c'est qu'on l'a rejoué après l'avoir allumé :
      -- on ne l'éteint pas dans le dos de l'enseignant, on le dit.
      raise notice 'Réviser PlaylistApp : déjà proposé aux étudiants.';
    end if;
  end if;

  raise notice 'Réviser PlaylistApp : 24 questions, 4 thèmes, certitude demandée. '
               'FERMÉ — l''allumer depuis Préparer → Questionnaires.';
end $$;
