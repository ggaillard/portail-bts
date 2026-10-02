-- ═══════════════════════════════════════════════════════════════════════════
--  LES MODULES — le contenu s'organise par module, un module appartient à
--  une classe, et chaque module a son dépôt GitHub
--
--  Jusqu'ici une séance appartenait directement à sa classe. Le BTS2 suit
--  pourtant DEUX enseignements distincts : PlaylistApp (C#, TP 0 à 4) et les
--  séances IA « Méca Forez » (11, 12…). Rien ne les séparait — ni dans la
--  liste des séances, ni pour l'étudiant, qui trouvait dans « Vos projets » le
--  dépôt PlaylistApp et rien pour Méca Forez, dont le dépôt n'existait que
--  sur le poste de l'enseignant.
--
--  Un module, c'est :
--    · une classe (un module ne traverse pas les promotions) ;
--    · un dépôt GitHub étudiant — OBLIGATOIRE, c'est la règle posée le 28/09 ;
--    · un dépôt enseignant, facultatif, jamais montré aux étudiants ;
--    · un site publié, facultatif (MkDocs, tableau de bord).
--
--  Une séance de cours ou de projet (< 90) se range dans un module de sa
--  classe (`seances.module_id`). La bande 90-99 — questionnaires, stage,
--  connaissance, appel — n'en a pas : elle appartient à la classe entière.
--
--  Ce que la migration NE fait PAS : elle ne retire pas `projets`. Le portail
--  y revient en repli tant que `mes_modules()` n'est pas déployée, comme
--  `connaissance()` l'a fait pour la bibliothèque. Repli à retirer ensuite.
--
--  ⚠️ `seances_de_classe()` est RÉÉCRITE EN ENTIER ici (elle gagne `module_id`).
--  C'est cette définition qui gagne sur celle du 27/09 : corriger l'ancienne
--  sans corriger celle-ci ne changerait rien.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La table ───────────────────────────────────────────────────────────
create table if not exists public.modules (
  id                bigserial primary key,
  classe_id         bigint not null references public.classes(id) on delete cascade,
  code              text   not null,
  titre             text   not null,
  description       text,
  icone             text   not null default '📦',
  depot             text   not null,
  depot_enseignant  text,
  site              text,
  ordre             int    not null default 0,
  unique (classe_id, code)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'modules_code_chk') then
    alter table public.modules add constraint modules_code_chk
      check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
  --  Un dépôt, c'est un dépôt GitHub : https://github.com/<compte>/<nom>.
  --  Un lien vers un site, une page de Pages ou un fichier ne passe pas — ce
  --  serait un module « avec dépôt » qui n'en a pas.
  if not exists (select 1 from pg_constraint where conname = 'modules_depot_chk') then
    alter table public.modules add constraint modules_depot_chk
      check (depot ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modules_depot_ens_chk') then
    alter table public.modules add constraint modules_depot_ens_chk
      check (depot_enseignant is null
             or depot_enseignant ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modules_site_chk') then
    alter table public.modules add constraint modules_site_chk
      check (site is null or site ~ '^https://');
  end if;
end $$;

--  Aucune politique : tout passe par les fonctions ci-dessous. Surtout, le
--  dépôt ENSEIGNANT ne doit pas être lisible avec la clé publique — une table
--  lisible par anon livrerait la ligne entière, colonne privée comprise.
alter table public.modules enable row level security;

-- ─── 2. Une séance se range dans un module ─────────────────────────────────
--  `on delete set null` : supprimer un module ne supprime pas ses séances (et
--  `supprimer_module()` refuse de toute façon tant qu'il en porte).
alter table public.seances
  add column if not exists module_id bigint references public.modules(id) on delete set null;
create index if not exists seances_module_idx on public.seances(module_id);

--  Deux choses, au même endroit :
--   · la cohérence — le module est de la même classe, et la séance est un
--     cours ou un projet (< 90) ;
--   · le rangement par défaut — une séance créée sans module dans une classe
--     qui n'en a qu'UN y entre d'elle-même. Au BTS1, créer une séance n'a
--     ainsi rien à demander de plus. Avec deux modules ou plus, on ne devine
--     pas : la séance reste « sans module » et le portail le montre.
--
--  Un déclencheur, et non une vérification dans `enregistrer_seance()` : les
--  migrations créent aussi des séances, et elles ne passent pas par elle.
create or replace function public.verifier_module_seance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_m public.modules; v_n int; v_seul bigint;
begin
  if new.module_id is null then
    if tg_op = 'INSERT' and new.numero is not null and new.numero < 90 then
      select count(*), min(id) into v_n, v_seul
        from public.modules where classe_id = new.classe_id;
      if v_n = 1 then new.module_id := v_seul; end if;
    end if;
    return new;
  end if;

  select * into v_m from public.modules where id = new.module_id;
  if not found then
    raise exception 'Module introuvable (id %).', new.module_id;
  end if;
  if new.numero >= 90 then
    raise exception 'La séance % n''entre dans aucun module : la bande 90-99 '
                    'appartient à la classe entière.', new.numero;
  end if;
  if v_m.classe_id is distinct from new.classe_id then
    raise exception 'Le module « % » appartient à une autre classe : un module '
                    'ne traverse pas les promotions.', v_m.titre;
  end if;
  return new;
end; $$;

drop trigger if exists module_coherent on public.seances;
create trigger module_coherent
  before insert or update of module_id, classe_id, numero on public.seances
  for each row execute function public.verifier_module_seance();

-- ─── 3. Les trois modules de 2026-2027 ─────────────────────────────────────
--  `on conflict do nothing` : une fois posés, ils se règlent dans le portail.
--  Rejouer la migration ne réécrit pas un dépôt qu'on aurait corrigé depuis.
insert into public.modules (classe_id, code, titre, description, icone,
                            depot, depot_enseignant, site, ordre)
select c.id, v.code, v.titre, v.descr, v.icone, v.depot, v.depot_ens, v.site, v.ordre
  from public.classes c
  join (values
    ('BTS1-DEV-2026', 'bloc1-dev', 'Bloc 1 DEV — Les 4 cultures Ops',
     'Les 14 séances du semestre : cours, questions et corrections.', '🧭',
     'https://github.com/ggaillard/BTS1_S1_B1_DEV',
     'https://github.com/ggaillard/BTS1_S1_B1_DEV_Prof',
     'https://ggaillard.github.io/BTS1_S1_B1_DEV/', 1),
    ('BTS2-SLAM-2026', 'playlistapp', 'PlaylistApp — C# et .NET 10',
     'Les 5 TP du projet : missions, quiz et progression.', '🎵',
     'https://github.com/ggaillard/playlist-csharp',
     'https://github.com/ggaillard/playlist-csharp-prof',
     'https://ggaillard.github.io/playlist-csharp/', 1),
    ('BTS2-SLAM-2026', 'ia-meca-forez', 'IA Méca Forez — concevoir, piloter, mesurer, sécuriser',
     'Six séances de stage chez Méca Forez : spécifier, mesurer, RAG, MCP, n8n, audit.', '🏭',
     'https://github.com/ggaillard/BTS2-IA-MecaForez',
     'https://github.com/ggaillard/BTS2-IA-MecaForez-Prof',
     null, 2)
  ) as v(classe, code, titre, descr, icone, depot, depot_ens, site, ordre)
    on v.classe = c.code
on conflict (classe_id, code) do nothing;

-- ─── 4. Ranger les séances existantes ──────────────────────────────────────
--  Seulement celles qui n'ont pas encore de module : un rangement corrigé à la
--  main dans le portail n'est pas défait par un second passage.
--
--  BTS2 : les séances IA occupent le bloc 11-16 (six séances), PlaylistApp
--  tout le reste sous 90. Une séance IA créée plus tard par une migration doit
--  poser son `module_id` elle-même : ce rangement-ci ne passe qu'une fois.
update public.seances s
   set module_id = m.id
  from public.classes c, public.modules m
 where c.id = s.classe_id and m.classe_id = c.id
   and s.module_id is null and s.numero < 90
   and (   (c.code = 'BTS1-DEV-2026'  and m.code = 'bloc1-dev')
        or (c.code = 'BTS2-SLAM-2026' and m.code = 'ia-meca-forez' and s.numero between 11 and 16)
        or (c.code = 'BTS2-SLAM-2026' and m.code = 'playlistapp'   and s.numero not between 11 and 16));

-- ─── 5. Côté enseignant ────────────────────────────────────────────────────
--  Tous les modules, groupés par classe (démos comprises : le portail les
--  écarte lui-même, avec `classesReelles()`), et pour chaque classe le nombre
--  de séances encore sans module — c'est ce qu'il reste à ranger.
create or replace function public.modules_enseignant()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return jsonb_build_object('ok', true, 'classes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'classe_id', c.id, 'code', c.code, 'nom', c.nom,
             'sans_module', (select count(*) from public.seances s
                              where s.classe_id = c.id and s.numero < 90
                                and s.module_id is null),
             'modules', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', m.id, 'code', m.code, 'titre', m.titre,
                        'description', m.description, 'icone', m.icone,
                        'depot', m.depot, 'depot_enseignant', m.depot_enseignant,
                        'site', m.site, 'ordre', m.ordre,
                        'seances', (select count(*) from public.seances s
                                     where s.module_id = m.id))
                      order by m.ordre, m.id)
                 from public.modules m where m.classe_id = c.id), '[]'::jsonb))
           order by c.code)
      from public.classes c), '[]'::jsonb));
