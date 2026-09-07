-- ═══════════════════════════════════════════════════════════════════════════
--  RECHERCHE DE STAGE — le point d'étape BTS2
--
--  Six questions sur l'avancement de la recherche. À la différence du
--  questionnaire de rentrée, celui-ci se REVOIT : l'étudiant peut changer sa
--  réponse à chaque fois qu'il progresse, et c'est le but. Le tableau montre
--  donc un état à un instant donné, pas une réponse figée — d'où la date de
--  dernière mise à jour, qui dit si l'information est fraîche.
--
--  C'est la séance 97. 99 = l'appel, 98 = « faisons connaissance »,
--  97 = le stage : trois numéros hauts, hors progression.
--
--  Aucune bonne réponse : bonne_reponse vaut « Z », rien n'entre dans le
--  taux de réussite.
--
--  À coller dans Supabase → SQL Editor → Run. Après SEANCE.sql et PROJET.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La séance 97 ───────────────────────────────────────────────────────
--  Une seule ligne à modifier : le code de la classe de deuxième année.
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min, nature)
select c.id, 97, 'Recherche de stage', false, true, 10, 'cours'
  from public.classes c
 where c.code in ('BTS2-SLAM-2026')          -- <<< À MODIFIER
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = 97);

-- ─── 2. Les six questions ──────────────────────────────────────────────────
--  L'ordre des options va toujours du moins avancé au plus avancé : c'est ce
--  qui permet de lire la colonne « A » comme « ceux qu'il faut aider ».
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id, q.cle, 'Z',
       'Merci — vous pourrez modifier cette réponse quand la situation aura changé.',
       q.intitule, q.options
  from public.seances s
  cross join (values

  ('stage-01',
   'Où en êtes-vous de votre recherche de stage ?',
   array['Je n''ai pas encore commencé',
         'Je prépare mon CV et ma lettre',
         'J''ai envoyé des candidatures',
         'J''ai trouvé, c''est confirmé']),

  ('stage-02',
   'Combien d''entreprises avez-vous contactées ?',
   array['Aucune pour l''instant',
         'De 1 à 3',
         'De 4 à 10',
         'Plus de 10']),

  ('stage-03',
   'Où en est votre CV ?',
   array['Il n''est pas encore écrit',
         'J''en ai une version, jamais relue',
         'Il est à jour et relu',
         'Il est à jour et adapté à chaque candidature']),

  ('stage-04',
   'Quelles réponses avez-vous reçues ?',
   array['Aucune réponse',
         'Seulement des refus',
         'Au moins un entretien',
         'Une proposition ferme']),

  ('stage-05',
   'Où en est la convention de stage ?',
   array['Je n''ai pas encore d''entreprise',
         'L''entreprise est d''accord, la convention n''est pas lancée',
         'La convention est en cours de signature',
         'La convention est signée']),

  ('stage-06',
   'Qu''est-ce qui vous bloque le plus en ce moment ?',
   array['Trouver des entreprises à contacter',
         'Écrire le CV et la lettre',
         'Téléphoner, relancer, oser',
         'Rien de particulier, ça avance'])

  ) as q(cle, intitule, options)
 where s.numero = 97
   and not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── 3. Côté étudiant — ses six réponses, modifiables ──────────────────────
--  Toutes les questions d'un coup, avec la réponse en cours : le portail
--  affiche les six et laisse changer celle qui a bougé.
create or replace function public.stage()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve  public.eleves;
  v_seance bigint;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return null; end if;

  select id into v_seance from public.seances
   where classe_id = v_eleve.classe_id and numero = 97 and ouverte;
  if not found then return null; end if;

  return (
    select jsonb_build_object(
      'seance_id', v_seance,
      'total',     count(*),
      'faites',    count(r.reponse),
      'maj',       max(r.updated_at),
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

grant execute on function public.stage() to anon, authenticated;

-- ─── 4. Côté enseignant — l'état de la promotion ───────────────────────────
--  Deux lectures dans la même réponse :
--   · « etats » range chaque étudiant sous sa réponse à stage-01, du moins
--     avancé au plus avancé — c'est la liste qu'on regarde en premier ;
--   · « questions » donne le détail par question, avec les numéros.
--  « maj » dit quand l'étudiant a mis son point à jour pour la dernière fois :
--  une promotion « à jour » depuis six semaines ne dit plus rien de vrai.
create or replace function public.stage_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seance bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select id into v_seance from public.seances
   where classe_id = p_classe_id and numero = 97;
  if not found then return jsonb_build_object('ok', false, 'motif', 'pas_de_seance'); end if;

  return (
    with q as (
      select co.question, co.intitule, co.options
        from public.corriges co where co.seance_id = v_seance
    ),
    rep as (
      select r.question, r.reponse, r.updated_at, e.numero
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
      select e.numero, e.avatar,
             (select r.reponse from rep r
               where r.numero = e.numero and r.question = 'stage-01') as ou,
             (select max(r.updated_at) from rep r where r.numero = e.numero) as maj,
             (select count(*) from rep r where r.numero = e.numero) as faites
        from public.eleves e
       where e.classe_id = p_classe_id
    )
    select jsonb_build_object(
      'ok', true,
      'total_questions', (select count(*) from q),
      'inscrits',        (select count(*) from etat),
      'repondu',         (select count(*) from etat where faites > 0),
      'maj',             (select max(maj) from etat),
      -- L'intitulé des quatre étapes, pour que le portail nomme les colonnes.
      'etapes', coalesce((select to_jsonb(options) from q where question = 'stage-01'),
                         'null'::jsonb),
      'etats',  coalesce((select jsonb_agg(jsonb_build_object(
                    'numero', numero, 'avatar', avatar,
                    'ou', ou, 'faites', faites,
                    'maj', to_char(maj at time zone 'Europe/Paris', 'DD/MM'))
                  order by numero) from etat), '[]'::jsonb),
      'questions', coalesce((select jsonb_agg(jsonb_build_object(
                     'question', question, 'intitule', intitule,
                     'options',  to_jsonb(options),
                     'compte',   compte,
                     'qui',      qui) order by question) from dist), '[]'::jsonb))
  );
end; $$;

grant execute on function public.stage_classe(bigint) to authenticated;

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
select c.code, count(co.*) as questions
  from public.seances s
  join public.classes c   on c.id = s.classe_id
  left join public.corriges co on co.seance_id = s.id
 where s.numero = 97
 group by c.code order by c.code;
