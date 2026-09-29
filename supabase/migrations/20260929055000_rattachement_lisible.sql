-- ═══════════════════════════════════════════════════════════════════════════
--  RATTACHER UN QUESTIONNAIRE — et choisir ce que le rattachement fait
--
--  29/09. Le rattachement existait depuis le 16/09 (« Avec la séance… »),
--  mais il ne savait faire qu'une chose : le questionnaire s'ouvrait ET se
--  fermait avec sa séance. Pour une révision, c'est l'inverse de ce qu'on
--  veut — rattachée à la dernière séance du module, elle disparaissait à la
--  clôture de l'heure, alors qu'elle doit rester ouverte jusqu'à l'évaluation.
--
--  Deux réglages, portés par la séance du questionnaire (bande 90-98) :
--
--    · `reste_ouvert` — rattaché, il s'ouvre avec sa séance, et NE SE FERME
--      PAS avec elle. Faux par défaut : le comportement du 16/09 ne change
--      pour aucun questionnaire déjà rattaché ;
--    · `visible_jusqu_au` — une date au-delà de laquelle les étudiants ne le
--      voient plus, rattaché ou non. `mes_questionnaires()` le masque (voir
--      20260929060000). C'est un masquage, pas un verrou : il n'y a pas de
--      tâche planifiée dans la base pour éteindre à minuit, et l'interrupteur
--      reste le geste qui décide.
--
--  ⚠️ `questionnaire_suit_sa_seance()` et `bibliotheque()` sont RÉÉCRITES EN
--  ENTIER, et ces définitions gagnent sur celles du 16/09. Corriger les
--  anciennes sans corriger celles-ci ne changerait rien — le piège de
--  `preflight_seance()`.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les deux réglages ──────────────────────────────────────────────────
alter table public.seances add column if not exists reste_ouvert boolean not null default false;
alter table public.seances add column if not exists visible_jusqu_au date;

comment on column public.seances.reste_ouvert is
  'Questionnaire (90-98) rattaché : s''ouvre avec sa séance mais ne se ferme pas '
  'avec elle. Faux par défaut — il suit la séance dans les deux sens.';
comment on column public.seances.visible_jusqu_au is
  'Questionnaire (90-98) : au-delà de cette date, mes_questionnaires() ne le '
  'montre plus. Masquage, pas verrou.';

-- ─── 2. Le suivi automatique, dans un sens ou dans les deux ────────────────
--  Même déclencheur, même garde contre la récursion (armé sur numero < 90,
--  n'écrit que sur des 90-98). Seul change le sens de la fermeture.
create or replace function public.questionnaire_suit_sa_seance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ouverte then
    update public.seances
       set ouverte = true
     where rattachee_a = new.id and not ouverte;
  else
    update public.seances
       set ouverte = false
     where rattachee_a = new.id and ouverte and not reste_ouvert;
  end if;
  return null;
end; $$;

-- ─── 3. `regler_questionnaire()` — les deux réglages, d'un geste ───────────
--  Un geste à part de `rattacher_questionnaire()`, qui ne change pas de
--  signature : lui ajouter deux paramètres aurait créé une seconde surcharge.
--  `p_jusqu_au` à null retire la date. Une date déjà passée est refusée : elle
--  masquerait le questionnaire sur-le-champ, ce qui n'est jamais ce qu'on
--  voulait en la tapant.
create or replace function public.regler_questionnaire(
  p_seance_id bigint, p_reste_ouvert boolean, p_jusqu_au date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.seances;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero not between 90 and 98 then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;
  if p_jusqu_au is not null and p_jusqu_au < current_date then
    return jsonb_build_object('ok', false, 'motif', 'date_passee');
  end if;

  update public.seances
     set reste_ouvert = coalesce(p_reste_ouvert, false),
         visible_jusqu_au = p_jusqu_au
   where id = p_seance_id;

  return jsonb_build_object('ok', true, 'reste_ouvert', coalesce(p_reste_ouvert, false),
                            'visible_jusqu_au', p_jusqu_au);
end; $$;

grant execute on function public.regler_questionnaire(bigint, boolean, date) to authenticated;

-- ─── 4. `bibliotheque()` — les deux réglages, et l'échéance passée ─────────
--  Réécrite en entier (voir l'en-tête). Ajouts : `reste_ouvert`,
--  `visible_jusqu_au`, `expire` sur chaque affectation, et `classe_id` /
--  `module_titre` sur les séances candidates — la fiche d'une séance, sous
--  Préparer, lit la même réponse pour dire ce qui l'accompagne.
create or replace function public.bibliotheque()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mod jsonb; v_cl jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  with classes as (
    select c.id, c.code, c.nom from public.classes c where c.code not like 'DEMO%'
  ),
  aff as (
    select s.id as seance_id, s.classe_id, s.numero, s.ouverte, s.modele_id,
           s.rattachee_a, s.reste_ouvert, s.visible_jusqu_au,
           c.code, c.nom,
           (select count(*) from public.corriges co where co.seance_id = s.id) as questions,
           (select count(*) from public.eleves e
             where e.classe_id = s.classe_id and e.numero <> '99')             as inscrits,
           (select count(distinct r.eleve_id) from public.reponses r
              join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
             where r.seance_id = s.id)                                         as commences
      from public.seances s
      join classes c on c.id = s.classe_id
     where s.numero between 90 and 98
  ),
  aff2 as (
    -- « Terminé » compte les questions à corrigé seulement : la certitude
    -- (clé -c, sans corrigé) ferait sinon terminer à mi-parcours.
    select a.*,
      (select count(*) from (
         select r.eleve_id
           from public.reponses r
           join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
           join public.corriges co on co.seance_id = r.seance_id and co.question = r.question
          where r.seance_id = a.seance_id
          group by r.eleve_id
         having count(distinct r.question) >= a.questions and a.questions > 0
       ) t) as termines
      from aff a
  ),
  aff3 as (
    select a.*, r.numero as r_numero, r.titre as r_titre, r.ouverte as r_ouverte
      from aff2 a
      left join public.seances r on r.id = a.rattachee_a
  )
  select
    (select jsonb_agg(jsonb_build_object(
       'id', m.id, 'cle', m.cle, 'titre', m.titre, 'intro', m.intro, 'mode', m.mode,
       'questions', (select count(*) from public.modele_questions q where q.modele_id = m.id),
       'affectations', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'seance_id', a.seance_id, 'classe_id', a.classe_id,
                   'code', a.code, 'nom', a.nom, 'numero', a.numero,
                   'ouvert', a.ouverte, 'inscrits', a.inscrits,
                   'commences', a.commences, 'termines', a.termines,
                   'rattachee_a', a.rattachee_a,
                   'rattachee_numero', a.r_numero,
                   'rattachee_titre', a.r_titre,
                   'rattachee_ouverte', a.r_ouverte,
                   'reste_ouvert', a.reste_ouvert,
                   'visible_jusqu_au', a.visible_jusqu_au,
                   'expire', a.visible_jusqu_au is not null
                             and a.visible_jusqu_au < current_date)
                 order by a.code)
            from aff3 a where a.modele_id = m.id), '[]'::jsonb))
     order by m.cree_le, m.id)
     from public.modeles m),
    (select jsonb_agg(jsonb_build_object(
       'classe_id', c.id, 'code', c.code, 'nom', c.nom,
       'poses', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'modele_id', a.modele_id, 'seance_id', a.seance_id,
                   'numero', a.numero, 'ouvert', a.ouverte,
                   'termines', a.termines, 'inscrits', a.inscrits)
                 order by a.numero)
            from aff3 a where a.classe_id = c.id and a.modele_id is not null), '[]'::jsonb),
       'seances', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'seance_id', s.id, 'numero', s.numero, 'titre', s.titre,
                   'module_titre', mo.titre,
                   'en_cours', s.ouverte and s.demarree_le is not null)
                 order by s.numero)
            from public.seances s
            left join public.modules mo on mo.id = s.module_id
           where s.classe_id = c.id and s.numero < 90), '[]'::jsonb))
     order by c.code)
     from classes c)
  into v_mod, v_cl;

  return jsonb_build_object('ok', true,
    'modeles', coalesce(v_mod, '[]'::jsonb),
    'classes', coalesce(v_cl, '[]'::jsonb));
