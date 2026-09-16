-- ═══════════════════════════════════════════════════════════════════════════
--  « CE QUI BLOQUE » DEVIENT AGISSANTE
--
--  La carte disait déjà quoi faire — « Le geste : Clore la séance » — mais
--  elle le disait en toutes lettres, et il fallait ensuite aller le faire
--  ailleurs : changer d'onglet, choisir la classe, choisir la séance, trouver
--  le bouton. Quatre gestes pour exécuter celui qui était écrit, et c'est
--  précisément le genre de trajet qu'on ne fait pas entre deux heures de
--  cours. Une carte qui nomme le geste sans le rendre possible informe ; elle
--  ne débloque pas.
--
--  Ce qui change : chaque tâche porte désormais **de quoi agir**, et non plus
--  seulement de quoi lire.
--
--    `action`     ce que le portail peut faire d'un clic, ou null
--    `seance_id`  la cible de cette action
--    `classe_id`  la classe concernée
--    `aller`      l'onglet où l'on emmène quand aucune action n'est possible
--
--  Trois actions seulement, et c'est délibéré : ce sont les trois qui se
--  décident sans rien lire d'autre.
--
--    `demarrer`         rouvrir la séance 99 — l'appel ne se ferme pas
--    `clore`            fermer une séance oubliée ouverte
--    `ouvrir_controle`  allumer un contrôle d'entrée écrit mais éteint
--
--  Les six autres règles n'ont PAS d'action, et il ne faut pas leur en
--  inventer une : ajouter un corrigé, attribuer un code, poser une échéance,
--  déclarer des jalons, créer un dépôt — chacune demande de saisir quelque
--  chose qu'on est seul à connaître. Un bouton qui prétendrait le faire
--  écrirait n'importe quoi à la place de l'enseignant. Elles reçoivent
--  `aller`, qui emmène au bon endroit avec la bonne classe déjà choisie ;
--  c'est le trajet qu'on supprime, pas la décision.
--
--  ⚠️ `a_faire()` est **réécrite en entier** ici, et c'est cette définition
--  qui gagne — elle passe après `20260915120000_controles_visibles.sql`, qui
--  passait lui-même après `20260908080000_a_faire.sql`. Troisième réécriture,
--  même piège : corriger l'une des deux précédentes ne changerait rien. Les
--  neuf règles sont reprises à l'identique ; seules les quatre colonnes de
--  pilotage sont neuves.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

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
    select c.code, c.nom, c.id as classe_id, 'bloquant' as gravite, 1 as rang,
           'Appel fermé' as quoi,
           'La séance 99 est fermée : aucun étudiant ne peut marquer sa présence.' as detail,
           'Démarrer la séance 99' as geste,
           'demarrer' as action, s.id as seance_id, null::text as aller
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero = 99 and not s.ouverte
  ),

  -- ── Un cours ouvert sans corrigé enregistre sans jamais évaluer ─────────
  --  Pas d'action : écrire les corrigés demande de savoir ce qu'on a posé.
  --  On emmène à la séance, la décision reste entière.
  cours_sans_corrige as (
    select c.code, c.nom, c.id, 'bloquant', 2,
           'Séance ' || s.numero || ' ouverte sans corrigé',
           'Les réponses seront enregistrées mais jamais évaluées : ni réussite, ni répartition.',
           'Ajouter les corrigés, ou refermer la séance',
           null, s.id, 'seance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'cours' and s.ouverte and s.numero < 90
       and not exists (select 1 from public.corriges co where co.seance_id = s.id)
  ),

  -- ── Un étudiant sans code ne peut pas entrer ───────────────────────────
  sans_code as (
    select c.code, c.nom, c.id, 'bloquant', 3,
           count(*) || ' étudiant' || case when count(*) > 1 then 's' else '' end || ' sans code',
           'Ils ne pourront pas s''identifier au portail.',
           'Leur attribuer un code à quatre chiffres',
           null, null::bigint, null
      from public.eleves e
      join public.classes c on c.id = e.classe_id
     where e.pin is null and e.numero <> '99'
     group by c.code, c.nom, c.id
  ),

  -- ── Un projet sans échéance ne dit rien du rythme ───────────────────────
  projet_sans_echeance as (
    select distinct c.code, c.nom, c.id, 'attention', 4,
           'Projet sans échéance',
           'Sans date de fin, « jours restants » et « en risque » restent vides : le rythme ne peut pas être jugé.',
           'Poser une échéance sur les séances de projet',
           null, null::bigint, 'seance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'projet' and s.echeance is null
  ),

  -- ── Un projet sans jalons calcule un pourcentage sur zéro ───────────────
  projet_sans_jalons as (
    select c.code, c.nom, c.id, 'attention', 5,
           'Séance ' || s.numero || ' sans jalons déclarés',
           'L''avancement se calculera sur l''étudiant le plus avancé, faute de repère.',
           'Déclarer le nombre de jalons de ce TP',
           null, s.id, 'seance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'projet' and coalesce(s.jalons, 0) = 0
  ),

  -- ── Une séance de cours oubliée ouverte ─────────────────────────────────
  --  Bien après sa durée prévue : elle accepte encore des réponses depuis
  --  n'importe où, y compris de chez soi, le soir. Une action, celle-là :
  --  clore ne demande aucune information qu'on n'ait déjà.
  cours_oublie as (
    select c.code, c.nom, c.id, 'attention', 6,
           'Séance ' || s.numero || ' encore ouverte',
           'Démarrée il y a ' ||
             floor(extract(epoch from (now() - s.demarree_le)) / 3600)::int ||
             ' h, bien au-delà de sa durée : elle accepte toujours des réponses.',
           'Clore la séance',
           'clore', s.id, null
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'cours' and s.ouverte and s.numero < 90
       and s.demarree_le is not null
       and now() - s.demarree_le > (coalesce(s.duree_min, 55) + 120) * interval '1 minute'
  ),

  -- ── Un contrôle d'entrée écrit, mais que personne ne voit ───────────────
  controle_eteint as (
    select c.code, c.nom, c.id, 'attention', 7,
           'Contrôle d''entrée éteint — séance ' || s.numero,
           (select count(*) from public.corriges co
             where co.seance_id = s.id
               and co.question like 'pre-%' and co.question not like '%-c')
             || ' notions écrites, mais les étudiants ne les voient pas.',
           'Le proposer aux étudiants',
           'ouvrir_controle', s.id, null
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

  -- ── Une classe sans projet n'ouvre sur rien ─────────────────────────────
  sans_projet as (
    select c.code, c.nom, c.id, 'attention', 8,
           'Aucun projet associé',
           'Les étudiants s''identifient, puis ne trouvent aucun support à ouvrir.',
           'Ajouter au moins un lien de projet pour cette classe',
           null, null::bigint, 'ensemble'
      from public.classes c
     where c.code not like 'DEMO%'
       and not exists (select 1 from public.projets p where p.classe_id = c.id)
  ),

  -- ── La question du jour : rien à faire, mais bon à savoir ───────────────
  appel_pas_pose as (
    select c.code, c.nom, c.id, 'info', 9,
           'Question du jour pas encore créée',
           'Elle se crée d''elle-même à la première connexion d''un étudiant.',
           '', null, null::bigint, null
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
    -- `agissables` : combien se règlent d'un clic. C'est ce chiffre qui dit
    -- s'il vaut la peine d'ouvrir la carte quand on est pressé.
    'agissables', (select count(*) from tout where action is not null),
    'taches', coalesce((select jsonb_agg(jsonb_build_object(
                 'classe',    nom,
                 'code',      code,
                 'classe_id', classe_id,
                 'gravite',   gravite,
                 'quoi',      quoi,
                 'detail',    detail,
                 'geste',     geste,
                 'action',    action,
                 'seance_id', seance_id,
                 'aller',     aller)
               order by rang, code) from tout), '[]'::jsonb))
  into v_res;

  return v_res;
end; $$;

grant execute on function public.a_faire() to authenticated;

comment on function public.a_faire() is
  'Ce qui empêche de faire cours, recalculé depuis la base. Chaque tâche porte '
  'une `action` exécutable d''un clic (demarrer, clore, ouvrir_controle) ou, à '
  'défaut, un `aller` qui emmène au bon onglet avec la bonne classe. Les règles '
  'qui demandent de saisir quelque chose n''ont pas d''action : un bouton y '
  'écrirait à la place de l''enseignant.';

-- ─── Contrôle ──────────────────────────────────────────────────────────────
--  L'existence partout, le comportement seulement quand la session est
--  enseignante — une migration jouée sous le rôle postgres n'a pas de session
--  auth et `a_faire()` y répondrait « refus ». C'est la leçon du 16/09.
do $$
declare v_n int; v_r jsonb;
begin
  select count(*) into v_n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'a_faire';
  if v_n <> 1 then
    raise exception 'a_faire() : % définition(s), attendu 1', v_n;
  end if;

  if not public.est_enseignant() then
    raise notice 'a_faire() est en place. Son contenu n''est pas vérifié ici : '
                 'cette session n''est pas enseignante.';
    return;
  end if;

  v_r := public.a_faire();
  if not (v_r->>'ok')::boolean then
    raise exception 'a_faire() refuse : %', v_r;
  end if;

  -- Toute tâche porte les quatre clés de pilotage, même à null : une clé
  -- absente et une clé nulle ne se lisent pas pareil côté portail, et c'est
  -- la clé absente qui produit un « undefined » affiché en séance.
  select count(*) into v_n
    from jsonb_array_elements(v_r->'taches') t
   where not (t ? 'action' and t ? 'seance_id' and t ? 'classe_id' and t ? 'aller');
  if v_n > 0 then
    raise exception '% tâche(s) sans les quatre clés de pilotage', v_n;
  end if;

  -- Une action ne peut viser que trois verbes connus : un quatrième arriverait
  -- au portail qui ne saurait pas quoi en faire, et le bouton ne ferait rien.
  select count(*) into v_n
    from jsonb_array_elements(v_r->'taches') t
   where t->>'action' is not null
     and t->>'action' not in ('demarrer', 'clore', 'ouvrir_controle');
  if v_n > 0 then
    raise exception '% tâche(s) portent une action inconnue du portail', v_n;
  end if;

  -- Une action sans cible ne peut pas s'exécuter : le bouton échouerait au
  -- clic, en séance, ce qui est pire que pas de bouton du tout.
  select count(*) into v_n
    from jsonb_array_elements(v_r->'taches') t
   where t->>'action' is not null and t->>'seance_id' is null;
  if v_n > 0 then
    raise exception '% action(s) sans séance cible', v_n;
  end if;

  raise notice 'a_faire() : % tâche(s), dont % réglable(s) d''un clic.',
    jsonb_array_length(v_r->'taches'), (v_r->>'agissables')::int;
end $$;
