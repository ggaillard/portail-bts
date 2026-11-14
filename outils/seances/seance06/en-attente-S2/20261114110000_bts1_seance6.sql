-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 6 DU BTS1 — « Rouge, puis vert »
--
--  Produit par outils/seances/seance06/generer.py depuis donnees.py (14/11).
--  Titre de récit, dix corrigés (q1…q10), le contrôle d'entrée (cinq notions
--  de la séance 5, chacune doublée de sa certitude), et le créneau : mercredi
--  25/11, 12 h – 13 h, ouverture et clôture automatiques.
--
--  Bonnes réponses : C B D D A C A B C B — 2 A, 3 B, 3 C, 2 D.
--
--  Les corrigés ne sont réécrits que si personne n'y a répondu ; le contrôle
--  d'entrée n'est jamais réécrit après une première réponse.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = 'Séance 6 - Rouge, puis vert : votre premier pipeline'
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 6
   and s.titre is distinct from 'Séance 6 - Rouge, puis vert : votre premier pipeline';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values
  (6, 'q1', 'C',
   'Pourquoi créer votre dépôt depuis le modèle plutôt que travailler dans celui de l''enseignant ?',
   array['pour ne pas avoir à écrire de message de commit', 'parce que le dépôt modèle interdit de lire ses fichiers sans compte', 'pour avoir votre propre historique et votre propre pipeline', 'pour que vos commits partent dans le dépôt de l''enseignant'],
   'Même départ pour tous, mais un historique, des commits et un pipeline à soi. Le modèle ne bouge pas.'),

  (6, 'q2', 'B',
   'Dans votre fichier de workflow, quel bloc dit QUAND le pipeline se lance ?',
   array['le bloc steps, avec la liste des étapes', 'le bloc on, avec push et pull_request', 'la ligne runs-on, avec la machine', 'la ligne name, avec le titre du pipeline'],
   'on dit quand ; runs-on, sur quelle machine ; steps, quoi et dans quel ordre.'),

  (6, 'q3', 'D',
   'Pourquoi le pipeline installe-t-il les dépendances à chaque exécution ?',
   array['parce que pytest change de version à chaque commit', 'parce que GitHub efface votre dépôt après chaque test', 'parce que l''installation rend le code plus rapide', 'parce que la machine est neuve et ne contient que le dépôt'],
   'Chaque exécution part d''une machine neuve : ce qui n''est pas déclaré dans le dépôt n''existe pas pour elle. C''est la leçon de mardi, 17 h 52.'),

  (6, 'q4', 'D',
   'Votre premier pipeline porte une croix rouge. Qu''est-ce que cela veut dire ?',
   array['que GitHub a rencontré une panne sur ses serveurs', 'que le fichier de workflow contient une faute de frappe', 'que le dépôt doit être supprimé puis recréé', 'qu''une étape a échoué et que la suite n''a pas été lancée'],
   'Rouge veut dire stop : l''étape qui échoue arrête la chaîne. C''est une information, pas une panne.'),

  (6, 'q5', 'A',
   'Dans une ligne « assert X == Y » d''un journal de tests, que représente X ?',
   array['ce que la fonction a calculé pour les tâches du test', 'ce que le test attendait comme résultat pour ces tâches-là', 'le numéro de la ligne où se trouve l''erreur', 'le temps mis par le pipeline, en secondes'],
   'À gauche ce que le code a obtenu, à droite ce que le test attendait. L''écart dit où chercher.'),

  (6, 'q6', 'C',
   'Le test attend 75 % pour trois tâches faites, une annulée et une à faire. Quelle règle exprime-t-il ?',
   array['une tâche annulée compte comme une tâche faite, pour encourager', 'un projet n''atteint jamais cent pour cent', 'les tâches annulées ne comptent pas dans le calcul', 'le résultat est toujours arrondi à la dizaine'],
   '3 faites sur 4 qui comptent : l''annulée est mise de côté. C''est la règle écrite dans le commentaire de la fonction.'),

  (6, 'q7', 'A',
   'Où le pipeline a-t-il tourné quand vous avez proposé la correction ?',
   array['sur votre branche, avant toute fusion', 'sur votre poste, avant l''envoi', 'sur main uniquement, une fois la correction fusionnée', 'sur le dépôt modèle de l''enseignant'],
   'Le pull_request du bloc on lance le pipeline sur la branche proposée : la coche verte arrive avant la fusion.'),

  (6, 'q8', 'B',
   'Pourquoi passer par une pull request plutôt que modifier main directement ?',
   array['parce que GitHub ne permet pas de modifier main', 'pour voir la coche verte avant que la correction n''entre dans main', 'pour que la correction soit faite par une autre personne', 'parce qu''une pull request lance les tests plus vite'],
   'On ne fusionne que du vert : la pull request montre le résultat du pipeline avant que la correction ne touche main.'),

  (6, 'q9', 'C',
   'Thomas rend le pipeline vert en remplaçant 75 par 60 dans le test. Que faire en relecture ?',
   array['fusionner, puisque le pipeline est vert', 'relancer le pipeline pour vérifier qu''il reste vert', 'refuser : il a changé la règle au lieu de corriger le code', 'supprimer le test, qui gênait depuis trois semaines'],
   'Le vert ne prouve que ce que les tests vérifient. Modifier un test, c''est changer la règle : cela se discute, cela ne se fait pas pour faire taire une croix rouge.'),

  (6, 'q10', 'B',
   'Au fond, qu''avez-vous construit aujourd''hui ?',
   array['un programme qui trouve et corrige tout seul les erreurs dans le code', 'une machine qui vérifie chaque changement à partir du dépôt seul', 'une sauvegarde automatique du dépôt chaque nuit', 'un rapport que la direction remplit elle-même'],
   'Le pipeline ne corrige rien : il vérifie, à chaque changement, depuis le dépôt seul. Corriger reste votre travail.')
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

