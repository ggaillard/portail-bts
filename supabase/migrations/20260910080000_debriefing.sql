-- ═══════════════════════════════════════════════════════════════════════════
--  LE DÉBRIEFING DE FIN D'HEURE
--
--  Les cinq dernières minutes décident de ce qui reste. Jusqu'ici, l'heure se
--  terminait sur « Réussite par question » : un tableau juste, mais qui parle
--  de questions, pas de notions. Un élève lit « q7 : 41 % » et n'en fait rien.
--
--  Le débriefing renverse la lecture. On projette les CONCEPTS de la séance,
--  et chacun porte la mesure de ce que la classe vient d'en montrer :
--
--      Concept 2 — Les codes de statut               ▓▓▓▓▓▓░░░░  62 %   fragile
--                  mesuré sur les questions 3 et 4
--
--  Le concept vient du support (la section « Concepts à connaître »), les
--  chiffres viennent des réponses de l'heure. C'est le même objet vu des deux
--  côtés, et c'est ce qui permet de dire à voix haute « on reprend le 2 » au
--  lieu de « revoyez le cours ».
--
--  ─── Pourquoi les concepts sont aussi en base ────────────────────────────
--  Ils sont écrits dans le markdown du dépôt public : c'est la source. Mais le
--  portail ne lit pas le markdown, et le tableau se projette depuis le portail.
--  On les recopie donc ici, et le workflow « fiche » vérifie que les deux
--  listes disent la même chose — même discipline que pour les corrigés.
--
--  ─── Ce que ça n'est pas ─────────────────────────────────────────────────
--  Ce n'est pas une note, ce n'est pas nominatif, et rien n'est montré à
--  l'étudiant : le débriefing est un écran d'enseignant qu'on projette. Un
--  concept « à revoir » désigne un point du cours, jamais quelqu'un.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les concepts d'une séance ──────────────────────────────────────────
--  Une ligne par concept, dans l'ordre où on les projette. `questions` dit sur
--  quelles questions du quiz le concept se mesure : c'est ce lien qui
--  transforme un taux de réussite en phrase utilisable.
create table if not exists public.concepts (
  id         bigint generated always as identity primary key,
  seance_id  bigint not null references public.seances(id) on delete cascade,
  rang       int    not null,
  intitule   text   not null,
  detail     text   not null default '',
  questions  int[]  not null default '{}',
  unique (seance_id, rang)
);

create index if not exists concepts_seance_idx on public.concepts(seance_id);

alter table public.concepts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'concepts'
                    and policyname = 'concepts_lecture') then
    create policy concepts_lecture on public.concepts for select
      to authenticated using (true);
  end if;
exception when others then
  raise notice 'concepts : politique non créée (%), le socle RLS est-il en place ?', sqlerrm;
end $$;

