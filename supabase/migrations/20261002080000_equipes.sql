-- ═══════════════════════════════════════════════════════════════════════════
--  LES ÉQUIPES D'UN MODULE — d'abord celui du BTS2 « Du besoin à la mise en
--  place » (méthode CPMS) (02/10/2026)
--
--  Le module se travaille en équipes de 2 à 4, sur quatre jalons (J1 Besoin
--  validé · J2 Go/No-go · J3 Plan validé · J4 Bilan) et seize artefacts. G
--  veut suivre l'avancement des équipes, noter l'équipe, ET voir la part de
--  chacun : valoriser ceux qui portent le travail, repérer ceux qui ne
--  fournissent rien. Trois sources, choisies par G le 02/10 :
--
--    · LE JOURNAL — en fin de séance, chaque membre écrit en une ligne ce qu'il
--      a fait, et sur quel artefact. Un par jour ; il se réécrit dans la
--      journée. Ne pas en écrire un jour où l'on était là se voit ;
--    · L'APPRÉCIATION de l'enseignant, depuis le téléphone, pendant la séance :
--      ✓ moteur · ~ présent · ✗ rien fourni. Une par membre et par jour ;
--    · LES PAIRS — à chaque jalon posé par l'enseignant, chacun répartit 100
--      points entre les membres de son équipe, lui compris. On lit l'écart à
--      la part égale, et l'écart entre ce qu'on se donne et ce que les autres
--      donnent.
--
--  Des RAISONS, jamais une note de contribution : l'équipe se note sur ses
--  livrables ; ces trois lectures disent à qui parler, pas combien retirer.
--
--  Les équipes appartiennent à un MODULE (« chaque module a son dépôt ») : un
--  étudiant est dans une équipe au plus par module. Le module CPMS est
--  enregistré ici s'il ne l'est pas déjà — « reste à faire » depuis le 29/09.
--
--  Aucune table n'a de politique : tout passe par les fonctions, comme
--  `modules` et `missions`. Un étudiant ne lit jamais l'appréciation de
--  l'enseignant, ni les points qu'un autre lui a donnés.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Le module CPMS, s'il manque ────────────────────────────────────────
insert into public.modules (classe_id, code, titre, description, icone, depot, depot_enseignant, ordre)
select c.id, 'besoins-cpms', 'Du besoin à la mise en place — CPMS',
       'En équipe : recueillir le besoin d''une organisation, juger la faisabilité, préparer la mise en place. Concevoir · Piloter · Mesurer · Sécuriser.',
       '🤝', 'https://github.com/ggaillard/BTS2-Besoins-CPMS',
       'https://github.com/ggaillard/BTS2-Besoins-CPMS-Prof', 3
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.modules m
                    where m.classe_id = c.id
                      and (m.code = 'besoins-cpms' or m.depot ilike '%/BTS2-Besoins-CPMS'
                           or m.depot ilike '%/BTS2-Besoins-CPMS/'));

-- ─── 1. Les tables ─────────────────────────────────────────────────────────
create table if not exists public.equipes (
  id        bigint generated always as identity primary key,
  module_id bigint not null references public.modules(id) on delete cascade,
  nom       text   not null,
  sujet     text,
  ordre     int    not null default 0,
  cree_le   timestamptz not null default now(),
  unique (module_id, nom)
);

create table if not exists public.equipe_membres (
  equipe_id bigint not null references public.equipes(id) on delete cascade,
  module_id bigint not null references public.modules(id) on delete cascade,
  eleve_id  bigint not null references public.eleves(id) on delete cascade,
  primary key (equipe_id, eleve_id),
  unique (module_id, eleve_id)          -- une équipe au plus par module
);

create table if not exists public.equipe_jalons (
  equipe_id bigint not null references public.equipes(id) on delete cascade,
  jalon     text   not null check (jalon in ('J1', 'J2', 'J3', 'J4')),
  etat      text   not null check (etat in ('valide', 'a_reprendre')),
  note      text,
  le        timestamptz not null default now(),
  primary key (equipe_id, jalon)
);

create table if not exists public.journaux (
  id        bigint generated always as identity primary key,
  equipe_id bigint not null references public.equipes(id) on delete cascade,
  eleve_id  bigint not null references public.eleves(id) on delete cascade,
  jour      date   not null default current_date,
  artefact  text,
  texte     text   not null,
  ecrit_le  timestamptz not null default now(),
  unique (equipe_id, eleve_id, jour)
);

create table if not exists public.appreciations (
  equipe_id bigint not null references public.equipes(id) on delete cascade,
  eleve_id  bigint not null references public.eleves(id) on delete cascade,
  jour      date   not null default current_date,
  niveau    text   not null check (niveau in ('moteur', 'present', 'rien')),
  le        timestamptz not null default now(),
  primary key (equipe_id, eleve_id, jour)
);

