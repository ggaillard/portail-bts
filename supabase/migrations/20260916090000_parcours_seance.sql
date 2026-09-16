-- ═══════════════════════════════════════════════════════════════════════════
--  LE PARCOURS D'UNE SÉANCE — où en est chacun, et où en est le groupe
--
--  Chaque heure commence par la même suite, et jusqu'ici elle n'était lisible
--  nulle part d'un seul tenant : l'appel dans son onglet, l'humeur sous la
--  classe, le contrôle d'entrée derrière deux sélecteurs, le quiz dans les
--  tuiles. Quatre écrans pour une seule question — « qui n'a pas démarré ? » —
--  qu'on se pose une fois par heure, debout, en trente secondes.
--
--      1. Appel              — séance 99, question du jour
--      2. Comment ça va      — séance 99, question d'humeur
--      3. Contrôle d'entrée  — les `pre-NN` de CETTE séance : ce qu'ils ont
--                              gardé du cours d'avant
--      4. Le quiz            — les questions de la séance elle-même, ou les
--                              jalons du TP quand c'en est un
--
--  Deux lectures d'une même donnée, calculées au même endroit — même principe
--  que `bibliotheque()` :
--    · `etapes` — l'entonnoir : 13 présents → 12 ont dit leur humeur → 9 ont
--      fait le contrôle → 4 ont commencé le quiz. Où ça coince collectivement.
--    · `eleves` — la ligne par étudiant, avec `bloque` : la PREMIÈRE étape non
--      faite. C'est elle qu'on lit en séance, parce qu'elle nomme le geste —
--      aller voir le 07.
--
--  Trois règles reprises telles quelles, et qui ne se devinent pas :
--
--    · **Le compte d'essai n° 99 n'est pas un étudiant.** Le 09/09, il comptait
--      comme absent tous les jours et gonflait l'effectif de 31 à 32. Toute
--      fonction qui compte des étudiants porte `numero <> '99'`.
--    · **`pre-%` est exclu du quiz.** Sans ce filtre, une séance qui pose dix
--      questions en annoncerait vingt, et le taux mélangerait ce qu'ils
--      savaient avant avec ce qu'ils ont appris pendant.
--    · **Une étape non posée n'est pas une étape à zéro.** Un contrôle qui
--      n'a pas été écrit rend `pose = false` ; l'afficher « 0 / 13 » se lirait
--      « personne ne l'a fait » au lieu de « il n'existe pas ». Même choix que
--      `debriefing()`, qui préfère un blanc à un zéro.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.parcours_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s        public.seances;
  v_c        public.classes;
  v_appel    bigint;
  v_jour     date;
  v_qa       text;
  v_qh       text;
  v_inscrits int;
  v_ct       int;          -- notions du contrôle d'entrée
  v_qz       int;          -- questions du quiz, ou jalons du TP
  v_jalons   boolean;
  v_eleves   jsonb;
  v_etapes   jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero is null or v_s.numero >= 90 then
    -- L'appel et les questionnaires n'ont pas de parcours : ils SONT des
    -- étapes du parcours d'une séance de cours.
    return jsonb_build_object('ok', false, 'motif', 'pas_un_cours');
  end if;
  select * into v_c from public.classes where id = v_s.classe_id;

  -- Le jour de la séance, pas forcément aujourd'hui : on relit le parcours
  -- d'une séance passée aussi souvent qu'on suit celle en cours, et prendre
  -- current_date ferait apparaître tout le monde absent le lendemain.
  v_jour := coalesce(v_s.demarree_le::date, current_date);
  v_qa   := 'appel-'  || to_char(v_jour, 'YYYY-MM-DD');
  v_qh   := 'humeur-' || to_char(v_jour, 'YYYY-MM-DD');

  select s.id into v_appel from public.seances s
   where s.classe_id = v_s.classe_id and s.numero = 99;

  select count(*) into v_inscrits from public.eleves e
   where e.classe_id = v_s.classe_id and e.numero <> '99';

  select count(*) into v_ct from public.corriges co
   where co.seance_id = v_s.id
     and co.question like 'pre-%' and co.question not like '%-c';

  -- Un TP se mesure en jalons franchis, une séance de cours en questions
  -- répondues. `seances.jalons` est ce qui distingue les deux, et c'est déjà
  -- ce que lit `suivi_projet()` : deux comptes différents pour le même écran,
  -- c'est la distinction que `estEvaluee()` tient côté portail.
  v_jalons := coalesce(v_s.jalons, 0) > 0;
  if v_jalons then
    v_qz := v_s.jalons;
  else
    select count(*) into v_qz from public.corriges co
     where co.seance_id = v_s.id and co.question not like 'pre-%';
  end if;

  with eleves as (
    select e.id, e.numero, e.avatar
      from public.eleves e
     where e.classe_id = v_s.classe_id and e.numero <> '99'
  ),
  brut as (
    select e.id, e.numero, e.avatar,
      exists (select 1 from public.reponses r
               where r.eleve_id = e.id and r.seance_id = v_appel
                 and r.question = v_qa)                            as appel,
      exists (select 1 from public.reponses r
               where r.eleve_id = e.id and r.seance_id = v_appel
                 and r.question = v_qh)                            as humeur,
      (select count(distinct r.question) from public.reponses r
        where r.eleve_id = e.id and r.seance_id = v_s.id
          and r.question like 'pre-%'
          and r.question not like '%-c')::int                      as controle,
      (case when v_jalons then
         (select count(*) from public.reponses r
           where r.eleve_id = e.id and r.seance_id = v_s.id
             and r.question like 'tp%' and r.reponse in ('true', 'ok'))
       else
         (select count(distinct r.question) from public.reponses r
           where r.eleve_id = e.id and r.seance_id = v_s.id
             and r.question not like 'pre-%')
       end)::int                                                   as quiz,
      (select max(r.updated_at) from public.reponses r
        where r.eleve_id = e.id and r.seance_id in (v_s.id, v_appel)) as dernier
      from eleves e
  )
  select jsonb_agg(jsonb_build_object(
           'eleve_id', b.id, 'numero', b.numero, 'avatar', b.avatar,
           'appel', b.appel, 'humeur', b.humeur,
           'controle', b.controle, 'quiz', b.quiz,
           'dernier', b.dernier,
           -- La première étape qui manque, et rien d'autre : c'est elle qui
           -- nomme le geste. Une étape non posée ne bloque personne — le
           -- portail ne doit jamais envoyer voir quelqu'un pour un contrôle
           -- qui n'a pas été écrit.
           'bloque',
             case when not b.appel                        then 'appel'
                  when not b.humeur                       then 'humeur'
                  when v_ct > 0 and b.controle < v_ct     then 'controle'
                  when v_qz > 0 and b.quiz = 0            then 'quiz'
                  else null end)
         order by b.numero)
    into v_eleves
    from brut b;

  v_eleves := coalesce(v_eleves, '[]'::jsonb);

  -- L'entonnoir. `pose` dit si l'étape existe : une étape absente s'écrit
  -- « pas posé », jamais « 0 / 13 ».
  select jsonb_build_array(
    jsonb_build_object('cle', 'appel',    'nom', 'Appel',
      'pose', v_appel is not null
              and exists (select 1 from public.corriges co
                           where co.seance_id = v_appel and co.question = v_qa),
      'fait', (select count(*) from jsonb_array_elements(v_eleves) x
                where (x->>'appel')::boolean), 'total', v_inscrits),
    jsonb_build_object('cle', 'humeur',   'nom', 'Comment ça va',
      'pose', v_appel is not null
              and exists (select 1 from public.corriges co
                           where co.seance_id = v_appel and co.question = v_qh),
      'fait', (select count(*) from jsonb_array_elements(v_eleves) x
                where (x->>'humeur')::boolean), 'total', v_inscrits),
    jsonb_build_object('cle', 'controle', 'nom', 'Contrôle d''entrée',
      'pose', v_ct > 0, 'sur', v_ct, 'ouvert', coalesce(v_s.controle_ouvert, false),
      'fait', (select count(*) from jsonb_array_elements(v_eleves) x
                where v_ct > 0 and (x->>'controle')::int >= v_ct),
      'entames', (select count(*) from jsonb_array_elements(v_eleves) x
                   where (x->>'controle')::int > 0), 'total', v_inscrits),
    jsonb_build_object('cle', 'quiz',
      'nom', case when v_jalons then 'Le TP' else 'Le quiz de la séance' end,
      'pose', v_qz > 0, 'sur', v_qz, 'jalons', v_jalons,
      'fait', (select count(*) from jsonb_array_elements(v_eleves) x
                where v_qz > 0 and (x->>'quiz')::int >= v_qz),
      'entames', (select count(*) from jsonb_array_elements(v_eleves) x
                   where (x->>'quiz')::int > 0), 'total', v_inscrits)
  ) into v_etapes;

  return jsonb_build_object('ok', true,
    'seance_id', v_s.id, 'numero', v_s.numero, 'titre', v_s.titre,
    'classe', coalesce(v_c.nom, v_c.code), 'code', v_c.code,
    'jour', v_jour, 'demarree', v_s.demarree_le is not null,
    'ouverte', v_s.ouverte, 'inscrits', v_inscrits,
    'controle_sur', v_ct, 'quiz_sur', v_qz, 'jalons', v_jalons,
    'etapes', v_etapes, 'eleves', v_eleves);
