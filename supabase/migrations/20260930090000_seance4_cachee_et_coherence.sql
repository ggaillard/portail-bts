-- ═══════════════════════════════════════════════════════════════════════════
--  LA SÉANCE 4 NE SE MONTRE PLUS AVANT LA 3 — et trois incohérences du BTS1
--
--  30/09, pendant la séance 3. Constat en base (lecture avec la clé anon) :
--
--    · séance 4 : `publiee = false` mais `controle_ouvert = true`. Le contrôle
--      d'entrée d'une séance passe par `mes_controles()`, qui ne regarde que
--      `controle_ouvert` : les étudiants voyaient une carte « Séance 4 — Ça
--      marche sur mon poste » alors que la séance est cachée et que la 3 se
--      joue. CAUSE : la règle « Contrôle d'entrée éteint » d'`a_faire()`
--      proposait d'allumer le contrôle de TOUTE séance pas encore démarrée,
--      donc celui de la 4 avant la 3 — avec un bouton d'un clic.
--    · séances 1 et 2 : jouées (`demarree_le` posé) mais `publiee = false`.
--      La règle du portail est « publiée à partir du jour de la séance, et
--      pour toujours » : leur trace écrite était masquée aux étudiants, le
--      jour même où l'on propose de réviser la séance 2.
--    · séance 3 : titre sans accents (« Seance 3 - … ou vit la donnee »).
--
--  Ce que fait cette migration :
--    1. éteint le contrôle de la séance 4 (rien n'est perdu : éteindre ne
--       touche à aucune réponse) ;
--    2. republie les séances jouées du BTS1 ;
--    3. remet les accents au titre de la séance 3 ;
--    4. RÉÉCRIT `a_faire()` : la règle « contrôle éteint » ne vise plus, pour
--       un cours, que la PROCHAINE séance, et se tait pendant que la
--       précédente se joue ; une règle neuve signale un contrôle proposé trop
--       tôt.
--
--  ⚠️ `a_faire()` est RÉÉCRITE EN ENTIER, et cette définition gagne sur celle
--  de `20260916100000_a_faire_agissante.sql` — reprise à l'identique hors les
--  deux règles ci-dessus.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1-3. L'état du BTS1 ──────────────────────────────────────────────────
update public.seances s set controle_ouvert = false
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026'
   and s.numero = 4 and s.demarree_le is null and s.controle_ouvert;

update public.seances s set publiee = true
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026'
   and s.numero < 90 and s.demarree_le is not null and not s.publiee;

update public.seances s set titre = 'Séance 3 - 60, 47, 72 : où vit la donnée'
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026'
   and s.numero = 3 and s.titre = 'Seance 3 - 60, 47, 72 : ou vit la donnee';

-- ─── 4. `a_faire()` ────────────────────────────────────────────────────────
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
       -- 30/09 : pour un cours, seulement la PROCHAINE séance, et pas pendant
       -- que la précédente se joue. Sans ces deux conditions, la règle a
       -- poussé à proposer le contrôle de la séance 4 avant que la 3 ait eu
       -- lieu : les étudiants voyaient une « Séance 4 » encore cachée.
       and (s.nature <> 'cours' or (
             s.numero = (select min(x.numero) from public.seances x
                          where x.classe_id = s.classe_id and x.numero < 90
                            and x.nature = 'cours' and x.demarree_le is null)
         and not exists (select 1 from public.seances y
                          where y.classe_id = s.classe_id and y.numero < s.numero
                            and y.nature = 'cours' and y.ouverte
                            and y.demarree_le is not null)))
  ),

  -- ── Un contrôle proposé trop tôt montre une séance encore cachée ────────
  --  30/09. Proposé alors qu'une séance antérieure n'a pas encore été jouée,
  --  ou qu'elle se joue : la carte « Séance N » apparaît aux étudiants avant
  --  que la séance d'avant soit finie. Le geste est « Éteindre », dans la
  --  fiche de la séance (onglet Contrôle) — pas d'action d'un clic ici, le
  --  seul verbe connu du portail pour ce contrôle l'allume.
  controle_trop_tot as (
    select c.code, c.nom, c.id, 'attention', 7,
           'Contrôle d''entrée proposé trop tôt — séance ' || s.numero,
           'Les étudiants voient déjà la séance ' || s.numero ||
             ' alors que la séance ' || (select min(x.numero) from public.seances x
                                          where x.classe_id = s.classe_id and x.numero < s.numero
                                            and x.nature = 'cours'
                                            and (x.demarree_le is null or x.ouverte)) ||
             ' n''est pas terminée.',
           'L''éteindre dans la fiche de la séance (onglet Contrôle)',
           null, s.id, 'quest'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero < 90 and s.nature = 'cours'
       and s.controle_ouvert and s.demarree_le is null
       and c.code not like 'DEMO%'
       and exists (select 1 from public.seances x
                    where x.classe_id = s.classe_id and x.numero < s.numero
                      and x.nature = 'cours'
                      and (x.demarree_le is null or x.ouverte))
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
    union all select * from controle_trop_tot
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

-- ─── Contrôle ──────────────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  select count(*) into v_n from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero < 90 and s.demarree_le is not null and not s.publiee;
  if v_n > 0 then raise exception 'BTS1 : % séance(s) jouée(s) encore cachée(s)', v_n; end if;

  select count(*) into v_n from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4 and s.demarree_le is null and s.controle_ouvert;
  if v_n > 0 then raise exception 'BTS1 : le contrôle de la séance 4 est encore proposé'; end if;

  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'a_faire';
  if v_n <> 1 then raise exception 'a_faire() : % définition(s), attendu 1', v_n; end if;
end $$;
