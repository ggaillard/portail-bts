-- ═══════════════════════════════════════════════════════════════════════════
--  UN QUESTIONNAIRE RATTACHÉ À SA SÉANCE
--
--  Jusqu'ici un questionnaire était donné à une **classe**, et rien ne disait
--  à quel moment du semestre il allait. On l'allumait à la main le jour dit —
--  et on l'éteignait le lendemain, quand on y repensait.
--
--  Il porte désormais un lien : « ce questionnaire accompagne la séance N ».
--
--  **Le modèle ne change pas pour autant** : le questionnaire reste une séance
--  de la bande 90-98, avec ses propres corrigés et ses propres réponses. Les
--  trois natures — cours (< 90), questionnaire (90-98), appel (99) — gardent
--  leurs trois gestes distincts. Les fondre ferait qu'un jour l'une fermerait
--  l'autre ; c'est arrivé avec `preflight_seance()`, on ne recommence pas.
--
--  Ce qui est ajouté :
--    1. `seances.rattachee_a` — le lien, avec son garde-fou de cohérence ;
--    2. un déclencheur : le questionnaire **suit l'ouverture de sa séance** ;
--    3. `rattacher_questionnaire()` — attacher, détacher ;
--    4. `bibliotheque()` enrichie : le rattachement, et les séances candidates.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le lien ────────────────────────────────────────────────────────────
alter table public.seances
  add column if not exists rattachee_a bigint references public.seances(id)
  on delete set null;

create index if not exists seances_rattachee_idx on public.seances(rattachee_a);

comment on column public.seances.rattachee_a is
  'Pour une séance 90-98 : la séance de cours qu''elle accompagne. '
  'Le questionnaire suit alors son ouverture et sa clôture.';

-- ─── 2. Le garde-fou ───────────────────────────────────────────────────────
--  Trois façons de se tromper, et chacune donnerait un questionnaire qui
--  s'allume au mauvais moment, ou pour la mauvaise promo :
--    · rattacher un cours à autre chose — seul un 90-98 se rattache ;
--    · viser un questionnaire ou l'appel — la cible est un cours ;
--    · viser la séance d'une autre classe — le lien traverserait les promos.
create or replace function public.verifier_rattachement()
returns trigger language plpgsql as $$
declare v_cible public.seances;
begin
  if new.rattachee_a is null then
    return new;
  end if;

  if new.numero is null or new.numero < 90 or new.numero > 98 then
    raise exception 'Seule une séance de questionnaire (90-98) se rattache à '
                    'une séance de cours ; celle-ci porte le numéro %.', new.numero;
  end if;

  select * into v_cible from public.seances where id = new.rattachee_a;
  if not found then
    raise exception 'Séance cible introuvable (id %).', new.rattachee_a;
  end if;
  if v_cible.numero >= 90 then
    raise exception 'On ne rattache pas un questionnaire à la séance % : '
                    'ce n''est pas une séance de cours.', v_cible.numero;
  end if;
  if v_cible.classe_id is distinct from new.classe_id then
    raise exception 'La séance % appartient à une autre classe : un '
                    'rattachement ne traverse pas les promotions.', v_cible.numero;
  end if;

  return new;
end; $$;

drop trigger if exists rattachement_coherent on public.seances;
create trigger rattachement_coherent
  before insert or update of rattachee_a, classe_id, numero on public.seances
  for each row execute function public.verifier_rattachement();

-- ─── 3. Le suivi automatique ───────────────────────────────────────────────
--  Un déclencheur sur `ouverte`, et non une retouche de `demarrer_seance()` /
--  `clore_seance()` : toutes les routes qui ouvrent ou ferment une séance
--  passent par la colonne, aucune par une seule fonction. Retoucher les deux
--  fonctions aurait laissé passer les chemins qu'on oublie — et il aurait
--  fallu les réécrire en entier, avec le risque d'écrasement qu'on connaît.
--
--  Pas de récursion possible : le déclencheur ne s'arme que sur une séance de
--  cours (`numero < 90`), et n'écrit que sur des 90-98.
create or replace function public.questionnaire_suit_sa_seance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.seances
     set ouverte = new.ouverte
   where rattachee_a = new.id
     and ouverte is distinct from new.ouverte;
  return null;
end; $$;