end; $$;

--  Créer (p_module_id null) ou modifier. Les contraintes de la table font
--  foi ; la fonction les traduit en phrases, pour que le portail dise QUOI
--  corriger plutôt que « le module n'a pas été enregistré ».
create or replace function public.enregistrer_module(
  p_module_id bigint, p_classe_id bigint, p_code text, p_titre text,
  p_description text, p_icone text, p_depot text, p_depot_enseignant text,
  p_site text, p_ordre int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code  text := lower(btrim(coalesce(p_code, '')));
  v_depot text := btrim(coalesce(p_depot, ''));
  v_ens   text := nullif(btrim(coalesce(p_depot_enseignant, '')), '');
  v_site  text := nullif(btrim(coalesce(p_site, '')), '');
  v_id    bigint;
  v_m     public.modules;
  v_re    text := '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$';
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if coalesce(btrim(p_titre), '') = '' then
    return jsonb_build_object('ok', false, 'motif', 'titre', 'detail', 'Le titre est vide.');
  end if;
  if v_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object('ok', false, 'motif', 'code',
      'detail', 'Le code s''écrit en minuscules, chiffres et tirets (ex. ia-meca-forez).');
  end if;
  if v_depot !~ v_re then
    return jsonb_build_object('ok', false, 'motif', 'depot',
      'detail', 'Chaque module a son dépôt GitHub : https://github.com/compte/depot.');
  end if;
  if v_ens is not null and v_ens !~ v_re then
    return jsonb_build_object('ok', false, 'motif', 'depot_enseignant',
      'detail', 'Le dépôt enseignant doit être une adresse https://github.com/compte/depot.');
  end if;
  if v_site is not null and v_site !~ '^https://' then
    return jsonb_build_object('ok', false, 'motif', 'site',
      'detail', 'Le site doit commencer par https://.');
  end if;

  if p_module_id is null then
    if not exists (select 1 from public.classes where id = p_classe_id) then
      return jsonb_build_object('ok', false, 'motif', 'classe');
    end if;
    if exists (select 1 from public.modules where classe_id = p_classe_id and code = v_code) then
      return jsonb_build_object('ok', false, 'motif', 'pris',
        'detail', 'Le code « ' || v_code || ' » existe déjà dans cette classe.');
    end if;
    insert into public.modules (classe_id, code, titre, description, icone,
                                depot, depot_enseignant, site, ordre)
    values (p_classe_id, v_code, btrim(p_titre), nullif(btrim(coalesce(p_description, '')), ''),
            coalesce(nullif(btrim(coalesce(p_icone, '')), ''), '📦'),
            v_depot, v_ens, v_site,
            coalesce(p_ordre, (select coalesce(max(ordre), 0) + 1 from public.modules
                                where classe_id = p_classe_id)))
    returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'cree', true);
  end if;

  select * into v_m from public.modules where id = p_module_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;
  if exists (select 1 from public.modules
              where classe_id = v_m.classe_id and code = v_code and id <> p_module_id) then
    return jsonb_build_object('ok', false, 'motif', 'pris',
      'detail', 'Le code « ' || v_code || ' » existe déjà dans cette classe.');
  end if;
  --  La classe ne change pas : ses séances la suivraient d'une promotion à
  --  l'autre, ou resteraient rangées dans un module qui n'est plus le leur.
  update public.modules
     set code = v_code, titre = btrim(p_titre),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         icone = coalesce(nullif(btrim(coalesce(p_icone, '')), ''), icone),
         depot = v_depot, depot_enseignant = v_ens, site = v_site,
         ordre = coalesce(p_ordre, ordre)
   where id = p_module_id;
  return jsonb_build_object('ok', true, 'id', p_module_id, 'cree', false);
