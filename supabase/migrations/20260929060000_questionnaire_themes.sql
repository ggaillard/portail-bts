-- ═══════════════════════════════════════════════════════════════════════════
--  L'AUTO-ÉVALUATION PAR THÈME — ce qu'un questionnaire de révision rend
--
--  29/09. Réviser un module entier avant une évaluation sur table demande de
--  savoir OÙ l'on est fragile, pas seulement combien on a de justes. « 14 sur
--  24 » ne dit pas quoi relire ; « EF Core : 2 sur 6 » le dit.
--
--  Ce que cette migration ajoute, sans toucher aux trois modes ni aux trois
--  gestes :
--
--    1. un THÈME par question — `[TP2] Intitulé · …` dans le texte collé ;
--    2. la CERTITUDE, facultative, en mode révision : après avoir choisi,
--       l'étudiant dit s'il était sûr, s'il hésitait, ou s'il répondait au
--       hasard — AVANT de voir la correction, sinon la réponse ne vaut rien ;
--    3. `mes_questionnaires()` rend un BILAN par thème, et ne compte plus les
--       réponses de certitude comme des questions faites ;
--       Il masque aussi un questionnaire dont l'échéance est passée
--       (`visible_jusqu_au`, posée la migration précédente) ;
--    4. `depouiller_questionnaire()` rend, en mode révision, la lecture par
--       thème : taux de la classe, numéros fragiles, numéros sûrs et faux.
--
--  La certitude s'écrit comme une réponse ordinaire, sous la clé de la
--  question suivie de `-c` (S sûr · H hésitant · X au hasard) — même
--  convention que le contrôle d'entrée (`pre-NN-c`). Elle n'a PAS de corrigé :
--  un corrigé la ferait apparaître comme une question de plus à l'écran.
--  Toute fonction qui compte des réponses de questionnaire doit donc ne
--  compter que les clés qui ont un corrigé — c'est ce que font les deux
--  fonctions réécrites ici.
--
--  ⚠️ `creer_modele()`, `mes_questionnaires()` et `depouiller_questionnaire()`
--  sont RÉÉCRITES EN ENTIER, et ces définitions gagnent sur celles des 08/09
--  et 16/09. Corriger les anciennes sans corriger celles-ci ne changerait
--  rien — le piège de `preflight_seance()`.
--
--  `affecter_questionnaire()` n'est PAS réécrite : un déclencheur sur
--  `corriges` recopie le thème depuis le modèle. Une réécriture de plus aurait
--  été une définition de plus à tenir d'accord.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les colonnes ───────────────────────────────────────────────────────
alter table public.modele_questions add column if not exists theme text;
alter table public.corriges         add column if not exists theme text;
alter table public.modeles          add column if not exists certitude boolean not null default false;

comment on column public.modele_questions.theme is
  'Le thème de la question — « TP2 », « LINQ »… Lisible par tous : il ne dit '
  'rien de la bonne réponse. Sert au bilan par thème.';
comment on column public.modeles.certitude is
  'Mode revision seulement : demander « sûr / hésitant / au hasard » après '
  'chaque réponse, avant la correction. Réponse rangée sous <clé>-c, sans corrigé.';

-- ─── 2. Le thème suit la question jusque dans les corrigés ─────────────────
--  Un déclencheur plutôt qu'une réécriture d'`affecter_questionnaire()` :
--  toutes les routes qui posent un corrigé de questionnaire passent par un
--  insert, aucune par une seule fonction (la migration du 16/09 en écrit elle-
--  même, sans passer par la fonction).
create or replace function public.corrige_prend_theme()
returns trigger language plpgsql as $$
begin
  if new.theme is null then
    select q.theme into new.theme
      from public.seances s
      join public.modele_questions q on q.modele_id = s.modele_id and q.cle = new.question
     where s.id = new.seance_id;
  end if;
  return new;
end; $$;

drop trigger if exists corrige_prend_theme on public.corriges;
create trigger corrige_prend_theme before insert on public.corriges
  for each row execute function public.corrige_prend_theme();

