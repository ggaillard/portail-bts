-- ═══════════════════════════════════════════════════════════════════════════
--  QUESTIONS JALONS — trois par TP du parcours PlaylistApp
--
--  Une question d'entrée, une de mi-parcours, une de fin. La question de fin
--  est choisie pour qu'on ne puisse y répondre qu'en ayant réellement fait le
--  TP : c'est ce qui permet à l'étudiant de vérifier qu'il a tout fait, et à
--  vous de le voir, sans lui demander de cocher une case de plus.
--
--  Contenu adosse aux 29 missions : environnement, POO/LINQ/Docker, EF Core
--  et migrations, API REST et validation, architecture evenementielle.
--
--  À coller dans Supabase → SQL Editor → Run. Après PROJET.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La banque, posée sur les cinq séances de projet ────────────────────
with banque (tp, cle, intitule, options, bonne, explication) as (values

-- TP0 — Mise en place de l'environnement
(0, 'jalon-1', 'Quelle commande crée un nouveau projet console .NET ?',
 array['dotnet new console','dotnet run','dotnet build','dotnet add package'], 'A',
 'new cree le squelette ; run et build viennent ensuite.'),
(0, 'jalon-2', 'Où sont déclarées la version du framework et les dépendances du projet ?',
 array['Program.cs','appsettings.json','le fichier .csproj','launchSettings.json'], 'C',
 'Le .csproj est la carte d''identite du projet.'),
(0, 'jalon-fin', 'L''application affiche son menu dans la console. Quelle commande avez-vous lancée depuis le dossier PlaylistApp ?',
 array['dotnet test','dotnet restore','dotnet publish','dotnet run'], 'D',
 'run compile si necessaire puis execute.'),

-- TP1 — Console & POO
(1, 'jalon-1', 'Qu''est-ce qui distingue une classe d''un objet ?',
 array['La classe est le modèle, l''objet l''exemplaire créé à partir d''elle','Rien, ce sont deux mots pour la même chose','L''objet est le modèle, la classe l''exemplaire','La classe s''exécute, pas l''objet'], 'A',
 'La classe est le plan, l''objet ce qu''on construit avec.'),
(1, 'jalon-2', 'Pour trier une playlist par durée, quelle méthode LINQ utilisez-vous ?',
 array['Where','OrderBy','Select','GroupBy'], 'B',
 'Where filtre, Select projette, OrderBy ordonne.'),
(1, 'jalon-fin', 'Vous avez construit l''image Docker du TP1. Quelle instruction du Dockerfile désigne l''image de base .NET ?',
 array['RUN','COPY','FROM','ENTRYPOINT'], 'C',
 'FROM ouvre tout Dockerfile : c''est le socle sur lequel on construit.'),

-- TP2 — Entity Framework Core
(2, 'jalon-1', 'À quoi sert une migration Entity Framework ?',
 array['À sauvegarder les données','À faire évoluer le schéma de la base','À accélérer les requêtes','À déplacer le projet'], 'B',
 'La migration traduit un changement du modèle C# en changement de schéma.'),
(2, 'jalon-2', 'Quelle commande applique à la base les migrations en attente ?',
 array['dotnet ef migrations add','dotnet build','dotnet ef dbcontext info','dotnet ef database update'], 'D',
 'add cree la migration, database update l''applique.'),
(2, 'jalon-fin', 'Vous avez ajouté l''entité Artiste en relation 1-N. Quelle méthode charge un artiste avec ses chansons en une seule requête ?',
 array['Where','AsNoTracking','Attach','Include'], 'D',
 'Include charge la relation ; sans lui, la collection reste vide.'),

-- TP3 — API REST & SOA
(3, 'jalon-1', 'Dans une API REST, quel verbe HTTP lit une ressource sans la modifier ?',
 array['POST','DELETE','GET','PATCH'], 'C',
 'GET lit sans effet de bord ; POST cree, DELETE supprime.'),
(3, 'jalon-2', 'Votre API refuse une note invalide à la création. Quel code HTTP renvoie-t-elle ?',
 array['400 Bad Request','200 OK','201 Created','500 Internal Server Error'], 'A',
 '400 : la faute est dans la requete du client, pas dans le serveur.'),
(3, 'jalon-fin', 'Vous avez écrit GET /api/chansons/top/{n}. Quel attribut lie le segment {n} de l''URL au paramètre de la méthode ?',
 array['[FromBody]','[FromRoute]','[FromHeader]','[FromServices]'], 'B',
 'Le segment fait partie de la route : c''est [FromRoute].'),

-- TP4 — Architecture événementielle
(4, 'jalon-1', 'Dans une architecture événementielle, que fait un handler ?',
 array['Il publie l''événement','Il réagit à un événement publié','Il supprime l''événement','Il valide la requête HTTP'], 'B',
 'L''emetteur publie, le handler reagit.'),
(4, 'jalon-2', 'Quel est l''intérêt de publier un événement plutôt que d''appeler directement le code concerné ?',
 array['C''est plus rapide à l''exécution','Cela évite d''écrire des tests','L''émetteur n''a pas à connaître ses destinataires','Cela supprime les logs'], 'C',
 'Le couplage faible : on ajoute un handler sans toucher a l''emetteur.'),
(4, 'jalon-fin', 'Vous avez publié un événement à la suppression d''une chanson. Où en voyez-vous la trace la plus directe ?',
 array['Dans la base de données','Dans Swagger','Dans le fichier .csproj','Dans les logs, préfixés [AUDIT]'], 'D',
 'C''est la trace posee au TP4 : l''evenement s''observe d''abord dans les logs.')
)
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id, b.cle, b.bonne, b.explication, b.intitule, b.options
  from banque b
  join public.classes c on c.code = 'BTS2-SLAM-2026'
  join public.seances s on s.classe_id = c.id and s.numero = b.tp
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = b.cle);