end; $$;

--  Refusé tant qu'une séance y est rangée : la supprimer laisserait ses
--  séances sans module, en silence. Les ranger ailleurs d'abord.
create or replace function public.supprimer_module(p_module_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select count(*) into n from public.seances where module_id = p_module_id;
  if n > 0 then
    return jsonb_build_object('ok', false, 'motif', 'occupe',
      'detail', n || ' séance(s) y sont rangées : les ranger ailleurs d''abord.');
  end if;
  delete from public.modules where id = p_module_id;
  return jsonb_build_object('ok', true);
end; $$;

--  Ranger une séance (p_module_id null = la sortir de son module). Un geste à
--  part plutôt qu'un paramètre de plus à `enregistrer_seance()` : ajouter un
--  paramètre changerait sa signature, donc la réécrire en entier — le piège
--  de `preflight_seance()` n'a pas besoin d'une cinquième occasion.
create or replace function public.ranger_seance(p_seance_id bigint, p_module_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if not exists (select 1 from public.seances where id = p_seance_id) then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;
  begin
    update public.seances set module_id = p_module_id where id = p_seance_id;
  exception when others then
    --  Le déclencheur a refusé, et il dit pourquoi en français.
    return jsonb_build_object('ok', false, 'motif', 'incoherent', 'detail', sqlerrm);
  end;
  return jsonb_build_object('ok', true);
end; $$;

--  ⚠️ Réécrite en entier : la définition du 27/09 gagne `module_id`.
create or replace function public.seances_de_classe(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return jsonb_build_object('ok', true, 'liste', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'numero', s.numero, 'titre', s.titre,
             'nature', s.nature, 'jalons', s.jalons, 'echeance', s.echeance,
             'duree_min', s.duree_min, 'ouverte', s.ouverte, 'publiee', s.publiee,
             'notee', s.notee, 'controle_ouvert', s.controle_ouvert,
             'module_id', s.module_id,
             'missions', (select count(*) from public.missions m where m.seance_id = s.id),
             'corriges', (select count(*) from public.corriges co
                           where co.seance_id = s.id and co.question not like 'pre-%'),
             'reponses', (select count(*) from public.reponses r where r.seance_id = s.id))
           order by s.numero)
      from public.seances s
     where s.classe_id = p_classe_id and s.numero < 90), '[]'::jsonb));
