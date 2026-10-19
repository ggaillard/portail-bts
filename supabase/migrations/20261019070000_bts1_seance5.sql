-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — « Mardi, 14 h 02 »
--
--  Titre de récit, dix corrigés, et le contrôle d'entrée qui précède la
--  séance (cinq notions de la séance 4, chacune doublée de sa certitude).
--
--  Produit par outils/seances/seance05/generer.py : ne pas retoucher à la
--  main, changer la liste Python et relancer.
--
--  Écrit AVEC les accents : depuis le 18/09, c'est la règle — les textes de ce
--  fichier sont ce que trente étudiants lisent sur leur téléphone.
--
--  Les blocs 2 et 3 ne sont pas saisis à la main : ils sont produits par la
--  même liste Python, ce qui rend l'écart qui a touché la séance 3 (sept
--  questions sur dix différentes entre l'insert et le rattrapage) impossible
--  par construction. `coherence` le vérifie quand même.
--
--  Bonnes réponses : B C A D A D B C A C — 3 A, 2 B, 3 C, 2 D.
--
--  Depuis la séance 5, la grille des réponses n'est PLUS dans la trace
--  écrite (dépôt public) : c'est ce fichier, et lui seul, qui fait foi pour
--  la bonne lettre. `controler.py` lit la grille ici quand la page n'en a pas.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = 'Séance 5 - Mardi, 14 h 02 : tester et livrer sans s''en souvenir'
  from public.classes c
 where c.id = s.classe_id
   and c.code = 'BTS1-DEV-2026'
   and s.numero = 5
   and s.titre not like 'Séance 5 - Mardi%';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values

  (5, 'q1', 'B',
   'Mardi, qu''aurait fait l''intégration continue au moment du push de Thomas ?',
   array['elle aurait recopié tel quel le poste de Thomas sur le serveur de production', 'elle aurait reconstruit le projet sur une machine propre et lancé les tests', 'elle aurait envoyé un courriel à Maya pour lui rappeler de tester', 'elle aurait attendu la fin de la journée pour tout livrer ensemble'],
   'La CI reconstruit le projet depuis le dépôt seul, sur une machine propre : pandas absent du dépôt, le test casse à 13 h 40, pas la page d''accueil à 14 h 02.'),

  (5, 'q2', 'C',
   'Dans le pipeline du lendemain, les tests unitaires sont rouges. Que deviennent les étapes suivantes ?',
   array['elles se lancent quand même, mais en affichant un avertissement', 'elles se lancent seulement si Thomas confirme par un clic', 'elles ne sont pas lancées, et rien n''arrive en production', 'elles sont rejouées automatiquement jusqu''à devenir vertes'],
   'Rouge veut dire stop : l''étape qui échoue arrête la chaîne. Construire l''image et déployer restent « pas lancé ».'),

  (5, 'q3', 'A',
   'Quel test vérifie une seule fonction, isolée, en quelques millisecondes ?',
   array['le test unitaire', 'le test de bout en bout', 'le test d''intégration', 'le test en préproduction'],
   'Le test unitaire : une fonction, aucune base, aucun écran. Le bas de la pyramide, celui qu''on écrit en nombre.'),

  (5, 'q4', 'D',
   'À quoi sert la préproduction ?',
   array['à stocker les anciennes versions qui ne servent plus', 'à faire tourner les tests unitaires plus vite que sur le poste du développeur', 'à remplacer la production pendant la nuit', 'à essayer la version sur une copie de la production avant les clients'],
   'Une copie de la production, avec de fausses données : si ça casse, ça casse là, pas devant 9 400 utilisateurs.'),

  (5, 'q5', 'A',
   'Quelle est la différence entre une image et un conteneur ?',
   array['l''image est le modèle figé, le conteneur une exécution de ce modèle', 'l''image est une capture d''écran, le conteneur une archive', 'l''image tourne seulement sur le poste, le conteneur seulement en production', 'aucune, ce sont deux noms pour la même chose'],
   'L''image est le moule, fabriqué une fois et versionné ; chaque conteneur est un gâteau sorti de ce moule.'),

  (5, 'q6', 'D',
   'Dans le Dockerfile de DevSecure, quelle ligne aurait évité l''erreur de pandas, à condition que pandas soit dans requirements.txt ?',
   array['la ligne 1, qui sélectionne la version de Python à utiliser', 'la ligne 5, qui copie le code de l''équipe dans l''image', 'la ligne 6, qui démarre l''application au lancement', 'la ligne 4, qui installe les dépendances dans l''image'],
   'La ligne 4 installe dans l''image ce que requirements.txt déclare. La ligne 5 copie le code, pas les bibliothèques du poste.'),

  (5, 'q7', 'B',
   'Pourquoi peut-on lancer un conteneur à chaque push, alors qu''on ne le ferait pas avec une machine virtuelle ?',
   array['parce qu''un conteneur n''a besoin d''aucun système pour tourner', 'parce qu''il partage le noyau de l''hôte : léger, il démarre en une seconde', 'parce qu''un conteneur ne peut contenir qu''un seul fichier', 'parce que GitHub interdit les machines virtuelles dans ses pipelines'],
   'Une machine virtuelle embarque un système entier ; un conteneur partage le noyau de l''hôte. Quelques mégaoctets, une seconde.'),

  (5, 'q8', 'C',
   'Dans le fichier de Maya, que dit le bloc on, avec push et branches main ?',
   array['le système d''exploitation de la machine sur laquelle le pipeline tourne', 'la liste des étapes, dans l''ordre où elles s''exécutent', 'ce qui déclenche le pipeline : un push sur la branche main', 'le nom de l''image construite à la fin'],
   'on dit QUAND : un push sur main. runs-on choisit la machine, steps liste les étapes.'),

  (5, 'q9', 'A',
   'L''assistant répondait toujours 47. Qu''est-ce qui règle ce second oubli ?',
   array['un pipeline qui reconstruit l''index dès qu''un document ou le modèle change', 'un message de Léa à l''équipe chaque lundi matin', 'un assistant plus puissant, qui devine les nouveaux chiffres', 'la suppression des anciens comptes rendus de la base'],
   'Ce qui doit être refait à chaque changement est écrit dans un pipeline : l''index se reconstruit tout seul, avec le modèle noté dans le dépôt.'),

  (5, 'q10', 'C',
   'Au fond, qu''est-ce qui a manqué mardi à 14 h 02 ?',
   array['un serveur plus puissant pour la page d''accueil', 'un développeur plus prudent que Thomas', 'une machine qui teste et livre à partir du dépôt seul', 'une sauvegarde de la base faite chaque soir'],
   'Personne n''a menti : il manquait une machine qui ne fait confiance qu''au dépôt, et qui n''oublie jamais de tester.')

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
    ('q1', 'B', 'Mardi, qu''aurait fait l''intégration continue au moment du push de Thomas ?', array['elle aurait recopié tel quel le poste de Thomas sur le serveur de production', 'elle aurait reconstruit le projet sur une machine propre et lancé les tests', 'elle aurait envoyé un courriel à Maya pour lui rappeler de tester', 'elle aurait attendu la fin de la journée pour tout livrer ensemble'], 'La CI reconstruit le projet depuis le dépôt seul, sur une machine propre : pandas absent du dépôt, le test casse à 13 h 40, pas la page d''accueil à 14 h 02.'),
    ('q2', 'C', 'Dans le pipeline du lendemain, les tests unitaires sont rouges. Que deviennent les étapes suivantes ?', array['elles se lancent quand même, mais en affichant un avertissement', 'elles se lancent seulement si Thomas confirme par un clic', 'elles ne sont pas lancées, et rien n''arrive en production', 'elles sont rejouées automatiquement jusqu''à devenir vertes'], 'Rouge veut dire stop : l''étape qui échoue arrête la chaîne. Construire l''image et déployer restent « pas lancé ».'),
    ('q3', 'A', 'Quel test vérifie une seule fonction, isolée, en quelques millisecondes ?', array['le test unitaire', 'le test de bout en bout', 'le test d''intégration', 'le test en préproduction'], 'Le test unitaire : une fonction, aucune base, aucun écran. Le bas de la pyramide, celui qu''on écrit en nombre.'),
    ('q4', 'D', 'À quoi sert la préproduction ?', array['à stocker les anciennes versions qui ne servent plus', 'à faire tourner les tests unitaires plus vite que sur le poste du développeur', 'à remplacer la production pendant la nuit', 'à essayer la version sur une copie de la production avant les clients'], 'Une copie de la production, avec de fausses données : si ça casse, ça casse là, pas devant 9 400 utilisateurs.'),
    ('q5', 'A', 'Quelle est la différence entre une image et un conteneur ?', array['l''image est le modèle figé, le conteneur une exécution de ce modèle', 'l''image est une capture d''écran, le conteneur une archive', 'l''image tourne seulement sur le poste, le conteneur seulement en production', 'aucune, ce sont deux noms pour la même chose'], 'L''image est le moule, fabriqué une fois et versionné ; chaque conteneur est un gâteau sorti de ce moule.'),
    ('q6', 'D', 'Dans le Dockerfile de DevSecure, quelle ligne aurait évité l''erreur de pandas, à condition que pandas soit dans requirements.txt ?', array['la ligne 1, qui sélectionne la version de Python à utiliser', 'la ligne 5, qui copie le code de l''équipe dans l''image', 'la ligne 6, qui démarre l''application au lancement', 'la ligne 4, qui installe les dépendances dans l''image'], 'La ligne 4 installe dans l''image ce que requirements.txt déclare. La ligne 5 copie le code, pas les bibliothèques du poste.'),
    ('q7', 'B', 'Pourquoi peut-on lancer un conteneur à chaque push, alors qu''on ne le ferait pas avec une machine virtuelle ?', array['parce qu''un conteneur n''a besoin d''aucun système pour tourner', 'parce qu''il partage le noyau de l''hôte : léger, il démarre en une seconde', 'parce qu''un conteneur ne peut contenir qu''un seul fichier', 'parce que GitHub interdit les machines virtuelles dans ses pipelines'], 'Une machine virtuelle embarque un système entier ; un conteneur partage le noyau de l''hôte. Quelques mégaoctets, une seconde.'),
    ('q8', 'C', 'Dans le fichier de Maya, que dit le bloc on, avec push et branches main ?', array['le système d''exploitation de la machine sur laquelle le pipeline tourne', 'la liste des étapes, dans l''ordre où elles s''exécutent', 'ce qui déclenche le pipeline : un push sur la branche main', 'le nom de l''image construite à la fin'], 'on dit QUAND : un push sur main. runs-on choisit la machine, steps liste les étapes.'),
    ('q9', 'A', 'L''assistant répondait toujours 47. Qu''est-ce qui règle ce second oubli ?', array['un pipeline qui reconstruit l''index dès qu''un document ou le modèle change', 'un message de Léa à l''équipe chaque lundi matin', 'un assistant plus puissant, qui devine les nouveaux chiffres', 'la suppression des anciens comptes rendus de la base'], 'Ce qui doit être refait à chaque changement est écrit dans un pipeline : l''index se reconstruit tout seul, avec le modèle noté dans le dépôt.'),
    ('q10', 'C', 'Au fond, qu''est-ce qui a manqué mardi à 14 h 02 ?', array['un serveur plus puissant pour la page d''accueil', 'un développeur plus prudent que Thomas', 'une machine qui teste et livre à partir du dépôt seul', 'une sauvegarde de la base faite chaque soir'], 'Personne n''a menti : il manquait une machine qui ne fait confiance qu''au dépôt, et qui n''oublie jamais de tester.')
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
     'Dans quel cycle de vie découvre-t-on une erreur de besoin au bout de deux semaines, et non à la fin ?',
     array['Dans la cascade', 'Dans le cycle en V', 'Dans une méthode agile', 'Dans aucun des trois'],
     'L''agile livre par petites itérations montrées au client : l''erreur coûte deux semaines, pas un an.'),

    ('pre-02', 'A',
     'Quels sont les trois gestes de la culture DevOps ?',
     array['Automatiser, mesurer, collaborer', 'Coder, tester, documenter', 'Planifier, livrer, facturer', 'Sécuriser, chiffrer, sauvegarder'],
     'Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d''une source unique du code.'),

    ('pre-03', 'D',
     'Thomas a fait un commit de sa correction. Que manque-t-il pour que l''équipe la voie ?',
     array['Un merge dans sa propre branche', 'Un nouveau message de commit', 'Une copie du fichier renommée « finale »', 'Un push vers le dépôt partagé'],
     'Un commit reste sur la machine où il est né tant qu''un push ne l''envoie pas au dépôt partagé.'),

    ('pre-04', 'B',
     'À quoi sert une pull request ?',
     array['À copier le dépôt d''un collègue sur son poste', 'À faire relire des changements avant de les fusionner', 'À envoyer le code en production sans passer par main', 'À effacer une branche et son historique'],
     'Une demande de fusion, relue et discutée avant d''être acceptée : la décision reste écrite dans l''histoire.'),

    ('pre-05', 'A',
     'On change de modèle d''embedding. Que faut-il faire de l''index vectoriel ?',
     array['Recalculer tous les vecteurs avec le nouveau modèle', 'Ne rien faire, les anciens vecteurs restent valables', 'Recalculer seulement les documents ajoutés depuis', 'Supprimer les documents les plus anciens'],
     'Deux modèles ne donnent pas les mêmes nombres : des vecteurs mélangés donnent des résultats absurdes, sans erreur visible.')

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
