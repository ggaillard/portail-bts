-- ═══════════════════════════════════════════════════════════════════════════
--  MISSIONS D'UNE SÉANCE DE PROJET, ET GESTION DES SÉANCES DEPUIS LE PORTAIL
--
--  Deux manques, constatés en préparant la séance IA 1 du BTS2 :
--
--   1. Une séance de projet se suit en jalons, et les jalons remontaient d'un
--      seul endroit : le tableau de bord PlaylistApp, qui écrit des clés
--      `tpN-…` à la valeur 'true'. Une séance sans tableau de bord à elle —
--      la séance IA 1, et les cinq qui suivront — ne remontait RIEN : jalons
--      déclarés, suivi vide, « jamais commencé » pour toute la classe.
--
--      La table `missions` décrit les missions d'une séance ; l'étudiant les
--      coche dans le portail. Une case cochée s'écrit EXACTEMENT comme celle
--      de PlaylistApp — clé `tpN-mK`, réponse 'true' — si bien que
--      `suivi_projet()`, `parcours_seance()` et le tableau de bord la comptent
--      déjà, sans qu'une ligne de leur code change. Et 'true' n'est ni 'ok' ni
--      'ko' : aucune mission n'entre dans un taux de réussite.
--
--   2. Créer une séance, corriger une échéance ou déclarer des jalons passait
--      par une migration. La séance IA 1 porte ainsi une date « À MODIFIER »
--      qu'il fallait aller réécrire dans un fichier SQL. `enregistrer_seance()`
--      le fait depuis la carte « Les séances » de l'onglet Le semestre.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La table des missions ──────────────────────────────────────────────
create table if not exists public.missions (
  id         bigserial primary key,
  seance_id  bigint not null references public.seances(id) on delete cascade,
  cle        text   not null,
  ordre      int    not null,
  libelle    text   not null,
  niveau     text,
  verbe      text,
  unique (seance_id, cle)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'missions_niveau_chk') then
    alter table public.missions
      add constraint missions_niveau_chk
      check (niveau is null or niveau in ('guide', 'semi', 'autonome'));
  end if;
end $$;

--  Aucune politique : on n'y accède que par les fonctions ci-dessous. Un
--  libellé de mission n'a rien de secret, mais une table lisible par anon est
--  une table qu'on oublie de protéger le jour où elle porte autre chose.
alter table public.missions enable row level security;

-- ─── 2. Côté étudiant : ses missions, et cocher ────────────────────────────
--  Seules les séances PUBLIÉES de sa classe : une séance qu'on prépare ne doit
--  pas apparaître avant l'heure. `ouverte` dit si l'on peut cocher.
create or replace function public.mes_missions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_eleve public.eleves; v_out jsonb;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', true, 'liste', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(x order by (x->>'numero')::int), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'seance_id', s.id,
               'numero',    s.numero,
               'titre',     s.titre,
               'ouverte',   s.ouverte,
               'echeance',  s.echeance,
               'missions',  (
                  select jsonb_agg(jsonb_build_object(
                           'cle',     m.cle,
                           'ordre',   m.ordre,
                           'libelle', m.libelle,
                           'niveau',  m.niveau,
                           'verbe',   m.verbe,
                           'fait',    r.id is not null,
                           'le',      r.updated_at)
                         order by m.ordre)
                    from public.missions m
                    left join public.reponses r
                           on r.eleve_id  = v_eleve.id
                          and r.seance_id = s.id
                          and r.question  = m.cle
                          and r.reponse   in ('true', 'ok')
                   where m.seance_id = s.id)
             ) as x
        from public.seances s
       where s.classe_id = v_eleve.classe_id
         and s.numero < 90
         and s.publiee
         and exists (select 1 from public.missions m where m.seance_id = s.id)
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

