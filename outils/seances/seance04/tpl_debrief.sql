-- ═══════════════════════════════════════════════════════════════════════════
--  LES CONCEPTS DE LA SÉANCE 4 — et deux défauts du débriefing, trouvés en
--  l'écrivant (24/09/2026)
--
--  ─── Défaut 1 : les concepts n'ont sans doute jamais atteint la base ─────
--  La migration du débriefing écrivait les concepts des séances 1 à 3 par
--  `perform public.definir_concepts(...)`. Or cette fonction commence par
--  `if not est_enseignant() then return 'refus'`. Sous le rôle de la
--  migration — postgres, sans session — elle refuse, et `perform` jette la
--  réponse sans la lire : la migration passe au vert, et rien n'est écrit.
--  C'est exactement le piège noté le 16/09 : en CI, `est_enseignant()` est
--  bouchonnée à vrai, donc le défaut n'y apparaît pas.
--
--  ─── Défaut 2 : le détail de chaque concept perdait ses deux premières
--  lettres ────────────────────────────────────────────────────────────────
--  `substring(v_ligne from position(' — ' in v_ligne) + 5)` : le séparateur
--  « — » avec ses espaces fait TROIS caractères, pas cinq. « la cascade »
--  devenait « cascade », « des tables » devenait « s tables ». Vérifié sur un
--  PostgreSQL 16. Tout concept écrit depuis le portail en a souffert aussi.
--
--  ─── Ce que fait ce fichier ──────────────────────────────────────────────
--  1. `migration_definir_concepts()` : le corps de `definir_concepts()`, SANS
--     la garde enseignant et avec « + 3 ». Réservée au rôle propriétaire :
--     aucun droit d'exécution pour anon ni authenticated. Son nom finit par
--     « definir_concepts » exprès — c'est ce que cherche `lire.concepts_base()`.
--  2. `definir_concepts()` redevient la garde, puis délègue : un seul
--     analyseur, donc un seul endroit où se tromper.
--  3. Les concepts des séances 1, 2, 3 sont réécrits (texte recopié à
--     l'identique de la migration du débriefing), et ceux de la séance 4
--     ajoutés. Chaque écriture est LUE : un refus fait échouer la migration.
--
--  Rejouable sans risque : réécrire les concepts est libre, aucune réponse
--  d'élève n'y est attachée.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. L'analyseur, sans la garde ─────────────────────────────────────────
create or replace function public.migration_definir_concepts(p_seance_id bigint, p_texte text)
returns jsonb language plpgsql set search_path = public as $$
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
    v_detail := btrim(substring(v_ligne from position(' — ' in v_ligne) + 3));
    if position(' — ' in v_ligne) = 0 then v_detail := ''; end if;

    insert into public.concepts(seance_id, rang, intitule, detail, questions)
    values (p_seance_id, v_rang, v_titre, v_detail, v_nums);
  end loop;

  return jsonb_build_object('ok', true, 'concepts', v_rang);
end; $$;

revoke all on function public.migration_definir_concepts(bigint, text) from public;
revoke all on function public.migration_definir_concepts(bigint, text) from anon, authenticated;

-- ─── 2. La garde, qui délègue ──────────────────────────────────────────────
create or replace function public.definir_concepts(p_seance_id bigint, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return public.migration_definir_concepts(p_seance_id, p_texte);
end; $$;

grant execute on function public.definir_concepts(bigint, text) to authenticated;

-- ─── 3. Les concepts, séances 1 à 4 ────────────────────────────────────────
do $$
declare v_id bigint; v_r jsonb;
begin
  -- ── Séance 1 — « 03 h 47 » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 1;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Un système d''information, c''est cinq composants — matériel, logiciel, données, procédures, humain. Aucun ne fonctionne seul. [1 3]',
      'La place du développeur — il agit sur le logiciel, mais ses choix se propagent aux quatre autres. [2]',
      'Les quatre cultures Ops — DevOps le code, DevSecOps la sécurité, DataOps la donnée, MLOps l''IA. [4 5 6 7]',
      'Le réflexe commun aux quatre — automatiser, tester, surveiller, pouvoir revenir en arrière. [8 10]',
      'Une panne n''a jamais une seule cause — on cherche le composant, pas la personne. [9]'));
    if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'concepts non écrits : %', v_r; end if;
  end if;

  -- ── Séance 2 — « À la seconde près » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 2;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Client et serveur — le client demande toujours en premier, le serveur répond. [1 2]',
      'Les codes de statut — 4xx le client s''est trompé, 5xx le serveur a échoué, 404 la ressource n''existe pas. [3 4 5]',
      'Page complète, AJAX, WebSocket — trois façons de mettre un écran à jour ; seul le WebSocket laisse le serveur parler le premier. [6 7]',
      'Une API REST — une adresse par ressource, et de la donnée en retour, pas une page. [8 9]',
      'Le temps réel se paie — la ligne ouverte rend l''application vivante, et la panne instantanée. [10]'));
    if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'concepts non écrits : %', v_r; end if;
  end if;

  -- ── Séance 3 — « 60, 47, 72 » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
      'Une base relationnelle — des tables, une clé par ligne, des jointures pour les relier. [1 2 3]',
      'Un schéma souple (NoSQL) — on accepte des formes variables et on répète plutôt que de joindre. [4 5 6]',
      'Choisir entre SQL et NoSQL — la question est « qu''est-ce qui doit être garanti ici ? ». [4 6]',
      'Lac et entrepôt — le lac garde tout brut ; l''entrepôt range à l''avance les réponses aux questions connues. [7 8 9]',
      'Un chiffre sans date ni source n''est pas une information — 60, 47 et 72 étaient justes tous les trois. [10]'));
    if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'concepts non écrits : %', v_r; end if;
  end if;

  -- ── Séance 4 — « Ça marche sur mon poste » ──
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\n',
@@CONCEPTS@@));
    if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'concepts non écrits : %', v_r; end if;
  end if;
end $$;

-- ─── 4. Contrôle : le détail garde ses premières lettres ───────────────────
--  Le défaut 2 se voit sur une seule ligne connue : le premier concept de la
--  séance 4 doit commencer par « la cascade », pas par « cascade ».
do $$
declare v text;
begin
  select k.detail into v
    from public.concepts k
    join public.seances s on s.id = k.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4 and k.rang = 1;
  if v is not null and v not like 'la cascade%' then
    raise exception 'détail de concept mal découpé : « % »', v;
  end if;
  raise notice 'Séance 4, concept 1 : « % »', v;
end $$;