-- ─── 2. Écrire les concepts en collant du texte ────────────────────────────
--  Un concept par ligne :
--
--    Les codes de statut — 4xx le client s'est trompé, 5xx le serveur. [3 4]
--
--  · le tiret long « — » (ou un tiret simple entouré d'espaces) sépare
--    l'intitulé du détail ; le détail est facultatif ;
--  · les crochets de fin listent les numéros de questions du quiz sur
--    lesquelles le concept se mesure. Facultatifs eux aussi : un concept sans
--    question reste projeté, simplement sans chiffre.
--
--  Un numéro qui ne correspond à aucune question de la séance fait échouer
--  TOUTE l'écriture en disant lequel. Un concept mesuré sur une question qui
--  n'existe pas afficherait « 0 % » sans que personne ne comprenne pourquoi.
--
--  Réécrire est libre : aucune réponse d'élève n'est attachée à un concept.
create or replace function public.definir_concepts(p_seance_id bigint, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_num     int;
  v_ligne   text;
  v_rang    int := 0;
  v_titre   text;
  v_detail  text;
  v_nums    int[];
  v_n       int;
  v_connues int[];
  v_crochet text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select numero into v_num from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  -- L'appel et les questionnaires n'ont pas de concepts à débriefer.
  if v_num >= 90 then return jsonb_build_object('ok', false, 'motif', 'numero'); end if;

  -- Les numéros de questions que la séance connaît réellement : « q7 » → 7.
  -- Le contrôle d'entrée est hors sujet ici, d'où le filtre sur « pre- ».
  select coalesce(array_agg((regexp_replace(question, '^q', ''))::int), '{}')
    into v_connues
    from public.corriges
   where seance_id = p_seance_id
     and question ~ '^q[0-9]+$';

  -- Premier passage : on ne touche à rien tant qu'une ligne peut tout faire
  -- échouer.
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;

    v_crochet := substring(v_ligne from '\[([^\]]*)\]\s*$');
    if v_crochet is not null then
      select coalesce(array_agg(t::int order by t::int), '{}') into v_nums
        from unnest(regexp_split_to_array(v_crochet, '[^0-9]+')) as t
       where t <> '';
      foreach v_n in array v_nums loop
        if not (v_n = any(v_connues)) then
          return jsonb_build_object('ok', false, 'motif', 'question',
            'ligne', v_rang, 'numero', v_n,
            'texte', 'ligne ' || v_rang || ' : la question ' || v_n ||
                     ' n''existe pas dans le quiz de cette séance');
        end if;
      end loop;
      v_ligne := btrim(regexp_replace(v_ligne, '\[[^\]]*\]\s*$', ''));
    end if;

    v_titre := btrim(split_part(regexp_replace(v_ligne, '\s+-\s+', ' — ', 'g'), ' — ', 1));
    -- Un intitulé vide, ou une ligne qui commence par le tiret : dans les deux
    -- cas le concept n'aurait pas de nom, et l'écran projetterait un tiret.
    if v_titre = '' or v_titre ~ '^[—–-]' then
      return jsonb_build_object('ok', false, 'motif', 'vide', 'ligne', v_rang,
        'texte', 'ligne ' || v_rang || ' : pas d''intitulé avant le tiret');
    end if;
  end loop;

  if v_rang = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide',
      'texte', 'aucun concept : le texte collé est vide');
  end if;

  -- Second passage : on remplace la liste entière.
  delete from public.concepts where seance_id = p_seance_id;
  v_rang := 0;

  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;

    v_nums := '{}';
    v_crochet := substring(v_ligne from '\[([^\]]*)\]\s*$');
    if v_crochet is not null then
      select coalesce(array_agg(t::int order by t::int), '{}') into v_nums
        from unnest(regexp_split_to_array(v_crochet, '[^0-9]+')) as t
       where t <> '';
      v_ligne := btrim(regexp_replace(v_ligne, '\[[^\]]*\]\s*$', ''));
    end if;

    v_ligne  := regexp_replace(v_ligne, '\s+-\s+', ' — ', 'g');
    v_titre  := btrim(split_part(v_ligne, ' — ', 1));
    v_detail := btrim(substring(v_ligne from position(' — ' in v_ligne) + 5));
    if position(' — ' in v_ligne) = 0 then v_detail := ''; end if;

    insert into public.concepts(seance_id, rang, intitule, detail, questions)
    values (p_seance_id, v_rang, v_titre, v_detail, v_nums);
  end loop;

  return jsonb_build_object('ok', true, 'concepts', v_rang);
end; $$;

grant execute on function public.definir_concepts(bigint, text) to authenticated;

-- ─── 3. L'écran du débriefing ──────────────────────────────────────────────
--  Tout ce qu'on projette en fin d'heure, en un seul appel : les indicateurs
--  de l'heure, puis les concepts avec la mesure de chacun.
--
--  Les seuils sont arbitraires — ils doivent surtout être les MÊMES d'une
--  séance à l'autre, sinon deux concepts ne se comparent plus :
--      acquis   ≥ 75 %      fragile 45-74 %      à revoir < 45 %
--  Sans question rattachée, ou sans personne pour y avoir répondu, le concept
--  s'affiche « sans mesure » : on le projette quand même, on ne prétend rien.
create or replace function public.debriefing(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s     public.seances;
  v_code  text;
  v_res   jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  select code into v_code from public.classes where id = v_s.classe_id;

  with eleves as (
    select e.id from public.eleves e
     where e.classe_id = v_s.classe_id and e.numero <> '99'
  ),
  quiz as (
    select co.question,
           (regexp_replace(co.question, '^q', ''))::int as num,
           co.intitule, co.bonne_reponse
      from public.corriges co
     where co.seance_id = p_seance_id
       and co.question ~ '^q[0-9]+$'
  ),
  rep as (
    select r.question, r.reponse, r.eleve_id
      from public.reponses r
      join eleves e on e.id = r.eleve_id
     where r.seance_id = p_seance_id
  ),
  -- Une question « répondue » compte même si la réponse est fausse : le
  -- dénominateur est le nombre de gens qui ont essayé, pas la classe entière.
  parq as (
    select q.num, q.question, q.intitule, q.bonne_reponse,
           count(r.eleve_id)                                    as repondants,
           count(r.eleve_id) filter (where r.reponse = q.bonne_reponse) as justes
      from quiz q
      left join rep r on r.question = q.question
     group by q.num, q.question, q.intitule, q.bonne_reponse
  ),
  -- Le taux d'un concept se calcule sur l'ENSEMBLE de ses questions réunies,
  -- pas comme la moyenne de leurs taux : deux questions inégalement répondues
  -- ne pèsent pas pareil, et la moyenne des taux le cacherait.
  parc as (
    select c.rang, c.intitule, c.detail, c.questions,
           coalesce(sum(p.repondants), 0) as repondants,
           coalesce(sum(p.justes), 0)     as justes
      from public.concepts c
      left join parq p on p.num = any(c.questions)
     where c.seance_id = p_seance_id
     group by c.rang, c.intitule, c.detail, c.questions
  )
  select jsonb_build_object(
    'ok', true,
    'seance_id', v_s.id, 'numero', v_s.numero, 'titre', v_s.titre,
    'classe', v_code, 'nature', v_s.nature, 'ouverte', v_s.ouverte,

    -- ── Les indicateurs de l'heure ──
    'inscrits',   (select count(*) from eleves),
    'repondants', (select count(distinct r.eleve_id) from rep r
                    join quiz q on q.question = r.question),
    'questions',  (select count(*) from quiz),
    'reussite',   (select case when sum(repondants) = 0 then null
                          else round(100.0 * sum(justes) / sum(repondants)) end
                     from parq),
    'jalons_franchis', (select count(*) from rep
                         where question like 'tp%' and reponse = 'true'),

    -- ── Les trois questions les plus ratées : ce qu'on reprend à l'oral ──
    'plus_ratees', coalesce((
       select jsonb_agg(jsonb_build_object(
                'numero', num, 'intitule', intitule, 'bonne', bonne_reponse,
                'repondants', repondants, 'justes', justes,
                'taux', round(100.0 * justes / repondants))
              order by (1.0 * justes / repondants), num)
         from (select * from parq where repondants > 0
                order by (1.0 * justes / repondants), num limit 3) t), '[]'::jsonb),

    -- ── Les concepts, dans l'ordre où on les projette ──
    'concepts', coalesce((
       select jsonb_agg(jsonb_build_object(
                'rang', rang, 'intitule', intitule, 'detail', detail,
                'questions', to_jsonb(questions),
                'repondants', repondants, 'justes', justes,
                'taux', case when repondants = 0 then null
                             else round(100.0 * justes / repondants) end,
                'verdict', case
                   when cardinality(questions) = 0 or repondants = 0 then 'sans_mesure'
                   when 100.0 * justes / repondants >= 75 then 'acquis'
                   when 100.0 * justes / repondants >= 45 then 'fragile'
                   else 'a_revoir' end)
              order by rang)
         from parc), '[]'::jsonb)
  ) into v_res;

  return v_res;
end; $$;

grant execute on function public.debriefing(bigint) to authenticated;

-- ─── 4. Les concepts des séances déjà écrites ──────────────────────────────
--  Recopiés depuis la section « Concepts à connaître » de chaque trace écrite.
--  Les numéros entre crochets disent sur quelles questions du quiz le concept
--  se mesure ; ils ont été relus une par une contre les énoncés.
do $$
declare v_id bigint;
begin
  -- ── Séance 1 — « 03 h 47 » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 1;
  if v_id is not null then
    perform public.definir_concepts(v_id, concat_ws(E'\n',
      'Un système d''information, c''est cinq composants — matériel, logiciel, données, procédures, humain. Aucun ne fonctionne seul. [1 3]',
      'La place du développeur — il agit sur le logiciel, mais ses choix se propagent aux quatre autres. [2]',
      'Les quatre cultures Ops — DevOps le code, DevSecOps la sécurité, DataOps la donnée, MLOps l''IA. [4 5 6 7]',
      'Le réflexe commun aux quatre — automatiser, tester, surveiller, pouvoir revenir en arrière. [8 10]',
      'Une panne n''a jamais une seule cause — on cherche le composant, pas la personne. [9]'));
  end if;

  -- ── Séance 2 — « À la seconde près » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 2;
  if v_id is not null then
    perform public.definir_concepts(v_id, concat_ws(E'\n',
      'Client et serveur — le client demande toujours en premier, le serveur répond. [1 2]',
      'Les codes de statut — 4xx le client s''est trompé, 5xx le serveur a échoué, 404 la ressource n''existe pas. [3 4 5]',
      'Page complète, AJAX, WebSocket — trois façons de mettre un écran à jour ; seul le WebSocket laisse le serveur parler le premier. [6 7]',
      'Une API REST — une adresse par ressource, et de la donnée en retour, pas une page. [8 9]',
      'Le temps réel se paie — la ligne ouverte rend l''application vivante, et la panne instantanée. [10]'));
  end if;

  -- ── Séance 3 — « 60, 47, 72 » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3;
  if v_id is not null then
    perform public.definir_concepts(v_id, concat_ws(E'\n',
      'Une base relationnelle — des tables, une clé par ligne, des jointures pour les relier. [1 2 3]',
      'Un schéma souple (NoSQL) — on accepte des formes variables et on répète plutôt que de joindre. [4 5 6]',
      'Choisir entre SQL et NoSQL — la question est « qu''est-ce qui doit être garanti ici ? ». [4 6]',
      'Lac et entrepôt — le lac garde tout brut ; l''entrepôt range à l''avance les réponses aux questions connues. [7 8 9]',
      'Un chiffre sans date ni source n''est pas une information — 60, 47 et 72 étaient justes tous les trois. [10]'));
  end if;
end $$;

-- Contrôle : combien de concepts par séance, et combien sans question.
select c.code, s.numero,
       count(k.id)                                        as concepts,
       count(k.id) filter (where cardinality(k.questions) = 0) as sans_mesure
  from public.classes c
  join public.seances s  on s.classe_id = c.id
  join public.concepts k on k.seance_id = s.id
 where c.code not like 'DEMO%'
 group by c.code, s.numero
 order by c.code, s.numero;
