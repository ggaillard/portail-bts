-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 4 DU BTS1 — l'arrivée des bases vectorielles (25/09/2026)
--
--  Produit par outils/seances/seance04/vectoriel.py. Les dix corrigés, réordonnés : la cascade, l'agile,
--  DevOps, commit, pull request, push, revert, puis deux questions sur la
--  base vectorielle, et le retournement.
--
--  Bonnes réponses : B A C B D C A B D D — deux A, trois B, deux C, trois D.
--
--  La séance 4 n'a pas encore été jouée : ses migrations d'origine (060000,
--  061000, 071000) sont appliquées, mais personne n'y a répondu. On les met à
--  jour ici — une migration appliquée ne se réécrit pas — et CHAQUE écriture
--  refuse de toucher à ce que des étudiants auraient déjà répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

update public.seances s
   set titre = 'Séance 4 - Ça marche sur mon poste : versionner le code et l''index'
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 4
   and not exists (select 1 from public.reponses r where r.seance_id = s.id);

with q (numero, cle, bonne, intitule, options, explication) as (values

  (4, 'q1', 'B',
   'Dans un cycle en cascade, quand découvre-t-on le plus souvent qu''on s''est trompé de besoin ?',
   array['au moment d''écrire le cahier des charges avec le client', 'à la fin, quand le client voit enfin le produit', 'à chaque itération de deux semaines', 'dès la première ligne de code écrite'],
   'Le client voit le produit à la fin. Une erreur de besoin commise au début se découvre quand tout est déjà construit.'),

  (4, 'q2', 'A',
   'Que cherche une méthode agile ?',
   array['livrer souvent, par petits morceaux, pour corriger tôt', 'livrer une seule fois, quand tout est entièrement terminé', 'suivre un plan fixé d''avance sans jamais le modifier', 'supprimer les réunions avec le client pour aller plus vite'],
   'De petites itérations montrées au client : une erreur de besoin coûte deux semaines, pas un an.'),

  (4, 'q3', 'C',
   'Quels sont les trois gestes de la culture DevOps vus dans cette séance ?',
   array['coder, tester, documenter', 'planifier, livrer, facturer', 'automatiser, mesurer, collaborer', 'sécuriser, chiffrer, sauvegarder chaque soir'],
   'Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d''une source unique du code.'),

  (4, 'q4', 'B',
   'Qu''est-ce qu''un commit ?',
   array['une copie du dossier envoyée par courriel à l''équipe', 'un instantané du projet, avec un auteur, une date et un message', 'une sauvegarde automatique du poste faite chaque nuit', 'un fichier renommé « version finale » dans le dossier partagé'],
   'Un instantané identifié, daté, signé et expliqué. Fini les fichiers « final_VRAI ».'),

  (4, 'q5', 'D',
   'À quoi sert une pull request ?',
   array['copier le dépôt d''un autre sur son propre poste', 'supprimer une branche devenue inutile', 'envoyer le code directement en production, sans passer par main', 'faire relire des changements avant de les fusionner'],
   'Une demande de fusion, relue et discutée avant d''être acceptée. La décision reste écrite dans l''histoire.'),

  (4, 'q6', 'C',
   'Thomas avait fait un commit de sa correction, et pourtant la production ne l''avait pas. Pourquoi ?',
   array['la production refuse tout commit fait le lundi', 'Git avait effacé la correction pendant la nuit', 'le commit était resté sur son poste, jamais poussé', 'la correction contenait elle-même une erreur de calcul'],
   'Un commit reste sur la machine où il est né tant qu''un push ne l''envoie pas au dépôt partagé.'),

  (4, 'q7', 'A',
   'Pour annuler un commit déjà partagé sans réécrire l''historique, on :',
   array['crée un nouveau commit qui défait le précédent', 'supprime le dépôt et on le recrée depuis zéro', 'modifie le fichier directement sur le serveur', 'demande à chacun d''effacer sa copie locale du dépôt'],
   'C''est git revert : on ajoute un commit qui défait, et l''on sait aussi qui est revenu en arrière, et pourquoi.'),

  (4, 'q8', 'B',
   'Pourquoi une base de données vectorielle retrouve-t-elle un document ?',
   array['il contient exactement les mêmes mots que la question', 'son vecteur est proche de celui de la question', 'il a été ajouté le plus récemment dans la base', 'son identifiant est égal à celui qu''on demande'],
   'Elle compare des sens, pas des mots : deux textes qui veulent dire la même chose donnent des vecteurs proches.'),

  (4, 'q9', 'D',
   'On change de modèle d''embedding. Que faut-il faire de l''index vectoriel ?',
   array['ne rien faire, les anciens vecteurs restent valables', 'recalculer seulement les documents ajoutés depuis', 'supprimer les documents les plus anciens de la base', 'recalculer tous les vecteurs avec le nouveau modèle'],
   'Deux modèles ne donnent pas les mêmes nombres : des vecteurs mélangés donnent des résultats absurdes, sans erreur visible.'),

  (4, 'q10', 'D',
   'Pourquoi « ça marche sur mon poste » ne prouve-t-il rien ?',
   array['parce que les postes des développeurs sont moins puissants que les serveurs', 'parce que Git ne fonctionne que sur un serveur', 'parce que les tests sont toujours faux sur un poste', 'parce que la production ne tourne pas avec ce qui est sur le poste'],
   'La production tourne avec ce qui est dans main. Ce qui n''a pas quitté le poste n''existe pour personne d''autre.')

)
update public.corriges co
   set bonne_reponse = q.bonne, intitule = q.intitule,
       options = q.options, explication = q.explication
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = q.numero
   and co.seance_id = s.id and co.question = q.cle
   -- La règle du 16/09 : on ne réécrit jamais après coup ce que des
   -- étudiants ont répondu. Une seule réponse au quiz, et rien ne bouge.
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question ~ '^q[0-9]+$');

do $$
declare n int; v_rep int;
begin
  select count(*) into v_rep from public.reponses r
    join public.seances s on s.id = r.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4 and r.question ~ '^q[0-9]+$';
  if v_rep > 0 then
    raise notice 'Séance 4 : % réponse(s) au quiz, les corrigés n''ont PAS été réécrits.', v_rep;
    return;
  end if;
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4
     and co.question = 'q8' and co.intitule like '%vectorielle%';
  if n <> 1 and exists (select 1 from public.seances s join public.classes c on c.id = s.classe_id
                         where c.code = 'BTS1-DEV-2026' and s.numero = 4) then
    raise exception 'séance 4 : la question 8 n''a pas été réécrite';
  end if;
end $$;
