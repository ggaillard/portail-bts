-- ═══════════════════════════════════════════════════════════════════════════
--  APPEL — la question du jour, et le suivi des absences
--
--  Principe : aucune table nouvelle. L'appel est une séance comme les autres,
--  numéro 99, ouverte en permanence, une par classe. Le 99 et non le 0 :
--  le BTS2 utilise déjà la séance 0 pour son TP0. Chaque jour de cours on y
--  ajoute UNE question, nommée « appel-AAAA-MM-JJ ». Y répondre, c'est être
--  présent ; l'absence est l'absence de réponse.
--
--  Conséquence : le tableau de bord enseignant, le calcul des séries et la vue
--  Répartition fonctionnent sans modification.
--
--  À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Deux colonnes facultatives sur les corrigés ────────────────────────
--  « intitule » vient d'INTITULES.sql ; on la crée ici aussi pour que ce
--  script suffise à lui seul. « options » porte le libellé des quatre choix :
--  laissée vide, le portail affiche simplement A, B, C, D — ce qui suffit
--  quand la question est projetée au tableau.
alter table public.corriges add column if not exists intitule text;
alter table public.corriges add column if not exists options  text[];

-- ─── 2. La séance d'appel, une fois pour toutes ────────────────────────────
insert into public.seances (classe_id, numero, titre, notee, ouverte)
select c.id, 99, 'Appel - question du jour', false, true
  from public.classes c
 where c.code in ('BTS1-DEV-2026', 'BTS2-SLAM-2026')
   and not exists (
     select 1 from public.seances s
      where s.classe_id = c.id and s.numero = 99);