end; $$;

grant execute on function public.parcours_seance(bigint) to authenticated;

comment on function public.parcours_seance(bigint) is
  'Les quatre étapes de début d''heure — appel, humeur, contrôle d''entrée, '
  'quiz — vues par le groupe (entonnoir) et étudiant par étudiant (avec la '
  'première étape manquante). Le compte n° 99 est exclu, les pre-% sont hors '
  'du quiz, et une étape non posée se déclare non posée plutôt que nulle.';

-- ─── Contrôle ──────────────────────────────────────────────────────────────
--  ⚠️ Deux étages, et la distinction n'est pas décorative.
--
--  L'existence de la fonction se vérifie partout. Son COMPORTEMENT, lui, ne
--  peut s'observer que si `est_enseignant()` répond vrai — or une migration
--  jouée depuis le SQL Editor tourne sous le rôle `postgres`, sans session
--  `auth.uid()`, donc `est_enseignant()` y répond faux et la fonction renvoie
--  `refus`. Appeler la fonction sans cette garde faisait échouer la migration
--  entière sur la vraie base, alors qu'elle passait en intégration continue
--  où `est_enseignant()` est bouchonnée à vrai. Le 16/09, c'est exactement ce
--  qui s'est produit : refusée en production, verte sur la base d'essai.
--
--  Un contrôle qui ne peut pas s'exécuter là où il compte n'est pas un
--  contrôle : il faut soit le rendre exécutable, soit dire pourquoi il ne
--  l'est pas. Ici on dit les deux.
do $$
declare
  v_s bigint; v_cl bigint; v_r jsonb; v_n int;
