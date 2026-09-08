-- ═══════════════════════════════════════════════════════════════════════════
--  UNE BIBLIOTHÈQUE DE QUESTIONNAIRES
--
--  Jusqu'ici un questionnaire était un numéro de séance écrit en dur : 98 pour
--  « Faisons connaissance », 97 pour « Recherche de stage ». En ajouter un
--  troisième demandait une migration, un numéro de plus, et une fonction de
--  plus. Autrement dit : moi. Ce n'est pas tenable pour quelque chose qu'on
--  veut écrire la veille d'un cours.
--
--  Le modèle devient à deux étages :
--
--    MODÈLE            le texte du questionnaire, écrit une fois
--      ↓ affectation
--    SÉANCE            une par classe, avec ses réponses à elle
--
--  Écrire « Faisons connaissance » une fois, l'affecter au BTS1 et au BTS2 :
--  deux séances, deux jeux de réponses, un seul texte à corriger.
--
--  Les questionnaires occupent la bande de numéros 90 à 98. En dessous, les
--  séances de cours ; 99, l'appel, qui ne se ferme pas.
--
--  Rien de l'existant ne bouge : les séances 97 et 98 sont RATTACHÉES à un
--  modèle reconstruit depuis leurs propres corrigés. connaissance() et stage()
--  continuent de fonctionner à l'identique.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les deux tables ────────────────────────────────────────────────────
create table if not exists public.modeles (
  id      bigint generated always as identity primary key,
  cle     text        not null unique,
  titre   text        not null,
  intro   text,
  -- « sequentiel » : une question à la fois, sans retour en arrière — c'est ce
  -- qui rend douze questions supportables sur un téléphone.
  -- « revisable »  : toutes les questions à l'écran, modifiables à volonté —
  -- pour un point d'étape qui change en cours d'année.
  mode    text        not null default 'sequentiel'
          check (mode in ('sequentiel', 'revisable')),
  cree_le timestamptz not null default now()
);

create table if not exists public.modele_questions (
  id        bigint generated always as identity primary key,
  modele_id bigint not null references public.modeles(id) on delete cascade,
  rang      int    not null,
  cle       text   not null,
  intitule  text   not null,
  options   text[] not null,
  unique (modele_id, cle)
);

create index if not exists modele_questions_modele on public.modele_questions(modele_id, rang);

alter table public.seances add column if not exists modele_id bigint
  references public.modeles(id) on delete set null;

-- Une troisième nature de séance. La contrainte posée par projet.sql n'admet
-- que « cours » et « projet » : on la remplace plutôt que d'en ajouter une
-- seconde, sinon deux contraintes se contrediraient un jour.
alter table public.seances drop constraint if exists seances_nature_chk;
alter table public.seances add constraint seances_nature_chk
  check (nature in ('cours', 'projet', 'questionnaire'));

alter table public.modeles          enable row level security;
alter table public.modele_questions enable row level security;

-- Les modèles ne portent aucune donnée d'élève : lecture ouverte, écriture
-- réservée. Un étudiant n'en a pas l'usage, mais rien n'y est sensible.
drop policy if exists "modeles lisibles" on public.modeles;
create policy "modeles lisibles" on public.modeles
  for select to anon, authenticated using (true);
drop policy if exists "ens modeles" on public.modeles;
create policy "ens modeles" on public.modeles
  for all to authenticated using (public.est_enseignant()) with check (public.est_enseignant());

drop policy if exists "modele questions lisibles" on public.modele_questions;
create policy "modele questions lisibles" on public.modele_questions
  for select to anon, authenticated using (true);
drop policy if exists "ens modele questions" on public.modele_questions;
create policy "ens modele questions" on public.modele_questions
  for all to authenticated using (public.est_enseignant()) with check (public.est_enseignant());

-- ─── 2. Reprendre l'existant ───────────────────────────────────────────────
--  Les deux questionnaires en service deviennent des modèles, reconstruits
--  depuis les corrigés d'une séance qui les porte déjà. On ne réécrit pas le
--  texte à la main : il existe, et le recopier serait l'occasion de le
--  déformer.
insert into public.modeles (cle, titre, intro, mode)
select v.cle, v.titre, v.intro, v.mode
  from (values
    ('connaissance', 'Faisons connaissance',
     'Quelques questions posées une seule fois dans l''année. Il n''y a pas de bonne réponse : elles me servent à adapter les cours à ce que vous êtes.',
     'sequentiel'),
    ('stage', 'Recherche de stage',
     'Un point d''étape, à remettre à jour dès que quelque chose bouge : vous pouvez changer vos réponses autant de fois que nécessaire.',
     'revisable')
  ) as v(cle, titre, intro, mode)
 where not exists (select 1 from public.modeles m where m.cle = v.cle);

do $$
declare
  v_m   bigint;
  v_s   bigint;
  v_num int;
  v_cle text;
begin
  foreach v_cle in array array['connaissance', 'stage'] loop
    v_num := case v_cle when 'connaissance' then 98 else 97 end;
    select id into v_m from public.modeles where cle = v_cle;

    -- La séance de référence : celle qui a le plus de corrigés. S'il y en a
    -- plusieurs (deux classes), elles portent le même texte.
    select s.id into v_s
      from public.seances s
     where s.numero = v_num
       and exists (select 1 from public.corriges co where co.seance_id = s.id)
     order by (select count(*) from public.corriges co where co.seance_id = s.id) desc
     limit 1;

    if v_s is not null and not exists (
         select 1 from public.modele_questions q where q.modele_id = v_m) then
      insert into public.modele_questions (modele_id, rang, cle, intitule, options)
      select v_m, row_number() over (order by co.question),
             co.question, coalesce(co.intitule, co.question), coalesce(co.options, '{}')
        from public.corriges co
       where co.seance_id = v_s;
    end if;

    -- Toutes les séances de ce numéro pointent vers le modèle, et prennent la
    -- nature « questionnaire » : c'est elle qui les distingue d'un cours.
    update public.seances
       set modele_id = v_m, nature = 'questionnaire'
     where numero = v_num and modele_id is distinct from v_m;
  end loop;
end $$;

-- ─── 3. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int; m int;
begin
  select count(*) into m from public.modeles;
  select count(*) into n from public.modele_questions;
  raise notice 'Bibliotheque : % modele(s), % question(s).', m, n;

  select count(*) into n from public.modele_questions q
    join public.modeles md on md.id = q.modele_id where md.cle = 'connaissance';
  if n <> 12 then raise exception 'modele connaissance : % questions, attendu 12', n; end if;

  select count(*) into n from public.modele_questions q
    join public.modeles md on md.id = q.modele_id where md.cle = 'stage';
  if n <> 6 then raise exception 'modele stage : % questions, attendu 6', n; end if;

  select count(*) into n from public.seances
   where numero in (97, 98) and (modele_id is null or nature <> 'questionnaire');
  if n <> 0 then raise exception '% seance(s) 97/98 non rattachee(s) a leur modele', n; end if;
end $$;
