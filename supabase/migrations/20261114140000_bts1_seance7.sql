-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 7 DU BTS1 — « Tous les tests étaient verts »
--
--  Produit par outils/seances/seance06/generer.py depuis donnees.py (14/11).
--  Titre de récit, dix corrigés (q1…q10), le contrôle d'entrée (cinq notions
--  de la séance 5 — la 6 est reportée au S2 —, chacune doublée de sa
--  certitude), et le créneau : mercredi
--  25/11, 12 h – 13 h, ouverture et clôture automatiques.
--
--  Bonnes réponses : B D A C A B D C A D — 3 A, 2 B, 2 C, 3 D.
--
--  Les corrigés ne sont réécrits que si personne n'y a répondu ; le contrôle
--  d'entrée n'est jamais réécrit après une première réponse.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = 'Séance 7 - Tous les tests étaient verts : vulnérabilité, menace, risque'
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 7
   and s.titre is distinct from 'Séance 7 - Tous les tests étaient verts : vulnérabilité, menace, risque';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values
  (7, 'q1', 'B',
   'Quelle est la vulnérabilité dans l''histoire de mercredi ?',
   array['la personne qui a tapé la phrase piégée', 'le champ de recherche qui colle la saisie dans la requête', 'la liste de tous les clients, affichée d''un coup sur l''écran de Sami', 'le serveur qui héberge le site de DevSecure'],
   'La vulnérabilité est le défaut : la saisie collée telle quelle dans la requête. La personne est la menace, la fuite des clients l''impact.'),

  (7, 'q2', 'D',
   'Une faille très facile à exploiter, mais qui ne donne accès à rien d''important, a un risque :',
   array['maximal, puisqu''elle est très facile à exploiter', 'nul, puisqu''elle ne donne accès à rien', 'impossible à estimer sans une attaque réelle', 'moyen : forte vraisemblance, faible impact'],
   'Risque = vraisemblance × impact : 3 × 1 = 3, la case « moyen » de la matrice. On ne la néglige pas, on ne la traite pas en premier.'),

  (7, 'q3', 'A',
   'Qu''est-ce qu''une menace ?',
   array['ce qui peut exploiter une faille : une personne, un programme', 'le défaut présent dans le code, que personne n''a encore remarqué', 'la perte subie si la faille est exploitée', 'le correctif appliqué après l''attaque'],
   'La menace agit, la vulnérabilité laisse faire, l''impact est ce qu''on perd. Sans vulnérabilité, la menace ne peut rien.'),

  (7, 'q4', 'C',
   'Pourquoi la saisie « '' OR ''1''=''1 » renvoie-t-elle tous les projets ?',
   array['parce que la base de données est tombée en panne', 'parce que le mot OR est interdit dans une recherche', 'parce que la saisie devient une condition toujours vraie dans la requête', 'parce que le site affiche tout quand il ne trouve rien'],
   'L''apostrophe ferme le texte prévu ; la suite est lue comme du SQL. ''1''=''1'' est toujours vrai : chaque ligne passe le filtre.'),

  (7, 'q5', 'A',
   'Quelle est la parade à l''injection SQL ?',
   array['la requête paramétrée, qui envoie la saisie à part, comme une donnée', 'interdire les apostrophes et les guillemets dans tous les champs du site', 'cacher le champ de recherche aux visiteurs', 'afficher un message d''erreur moins détaillé'],
   'Avec une requête paramétrée, la saisie n''est jamais lue comme du code : on cherche le texte tel quel. Interdire des caractères casse les noms comme O''Brien et se contourne.'),

  (7, 'q6', 'B',
   'En changeant id=42 en id=43 dans l''adresse, Sami lit le rapport d''un autre client. Quelle est la faille ?',
   array['une injection SQL dans l''adresse', 'un contrôle d''accès absent sur le serveur', 'une bibliothèque vulnérable', 'un mot de passe trop court'],
   'Le serveur rend le rapport demandé sans vérifier que l''on a le droit de le lire. L''OWASP range ce défaut en tête de sa liste (A01).'),

  (7, 'q7', 'D',
   'Qu''est-ce qu''une attaque CSRF ?',
   array['un mot de passe deviné par essais successifs', 'un script glissé dans un commentaire, qui s''exécute chez chaque lecteur', 'une requête SQL modifiée par la saisie', 'une action déclenchée depuis un autre site, avec votre session ouverte'],
   'Le navigateur envoie votre session avec la requête, même si elle part d''une autre page. La parade : un jeton propre à chaque formulaire, que l''autre site ne connaît pas.'),

  (7, 'q8', 'C',
   'Log4Shell (2021) : pourquoi des milliers d''entreprises ont-elles été touchées sans avoir écrit le code fautif ?',
   array['parce qu''elles n''avaient aucun pare-feu', 'parce que leurs mots de passe étaient trop courts', 'parce qu''elles utilisaient une bibliothèque qui contenait la faille', 'parce que leurs serveurs étaient trop anciens'],
   'La faille était dans Log4j, une bibliothèque utilisée partout. Une faille qu''on n''a pas écrite reste notre faille : c''est la chaîne d''approvisionnement logicielle (A03).'),

  (7, 'q9', 'A',
   'Pourquoi tous les tests étaient-ils verts mercredi ?',
   array['ils vérifiaient ce que le site doit faire, pas ce qu''un attaquant tente', 'le pipeline avait été désactivé ce jour-là', 'les tests de sécurité ne peuvent pas tourner dans un pipeline automatique', 'Sami avait relancé les tests jusqu''à ce qu''ils passent'],
   'Un test ne vérifie que ce qu''on a pensé à vérifier. « refonte rend 3 projets » était vrai ; personne n''avait écrit « une saisie piégée ne rend rien ».'),

  (7, 'q10', 'D',
   'Que veut dire « sécurisé dès la conception » ?',
   array['ajouter un antivirus sur le serveur avant la mise en production', 'faire vérifier le site par un expert une fois par an', 'chiffrer toutes les pages du site', 'penser l''attaque en même temps que la fonction, et la tester comme elle'],
   'Pour chaque saisie : et si on tape autre chose que prévu ? Pour chaque identifiant : qui a le droit ? Les réponses deviennent des tests, que le pipeline relance.')
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

