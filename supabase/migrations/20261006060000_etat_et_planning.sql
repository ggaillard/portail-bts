-- ═══════════════════════════════════════════════════════════════════════════
--  L'ÉTAT D'UNE SÉANCE, ET SON PLANNING (06/10/2026) — lot 2 des propositions
--
--  Demandé par G le 06/10 (« faire le lot 2 », voir le document de projet
--  claude/application-seance-propositions.md). Trois défauts, relevés le 05/10 :
--
--    · UNE SÉANCE N'AVAIT PAS D'ÉTAT, ELLE AVAIT SIX COLONNES — publiee,
--      ouverte, demarree_le, controle_ouvert, nature, rattachee_a — et chaque
--      écran les recombinait à sa façon : sept modules du portail lisent
--      `ouverte`, et semestre(), a_faire(), bibliotheque() calculent chacune
--      leurs propres états. Les deux défauts du 05/10 en venaient : un projet
--      fermé qu'aucun bouton n'ouvrait, une séance oubliée ouverte qu'En cours
--      prenait pour l'heure en cours ;
--    · LE PORTAIL NE CONNAISSAIT PAS L'EMPLOI DU TEMPS. « La séance du jour »
--      était devinée par cinq règles (js/encours.js), et les migrations
--      disaient « à ouvrir le matin même » ;
--    · OUVRIR ET CLORE REPOSAIENT SUR LA MÉMOIRE de l'enseignant — la séance 3
--      du BTS1 est restée ouverte 121 heures.
--
--  Ce qui est posé :
--
--    · etat_seance(seance)  — UN mot, calculé ici et nulle part ailleurs :
--        cours   brouillon → prete → programmee → en_cours → terminee
--                (et ouverte : acceptée sans chrono ; oubliee : en cours bien
--                au-delà de sa durée, la règle même d'a_faire())
--        projet  brouillon → prete → programmee → ouvert (ou cache) → clos
--        90-98   propose / eteint      99  appel
--      Elle prend la ligne en argument : PostgREST la lit comme une colonne
--      (`select=…,etat:etat_seance`), et seances_de_classe() la rend aussi.
--      « Prête » reprend la liste « Prête à démarrer ? » de la fiche : corrigés
--      et concepts pour un cours, missions (ou jalons) et échéance pour un
--      projet, et un module quand la classe en a.
--    · le PLANNING — `prevue_le` et `fin_prevue` sur chaque séance, et
--      l'emploi du temps de chaque classe (`creneaux` : un jour, une heure de
--      début, une de fin). planifier_seance(), definir_creneaux(),
--      emploi_du_temps(), et aujourdhui() — l'agenda du jour, toutes classes.
--    · l'OUVERTURE ET LA CLÔTURE À L'HEURE, en option par séance
--      (`auto_ouvrir`, `auto_clore`, faux par défaut). seances_a_l_heure() est
--      appelée chaque minute par pg_cron : elle ouvre au début du créneau (un
--      cours est démarré, chrono compris ; un projet est publié et ouvert) et
--      clôt quinze minutes après la fin. `journal_auto` garde chaque geste.
--
--  Règles qui ne se devinent pas :
--
--    · L'AUTOMATE N'AGIT QU'UNE FOIS PAR CRÉNEAU, ET JAMAIS CONTRE UN GESTE DE
--      L'ENSEIGNANT. Clore à la main au milieu du créneau : il ne rouvre pas.
--      Rouvrir à la main après sa clôture : il ne reclôt pas. Ce qui est déjà
--      dans l'état voulu au moment du geste est noté comme fait (`note =
--      'deja'`). La clé du journal est (séance, geste, prevue_le) : replanifier
--      la séance réarme l'automate pour le nouveau créneau.
--    · IL N'AGIT QUE PENDANT LE CRÉNEAU, ou dans la journée qui suit sa fin
--      pour clore. Cocher « Ouvrir à l'heure » sur une séance planifiée la
--      semaine dernière ne l'ouvre pas aujourd'hui.
--    · pg_cron N'EXISTE PAS SUR LA BASE D'ESSAI DE LA CHAÎNE (postgres:16 nu).
--      Son activation est donc gardée : absente ou refusée, la migration passe
--      et le dit ; le portail le dit aussi (« ouverture automatique inactive »)
--      et propose activer_planification(), qui pose la tâche dès que
--      l'extension est là. Les options restent enregistrées en attendant.
--    · seances_a_l_heure() N'EST APPELABLE PAR PERSONNE D'AUTRE que la base
--      elle-même : révoquée pour anon et authenticated, elle ouvrirait sinon
--      des séances sur simple requête.
--    · La bande 90-99 n'a pas de planning : un questionnaire rattaché suit sa
--      séance (déclencheur questionnaire_suit), l'appel est toujours ouvert.
--    · LES HEURES SONT CELLES DE PARIS. Un créneau « lundi 15:00 » devient un
--      instant (timestamptz) par `at time zone 'Europe/Paris'` : le serveur
--      de Supabase vit en UTC, et 15:00 n'y tomberait pas au même moment en
--      octobre et en avril.
--    · Aucun emploi du temps n'est posé ici : le dépôt est public, et les
--      créneaux se tapent dans Préparer → L'emploi du temps.
--
--  ⚠️ seances_de_classe() est RÉÉCRITE EN ENTIER (elle gagne l'état et le
--  planning) : c'est cette définition qui gagne sur celle des modules
--  (20260928080000). Le piège de preflight_seance(), une fois de plus.
--
--  Rejouable sans risque : if not exists, create or replace, et des
--  vérifications qui annulent tout ce qu'elles écrivent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le planning d'une séance ───────────────────────────────────────────
alter table public.seances add column if not exists prevue_le   timestamptz;
alter table public.seances add column if not exists fin_prevue  timestamptz;
alter table public.seances add column if not exists auto_ouvrir boolean not null default false;
alter table public.seances add column if not exists auto_clore  boolean not null default false;

comment on column public.seances.prevue_le is
  'Début prévu de la séance (instant). Null : pas encore programmée.';
comment on column public.seances.fin_prevue is
  'Fin prévue. Posée par planifier_seance() à début + durée quand on ne la donne pas.';
comment on column public.seances.auto_ouvrir is
  'seances_a_l_heure() ouvre la séance au début du créneau (un cours est démarré).';
comment on column public.seances.auto_clore is
  'seances_a_l_heure() clôt la séance 15 minutes après la fin du créneau.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'seances_creneau_coherent') then
    alter table public.seances add constraint seances_creneau_coherent
      check (fin_prevue is null or (prevue_le is not null and fin_prevue > prevue_le));
  end if;
  -- Une option automatique sans créneau ne ferait rien, en silence.
  if not exists (select 1 from pg_constraint where conname = 'seances_auto_planifiee') then
    alter table public.seances add constraint seances_auto_planifiee
      check ((not auto_ouvrir and not auto_clore) or (prevue_le is not null and fin_prevue is not null));
  end if;
end $$;

-- ─── 2. L'emploi du temps d'une classe ─────────────────────────────────────
--  Lu seulement par fonctions : aucune politique, donc RLS refuse tout accès
--  direct. Un créneau ne porte rien de nominatif.
create table if not exists public.creneaux (
  id        bigserial primary key,
  classe_id bigint   not null references public.classes(id) on delete cascade,
  jour      smallint not null check (jour between 1 and 7),   -- ISO : 1 lundi … 7 dimanche
  debut     time     not null,
  fin       time     not null,
  check (fin > debut),
  unique (classe_id, jour, debut)
);
alter table public.creneaux enable row level security;

-- ─── 3. Le journal de l'automate ───────────────────────────────────────────
create table if not exists public.journal_auto (
  id        bigserial primary key,
  seance_id bigint      not null references public.seances(id) on delete cascade,
  geste     text        not null check (geste in ('ouvrir', 'clore')),
  pour      timestamptz not null,          -- le créneau visé : prevue_le au moment du geste
  note      text,                          -- 'deja' : l'état voulu était déjà là
  fait_le   timestamptz not null default now(),
  unique (seance_id, geste, pour)
);
alter table public.journal_auto enable row level security;

-- ─── 4. Ce qui manque pour qu'une séance soit prête ────────────────────────
--  La liste « Prête à démarrer ? » de la fiche (js/preparer.js), en codes.
--  Brique d'etat_seance(), non exposée.
create or replace function public._manque_seance(s public.seances)
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when coalesce(s.nature, 'cours') = 'cours'
          and not exists (select 1 from public.corriges co
                           where co.seance_id = s.id and co.question not like 'pre-%')
         then 'corriges' end,
    case when coalesce(s.nature, 'cours') = 'cours'
          and not exists (select 1 from public.concepts k where k.seance_id = s.id)
         then 'concepts' end,
    case when s.nature = 'projet' and coalesce(s.jalons, 0) = 0
          and not exists (select 1 from public.missions m where m.seance_id = s.id)
         then 'missions' end,
    case when s.nature = 'projet' and s.echeance is null then 'echeance' end,
    case when s.module_id is null
          and exists (select 1 from public.modules m where m.classe_id = s.classe_id)
         then 'module' end
  ], null)
$$;
revoke all on function public._manque_seance(public.seances) from public, anon, authenticated;

-- ─── 5. L'état, en un mot ──────────────────────────────────────────────────
--  L'ordre des cas est l'ordre de lecture : ce qui se passe maintenant
--  (ouverte), puis ce qui s'est passé (démarrée, des réponses), puis ce qui
--  reste à faire (manque, programmée). « Oubliée » est la règle d'a_faire() :
--  durée + 2 h après le démarrage, et toujours ouverte.
create or replace function public.etat_seance(s public.seances)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.numero = 99 then 'appel'
    when s.numero >= 90 then case when s.ouverte then 'propose' else 'eteint' end
    when s.nature = 'projet' then case
      when s.ouverte and not s.publiee then 'cache'
      when s.ouverte then 'ouvert'
      when s.prevue_le is not null and coalesce(s.fin_prevue, s.prevue_le) > now()
           and cardinality(public._manque_seance(s)) = 0 then 'programmee'
      when exists (select 1 from public.reponses r where r.seance_id = s.id) then 'clos'
      when cardinality(public._manque_seance(s)) > 0 then 'brouillon'
      else 'prete' end
    else case
      when s.ouverte and s.demarree_le is not null
           and now() - s.demarree_le > (coalesce(s.duree_min, 55) + 120) * interval '1 minute'
           then 'oubliee'
      when s.ouverte and s.demarree_le is not null then 'en_cours'
      when s.ouverte then 'ouverte'
      when s.demarree_le is not null then 'terminee'
      when cardinality(public._manque_seance(s)) > 0 then 'brouillon'
      when s.prevue_le is not null and coalesce(s.fin_prevue, s.prevue_le) > now() then 'programmee'
      else 'prete' end
  end
$$;
grant execute on function public.etat_seance(public.seances) to authenticated;

-- ─── 6. Les séances d'une classe — réécrite en entier ──────────────────────
--  Celle du 28/09, plus : demarree_le, le planning, l'état et ce qui manque.
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
             'module_id', s.module_id, 'demarree_le', s.demarree_le,
             'prevue_le', s.prevue_le, 'fin_prevue', s.fin_prevue,
             'auto_ouvrir', s.auto_ouvrir, 'auto_clore', s.auto_clore,
             'etat', public.etat_seance(s),
             'manque', to_jsonb(public._manque_seance(s)),
             'missions', (select count(*) from public.missions m where m.seance_id = s.id),
             'corriges', (select count(*) from public.corriges co
                           where co.seance_id = s.id and co.question not like 'pre-%'),
             'reponses', (select count(*) from public.reponses r where r.seance_id = s.id))
           order by s.numero)
      from public.seances s
     where s.classe_id = p_classe_id and s.numero < 90), '[]'::jsonb));
end; $$;
grant execute on function public.seances_de_classe(bigint) to authenticated;

-- ─── 7. Programmer une séance ──────────────────────────────────────────────
--  Un geste à part d'enregistrer_seance() : lui ajouter quatre paramètres
--  aurait changé sa signature, donc obligé à la réécrire en entier — le même
--  choix que ranger_seance() pour le module. `p_prevue_le` à null déprogramme
--  (et retire les options automatiques, qui n'auraient plus de créneau).
create or replace function public.planifier_seance(
  p_seance_id bigint, p_prevue_le timestamptz, p_fin_prevue timestamptz,
  p_auto_ouvrir boolean, p_auto_clore boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.seances; v_fin timestamptz;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero >= 90 then
    return jsonb_build_object('ok', false, 'motif', 'numero',
      'detail', 'Les questionnaires et l''appel n''ont pas de créneau : un questionnaire rattaché suit sa séance.');
  end if;

  if p_prevue_le is null then
    update public.seances
       set prevue_le = null, fin_prevue = null, auto_ouvrir = false, auto_clore = false
     where id = p_seance_id;
    select * into v_s from public.seances where id = p_seance_id;
    return jsonb_build_object('ok', true, 'etat', public.etat_seance(v_s));
  end if;

  v_fin := coalesce(p_fin_prevue, p_prevue_le + coalesce(v_s.duree_min, 55) * interval '1 minute');
  if v_fin <= p_prevue_le then
    return jsonb_build_object('ok', false, 'motif', 'creneau',
      'detail', 'La fin du créneau doit venir après son début.');
  end if;

  update public.seances
     set prevue_le = p_prevue_le, fin_prevue = v_fin,
         auto_ouvrir = coalesce(p_auto_ouvrir, false),
         auto_clore  = coalesce(p_auto_clore, false)
   where id = p_seance_id;
  select * into v_s from public.seances where id = p_seance_id;
  return jsonb_build_object('ok', true, 'etat', public.etat_seance(v_s),
                            'prevue_le', v_s.prevue_le, 'fin_prevue', v_s.fin_prevue);
end; $$;
grant execute on function public.planifier_seance(bigint, timestamptz, timestamptz, boolean, boolean)
  to authenticated;

-- ─── 8. L'automate est-il en marche ? ──────────────────────────────────────
--  plpgsql et non sql : `cron.job` n'existe pas sur la base d'essai, et une
--  fonction sql serait refusée à la création. Ici la requête n'est préparée
--  que si le schéma existe.
create or replace function public.planification_active()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if to_regclass('cron.job') is null then return false; end if;
  return exists (select 1 from cron.job where jobname = 'seances-a-l-heure' and active);
exception when others then
  return false;
end; $$;
grant execute on function public.planification_active() to authenticated;

-- ─── 9. L'emploi du temps : l'écrire, le lire ──────────────────────────────
--  Un créneau par ligne : « lundi 15:00-17:00 », « mar 8h30 – 10h30 ».
--  Comme creer_modele() : une ligne illisible fait échouer TOUTE l'écriture,
--  en la nommant — l'ignorer donnerait un emploi du temps amputé sans que
--  personne ne le sache. Réécrire est libre : aucun travail d'étudiant n'est
--  attaché à un créneau.
create or replace function public.definir_creneaux(p_classe_id bigint, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_jours constant text[] := array['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  v_l text; v_n int := 0; v_m text[]; v_h1 int; v_m1 int; v_h2 int; v_m2 int;
  v_liste jsonb := '[]'::jsonb; v_conflit text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if not exists (select 1 from public.classes where id = p_classe_id) then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;

  for v_l in select btrim(x) from regexp_split_to_table(coalesce(p_texte, ''), E'\n') x loop
    v_n := v_n + 1;
    continue when v_l = '';
    v_m := regexp_match(lower(v_l),
      '^(lun|mar|mer|jeu|ven|sam|dim)[a-z]*\.?\s+(\d{1,2})(?:\s*[h:]\s*(\d{2})?)?\s*(?:-|–|à)\s*(\d{1,2})(?:\s*[h:]\s*(\d{2})?)?$');
    if v_m is null then
      return jsonb_build_object('ok', false, 'motif', 'ligne',
        'detail', 'Ligne ' || v_n || ' illisible : « ' || v_l ||
                  ' ». Attendu par exemple « lundi 15:00-17:00 ». Rien n''a été enregistré.');
    end if;
    v_h1 := v_m[2]::int; v_m1 := coalesce(v_m[3], '0')::int;
    v_h2 := v_m[4]::int; v_m2 := coalesce(v_m[5], '0')::int;
    if v_h1 > 23 or v_h2 > 23 or v_m1 > 59 or v_m2 > 59
       or make_time(v_h2, v_m2, 0) <= make_time(v_h1, v_m1, 0) then
      return jsonb_build_object('ok', false, 'motif', 'ligne',
        'detail', 'Ligne ' || v_n || ' : « ' || v_l ||
                  ' » — l''heure de fin doit venir après celle du début. Rien n''a été enregistré.');
    end if;
    v_liste := v_liste || jsonb_build_object('n', v_n, 'jour', array_position(v_jours, v_m[1]),
      'debut', make_time(v_h1, v_m1, 0), 'fin', make_time(v_h2, v_m2, 0));
  end loop;

  -- Deux créneaux qui se chevauchent le même jour : l'un des deux est faux.
  select 'lignes ' || (a->>'n') || ' et ' || (b->>'n') into v_conflit
    from jsonb_array_elements(v_liste) a, jsonb_array_elements(v_liste) b
   where (a->>'n')::int < (b->>'n')::int and a->>'jour' = b->>'jour'
     and (a->>'debut')::time < (b->>'fin')::time and (b->>'debut')::time < (a->>'fin')::time
   limit 1;
  if v_conflit is not null then
    return jsonb_build_object('ok', false, 'motif', 'ligne',
      'detail', 'Deux créneaux se chevauchent (' || v_conflit || '). Rien n''a été enregistré.');
  end if;

  delete from public.creneaux where classe_id = p_classe_id;
  insert into public.creneaux (classe_id, jour, debut, fin)
  select p_classe_id, (x->>'jour')::smallint, (x->>'debut')::time, (x->>'fin')::time
    from jsonb_array_elements(v_liste) x;

  return jsonb_build_object('ok', true, 'creneaux', jsonb_array_length(v_liste));
end; $$;
grant execute on function public.definir_creneaux(bigint, text) to authenticated;

create or replace function public.emploi_du_temps()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  return jsonb_build_object('ok', true,
    'automatique', public.planification_active(),
    'pg_cron', to_regnamespace('cron') is not null,
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'nom', c.nom,
               'creneaux', coalesce((
                 select jsonb_agg(jsonb_build_object('jour', cr.jour,
                          'debut', to_char(cr.debut, 'HH24:MI'), 'fin', to_char(cr.fin, 'HH24:MI'))
                        order by cr.jour, cr.debut)
                   from public.creneaux cr where cr.classe_id = c.id), '[]'::jsonb))
             order by c.id)
        from public.classes c), '[]'::jsonb));
end; $$;
grant execute on function public.emploi_du_temps() to authenticated;

-- ─── 10. L'agenda du jour, toutes classes réelles ──────────────────────────
--  Deux listes que la page croise : les CRÉNEAUX du jour (l'emploi du temps)
--  et les SÉANCES du jour — programmées ce jour-là, démarrées ce jour-là, ou
--  un cours encore ouvert (en cours ou oublié : il faut le voir pour le
--  clore). Un projet ouvert depuis des semaines n'y est pas : ce n'est pas
--  « la séance du jour ». Les démonstrations n'y sont pas non plus.
create or replace function public.aujourdhui(p_jour date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_auj date := (now() at time zone 'Europe/Paris')::date; v_jour date;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  v_jour := coalesce(p_jour, v_auj);
  return jsonb_build_object('ok', true, 'jour', v_jour, 'maintenant', now(),
    'automatique', public.planification_active(),
    'emploi_du_temps', exists (select 1 from public.creneaux),
    'creneaux', coalesce((
      select jsonb_agg(jsonb_build_object(
               'classe_id', c.id, 'code', c.code, 'nom', c.nom,
               'debut', to_char(cr.debut, 'HH24:MI'), 'fin', to_char(cr.fin, 'HH24:MI'),
               'debut_le', (v_jour + cr.debut) at time zone 'Europe/Paris',
               'fin_le',   (v_jour + cr.fin)   at time zone 'Europe/Paris')
             order by cr.debut, c.code)
        from public.creneaux cr join public.classes c on c.id = cr.classe_id
       where cr.jour = extract(isodow from v_jour) and c.code not like 'DEMO%'), '[]'::jsonb),
    'seances', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'classe_id', c.id, 'code', c.code, 'nom', c.nom,
               'numero', s.numero, 'titre', s.titre, 'nature', s.nature,
               'etat', public.etat_seance(s), 'manque', to_jsonb(public._manque_seance(s)),
               'ouverte', s.ouverte, 'publiee', s.publiee, 'demarree_le', s.demarree_le,
               'duree_min', s.duree_min, 'prevue_le', s.prevue_le, 'fin_prevue', s.fin_prevue,
               'auto_ouvrir', s.auto_ouvrir, 'auto_clore', s.auto_clore,
               'journal', coalesce((
                 select jsonb_agg(jsonb_build_object('geste', j.geste, 'note', j.note, 'fait_le', j.fait_le)
                        order by j.fait_le)
                   from public.journal_auto j
                  where j.seance_id = s.id and j.pour = s.prevue_le), '[]'::jsonb))
             order by coalesce(s.prevue_le, s.demarree_le), c.code, s.numero)
        from public.seances s join public.classes c on c.id = s.classe_id
       where s.numero < 90 and c.code not like 'DEMO%'
         and ((s.prevue_le at time zone 'Europe/Paris')::date = v_jour
           or (s.demarree_le at time zone 'Europe/Paris')::date = v_jour
           or (v_jour = v_auj and coalesce(s.nature, 'cours') = 'cours' and s.ouverte))), '[]'::jsonb));
end; $$;
grant execute on function public.aujourdhui(date) to authenticated;

-- ─── 11. L'automate ────────────────────────────────────────────────────────
create or replace function public.seances_a_l_heure()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record; n_ouv int := 0; n_clo int := 0;
begin
  -- Ce qui est DÉJÀ dans l'état voulu au moment du geste est noté comme fait :
  -- c'est ce qui empêche l'automate de défaire, plus tard dans le créneau, ce
  -- que l'enseignant aura fait à la main (rouvrir ce qu'il a clos, reclore ce
  -- qu'il a rouvert).
  insert into public.journal_auto (seance_id, geste, pour, note)
  select x.id, 'ouvrir', x.prevue_le, 'deja'
    from public.seances x
   where x.auto_ouvrir and x.ouverte and x.numero < 90
     and x.prevue_le <= now() and x.fin_prevue > now()
  on conflict do nothing;

  for v in select x.id, x.nature, x.prevue_le from public.seances x
            where x.auto_ouvrir and not x.ouverte and x.numero < 90
              and x.prevue_le <= now() and x.fin_prevue > now()
              and not exists (select 1 from public.journal_auto j
                               where j.seance_id = x.id and j.geste = 'ouvrir' and j.pour = x.prevue_le)
  loop
    -- Un cours est DÉMARRÉ (le chrono part, comme demarrer_seance()) ; un
    -- projet est publié et ouvert, sans chrono (comme js/ouverture.js).
    if v.nature = 'projet' then
      update public.seances set publiee = true, ouverte = true where id = v.id;
    else
      update public.seances set publiee = true, ouverte = true, demarree_le = now() where id = v.id;
    end if;
    insert into public.journal_auto (seance_id, geste, pour) values (v.id, 'ouvrir', v.prevue_le)
      on conflict do nothing;
    n_ouv := n_ouv + 1;
  end loop;

  insert into public.journal_auto (seance_id, geste, pour, note)
  select x.id, 'clore', x.prevue_le, 'deja'
    from public.seances x
   where x.auto_clore and not x.ouverte and x.numero < 90
     and x.fin_prevue + interval '15 minutes' <= now() and x.fin_prevue + interval '1 day' > now()
  on conflict do nothing;

  for v in select x.id, x.prevue_le from public.seances x
            where x.auto_clore and x.ouverte and x.numero < 90
              and x.fin_prevue + interval '15 minutes' <= now()
              and x.fin_prevue + interval '1 day' > now()
              and not exists (select 1 from public.journal_auto j
                               where j.seance_id = x.id and j.geste = 'clore' and j.pour = x.prevue_le)
  loop
    -- Comme clore_seance() : fermer aux réponses, garder demarree_le.
    update public.seances set ouverte = false where id = v.id;
    insert into public.journal_auto (seance_id, geste, pour) values (v.id, 'clore', v.prevue_le)
      on conflict do nothing;
    n_clo := n_clo + 1;
  end loop;

  return jsonb_build_object('ok', true, 'ouvertes', n_ouv, 'closes', n_clo);
end; $$;
revoke all on function public.seances_a_l_heure() from public, anon, authenticated;

-- Poser la tâche chaque minute. Depuis le portail aussi : si l'extension a
-- été activée après cette migration (Supabase → Database → Extensions), ce
-- bouton suffit — une migration déjà appliquée ne se rejoue pas.
create or replace function public.activer_planification()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if to_regnamespace('cron') is null then
    return jsonb_build_object('ok', false, 'motif', 'pg_cron',
      'detail', 'L''extension pg_cron n''est pas activée sur la base. Supabase → Database → '
                'Extensions → pg_cron, puis revenez ici.');
  end if;
  execute $q$select cron.schedule('seances-a-l-heure', '* * * * *', 'select public.seances_a_l_heure()')$q$;
  return jsonb_build_object('ok', true, 'automatique', public.planification_active());
exception when others then
  return jsonb_build_object('ok', false, 'motif', 'pg_cron',
    'detail', 'La base a refusé de planifier la tâche : ' || sqlerrm);
end; $$;
grant execute on function public.activer_planification() to authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'Planning : pg_cron absent de ce serveur — ouverture et clôture automatiques inactives ici.';
    return;
  end if;
  begin
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('seances-a-l-heure', '* * * * *', 'select public.seances_a_l_heure()');
    raise notice 'Planning : seances_a_l_heure() planifiée chaque minute.';
  exception when others then
    raise notice 'Planning : pg_cron refusé (%) — à activer depuis Supabase, puis « Activer » dans le portail.', sqlerrm;
  end;
end $$;

-- ─── 12. Ce qui doit tenir ─────────────────────────────────────────────────
--  Chaque vérification qui écrit le fait dans un bloc qui finit en exception :
--  l'exception annule tout ce que le bloc a écrit, on ne garde que le verdict.
do $$
declare
  n int; v_bts1 bigint; v_id bigint; v_99 bigint; v_s public.seances; v_r jsonb;
  v_midi timestamptz := (((now() at time zone 'Europe/Paris')::date + time '12:00') at time zone 'Europe/Paris');
begin
  -- 1. Toute séance a un état, et un état connu.
  select count(*) into n from public.seances s
   where public.etat_seance(s) is null or public.etat_seance(s) not in
     ('brouillon', 'prete', 'programmee', 'ouverte', 'en_cours', 'oubliee', 'terminee',
      'ouvert', 'cache', 'clos', 'propose', 'eteint', 'appel');
  if n > 0 then raise exception '% séance(s) sans état connu', n; end if;

  -- 2. L'automate n'est appelable que par la base.
  if has_function_privilege('anon', 'public.seances_a_l_heure()', 'execute')
     or has_function_privilege('authenticated', 'public.seances_a_l_heure()', 'execute') then
    raise exception 'seances_a_l_heure() est appelable depuis le portail : elle ouvrirait des séances sur simple requête';
  end if;

  select id into v_bts1 from public.classes where code = 'BTS1-DEV-2026';
  if v_bts1 is null then
    raise notice 'Planning : classe BTS1 absente, vérifications de comportement sautées.';
    return;
  end if;
  select id into v_id from public.seances where classe_id = v_bts1 and numero = 1;
  select id into v_99 from public.seances where classe_id = v_bts1 and numero = 99;

  -- 3. L'automate : ouvrir à l'heure, une fois ; clore à la fin, une fois ;
  --    jamais contre un geste de l'enseignant ; rien sur un créneau périmé.
  begin
    update public.seances
       set ouverte = false, demarree_le = null,
           prevue_le = now() - interval '2 minutes', fin_prevue = now() + interval '50 minutes',
           auto_ouvrir = true, auto_clore = true
     where id = v_id;
    perform public.seances_a_l_heure();
    select * into v_s from public.seances where id = v_id;
    if not v_s.ouverte or v_s.demarree_le is null or not v_s.publiee then
      raise exception 'automate : la séance n''a pas été ouverte et démarrée au début du créneau';
    end if;
    if public.etat_seance(v_s) <> 'en_cours' then
      raise exception 'automate : état % après l''ouverture, attendu en_cours', public.etat_seance(v_s);
    end if;

    update public.seances set ouverte = false where id = v_id;          -- l'enseignant clôt tôt
    perform public.seances_a_l_heure();
    if (select ouverte from public.seances where id = v_id) then
      raise exception 'automate : il a rouvert une séance close à la main pendant le créneau';
    end if;

    -- Un créneau où l'enseignant a ouvert AVANT l'automate, puis clos : la
    -- ligne « déjà ouverte » est ce qui empêche de rouvrir.
    update public.seances
       set ouverte = true,
           prevue_le = now() - interval '3 minutes', fin_prevue = now() + interval '40 minutes'
     where id = v_id;
    perform public.seances_a_l_heure();
    update public.seances set ouverte = false where id = v_id;
    perform public.seances_a_l_heure();
    if (select ouverte from public.seances where id = v_id) then
      raise exception 'automate : il a rouvert une séance que l''enseignant avait ouverte avant lui, puis close';
    end if;

    update public.seances                                               -- un autre créneau, fini
       set ouverte = true,
           prevue_le = now() - interval '80 minutes', fin_prevue = now() - interval '20 minutes'
     where id = v_id;
    perform public.seances_a_l_heure();
    if (select ouverte from public.seances where id = v_id) then
      raise exception 'automate : la séance n''a pas été close quinze minutes après la fin';
    end if;

    update public.seances set ouverte = true where id = v_id;           -- l'enseignant rouvre
    perform public.seances_a_l_heure();
    if not (select ouverte from public.seances where id = v_id) then
      raise exception 'automate : il a reclos une séance rouverte à la main';
    end if;

    -- Un créneau fini où l'enseignant avait DÉJÀ clos, puis rouvre après la
    -- fin : la ligne « déjà close » est ce qui empêche de reclore.
    update public.seances
       set ouverte = false,
           prevue_le = now() - interval '90 minutes', fin_prevue = now() - interval '25 minutes'
     where id = v_id;
    perform public.seances_a_l_heure();
    update public.seances set ouverte = true where id = v_id;
    perform public.seances_a_l_heure();
    if not (select ouverte from public.seances where id = v_id) then
      raise exception 'automate : il a reclos une séance que l''enseignant avait close avant lui, puis rouverte';
    end if;

    update public.seances                                               -- un créneau d'avant-hier
       set prevue_le = now() - interval '2 days', fin_prevue = now() - interval '2 days' + interval '1 hour'
     where id = v_id;
    perform public.seances_a_l_heure();
    if not (select ouverte from public.seances where id = v_id) then
      raise exception 'automate : il a clos une séance sur un créneau vieux de deux jours';
    end if;

    -- Quatre créneaux, quatre lignes : deux gestes faits, deux trouvés déjà faits.
    select count(*) into n from public.journal_auto where seance_id = v_id;
    if n <> 4 then raise exception 'automate : % ligne(s) au journal, attendu 4', n; end if;
    select count(*) into n from public.journal_auto where seance_id = v_id and note = 'deja';
    if n <> 2 then raise exception 'automate : % geste(s) notés « déjà faits », attendu 2', n; end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;

  -- 4. Les fonctions de l'enseignant. Leur COMPORTEMENT ne se vérifie que si
  --    est_enseignant() répond vrai : sur la vraie base, la migration tourne
  --    sans session, et un refus d'emblée ferait un vert qui ne prouve rien.
  if not public.est_enseignant() then
    raise notice 'Planning : fonctions de l''enseignant non vérifiées ici (pas de session).';
  else
    begin
      v_r := public.definir_creneaux(v_bts1, E'lundi 15:00-17:00\n\nMardi 8h30 – 10h30\nven 9h-10h');
      if not (v_r->>'ok')::boolean or (v_r->>'creneaux')::int <> 3 then
        raise exception 'definir_creneaux() : % pour trois lignes lisibles', v_r;
      end if;
      v_r := public.definir_creneaux(v_bts1, E'lundi 15:00-17:00\nmardi à 15h');
      if (v_r->>'ok')::boolean or v_r->>'detail' not like 'Ligne 2%' then
        raise exception 'definir_creneaux() : une ligne illisible donne %', v_r;
      end if;
      v_r := public.definir_creneaux(v_bts1, E'lundi 15:00-17:00\nlundi 16h-18h');
      if (v_r->>'ok')::boolean then raise exception 'definir_creneaux() : un chevauchement a été accepté'; end if;
      select count(*) into n from public.creneaux where classe_id = v_bts1;
      if n <> 3 then raise exception 'definir_creneaux() : un refus a touché l''emploi du temps (% créneaux)', n; end if;
      if jsonb_array_length((select x->'creneaux' from jsonb_array_elements(public.emploi_du_temps()->'classes') x
                              where (x->>'id')::bigint = v_bts1)) <> 3 then
        raise exception 'emploi_du_temps() ne rend pas les trois créneaux';
      end if;

      v_r := public.planifier_seance(v_id, v_midi, null, true, false);
      select * into v_s from public.seances where id = v_id;
      if not (v_r->>'ok')::boolean or v_s.fin_prevue <> v_s.prevue_le + v_s.duree_min * interval '1 minute' then
        raise exception 'planifier_seance() : fin % pour un début %, durée %', v_s.fin_prevue, v_s.prevue_le, v_s.duree_min;
      end if;
      if (public.planifier_seance(v_id, v_midi, v_midi - interval '1 hour', false, false)->>'ok')::boolean then
        raise exception 'planifier_seance() accepte une fin avant le début';
      end if;
      if (public.planifier_seance(v_99, v_midi, null, false, false)->>'ok')::boolean then
        raise exception 'planifier_seance() programme la séance d''appel';
      end if;
      if not exists (select 1 from jsonb_array_elements(public.aujourdhui()->'seances') x
                      where (x->>'id')::bigint = v_id) then
        raise exception 'aujourdhui() ne montre pas la séance programmée à midi';
      end if;
      -- Lundi, mardi et vendredi ont un créneau du BTS1 ; les autres jours, aucun.
      n := case when extract(isodow from (now() at time zone 'Europe/Paris')) in (1, 2, 5) then 1 else 0 end;
      if jsonb_array_length(public.aujourdhui()->'creneaux') <> n then
        raise exception 'aujourdhui() : % pour % créneau(x) attendu(s)', public.aujourdhui()->'creneaux', n;
      end if;

      v_r := public.planifier_seance(v_id, null, null, true, true);
      select * into v_s from public.seances where id = v_id;
      if v_s.prevue_le is not null or v_s.auto_ouvrir or v_s.auto_clore then
        raise exception 'planifier_seance(null) n''a pas tout déprogrammé';
      end if;
      raise exception 'annuler';
    exception when others then
      if sqlerrm <> 'annuler' then raise; end if;
    end;
  end if;

  raise notice 'Planning en place : état unique, créneaux, agenda du jour, automate %.',
    case when public.planification_active() then 'actif' else 'inactif ici' end;
end $$;