end; $$;

-- ─── 6. Côté étudiant ──────────────────────────────────────────────────────
--  Les modules de SA classe, sans le dépôt enseignant. Appelée avec la clé
--  publique : c'est elle, et non la page, qui décide de ce qui sort.
create or replace function public.mes_modules()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_eleve public.eleves;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', true, 'liste', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true, 'liste', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'code', m.code, 'titre', m.titre,
             'description', m.description, 'icone', m.icone,
             'depot', m.depot, 'site', m.site)
           order by m.ordre, m.id)
      from public.modules m
     where m.classe_id = v_eleve.classe_id), '[]'::jsonb));
end; $$;

grant execute on function public.mes_modules()                    to anon, authenticated;
grant execute on function public.modules_enseignant()             to authenticated;
grant execute on function public.enregistrer_module(bigint, bigint, text, text, text, text, text, text, text, int)
  to authenticated;
grant execute on function public.supprimer_module(bigint)         to authenticated;
grant execute on function public.ranger_seance(bigint, bigint)    to authenticated;
grant execute on function public.seances_de_classe(bigint)        to authenticated;

-- ─── 7. Ce qui doit tenir ──────────────────────────────────────────────────
--  Chaque vérification qui modifie la base le fait dans un bloc qui finit en
--  exception : l'exception annule tout ce que le bloc a écrit, et on ne garde
--  que le verdict.
do $$
declare n int; v_bts1 bigint; v_bts2 bigint; v_pl bigint; v_ia bigint; v_id bigint;
        v_ok boolean;
