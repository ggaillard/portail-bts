-- ═══════════════════════════════════════════════════════════════════════════
--  LE PARCOURS GUIDÉ — ce que la page de séance demande à la base (19/10/2026)
--
--  ─── Le constat ──────────────────────────────────────────────────────────
--  Sur la page d'une séance du BTS1, la première chose qu'un étudiant voyait
--  était « Question 1 / 10 » du quiz de fin, avant le cold open ; et rien ne
--  l'empêchait de faire défiler au-delà des points de passage. Depuis le
--  19/10, `docs/assets/suivi.js` pose chaque question juste après la notion
--  qu'elle vérifie, et la suite de la page attend la réponse.
--
--  ─── Ce que pose ce fichier ──────────────────────────────────────────────
--  1. `mes_points_passage()` rend aussi `demarree_le` et `duree_min` : la
--     page dit à l'étudiant s'il est dans le rythme de la classe — la règle
--     même du « retard d'acte » de l'enseignant, dite à l'étudiant AVANT
--     qu'elle ne le désigne. Réécrite en entier : c'est cette définition qui
--     gagne sur celle du 24/09.
--  2. `sorties_page` et `signaler_sortie()` : un étudiant qui quitte la page
--     (autre onglet, autre application) PENDANT une question. La page le lui
--     dit d'abord, sur la carte — on ne signale jamais dans son dos — puis
--     l'enregistre ici.
--  3. `sorties_seance()` : côté enseignant, une raison par étudiant, écrite
--     par la base comme les autres raisons de « À aller voir » — le portail
--     ne la réécrit pas, pour que le seuil ne vive qu'à un seul endroit.
--
--  ─── Ce que ce n'est PAS ─────────────────────────────────────────────────
--  Une preuve de triche. Une notification qu'on écarte, un camarade qui
--  envoie un message : sortir de la page a mille raisons. C'est une RAISON
--  d'aller voir, à côté de « sans le temps de lire », jamais une sanction.
--  La table n'entre dans aucun taux de réussite (elle n'est pas `reponses`).
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le rythme, rendu à l'étudiant ──────────────────────────────────────
create or replace function public.mes_points_passage(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_e bigint; v_s public.seances;
begin
  v_e := public.eleve_de_seance(p_seance_id);
  if v_e is null then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  select * into v_s from public.seances where id = p_seance_id;
  return jsonb_build_object(
    'ok', true,
    'ouverte', v_s.ouverte,
    -- Nouveaux le 19/10 : sans eux la page ne sait pas où en est l'heure.
    'demarree_le', v_s.demarree_le,
    'duree_min', v_s.duree_min,
    'points', coalesce((
      select jsonb_agg(jsonb_build_object(
               'acte', p.acte, 'titre', p.titre, 'fin_min', p.fin_min,
               'intitule', p.intitule, 'options', p.options,
               'fait', pa.id is not null,
               'reponse', pa.reponse, 'correct', pa.correct,
               'bonne', case when pa.id is not null then p.bonne end,
               'explication', case when pa.id is not null then p.explication end)
             order by p.acte)
        from public.points_passage p
        left join public.passages pa
               on pa.seance_id = p.seance_id and pa.acte = p.acte and pa.eleve_id = v_e
       where p.seance_id = p_seance_id), '[]'::jsonb),
    'main', (select jsonb_build_object('id', m.id, 'acte', m.acte, 'mot', m.mot,
                                       'levee_le', m.levee_le, 'vue', m.vue_le is not null)
               from public.mains m
              where m.seance_id = p_seance_id and m.eleve_id = v_e and m.baissee_le is null
              order by m.levee_le desc limit 1));
end; $$;
grant execute on function public.mes_points_passage(bigint) to authenticated;

-- ─── 2. Quitter la page pendant une question ───────────────────────────────
create table if not exists public.sorties_page (
  id        bigint generated always as identity primary key,
  seance_id bigint not null references public.seances(id) on delete cascade,
  eleve_id  bigint not null references public.eleves(id)  on delete cascade,
  cle       text   not null,             -- « q3 », « acte-2 »
  secondes  int    not null,
  le        timestamptz not null default now()
);
create index if not exists sorties_page_seance_idx on public.sorties_page(seance_id);
-- Aucune politique : RLS sans rien d'autre, c'est « personne ne lit
-- directement ». L'étudiant écrit par la fonction, l'enseignant lit par la
-- fonction.
alter table public.sorties_page enable row level security;

create or replace function public.signaler_sortie(p_seance_id bigint, p_cle text, p_secondes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e bigint; v_ouverte boolean; v_n int;
begin
  v_e := public.eleve_de_seance(p_seance_id);
  if v_e is null then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  select ouverte into v_ouverte from public.seances where id = p_seance_id;
  -- Après l'heure, réviser chez soi n'est pas « sortir pendant le cours ».
  if not coalesce(v_ouverte, false) then return jsonb_build_object('ok', false, 'motif', 'fermee'); end if;
  if coalesce(p_cle, '') !~ '^(q[0-9]+|acte-[0-9]+)$' then
    return jsonb_build_object('ok', false, 'motif', 'cle');
  end if;
  -- Une page qui boucle ne remplit pas la table : deux cents lignes par
  -- étudiant et par séance, c'est déjà dix fois plus que de questions.
  select count(*) into v_n from public.sorties_page where seance_id = p_seance_id and eleve_id = v_e;
  if v_n >= 200 then return jsonb_build_object('ok', false, 'motif', 'plafond'); end if;
  insert into public.sorties_page (seance_id, eleve_id, cle, secondes)
  values (p_seance_id, v_e, p_cle, greatest(0, least(coalesce(p_secondes, 0), 3600)));
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.signaler_sortie(bigint, text, int) from public, anon;
grant execute on function public.signaler_sortie(bigint, text, int) to authenticated;

-- ─── 3. Côté enseignant : une raison par étudiant ──────────────────────────
--  Les seuils vivent ici, et seulement ici :
--    · une question quittée                → « à surveiller » ;
--    · deux questions, ou plus d'une minute → « à aller voir ».
--  Le n° 99 (compte d'essai) est exclu, comme partout.
create or replace function public.sorties_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return jsonb_build_object('ok', true, 'eleves', coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', x.numero, 'questions', x.questions, 'secondes', x.secondes,
             'gravite', case when x.questions >= 2 or x.secondes > 60 then 'attention' else 'a_suivre' end,
             'texte', 'A quitté la page pendant ' ||
                      case when x.questions = 1 then 'une question'
                           else x.questions || ' questions' end ||
                      ' (' || case when x.secondes >= 90 then round(x.secondes / 60.0) || ' min'
                                   else x.secondes || ' s' end || ')')
           order by x.questions desc, x.secondes desc)
      from (select e.numero, count(distinct sp.cle)::int as questions, sum(sp.secondes)::int as secondes
              from public.sorties_page sp
              join public.eleves e on e.id = sp.eleve_id
             where sp.seance_id = p_seance_id and e.numero <> '99'
             group by e.numero) x), '[]'::jsonb));
