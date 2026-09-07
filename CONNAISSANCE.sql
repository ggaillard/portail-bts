-- ═══════════════════════════════════════════════════════════════════════════
--  FAISONS CONNAISSANCE — le questionnaire de rentrée BTS1
--
--  Douze questions posées une seule fois, en début d'année, pour savoir qui
--  on a en face : d'où ils viennent, avec quoi ils travaillent, ce qu'ils
--  visent, comment ils apprennent. Aucune n'a de bonne réponse — la
--  bonne_reponse vaut « Z », qui n'existe pas, exactement comme l'humeur :
--  rien ne compte dans le taux de réussite.
--
--  C'est la séance 98 de la classe. 99 est l'appel, 98 la connaissance :
--  deux numéros hauts, hors de la progression, que le BTS2 n'utilise pas.
--
--  L'étudiant y répond depuis le portail, une question à la fois, après
--  l'appel. L'enseignant lit les réponses dans la carte « Faisons
--  connaissance » : la répartition par question, et surtout QUI a répondu
--  quoi — c'est ce qui permet de repérer celui qui n'a pas d'ordinateur.
--
--  À coller dans Supabase → SQL Editor → Run. Après SEANCE.sql et PROJET.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La séance 98, pour la ou les classes concernées ────────────────────
--  Une seule ligne à modifier : le code de la classe.
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min, nature)
select c.id, 98, 'Faisons connaissance', false, true, 20, 'cours'
  from public.classes c
 where c.code in ('BTS1-DEV-2026')          -- <<< À MODIFIER
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = 98);

-- ─── 2. Les douze questions ────────────────────────────────────────────────
--  Trois par thème : parcours, conditions de travail, projection, façon
--  d'apprendre. L'ordre des clés est l'ordre de passage.
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id, q.cle, 'Z',
       'Merci — cette réponse ne compte pas dans vos résultats.',
       q.intitule, q.options
  from public.seances s
  cross join (values

  -- ── Parcours et niveau en informatique ──
  ('conn-01',
   'Quel bac avez-vous obtenu ?',
   array['Bac général avec spécialité maths ou NSI',
         'Bac général, autres spécialités',
         'Bac technologique (STMG, STI2D…)',
         'Bac professionnel, ou un autre parcours']),

  ('conn-02',
   'Avant ce BTS, aviez-vous déjà écrit du code ?',
   array['Jamais',
         'Un peu, tout seul (tutos, Scratch, un petit site)',
         'Oui, en cours (SNT, NSI, un projet de bac)',
         'Oui, régulièrement, sur mes propres projets']),

  ('conn-03',
   'La ligne de commande et Git, ça vous parle ?',
   array['Je n''en ai jamais entendu parler',
         'J''en ai entendu parler, je n''ai jamais essayé',
         'J''ai déjà tapé quelques commandes',
         'Je m''en sers sans difficulté']),

  -- ── Conditions de travail ──
  ('conn-04',
   'Pour travailler chez vous, vous disposez de :',
   array['Un ordinateur qui est à moi seul',
         'Un ordinateur partagé avec la famille',
         'Seulement un téléphone ou une tablette',
         'Rien pour l''instant']),

  ('conn-05',
   'Votre connexion internet à la maison :',
   array['Bonne et stable',
         'Correcte, parfois lente',
         'Faible, ou des coupures fréquentes',
         'Pas de connexion fixe (je partage celle du téléphone)']),

  ('conn-06',
   'Combien de temps pensez-vous pouvoir travailler hors des cours, par semaine ?',
   array['Moins d''une heure',
         'De 1 à 3 heures',
         'De 3 à 6 heures',
         'Plus de 6 heures']),

  -- ── Objectifs et projection ──
  ('conn-07',
   'Pourquoi avoir choisi le BTS SIO ?',
   array['Pour le développement, créer des applications',
         'Pour les réseaux, les serveurs, la cybersécurité',
         'Pour un diplôme en informatique, sans idée précise',
         'C''est une orientation par défaut, je ne sais pas encore']),

  ('conn-08',
   'Aujourd''hui, vous vous voyez plutôt en :',
   array['SLAM — développement d''applications',
         'SISR — infrastructure, réseaux, systèmes',
         'J''hésite entre les deux',
         'Aucune idée, j''attends de voir']),

  ('conn-09',
   'Après le BTS, vous imaginez plutôt :',
   array['Poursuivre mes études (licence, école)',
         'Entrer dans la vie active',
         'Une alternance ou un apprentissage',
         'Je n''y ai pas encore réfléchi']),

  -- ── Façon d'apprendre ──
  ('conn-10',
   'Qu''est-ce qui vous aide le plus à comprendre ?',
   array['Un exemple traité pas à pas devant moi',
         'Un TP guidé que je refais moi-même',
         'Une consigne courte, et me débrouiller',
         'En parler, travailler à deux']),

  ('conn-11',
   'Quand vous bloquez plus de dix minutes, vous faites quoi ?',
   array['Je demande au professeur',
         'Je demande à un camarade',
         'Je cherche seul (internet, IA)',
         'Je m''arrête et j''attends']),

  ('conn-12',
   'Qu''est-ce qui vous inquiète le plus pour cette année ?',
   array['Le niveau en maths, la logique',
         'La charge de travail et le rythme',
         'Parler, présenter à l''oral',
         'Rien de particulier pour l''instant'])

  ) as q(cle, intitule, options)
 where s.numero = 98
   and not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── 3. Côté étudiant — les questions et là où il en est ───────────────────