drop trigger if exists questionnaire_suit on public.seances;
create trigger questionnaire_suit
  after update of ouverte on public.seances
  for each row
  when (old.ouverte is distinct from new.ouverte
        and new.numero is not null and new.numero < 90)
  execute function public.questionnaire_suit_sa_seance();

-- ─── 4. Attacher, détacher ─────────────────────────────────────────────────
--  `p_cible` à null détache. Détacher **n'éteint pas** : un questionnaire
--  visible qui disparaîtrait de l'écran des étudiants parce qu'on a changé
--  son rangement serait une surprise. L'interrupteur reste le seul geste qui
--  décide de ce qu'ils voient.
create or replace function public.rattacher_questionnaire(
  p_seance_id bigint, p_cible bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.seances; v_c public.seances;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero not between 90 and 98 then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;

  if p_cible is null then
    update public.seances set rattachee_a = null where id = p_seance_id;
    return jsonb_build_object('ok', true, 'rattachee_a', null,
                              'ouvert', v_s.ouverte);
  end if;

  select * into v_c from public.seances where id = p_cible;
  if not found then return jsonb_build_object('ok', false, 'motif', 'cible'); end if;
  if v_c.classe_id is distinct from v_s.classe_id then
    return jsonb_build_object('ok', false, 'motif', 'autre_classe');
  end if;
  if v_c.numero >= 90 then
    return jsonb_build_object('ok', false, 'motif', 'pas_un_cours');
  end if;

  update public.seances set rattachee_a = p_cible where id = p_seance_id;

  -- Rattacher à une séance déjà en cours, c'est vouloir le poser maintenant :
  -- « la séance du jour » n'aurait aucun sens si elle n'allumait rien.
  if v_c.ouverte and not v_s.ouverte then
    update public.seances set ouverte = true where id = p_seance_id;
  end if;

  return jsonb_build_object('ok', true,
    'rattachee_a', p_cible,
    'numero', v_c.numero,
    'titre', v_c.titre,
    'ouvert', v_c.ouverte or v_s.ouverte,
    'allume_maintenant', v_c.ouverte and not v_s.ouverte);
end; $$;

grant execute on function public.rattacher_questionnaire(bigint, bigint) to authenticated;

-- ─── 5. `bibliotheque()` — le rattachement et les séances candidates ───────
--  ⚠️ Réécrite en entier ; cette définition-ci gagne, puisqu'elle passe après
--  `20260908130000_gerer_questionnaires.sql`. Toute correction apportée là-bas
--  et pas ici serait écrasée en silence. Deux ajouts seulement : le
--  rattachement de chaque affectation, et `seances` sur chaque classe — la
--  liste où l'on choisit, avec la séance en cours signalée.
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
           s.rattachee_a,
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
    select a.*,
      (select count(*) from (
         select r.eleve_id
           from public.reponses r
           join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
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
                   'rattachee_ouverte', a.r_ouverte)
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
       -- Les séances auxquelles on peut rattacher, dans l'ordre du semestre.
       -- `en_cours` est ce qui permet de dire « la séance du jour » sans la
       -- chercher : c'est celle qui est ouverte et démarrée.
       'seances', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'seance_id', s.id, 'numero', s.numero, 'titre', s.titre,
                   'en_cours', s.ouverte and s.demarree_le is not null)
                 order by s.numero)
            from public.seances s
           where s.classe_id = c.id and s.numero < 90), '[]'::jsonb))
     order by c.code)
     from classes c)
  into v_mod, v_cl;

  return jsonb_build_object('ok', true,
    'modeles', coalesce(v_mod, '[]'::jsonb),
    'classes', coalesce(v_cl, '[]'::jsonb));
end; $$;

grant execute on function public.bibliotheque() to authenticated;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'seances'
     and column_name = 'rattachee_a';
  if v_n <> 1 then raise exception 'colonne rattachee_a absente'; end if;

  select count(*) into v_n from pg_trigger
   where tgname in ('rattachement_coherent', 'questionnaire_suit')
     and not tgisinternal;
  if v_n <> 2 then
    raise exception 'déclencheurs du rattachement : % trouvé(s), attendu 2', v_n;
  end if;

  raise notice 'Rattachement en place : un questionnaire suit l''ouverture de '
               'la séance qu''il accompagne.';
end $$;
