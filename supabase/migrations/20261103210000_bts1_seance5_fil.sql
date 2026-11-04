-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — les questions AU FIL DE L'HEURE, et leur lecture
--
--  Produit par outils/seances/seance05/fil.py. Sept questions placées dans
--  les actes, juste après le concept qu'elles vérifient (blocs `!!! fil` de
--  la trace). Chacune est suivie d'une certitude, `fNN-c`, SANS corrigé :
--  enregistrée, jamais comptée dans un taux.
--
--  fil_seance(p_seance_id) : pour l'enseignant, question par question, les
--  justes, et l'écart entre savoir et croire savoir — même lecture, mêmes
--  seuils (A/B = sûr, C/D = doute) que controle_seance(). Plus, par étudiant,
--  le nombre de questions faites : c'est l'avancement dans l'heure.
--
--  Les corrigés ne sont réécrits que si personne n'y a répondu.
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with q (cle, bonne, intitule, options, explication) as (values
    ('f01', 'B', 'Le build est vert, mais un test est rouge. Que reçoit la production ?', array['la nouvelle version, installée quand même', 'rien : la chaîne s''arrête avant le déploiement', 'la nouvelle version, sans ses tests', 'un build relancé jusqu''à ce qu''il passe'], 'Au premier rouge, la chaîne s''arrête : aucune étape ne passe tant que la précédente n''est pas verte.'),
    ('f02', 'C', 'Livraison continue, déploiement continu : qu''est-ce qui les sépare ?', array['le langage de programmation utilisé', 'le nombre de tests lancés à chaque push', 'un humain clique pour mettre en production, ou plus personne', 'le nombre de développeurs de l''équipe'], 'Livraison continue : la version est prête, un clic la met en production. Déploiement continu : même ce clic disparaît.'),
    ('f03', 'D', '« La page d''accueil s''affiche et montre 60 % » : de quel test s''agit-il ?', array['un test unitaire', 'un test d''intégration', 'un test de charge', 'un test de bout en bout'], 'Le parcours d''un utilisateur, comme dans un navigateur : c''est le test de bout en bout — celui qui aurait suffi mardi.'),
    ('f04', 'A', 'Qu''est-ce qu''un conteneur emporte avec le code ?', array['tout ce dont il a besoin pour tourner', 'le serveur entier, matériel compris', 'les données des utilisateurs', 'une copie du poste du développeur'], 'La bonne version de Python, les bibliothèques, la configuration : la boîte tourne pareil partout.'),
    ('f05', 'B', 'On lance trois exemplaires du rapport à partir de l''image 1.4. Combien y a-t-il d''images ?', array['trois', 'une seule', 'six', 'aucune'], 'Une image, trois conteneurs : on lance autant de conteneurs qu''on veut à partir d''un même modèle figé.'),
    ('f06', 'C', 'Dans le Dockerfile du rapport, quelle ligne fixe la version de Python ?', array['la ligne CMD', 'la ligne COPY', 'la ligne FROM', 'la ligne WORKDIR'], 'FROM python:3.12-slim : la version est écrite dans le fichier, ce n''est plus le serveur qui décide.'),
    ('f07', 'D', 'Dans le workflow, que veut dire « needs: tester » sous le travail livrer ?', array['livrer et tester tournent en même temps', 'livrer attend qu''un testeur humain valide', 'tester attend que livrer soit terminé', 'livrer ne démarre que si tester est vert'], 'needs règle l''ordre : livrer attend tester, et ne part que si tout y est vert.')
)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 5
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

