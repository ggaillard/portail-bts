-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCES DE PROJET — nature, jalons, et un suivi qui tient compte des rythmes
--
--  Deux natures de séance, deux lectures :
--
--   • « cours »  — une heure, une cadence. Le retard se mesure à l'horloge.
--   • « projet » — chacun avance à sa vitesse, parfois avec une ou deux
--                  séances d'avance. Le retard à l'horloge n'y veut rien dire :
--                  ce qui compte est l'ARRÊT (plus de progrès depuis des jours)
--                  et l'ÉCART À L'ÉCHÉANCE (finira-t-il au rythme actuel ?).
--
--  À coller dans Supabase → SQL Editor → Run. Après SEANCE.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Trois colonnes sur les séances ─────────────────────────────────────
alter table public.seances add column if not exists nature   text not null default 'cours';
alter table public.seances add column if not exists jalons   int;
alter table public.seances add column if not exists echeance date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'seances_nature_chk') then
    alter table public.seances
      add constraint seances_nature_chk check (nature in ('cours', 'projet'));
  end if;
end $$;

-- ─── 2. Le BTS2 PlaylistApp est du projet ──────────────────────────────────
--  Les 29 missions du parcours, réparties sur les cinq TP.
update public.seances s
   set nature = 'projet',
       jalons = v.jalons
  from public.classes c,
       (values (0, 3), (1, 5), (2, 8), (3, 7), (4, 6)) as v(numero, jalons)
 where c.id = s.classe_id
   and c.code = 'BTS2-SLAM-2026'
   and s.numero = v.numero;

--  Échéance du projet, à ajuster :
--    update public.seances s set echeance = date '2027-03-15'
--      from public.classes c where c.id = s.classe_id
--       and c.code = 'BTS2-SLAM-2026' and s.nature = 'projet';

-- ─── 3. Le suivi d'une séance de projet ────────────────────────────────────
--  Trois lectures, une seule requête : où se masse la classe, qui s'est
--  arrêté, et qui n'arrivera pas au bout au rythme actuel.
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

  -- À défaut de jalons déclarés, on prend le plus avancé comme référence :
  -- imparfait, mais préférable à un pourcentage calculé sur zéro.
  select coalesce(v_s.jalons, nullif(max(c.faits), 0), 1) into v_jalons
    from (select count(*) as faits from public.reponses
           where seance_id = v_s.id group by eleve_id) c;

  with avance as (
    select e.id, e.numero, e.avatar,
           count(r.id)                                   as faits,
           max(r.updated_at)                             as dernier,
           min(r.updated_at)                             as premier
      from public.eleves e
      left join public.reponses r on r.eleve_id = e.id and r.seance_id = v_s.id
     where e.classe_id = v_s.classe_id
     group by e.id, e.numero, e.avatar
  ),
  calcul as (
    select a.*,
           case when a.dernier is null then null
                else floor(extract(epoch from (now() - a.dernier)) / 86400)::int end as jours_sans,
           -- Rythme observé : jalons franchis par jour depuis le premier.
           case when a.premier is null or a.faits = 0 then null
                else a.faits / greatest(
                       extract(epoch from (now() - a.premier)) / 86400, 1) end        as par_jour
      from avance a
  )
  select jsonb_build_object(
    'ok', true,
    'nature',    v_s.nature,
    'jalons',    v_jalons,
    'echeance',  v_s.echeance,
    'jours_restants', case when v_s.echeance is null then null
                           else (v_s.echeance - current_date) end,
    -- Combien d'étudiants à chaque nombre de jalons franchis.
    'repartition', coalesce((
       select jsonb_agg(jsonb_build_object('faits', faits, 'eleves', n) order by faits)
         from (select faits, count(*) as n from calcul group by faits) t), '[]'::jsonb),
    -- Ceux qui se sont arrêtés : le décrochage se voit à l'arrêt, pas au retard.
    'arretes', coalesce((
       select jsonb_agg(jsonb_build_object(
                'numero', numero, 'avatar', avatar,
                'faits', faits, 'jours', jours_sans) order by jours_sans desc)
         from calcul where jours_sans is not null and jours_sans >= p_jours_arret), '[]'::jsonb),
    -- Ceux qui n'ont jamais rien rendu sur cette séance.
    'jamais_commence', (select count(*) from calcul where faits = 0),
    -- Au rythme observé, qui n'aura pas fini à l'échéance.
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

-- ─── 4. Le contrôle d'avant-séance connaît maintenant la nature ────────────
--  On remplace preflight_seance pour qu'il renvoie nature, jalons et échéance :
--  le portail choisit sa lecture à partir de là.
create or replace function public.preflight_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s        public.seances;
  v_classe   public.classes;
  v_questions int; v_appel boolean;
  v_eleves int; v_pin int; v_connect int;
  v_avance int; v_seances_avance text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  select * into v_classe from public.classes where id = v_s.classe_id;

  select count(*) into v_questions from public.corriges where seance_id = v_s.id;

  select exists (
    select 1 from public.corriges co
      join public.seances sa on sa.id = co.seance_id
     where sa.classe_id = v_s.classe_id and sa.numero = 99
       and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD')
  ) into v_appel;

  select count(*), count(*) filter (where pin is not null),
         count(*) filter (where auth_id is not null)
    into v_eleves, v_pin, v_connect
    from public.eleves where classe_id = v_s.classe_id;

  select count(distinct r.eleve_id),
         string_agg(distinct sa.numero::text, ', ' order by sa.numero::text)
    into v_avance, v_seances_avance
    from public.reponses r
    join public.seances sa on sa.id = r.seance_id
    join public.eleves  e  on e.id = r.eleve_id
   where e.classe_id = v_s.classe_id and sa.numero <> 99 and sa.numero > v_s.numero;

  return jsonb_build_object(
    'ok', true,
    'classe', v_classe.code, 'seance', v_s.numero, 'titre', v_s.titre,
    'nature', v_s.nature, 'jalons', v_s.jalons, 'echeance', v_s.echeance,
    'ouverte', v_s.ouverte, 'notee', v_s.notee,
    'demarree_le', v_s.demarree_le, 'duree_min', v_s.duree_min,
    'questions', v_questions, 'appel_du_jour', v_appel,
    'eleves', v_eleves, 'avec_pin', v_pin, 'deja_connectes', v_connect,
    'en_avance', coalesce(v_avance, 0),
    'seances_en_avance', coalesce(v_seances_avance, '')
  );
end; $$;

grant execute on function public.preflight_seance(bigint) to authenticated;
