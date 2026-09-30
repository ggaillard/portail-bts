-- ═══════════════════════════════════════════════════════════════════════════
--  RÉVISER UNE SÉANCE AU CHOIX — un questionnaire de révision en un geste
--
--  30/09. Besoin : « pouvoir activer un questionnaire pour réviser les concepts
--  de la séance que je choisis ». Jusqu'ici, un questionnaire de révision
--  s'écrivait à la main (texte collé, ou migration). Or chaque séance de cours
--  porte déjà tout ce qu'il faut :
--
--    · son quiz — dix corrigés avec intitulé, options, lettre juste et
--      explication (`corriges`, clés q1..q10) ;
--    · ses concepts — et, pour chacun, les questions qui le mesurent
--      (`concepts.questions`).
--
--  `reviser_seance(seance, ouvrir)` en fait un questionnaire en mode
--  `revision`, avec la certitude : une question à la fois, « sûr / hésitant /
--  au hasard », puis la correction ; au bout du tour, le bilan PAR CONCEPT —
--  le thème de chaque question est l'intitulé du concept qu'elle mesure.
--
--  Ce qui ne se devine pas :
--
--    · UN SEUL QUESTIONNAIRE PAR SÉANCE. Sa clé est `revision-seance-<id>` :
--      rappuyer sur le bouton ne crée pas de doublon, il remet le texte à jour
--      (tant que personne n'a répondu) et, si on le demande, le rallume.
--    · ON NE RÉÉCRIT JAMAIS CE QUI A ÉTÉ RÉPONDU (règle du 16/09). Dès qu'une
--      réponse existe, le texte est figé ; seul l'interrupteur bouge.
--    · Il est posé dans la bande 90-98 de LA CLASSE DE LA SÉANCE, comme tout
--      questionnaire : même interrupteur « Proposé / Éteint », même lecture
--      par thème dans « Questionnaires ». Rien de nouveau à apprendre.
--    · Ce sont les questions du quiz, que la classe a déjà vues en séance —
--      et pas celles du contrôle d'entrée de la séance suivante (clés
--      `pre-`), qui ne sont jamais lues ici. Réviser ne vide donc pas le
--      contrôle de son sens ; mais l'ouvrir AVANT le contrôle d'entrée
--      mesurerait la révision de la veille plutôt que ce qui est resté.
--    · Deux fonctions : `_reviser_seance()` fait le travail sans contrôle de
--      rôle, pour que cette migration puisse poser la révision de la séance 2
--      du BTS1 ; elle n'est exécutable par PERSONNE d'autre que le
--      propriétaire. `reviser_seance()` est la porte du portail, et vérifie
--      `est_enseignant()`.
--
--  Posé ici : « Réviser la séance 2 » pour BTS1-DEV-2026, FERMÉ. On l'allume
--  depuis la fiche de la séance 2 (Préparer) ou depuis « Questionnaires ».
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le travail, sans contrôle de rôle ──────────────────────────────────
create or replace function public._reviser_seance(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s      public.seances;
  v_cle    text;
  v_titre  text;
  v_id     bigint;
  v_qs     bigint;
  v_num    int;
  v_n      int;
  v_rep    int := 0;
  v_figee  boolean := false;
begin
  select * into v_s from public.seances where id = p_seance_id;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;
  if v_s.numero >= 90 then
    return jsonb_build_object('ok', false, 'motif', 'numero',
      'detail', 'On révise une séance de cours, pas un questionnaire ni l''appel.');
  end if;

  -- Ce qui peut servir : une lettre juste, un intitulé, au moins trois options.
  select count(*) into v_n
    from public.corriges co
   where co.seance_id = p_seance_id
     and co.question ~ '^q[0-9]+$'
     and co.bonne_reponse ~ '^[A-D]$'
     and coalesce(btrim(co.intitule), '') <> ''
     and coalesce(array_length(co.options, 1), 0) >= 3
     and ascii(co.bonne_reponse) - 64 <= array_length(co.options, 1);
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide',
      'detail', 'Cette séance n''a pas de quiz corrigé en base : rien à réviser.');
  end if;

  v_cle   := 'revision-seance-' || p_seance_id;
  v_titre := 'Réviser la séance ' || v_s.numero || ' — ' ||
             btrim(regexp_replace(coalesce(v_s.titre, ''),
                                  '^\s*S[eé]ance\s*[0-9]+\s*[-—:]\s*', '', 'i'));

  -- ── Le modèle ──────────────────────────────────────────────────────────
  select id into v_id from public.modeles where cle = v_cle;
  if v_id is not null then
    select count(*) into v_rep
      from public.reponses r join public.seances x on x.id = r.seance_id
     where x.modele_id = v_id;
    v_figee := v_rep > 0;
  end if;

  if v_id is null then
    insert into public.modeles (cle, titre, intro, mode, certitude)
    values (v_cle, v_titre, null, 'revision', true)
    returning id into v_id;
  end if;

  if not v_figee then
    update public.modeles
       set titre = v_titre, mode = 'revision', certitude = true,
           intro = 'Les ' || v_n || ' questions du quiz de la séance ' ||
                   v_s.numero || ', pour réviser. Choisissez, dites si vous '
                   'étiez sûr, puis lisez la correction. À la fin du tour, votre '
                   'bilan concept par concept vous dit quoi relire. Rien n''est '
                   'noté ici : recommencez autant que vous voulez.'
     where id = v_id;

    delete from public.modele_corriges  where modele_id = v_id;
    delete from public.modele_questions where modele_id = v_id;

    -- Le thème : l'intitulé du premier concept qui mesure la question,
    -- coupé à 40 signes (c'est une étiquette sur une ligne de téléphone).
    -- Sans concept, la séance elle-même.
    insert into public.modele_questions (modele_id, rang, cle, intitule, options, theme)
    select v_id, x.n, v_cle || '-' || lpad(x.n::text, 2, '0'),
           co.intitule, co.options,
           coalesce((select case when length(k.intitule) <= 40 then k.intitule
                                 else left(k.intitule, 39) || '…' end
                       from public.concepts k
                      where k.seance_id = p_seance_id and x.n = any(k.questions)
                      order by k.rang limit 1),
                    'Séance ' || v_s.numero)
      from public.corriges co
      cross join lateral (select substring(co.question from 2)::int as n) x
     where co.seance_id = p_seance_id
       and co.question ~ '^q[0-9]+$'
       and co.bonne_reponse ~ '^[A-D]$'
       and coalesce(btrim(co.intitule), '') <> ''
       and coalesce(array_length(co.options, 1), 0) >= 3
       and ascii(co.bonne_reponse) - 64 <= array_length(co.options, 1);

    insert into public.modele_corriges (modele_id, cle, bonne, explication)
    select v_id, v_cle || '-' || lpad(substring(co.question from 2), 2, '0'),
           co.bonne_reponse,
           coalesce(nullif(btrim(co.explication), ''),
                    'La bonne réponse est la ' || co.bonne_reponse || '. Relisez la trace de la séance.')
      from public.corriges co
     where co.seance_id = p_seance_id
       and co.question ~ '^q[0-9]+$'
       and co.bonne_reponse ~ '^[A-D]$'
       and coalesce(btrim(co.intitule), '') <> ''
       and coalesce(array_length(co.options, 1), 0) >= 3
       and ascii(co.bonne_reponse) - 64 <= array_length(co.options, 1);
  end if;

  -- ── L'affectation à la classe de la séance ─────────────────────────────
  select id, numero into v_qs, v_num from public.seances
   where classe_id = v_s.classe_id and modele_id = v_id;

  if v_qs is null then
    select min(g) into v_num
      from generate_series(90, 98) g
     where not exists (select 1 from public.seances x
                        where x.classe_id = v_s.classe_id and x.numero = g);
    if v_num is null then
      return jsonb_build_object('ok', false, 'motif', 'plein',
        'detail', 'Les neuf places de questionnaires (90 à 98) de cette classe '
                  'sont prises : retirez-en un dans « Questionnaires ».');
    end if;
    insert into public.seances (classe_id, numero, titre, notee, ouverte,
                                duree_min, nature, modele_id)
    values (v_s.classe_id, v_num, v_titre, false, false, 0, 'questionnaire', v_id)
    returning id into v_qs;
  end if;

  if not v_figee then
    update public.seances set titre = v_titre where id = v_qs;
    delete from public.corriges where seance_id = v_qs;
    insert into public.corriges (seance_id, question, bonne_reponse, explication,
                                 intitule, options, theme)
    select v_qs, q.cle, mc.bonne, mc.explication, q.intitule, q.options, q.theme
      from public.modele_questions q
      join public.modele_corriges mc on mc.modele_id = q.modele_id and mc.cle = q.cle
     where q.modele_id = v_id
     order by q.rang;
  end if;

  return jsonb_build_object('ok', true, 'modele_id', v_id, 'seance_id', v_qs,
    'numero', v_num, 'titre', v_titre, 'questions', v_n,
    'fige', v_figee, 'reponses', v_rep,
    'ouvert', (select ouverte from public.seances where id = v_qs));
end; $$;

-- Security definer, sans contrôle de rôle : personne ne doit pouvoir
-- l'appeler par l'API. Postgres donne EXECUTE à PUBLIC par défaut.
revoke all on function public._reviser_seance(bigint) from public;
revoke all on function public._reviser_seance(bigint) from anon, authenticated;

-- ─── 2. La porte du portail ────────────────────────────────────────────────
--  `p_ouvrir` : vrai = proposer tout de suite aux étudiants ; faux = préparer
--  sans rien montrer ; null = ne pas toucher à l'interrupteur.
create or replace function public.reviser_seance(p_seance_id bigint,
                                                 p_ouvrir boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  v := public._reviser_seance(p_seance_id);
  if coalesce((v->>'ok')::boolean, false) and p_ouvrir is not null then
    update public.seances set ouverte = p_ouvrir
     where id = (v->>'seance_id')::bigint;
    v := v || jsonb_build_object('ouvert', p_ouvrir);
  end if;
  return v;
end; $$;

revoke all on function public.reviser_seance(bigint, boolean) from public, anon;
grant execute on function public.reviser_seance(bigint, boolean) to authenticated;

-- ─── 3. La révision de la séance 2 du BTS1, posée fermée ───────────────────
do $$
declare v_id bigint; v jsonb; v_n int;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 2;
  if v_id is null then
    raise notice 'Pas de séance 2 BTS1 : la révision n''est pas posée.';
    return;
  end if;

  v := public._reviser_seance(v_id);
  if not coalesce((v->>'ok')::boolean, false) then
    raise exception 'révision de la séance 2 non posée : %', v;
  end if;

  -- Contrôles : autant de questions, de lettres et d'explications que le quiz.
  select count(*) into v_n from public.corriges where seance_id = (v->>'seance_id')::bigint;
  if v_n <> (v->>'questions')::int then
    raise exception 'révision séance 2 : % corrigés posés, % attendus', v_n, v->>'questions';
  end if;
  select count(*) into v_n from public.corriges
   where seance_id = (v->>'seance_id')::bigint
     and (bonne_reponse !~ '^[A-D]$' or coalesce(btrim(explication), '') = '');
  if v_n > 0 then
    raise exception 'révision séance 2 : % question(s) sans lettre juste ou sans explication', v_n;
  end if;
  -- Aucune question du contrôle d'entrée (pre-) ne doit s'y retrouver.
  select count(*) into v_n from public.corriges
   where seance_id = (v->>'seance_id')::bigint and question like 'pre-%';
  if v_n > 0 then
    raise exception 'révision séance 2 : une question de contrôle d''entrée s''y est glissée';
  end if;

  raise notice 'Révision de la séance 2 posée (questionnaire %, % questions, %). '
               'On l''allume depuis la fiche de la séance 2 ou « Questionnaires ».',
               v->>'numero', v->>'questions',
               case when (v->>'ouvert')::boolean then 'PROPOSÉ' else 'fermé' end;
end $$;

-- ─── 4. Contrôle général ───────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public._reviser_seance(bigint)', 'execute')
     or has_function_privilege('authenticated', 'public._reviser_seance(bigint)', 'execute') then
    raise exception '_reviser_seance() est exécutable depuis l''API : elle ne '
                    'vérifie aucun rôle';
  end if;
  if has_function_privilege('anon', 'public.reviser_seance(bigint, boolean)', 'execute') then
    raise exception 'reviser_seance() ne doit pas être ouverte à anon';
  end if;
end $$;