--  Renvoie tout d'un coup : le portail affiche la première sans réponse.
--  Une classe sans séance 98 renvoie null, et le portail n'affiche rien.
create or replace function public.connaissance()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve  public.eleves;
  v_seance bigint;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return null; end if;

  select id into v_seance from public.seances
   where classe_id = v_eleve.classe_id and numero = 98 and ouverte;
  if not found then return null; end if;

  return (
    select jsonb_build_object(
      'seance_id', v_seance,
      'total',     count(*),
      'faites',    count(r.reponse),
      'questions', coalesce(jsonb_agg(jsonb_build_object(
                     'question',   co.question,
                     'intitule',   co.intitule,
                     'options',    to_jsonb(co.options),
                     'ma_reponse', r.reponse) order by co.question), '[]'::jsonb))
      from public.corriges co
      left join public.reponses r
             on r.eleve_id  = v_eleve.id
            and r.seance_id = v_seance
            and r.question  = co.question
     where co.seance_id = v_seance);
end; $$;

grant execute on function public.connaissance() to anon, authenticated;

-- ─── 4. Côté enseignant — la répartition, et qui a répondu quoi ────────────
--  « qui » donne, pour chaque réponse, la liste des numéros. C'est ce qui
--  transforme un camembert en information utilisable : savoir que trois
--  étudiants n'ont pas d'ordinateur ne sert à rien si on ignore lesquels.
create or replace function public.connaissance_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seance bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select id into v_seance from public.seances
   where classe_id = p_classe_id and numero = 98;
  if not found then return jsonb_build_object('ok', false, 'motif', 'pas_de_seance'); end if;

  return (
    with q as (
      select co.question, co.intitule, co.options
        from public.corriges co where co.seance_id = v_seance
    ),
    rep as (
      select r.question, r.reponse, e.numero
        from public.reponses r
        join public.eleves e on e.id = r.eleve_id
       where e.classe_id = p_classe_id and r.seance_id = v_seance
    ),
    dist as (
      select q.question, q.intitule, q.options,
             coalesce((select jsonb_object_agg(t.reponse, t.n) from (
                 select reponse, count(*) as n from rep
                  where rep.question = q.question group by reponse) t),
               '{}'::jsonb) as compte,
             coalesce((select jsonb_object_agg(t.reponse, t.nums) from (
                 select reponse, jsonb_agg(numero order by numero) as nums from rep
                  where rep.question = q.question group by reponse) t),
               '{}'::jsonb) as qui
        from q
    ),
    etat as (
      select e.numero, e.avatar, count(r.question) as faites
        from public.eleves e
        left join public.reponses r
               on r.eleve_id = e.id and r.seance_id = v_seance
       where e.classe_id = p_classe_id
       group by e.numero, e.avatar
    )
    select jsonb_build_object(
      'ok', true,
      'total_questions', (select count(*) from q),
      'inscrits',        (select count(*) from etat),
      'termines',        (select count(*) from etat
                           where faites >= (select count(*) from q)),
      'questions', coalesce((select jsonb_agg(jsonb_build_object(
                     'question', question, 'intitule', intitule,
                     'options',  to_jsonb(options),
                     'compte',   compte,
                     'qui',      qui) order by question) from dist), '[]'::jsonb),
      'eleves',    coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar, 'faites', faites)
                   order by numero) from etat), '[]'::jsonb))
  );
end; $$;

grant execute on function public.connaissance_classe(bigint) to authenticated;

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
select c.code, count(co.*) as questions
  from public.seances s
  join public.classes c  on c.id = s.classe_id
  left join public.corriges co on co.seance_id = s.id
 where s.numero = 98
 group by c.code order by c.code;
