-- ═══════════════════════════════════════════════════════════════════════════
--  PILOTAGE DE SÉANCE — démarrage, contrôle d'avant-séance, rythme
--
--  Trois choses, toutes réservées à l'enseignant :
--   • démarrer / clore une séance depuis le portail, sans passer par le SQL ;
--   • un contrôle d'avant-séance qui dit en un coup d'œil si tout est en place ;
--   • le repère de temps qui permet de savoir si la classe suit la cadence.
--
--  Le chrono part du bouton « Démarrer », pas de la première réponse : des
--  étudiants travaillent avec une ou deux séances d'avance, leurs réponses
--  antérieures ne doivent pas fausser le rythme du jour.
--
--  À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Deux colonnes sur les séances ──────────────────────────────────────
alter table public.seances add column if not exists demarree_le timestamptz;
alter table public.seances add column if not exists duree_min   int not null default 55;

-- ─── 2. Démarrer et clore, depuis le portail ───────────────────────────────
create or replace function public.demarrer_seance(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  -- Redémarrer une séance déjà lancée remet le chrono à zéro : c'est voulu,
  -- cela permet de rattraper un démarrage anticipé par erreur.
  update public.seances
     set ouverte = true, demarree_le = now()
   where id = p_seance_id;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.clore_seance(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  -- On ferme aux réponses mais on garde demarree_le : la trace de l'heure
  -- de début reste lisible après coup.
  update public.seances set ouverte = false where id = p_seance_id;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;
  return jsonb_build_object('ok', true);
end; $$;

-- ─── 3. Le contrôle d'avant-séance ─────────────────────────────────────────
--  Une seule requête pour les quatre vérifications, plus les repères de
--  rythme. Les PIN ne sortent jamais : on ne renvoie que des comptes.
create or replace function public.preflight_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s        public.seances;
  v_classe   public.classes;
  v_questions int;
  v_appel    boolean;
  v_eleves   int;
  v_pin      int;
  v_connect  int;
  v_avance   int;
  v_seances_avance text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  select * into v_classe from public.classes where id = v_s.classe_id;

  select count(*) into v_questions
    from public.corriges where seance_id = v_s.id;

  select exists (
    select 1 from public.corriges co
      join public.seances sa on sa.id = co.seance_id
     where sa.classe_id = v_s.classe_id and sa.numero = 99
       and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD')
  ) into v_appel;

  -- Le compte d'essai n° 99 n'est pas un étudiant : le tableau de bord
  -- l'exclut déjà de ses effectifs (chargerStats fait .neq("numero","99")).
  -- Le pré-vol doit dire le même nombre, sinon il annonce 32 étudiants à un
  -- enseignant qui en a 31 et fait douter du reste de la liste.
  select count(*), count(*) filter (where pin is not null),
         count(*) filter (where auth_id is not null)
    into v_eleves, v_pin, v_connect
    from public.eleves
   where classe_id = v_s.classe_id and numero <> '99';

  -- Les étudiants qui travaillent déjà au-delà de cette séance. On les compte
  -- à part : ils ne sont ni absents ni en retard, ils sont ailleurs.
  select count(distinct r.eleve_id),
         string_agg(distinct sa.numero::text, ', ' order by sa.numero::text)
    into v_avance, v_seances_avance
    from public.reponses r
    join public.seances sa on sa.id = r.seance_id
    join public.eleves  e  on e.id = r.eleve_id
   where e.classe_id = v_s.classe_id
     and sa.numero <> 99
     and sa.numero > v_s.numero;

  return jsonb_build_object(
    'ok', true,
    'classe',            v_classe.code,
    'seance',            v_s.numero,
    'titre',             v_s.titre,
    'ouverte',           v_s.ouverte,
    'notee',             v_s.notee,
    'demarree_le',       v_s.demarree_le,
    'duree_min',         v_s.duree_min,
    'questions',         v_questions,
    'appel_du_jour',     v_appel,
    'eleves',            v_eleves,
    'avec_pin',          v_pin,
    'deja_connectes',    v_connect,
    'en_avance',         coalesce(v_avance, 0),
    'seances_en_avance', coalesce(v_seances_avance, '')
  );
end; $$;

grant execute on function public.demarrer_seance(bigint)  to authenticated;
grant execute on function public.clore_seance(bigint)     to authenticated;
grant execute on function public.preflight_seance(bigint) to authenticated;

-- ─── 4. Durées particulières, si besoin ────────────────────────────────────
--  55 minutes par défaut. Pour une séance plus courte ou une évaluation :
--    update public.seances set duree_min = 40 where id = 123;