create table if not exists public.pairs (
  equipe_id     bigint not null references public.equipes(id) on delete cascade,
  jalon         text   not null check (jalon in ('J1', 'J2', 'J3', 'J4')),
  evaluateur_id bigint not null references public.eleves(id) on delete cascade,
  evalue_id     bigint not null references public.eleves(id) on delete cascade,
  points        int    not null check (points between 0 and 100),
  le            timestamptz not null default now(),
  primary key (equipe_id, jalon, evaluateur_id, evalue_id)
);

alter table public.equipes        enable row level security;
alter table public.equipe_membres enable row level security;
alter table public.equipe_jalons  enable row level security;
alter table public.journaux       enable row level security;
alter table public.appreciations  enable row level security;
alter table public.pairs          enable row level security;

-- Les libellés vivent ici, une fois : le portail les lit dans les réponses.
create or replace function public._cpms_reperes()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'jalons', jsonb_build_array(
      jsonb_build_object('cle', 'J1', 'libelle', 'Besoin validé'),
      jsonb_build_object('cle', 'J2', 'libelle', 'Go / No-go'),
      jsonb_build_object('cle', 'J3', 'libelle', 'Plan validé'),
      jsonb_build_object('cle', 'J4', 'libelle', 'Bilan')),
    'artefacts', jsonb_build_array(
      jsonb_build_object('cle', 'C1', 'libelle', 'Parties prenantes'),
      jsonb_build_object('cle', 'C2', 'libelle', 'Guide d''entretien'),
      jsonb_build_object('cle', 'C3', 'libelle', 'Comptes rendus'),
      jsonb_build_object('cle', 'C4', 'libelle', 'Fiche besoins'),
      jsonb_build_object('cle', 'C5', 'libelle', 'Faisabilité'),
      jsonb_build_object('cle', 'C6', 'libelle', 'Dossier de solution'),
      jsonb_build_object('cle', 'P1', 'libelle', 'Plan de projet'),
      jsonb_build_object('cle', 'P2', 'libelle', 'Risques'),
      jsonb_build_object('cle', 'P3', 'libelle', 'Journal de bord'),
      jsonb_build_object('cle', 'P4', 'libelle', 'Déploiement'),
      jsonb_build_object('cle', 'M1', 'libelle', 'Situation de départ, KPI'),
      jsonb_build_object('cle', 'M2', 'libelle', 'Recette'),
      jsonb_build_object('cle', 'M3', 'libelle', 'Bilan'),
      jsonb_build_object('cle', 'S1', 'libelle', 'Données, DICP'),
      jsonb_build_object('cle', 'S2', 'libelle', 'Fiche RGPD'),
      jsonb_build_object('cle', 'S3', 'libelle', 'Plan de sécurisation')))
$$;