end; $$;

grant execute on function public.bibliotheque() to authenticated;

-- ─── 5. Ce qui doit tenir ──────────────────────────────────────────────────
do $$
declare v_cours bigint; v_q1 bigint; v_q2 bigint; v_classe bigint; v jsonb;
begin
  select id into v_classe from public.classes where code = 'BTS2-SLAM-2026';
  if v_classe is null then raise notice 'Pas de BTS2 : rattachement non vérifié.'; return; end if;

  -- Tout le bloc est annulé à la fin : rien de ce qu'il crée ne reste.
  begin
    -- Une séance de cours, deux questionnaires rattachés : l'un suit, l'autre
    -- reste. Numéros d'essai choisis hors de ce qu'on pose (89, 95, 96).
    insert into public.seances (classe_id, numero, titre, ouverte)
    values (v_classe, 89, 'essai rattachement', false) returning id into v_cours;
    insert into public.seances (classe_id, numero, titre, ouverte, rattachee_a, reste_ouvert)
    values (v_classe, 95, 'suit', false, v_cours, false) returning id into v_q1;
    insert into public.seances (classe_id, numero, titre, ouverte, rattachee_a, reste_ouvert)
    values (v_classe, 96, 'reste', false, v_cours, true) returning id into v_q2;

    update public.seances set ouverte = true where id = v_cours;
    if not (select ouverte from public.seances where id = v_q1)
       or not (select ouverte from public.seances where id = v_q2) then
      raise exception 'rattachement : démarrer la séance n''a pas ouvert ses deux questionnaires';
    end if;
    update public.seances set ouverte = false where id = v_cours;
    if (select ouverte from public.seances where id = v_q1) then
      raise exception 'rattachement : le questionnaire qui suit est resté ouvert à la clôture';
    end if;
    if not (select ouverte from public.seances where id = v_q2) then
      raise exception 'rattachement : le questionnaire « reste ouvert » s''est fermé avec la séance';
    end if;

    if public.est_enseignant() then
      v := public.regler_questionnaire(v_q1, true, current_date - 1);
      if (v->>'motif') is distinct from 'date_passee' then
        raise exception 'regler_questionnaire accepte une date passée : %', v;
      end if;
      v := public.regler_questionnaire(v_cours, true, null);
      if (v->>'motif') is distinct from 'numero' then
        raise exception 'regler_questionnaire règle une séance de cours : %', v;
      end if;
      v := public.regler_questionnaire(v_q1, true, current_date + 7);
      if not (v->>'ok')::boolean
         or not (select reste_ouvert from public.seances where id = v_q1) then
        raise exception 'regler_questionnaire n''a rien réglé : %', v;
      end if;
    end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;

  raise notice 'Rattachement : suit la séance, ou reste ouvert ; échéance réglable.';
end $$;