with q (cle, bonne, intitule, options, explication) as (values
    ('q1', 'C', 'Pourquoi créer votre dépôt depuis le modèle plutôt que travailler dans celui de l''enseignant ?', array['pour ne pas avoir à écrire de message de commit', 'parce que le dépôt modèle interdit de lire ses fichiers sans compte', 'pour avoir votre propre historique et votre propre pipeline', 'pour que vos commits partent dans le dépôt de l''enseignant'], 'Même départ pour tous, mais un historique, des commits et un pipeline à soi. Le modèle ne bouge pas.'),
    ('q2', 'B', 'Dans votre fichier de workflow, quel bloc dit QUAND le pipeline se lance ?', array['le bloc steps, avec la liste des étapes', 'le bloc on, avec push et pull_request', 'la ligne runs-on, avec la machine', 'la ligne name, avec le titre du pipeline'], 'on dit quand ; runs-on, sur quelle machine ; steps, quoi et dans quel ordre.'),
    ('q3', 'D', 'Pourquoi le pipeline installe-t-il les dépendances à chaque exécution ?', array['parce que pytest change de version à chaque commit', 'parce que GitHub efface votre dépôt après chaque test', 'parce que l''installation rend le code plus rapide', 'parce que la machine est neuve et ne contient que le dépôt'], 'Chaque exécution part d''une machine neuve : ce qui n''est pas déclaré dans le dépôt n''existe pas pour elle. C''est la leçon de mardi, 17 h 52.'),
    ('q4', 'D', 'Votre premier pipeline porte une croix rouge. Qu''est-ce que cela veut dire ?', array['que GitHub a rencontré une panne sur ses serveurs', 'que le fichier de workflow contient une faute de frappe', 'que le dépôt doit être supprimé puis recréé', 'qu''une étape a échoué et que la suite n''a pas été lancée'], 'Rouge veut dire stop : l''étape qui échoue arrête la chaîne. C''est une information, pas une panne.'),
    ('q5', 'A', 'Dans une ligne « assert X == Y » d''un journal de tests, que représente X ?', array['ce que la fonction a calculé pour les tâches du test', 'ce que le test attendait comme résultat pour ces tâches-là', 'le numéro de la ligne où se trouve l''erreur', 'le temps mis par le pipeline, en secondes'], 'À gauche ce que le code a obtenu, à droite ce que le test attendait. L''écart dit où chercher.'),
    ('q6', 'C', 'Le test attend 75 % pour trois tâches faites, une annulée et une à faire. Quelle règle exprime-t-il ?', array['une tâche annulée compte comme une tâche faite, pour encourager', 'un projet n''atteint jamais cent pour cent', 'les tâches annulées ne comptent pas dans le calcul', 'le résultat est toujours arrondi à la dizaine'], '3 faites sur 4 qui comptent : l''annulée est mise de côté. C''est la règle écrite dans le commentaire de la fonction.'),
    ('q7', 'A', 'Où le pipeline a-t-il tourné quand vous avez proposé la correction ?', array['sur votre branche, avant toute fusion', 'sur votre poste, avant l''envoi', 'sur main uniquement, une fois la correction fusionnée', 'sur le dépôt modèle de l''enseignant'], 'Le pull_request du bloc on lance le pipeline sur la branche proposée : la coche verte arrive avant la fusion.'),
    ('q8', 'B', 'Pourquoi passer par une pull request plutôt que modifier main directement ?', array['parce que GitHub ne permet pas de modifier main', 'pour voir la coche verte avant que la correction n''entre dans main', 'pour que la correction soit faite par une autre personne', 'parce qu''une pull request lance les tests plus vite'], 'On ne fusionne que du vert : la pull request montre le résultat du pipeline avant que la correction ne touche main.'),
    ('q9', 'C', 'Thomas rend le pipeline vert en remplaçant 75 par 60 dans le test. Que faire en relecture ?', array['fusionner, puisque le pipeline est vert', 'relancer le pipeline pour vérifier qu''il reste vert', 'refuser : il a changé la règle au lieu de corriger le code', 'supprimer le test, qui gênait depuis trois semaines'], 'Le vert ne prouve que ce que les tests vérifient. Modifier un test, c''est changer la règle : cela se discute, cela ne se fait pas pour faire taire une croix rouge.'),
    ('q10', 'B', 'Au fond, qu''avez-vous construit aujourd''hui ?', array['un programme qui trouve et corrige tout seul les erreurs dans le code', 'une machine qui vérifie chaque changement à partir du dépôt seul', 'une sauvegarde automatique du dépôt chaque nuit', 'un rapport que la direction remplit elle-même'], 'Le pipeline ne corrige rien : il vérifie, à chaque changement, depuis le dépôt seul. Corriger reste votre travail.')
)
update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = 6
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = q.cle);

