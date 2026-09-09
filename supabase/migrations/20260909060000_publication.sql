-- ═══════════════════════════════════════════════════════════════════════════
--  PUBLIER UNE SÉANCE — ce que les étudiants ont le droit de voir
--
--  Constat du 09/09 : la séance 1 faite avec le BTS1, et la séance 2 déjà
--  lisible sur le site du cours. Rien ne l'empêchait : le sommaire du site
--  liste les quatorze séances dès qu'elles sont écrites, et `ouverte` ne
--  gouverne que l'enregistrement des réponses, pas la lecture.
--
--  Deux notions qu'on confondait, et qui ne veulent pas dire la même chose :
--
--    ouverte  — la séance accepte des réponses. Vraie pendant l'heure,
--               fausse avant et après.
--    publiee  — les étudiants ont le droit de la lire. Fausse jusqu'au jour
--               de la séance, puis vraie POUR TOUJOURS : la trace écrite sert
--               à réviser, et un absent doit pouvoir rattraper.
--
--  Le geste normal ne change pas : « Démarrer la séance » publie aussi. On ne
--  démarre jamais une séance qu'on voulait cacher. Le reste — publier une
--  semaine à l'avance, dépublier un brouillon parti trop tôt — passe par
--  publier_seance().
--
--  Les séances déjà jouées sont publiées par cette migration : ce qui a été
--  vu ne se reprend pas.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La colonne ─────────────────────────────────────────────────────────
alter table public.seances add column if not exists publiee boolean not null default false;

-- Les questionnaires et l'appel n'ont pas de trace écrite à lire : leur
-- publication n'a pas de sens, on les met à true pour qu'aucun écran n'ait à
-- traiter un troisième cas.
update public.seances set publiee = true where numero >= 90 and not publiee;

-- Ce qui a déjà été démarré a déjà été vu.
update public.seances set publiee = true where demarree_le is not null and not publiee;

-- Les séances de projet du BTS2 sont consultables en permanence : le tableau
-- de bord PlaylistApp n'est pas une trace écrite qu'on dévoile semaine après
-- semaine.
update public.seances set publiee = true where nature = 'projet' and not publiee;

-- ─── 2. Démarrer publie ────────────────────────────────────────────────────
create or replace function public.demarrer_seance(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  -- Redémarrer une séance déjà lancée remet le chrono à zéro : c'est voulu,
  -- cela permet de rattraper un démarrage anticipé par erreur.
  --
  -- Et démarrer publie : on ne démarre jamais une séance qu'on voulait cacher.
  -- Un geste de plus le jour J serait un geste oublié un jour sur deux.
  update public.seances
     set ouverte = true, demarree_le = now(), publiee = true
   where id = p_seance_id;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;
  return jsonb_build_object('ok', true);
end; $$;

-- ─── 3. Publier et dépublier à la main ─────────────────────────────────────
--  Dépublier n'efface rien : les réponses restent, la séance disparaît
--  seulement du site du cours. C'est réversible, contrairement à un retrait.
create or replace function public.publier_seance(p_seance_id bigint, p_publiee boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_num int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select numero into v_num from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  -- Au-dessus de 90 il n'y a pas de trace écrite : questionnaires et appel se
  -- pilotent avec leur propre geste.
  if v_num >= 90 then return jsonb_build_object('ok', false, 'motif', 'numero'); end if;

  update public.seances set publiee = p_publiee where id = p_seance_id;
  return jsonb_build_object('ok', true, 'publiee', p_publiee);
end; $$;

grant execute on function public.publier_seance(bigint, boolean) to authenticated;

-- ─── 4. Le site du cours doit pouvoir lire cette colonne ───────────────────
--  suivi.js interroge `seances` avec la clé anon : sans policy de lecture, la
--  séance serait introuvable et la page s'afficherait entièrement — l'inverse
--  du but recherché.
--
--  Simple avertissement, pas une erreur : la base d'essai de la chaîne
--  d'intégration reconstitue le socle d'août sans ses policies, et faire
--  échouer la migration pour cela bloquerait un contrôle qui a par ailleurs
--  toute sa valeur. La vérification qui compte se fait sur la vraie base, en
--  lisant `seances` avec la clé anon.
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'seances'
                    and cmd = 'SELECT') then
    raise notice 'ATTENTION : aucune policy de lecture sur seances. Sur la vraie base, le site du cours ne saurait pas ce qui est publie.';
  end if;
end $$;

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.seances where numero < 90 and not publiee;
  raise notice 'Publication : % seance(s) de cours encore non publiee(s).', n;

  select count(*) into n from public.seances where numero >= 90 and not publiee;
  if n > 0 then raise exception '% questionnaire(s) ou appel non publie(s)', n; end if;

  select count(*) into n from public.seances where demarree_le is not null and not publiee;
  if n > 0 then raise exception '% seance(s) demarree(s) mais non publiee(s)', n; end if;
end $$;