end; $$;
revoke all on function public.sorties_seance(bigint) from public, anon;
grant execute on function public.sorties_seance(bigint) to authenticated;

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
--  L'existence partout ; le comportement seulement si `est_enseignant()`
--  répond vrai (règle du 16/09).
do $$
declare v_n int; v_r jsonb; v_s bigint;
begin
  select count(*) into v_n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('mes_points_passage', 'signaler_sortie', 'sorties_seance');
  if v_n <> 3 then raise exception 'parcours guidé : % fonction(s) sur 3', v_n; end if;

  select count(*) into v_n from pg_policies where schemaname = 'public' and tablename = 'sorties_page';
  if v_n <> 0 then raise exception 'sorties_page : % politique(s) — la table doit rester fermée', v_n; end if;

  -- anon ne doit pas pouvoir écrire une sortie : il n'est l'élève de personne,
  -- mais une fonction ouverte à anon est une porte de plus.
  if has_function_privilege('anon', 'public.signaler_sortie(bigint, text, int)', 'execute') then
    raise exception 'signaler_sortie est exécutable par anon';
  end if;

  if not public.est_enseignant() then
    raise notice 'Parcours guidé en place. Comportement non vérifié ici : session non enseignante.';
    return;
  end if;
  select s.id into v_s from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_s is null then return; end if;
  v_r := public.sorties_seance(v_s);
  if not coalesce((v_r->>'ok')::boolean, false) then raise exception 'sorties_seance refuse : %', v_r; end if;
end $$;