-- ─── 2. Composer les équipes ───────────────────────────────────────────────
--  Une équipe par ligne : « Nom : 03 07 11 » ou « Nom | sujet : 03, 07, 11 ».
--  Réécrire est permis : on déplace un étudiant, on renomme une équipe en
--  gardant sa place (même rang = même équipe). Une équipe qui a déjà un
--  journal, une appréciation ou des points n'est jamais effacée : elle est
--  conservée, vidée de ses membres, et la réponse le dit.
create or replace function public.definir_equipes(p_module_id bigint, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mod public.modules;
  v_l text; v_rang int := 0; v_nom text; v_sujet text; v_nums text[]; v_n text;
  v_eq bigint; v_el bigint;
  v_lignes jsonb := '[]'::jsonb; v_vus bigint[] := '{}'; v_eqs bigint[] := '{}';
  v_gardees int := 0;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_mod from public.modules where id = p_module_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'module'); end if;

  -- D'abord tout lire et tout vérifier : une ligne fausse ne laisse rien à moitié fait.
  foreach v_l in array regexp_split_to_array(coalesce(p_texte, ''), '\r?\n') loop
    v_l := btrim(v_l);
    if v_l = '' then continue; end if;
    v_rang := v_rang + 1;
    if position(':' in v_l) = 0 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang, 'texte', v_l,
        'detail', 'il manque « : » entre le nom de l''équipe et les numéros');
    end if;
    v_nom := btrim(split_part(split_part(v_l, ':', 1), '|', 1));
    v_sujet := nullif(btrim(split_part(split_part(v_l, ':', 1), '|', 2)), '');
    v_nums := array_remove(regexp_split_to_array(btrim(substring(v_l from position(':' in v_l) + 1)), '[\s,;]+'), '');
    if v_nom = '' then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang, 'texte', v_l,
        'detail', 'l''équipe n''a pas de nom');
    end if;
    if cardinality(v_nums) = 0 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang, 'texte', v_l,
        'detail', 'aucun numéro d''étudiant');
    end if;
    foreach v_n in array v_nums loop
      if v_n !~ '^[0-9]{1,3}$' then
        return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang, 'texte', v_l,
          'detail', '« ' || v_n || ' » n''est pas un numéro');
      end if;
      select e.id into v_el from public.eleves e
       where e.classe_id = v_mod.classe_id and e.numero <> '99'
         and (e.numero = v_n or e.numero = lpad(v_n, 2, '0') or ltrim(e.numero, '0') = ltrim(v_n, '0'));
      if v_el is null then
        return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang, 'texte', v_l,
          'detail', 'le numéro ' || v_n || ' n''existe pas dans cette classe');
      end if;
      if v_el = any(v_vus) then
        return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang, 'texte', v_l,
          'detail', 'le numéro ' || v_n || ' est déjà dans une autre équipe');
      end if;
      v_vus := v_vus || v_el;
    end loop;
    v_lignes := v_lignes || jsonb_build_object('rang', v_rang, 'nom', v_nom, 'sujet', v_sujet,
                                               'nums', to_jsonb(v_nums));
  end loop;
  if v_rang = 0 then return jsonb_build_object('ok', false, 'motif', 'vide'); end if;

  -- Puis écrire. Une équipe se retrouve par son nom, sinon par son rang.
  delete from public.equipe_membres where module_id = p_module_id;
  for v_l in select x::text from jsonb_array_elements(v_lignes) x loop
    v_nom := (v_l::jsonb)->>'nom'; v_sujet := (v_l::jsonb)->>'sujet'; v_rang := ((v_l::jsonb)->>'rang')::int;
    select id into v_eq from public.equipes where module_id = p_module_id and nom = v_nom;
    if v_eq is null then
      select id into v_eq from public.equipes
       where module_id = p_module_id and ordre = v_rang and not (id = any(v_eqs));
      if v_eq is not null then
        update public.equipes set nom = v_nom where id = v_eq;
      end if;
    end if;
    if v_eq is null then
      insert into public.equipes (module_id, nom, sujet, ordre) values (p_module_id, v_nom, v_sujet, v_rang)
      returning id into v_eq;
    else
      update public.equipes set sujet = v_sujet, ordre = v_rang where id = v_eq;
    end if;
    v_eqs := v_eqs || v_eq;
    insert into public.equipe_membres (equipe_id, module_id, eleve_id)
    select v_eq, p_module_id, e.id from public.eleves e
     where e.classe_id = v_mod.classe_id and e.numero <> '99'
       and exists (select 1 from jsonb_array_elements_text((v_l::jsonb)->'nums') n
                    where e.numero = n or e.numero = lpad(n, 2, '0') or ltrim(e.numero, '0') = ltrim(n, '0'));
  end loop;

  -- Les équipes qui ne sont plus dans le texte : effacées si elles n'ont
  -- rien, gardées (sans membres) si elles ont une histoire.
  select count(*) into v_gardees from public.equipes q
   where q.module_id = p_module_id and not (q.id = any(v_eqs))
     and (exists (select 1 from public.journaux j where j.equipe_id = q.id)
       or exists (select 1 from public.appreciations a where a.equipe_id = q.id)
       or exists (select 1 from public.pairs p where p.equipe_id = q.id)
       or exists (select 1 from public.equipe_jalons ej where ej.equipe_id = q.id));
  delete from public.equipes q
   where q.module_id = p_module_id and not (q.id = any(v_eqs))
     and not exists (select 1 from public.journaux j where j.equipe_id = q.id)
     and not exists (select 1 from public.appreciations a where a.equipe_id = q.id)
     and not exists (select 1 from public.pairs p where p.equipe_id = q.id)
     and not exists (select 1 from public.equipe_jalons ej where ej.equipe_id = q.id);
  update public.equipes set ordre = 1000 + ordre
   where module_id = p_module_id and not (id = any(v_eqs)) and ordre < 1000;

  return jsonb_build_object('ok', true, 'equipes', cardinality(v_eqs),
                            'membres', cardinality(v_vus), 'gardees', v_gardees);
end; $$;
grant execute on function public.definir_equipes(bigint, text) to authenticated;