--  Cocher écrit 'true' sous la clé de la mission ; décocher efface la ligne.
--  Pas d'upsert : la contrainte d'unicité de `reponses` n'est pas garantie
--  sur toutes les bases, et un doublon compterait la mission deux fois.
create or replace function public.valider_mission(p_seance_id bigint, p_cle text, p_fait boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_eleve public.eleves; v_s public.seances; v_id bigint;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnu'); end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found or v_s.classe_id <> v_eleve.classe_id or not v_s.publiee then
    return jsonb_build_object('ok', false, 'motif', 'seance');
  end if;
  if not v_s.ouverte then
    return jsonb_build_object('ok', false, 'motif', 'fermee');
  end if;
  if not exists (select 1 from public.missions
                  where seance_id = p_seance_id and cle = p_cle) then
    return jsonb_build_object('ok', false, 'motif', 'mission');
  end if;

  select id into v_id from public.reponses
   where eleve_id = v_eleve.id and seance_id = p_seance_id and question = p_cle
   order by id limit 1;

  if p_fait then
    if v_id is null then
      insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
      values (v_eleve.id, p_seance_id, p_cle, 'true', null, now());
    else
      update public.reponses set reponse = 'true', correct = null, updated_at = now()
       where id = v_id;
    end if;
  else
    delete from public.reponses
     where eleve_id = v_eleve.id and seance_id = p_seance_id and question = p_cle;
  end if;

  return jsonb_build_object('ok', true, 'cle', p_cle, 'fait', p_fait);
end; $$;

-- ─── 3. Côté enseignant : écrire les missions ──────────────────────────────
--  Une mission par ligne. En tête, facultatif, le niveau : 🟢 guidé, 🟡 semi-
--  guidé, 🔴 autonome. En fin de ligne, facultatif, le verbe entre crochets :
--  [Concevoir]. Les clés suivent le rang : tpN-m1, tpN-m2…
--
--  Réécrire est permis — corriger un libellé, ajouter une mission. Retirer une
--  mission déjà cochée par quelqu'un ne l'est pas : la case disparaîtrait de
--  son écran, et son avancement avec elle, sans qu'il ait rien défait.
create or replace function public.definir_missions(p_seance_id bigint, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s      public.seances;
  v_ligne  text;
  v_rang   int := 0;
  v_niveau text;
  v_verbe  text;
  v_perdue text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  create temporary table if not exists _missions_neuves
    (rang int, libelle text, niveau text, verbe text) on commit drop;
  delete from _missions_neuves;

  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_niveau := case when v_ligne like '🟢%' then 'guide'
                     when v_ligne like '🟡%' then 'semi'
                     when v_ligne like '🔴%' then 'autonome' end;
    if v_niveau is not null then v_ligne := btrim(substr(v_ligne, 2)); end if;
    v_verbe := substring(v_ligne from '\[([^\]]+)\]\s*$');
    if v_verbe is not null then
      v_ligne := btrim(regexp_replace(v_ligne, '\s*\[[^\]]+\]\s*$', ''));
    end if;
    continue when v_ligne = '';
    v_rang := v_rang + 1;
    insert into _missions_neuves values (v_rang, v_ligne, v_niveau, btrim(v_verbe));
  end loop;

  select string_agg(m.cle, ', ' order by m.ordre) into v_perdue
    from public.missions m
   where m.seance_id = p_seance_id
     and m.ordre > v_rang
     and exists (select 1 from public.reponses r
                  where r.seance_id = p_seance_id and r.question = m.cle);
  if v_perdue is not null then
    return jsonb_build_object('ok', false, 'motif', 'cochee',
      'detail', 'Mission(s) déjà cochée(s), impossibles à retirer : ' || v_perdue);
  end if;

  delete from public.missions where seance_id = p_seance_id and ordre > v_rang;

  insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
  select p_seance_id, 'tp' || v_s.numero || '-m' || n.rang, n.rang, n.libelle, n.niveau, n.verbe
    from _missions_neuves n
  on conflict (seance_id, cle) do update
     set ordre = excluded.ordre, libelle = excluded.libelle,
         niveau = excluded.niveau, verbe = excluded.verbe;

  --  Les jalons suivent les missions : deux nombres pour la même chose finiraient
  --  par diverger, et le pourcentage d'avancement se calcule sur celui-ci.
  if v_rang > 0 then
    update public.seances set jalons = v_rang where id = p_seance_id;
  end if;

  return jsonb_build_object('ok', true, 'missions', v_rang);
end; $$;

-- ─── 4. Côté enseignant : la grille élèves × missions ──────────────────────
--  Une colonne par mission. Sans missions déclarées — les TP PlaylistApp —
--  les colonnes sont les clés `tp…` réellement cochées sur cette séance : la
--  grille vaut aussi pour eux. Le compte d'essai n° 99 n'y figure pas.
create or replace function public.grille_missions(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s public.seances; v_cols jsonb; v_declarees boolean;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  v_declarees := exists (select 1 from public.missions where seance_id = p_seance_id);

  if v_declarees then
    select jsonb_agg(jsonb_build_object('cle', cle, 'libelle', libelle,
                     'niveau', niveau, 'verbe', verbe) order by ordre)
      into v_cols from public.missions where seance_id = p_seance_id;
  else
    select jsonb_agg(jsonb_build_object('cle', q, 'libelle', q, 'niveau', null, 'verbe', null)
                     order by q)
      into v_cols
      from (select distinct r.question as q from public.reponses r
             where r.seance_id = p_seance_id and r.question like 'tp%'
               and r.reponse in ('true', 'ok')) t;
  end if;

  return jsonb_build_object(
    'ok', true,
    'declarees', v_declarees,
    'jalons', v_s.jalons,
    'missions', coalesce(v_cols, '[]'::jsonb),
    'eleves', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', e.numero, 'avatar', e.avatar,
               'cases', coalesce((
                  select jsonb_object_agg(r.question, r.updated_at)
                    from public.reponses r
                   where r.eleve_id = e.id and r.seance_id = p_seance_id
                     and r.question like 'tp%' and r.reponse in ('true', 'ok')), '{}'::jsonb),
               'dernier', (select max(r.updated_at) from public.reponses r
                            where r.eleve_id = e.id and r.seance_id = p_seance_id
                              and r.question like 'tp%' and r.reponse in ('true', 'ok')))
             order by e.numero)
        from public.eleves e
       where e.classe_id = v_s.classe_id and e.numero <> '99'), '[]'::jsonb));