update public.corriges co
   set intitule = q.intitule, options = q.options,
       explication = q.explication, bonne_reponse = q.bonne
  from (values
    ('f01', 'B', 'Le build est vert, mais un test est rouge. Que reçoit la production ?', array['la nouvelle version, installée quand même', 'rien : la chaîne s''arrête avant le déploiement', 'la nouvelle version, sans ses tests', 'un build relancé jusqu''à ce qu''il passe'], 'Au premier rouge, la chaîne s''arrête : aucune étape ne passe tant que la précédente n''est pas verte.'),
    ('f02', 'C', 'Livraison continue, déploiement continu : qu''est-ce qui les sépare ?', array['le langage de programmation utilisé', 'le nombre de tests lancés à chaque push', 'un humain clique pour mettre en production, ou plus personne', 'le nombre de développeurs de l''équipe'], 'Livraison continue : la version est prête, un clic la met en production. Déploiement continu : même ce clic disparaît.'),
    ('f03', 'D', '« La page d''accueil s''affiche et montre 60 % » : de quel test s''agit-il ?', array['un test unitaire', 'un test d''intégration', 'un test de charge', 'un test de bout en bout'], 'Le parcours d''un utilisateur, comme dans un navigateur : c''est le test de bout en bout — celui qui aurait suffi mardi.'),
    ('f04', 'A', 'Qu''est-ce qu''un conteneur emporte avec le code ?', array['tout ce dont il a besoin pour tourner', 'le serveur entier, matériel compris', 'les données des utilisateurs', 'une copie du poste du développeur'], 'La bonne version de Python, les bibliothèques, la configuration : la boîte tourne pareil partout.'),
    ('f05', 'B', 'On lance trois exemplaires du rapport à partir de l''image 1.4. Combien y a-t-il d''images ?', array['trois', 'une seule', 'six', 'aucune'], 'Une image, trois conteneurs : on lance autant de conteneurs qu''on veut à partir d''un même modèle figé.'),
    ('f06', 'C', 'Dans le Dockerfile du rapport, quelle ligne fixe la version de Python ?', array['la ligne CMD', 'la ligne COPY', 'la ligne FROM', 'la ligne WORKDIR'], 'FROM python:3.12-slim : la version est écrite dans le fichier, ce n''est plus le serveur qui décide.'),
    ('f07', 'D', 'Dans le workflow, que veut dire « needs: tester » sous le travail livrer ?', array['livrer et tester tournent en même temps', 'livrer attend qu''un testeur humain valide', 'tester attend que livrer soit terminé', 'livrer ne démarre que si tester est vert'], 'needs règle l''ordre : livrer attend tester, et ne part que si tout y est vert.')
       ) as q(cle, bonne, intitule, options, explication),
       public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = 5
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = q.cle);

create or replace function public.fil_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s public.seances;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  return (
    with eleves as (
      select e.id, e.numero from public.eleves e
       where e.classe_id = v_s.classe_id and e.numero <> '99'
    ),
    notions as (
      select co.question as cle, co.intitule, co.bonne_reponse
        from public.corriges co
       where co.seance_id = p_seance_id and co.question ~ '^f[0-9]+$'
    ),
    rep as (
      select r.question, r.reponse, e.numero, e.id as eleve_id
        from public.reponses r join eleves e on e.id = r.eleve_id
       where r.seance_id = p_seance_id and r.question ~ '^f[0-9]+(-c)?$'
    ),
    croise as (
      select n.cle,
             count(*) filter (where q.reponse is not null)                    as repondants,
             count(*) filter (where q.reponse = n.bonne_reponse)              as justes,
             count(*) filter (where q.reponse is not null
                               and q.reponse <> n.bonne_reponse
                               and c.reponse in ('A','B'))                    as surs_et_faux,
             count(*) filter (where q.reponse = n.bonne_reponse
                               and c.reponse in ('C','D'))                    as justes_mais_doutent,
             coalesce(jsonb_agg(e.numero order by e.numero)
                      filter (where q.reponse is not null
                              and q.reponse <> n.bonne_reponse
                              and c.reponse in ('A','B')), '[]'::jsonb)      as numeros_surs_et_faux
        from notions n
        cross join eleves e
        left join rep q on q.eleve_id = e.id and q.question = n.cle
        left join rep c on c.eleve_id = e.id and c.question = n.cle || '-c'
       group by n.cle
    ),
    avance as (
      select e.numero, count(distinct q.question) as faites
        from eleves e
        left join rep q on q.eleve_id = e.id and q.question ~ '^f[0-9]+$'
       group by e.numero
    )
    select jsonb_build_object(
      'ok', true, 'seance_id', v_s.id, 'numero', v_s.numero,
      'questions', (select count(*) from notions),
      'inscrits',  (select count(*) from eleves),
      'eleves', coalesce((select jsonb_agg(jsonb_build_object('numero', a.numero, 'faites', a.faites)
                                           order by a.numero) from avance a), '[]'::jsonb),
      'lignes', coalesce((select jsonb_agg(jsonb_build_object(
                    'cle', n.cle, 'intitule', n.intitule, 'bonne', n.bonne_reponse,
                    'repondants', c.repondants, 'justes', c.justes,
                    'surs_et_faux', c.surs_et_faux,
                    'justes_mais_doutent', c.justes_mais_doutent,
                    'numeros_surs_et_faux', c.numeros_surs_et_faux)
                  order by n.cle)
                  from notions n join croise c on c.cle = n.cle), '[]'::jsonb))
  );
end; $$;

revoke all on function public.fil_seance(bigint) from public;
grant execute on function public.fil_seance(bigint) to authenticated;

do $$
declare n int;
begin
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5 and co.question ~ '^f[0-9]+$';
  if n < 7 then raise exception 'séance 5 : % question(s) au fil, au moins 7 attendues', n; end if;
end $$;