-- ─── 3. Les gestes de l'enseignant ─────────────────────────────────────────
create or replace function public.poser_jalon(p_equipe_id bigint, p_jalon text, p_etat text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if p_jalon not in ('J1', 'J2', 'J3', 'J4') then
    return jsonb_build_object('ok', false, 'motif', 'jalon');
  end if;
  if not exists (select 1 from public.equipes where id = p_equipe_id) then
    return jsonb_build_object('ok', false, 'motif', 'equipe');
  end if;
  if p_etat is null then
    -- Retirer un jalon posé par erreur. Les points déjà répartis restent :
    -- ils disent quelque chose de vrai sur le travail fait jusque-là.
    delete from public.equipe_jalons where equipe_id = p_equipe_id and jalon = p_jalon;
  elsif p_etat in ('valide', 'a_reprendre') then
    insert into public.equipe_jalons (equipe_id, jalon, etat, note)
    values (p_equipe_id, p_jalon, p_etat, nullif(btrim(coalesce(p_note, '')), ''))
    on conflict (equipe_id, jalon) do update
      set etat = excluded.etat, note = excluded.note, le = now();
  else
    return jsonb_build_object('ok', false, 'motif', 'etat');
  end if;
  return jsonb_build_object('ok', true, 'jalon', p_jalon, 'etat', p_etat);
end; $$;
grant execute on function public.poser_jalon(bigint, text, text, text) to authenticated;

create or replace function public.apprecier(p_equipe_id bigint, p_eleve_id bigint, p_niveau text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if not exists (select 1 from public.equipe_membres
                  where equipe_id = p_equipe_id and eleve_id = p_eleve_id) then
    return jsonb_build_object('ok', false, 'motif', 'membre');
  end if;
  if p_niveau is null then
    delete from public.appreciations
     where equipe_id = p_equipe_id and eleve_id = p_eleve_id and jour = current_date;
  elsif p_niveau in ('moteur', 'present', 'rien') then
    insert into public.appreciations (equipe_id, eleve_id, jour, niveau)
    values (p_equipe_id, p_eleve_id, current_date, p_niveau)
    on conflict (equipe_id, eleve_id, jour) do update set niveau = excluded.niveau, le = now();
  else
    return jsonb_build_object('ok', false, 'motif', 'niveau');
  end if;
  return jsonb_build_object('ok', true, 'niveau', p_niveau);
end; $$;
grant execute on function public.apprecier(bigint, bigint, text) to authenticated;

-- ─── 4. Ce que voit l'enseignant ───────────────────────────────────────────
--  Un « jour de travail » de l'équipe = un jour où au moins un de ses membres
--  a écrit son journal. Ne pas avoir écrit un jour de travail où l'on avait
--  répondu à l'appel, c'est le journal manquant. On ne compte rien contre un
--  absent : l'appel a sa carte.
create or replace function public.equipes_module(p_module_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mod public.modules; v_appel bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_mod from public.modules where id = p_module_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'module'); end if;
  select id into v_appel from public.seances where classe_id = v_mod.classe_id and numero = 99;

  return (
    with eq as (select * from public.equipes where module_id = p_module_id),
    mb as (
      select m.equipe_id, e.id as eleve_id, e.numero, e.avatar,
             (select count(*) from public.equipe_membres m2 where m2.equipe_id = m.equipe_id) as taille
        from public.equipe_membres m join public.eleves e on e.id = m.eleve_id
       where m.module_id = p_module_id
    ),
    jours as (
      select distinct j.equipe_id, j.jour from public.journaux j
       where j.equipe_id in (select id from eq)
    ),
    -- Les points reçus, au dernier jalon où l'équipe a réparti.
    der as (
      select p.equipe_id, max(p.jalon) as jalon from public.pairs p
       where p.equipe_id in (select id from eq) group by 1
    ),
    recus as (
      select p.equipe_id, p.evalue_id,
             avg(p.points) filter (where p.evaluateur_id <> p.evalue_id) as des_autres,
             max(p.points) filter (where p.evaluateur_id =  p.evalue_id) as de_soi,
             count(*) filter (where p.evaluateur_id <> p.evalue_id)      as votes
        from public.pairs p join der d on d.equipe_id = p.equipe_id and d.jalon = p.jalon
       group by 1, 2
    ),
    ind as (
      select mb.*,
        (select count(*) from public.journaux j
          where j.equipe_id = mb.equipe_id and j.eleve_id = mb.eleve_id)::int as journaux,
        (select count(*) from jours jo
          where jo.equipe_id = mb.equipe_id
            and exists (select 1 from public.reponses r where r.eleve_id = mb.eleve_id
                         and r.seance_id = v_appel and r.question = 'appel-' || to_char(jo.jour, 'YYYY-MM-DD'))
            and not exists (select 1 from public.journaux j where j.equipe_id = mb.equipe_id
                             and j.eleve_id = mb.eleve_id and j.jour = jo.jour))::int as sans_journal,
        (select jsonb_build_object('jour', j.jour, 'artefact', j.artefact, 'texte', j.texte)
           from public.journaux j where j.equipe_id = mb.equipe_id and j.eleve_id = mb.eleve_id
          order by j.jour desc limit 1)                                           as dernier,
        exists (select 1 from public.journaux j where j.equipe_id = mb.equipe_id
                 and j.eleve_id = mb.eleve_id and j.jour = current_date)          as journal_jour,
        (select a.niveau from public.appreciations a where a.equipe_id = mb.equipe_id
            and a.eleve_id = mb.eleve_id and a.jour = current_date)               as niveau_jour,
        (select count(*) from public.appreciations a where a.equipe_id = mb.equipe_id
            and a.eleve_id = mb.eleve_id and a.niveau = 'moteur')::int            as n_moteur,
        (select count(*) from public.appreciations a where a.equipe_id = mb.equipe_id
            and a.eleve_id = mb.eleve_id and a.niveau = 'present')::int           as n_present,
        (select count(*) from public.appreciations a where a.equipe_id = mb.equipe_id
            and a.eleve_id = mb.eleve_id and a.niveau = 'rien')::int              as n_rien,
        r.des_autres, r.de_soi, r.votes, d.jalon as jalon_pairs,
        100.0 / greatest(mb.taille, 1)                                             as part_egale
        from mb
        left join recus r on r.equipe_id = mb.equipe_id and r.evalue_id = mb.eleve_id
        left join der d on d.equipe_id = mb.equipe_id
    ),
    lu as (
      select i.*,
        array_remove(array[
          case when i.n_rien >= 2 then jsonb_build_object('cle', 'rien', 'gravite', 'attention',
            'texte', 'Marqué « rien fourni » ' || i.n_rien || ' fois') end,
          case when i.sans_journal >= 2 then jsonb_build_object('cle', 'journal', 'gravite', 'attention',
            'texte', 'Pas de journal ' || i.sans_journal || ' fois alors qu''il était là') end,
          case when i.votes >= 1 and i.des_autres < i.part_egale * 0.6 then
            jsonb_build_object('cle', 'pairs', 'gravite', 'attention',
              'texte', 'Ses pairs lui donnent ' || round(i.des_autres) || ' % (part égale : ' ||
                       round(i.part_egale) || ' %)') end,
          case when i.votes >= 1 and i.de_soi is not null and i.de_soi - i.des_autres >= 15 then
            jsonb_build_object('cle', 'ecart', 'gravite', 'a_suivre',
              'texte', 'Se donne ' || i.de_soi || ' %, ses pairs ' || round(i.des_autres) || ' %') end,
          case when i.sans_journal = 1 then jsonb_build_object('cle', 'journal', 'gravite', 'a_suivre',
            'texte', 'Un journal manquant alors qu''il était là') end
        ], null) as raisons,
        array_remove(array[
          case when i.n_moteur >= 2 then 'Moteur de l''équipe ' || i.n_moteur || ' fois' end,
          case when i.votes >= 1 and i.des_autres >= i.part_egale * 1.4 then
            'Ses pairs lui donnent ' || round(i.des_autres) || ' % (part égale : ' || round(i.part_egale) || ' %)' end
        ], null) as forces
        from ind i
    )
    select jsonb_build_object('ok', true,
      'module', jsonb_build_object('id', v_mod.id, 'titre', v_mod.titre, 'icone', v_mod.icone,
                                   'classe_id', v_mod.classe_id,
                                   'code', (select code from public.classes where id = v_mod.classe_id)),
      'reperes', public._cpms_reperes(),
      'aujourdhui', current_date,
      'texte', (select string_agg(q.nom || coalesce(' | ' || q.sujet, '') || ' : ' ||
                  (select string_agg(e.numero, ' ' order by e.numero) from public.equipe_membres m
                     join public.eleves e on e.id = m.eleve_id where m.equipe_id = q.id), E'\n' order by q.ordre)
                  from eq q where q.ordre < 1000
                    and exists (select 1 from public.equipe_membres m where m.equipe_id = q.id)),
      'sans_equipe', coalesce((select jsonb_agg(e.numero order by e.numero) from public.eleves e
                     where e.classe_id = v_mod.classe_id and e.numero <> '99'
                       and not exists (select 1 from public.equipe_membres m
                                        where m.module_id = p_module_id and m.eleve_id = e.id)), '[]'::jsonb),
      'equipes', coalesce((select jsonb_agg(jsonb_build_object(
          'id', q.id, 'nom', q.nom, 'sujet', q.sujet, 'ancienne', q.ordre >= 1000,
          'jalons', coalesce((select jsonb_object_agg(ej.jalon, jsonb_build_object(
                       'etat', ej.etat, 'note', ej.note, 'le', ej.le))
                       from public.equipe_jalons ej where ej.equipe_id = q.id), '{}'::jsonb),
          'jours', (select count(*) from jours jo where jo.equipe_id = q.id),
          'journaux_jour', (select count(*) from public.journaux j where j.equipe_id = q.id and j.jour = current_date),
          'pairs', (select jsonb_build_object('jalon', d.jalon,
                      'repondus', (select count(distinct p.evaluateur_id) from public.pairs p
                                    where p.equipe_id = q.id and p.jalon = d.jalon))
                      from der d where d.equipe_id = q.id),
          'membres', coalesce((select jsonb_agg(jsonb_build_object(
              'eleve_id', l.eleve_id, 'numero', l.numero, 'avatar', l.avatar,
              'journaux', l.journaux, 'sans_journal', l.sans_journal, 'dernier', l.dernier,
              'journal_jour', l.journal_jour, 'niveau_jour', l.niveau_jour,
              'moteur', l.n_moteur, 'present', l.n_present, 'rien', l.n_rien,
              'pairs', case when l.votes >= 1 then round(l.des_autres) end,
              'soi', l.de_soi, 'part_egale', round(l.part_egale),
              'raisons', to_jsonb(l.raisons), 'forces', to_jsonb(l.forces))
              order by l.numero) from lu l where l.equipe_id = q.id), '[]'::jsonb),
          'recent', coalesce((select jsonb_agg(x order by x->>'quand' desc) from (
              select jsonb_build_object('numero', e.numero, 'jour', j.jour, 'artefact', j.artefact,
                                        'texte', j.texte, 'quand', j.ecrit_le) as x
                from public.journaux j join public.eleves e on e.id = j.eleve_id
               where j.equipe_id = q.id order by j.ecrit_le desc limit 6) t), '[]'::jsonb))
          order by q.ordre) from eq q), '[]'::jsonb))
  );
end; $$;
grant execute on function public.equipes_module(bigint) to authenticated;

-- Les modules qui ont des équipes, ou qui pourraient en avoir : tous les
-- modules des classes réelles. Le portail propose de composer celles du CPMS.
create or replace function public.modules_equipes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return jsonb_build_object('ok', true, 'modules', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'titre', m.titre, 'icone', m.icone, 'code', m.code,
             'classe', c.nom, 'classe_code', c.code,
             'equipes', (select count(*) from public.equipes q where q.module_id = m.id and q.ordre < 1000))
           order by (select count(*) from public.equipes q where q.module_id = m.id) = 0, c.code, m.ordre)
      from public.modules m join public.classes c on c.id = m.classe_id
     where c.code not like 'DEMO%'), '[]'::jsonb));