-- ─── 3. La question du jour — à rejouer avant chaque séance ────────────────
--  UNE SEULE LIGNE À CHANGER : celle marquée « À MODIFIER ». On y met la
--  classe et le numéro de la séance qui commence. La banque plus bas fournit
--  une question par séance : facile, dix secondes, et elle réactive la séance
--  PRÉCÉDENTE — c'est ce qui fait qu'elle sert de mise en route et pas de test.
--  La date est prise automatiquement, et rejouer deux fois le même jour
--  n'écrase rien.
with choix (classe, seance_du_jour) as (
  values ('BTS1-DEV-2026'::text, 1::int)          -- <<< À MODIFIER
),
banque (classe, seance, intitule, options, bonne, explication) as (values

-- ····· BTS SIO 1 — Bloc 1 DEV · 14 séances ·································
('BTS1-DEV-2026', 1, 'Que désigne le sigle SI ?',
 array['Service Informatique','Système d''Information','Sécurité Informatique','Support Interne'], 'B',
 'SI = Système d''Information : des hommes, des procédures, des données, du logiciel et du matériel.'),
('BTS1-DEV-2026', 2, 'Le code d''une application relève de quel composant du SI ?',
 array['Le matériel','Les données','Le logiciel','Les procédures'], 'C',
 'Le code est du logiciel. Les données qu''il manipule sont un autre composant.'),
('BTS1-DEV-2026', 3, 'Qu''est-ce qui permet à une page web de se mettre à jour sans être rechargée ?',
 array['Une feuille de style','Un échange en temps réel avec le serveur','Un lien hypertexte','Une impression PDF'], 'B',
 'C''est tout l''écart entre le web statique et le web temps réel vu la semaine dernière.'),
('BTS1-DEV-2026', 4, 'Un data lake stocke des données...',
 array['brutes, telles qu''elles arrivent','déjà nettoyées pour l''analyse','uniquement chiffrées','seulement au format SQL'], 'A',
 'Le lac garde le brut ; c''est l''entrepôt qui range pour l''analyse.'),
('BTS1-DEV-2026', 5, 'Quelle commande Git enregistre vos modifications dans l''historique local ?',
 array['git status','git clone','git push','git commit'], 'D',
 'commit enregistre en local ; push envoie ensuite sur le dépôt distant.'),
('BTS1-DEV-2026', 6, 'À quoi sert un conteneur Docker ?',
 array['À chiffrer le code source','À embarquer l''application avec son environnement','À remplacer la base de données','À accélérer le réseau'], 'B',
 'Le conteneur emporte l''application et tout ce qu''il lui faut pour tourner.'),
('BTS1-DEV-2026', 7, 'Dans un pipeline d''intégration continue, que se passe-t-il si les tests échouent ?',
 array['Le pipeline s''arrête et signale l''échec','Le déploiement continue quand même','Les tests sont désactivés','Le code est corrigé automatiquement'], 'A',
 'C''est la raison d''être du pipeline : arrêter avant la mise en production.'),
('BTS1-DEV-2026', 8, 'Une faille non corrigée dans votre code, c''est...',
 array['une menace','un risque','une vulnérabilité','un incident'], 'C',
 'La vulnérabilité est la faiblesse ; la menace est ce qui pourrait l''exploiter.'),
('BTS1-DEV-2026', 9, 'Qu''est-ce qui fait passer une vulnérabilité en priorité haute ?',
 array['La date de sa découverte','Le langage du projet','Le nom du développeur','Son impact croisé avec sa probabilité'], 'D',
 'Impact x probabilité : c''est la logique de la cartographie DevSecure.'),
('BTS1-DEV-2026', 10, 'Sous quel délai le RGPD impose-t-il de notifier une violation de données ?',
 array['72 heures','24 heures','7 jours','30 jours'], 'A',
 '72 heures après en avoir pris connaissance, auprès de la CNIL.'),
('BTS1-DEV-2026', 11, 'Laquelle des quatre cultures Ops intègre la sécurité dès la conception ?',
 array['DevOps','DataOps','DevSecOps','MLOps'], 'C',
 'Secure by design : la sécurité est dans le cycle, pas ajoutée à la fin.'),
('BTS1-DEV-2026', 12, 'Dans un traitement ETL, que fait l''étape Transform ?',
 array['Elle copie les données telles quelles','Elle nettoie et met en forme les données','Elle supprime la base source','Elle chiffre les fichiers'], 'B',
 'Extract, Transform, Load : le nettoyage et la mise en forme sont au milieu.'),
('BTS1-DEV-2026', 13, 'Une donnée de mauvaise qualité en entrée d''un pipeline produit...',
 array['un résultat corrigé automatiquement','un pipeline plus rapide','un résultat faux en sortie','aucune conséquence'], 'C',
 'Garbage in, garbage out : la qualité en entrée décide de la sortie.'),
('BTS1-DEV-2026', 14, 'Que vise l''AI Act européen ?',
 array['Interdire toute intelligence artificielle','Encadrer les usages de l''IA selon leur niveau de risque','Taxer les modèles d''IA','Réserver l''IA aux administrations'], 'B',
 'Une approche par le risque : plus l''usage est risqué, plus les obligations sont fortes.'),

-- ····· BTS SIO 2 SLAM — PlaylistApp · 5 TP ································
('BTS2-SLAM-2026', 0, 'Quelle commande lance une application .NET en console ?',
 array['dotnet build','dotnet run','dotnet new','dotnet test'], 'B',
 'run compile si besoin puis exécute ; build se contente de compiler.'),
('BTS2-SLAM-2026', 1, 'Que fait la commande dotnet build ?',
 array['Elle exécute les tests','Elle compile le projet','Elle crée un dépôt Git','Elle publie sur GitHub'], 'B',
 'build compile. Les tests, c''est dotnet test.'),
('BTS2-SLAM-2026', 2, 'En POO, qu''est-ce qu''une classe ?',
 array['Un objet déjà créé en mémoire','Un modèle qui décrit des objets','Une méthode de tri','Un fichier de configuration'], 'B',
 'La classe est le plan ; l''objet est ce qu''on construit à partir du plan.'),
('BTS2-SLAM-2026', 3, 'À quoi sert une migration Entity Framework ?',
 array['À déplacer le projet sur un autre poste','À sauvegarder les données','À faire évoluer le schéma de la base','À accélérer les requêtes'], 'C',
 'La migration traduit un changement du modèle C# en changement de schéma.'),
('BTS2-SLAM-2026', 4, 'Dans une API REST, quel verbe HTTP sert à lire une ressource ?',
 array['POST','DELETE','GET','PATCH'], 'C',
 'GET lit sans rien modifier ; POST crée, DELETE supprime.')
)
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id,
       'appel-' || to_char(current_date, 'YYYY-MM-DD'),
       b.bonne, b.explication, b.intitule, b.options
  from choix ch
  join banque b        on b.classe = ch.classe and b.seance = ch.seance_du_jour
  join public.classes c on c.code = ch.classe
  join public.seances s on s.classe_id = c.id and s.numero = 99
 where not exists (
   select 1 from public.corriges co
    where co.seance_id = s.id
      and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD'));

-- ─── 4. Ce que le portail demande à l'ouverture de l'espace étudiant ───────
--  Renvoie la question du jour de SA classe, ou null s'il n'y en a pas.
--  security definer : l'étudiant n'a besoin d'aucun droit de lecture sur
--  corriges, et n'apprend jamais la bonne réponse avant d'avoir répondu.
create or replace function public.appel_du_jour()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve  public.eleves;
  v_seance public.seances;
  v_cor    public.corriges;
  v_rep    public.reponses;
  v_q      text := 'appel-' || to_char(current_date, 'YYYY-MM-DD');
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return null; end if;

  select * into v_seance from public.seances
   where classe_id = v_eleve.classe_id and numero = 99;
  if not found then return null; end if;

  select * into v_cor from public.corriges
   where seance_id = v_seance.id and question = v_q;
  if not found then return null; end if;

  select * into v_rep from public.reponses
   where eleve_id = v_eleve.id and seance_id = v_seance.id and question = v_q;

  return jsonb_build_object(
    'seance_id',  v_seance.id,
    'question',   v_q,
    'intitule',   coalesce(v_cor.intitule, 'Question du jour'),
    'options',    to_jsonb(v_cor.options),
    'repondu',    found,
    'ma_reponse', v_rep.reponse
  );
end; $$;

grant execute on function public.appel_du_jour() to anon, authenticated;

-- ─── 4 bis. L'appel du jour, pour le tableau de bord enseignant ────────────
--  Présents et absents de la classe pour l'appel d'aujourd'hui. Réservé à
--  l'enseignant ; renvoie des numéros et des avatars, jamais de nom ni de PIN.
create or replace function public.appel_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seance bigint;
  v_q text := 'appel-' || to_char(current_date, 'YYYY-MM-DD');
  v_intitule text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select id into v_seance from public.seances
   where classe_id = p_classe_id and numero = 99;
  if not found then return jsonb_build_object('ok', false, 'motif', 'pas_de_seance'); end if;

  select intitule into v_intitule from public.corriges
   where seance_id = v_seance and question = v_q;
  if not found then
    return jsonb_build_object('ok', true, 'pose', false);
  end if;

  return (
    with etat as (
      select e.numero, e.avatar, r.updated_at
        from public.eleves e
        left join public.reponses r
               on r.eleve_id = e.id and r.seance_id = v_seance and r.question = v_q
       where e.classe_id = p_classe_id
    )
    select jsonb_build_object(
      'ok', true, 'pose', true, 'intitule', v_intitule,
      'presents', coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar,
                     'heure', to_char(updated_at at time zone 'Europe/Paris', 'HH24:MI'))
                   order by updated_at) from etat where updated_at is not null), '[]'::jsonb),
      'absents',  coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar)
                   order by numero) from etat where updated_at is null), '[]'::jsonb))
  );
