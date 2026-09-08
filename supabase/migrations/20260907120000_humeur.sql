-- ═══════════════════════════════════════════════════════════════════════════
--  HUMEUR DE LA CLASSE — la seconde question de l'appel
--
--  Après la question du jour, une question d'humeur, toujours la même, à
--  quatre smileys. Elle ne se note pas : elle donne en un coup d'œil l'état
--  du groupe avant de commencer, et surtout elle laisse dire « je suis
--  perdu » à ceux qui ne lèveraient pas la main.
--
--  Comme la question d'appel, elle se crée toute seule le jour où quelqu'un
--  se connecte : pas de script à lancer chaque matin.
--
--  À coller dans Supabase → SQL Editor → Run. Après APPEL_AUTO.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le modèle d'humeur, une fois par classe ────────────────────────────
insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
select s.id, 'humeur-modele', 'Z',
       'Merci — cette réponse ne compte pas dans vos résultats.',
       'Et aujourd''hui, comment ça va ?',
       array['😀 En forme', '🙂 Ça va', '😴 Fatigué', '😕 Perdu, j''ai besoin d''aide']
  from public.seances s
 where s.numero = 99
   and not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = 'humeur-modele');

-- ─── 2. appel_du_jour() sert les deux questions ────────────────────────────
--  La bonne réponse de l'humeur est « Z », qui n'existe pas : aucune réponse
--  n'est juste, donc rien ne pollue le taux de réussite côté enseignant.
create or replace function public.appel_du_jour()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_eleve  public.eleves;
  v_seance public.seances;
  v_cor    public.corriges;
  v_rep    public.reponses;
  v_modele public.corriges;
  v_hum    public.corriges;
  v_hrep   public.reponses;
  v_q      text := 'appel-'  || to_char(current_date, 'YYYY-MM-DD');
  v_hq     text := 'humeur-' || to_char(current_date, 'YYYY-MM-DD');
  v_humeur jsonb := null;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return null; end if;

  select * into v_seance from public.seances
   where classe_id = v_eleve.classe_id and numero = 99;
  if not found then return null; end if;

  -- ── la question du jour ──
  select * into v_cor from public.corriges
   where seance_id = v_seance.id and question = v_q;
  if not found then
    select * into v_modele from public.corriges
     where seance_id = v_seance.id and question = 'appel-modele';
    if not found then return null; end if;
    insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
    values (v_seance.id, v_q, v_modele.bonne_reponse, v_modele.explication,
            v_modele.intitule, v_modele.options)
    on conflict do nothing;
    select * into v_cor from public.corriges
     where seance_id = v_seance.id and question = v_q;
    if not found then return null; end if;
  end if;

  select * into v_rep from public.reponses
   where eleve_id = v_eleve.id and seance_id = v_seance.id and question = v_q;

  -- ── l'humeur du jour, créée de la même façon ──
  select * into v_hum from public.corriges
   where seance_id = v_seance.id and question = v_hq;
  if not found then
    select * into v_modele from public.corriges
     where seance_id = v_seance.id and question = 'humeur-modele';
    if found then
      insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options)
      values (v_seance.id, v_hq, v_modele.bonne_reponse, v_modele.explication,
              v_modele.intitule, v_modele.options)
      on conflict do nothing;
      select * into v_hum from public.corriges
       where seance_id = v_seance.id and question = v_hq;
    end if;
  end if;

  if v_hum.question is not null then
    select * into v_hrep from public.reponses
     where eleve_id = v_eleve.id and seance_id = v_seance.id and question = v_hq;
    v_humeur := jsonb_build_object(
      'question',   v_hq,
      'intitule',   coalesce(v_hum.intitule, 'Comment ça va ?'),
      'options',    to_jsonb(v_hum.options),
      'repondu',    found,
      'ma_reponse', v_hrep.reponse);
  end if;

  select * into v_rep from public.reponses
   where eleve_id = v_eleve.id and seance_id = v_seance.id and question = v_q;

  return jsonb_build_object(
    'seance_id',  v_seance.id,
    'question',   v_q,
    'intitule',   coalesce(v_cor.intitule, 'Question du jour'),
    'options',    to_jsonb(v_cor.options),
    'repondu',    found,
    'ma_reponse', v_rep.reponse,
    'humeur',     v_humeur);
end; $$;

grant execute on function public.appel_du_jour() to anon, authenticated;

-- ─── 3. L'enseignant voit l'humeur du groupe ───────────────────────────────
create or replace function public.appel_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seance bigint;
  v_q  text := 'appel-'  || to_char(current_date, 'YYYY-MM-DD');
  v_hq text := 'humeur-' || to_char(current_date, 'YYYY-MM-DD');
  v_intitule text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select id into v_seance from public.seances
   where classe_id = p_classe_id and numero = 99;
  if not found then return jsonb_build_object('ok', false, 'motif', 'pas_de_seance'); end if;

  select intitule into v_intitule from public.corriges
   where seance_id = v_seance and question = v_q;
  if not found then return jsonb_build_object('ok', true, 'pose', false); end if;

  return (
    with etat as (
      select e.numero, e.avatar, r.updated_at
        from public.eleves e
        left join public.reponses r
               on r.eleve_id = e.id and r.seance_id = v_seance and r.question = v_q
       where e.classe_id = p_classe_id
    ),
    humeurs as (
      select r.reponse, count(*) as n
        from public.reponses r
        join public.eleves e on e.id = r.eleve_id
       where e.classe_id = p_classe_id and r.seance_id = v_seance and r.question = v_hq
       group by r.reponse
    )
    select jsonb_build_object(
      'ok', true, 'pose', true, 'intitule', v_intitule,
      'presents', coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar,
                     'heure', to_char(updated_at at time zone 'Europe/Paris', 'HH24:MI'))
                   order by updated_at) from etat where updated_at is not null), '[]'::jsonb),
      'absents',  coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar)
                   order by numero) from etat where updated_at is null), '[]'::jsonb),
      -- L'humeur, rendue par lettre : le portail y remet les smileys.
      'humeur',   coalesce((select jsonb_object_agg(reponse, n) from humeurs), '{}'::jsonb),
      'humeur_options', coalesce((select to_jsonb(options) from public.corriges
                                   where seance_id = v_seance and question = v_hq), 'null'::jsonb))
  );
end; $$;

grant execute on function public.appel_classe(bigint) to authenticated;

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
select c.code, co.question, left(co.intitule, 50) as intitule
  from public.corriges co
  join public.seances s on s.id = co.seance_id
  join public.classes c on c.id = s.classe_id
 where s.numero = 99 order by c.code, co.question;
