-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 4 DU BTS1 — « Ça marche sur mon poste »
--
--  Titre de récit, dix corrigés, et le contrôle d'entrée qui précède la
--  séance (cinq notions de la séance 3, chacune doublée de sa certitude).
--
--  Écrit AVEC les accents : depuis le 18/09, c'est la règle — les textes de ce
--  fichier sont ce que trente étudiants lisent sur leur téléphone.
--
--  Les blocs 2 et 3 ne sont pas saisis à la main : ils sont produits par la
--  même liste Python, ce qui rend l'écart qui a touché la séance 3 (sept
--  questions sur dix différentes entre l'insert et le rattrapage) impossible
--  par construction. `coherence` le vérifie quand même.
--
--  Bonnes réponses : B D A C B A D C A D — trois A, deux B, deux C, trois D.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = 'Séance 4 - Ça marche sur mon poste : versionner le code'
  from public.classes c
 where c.id = s.classe_id
   and c.code = 'BTS1-DEV-2026'
   and s.numero = 4
   and s.titre not like 'Séance 4 - Ça marche%';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values

  (4, 'q1', 'B',
   'Dans un cycle en cascade, quand découvre-t-on le plus souvent qu''on s''est trompé de besoin ?',
   array['au moment d''écrire le cahier des charges avec le client', 'à la fin, quand le client voit enfin le produit', 'à chaque itération de deux semaines', 'dès la première ligne de code écrite'],
   'Le client voit le produit à la fin. Une erreur de besoin commise au début se découvre quand tout est déjà construit.'),

  (4, 'q2', 'D',
   'Qu''est-ce qui distingue le cycle en V de la cascade ?',
   array['il supprime complètement l''étape des tests', 'il livre une nouvelle version toutes les deux semaines', 'il confie la conception entière au client', 'chaque étape de conception a son test en miroir'],
   'Chaque étape de la descente a sa vérification préparée d''avance, sur la branche qui remonte.'),

  (4, 'q3', 'A',
   'Que cherche une méthode agile ?',
   array['livrer souvent, par petits morceaux, pour corriger tôt', 'livrer une seule fois, quand tout est entièrement terminé', 'suivre un plan fixé d''avance sans jamais le modifier', 'supprimer les réunions avec le client pour aller plus vite'],
   'De petites itérations montrées au client : une erreur de besoin coûte deux semaines, pas un an.'),

  (4, 'q4', 'C',
   'Quels sont les trois gestes de la culture DevOps vus dans cette séance ?',
   array['coder, tester, documenter', 'planifier, livrer, facturer', 'automatiser, mesurer, collaborer', 'sécuriser, chiffrer, sauvegarder chaque soir'],
   'Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d''une source unique du code.'),

  (4, 'q5', 'B',
   'Qu''est-ce qu''un commit ?',
   array['une copie du dossier envoyée par courriel à l''équipe', 'un instantané du projet, avec un auteur, une date et un message', 'une sauvegarde automatique du poste faite chaque nuit', 'un fichier renommé « version finale » dans le dossier partagé'],
   'Un instantané identifié, daté, signé et expliqué. Fini les fichiers « final_VRAI ».'),

  (4, 'q6', 'A',
   'Pourquoi travailler sur une branche ?',
   array['pour avancer sans toucher à la version principale', 'pour que le code s''exécute plus vite en production', 'pour empêcher les collègues de lire son travail', 'pour ne plus avoir besoin d''écrire de messages'],
   'On travaille à côté de main, qui part en production, et on ne fusionne que quand c''est prêt.'),

  (4, 'q7', 'D',
   'À quoi sert une pull request ?',
   array['copier le dépôt d''un autre sur son propre poste', 'supprimer une branche devenue inutile', 'envoyer le code directement en production, sans passer par main', 'faire relire des changements avant de les fusionner'],
   'Une demande de fusion, relue et discutée avant d''être acceptée. La décision reste écrite dans l''histoire.'),

  (4, 'q8', 'C',
   'Thomas avait fait un commit de sa correction, et pourtant la production ne l''avait pas. Pourquoi ?',
   array['la production refuse tout commit fait le lundi', 'Git avait effacé la correction pendant la nuit', 'le commit était resté sur son poste, jamais poussé', 'la correction contenait elle-même une erreur de calcul'],
   'Un commit reste sur la machine où il est né tant qu''un push ne l''envoie pas au dépôt partagé.'),

  (4, 'q9', 'A',
   'Pour annuler un commit déjà partagé sans réécrire l''historique, on :',
   array['crée un nouveau commit qui défait le précédent', 'supprime le dépôt et on le recrée depuis zéro', 'modifie le fichier directement sur le serveur', 'demande à chacun d''effacer sa copie locale du dépôt'],
   'C''est git revert : on ajoute un commit qui défait, et l''on sait aussi qui est revenu en arrière, et pourquoi.'),

  (4, 'q10', 'D',
   'Pourquoi « ça marche sur mon poste » ne prouve-t-il rien ?',
   array['parce que les postes des développeurs sont moins puissants que les serveurs', 'parce que Git ne fonctionne que sur un serveur', 'parce que les tests sont toujours faux sur un poste', 'parce que la production ne tourne pas avec ce qui est sur le poste'],
   'La production tourne avec ce qui est dans main. Ce qui n''a pas quitté le poste n''existe pour personne d''autre.')

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
    ('q1', 'B', 'Dans un cycle en cascade, quand découvre-t-on le plus souvent qu''on s''est trompé de besoin ?', array['au moment d''écrire le cahier des charges avec le client', 'à la fin, quand le client voit enfin le produit', 'à chaque itération de deux semaines', 'dès la première ligne de code écrite'], 'Le client voit le produit à la fin. Une erreur de besoin commise au début se découvre quand tout est déjà construit.'),
    ('q2', 'D', 'Qu''est-ce qui distingue le cycle en V de la cascade ?', array['il supprime complètement l''étape des tests', 'il livre une nouvelle version toutes les deux semaines', 'il confie la conception entière au client', 'chaque étape de conception a son test en miroir'], 'Chaque étape de la descente a sa vérification préparée d''avance, sur la branche qui remonte.'),
    ('q3', 'A', 'Que cherche une méthode agile ?', array['livrer souvent, par petits morceaux, pour corriger tôt', 'livrer une seule fois, quand tout est entièrement terminé', 'suivre un plan fixé d''avance sans jamais le modifier', 'supprimer les réunions avec le client pour aller plus vite'], 'De petites itérations montrées au client : une erreur de besoin coûte deux semaines, pas un an.'),
    ('q4', 'C', 'Quels sont les trois gestes de la culture DevOps vus dans cette séance ?', array['coder, tester, documenter', 'planifier, livrer, facturer', 'automatiser, mesurer, collaborer', 'sécuriser, chiffrer, sauvegarder chaque soir'], 'Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d''une source unique du code.'),
    ('q5', 'B', 'Qu''est-ce qu''un commit ?', array['une copie du dossier envoyée par courriel à l''équipe', 'un instantané du projet, avec un auteur, une date et un message', 'une sauvegarde automatique du poste faite chaque nuit', 'un fichier renommé « version finale » dans le dossier partagé'], 'Un instantané identifié, daté, signé et expliqué. Fini les fichiers « final_VRAI ».'),
    ('q6', 'A', 'Pourquoi travailler sur une branche ?', array['pour avancer sans toucher à la version principale', 'pour que le code s''exécute plus vite en production', 'pour empêcher les collègues de lire son travail', 'pour ne plus avoir besoin d''écrire de messages'], 'On travaille à côté de main, qui part en production, et on ne fusionne que quand c''est prêt.'),
    ('q7', 'D', 'À quoi sert une pull request ?', array['copier le dépôt d''un autre sur son propre poste', 'supprimer une branche devenue inutile', 'envoyer le code directement en production, sans passer par main', 'faire relire des changements avant de les fusionner'], 'Une demande de fusion, relue et discutée avant d''être acceptée. La décision reste écrite dans l''histoire.'),
    ('q8', 'C', 'Thomas avait fait un commit de sa correction, et pourtant la production ne l''avait pas. Pourquoi ?', array['la production refuse tout commit fait le lundi', 'Git avait effacé la correction pendant la nuit', 'le commit était resté sur son poste, jamais poussé', 'la correction contenait elle-même une erreur de calcul'], 'Un commit reste sur la machine où il est né tant qu''un push ne l''envoie pas au dépôt partagé.'),
    ('q9', 'A', 'Pour annuler un commit déjà partagé sans réécrire l''historique, on :', array['crée un nouveau commit qui défait le précédent', 'supprime le dépôt et on le recrée depuis zéro', 'modifie le fichier directement sur le serveur', 'demande à chacun d''effacer sa copie locale du dépôt'], 'C''est git revert : on ajoute un commit qui défait, et l''on sait aussi qui est revenu en arrière, et pourquoi.'),
    ('q10', 'D', 'Pourquoi « ça marche sur mon poste » ne prouve-t-il rien ?', array['parce que les postes des développeurs sont moins puissants que les serveurs', 'parce que Git ne fonctionne que sur un serveur', 'parce que les tests sont toujours faux sur un poste', 'parce que la production ne tourne pas avec ce qui est sur le poste'], 'La production tourne avec ce qui est dans main. Ce qui n''a pas quitté le poste n''existe pour personne d''autre.')
       ) as q(cle, bonne, intitule, options, explication),
       public.classes c,
       public.seances s
 where c.code = 'BTS1-DEV-2026'
   and s.classe_id = c.id
   and s.numero = 4
   and co.seance_id = s.id
   and co.question = q.cle
   and co.intitule is null;