-- ─── 3. Le contrôle d'entrée — ce qu'il reste de la séance 5 ───────────────
--  Écrit par insert et non par creer_controle(), qui exige est_enseignant().
--  Créé FERMÉ : on l'ouvre depuis le portail le jour J.
do $$
declare v_seance bigint; v_deja int;
begin
  select s.id into v_seance
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if v_seance is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 6 en base';
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';
  if v_deja > 0 then
    raise notice 'Contrôle de la séance 6 : % réponse(s) déjà données, rien n''est réécrit.', v_deja;
    return;
  end if;

  delete from public.corriges where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

    ('pre-01', 'A',
     'Mardi à 17 h 44, Noah a sauté trois lignes de sa check-list. Quelle leçon en tire-t-on ?',
     array['Ce qui se répète doit être fait par une machine', 'Il faut une check-list plus longue', 'Il faut mettre en production le matin', 'Il faut deux personnes pour lire la check-list'],
     'La check-list était bonne ; c''est la mémoire humaine qui lâche à 17 h 44. Une machine, elle, refait les mêmes gestes à chaque fois.'),

    ('pre-02', 'D',
     'Dans un pipeline, une étape échoue. Que deviennent les suivantes ?',
     array['Elles se lancent avec un avertissement', 'Elles se lancent si quelqu''un confirme', 'Elles sont rejouées jusqu''à devenir vertes', 'Elles ne sont pas lancées'],
     'Au premier rouge, la chaîne s''arrête : rien n''arrive en production.'),

    ('pre-03', 'A',
     'Quel test vérifie une seule fonction, isolée, en quelques millisecondes ?',
     array['Le test unitaire', 'Le test de bout en bout', 'Le test d''intégration', 'Le test en préproduction'],
     'Unitaire : une fonction, rien autour. Beaucoup de petits tests rapides, quelques grands tests lents.'),

    ('pre-04', 'C',
     'Quelle est la différence entre une image et un conteneur ?',
     array['Aucune, ce sont deux noms pour la même chose', 'L''image tourne sur le poste, le conteneur en production', 'L''image est le modèle figé, le conteneur l''image en marche', 'L''image est une archive, le conteneur une capture d''écran'],
     'Le colis plombé et le colis au travail : une image numérotée, autant de conteneurs qu''on veut.'),

    ('pre-05', 'B',
     'Dans le workflow de l''équipe de Noah, que veut dire « needs: tester » sous le travail livrer ?',
     array['tester attend que livrer soit terminé', 'livrer ne démarre que si tester est vert', 'un testeur humain doit valider avant de livrer', 'livrer et tester tournent en même temps'],
     'needs règle l''ordre : livrer attend tester, et ne part que si tout y est vert.')

    ) as q(cle, bonne, intitule, options, explication);

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris',
               'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, 5) as i;
end $$;

-- ─── 4. Le créneau : mercredi 25/11, 12 h – 13 h ───────────────────────────
--  L'automate (seances_a_l_heure) ouvre la séance à 12 h et la referme à
--  13 h 15. Seulement si elle n'a jamais été démarrée : une reprogrammation
--  faite depuis le portail n'est pas écrasée au rejeu.
update public.seances s
   set prevue_le   = timestamptz '2026-11-25 12:00:00 Europe/Paris',
       fin_prevue  = timestamptz '2026-11-25 13:00:00 Europe/Paris',
       auto_ouvrir = true,
       auto_clore  = true
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 6
   and s.demarree_le is null
   and (s.prevue_le is null or s.prevue_le < timestamptz '2026-11-19 00:00:00 Europe/Paris');

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6 and co.question ~ '^q[0-9]+$'
     and co.intitule is not null and array_length(co.options, 1) = 4;
  if n <> 10 then raise exception 'séance 6 : % corrigés de quiz complets, 10 attendus', n; end if;

  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = 6 and co.question ~ '^q[0-9]+$'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une même lettre est bonne % fois sur 10 : motif repérable', n; end if;
end $$;
