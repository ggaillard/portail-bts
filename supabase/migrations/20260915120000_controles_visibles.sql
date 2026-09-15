-- ═══════════════════════════════════════════════════════════════════════════
--  VOIR SES CONTRÔLES D'ENTRÉE SANS SAVOIR OÙ ILS VIVENT
--
--  Le 15/09, un contrôle d'acquis écrit pour le BTS2 a été cherché dans
--  l'onglet « Questionnaires », où il n'est pas et ne sera jamais : un contrôle
--  appartient à la séance qu'il précède, donc il vit sous « Suivi d'une
--  séance », derrière deux sélecteurs. Écrit, posé, appliqué — et introuvable.
--
--  Le modèle est bon et ne change pas. Ce qui manquait est une **lecture** :
--  la liste de ce qui est écrit, où, pour qui, et allumé ou non.
--
--  Deux choses ici :
--    1. `controles()` — une lecture unique, toutes classes réelles ;
--    2. `a_faire()` — une règle de plus : écrit mais éteint, avant la séance.
--
--  Rejouable sans risque : que des `create or replace`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La liste des contrôles écrits ──────────────────────────────────────
--  Même esprit que `bibliotheque()` : une seule requête répond aux trois
--  questions qu'on se pose ensemble — qu'est-ce que j'ai écrit, à quelle
--  classe c'est posé, est-ce que les étudiants le voient.
--
--  Les démonstrations sont écartées, comme partout ce qui se lit en séance.
create or replace function public.controles()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  with notions as (
    select co.seance_id, count(*) as n
      from public.corriges co
     where co.question like 'pre-%' and co.question not like '%-c'
     group by co.seance_id
  ),
  effectif as (
    select e.classe_id, count(*) as inscrits
      from public.eleves e
     where e.numero <> '99'
     group by e.classe_id
  ),
  avance as (
    -- Un étudiant compte dès qu'il a répondu à une notion : c'est « il s'y est
    -- mis », pas « il a fini ». Le détail par notion est dans controle_seance().
    select r.seance_id, count(distinct r.eleve_id) as repondu
      from public.reponses r
      join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
     where r.question like 'pre-%'
     group by r.seance_id
  ),
  liste as (
    select s.id            as seance_id,
           c.id            as classe_id,
           c.code, c.nom   as classe,
           s.numero, s.titre, s.nature,
           n.n             as notions,
           s.controle_ouvert as ouvert,
           coalesce(a.repondu, 0)  as repondu,
           coalesce(f.inscrits, 0) as inscrits,
           s.demarree_le is not null as demarree
      from public.seances s
      join notions n          on n.seance_id = s.id
      join public.classes c   on c.id = s.classe_id
      left join effectif f    on f.classe_id = c.id
      left join avance a      on a.seance_id = s.id
     where s.numero < 90
       and c.code not like 'DEMO%'
  )
  select jsonb_build_object(
    'ok', true,
    'ecrits',  (select count(*) from liste),
    'allumes', (select count(*) from liste where ouvert),
    'liste', coalesce((select jsonb_agg(jsonb_build_object(
               'seance_id', seance_id,
               'classe_id', classe_id,
               'code',      code,
               'classe',    classe,
               'numero',    numero,
               'titre',     titre,
               'nature',    nature,
               'notions',   notions,
               'ouvert',    ouvert,
               'repondu',   repondu,
               'inscrits',  inscrits,
               'demarree',  demarree)
             order by code, numero) from liste), '[]'::jsonb))
  into v_res;

  return v_res;
end; $$;

grant execute on function public.controles() to authenticated;