-- ─── 3. `creer_modele()` — le thème entre crochets, et la certitude ────────
--  Même forme de ligne qu'avant ; un préfixe facultatif entre crochets donne
--  le thème :
--
--      [TP2] Une migration, c'est : · *un script qui fait évoluer le schéma · …
--        → …
--
--  Un thème de plus de 40 caractères est refusé : c'est une étiquette, et le
--  bilan l'affiche sur une ligne de téléphone.
--
--  La signature gagne `p_certitude` (défaut faux). L'ancienne est supprimée :
--  deux surcharges, c'est PostgREST qui choisit, et on ne veut pas qu'il
--  choisisse.
drop function if exists public.creer_modele(text, text, text, text);

create or replace function public.creer_modele(
  p_titre text, p_intro text, p_mode text, p_texte text,
  p_certitude boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id     bigint;
  v_cle    text;
  v_mode   text := coalesce(nullif(btrim(p_mode), ''), 'sequentiel');
  v_ligne  text;
  v_corps  text;
  v_expl   text;
  v_theme  text;
  v_bouts  text[];
  v_opts   text[];
  v_rang   int := 0;
  v_n      int := 0;
  v_etoile int;
  i        int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if coalesce(btrim(p_titre), '') = '' then
    return jsonb_build_object('ok', false, 'motif', 'titre');
  end if;
  if v_mode not in ('sequentiel', 'revisable', 'revision') then
    return jsonb_build_object('ok', false, 'motif', 'mode');
  end if;
  if coalesce(p_certitude, false) and v_mode <> 'revision' then
    return jsonb_build_object('ok', false, 'motif', 'certitude_inutile',
      'detail', 'La certitude ne se demande qu''en mode révision : ailleurs, '
                'rien n''est juste ni faux.');
  end if;

  -- Un premier passage qui ne fait que vérifier : on ne crée rien tant qu'une
  -- ligne peut encore faire échouer l'ensemble.
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;

    v_theme := substring(v_ligne from '^\[([^\]]*)\]');
    if v_theme is not null then
      v_ligne := btrim(regexp_replace(v_ligne, '^\[[^\]]*\]', ''));
      if btrim(v_theme) = '' or length(btrim(v_theme)) > 40 then
        return jsonb_build_object('ok', false, 'motif', 'theme', 'rang', v_rang,
          'texte', left(v_ligne, 80),
          'detail', 'Le thème entre crochets doit faire de 1 à 40 caractères.');
      end if;
    end if;

    -- La flèche d'abord : elle peut contenir des « · » sans que ce soient des
    -- options. « → » ou « -> », le second parce qu'on écrit au clavier.
    v_corps := regexp_replace(v_ligne, '\s*(→|->)\s*.*$', '');
    v_expl  := nullif(btrim(coalesce(
                 substring(v_ligne from '\s*(?:→|->)\s*(.*)$'), '')), '');

    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_corps, '\s*[·|]\s*')) x), '');
    if array_length(v_bouts, 1) is null or array_length(v_bouts, 1) < 3 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang,
        'texte', left(v_ligne, 80),
        'detail', 'Il faut un intitulé puis au moins deux options, séparés par « · ».');
    end if;
    if array_length(v_bouts, 1) > 5 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang,
        'texte', left(v_ligne, 80),
        'detail', 'Quatre options au maximum : l''écran étudiant n''en propose pas plus.');
    end if;

    v_etoile := 0;
    for i in 2 .. array_length(v_bouts, 1) loop
      if v_bouts[i] like '*%' then
        if v_etoile > 0 then
          return jsonb_build_object('ok', false, 'motif', 'deux_etoiles',
            'rang', v_rang, 'texte', left(v_ligne, 80),
            'detail', 'Deux options portent une étoile : une seule peut être la bonne.');
        end if;
        v_etoile := i - 1;
      end if;
    end loop;

    if v_mode = 'revision' and v_etoile = 0 then
      return jsonb_build_object('ok', false, 'motif', 'sans_etoile',
        'rang', v_rang, 'texte', left(v_ligne, 80),
        'detail', 'Un questionnaire de révision corrige : il faut une étoile '
                  'devant la bonne option.');
    end if;
    if v_mode <> 'revision' and v_etoile > 0 then
      return jsonb_build_object('ok', false, 'motif', 'etoile_inutile',
        'rang', v_rang, 'texte', left(v_ligne, 80),
        'detail', 'Ce mode ne corrige rien : l''étoile s''afficherait telle '
                  'quelle. Choisir le mode « révision », ou la retirer.');
    end if;
    if v_mode <> 'revision' and v_expl is not null then
      return jsonb_build_object('ok', false, 'motif', 'explication_inutile',
        'rang', v_rang, 'texte', left(v_ligne, 80),
        'detail', 'Ce mode ne montre aucune correction : l''explication après '
                  '« → » ne serait jamais lue.');
    end if;

    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide');
  end if;

  v_cle := 'q' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  insert into public.modeles (cle, titre, intro, mode, certitude)
  values (v_cle, btrim(p_titre), nullif(btrim(coalesce(p_intro, '')), ''), v_mode,
          coalesce(p_certitude, false))
  returning id into v_id;

  v_rang := 0;
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;

    v_theme := nullif(btrim(substring(v_ligne from '^\[([^\]]*)\]')), '');
    v_ligne := btrim(regexp_replace(v_ligne, '^\[[^\]]*\]', ''));

    v_corps := regexp_replace(v_ligne, '\s*(→|->)\s*.*$', '');
    v_expl  := nullif(btrim(coalesce(
                 substring(v_ligne from '\s*(?:→|->)\s*(.*)$'), '')), '');
    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_corps, '\s*[·|]\s*')) x), '');

    v_etoile := 0;
    v_opts := '{}';
    for i in 2 .. array_length(v_bouts, 1) loop
      if v_bouts[i] like '*%' then
        v_etoile := i - 1;
        v_opts := v_opts || btrim(substring(v_bouts[i] from 2));
      else
        v_opts := v_opts || v_bouts[i];
      end if;
    end loop;

    insert into public.modele_questions (modele_id, rang, cle, intitule, options, theme)
    values (v_id, v_rang, v_cle || '-' || lpad(v_rang::text, 2, '0'),
            v_bouts[1], v_opts, v_theme);

    if v_etoile > 0 then
      insert into public.modele_corriges (modele_id, cle, bonne, explication)
      values (v_id, v_cle || '-' || lpad(v_rang::text, 2, '0'),
              chr(64 + v_etoile), v_expl);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'modele_id', v_id,
                            'questions', v_n, 'mode', v_mode,
                            'certitude', coalesce(p_certitude, false));
