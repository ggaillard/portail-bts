-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 6 DU BTS1 — les questions au fil de l'heure
--
--  Produit par outils/seances/seance06/generer.py. Sept questions placées dans
--  les actes (blocs `!!! fil` de la trace), sur ce que l'étudiant a SOUS LES
--  YEUX dans son dépôt. Chacune suivie d'une certitude fNN-c, sans corrigé.
--  fil_seance() existe déjà (20261103210000) : rien à redéfinir.
--  Les corrigés ne sont réécrits que si personne n'y a répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with q (cle, bonne, intitule, options, explication) as (values
    ('f01', 'C', 'Dans la troisième règle du fichier de tests, combien de tâches comptent dans le calcul ?', array['5', '3', '4', '1'], 'Cinq tâches, dont une annulée mise de côté : il en reste quatre qui comptent, dont trois faites.'),
    ('f02', 'D', 'Quelle ligne de votre fichier fait tourner le pipeline aussi sur une correction proposée ?', array['la ligne runs-on', 'la ligne run: pytest', 'la ligne uses: actions/checkout', 'la ligne pull_request'], 'pull_request, dans le bloc on : le pipeline tourne sur la branche proposée, avant toute fusion.'),
    ('f03', 'B', 'Une étape est rouge. Qu''arrive-t-il à l''étape « Calculer l''avancement de la refonte » ?', array['elle tourne quand même', 'elle n''est pas lancée', 'elle affiche 0 %', 'elle est relancée jusqu''au vert'], 'Au premier rouge, la chaîne s''arrête : ce qui suit est grisé, pas lancé.'),
    ('f04', 'A', 'Dans la ligne AssertionError, le nombre à droite de == est :', array['ce que le test attendait', 'ce que le code a calculé', 'le nombre de tests passés', 'la durée de l''étape, en secondes'], 'À droite, l''attendu (75) ; à gauche, ce que le code a obtenu (60).'),
    ('f05', 'D', 'Sur les cinq tâches du test, par combien la dernière ligne du code divise-t-elle ?', array['3', '4', '1', '5'], 'len(taches) compte les cinq tâches, l''annulée comprise : 3 sur 5, soit 60.'),
    ('f06', 'B', 'Avant de fusionner, où voyez-vous que votre correction passe les tests ?', array['dans le dossier tests', 'au bas de la pull request, la coche verte', 'dans le README du dépôt', 'dans le dépôt modèle de l''enseignant'], '« All checks have passed » : le pipeline a tourné sur votre branche, la coche verte est sous la pull request.'),
    ('f07', 'A', 'Après la fusion, pourquoi le pipeline repart-il sur main ?', array['parce que la fusion est un push sur main', 'parce que GitHub relance tout chaque heure', 'parce que le test a changé', 'parce que la pull request a été fermée'], 'Une fusion ajoute un commit à main : c''est un push, et le bloc on le déclenche.')
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 6
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

with q (cle, bonne, intitule, options, explication) as (values
    ('f01', 'C', 'Dans la troisième règle du fichier de tests, combien de tâches comptent dans le calcul ?', array['5', '3', '4', '1'], 'Cinq tâches, dont une annulée mise de côté : il en reste quatre qui comptent, dont trois faites.'),
    ('f02', 'D', 'Quelle ligne de votre fichier fait tourner le pipeline aussi sur une correction proposée ?', array['la ligne runs-on', 'la ligne run: pytest', 'la ligne uses: actions/checkout', 'la ligne pull_request'], 'pull_request, dans le bloc on : le pipeline tourne sur la branche proposée, avant toute fusion.'),
    ('f03', 'B', 'Une étape est rouge. Qu''arrive-t-il à l''étape « Calculer l''avancement de la refonte » ?', array['elle tourne quand même', 'elle n''est pas lancée', 'elle affiche 0 %', 'elle est relancée jusqu''au vert'], 'Au premier rouge, la chaîne s''arrête : ce qui suit est grisé, pas lancé.'),
    ('f04', 'A', 'Dans la ligne AssertionError, le nombre à droite de == est :', array['ce que le test attendait', 'ce que le code a calculé', 'le nombre de tests passés', 'la durée de l''étape, en secondes'], 'À droite, l''attendu (75) ; à gauche, ce que le code a obtenu (60).'),
    ('f05', 'D', 'Sur les cinq tâches du test, par combien la dernière ligne du code divise-t-elle ?', array['3', '4', '1', '5'], 'len(taches) compte les cinq tâches, l''annulée comprise : 3 sur 5, soit 60.'),
    ('f06', 'B', 'Avant de fusionner, où voyez-vous que votre correction passe les tests ?', array['dans le dossier tests', 'au bas de la pull request, la coche verte', 'dans le README du dépôt', 'dans le dépôt modèle de l''enseignant'], '« All checks have passed » : le pipeline a tourné sur votre branche, la coche verte est sous la pull request.'),
    ('f07', 'A', 'Après la fusion, pourquoi le pipeline repart-il sur main ?', array['parce que la fusion est un push sur main', 'parce que GitHub relance tout chaque heure', 'parce que le test a changé', 'parce que la pull request a été fermée'], 'Une fusion ajoute un commit à main : c''est un push, et le bloc on le déclenche.')
)
update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = 6
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = q.cle);

do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6 and co.question ~ '^f[0-9]+$';
  if n <> 7 then raise exception 'séance 6 : % question(s) au fil, 7 attendues', n; end if;
end $$;
