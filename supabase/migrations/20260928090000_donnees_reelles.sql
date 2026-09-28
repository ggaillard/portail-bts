-- ═══════════════════════════════════════════════════════════════════════════
--  REMETTRE LES DONNÉES D'ACCORD AVEC LA RÉALITÉ — refonte du 28/09
--
--  Relevé sur le portail en service le 28/09, avant la refonte du tableau de
--  bord :
--
--   1. Le BTS2 s'appelait « BTS SIO 2 - SLAM - PlaylistApp C# ». Un nom de
--      CLASSE portait un nom de MODULE : depuis que la classe en suit deux,
--      « Ce qui bloque » annonçait « séance 11 · PlaylistApp C# » pour une
--      séance Méca Forez. Le module a désormais sa place (table `modules`) ;
--      la classe reprend son nom.
--
--   2. Des séances JOUÉES étaient marquées « Cachée » : les séances 1 et 2 du
--      BTS1, le TP0 du BTS2. Elles ont été faites avant que « Démarrer »
--      publie aussi (09/09), ou hors du portail. Une séance jouée se relit :
--      c'est la règle de CLAUDE.md (« à partir du jour de la séance, et pour
--      toujours »). Sont publiées les séances de cours ou de projet déjà
--      démarrées, ou auxquelles un vrai étudiant (pas le n° 99) a déjà
--      répondu hors contrôle d'entrée.
--
--  Ne touche à rien d'autre. Rejouable : les deux mises à jour ne visent que
--  ce qui est encore faux.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le nom du BTS2 ─────────────────────────────────────────────────────
--  Seulement s'il porte encore le nom du module : un nom corrigé à la main
--  depuis n'est pas réécrit.
update public.classes
   set nom = 'BTS SIO 2 - SLAM'
 where code = 'BTS2-SLAM-2026'
   and nom ilike '%playlist%';

-- ─── 2. Les séances jouées, visibles ───────────────────────────────────────
do $$
declare v_liste text;
begin
  with a_publier as (
    select s.id
      from public.seances s
     where s.numero < 90
       and not s.publiee
       and (   s.demarree_le is not null
            or exists (select 1
                         from public.reponses r
                         join public.eleves e on e.id = r.eleve_id
                        where r.seance_id = s.id
                          and e.numero <> '99'
                          and r.question not like 'pre-%'))
  ), faites as (
    update public.seances s
       set publiee = true
      from a_publier p
     where s.id = p.id
    returning s.classe_id, s.numero
  )
  select string_agg(c.code || ' n° ' || f.numero, ', ' order by c.code, f.numero)
    into v_liste
    from faites f join public.classes c on c.id = f.classe_id;

  raise notice 'Séances jouées rendues visibles : %', coalesce(v_liste, 'aucune');
end $$;

-- ─── 3. Ce qui doit tenir ──────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.classes where nom ilike '%playlist%';
  if n > 0 then
    raise exception '% classe(s) portent encore un nom de module', n;
  end if;

  select count(*) into n from public.seances
   where numero < 90 and not publiee and demarree_le is not null;
  if n > 0 then
    raise exception '% séance(s) démarrée(s) restent cachées', n;
  end if;
end $$;