end; $$;

grant execute on function public.creer_modele(text, text, text, text, boolean) to authenticated;

-- ─── 4. `mes_questionnaires()` — le bilan par thème ────────────────────────
--  Ce qui change :
--    · `faites` et `justes` ne comptent QUE les clés qui ont un corrigé : sans
--      cela, chaque certitude comptait pour une question de plus, et « 26 sur
--      24 » arrivait au bout de treize réponses ;
--    · chaque question porte son `theme` et `ma_certitude` ;
--    · `certitude` dit si la page doit la demander ;
--    · `bilan` : une ligne par thème — questions, répondues, justes, et
--      `surs_faux` (répondu faux en se disant sûr). Calculé en base parce que
--      c'est la base qui connaît `correct` ; la page n'a pas la grille.
--
--  Règle inchangée : la correction ne sort que sur une question déjà répondue.
create or replace function public.mes_questionnaires()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve public.eleves;
  v_out   jsonb;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', true, 'liste', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(x order by (x->>'numero')::int), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'seance_id', s.id,
               'numero',    s.numero,
               'titre',     coalesce(m.titre, s.titre),
               'intro',     m.intro,
               'mode',      coalesce(m.mode, 'sequentiel'),
               'corrige',   coalesce(m.mode, '') = 'revision',
               'certitude', coalesce(m.mode, '') = 'revision' and coalesce(m.certitude, false),
               'total',     (select count(*) from public.corriges co
                              where co.seance_id = s.id),
               'faites',    (select count(*) from public.reponses r
                               join public.corriges co
                                 on co.seance_id = r.seance_id and co.question = r.question
                              where r.seance_id = s.id and r.eleve_id = v_eleve.id),
               'justes',    case when coalesce(m.mode, '') = 'revision' then
                              (select count(*) from public.reponses r
                                 join public.corriges co
                                   on co.seance_id = r.seance_id and co.question = r.question
                                where r.seance_id = s.id
                                  and r.eleve_id = v_eleve.id
                                  and r.correct) else null end,
               'questions', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'question',     co.question,
                           'intitule',     coalesce(co.intitule, co.question),
                           'options',      to_jsonb(co.options),
                           'theme',        co.theme,
                           'ma_reponse',   r.reponse,
                           'ma_certitude', rc.reponse,
                           'bonne',        case when coalesce(m.mode, '') = 'revision'
                                                 and r.reponse is not null
                                            then co.bonne_reponse end,
                           'explication',  case when coalesce(m.mode, '') = 'revision'
                                                 and r.reponse is not null
                                            then co.explication end,
                           'juste',        case when coalesce(m.mode, '') = 'revision'
                                                 and r.reponse is not null
                                            then r.correct end)
                         order by co.question)
                    from public.corriges co
                    left join public.reponses r
                           on r.eleve_id  = v_eleve.id
                          and r.seance_id = s.id
                          and r.question  = co.question
                    left join public.reponses rc
                           on rc.eleve_id  = v_eleve.id
                          and rc.seance_id = s.id
                          and rc.question  = co.question || '-c'
                   where co.seance_id = s.id), '[]'::jsonb),
               -- Le bilan n'a de sens que là où quelque chose est juste ou faux.
               'bilan', case when coalesce(m.mode, '') = 'revision' then coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'theme', t.theme, 'questions', t.questions,
                           'repondues', t.repondues, 'justes', t.justes,
                           'surs_faux', t.surs_faux) order by t.premier)
                    from (
                      select coalesce(co.theme, 'Sans thème') as theme,
                             min(co.question)                   as premier,
                             count(*)                           as questions,
                             count(r.reponse)                   as repondues,
                             count(*) filter (where r.correct)  as justes,
                             count(*) filter (where r.correct is false and rc.reponse = 'S') as surs_faux
                        from public.corriges co
                        left join public.reponses r
                               on r.eleve_id = v_eleve.id and r.seance_id = s.id
                              and r.question = co.question
                        left join public.reponses rc
                               on rc.eleve_id = v_eleve.id and rc.seance_id = s.id
                              and rc.question = co.question || '-c'
                       where co.seance_id = s.id
                       group by coalesce(co.theme, 'Sans thème')) t), '[]'::jsonb)
                  else null end
             ) as x
        from public.seances s
        left join public.modeles m on m.id = s.modele_id
       where s.classe_id = v_eleve.classe_id
         and s.numero between 90 and 98
         and s.ouverte
         -- L'échéance posée par regler_questionnaire() (20260929055000) : au-delà,
         -- on ne le montre plus. Un masquage — l'interrupteur reste le geste.
         and (s.visible_jusqu_au is null or s.visible_jusqu_au >= current_date)
         and exists (select 1 from public.corriges co where co.seance_id = s.id)
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