-- ─── 4. Le contrôle d'entrée — ce qu'il reste de la séance 3 ───────────────
--  Les cinq concepts de « 60, 47, 72 », une question chacun, plus la question
--  de certitude posée dans les mêmes termes partout. Écrit par insert et non
--  par `creer_controle()`, qui exige `est_enseignant()` — ce qu'une migration
--  n'est pas. Créé FERMÉ : on l'ouvre depuis le portail le jour J.
--  Refuse d'écraser un contrôle auquel quelqu'un a déjà répondu.
do $$
declare v_seance bigint; v_deja int;
begin
  select s.id into v_seance
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  if v_seance is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 4 en base';
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';
  if v_deja > 0 then
    raise notice 'Contrôle de la séance 4 : % réponse(s) déjà données, rien n''est réécrit.', v_deja;
    return;
  end if;

  delete from public.corriges where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

    ('pre-01', 'B',
     'Dans une base relationnelle, à quoi sert une clé étrangère ?',
     array['À identifier une ligne sans doublon possible', 'À pointer vers la clé primaire d''une autre table', 'À chiffrer une colonne qui contient des données sensibles', 'À trier la table dans l''ordre alphabétique'],
     'La clé primaire identifie la ligne ; la clé étrangère pointe vers celle d''une autre table. C''est la flèche de la relation.'),

    ('pre-02', 'A',
     'Qu''échange-t-on en choisissant une base NoSQL documentaire ?',
     array['Des garanties, contre de la souplesse et du volume', 'De la souplesse, contre moins de volume stocké', 'Rien : seul le langage des requêtes change', 'De la vitesse, contre une place plus grande sur le disque'],
     'Le relationnel refuse ce qui ne rentre pas ; le NoSQL accepte et vous fait confiance. C''est un échange, pas un progrès.'),

    ('pre-03', 'D',
     'Les salaires et les contrats du personnel : où les ranger ?',
     array['Dans un lac de données, au cas où', 'Dans une base clé-valeur, comme un panier', 'Dans une base orientée graphe', 'Dans une base relationnelle'],
     'Des montants exacts et des transactions : on veut surtout des garanties, pas de la souplesse.'),

    ('pre-04', 'C',
     'Qu''est-ce qui distingue un entrepôt de données d''un lac ?',
     array['L''entrepôt garde tout, brut, au cas où', 'L''entrepôt n''accepte que des fichiers JSON', 'L''entrepôt range d''avance, pour des questions connues', 'L''entrepôt efface tout chaque dimanche soir'],
     'Le lac garde tout, brut ; l''entrepôt nettoie et range à l''avance les réponses aux questions qu''on sait déjà poser.'),

    ('pre-05', 'A',
     'Avant de croire un chiffre affiché, que faut-il demander d''abord ?',
     array['D''où il vient, et de quand il parle', 'Combien de décimales il affiche', 'Quelle couleur a le graphique qui le montre', 'Qui l''a affiché en premier dans l''équipe'],
     'Un chiffre sans date ni source n''est pas une information. 60, 47 et 72 étaient justes tous les trois.')

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
   where c.code = 'BTS1-DEV-2026' and s.numero = 4
     and co.question not like 'pre-%';
  if n <> 10 then raise exception 'séance 4 : % corrigés de quiz, attendu 10', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4
     and co.question not like 'pre-%'
     and (co.intitule is null or co.options is null or array_length(co.options, 1) <> 4);
  if n > 0 then raise exception '% corrigé(s) de la séance 4 sans intitulé ou sans 4 options', n; end if;

  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = 4 and co.question not like 'pre-%'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une même lettre est bonne % fois sur 10 : motif repérable', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4
     and co.question ~ '^pre-[0-9]+$';
  -- Pas d'exception ici : un contrôle déjà répondu est conservé tel quel,
  -- quel que soit son nombre de notions. Un état normal ne doit pas rendre
  -- la chaîne rouge.

  select s.titre into v_titre from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  raise notice 'Séance 4 : 10 corrigés, % notions de contrôle, titre « % ».', n, v_titre;
end $$;
