-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 7 DU BTS1 — les questions au fil de l'heure
--
--  Produit par outils/seances/seance06/generer.py. Sept questions placées dans
--  les actes (blocs `!!! fil` de la trace), juste après la notion qu'elles
--  vérifient. Chacune suivie d'une certitude fNN-c, sans corrigé.
--  fil_seance() existe déjà (20261103210000) : rien à redéfinir.
--  Les corrigés ne sont réécrits que si personne n'y a répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with q (cle, bonne, intitule, options, explication) as (values
    ('f01', 'C', 'Le champ de recherche colle la saisie telle quelle dans la requête. C''est :', array['une menace', 'un impact', 'une vulnérabilité', 'un risque'], 'C''est le défaut du code : la vulnérabilité. La personne qui en profite est la menace.'),
    ('f02', 'A', 'Vraisemblance 3, impact 3 : où se place ce risque dans la matrice ?', array['élevé', 'moyen', 'faible', 'hors de la matrice'], '3 × 3 = 9, la case la plus haute : à traiter en premier.'),
    ('f03', 'D', 'Avec la saisie « refonte », combien de projets la recherche rend-elle, d''après le journal ?', array['aucun', '2 314', 'un seul', 'trois'], 'Trois résultats à 10 h 31 min 07 : la recherche fait son travail. C''est la saisie suivante qui pose problème.'),
    ('f04', 'B', 'Dans la requête paramétrée, que devient la saisie « '' OR ''1''=''1 » ?', array['une condition toujours vraie', 'un simple texte, cherché tel quel', 'une erreur qui arrête le site', 'une requête supprimée par la base'], 'Elle est envoyée à part, comme une donnée : la base cherche un mot-clé qui s''écrirait ainsi, et n''en trouve aucun.'),
    ('f05', 'A', 'Qui doit vérifier que l''utilisateur a le droit de lire le rapport 43 ?', array['le serveur, à chaque demande', 'le navigateur de l''utilisateur', 'l''utilisateur lui-même', 'personne : l''adresse est difficile à deviner'], 'Le navigateur et l''adresse sont entre les mains de l''utilisateur : seul le serveur peut refuser.'),
    ('f06', 'C', 'Un commentaire contient un script qui s''exécute chez chaque lecteur. Dans quelle famille l''OWASP le range-t-il ?', array['le contrôle d''accès', 'la chaîne d''approvisionnement logicielle', 'l''injection', 'les défaillances cryptographiques'], 'Le XSS est une injection : du code glissé dans une donnée, exécuté cette fois dans la page du lecteur.'),
    ('f07', 'D', 'Le test de l''attaque est écrit dans le dépôt. Quand sera-t-il relancé ?', array['une fois par an, lors de l''audit', 'seulement si Sami y pense', 'jamais : un test ne tourne qu''une fois', 'à chaque push, avec les autres tests'], 'C''est le pipeline de la séance 5 : chaque push relance tous les tests, ceux de l''attaque compris.')
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 7
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

with q (cle, bonne, intitule, options, explication) as (values
    ('f01', 'C', 'Le champ de recherche colle la saisie telle quelle dans la requête. C''est :', array['une menace', 'un impact', 'une vulnérabilité', 'un risque'], 'C''est le défaut du code : la vulnérabilité. La personne qui en profite est la menace.'),
    ('f02', 'A', 'Vraisemblance 3, impact 3 : où se place ce risque dans la matrice ?', array['élevé', 'moyen', 'faible', 'hors de la matrice'], '3 × 3 = 9, la case la plus haute : à traiter en premier.'),
    ('f03', 'D', 'Avec la saisie « refonte », combien de projets la recherche rend-elle, d''après le journal ?', array['aucun', '2 314', 'un seul', 'trois'], 'Trois résultats à 10 h 31 min 07 : la recherche fait son travail. C''est la saisie suivante qui pose problème.'),
    ('f04', 'B', 'Dans la requête paramétrée, que devient la saisie « '' OR ''1''=''1 » ?', array['une condition toujours vraie', 'un simple texte, cherché tel quel', 'une erreur qui arrête le site', 'une requête supprimée par la base'], 'Elle est envoyée à part, comme une donnée : la base cherche un mot-clé qui s''écrirait ainsi, et n''en trouve aucun.'),
    ('f05', 'A', 'Qui doit vérifier que l''utilisateur a le droit de lire le rapport 43 ?', array['le serveur, à chaque demande', 'le navigateur de l''utilisateur', 'l''utilisateur lui-même', 'personne : l''adresse est difficile à deviner'], 'Le navigateur et l''adresse sont entre les mains de l''utilisateur : seul le serveur peut refuser.'),
    ('f06', 'C', 'Un commentaire contient un script qui s''exécute chez chaque lecteur. Dans quelle famille l''OWASP le range-t-il ?', array['le contrôle d''accès', 'la chaîne d''approvisionnement logicielle', 'l''injection', 'les défaillances cryptographiques'], 'Le XSS est une injection : du code glissé dans une donnée, exécuté cette fois dans la page du lecteur.'),
    ('f07', 'D', 'Le test de l''attaque est écrit dans le dépôt. Quand sera-t-il relancé ?', array['une fois par an, lors de l''audit', 'seulement si Sami y pense', 'jamais : un test ne tourne qu''une fois', 'à chaque push, avec les autres tests'], 'C''est le pipeline de la séance 5 : chaque push relance tous les tests, ceux de l''attaque compris.')
)
update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = 7
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = q.cle);

do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 7 and co.question ~ '^f[0-9]+$';
  if n <> 7 then raise exception 'séance 7 : % question(s) au fil, 7 attendues', n; end if;
end $$;