begin
  select count(*) into v_n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'parcours_seance';
  if v_n <> 1 then
    raise exception 'parcours_seance() : % définition(s), attendu 1', v_n;
  end if;

  if not public.est_enseignant() then
    raise notice 'parcours_seance() est en place. Son comportement n''est pas '
                 'vérifié ici : cette session n''est pas enseignante (rôle '
                 'postgres, sans auth.uid()), et la fonction répondrait refus. '
                 'Les assertions de fond tournent en intégration continue.';
    return;
  end if;

  select s.id, s.classe_id into v_s, v_cl
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 1;
  if v_s is null then
    raise notice 'Pas de séance 1 au BTS1 : contrôle du parcours sauté.';
    return;
  end if;

  v_r := public.parcours_seance(v_s);
  if not (v_r->>'ok')::boolean then
    raise exception 'parcours_seance() refuse la séance 1 du BTS1 : %', v_r;
  end if;

  -- L'effectif doit être celui des vrais étudiants : le compte d'essai n° 99
  -- comptait comme absent tous les jours avant le 09/09, et c'est ce contrôle
  -- qui empêche la régression de revenir en silence.
  select count(*) into v_n from public.eleves
   where classe_id = v_cl and numero <> '99';
  if (v_r->>'inscrits')::int <> v_n then
    raise exception 'parcours : % inscrits annoncés, % attendus (le compte '
                    'n° 99 est-il compté ?)', (v_r->>'inscrits')::int, v_n;
  end if;
  if jsonb_array_length(v_r->'eleves') <> v_n then
    raise exception 'parcours : % lignes élève pour % inscrits',
                    jsonb_array_length(v_r->'eleves'), v_n;
  end if;

  if jsonb_array_length(v_r->'etapes') <> 4 then
    raise exception 'parcours : % étapes, attendu 4', jsonb_array_length(v_r->'etapes');
  end if;

  -- Le quiz d'une séance de cours compte ses dix questions, et pas les
  -- notions du contrôle d'entrée qui vivent sur la même séance.
  select count(*) into v_n from public.corriges
   where seance_id = v_s and question not like 'pre-%';
  if (v_r->>'quiz_sur')::int <> v_n then
    raise exception 'parcours : quiz sur %, attendu % (les pre-%% sont-ils '
                    'exclus ?)', (v_r->>'quiz_sur')::int, v_n;
  end if;

  -- Une séance de la bande 90-98 n'a pas de parcours : elle EST une étape.
  select s.id into v_s from public.seances s
   where s.classe_id = v_cl and s.numero = 99;
  if v_s is not null then
    v_r := public.parcours_seance(v_s);
    if (v_r->>'ok')::boolean or v_r->>'motif' <> 'pas_un_cours' then
      raise exception 'parcours_seance() accepte la séance d''appel : %', v_r;
    end if;
  end if;

  raise notice 'Parcours de séance : quatre étapes, effectif sans le n° 99, '
               'quiz sans les pre-%%.';
end $$;