end; $$;

grant execute on function public.appel_classe(bigint) to authenticated;

-- ─── 5. Qui est là — une ligne par étudiant et par appel ───────────────────
create or replace view public.v_appel as
select c.code                                            as classe,
       to_date(right(co.question, 10), 'YYYY-MM-DD')     as jour,
       e.numero,
       e.avatar,
       (r.id is not null)                                as present,
       r.updated_at                                      as pointe_a
  from public.classes  c
  join public.seances  s  on s.classe_id = c.id and s.numero = 99
  join public.corriges co on co.seance_id = s.id and co.question like 'appel-%'
  join public.eleves   e  on e.classe_id = c.id
  left join public.reponses r
         on r.eleve_id = e.id and r.seance_id = s.id and r.question = co.question;

-- ─── 6. Les absences cumulées, séance après séance ─────────────────────────
create or replace view public.v_absences as
select classe,
       numero,
       avatar,
       count(*)                                          as appels,
       count(*) filter (where present)                   as presences,
       count(*) filter (where not present)               as absences,
       string_agg(to_char(jour, 'DD/MM'), ', ' order by jour)
         filter (where not present)                      as dates_manquees
  from public.v_appel
 group by classe, numero, avatar;

-- Ces deux vues sont un outil d'enseignant : jamais exposées aux étudiants.
revoke all on public.v_appel    from anon, authenticated;
revoke all on public.v_absences from anon, authenticated;

-- ─── 7. Les deux requêtes du quotidien ─────────────────────────────────────
--  L'appel du jour, en un coup d'œil
--    select numero, avatar, present, pointe_a
--      from public.v_appel
--     where classe = 'BTS1-DEV-2026' and jour = current_date
--     order by present, numero;
--
--  Le cumul des absences depuis la rentrée
--    select * from public.v_absences
--     where classe = 'BTS1-DEV-2026' and absences > 0
--     order by absences desc, numero;
