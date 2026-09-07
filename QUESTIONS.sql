-- ═══════════════════════════════════════════════════════════════════════════
--  RELIRE LES QUESTIONS D'UNE SÉANCE — sans dépendre de la RLS
--
--  Le portail lisait la table corriges directement pour afficher les énoncés.
--  Si la RLS interdit cette lecture — ce qui est souhaitable, un étudiant ne
--  doit jamais lire les bonnes réponses — le panneau reste vide sans dire
--  pourquoi. On passe donc par une fonction, comme tout le reste du portail.
--
--  À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.questions_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s   public.seances;
  v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  select jsonb_build_object(
    'ok', true,
    'seance', v_s.numero,
    'titre',  v_s.titre,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question',      question,
               'intitule',      intitule,
               'options',       to_jsonb(options),
               'bonne_reponse', bonne_reponse,
               'explication',   explication)
             order by question)
        from public.corriges where seance_id = p_seance_id), '[]'::jsonb))
  into v_res;

  return v_res;
end; $$;

grant execute on function public.questions_seance(bigint) to authenticated;

-- ─── 2. Ce qui compte comme jalon franchi ──────────────────────────────────
--  Vérifié dans le dépôt playlist-csharp (docs/assets/suivi.js et
--  SUIVI_SUPABASE.md, qui l'écrit noir sur blanc) : le tableau de bord
--  n'enregistre PAS les missions comme les quiz.
--
--    tp2-m1   → « true » / « false »   une mission cochée ou décochée
--    tp1-c0   → « true » / « false »   une fiche concept lue — même statut
--    tp2-s1   → « true » / « false »   une mise en route — même statut
--    q-3-2    → « ok » / « ko »        une question de quiz
--    q-3-2-pick → « 0 » à « 3 »        l'option choisie, jamais un jalon
--    jalon-…  → question d'avancement, corrigée, jamais un jalon
--
--  Deux erreurs successives à ne pas refaire :
--   · compter toutes les lignes → la répartition affichait « 15/5 », plus de
--     jalons franchis qu'il n'en existe, parce que les quiz étaient comptés ;
--   · compter « reponse = ''ok'' » sur « tp%-m% » → zéro pour tout le monde,
--     car aucune mission ne vaut « ok », et parce que les 29 items du parcours
--     ne sont pas tous des « -m » : le TP0 n'en a aucun (tp0-1 à tp0-3), et
--     chaque TP a sa fiche concept « -c0 » et ses mises en route « -s1/-s2 ».
--
--  La règle juste tient en une ligne : une clé qui commence par « tp », dont
--  la réponse vaut « true ». Elle donne bien 3, 5, 8, 7 et 6 jalons par TP,
--  ce que déclare PROJET.sql.
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
    from (select count(*) filter (where reponse in ('true', 'ok')
                                    and question like 'tp%') as faits
            from public.reponses where seance_id = v_s.id group by eleve_id) c;

  with avance as (
    select e.id, e.numero, e.avatar,
           count(r.id) filter (where r.reponse in ('true', 'ok')
                                and r.question like 'tp%')          as faits,
           count(r.id) filter (where r.question like 'jalon-%')     as questions,
           count(r.id) filter (where r.question like 'jalon-%'
                                and r.correct)                      as questions_ok,
           max(r.updated_at)                                        as dernier,
           min(r.updated_at)                                        as premier
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

-- Contrôle : le compte de questions par séance, toutes classes réelles.
select c.code, s.numero, s.titre, count(co.id) as questions
  from public.classes c
  join public.seances s on s.classe_id = c.id
  left join public.corriges co on co.seance_id = s.id
 where c.code not like 'DEMO%'
 group by c.code, s.numero, s.titre
 order by c.code, s.numero;