-- ─── 2. a_faire() — une règle de plus ──────────────────────────────────────
--  ATTENTION : cette fonction est **réécrite en entier** ici, et cette
--  définition-ci est celle qui gagne, puisqu'elle passe après
--  `20260908080000_a_faire.sql`. Toute correction apportée là-bas et pas ici
--  serait écrasée en silence — c'est exactement le piège qui a mordu avec
--  `preflight_seance()` et `suivi_projet()`. Les huit règles d'origine sont
--  reprises telles quelles ; la neuvième est `controle_eteint`.
create or replace function public.a_faire()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  with

  -- ── L'appel : une séance 99 fermée, et personne ne peut pointer ─────────
  appel_ferme as (
    select c.code, c.nom, 'bloquant' as gravite, 1 as rang,
           'Appel fermé' as quoi,
           'La séance 99 est fermée : aucun étudiant ne peut marquer sa présence.' as detail,
           'Suivi d''une séance → séance 99 → Démarrer la séance' as geste
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero = 99 and not s.ouverte
  ),

  -- ── Un cours ouvert sans corrigé enregistre sans jamais évaluer ─────────
  cours_sans_corrige as (
    select c.code, c.nom, 'bloquant', 2,
           'Séance ' || s.numero || ' ouverte sans corrigé',
           'Les réponses seront enregistrées mais jamais évaluées : ni réussite, ni répartition.',
           'Ajouter les corrigés de cette séance, ou refermer la séance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'cours' and s.ouverte and s.numero < 90
       and not exists (select 1 from public.corriges co where co.seance_id = s.id)
  ),

  -- ── Un étudiant sans code ne peut pas entrer ───────────────────────────
  sans_code as (
    select c.code, c.nom, 'bloquant', 3,
           count(*) || ' étudiant' || case when count(*) > 1 then 's' else '' end || ' sans code',
           'Ils ne pourront pas s''identifier au portail.',
           'Leur attribuer un code à quatre chiffres'
      from public.eleves e
      join public.classes c on c.id = e.classe_id
     where e.pin is null and e.numero <> '99'
     group by c.code, c.nom
  ),

  -- ── Un projet sans échéance ne dit rien du rythme ──────────────────────
  projet_sans_echeance as (
    select distinct c.code, c.nom, 'attention', 4,
           'Projet sans échéance',
           'Sans date de fin, « jours restants » et « en risque » restent vides : le rythme ne peut pas être jugé.',
           'Poser une échéance sur les séances de projet'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'projet' and s.echeance is null
  ),

  -- ── Un projet sans jalons calcule un pourcentage sur zéro ──────────────
  projet_sans_jalons as (
    select c.code, c.nom, 'attention', 5,
           'Séance ' || s.numero || ' sans jalons déclarés',
           'L''avancement se calculera sur l''étudiant le plus avancé, faute de repère.',
           'Déclarer le nombre de jalons de ce TP'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'projet' and coalesce(s.jalons, 0) = 0
  ),

  -- ── Une séance de cours oubliée ouverte ────────────────────────────────
  --  Bien après sa durée prévue : elle accepte encore des réponses depuis
  --  n'importe où, y compris de chez soi, le soir.
  cours_oublie as (
    select c.code, c.nom, 'attention', 6,
           'Séance ' || s.numero || ' encore ouverte',
           'Démarrée il y a ' ||
             floor(extract(epoch from (now() - s.demarree_le)) / 3600)::int ||
             ' h, bien au-delà de sa durée : elle accepte toujours des réponses.',
           'Clore la séance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'cours' and s.ouverte and s.numero < 90
       and s.demarree_le is not null
       and now() - s.demarree_le > (coalesce(s.duree_min, 55) + 120) * interval '1 minute'
  ),

  -- ── Un contrôle d'entrée écrit, mais que personne ne voit ──────────────
  --  Le cas du 15/09 : huit notions posées sur le TP2 du BTS2, appliquées en
  --  base, et éteintes. Rien ne le disait nulle part, et un contrôle d'entrée
  --  qu'on découvre après la séance n'a plus d'objet — sa place est avant.
  --  On ne le signale que tant que la séance n'a pas démarré : après, éteint
  --  est l'état normal.
  controle_eteint as (
    select c.code, c.nom, 'attention', 7,
           'Contrôle d''entrée éteint — séance ' || s.numero,
           (select count(*) from public.corriges co
             where co.seance_id = s.id
               and co.question like 'pre-%' and co.question not like '%-c')
             || ' notions écrites, mais les étudiants ne les voient pas.',
           'Questionnaires → Contrôles d''entrée → l''interrupteur'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero < 90
       and not s.controle_ouvert
       and s.demarree_le is null
       and c.code not like 'DEMO%'
       and exists (select 1 from public.corriges co
                    where co.seance_id = s.id
                      and co.question like 'pre-%' and co.question not like '%-c')
  ),

  -- ── Une classe sans projet n'ouvre sur rien ────────────────────────────
  sans_projet as (
    select c.code, c.nom, 'attention', 8,
           'Aucun projet associé',
           'Les étudiants s''identifient, puis ne trouvent aucun support à ouvrir.',
           'Ajouter au moins un lien de projet pour cette classe'
      from public.classes c
     where c.code not like 'DEMO%'
       and not exists (select 1 from public.projets p where p.classe_id = c.id)
  ),

  -- ── La question du jour : rien à faire, mais bon à savoir ──────────────
  appel_pas_pose as (
    select c.code, c.nom, 'info', 9,
           'Question du jour pas encore créée',
           'Elle se crée d''elle-même à la première connexion d''un étudiant.',
           ''
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero = 99 and s.ouverte
       and not exists (select 1 from public.corriges co
                        where co.seance_id = s.id
                          and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD'))
  ),

  tout as (
    select * from appel_ferme
    union all select * from cours_sans_corrige
    union all select * from sans_code
    union all select * from projet_sans_echeance
    union all select * from projet_sans_jalons
    union all select * from cours_oublie
    union all select * from controle_eteint
    union all select * from sans_projet
    union all select * from appel_pas_pose
  )

  select jsonb_build_object(
    'ok', true,
    'bloquants',  (select count(*) from tout where gravite = 'bloquant'),
    'attentions', (select count(*) from tout where gravite = 'attention'),
    'taches', coalesce((select jsonb_agg(jsonb_build_object(
                 'classe',  nom,
                 'code',    code,
                 'gravite', gravite,
                 'quoi',    quoi,
                 'detail',  detail,
                 'geste',   geste)
               order by rang, code) from tout), '[]'::jsonb))
  into v_res;

  return v_res;
end; $$;

grant execute on function public.a_faire() to authenticated;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
--  Les deux fonctions répondent, et les neuf règles tiennent dans a_faire().
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('controles', 'a_faire');
  if v_n <> 2 then
    raise exception 'controles() / a_faire() : % fonction(s) trouvée(s), attendu 2', v_n;
  end if;
  raise notice 'controles() créée, a_faire() réécrite avec la règle « contrôle éteint ».';
end $$;