end; $$;
grant execute on function public.modules_equipes() to authenticated;

-- ─── 5. Ce que voit et fait l'étudiant ─────────────────────────────────────
--  Son équipe, ses coéquipiers (numéro et avatar), les jalons posés, son
--  journal du jour, et les points à répartir quand un jalon vient d'être
--  posé. Jamais l'appréciation de l'enseignant, jamais ce que les autres lui
--  ont donné.
create or replace function public.mon_equipe()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_eleve public.eleves;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  return jsonb_build_object('ok', true, 'reperes', public._cpms_reperes(),
    'equipes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'nom', q.nom, 'sujet', q.sujet,
      'module', jsonb_build_object('titre', md.titre, 'icone', md.icone),
      'membres', (select jsonb_agg(jsonb_build_object('eleve_id', e.id, 'numero', e.numero,
                    'avatar', e.avatar, 'moi', e.id = v_eleve.id) order by e.numero)
                    from public.equipe_membres m2 join public.eleves e on e.id = m2.eleve_id
                   where m2.equipe_id = q.id),
      'jalons', coalesce((select jsonb_object_agg(ej.jalon, ej.etat)
                   from public.equipe_jalons ej where ej.equipe_id = q.id), '{}'::jsonb),
      'journal', (select jsonb_build_object('artefact', j.artefact, 'texte', j.texte)
                    from public.journaux j where j.equipe_id = q.id and j.eleve_id = v_eleve.id
                     and j.jour = current_date),
      -- Le dernier jalon posé ouvre la répartition ; on peut la refaire tant
      -- qu'un jalon suivant n'est pas posé.
      'pairs', (select jsonb_build_object('jalon', d.jalon,
                  'mes_points', (select jsonb_object_agg(p.evalue_id::text, p.points) from public.pairs p
                                  where p.equipe_id = q.id and p.jalon = d.jalon
                                    and p.evaluateur_id = v_eleve.id))
                  from (select max(ej.jalon) as jalon from public.equipe_jalons ej
                         where ej.equipe_id = q.id) d where d.jalon is not null))
      order by md.ordre)
      from public.equipe_membres m
      join public.equipes q on q.id = m.equipe_id
      join public.modules md on md.id = q.module_id
     where m.eleve_id = v_eleve.id), '[]'::jsonb));