grant execute on function public.mes_questionnaires() to anon, authenticated;

-- ─── 5. `depouiller_questionnaire()` — la lecture par thème ────────────────
--  Même sortie qu'avant (le portail la sait afficher), plus :
--    · `faites` ne compte que les clés à corrigé (même défaut qu'au 4) ;
--    · par question, `justes` et `repondu` ;
--    · en mode révision, `themes` : taux de la classe sur le thème (toutes
--      réponses du thème réunies, pas la moyenne des taux — même règle que le
--      débriefing), `fragiles` (moins de 50 % sur ce thème, au moins une
--      réponse), `surs_faux` (faux en se disant sûr).
--
--  Les numéros sont là pour l'enseignant seul : cette fonction exige
--  est_enseignant(), et rien de ce qu'elle rend ne se projette.
create or replace function public.depouiller_questionnaire(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s public.seances;
  v_m public.modeles;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero not between 90 and 98 then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;
  select * into v_m from public.modeles where id = v_s.modele_id;

  return (
    with q as (
      select co.question, co.intitule, co.options, co.theme
        from public.corriges co where co.seance_id = v_s.id
    ),
    eleves as (
      select e.id, e.numero, e.avatar
        from public.eleves e
       where e.classe_id = v_s.classe_id and e.numero <> '99'
    ),
    rep as (
      select r.question, r.reponse, r.correct, e.numero,
             (select rc.reponse from public.reponses rc
               where rc.eleve_id = r.eleve_id and rc.seance_id = r.seance_id
                 and rc.question = r.question || '-c') as certitude
        from public.reponses r
        join eleves e on e.id = r.eleve_id
        join q on q.question = r.question
       where r.seance_id = v_s.id
    ),
    dist as (
      select q.question, q.intitule, q.options, q.theme,
             coalesce((select jsonb_object_agg(t.reponse, t.n) from (
                 select reponse, count(*) as n from rep
                  where rep.question = q.question group by reponse) t),
               '{}'::jsonb) as compte,
             coalesce((select jsonb_object_agg(t.reponse, t.nums) from (
                 select reponse, jsonb_agg(numero order by numero) as nums from rep
                  where rep.question = q.question group by reponse) t),
               '{}'::jsonb) as qui,
             (select count(*) from rep where rep.question = q.question) as repondu,
             (select count(*) from rep where rep.question = q.question and rep.correct) as justes
        from q
    ),
    etat as (
      select e.numero, e.avatar,
             count(rep.question) as faites,
             count(*) filter (where rep.correct) as justes
        from eleves e
        left join rep on rep.numero = e.numero
       group by e.numero, e.avatar
    ),
    par_theme as (
      select coalesce(q.theme, 'Sans thème') as theme,
             min(q.question) as premier,
             count(distinct q.question) as questions,
             count(rep.question) as reponses,
             count(*) filter (where rep.correct) as justes
        from q left join rep on rep.question = q.question
       group by coalesce(q.theme, 'Sans thème')
    ),
    eleve_theme as (
      select coalesce(q.theme, 'Sans thème') as theme, rep.numero,
             count(*) as n, count(*) filter (where rep.correct) as ok,
             count(*) filter (where rep.correct is false and rep.certitude = 'S') as surs_faux
        from rep join q on q.question = rep.question
       group by coalesce(q.theme, 'Sans thème'), rep.numero
    )
    select jsonb_build_object(
      'ok', true,
      'seance_id', v_s.id,
      'titre',     coalesce(v_m.titre, v_s.titre),
      'mode',      coalesce(v_m.mode, 'sequentiel'),
      'certitude', coalesce(v_m.certitude, false),
      'ouvert',    v_s.ouverte,
      'total_questions', (select count(*) from q),
      'inscrits',        (select count(*) from etat),
      'termines',        (select count(*) from etat
                           where faites >= (select count(*) from q)
                             and (select count(*) from q) > 0),
      'questions', coalesce((select jsonb_agg(jsonb_build_object(
                     'question', question, 'intitule', intitule,
                     'options',  to_jsonb(options), 'theme', theme,
                     'compte',   compte, 'qui', qui,
                     'repondu',  repondu, 'justes', justes) order by question) from dist), '[]'::jsonb),
      'eleves',    coalesce((select jsonb_agg(jsonb_build_object(
                     'numero', numero, 'avatar', avatar, 'faites', faites,
                     'justes', justes)
                   order by numero) from etat), '[]'::jsonb),
      'themes',    case when coalesce(v_m.mode, '') = 'revision' then coalesce((
                     select jsonb_agg(jsonb_build_object(
                       'theme', pt.theme, 'questions', pt.questions,
                       'reponses', pt.reponses, 'justes', pt.justes,
                       'taux', case when pt.reponses > 0
                                    then round(100.0 * pt.justes / pt.reponses) end,
                       'fragiles', coalesce((select jsonb_agg(et.numero order by et.numero)
                                     from eleve_theme et
                                    where et.theme = pt.theme and et.ok * 2 < et.n), '[]'::jsonb),
                       'surs_faux', coalesce((select jsonb_agg(et.numero order by et.numero)
                                     from eleve_theme et
                                    where et.theme = pt.theme and et.surs_faux > 0), '[]'::jsonb))
                     order by pt.premier) from par_theme pt), '[]'::jsonb)
                   else null end)
  );
end; $$;

grant execute on function public.depouiller_questionnaire(bigint) to authenticated;

-- ─── 6. Ce qui doit tenir ──────────────────────────────────────────────────
do $$
declare
  v jsonb; v_mod bigint; v_s bigint; v_classe bigint; v_e bigint; v_q text;
  v_n int;
begin
  -- 6.1 Une seule creer_modele : deux surcharges, PostgREST choisirait.
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'creer_modele';
  if v_n <> 1 then raise exception 'creer_modele() : % définitions, attendu 1', v_n; end if;

  -- 6.2 La table des corrigés de modèle reste fermée à anon.
  select count(*) into v_n from pg_policies
   where schemaname = 'public' and tablename = 'modele_corriges' and 'anon' = any(roles);
  if v_n > 0 then raise exception 'modele_corriges : une politique ouvre la table à anon'; end if;

  if not public.est_enseignant() then
    raise notice 'Thèmes : comportement non vérifié ici (pas de session enseignant).';
    return;
  end if;
  select id into v_classe from public.classes where code = 'BTS2-SLAM-2026';
  if v_classe is null then raise notice 'Pas de BTS2 : thèmes non vérifiés.'; return; end if;

  -- Tout ce qui suit est annulé à la fin : on crée, on répond, on lit.
  begin
    -- 6.3 Le thème se lit, la certitude hors révision se refuse.
    v := public.creer_modele('essai', null, 'revisable', '[T] Q · a · b', true);
    if (v->>'motif') is distinct from 'certitude_inutile' then
      raise exception 'certitude hors révision acceptée : %', v;
    end if;
    v := public.creer_modele('essai', null, 'revision', '[' || repeat('x', 41) || '] Q · *a · b');
    if (v->>'motif') is distinct from 'theme' then
      raise exception 'thème de 41 caractères accepté : %', v;
    end if;

    v := public.creer_modele('essai thèmes', null, 'revision',
           E'[Alpha] Q1 · *a · b → parce que\n[Alpha] Q2 · a · *b\n[Beta] Q3 · *a · b\nQ4 · a · *b', true);
    if not (v->>'ok')::boolean then raise exception 'creer_modele : %', v; end if;
    v_mod := (v->>'modele_id')::bigint;
    if (select count(*) from public.modele_questions where modele_id = v_mod and theme = 'Alpha') <> 2 then
      raise exception 'le thème « Alpha » n''est pas rangé sur deux questions';
    end if;
    if exists (select 1 from public.modele_questions where modele_id = v_mod and intitule like '[%') then
      raise exception 'le crochet du thème est resté dans l''intitulé';
    end if;

    -- 6.4 L'affectation recopie le thème (le déclencheur).
    v := public.affecter_questionnaire(v_mod, v_classe);
    if not (v->>'ok')::boolean then raise exception 'affecter : %', v; end if;
    v_s := (v->>'seance_id')::bigint;
    if (select count(*) from public.corriges where seance_id = v_s and theme = 'Alpha') <> 2 then
      raise exception 'le thème ne suit pas la question jusque dans les corrigés';
    end if;
    update public.seances set ouverte = true where id = v_s;

    -- 6.5 Un étudiant répond : juste sur Q1 (sûr), faux sur Q2 (sûr), faux sur
    --     Q3 (au hasard). La certitude ne compte pas comme une question faite.
    select min(id) into v_e from public.eleves where classe_id = v_classe and numero <> '99';
    select question into v_q from public.corriges where seance_id = v_s order by question limit 1;
    insert into public.reponses (eleve_id, seance_id, question, reponse, correct)
    select v_e, v_s, co.question, x.rep, x.rep = co.bonne_reponse
      from (select question, bonne_reponse, row_number() over (order by question) as rg
              from public.corriges where seance_id = v_s) co
      join (values (1, 'A'), (2, 'A'), (3, 'B')) as x(rg, rep) on x.rg = co.rg;
    insert into public.reponses (eleve_id, seance_id, question, reponse)
    select v_e, v_s, co.question || '-c', x.c
      from (select question, row_number() over (order by question) as rg
              from public.corriges where seance_id = v_s) co
      join (values (1, 'S'), (2, 'S'), (3, 'X')) as x(rg, c) on x.rg = co.rg;

    v := public.depouiller_questionnaire(v_s);
    if (v->'eleves'->0->>'faites')::int <> 3 then
      raise exception 'depouiller : faites = %, attendu 3 (la certitude comptée ?)',
        v->'eleves'->0->>'faites';
    end if;
    if jsonb_array_length(v->'themes') <> 3 then
      raise exception 'depouiller : % thèmes, attendu 3 (Alpha, Beta, Sans thème)',
        jsonb_array_length(v->'themes');
    end if;
    if (v->'themes'->0->>'theme') <> 'Alpha' or (v->'themes'->0->>'taux')::int <> 50 then
      raise exception 'depouiller : le premier thème devrait être Alpha à 50 %%, lu %', v->'themes'->0;
    end if;
    if jsonb_array_length(v->'themes'->0->'surs_faux') <> 1 then
      raise exception 'depouiller : l''élève sûr et faux sur Alpha n''est pas nommé';
    end if;
    if jsonb_array_length(v->'themes'->1->'surs_faux') <> 0 then
      raise exception 'depouiller : une réponse au hasard est comptée « sûr et faux »';
    end if;
    if jsonb_array_length(v->'themes'->1->'fragiles') <> 1 then
      raise exception 'depouiller : l''élève à 0 %% sur Beta n''est pas fragile';
    end if;

    -- 6.6 Le même, vu par l'étudiant (session prêtée si le socle en a une).
    if auth.uid() is not null then
      update public.eleves set auth_id = null where auth_id = auth.uid();
      update public.eleves set auth_id = auth.uid() where id = v_e;
      select x into v from jsonb_array_elements(public.mes_questionnaires()->'liste') x
       where (x->>'seance_id')::bigint = v_s;
      if (v->>'faites')::int <> 3 or (v->>'justes')::int <> 1 then
        raise exception 'mes_questionnaires : faites %, justes % — attendu 3 et 1',
          v->>'faites', v->>'justes';
      end if;
      if not (v->>'certitude')::boolean then
        raise exception 'mes_questionnaires : la certitude demandée n''est pas annoncée';
      end if;
      if (v->'bilan'->0->>'surs_faux')::int <> 1 or (v->'bilan'->0->>'justes')::int <> 1 then
        raise exception 'mes_questionnaires : bilan Alpha faux : %', v->'bilan'->0;
      end if;
      if (v->'bilan'->1->>'surs_faux')::int <> 0 then
        raise exception 'mes_questionnaires : une réponse au hasard compte « sûr et faux »';
      end if;
      update public.seances set visible_jusqu_au = current_date - 1 where id = v_s;
      if exists (select 1 from jsonb_array_elements(public.mes_questionnaires()->'liste') x
                  where (x->>'seance_id')::bigint = v_s) then
        raise exception 'mes_questionnaires montre un questionnaire dont l''échéance est passée';
      end if;
      update public.seances set visible_jusqu_au = null where id = v_s;
      -- La règle d'or : pas de correction sur une question pas encore répondue.
      if exists (select 1 from jsonb_array_elements(v->'questions') q
                  where q->>'ma_reponse' is null and q->>'bonne' is not null) then
        raise exception 'mes_questionnaires livre la bonne réponse d''une question non répondue';
      end if;
    end if;

    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;

  raise notice 'Thèmes et certitude en place : bilan par thème, lecture par thème.';
end $$;