with q (cle, bonne, intitule, options, explication) as (values
    ('q1', 'B', 'Quelle est la vulnérabilité dans l''histoire de mercredi ?', array['la personne qui a tapé la phrase piégée', 'le champ de recherche qui colle la saisie dans la requête', 'la liste de tous les clients, affichée d''un coup sur l''écran de Sami', 'le serveur qui héberge le site de DevSecure'], 'La vulnérabilité est le défaut : la saisie collée telle quelle dans la requête. La personne est la menace, la fuite des clients l''impact.'),
    ('q2', 'D', 'Une faille très facile à exploiter, mais qui ne donne accès à rien d''important, a un risque :', array['maximal, puisqu''elle est très facile à exploiter', 'nul, puisqu''elle ne donne accès à rien', 'impossible à estimer sans une attaque réelle', 'moyen : forte vraisemblance, faible impact'], 'Risque = vraisemblance × impact : 3 × 1 = 3, la case « moyen » de la matrice. On ne la néglige pas, on ne la traite pas en premier.'),
    ('q3', 'A', 'Qu''est-ce qu''une menace ?', array['ce qui peut exploiter une faille : une personne, un programme', 'le défaut présent dans le code, que personne n''a encore remarqué', 'la perte subie si la faille est exploitée', 'le correctif appliqué après l''attaque'], 'La menace agit, la vulnérabilité laisse faire, l''impact est ce qu''on perd. Sans vulnérabilité, la menace ne peut rien.'),
    ('q4', 'C', 'Pourquoi la saisie « '' OR ''1''=''1 » renvoie-t-elle tous les projets ?', array['parce que la base de données est tombée en panne', 'parce que le mot OR est interdit dans une recherche', 'parce que la saisie devient une condition toujours vraie dans la requête', 'parce que le site affiche tout quand il ne trouve rien'], 'L''apostrophe ferme le texte prévu ; la suite est lue comme du SQL. ''1''=''1'' est toujours vrai : chaque ligne passe le filtre.'),
    ('q5', 'A', 'Quelle est la parade à l''injection SQL ?', array['la requête paramétrée, qui envoie la saisie à part, comme une donnée', 'interdire les apostrophes et les guillemets dans tous les champs du site', 'cacher le champ de recherche aux visiteurs', 'afficher un message d''erreur moins détaillé'], 'Avec une requête paramétrée, la saisie n''est jamais lue comme du code : on cherche le texte tel quel. Interdire des caractères casse les noms comme O''Brien et se contourne.'),
    ('q6', 'B', 'En changeant id=42 en id=43 dans l''adresse, Sami lit le rapport d''un autre client. Quelle est la faille ?', array['une injection SQL dans l''adresse', 'un contrôle d''accès absent sur le serveur', 'une bibliothèque vulnérable', 'un mot de passe trop court'], 'Le serveur rend le rapport demandé sans vérifier que l''on a le droit de le lire. L''OWASP range ce défaut en tête de sa liste (A01).'),
    ('q7', 'D', 'Qu''est-ce qu''une attaque CSRF ?', array['un mot de passe deviné par essais successifs', 'un script glissé dans un commentaire, qui s''exécute chez chaque lecteur', 'une requête SQL modifiée par la saisie', 'une action déclenchée depuis un autre site, avec votre session ouverte'], 'Le navigateur envoie votre session avec la requête, même si elle part d''une autre page. La parade : un jeton propre à chaque formulaire, que l''autre site ne connaît pas.'),
    ('q8', 'C', 'Log4Shell (2021) : pourquoi des milliers d''entreprises ont-elles été touchées sans avoir écrit le code fautif ?', array['parce qu''elles n''avaient aucun pare-feu', 'parce que leurs mots de passe étaient trop courts', 'parce qu''elles utilisaient une bibliothèque qui contenait la faille', 'parce que leurs serveurs étaient trop anciens'], 'La faille était dans Log4j, une bibliothèque utilisée partout. Une faille qu''on n''a pas écrite reste notre faille : c''est la chaîne d''approvisionnement logicielle (A03).'),
    ('q9', 'A', 'Pourquoi tous les tests étaient-ils verts mercredi ?', array['ils vérifiaient ce que le site doit faire, pas ce qu''un attaquant tente', 'le pipeline avait été désactivé ce jour-là', 'les tests de sécurité ne peuvent pas tourner dans un pipeline automatique', 'Sami avait relancé les tests jusqu''à ce qu''ils passent'], 'Un test ne vérifie que ce qu''on a pensé à vérifier. « refonte rend 3 projets » était vrai ; personne n''avait écrit « une saisie piégée ne rend rien ».'),
    ('q10', 'D', 'Que veut dire « sécurisé dès la conception » ?', array['ajouter un antivirus sur le serveur avant la mise en production', 'faire vérifier le site par un expert une fois par an', 'chiffrer toutes les pages du site', 'penser l''attaque en même temps que la fonction, et la tester comme elle'], 'Pour chaque saisie : et si on tape autre chose que prévu ? Pour chaque identifiant : qui a le droit ? Les réponses deviennent des tests, que le pipeline relance.')
)
update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = 7
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 7;
  if v_seance is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 7 en base';
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';
  if v_deja > 0 then
    raise notice 'Contrôle de la séance 7 : % réponse(s) déjà données, rien n''est réécrit.', v_deja;
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
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 7
   and s.demarree_le is null
   and (s.prevue_le is null or s.prevue_le < timestamptz '2026-11-19 00:00:00 Europe/Paris');

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 7 and co.question ~ '^q[0-9]+$'
     and co.intitule is not null and array_length(co.options, 1) = 4;
  if n <> 10 then raise exception 'séance 7 : % corrigés de quiz complets, 10 attendus', n; end if;

  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = 7 and co.question ~ '^q[0-9]+$'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une même lettre est bonne % fois sur 10 : motif repérable', n; end if;
end $$;