end; $$;
grant execute on function public.mon_equipe() to anon, authenticated;

create or replace function public.ecrire_journal(p_equipe_id bigint, p_artefact text, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_eleve public.eleves; v_t text := btrim(coalesce(p_texte, '')); v_a text := nullif(btrim(coalesce(p_artefact, '')), '');
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  if not exists (select 1 from public.equipe_membres where equipe_id = p_equipe_id and eleve_id = v_eleve.id) then
    return jsonb_build_object('ok', false, 'motif', 'equipe');
  end if;
  if length(v_t) < 5 then return jsonb_build_object('ok', false, 'motif', 'court'); end if;
  if length(v_t) > 400 then return jsonb_build_object('ok', false, 'motif', 'long'); end if;
  if v_a is not null and not exists (select 1 from jsonb_array_elements(public._cpms_reperes()->'artefacts') x
                                      where x->>'cle' = v_a) then
    return jsonb_build_object('ok', false, 'motif', 'artefact');
  end if;
  insert into public.journaux (equipe_id, eleve_id, jour, artefact, texte)
  values (p_equipe_id, v_eleve.id, current_date, v_a, v_t)
  on conflict (equipe_id, eleve_id, jour) do update
    set artefact = excluded.artefact, texte = excluded.texte, ecrit_le = now();
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.ecrire_journal(bigint, text, text) to anon, authenticated;

--  p_points : {"<eleve_id>": points, …}, un nombre par membre, lui compris,
--  total 100. Refusé si un membre manque ou si le total n'y est pas : une
--  répartition partielle ne se compare à rien.
create or replace function public.repartir_points(p_equipe_id bigint, p_points jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_eleve public.eleves; v_jalon text; v_total int; v_n int; v_membres int;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  if not exists (select 1 from public.equipe_membres where equipe_id = p_equipe_id and eleve_id = v_eleve.id) then
    return jsonb_build_object('ok', false, 'motif', 'equipe');
  end if;
  select max(jalon) into v_jalon from public.equipe_jalons where equipe_id = p_equipe_id;
  if v_jalon is null then return jsonb_build_object('ok', false, 'motif', 'pas_de_jalon'); end if;

  select count(*) into v_membres from public.equipe_membres where equipe_id = p_equipe_id;
  select count(*), coalesce(sum((v.value)::int), 0) into v_n, v_total
    from jsonb_each_text(coalesce(p_points, '{}'::jsonb)) v
   where v.key ~ '^[0-9]+$' and v.value ~ '^[0-9]{1,3}$'
     and exists (select 1 from public.equipe_membres m
                  where m.equipe_id = p_equipe_id and m.eleve_id = v.key::bigint);
  if v_n <> v_membres or v_n <> (select count(*) from jsonb_object_keys(coalesce(p_points, '{}'::jsonb))) then
    return jsonb_build_object('ok', false, 'motif', 'membres', 'attendus', v_membres);
  end if;
  if v_total <> 100 then return jsonb_build_object('ok', false, 'motif', 'total', 'total', v_total); end if;

  delete from public.pairs where equipe_id = p_equipe_id and jalon = v_jalon and evaluateur_id = v_eleve.id;
  insert into public.pairs (equipe_id, jalon, evaluateur_id, evalue_id, points)
  select p_equipe_id, v_jalon, v_eleve.id, v.key::bigint, v.value::int
    from jsonb_each_text(p_points) v;
  return jsonb_build_object('ok', true, 'jalon', v_jalon);
end; $$;
grant execute on function public.repartir_points(bigint, jsonb) to anon, authenticated;

-- ─── Ce qui doit tenir ─────────────────────────────────────────────────────
do $$
declare v jsonb; v_m bigint; v_q bigint; v_e bigint; v_f bigint; v_ap bigint; n int; t text;
begin
  -- Aucune politique sur les tables : un étudiant ne lit rien directement.
  select count(*) into n from pg_policies where schemaname = 'public'
     and tablename in ('equipes', 'equipe_membres', 'equipe_jalons', 'journaux', 'appreciations', 'pairs');
  if n <> 0 then raise exception 'équipes : % politique(s) — l''appréciation ou les points fuiraient', n; end if;

  select m.id into v_m from public.modules m join public.classes c on c.id = m.classe_id
   where c.code = 'BTS2-SLAM-2026' and m.code = 'besoins-cpms';
  if v_m is null and exists (select 1 from public.classes where code = 'BTS2-SLAM-2026') then
    if not exists (select 1 from public.modules m where m.depot ilike '%BTS2-Besoins-CPMS%') then
      raise exception 'le module CPMS n''est pas enregistré';
    end if;
  end if;

  if not public.est_enseignant() then
    raise notice 'Équipes : comportement non vérifié ici (pas de session enseignante).';
    return;
  end if;
  if v_m is null then raise notice 'Pas de module CPMS : équipes non vérifiées.'; return; end if;

  begin
    -- Une ligne fausse ne laisse rien.
    v := public.definir_equipes(v_m, E'Refuge : 01 02 03\nCommune : 03 04');
    if (v->>'motif') is distinct from 'ligne' or (v->>'rang')::int <> 2 then
      raise exception 'definir_equipes() accepte un étudiant dans deux équipes : %', v;
    end if;
    if exists (select 1 from public.equipes where module_id = v_m) then
      raise exception 'definir_equipes() a écrit malgré une ligne fausse';
    end if;

    v := public.definir_equipes(v_m, E'Refuge | SPA Forez-Pilat : 1 2 3\nCommune : 04, 05');
    if not (v->>'ok')::boolean or (v->>'membres')::int <> 5 then raise exception 'definir_equipes() : %', v; end if;
    select id into v_q from public.equipes where module_id = v_m and nom = 'Refuge';

    -- L'étudiant 01 écrit son journal, répartit après J1.
    update public.eleves set auth_id = auth.uid()
     where classe_id = (select classe_id from public.modules where id = v_m) and numero = '01'
    returning id into v_e;
    v := public.ecrire_journal(v_q, 'C1', 'Carte des parties prenantes, 7 acteurs');
    if not (v->>'ok')::boolean then raise exception 'ecrire_journal() : %', v; end if;
    v := public.ecrire_journal(v_q, 'Z9', 'Artefact inconnu, refusé');
    if (v->>'motif') is distinct from 'artefact' then raise exception 'ecrire_journal() accepte un artefact inconnu'; end if;

    v := public.repartir_points(v_q, '{}'::jsonb);
    if (v->>'motif') is distinct from 'pas_de_jalon' then raise exception 'repartir_points() avant tout jalon : %', v; end if;
    perform public.poser_jalon(v_q, 'J1', 'valide', null);

    select jsonb_object_agg(m.eleve_id::text, case e.numero when '01' then 50 when '02' then 45 else 5 end)
      into v from public.equipe_membres m join public.eleves e on e.id = m.eleve_id where m.equipe_id = v_q;
    if not (public.repartir_points(v_q, v)->>'ok')::boolean then raise exception 'repartir_points() refuse une répartition juste'; end if;
    if (public.repartir_points(v_q, v - (select eleve_id::text from public.equipe_membres
                                          where equipe_id = v_q and eleve_id <> v_e limit 1))->>'motif') <> 'membres' then
      raise exception 'repartir_points() accepte un membre oublié';
    end if;

    -- Le 02 répartit à son tour, le 03 est marqué deux fois « rien ».
    update public.eleves set auth_id = null where id = v_e;
    select e.id into v_f from public.eleves e join public.equipe_membres m on m.eleve_id = e.id
     where m.equipe_id = v_q and e.numero = '02';
    update public.eleves set auth_id = auth.uid() where id = v_f;
    if not (public.repartir_points(v_q, v)->>'ok')::boolean then raise exception 'repartir_points() : refus pour le 02'; end if;
    v := public.mon_equipe();
    if v::text like '%moteur%' or v::text like '%"rien"%' then
      raise exception 'mon_equipe() laisse voir une appréciation';
    end if;
    update public.eleves set auth_id = null where id = v_f;

    select e.id into v_f from public.eleves e join public.equipe_membres m on m.eleve_id = e.id
     where m.equipe_id = v_q and e.numero = '03';
    perform public.apprecier(v_q, v_f, 'rien');
    insert into public.appreciations (equipe_id, eleve_id, jour, niveau) values (v_q, v_f, current_date - 7, 'rien');

    v := public.equipes_module(v_m);
    select string_agg(r->>'cle', ',' order by r->>'cle') into t
      from jsonb_array_elements(v->'equipes'->0->'membres') x, jsonb_array_elements(x->'raisons') r
     where x->>'numero' = '03';
    if t is distinct from 'pairs,rien' then raise exception 'equipes_module() : raisons du 03 = %', t; end if;
    if jsonb_array_length(v->'sans_equipe') = 0 then raise exception 'equipes_module() : personne sans équipe ?'; end if;

    -- Recomposer : Refuge garde son histoire même renommée par son rang.
    v := public.definir_equipes(v_m, E'Refuge SPA : 01 02\nCommune : 03 04 05');
    if (select nom from public.equipes where id = v_q) <> 'Refuge SPA' then
      raise exception 'definir_equipes() n''a pas retrouvé l''équipe par son rang';
    end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;
  raise notice 'Équipes : comportement vérifié.';
end $$;