end; $$;

-- ─── 5. Gestion des séances ────────────────────────────────────────────────
--  Toutes les séances d'une classe, hors bande 90-99 (questionnaires, stage,
--  connaissance, appel), avec de quoi décider d'un coup d'œil : missions,
--  corrigés, réponses.
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
             'missions', (select count(*) from public.missions m where m.seance_id = s.id),
             'corriges', (select count(*) from public.corriges co
                           where co.seance_id = s.id and co.question not like 'pre-%'),
             'reponses', (select count(*) from public.reponses r where r.seance_id = s.id))
           order by s.numero)
      from public.seances s
     where s.classe_id = p_classe_id and s.numero < 90), '[]'::jsonb));
end; $$;

--  Créer (p_seance_id null) ou modifier une séance. Trois garde-fous :
--   · la bande 90-99 est réservée ;
--   · un numéro déjà pris dans la classe est refusé ;
--   · on ne renumérote pas une séance qui a des réponses — les clés de mission
--     `tpN-mK` et les liens des supports portent son numéro.
create or replace function public.enregistrer_seance(
  p_seance_id bigint, p_classe_id bigint, p_numero int, p_titre text,
  p_nature text, p_jalons int, p_echeance date, p_duree_min int,
  p_publiee boolean, p_ouverte boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.seances; v_id bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if p_numero is null or p_numero < 0 or p_numero >= 90 then
    return jsonb_build_object('ok', false, 'motif', 'numero',
      'detail', 'Les numéros 90 à 99 sont réservés (questionnaires, stage, connaissance, appel).');
  end if;
  if coalesce(btrim(p_titre), '') = '' then
    return jsonb_build_object('ok', false, 'motif', 'titre', 'detail', 'Le titre est vide.');
  end if;
  if p_nature not in ('cours', 'projet') then
    return jsonb_build_object('ok', false, 'motif', 'nature');
  end if;

  if p_seance_id is null then
    if exists (select 1 from public.seances where classe_id = p_classe_id and numero = p_numero) then
      return jsonb_build_object('ok', false, 'motif', 'pris',
        'detail', 'La séance ' || p_numero || ' existe déjà dans cette classe.');
    end if;
    insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min,
                                nature, jalons, echeance, publiee)
    values (p_classe_id, p_numero, btrim(p_titre), false, coalesce(p_ouverte, false),
            coalesce(p_duree_min, 55), p_nature, nullif(p_jalons, 0), p_echeance,
            coalesce(p_publiee, false))
    returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'cree', true);
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  if p_numero <> v_s.numero then
    if exists (select 1 from public.reponses where seance_id = p_seance_id) then
      return jsonb_build_object('ok', false, 'motif', 'renumeroter',
        'detail', 'Cette séance a déjà des réponses : son numéro ne change plus.');
    end if;
    if exists (select 1 from public.seances
                where classe_id = v_s.classe_id and numero = p_numero and id <> p_seance_id) then
      return jsonb_build_object('ok', false, 'motif', 'pris',
        'detail', 'La séance ' || p_numero || ' existe déjà dans cette classe.');
    end if;
  end if;

  update public.seances
     set numero    = p_numero,
         titre     = btrim(p_titre),
         nature    = p_nature,
         jalons    = nullif(p_jalons, 0),
         echeance  = p_echeance,
         duree_min = coalesce(p_duree_min, duree_min),
         publiee   = coalesce(p_publiee, publiee),
         ouverte   = coalesce(p_ouverte, ouverte)
   where id = p_seance_id;

  return jsonb_build_object('ok', true, 'id', p_seance_id, 'cree', false);