begin
  select id into v_bts1 from public.classes where code = 'BTS1-DEV-2026';
  select id into v_bts2 from public.classes where code = 'BTS2-SLAM-2026';
  if v_bts1 is null or v_bts2 is null then
    raise notice 'Classes réelles absentes : modules créés pour rien, vérifications sautées.';
    return;
  end if;

  -- 1. Les trois modules de cette migration, chacun avec un dépôt (la
  --    contrainte le garantit déjà), et aucun doublon rejoué.
  --    Assoupli le 02/10 : « exactement 3 modules » rendait la chaîne rouge
  --    dès qu'une migration suivante en ajoutait un quatrième (le CPMS du
  --    BTS2) — un état normal pris pour une panne. On compte ce que CETTE
  --    migration pose, et on cherche le doublon là où il se verrait : deux
  --    modules d'une même classe sur le même dépôt.
  select count(*) into n from public.modules
   where classe_id in (v_bts1, v_bts2) and code in ('bloc1-dev', 'playlistapp', 'ia-meca-forez');
  if n <> 3 then raise exception 'modules des classes réelles = %, attendu 3', n; end if;
  select count(*) into n from (select classe_id, lower(rtrim(depot, '/')) from public.modules
                                 where classe_id in (v_bts1, v_bts2) group by 1, 2 having count(*) > 1) d;
  if n > 0 then raise exception '% dépôt(s) déclarés deux fois dans une même classe', n; end if;

  -- 2. Plus aucune séance de cours sans module dans une classe réelle.
  select count(*) into n from public.seances s
   where s.classe_id in (v_bts1, v_bts2) and s.numero < 90 and s.module_id is null;
  if n > 0 then raise exception '% séance(s) de cours sans module après le rangement', n; end if;

  -- 3. La bande 90-99 n'est dans aucun module.
  select count(*) into n from public.seances where numero >= 90 and module_id is not null;
  if n > 0 then raise exception '% séance(s) 90-99 rangées dans un module', n; end if;

  -- 4. Les séances IA sont dans Méca Forez, les TP dans PlaylistApp.
  select id into v_pl from public.modules where classe_id = v_bts2 and code = 'playlistapp';
  select id into v_ia from public.modules where classe_id = v_bts2 and code = 'ia-meca-forez';
  select count(*) into n from public.seances
   where classe_id = v_bts2 and numero in (11, 12) and module_id is distinct from v_ia;
  if n > 0 then raise exception '% séance(s) IA hors du module Méca Forez', n; end if;
  select count(*) into n from public.seances
   where classe_id = v_bts2 and numero between 0 and 4 and module_id is distinct from v_pl;
  if n > 0 then raise exception '% TP PlaylistApp hors de leur module', n; end if;

  -- 5. Un module ne traverse pas les promotions.
  v_ok := false;
  begin
    update public.seances set module_id = v_ia
     where classe_id = v_bts1 and numero = 1;
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'une séance du BTS1 a pu entrer dans un module du BTS2'; end if;

  -- 6. Au BTS1 (un seul module), une séance créée sans module y entre seule ;
  --    au BTS2 (deux modules), on ne devine pas.
  begin
    insert into public.seances (classe_id, numero, titre) values (v_bts1, 89, 'essai')
      returning id into v_id;
    if (select module_id from public.seances where id = v_id) is null then
      raise exception 'rangement par défaut absent au BTS1';
    end if;
    insert into public.seances (classe_id, numero, titre) values (v_bts2, 89, 'essai')
      returning id into v_id;
    if (select module_id from public.seances where id = v_id) is not null then
      raise exception 'une séance du BTS2 a été rangée au hasard';
    end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;

  -- 7. Un étudiant du BTS2 voit les deux modules de sa classe, et jamais le
  --    dépôt enseignant. Il faut un étudiant identifié : on en prête un le
  --    temps du bloc, que l'exception finale annule. Sans session (la vraie
  --    base, pendant la migration), auth.uid() est nul : rien à prêter.
  if auth.uid() is null then
    raise notice 'mes_modules() : non vérifiée ici (pas de session).';
  else
    begin
      update public.eleves set auth_id = null where auth_id = auth.uid();
      update public.eleves set auth_id = auth.uid()
       where id = (select min(id) from public.eleves where classe_id = v_bts2);
      -- Au moins les deux de cette migration (assoupli le 02/10, même raison).
      if (select count(*) from jsonb_array_elements(public.mes_modules()->'liste') x
           where x->>'code' in ('playlistapp', 'ia-meca-forez')) <> 2 then
        raise exception 'mes_modules() rend % à un étudiant du BTS2, attendu playlistapp et ia-meca-forez',
          public.mes_modules()->'liste';
      end if;
      if public.mes_modules()::text like '%Prof%' or public.mes_modules()::text like '%depot_enseignant%' then
        raise exception 'mes_modules() livre le dépôt enseignant';
      end if;
      raise exception 'annuler';
    exception when others then
      if sqlerrm <> 'annuler' then raise; end if;
    end;
  end if;

  -- 8. Un module qui porte des séances ne se supprime pas. Le COMPORTEMENT
  --    ne se vérifie que si est_enseignant() répond vrai : sur la vraie base,
  --    la migration tourne sans session, et la fonction refuserait d'emblée —
  --    un vert qui ne prouverait rien.
  if not public.est_enseignant() then
    raise notice 'supprimer_module() : comportement non vérifié ici (pas de session enseignant).';
  elsif (public.supprimer_module(v_pl)->>'ok')::boolean then
    raise exception 'supprimer_module() a supprimé un module occupé';
  end if;

  raise notice 'Modules en place : 3 modules, toutes les séances de cours rangées.';
end $$;
