-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — « Mardi, 17 h 52 »
--
--  Titre de récit, dix corrigés, et le contrôle d'entrée qui précède la
--  séance (cinq notions de la séance 4, chacune doublée de sa certitude).
--
--  Écrit AVEC les accents : depuis le 18/09, c'est la règle — les textes de ce
--  fichier sont ce que trente étudiants lisent sur leur téléphone.
--
--  Les blocs 2 et 3 ne sont pas saisis à la main : ils sont produits par la
--  même liste Python, ce qui rend l'écart qui a touché la séance 3 (sept
--  questions sur dix différentes entre l'insert et le rattrapage) impossible
--  par construction. `coherence` le vérifie quand même.
--
--  Bonnes réponses : C A D B C A D B C A — 3 A, 2 B, 3 C, 2 D.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = 'Séance 5 - Mardi, 17 h 52 : la machine qui teste et qui livre'
  from public.classes c
 where c.id = s.classe_id
   and c.code = 'BTS1-DEV-2026'
   and s.numero = 5
   and s.titre not like 'Séance 5 - Mardi%';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values

  (5, 'q1', 'C',
   'Pourquoi une mise en production faite à la main est-elle risquée ?',
   array['elle consomme plus d''énergie sur le serveur', 'elle est interdite par le règlement européen', 'chaque geste repose sur la mémoire de quelqu''un', 'elle n''est possible qu''après les heures de cours'],
   'On oublie, on ne refait jamais pareil, on ne sait pas après coup ce qui a été fait. Mardi, trois lignes de la check-list ont sauté.'),

  (5, 'q2', 'A',
   'Que fait l''intégration continue ?',
   array['elle construit et teste le code à chaque push', 'elle livre le code au client à la fin du projet', 'elle fusionne toutes les branches à minuit', 'elle évite de relire les pull requests'],
   'CI : à chaque push, le code est construit et testé. On sait en quelques minutes si le changement casse quelque chose.'),

  (5, 'q3', 'D',
   'Dans un pipeline, une étape de test échoue. Que se passe-t-il ?',
   array['le déploiement continue, avec un avertissement', 'les tests sont relancés jusqu''à ce qu''ils passent', 'le code fautif est effacé du dépôt', 'la chaîne s''arrête et rien n''est déployé'],
   'Au premier rouge, la chaîne s''arrête. C''est ce qui aurait évité la page blanche de mardi.'),

  (5, 'q4', 'B',
   'Un test qui vérifie une seule fonction, isolée du reste, est un test :',
   array['de bout en bout', 'unitaire', 'de charge', 'd''intégration'],
   'Unitaire : une fonction, rien autour. L''intégration vérifie des morceaux qui se parlent, le bout en bout le parcours d''un utilisateur.'),

  (5, 'q5', 'C',
   'À quoi sert la préproduction ?',
   array['à garder une sauvegarde de la base de données', 'à héberger le site les jours de panne', 'à essayer la version sans les vrais utilisateurs', 'à ranger les anciennes versions du code'],
   'Une copie de la production, sans les vrais utilisateurs : si la version casse, elle casse devant l''équipe, pas devant le client.'),

  (5, 'q6', 'A',
   'Quelle est la différence entre une image et un conteneur ?',
   array['l''image est le modèle figé, le conteneur l''image en marche', 'l''image tourne sous Linux, le conteneur sous Windows', 'l''image contient le code, le conteneur contient les tests', 'aucune, ce sont deux noms pour la même chose'],
   'L''image est le colis plombé ; le conteneur, le colis ouvert et au travail. On lance autant de conteneurs qu''on veut à partir d''une image.'),

  (5, 'q7', 'D',
   'Que décrit un Dockerfile ?',
   array['la liste des utilisateurs autorisés', 'le réseau de l''entreprise', 'le planning des mises en production', 'les étapes pour fabriquer l''image'],
   'C''est la recette de l''image : partir de Python 3.12, copier, installer, lancer. Un fichier texte, qui se commite.'),

  (5, 'q8', 'B',
   'Pourquoi un conteneur règle-t-il la panne de Python de mardi ?',
   array['il rend le code plus rapide à exécuter', 'il emporte la bonne version de Python avec le code', 'il interdit d''installer Python sur le serveur', 'il traduit le code dans une version plus ancienne'],
   'La version est écrite dans le Dockerfile (FROM python:3.12-slim) : ce n''est plus le serveur qui décide, c''est l''image.'),

  (5, 'q9', 'C',
   'Dans un workflow GitHub Actions, que dit la partie « on » ?',
   array['sur quelle machine la chaîne tourne', 'quelles commandes la chaîne lance', 'quel événement déclenche la chaîne', 'qui a le droit de modifier la chaîne'],
   'on : quand ? Ici, un push sur main. runs-on dit sur quelle machine, steps quelles commandes.'),

  (5, 'q10', 'A',
   'L''assistant répétait 47. Qu''est-ce qui l''en empêche désormais ?',
   array['la reconstruction de l''index fait partie de la chaîne', 'un second assistant vérifie le premier', 'Léa reçoit une alerte chaque matin', 'un test interdit d''afficher le chiffre 47'],
   'L''index est fabriqué par un script : dans le workflow, personne n''a plus à s''en souvenir.')

)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── 3. Rattraper un corrigé présent mais vide ─────────────────────────────
update public.corriges co
   set intitule      = q.intitule,
       options       = q.options,
       explication   = q.explication,
       bonne_reponse = q.bonne
  from (values
    ('q1', 'C', 'Pourquoi une mise en production faite à la main est-elle risquée ?', array['elle consomme plus d''énergie sur le serveur', 'elle est interdite par le règlement européen', 'chaque geste repose sur la mémoire de quelqu''un', 'elle n''est possible qu''après les heures de cours'], 'On oublie, on ne refait jamais pareil, on ne sait pas après coup ce qui a été fait. Mardi, trois lignes de la check-list ont sauté.'),
    ('q2', 'A', 'Que fait l''intégration continue ?', array['elle construit et teste le code à chaque push', 'elle livre le code au client à la fin du projet', 'elle fusionne toutes les branches à minuit', 'elle évite de relire les pull requests'], 'CI : à chaque push, le code est construit et testé. On sait en quelques minutes si le changement casse quelque chose.'),
    ('q3', 'D', 'Dans un pipeline, une étape de test échoue. Que se passe-t-il ?', array['le déploiement continue, avec un avertissement', 'les tests sont relancés jusqu''à ce qu''ils passent', 'le code fautif est effacé du dépôt', 'la chaîne s''arrête et rien n''est déployé'], 'Au premier rouge, la chaîne s''arrête. C''est ce qui aurait évité la page blanche de mardi.'),
    ('q4', 'B', 'Un test qui vérifie une seule fonction, isolée du reste, est un test :', array['de bout en bout', 'unitaire', 'de charge', 'd''intégration'], 'Unitaire : une fonction, rien autour. L''intégration vérifie des morceaux qui se parlent, le bout en bout le parcours d''un utilisateur.'),
    ('q5', 'C', 'À quoi sert la préproduction ?', array['à garder une sauvegarde de la base de données', 'à héberger le site les jours de panne', 'à essayer la version sans les vrais utilisateurs', 'à ranger les anciennes versions du code'], 'Une copie de la production, sans les vrais utilisateurs : si la version casse, elle casse devant l''équipe, pas devant le client.'),
    ('q6', 'A', 'Quelle est la différence entre une image et un conteneur ?', array['l''image est le modèle figé, le conteneur l''image en marche', 'l''image tourne sous Linux, le conteneur sous Windows', 'l''image contient le code, le conteneur contient les tests', 'aucune, ce sont deux noms pour la même chose'], 'L''image est le colis plombé ; le conteneur, le colis ouvert et au travail. On lance autant de conteneurs qu''on veut à partir d''une image.'),
    ('q7', 'D', 'Que décrit un Dockerfile ?', array['la liste des utilisateurs autorisés', 'le réseau de l''entreprise', 'le planning des mises en production', 'les étapes pour fabriquer l''image'], 'C''est la recette de l''image : partir de Python 3.12, copier, installer, lancer. Un fichier texte, qui se commite.'),
    ('q8', 'B', 'Pourquoi un conteneur règle-t-il la panne de Python de mardi ?', array['il rend le code plus rapide à exécuter', 'il emporte la bonne version de Python avec le code', 'il interdit d''installer Python sur le serveur', 'il traduit le code dans une version plus ancienne'], 'La version est écrite dans le Dockerfile (FROM python:3.12-slim) : ce n''est plus le serveur qui décide, c''est l''image.'),
    ('q9', 'C', 'Dans un workflow GitHub Actions, que dit la partie « on » ?', array['sur quelle machine la chaîne tourne', 'quelles commandes la chaîne lance', 'quel événement déclenche la chaîne', 'qui a le droit de modifier la chaîne'], 'on : quand ? Ici, un push sur main. runs-on dit sur quelle machine, steps quelles commandes.'),
    ('q10', 'A', 'L''assistant répétait 47. Qu''est-ce qui l''en empêche désormais ?', array['la reconstruction de l''index fait partie de la chaîne', 'un second assistant vérifie le premier', 'Léa reçoit une alerte chaque matin', 'un test interdit d''afficher le chiffre 47'], 'L''index est fabriqué par un script : dans le workflow, personne n''a plus à s''en souvenir.')
       ) as q(cle, bonne, intitule, options, explication),
       public.classes c,
       public.seances s
 where c.code = 'BTS1-DEV-2026'
   and s.classe_id = c.id
   and s.numero = 5
   and co.seance_id = s.id
   and co.question = q.cle
   and co.intitule is null;