-- ─── 2. Ne pas confondre une mission validée et une question répondue ──────
--  suivi_projet comptait toutes les reponses de la seance comme des jalons
--  franchis. Avec trois questions par TP, l'avancement depassait le nombre de
--  jalons, et une mission cochee « ko » comptait comme faite. On distingue.
create or replace function public.suivi_projet(p_seance_id bigint, p_jours_arret int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s      public.seances;
  v_jalons int;
  v_res    jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  select coalesce(v_s.jalons, nullif(max(c.faits), 0), 1) into v_jalons
    from (select count(*) filter (where reponse = 'ok') as faits
            from public.reponses where seance_id = v_s.id group by eleve_id) c;

  with avance as (
    select e.id, e.numero, e.avatar,
           -- Une mission n'est franchie que validee : « ko » ne compte pas.
           count(r.id) filter (where r.reponse = 'ok')                as faits,
           -- Les questions de jalon se comptent a part.
           count(r.id) filter (where r.question like 'jalon-%')       as questions,
           count(r.id) filter (where r.question like 'jalon-%'
                                and r.correct)                        as questions_ok,
           max(r.updated_at)                                          as dernier,
           min(r.updated_at)                                          as premier
      from public.eleves e
      left join public.reponses r on r.eleve_id = e.id and r.seance_id = v_s.id
     where e.classe_id = v_s.classe_id
     group by e.id, e.numero, e.avatar
  ),
  calcul as (
    select a.*,
           case when a.dernier is null then null
                else floor(extract(epoch from (now() - a.dernier)) / 86400)::int end as jours_sans,
           case when a.premier is null or a.faits = 0 then null
                else a.faits / greatest(
                       extract(epoch from (now() - a.premier)) / 86400, 1) end        as par_jour
      from avance a
  )
  select jsonb_build_object(
    'ok', true, 'nature', v_s.nature, 'jalons', v_jalons, 'echeance', v_s.echeance,
    'jours_restants', case when v_s.echeance is null then null
                           else (v_s.echeance - current_date) end,
    'repartition', coalesce((
       select jsonb_agg(jsonb_build_object('faits', faits, 'eleves', n) order by faits)
         from (select faits, count(*) as n from calcul group by faits) t), '[]'::jsonb),
    'arretes', coalesce((
       select jsonb_agg(jsonb_build_object(
                'numero', numero, 'avatar', avatar,
                'faits', faits, 'jours', jours_sans) order by jours_sans desc)
         from calcul where jours_sans is not null and jours_sans >= p_jours_arret), '[]'::jsonb),
    'jamais_commence', (select count(*) from calcul where faits = 0 and questions = 0),
    -- Ceux qui ont franchi tous les jalons ET repondu a la question de fin.
    'termine', (select count(*) from calcul where faits >= v_jalons),
    'question_fin_repondue', (select count(*) from calcul where questions >= 3),
    'en_risque', case when v_s.echeance is null then null else (
       select count(*) from calcul
        where faits > 0 and faits < v_jalons
          and coalesce(par_jour, 0) * greatest(v_s.echeance - current_date, 0)
              + faits < v_jalons) end,
    'eleves', (select count(*) from calcul)
  ) into v_res;

  return v_res;
end; $$;

grant execute on function public.suivi_projet(bigint, int) to authenticated;

-- ─── 3. Contrôle ───────────────────────────────────────────────────────────
select s.numero as tp, co.question, left(co.intitule, 60) as intitule, co.bonne_reponse
  from public.corriges co
  join public.seances s on s.id = co.seance_id
  join public.classes c on c.id = s.classe_id
 where c.code = 'BTS2-SLAM-2026' and co.question like 'jalon-%'
 order by s.numero, co.question;