end; $$;

grant execute on function public.mes_missions()                         to anon, authenticated;
grant execute on function public.valider_mission(bigint, text, boolean) to anon, authenticated;
grant execute on function public.definir_missions(bigint, text)         to authenticated;
grant execute on function public.grille_missions(bigint)                to authenticated;
grant execute on function public.seances_de_classe(bigint)              to authenticated;
grant execute on function public.enregistrer_seance(bigint, bigint, int, text, text, int, date, int, boolean, boolean)
  to authenticated;

-- ─── 6. Les cinq missions de la séance IA 1 ────────────────────────────────
--  Écrites directement, comme le fait le contrôle d'entrée : `definir_missions`
--  exige `est_enseignant()`, ce qu'une migration n'est pas. On n'écrase rien
--  qui existe déjà — une fois la séance jouée, les missions s'éditent dans le
--  portail.
insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
select s.id, 'tp11-m' || m.ordre, m.ordre, m.libelle, m.niveau, m.verbe
  from public.seances s
  join public.classes c on c.id = s.classe_id
  cross join (values
    (1, 'Règles de gestion et questions au tuteur',              'guide',    'Concevoir'),
    (2, 'Six scénarios Gherkin, dont deux refus',                'guide',    'Concevoir'),
    (3, 'SPEC.md et AGENTS.md committés avant l''agent',          'semi',     'Concevoir'),
    (4, 'Agent lancé, livraison relue dans la grille d''écart',   'semi',     'Piloter'),
    (5, 'Tous les scénarios verts en corrigeant la spécification', 'autonome', 'Mesurer')
  ) as m(ordre, libelle, niveau, verbe)
 where c.code = 'BTS2-SLAM-2026' and s.numero = 11
on conflict (seance_id, cle) do nothing;

do $$
declare n int;
begin
  select count(*) into n from public.missions m
    join public.seances s on s.id = m.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026' and s.numero = 11;
  if n < 5 then
    raise exception 'séance IA 1 : % mission(s), attendu au moins 5', n;
  end if;
  raise notice 'Missions et gestion des séances en place ; séance IA 1 : % missions.', n;
end $$;