-- ─── 4. Le contrôle d'entrée — ce qu'il reste de la séance 4 ───────────────
--  Les cinq concepts de « Ça marche sur mon poste », une question chacun, plus la question
--  de certitude posée dans les mêmes termes partout. Écrit par insert et non
--  par `creer_controle()`, qui exige `est_enseignant()` — ce qu'une migration
--  n'est pas. Créé FERMÉ : on l'ouvre depuis le portail le jour J.
--  Refuse d'écraser un contrôle auquel quelqu'un a déjà répondu.
do $$
declare v_seance bigint; v_deja int;
begin
  select s.id into v_seance
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_seance is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 5 en base';
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';
  if v_deja > 0 then
    raise notice 'Contrôle de la séance 5 : % réponse(s) déjà données, rien n''est réécrit.', v_deja;
    return;
  end if;

  delete from public.corriges where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

    ('pre-01', 'C',
     'Quel cycle de vie livre souvent, par petites itérations, pour corriger tôt ?',
     array['La cascade', 'Le cycle en V', 'L''agile', 'Aucun des trois'],
     'L''agile livre toutes les deux à quatre semaines : une erreur de besoin coûte deux semaines, pas un an.'),

    ('pre-02', 'A',
     'Quels sont les trois gestes de la culture DevOps ?',
     array['Automatiser, mesurer, collaborer', 'Coder, tester, documenter', 'Planifier, livrer, facturer', 'Sécuriser, chiffrer, sauvegarder'],
     'Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d''une source unique du code.'),

    ('pre-03', 'D',
     'Thomas a fait un commit, mais la production ne l''a jamais eu. Que manquait-il ?',
     array['Un merge de main dans sa branche', 'Un message de commit plus clair', 'Un revert du commit précédent', 'Un push vers le dépôt partagé'],
     'Un commit reste sur la machine où il est né tant qu''un push ne l''envoie pas au dépôt partagé.'),

    ('pre-04', 'B',
     'À quoi sert une pull request ?',
     array['À copier le dépôt d''un autre sur son poste', 'À faire relire des changements avant de les fusionner', 'À envoyer le code en production sans passer par main', 'À supprimer une branche devenue inutile'],
     'Une demande de fusion, relue et discutée avant d''être acceptée. La décision reste écrite dans l''histoire.'),

    ('pre-05', 'A',
     'Une base vectorielle retrouve un document parce que :',
     array['son vecteur est proche de celui de la question', 'il contient exactement les mots de la question', 'il est le plus récent de la base', 'son identifiant est celui qu''on demande'],
     'Elle compare des sens, pas des mots ; et son index, fabriqué par un modèle, se versionne avec lui.')

    ) as q(cle, bonne, intitule, options, explication);

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris',
               'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, 5) as i;
end $$;

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int; v_titre text;
begin
  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5
     and co.question not like 'pre-%';
  if n <> 10 then raise exception 'séance 5 : % corrigés de quiz, attendu 10', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5
     and co.question not like 'pre-%'
     and (co.intitule is null or co.options is null or array_length(co.options, 1) <> 4);
  if n > 0 then raise exception '% corrigé(s) de la séance 5 sans intitulé ou sans 4 options', n; end if;

  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = 5 and co.question not like 'pre-%'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une même lettre est bonne % fois sur 10 : motif repérable', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5
     and co.question ~ '^pre-[0-9]+$';
  -- Pas d'exception ici : un contrôle déjà répondu est conservé tel quel,
  -- quel que soit son nombre de notions. Un état normal ne doit pas rendre
  -- la chaîne rouge.

  select s.titre into v_titre from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  raise notice 'Séance 5 : 10 corrigés, % notions de contrôle, titre « % ».', n, v_titre;
end $$;
