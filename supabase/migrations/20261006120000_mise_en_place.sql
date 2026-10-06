-- ═══════════════════════════════════════════════════════════════════════════
--  LA MISE EN PLACE (06/10/2026) — lot 3 des propositions
--
--  Demandé par G le 06/10 (« ok pour le lot 3 », document de projet
--  claude/application-seance-propositions.md). Le lot 2 a donné à chaque
--  séance un état et un créneau ; ce lot sert à MONTER ce qui se joue :
--
--    · dupliquer_seance()   — une séance proche, recopiée : titre, nature,
--      durée, module, missions (renumérotées), contrôle d'entrée (éteint).
--      Ni corrigés de quiz, ni concepts, ni date : ce sont eux qui changent ;
--    · creer_seances()      — les séances d'un module d'un coup, une par
--      ligne (« 3 — Le versioning »), pour l'assistant « Nouveau module » ;
--    · programmer_seances() — plusieurs séances placées À LA SUITE sur les
--      créneaux libres de leur classe, dans l'ordre de leurs numéros ;
--    · agenda()             — les créneaux et les séances de sept jours (ou
--      plus), toutes classes réelles, et ce qui reste à placer : la vue
--      « La semaine à préparer » ;
--    · bilan_seance()       — ce qu'une séance a été : prévu et fait, appel
--      du jour, participation, contrôle d'entrée, missions, et ce que
--      l'automate a fait. L'onglet Bilan de la page d'une séance ;
--    · reconduire_classe()  — l'année suivante : une classe neuve avec les
--      modules et les séances de celle-ci, leurs corrigés, concepts,
--      missions et points de passage, SANS élève ni réponse. Un aperçu
--      d'abord (p_ecrire à faux), l'écriture ensuite.
--
--  Règles qui ne se devinent pas :
--
--    · UNE COPIE NAÎT FERMÉE ET CACHÉE, comme toute séance créée depuis le
--      portail : la dupliquer pendant l'heure ne la montre à personne.
--    · LES CLÉS DE MISSION PORTENT LE NUMÉRO DE LA SÉANCE (tp11-m3). Une
--      mission recopiée vers la séance 13 devient tp13-m3 : sinon une case
--      cochée sur la copie se compterait sur l'original.
--    · creer_seances() REFUSE TOUT DÈS QU'UNE LIGNE EST FAUSSE, et dit
--      laquelle — la règle de creer_modele() et de definir_creneaux(). Une
--      séance oubliée en silence au milieu d'un module se retrouverait en
--      plein semestre.
--    · programmer_seances() NE TOUCHE NI UNE SÉANCE JOUÉE NI UNE SÉANCE
--      OUVERTE, et il le dit pour chacune : déplacer le créneau d'une séance
--      en cours changerait ce que fait l'automate pendant l'heure.
--    · reconduire_classe() CRÉE, ELLE NE DÉPLACE RIEN : la classe de cette
--      année reste intacte, et c'est purger_annee() qui la vide ensuite.
--      La classe neuve apparaît dans la liste de connexion des étudiants dès
--      sa création : c'est un geste de fin d'année.
--    · Les comportements ne se vérifient que si est_enseignant() répond
--      vrai : sur la vraie base, la migration tourne sans session.
--
--  Rejouable sans risque : create or replace, et des vérifications qui
--  annulent tout ce qu'elles écrivent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le prochain numéro libre d'une classe ──────────────────────────────
--  Le suivant du plus grand ; s'il sort de la bande 0-89, le premier trou.
--  Brique non exposée.
create or replace function public._numero_libre(p_classe_id bigint)
returns int language sql stable security definer set search_path = public as $$
  select case
    when coalesce(max(numero) + 1, 0) < 90 then coalesce(max(numero) + 1, 0)
    else (select min(g) from generate_series(0, 89) g
           where not exists (select 1 from public.seances x
                              where x.classe_id = p_classe_id and x.numero = g))
  end
  from public.seances where classe_id = p_classe_id and numero < 90
$$;
revoke all on function public._numero_libre(bigint) from public, anon, authenticated;

-- ─── 2. Dupliquer une séance ───────────────────────────────────────────────
create or replace function public.dupliquer_seance(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.seances; v_n int; v_id bigint; v_mi int; v_ct int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_s.numero >= 90 then
    return jsonb_build_object('ok', false, 'motif', 'numero',
      'detail', 'Les questionnaires et l''appel ne se dupliquent pas : un questionnaire se donne à une autre classe depuis « Vos questionnaires ».');
  end if;
  v_n := public._numero_libre(v_s.classe_id);
  if v_n is null then
    return jsonb_build_object('ok', false, 'motif', 'plein',
      'detail', 'Les numéros 0 à 89 de cette classe sont tous pris.');
  end if;

  insert into public.seances (classe_id, numero, titre, notee, ouverte, publiee,
                              nature, jalons, duree_min, module_id)
  values (v_s.classe_id, v_n, v_s.titre || ' (copie)', coalesce(v_s.notee, false), false, false,
          coalesce(v_s.nature, 'cours'), v_s.jalons, v_s.duree_min, v_s.module_id)
  returning id into v_id;

  insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
  select v_id, regexp_replace(m.cle, '^tp[0-9]+-', 'tp' || v_n || '-'), m.ordre, m.libelle, m.niveau, m.verbe
    from public.missions m where m.seance_id = p_seance_id;
  get diagnostics v_mi = row_count;

  insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options, theme)
  select v_id, co.question, co.bonne_reponse, co.explication, co.intitule, co.options, co.theme
    from public.corriges co where co.seance_id = p_seance_id and co.question like 'pre-%';
  select count(*) into v_ct from public.corriges
   where seance_id = v_id and question ~ '^pre-[0-9]+$';

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_n,
                            'titre', v_s.titre || ' (copie)', 'missions', v_mi, 'notions', v_ct);
end; $$;
grant execute on function public.dupliquer_seance(bigint) to authenticated;

-- ─── 3. Créer les séances d'un module, une par ligne ───────────────────────
--  « 3 — Le versioning », « Séance 3 : Le versioning », « TP0 Mise en
--  route », « 3. Le versioning » : un numéro, puis le titre.
create or replace function public.creer_seances(
  p_classe_id bigint, p_module_id bigint, p_texte text, p_nature text, p_duree_min int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_lignes text[]; v_l text; v_m text[]; i int := 0; v_n int;
  v_nums int[] := '{}'; v_titres text[] := '{}'; v_id bigint; v_liste jsonb := '[]'::jsonb;
  v_nature text := coalesce(nullif(trim(p_nature), ''), 'cours');
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if not exists (select 1 from public.classes where id = p_classe_id) then
    return jsonb_build_object('ok', false, 'motif', 'classe', 'detail', 'Classe inconnue.');
  end if;
  if v_nature not in ('cours', 'projet') then
    return jsonb_build_object('ok', false, 'motif', 'nature', 'detail', 'Nature « ' || v_nature || ' » : cours ou projet.');
  end if;
  if p_module_id is not null and not exists (select 1 from public.modules
                                               where id = p_module_id and classe_id = p_classe_id) then
    return jsonb_build_object('ok', false, 'motif', 'module', 'detail', 'Ce module n''appartient pas à cette classe.');
  end if;
  if p_duree_min is not null and (p_duree_min < 5 or p_duree_min > 600) then
    return jsonb_build_object('ok', false, 'motif', 'duree', 'detail', 'Une durée entre 5 et 600 minutes.');
  end if;

  v_lignes := regexp_split_to_array(coalesce(p_texte, ''), E'\r?\n');
  foreach v_l in array v_lignes loop
    i := i + 1;
    if trim(v_l) = '' then continue; end if;
    v_m := regexp_match(trim(v_l),
      '^(?:s[ée]ance\s*|tp\s*)?([0-9]{1,2})\s*(?:[—–:.)/-]+\s*|\s+)(\S.*)$', 'i');
    if v_m is null then
      return jsonb_build_object('ok', false, 'motif', 'ligne',
        'detail', 'Ligne ' || i || ' : « ' || trim(v_l) || ' » — un numéro puis le titre, comme « 3 — Le versioning ».');
    end if;
    v_n := v_m[1]::int;
    if v_n >= 90 then
      return jsonb_build_object('ok', false, 'motif', 'ligne',
        'detail', 'Ligne ' || i || ' : le numéro ' || v_n || ' est réservé (90 à 99 : questionnaires et appel).');
    end if;
    if v_n = any(v_nums) then
      return jsonb_build_object('ok', false, 'motif', 'ligne',
        'detail', 'Ligne ' || i || ' : le numéro ' || v_n || ' est déjà sur une ligne précédente.');
    end if;
    if exists (select 1 from public.seances where classe_id = p_classe_id and numero = v_n) then
      return jsonb_build_object('ok', false, 'motif', 'ligne',
        'detail', 'Ligne ' || i || ' : la classe a déjà une séance ' || v_n || '.');
    end if;
    v_nums := v_nums || v_n;
    v_titres := v_titres || trim(v_m[2]);
  end loop;
  if cardinality(v_nums) = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide', 'detail', 'Aucune ligne à créer.');
  end if;
  if cardinality(v_nums) > 40 then
    return jsonb_build_object('ok', false, 'motif', 'trop', 'detail', 'Quarante séances au plus d''un coup.');
  end if;

  for i in 1 .. cardinality(v_nums) loop
    insert into public.seances (classe_id, numero, titre, notee, ouverte, publiee, nature, duree_min, module_id)
    values (p_classe_id, v_nums[i], v_titres[i], false, false, false, v_nature,
            coalesce(p_duree_min, case when v_nature = 'projet' then 120 else 55 end), p_module_id)
    returning id into v_id;
    v_liste := v_liste || jsonb_build_object('id', v_id, 'numero', v_nums[i], 'titre', v_titres[i]);
  end loop;
  return jsonb_build_object('ok', true, 'creees', cardinality(v_nums), 'liste', v_liste);
end; $$;
grant execute on function public.creer_seances(bigint, bigint, text, text, int) to authenticated;

-- ─── 4. Programmer plusieurs séances à la suite ────────────────────────────
--  Dans l'ordre des numéros, chacune sur le premier créneau libre de sa
--  classe à partir de `p_depuis` (aujourd'hui par défaut), sur six mois au
--  plus. « Libre » : aucune autre séance de la classe ne le chevauche — y
--  compris celles que ce même appel vient de placer. Les options
--  automatiques de chaque séance sont gardées.
create or replace function public.programmer_seances(p_ids bigint[], p_depuis date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.seances; v_debut timestamptz; v_fin timestamptz;
  v_auj date := (now() at time zone 'Europe/Paris')::date;
  v_depuis date; v_faites jsonb := '[]'::jsonb; v_ecartees jsonb := '[]'::jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide', 'detail', 'Aucune séance choisie.');
  end if;
  v_depuis := greatest(coalesce(p_depuis, v_auj), v_auj);

  for v_s in select * from public.seances where id = any(p_ids) order by classe_id, numero loop
    if v_s.numero >= 90 then
      v_ecartees := v_ecartees || jsonb_build_object('id', v_s.id, 'numero', v_s.numero,
        'detail', 'les questionnaires et l''appel n''ont pas de créneau');
      continue;
    end if;
    if v_s.ouverte or v_s.demarree_le is not null then
      v_ecartees := v_ecartees || jsonb_build_object('id', v_s.id, 'numero', v_s.numero,
        'detail', 'déjà ouverte ou jouée : son créneau ne bouge pas');
      continue;
    end if;
    if not exists (select 1 from public.creneaux where classe_id = v_s.classe_id) then
      v_ecartees := v_ecartees || jsonb_build_object('id', v_s.id, 'numero', v_s.numero,
        'detail', 'sa classe n''a pas d''emploi du temps');
      continue;
    end if;
    v_debut := null;
    select d.debut_le, d.fin_le into v_debut, v_fin
      from (select ((g::date + cr.debut) at time zone 'Europe/Paris') as debut_le,
                   ((g::date + cr.fin)   at time zone 'Europe/Paris') as fin_le
              from generate_series(v_depuis::timestamp, (v_depuis + 186)::timestamp, interval '1 day') g
              join public.creneaux cr on cr.classe_id = v_s.classe_id
                                     and cr.jour = extract(isodow from g)) d
     where d.debut_le > now()
       and not exists (select 1 from public.seances x
                        where x.classe_id = v_s.classe_id and x.id <> v_s.id and x.numero < 90
                          and x.prevue_le is not null
                          and x.prevue_le < d.fin_le and coalesce(x.fin_prevue, x.prevue_le) > d.debut_le)
     order by d.debut_le limit 1;
    if v_debut is null then
      v_ecartees := v_ecartees || jsonb_build_object('id', v_s.id, 'numero', v_s.numero,
        'detail', 'aucun créneau libre dans les six prochains mois');
      continue;
    end if;
    update public.seances set prevue_le = v_debut, fin_prevue = v_fin where id = v_s.id;
    v_faites := v_faites || jsonb_build_object('id', v_s.id, 'numero', v_s.numero,
                                              'prevue_le', v_debut, 'fin_prevue', v_fin);
  end loop;
  return jsonb_build_object('ok', true, 'programmees', v_faites, 'ecartees', v_ecartees);
end; $$;
grant execute on function public.programmer_seances(bigint[], date) to authenticated;

-- ─── 5. L'agenda de plusieurs jours, et ce qui reste à placer ──────────────
--  aujourdhui() sur une période : les créneaux de chaque jour, les séances
--  programmées dans la période, et pour chaque classe réelle les séances
--  ni jouées ni programmées (ou programmées sur un créneau passé) — celles
--  qu'on peut poser sur un créneau vide.
create or replace function public.agenda(p_debut date default null, p_jours int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_debut date := coalesce(p_debut, (now() at time zone 'Europe/Paris')::date);
  v_jours int := least(greatest(coalesce(p_jours, 7), 1), 31);
  v_de timestamptz; v_a timestamptz;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  v_de := v_debut::timestamp at time zone 'Europe/Paris';
  v_a  := (v_debut + v_jours)::timestamp at time zone 'Europe/Paris';
  return jsonb_build_object('ok', true, 'debut', v_debut, 'jours', v_jours, 'maintenant', now(),
    'automatique', public.planification_active(),
    'emploi_du_temps', exists (select 1 from public.creneaux),
    'creneaux', coalesce((
      select jsonb_agg(jsonb_build_object(
               'classe_id', c.id, 'code', c.code, 'nom', c.nom, 'jour', g::date,
               'debut_le', (g::date + cr.debut) at time zone 'Europe/Paris',
               'fin_le',   (g::date + cr.fin)   at time zone 'Europe/Paris')
             order by g, cr.debut, c.code)
        from generate_series(v_debut::timestamp, (v_debut + v_jours - 1)::timestamp, interval '1 day') g
        join public.creneaux cr on cr.jour = extract(isodow from g)
        join public.classes c on c.id = cr.classe_id
       where c.code not like 'DEMO%'), '[]'::jsonb),
    'seances', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'classe_id', c.id, 'code', c.code, 'nom', c.nom,
               'numero', s.numero, 'titre', s.titre, 'nature', s.nature, 'module_id', s.module_id,
               'etat', public.etat_seance(s), 'manque', to_jsonb(public._manque_seance(s)),
               'ouverte', s.ouverte, 'publiee', s.publiee, 'demarree_le', s.demarree_le,
               'duree_min', s.duree_min, 'prevue_le', s.prevue_le, 'fin_prevue', s.fin_prevue,
               'auto_ouvrir', s.auto_ouvrir, 'auto_clore', s.auto_clore)
             order by s.prevue_le, c.code, s.numero)
        from public.seances s join public.classes c on c.id = s.classe_id
       where s.numero < 90 and c.code not like 'DEMO%'
         and s.prevue_le >= v_de and s.prevue_le < v_a), '[]'::jsonb),
    'a_placer', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'classe_id', s.classe_id, 'numero', s.numero, 'titre', s.titre,
               'nature', s.nature, 'etat', public.etat_seance(s))
             order by s.classe_id, s.numero)
        from public.seances s join public.classes c on c.id = s.classe_id
       where s.numero < 90 and c.code not like 'DEMO%'
         and not s.ouverte and s.demarree_le is null
         and (s.prevue_le is null or coalesce(s.fin_prevue, s.prevue_le) < now())
         and not exists (select 1 from public.reponses r where r.seance_id = s.id)), '[]'::jsonb));
end; $$;
grant execute on function public.agenda(date, int) to authenticated;

-- ─── 6. Le bilan d'une séance ──────────────────────────────────────────────
--  Ce que debriefing() ne dit pas : le prévu et le fait, l'appel du jour de
--  la séance (le jour où elle a démarré, sinon celui où elle était prévue),
--  qui a participé, le contrôle d'entrée, les missions, et le journal de
--  l'automate. Les règles habituelles : n° 99 exclu, pre-, appel- et
--  humeur- hors participation, un jalon = une clé tp… à true.
create or replace function public.bilan_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s public.seances; v_jour date; v_99 bigint; v_cle text;
  v_inscrits int; v_presents int; v_absents jsonb; v_pose boolean := false;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  select count(*) into v_inscrits from public.eleves where classe_id = v_s.classe_id and numero <> '99';
  v_jour := (coalesce(v_s.demarree_le, v_s.prevue_le) at time zone 'Europe/Paris')::date;
  if v_jour is not null and v_s.numero < 90 then
    v_cle := 'appel-' || to_char(v_jour, 'YYYY-MM-DD');
    select id into v_99 from public.seances where classe_id = v_s.classe_id and numero = 99;
    v_pose := exists (select 1 from public.corriges where seance_id = v_99 and question = v_cle)
           or exists (select 1 from public.reponses where seance_id = v_99 and question = v_cle);
    select count(distinct r.eleve_id) into v_presents
      from public.reponses r join public.eleves e on e.id = r.eleve_id
     where r.seance_id = v_99 and r.question = v_cle and e.numero <> '99';
    select coalesce(jsonb_agg(e.numero order by e.numero::int), '[]'::jsonb) into v_absents
      from public.eleves e
     where e.classe_id = v_s.classe_id and e.numero <> '99' and e.numero ~ '^[0-9]+$'
       and not exists (select 1 from public.reponses r
                        where r.seance_id = v_99 and r.question = v_cle and r.eleve_id = e.id);
  end if;

  return jsonb_build_object('ok', true,
    'seance', jsonb_build_object(
      'id', v_s.id, 'classe_id', v_s.classe_id, 'numero', v_s.numero, 'titre', v_s.titre,
      'nature', v_s.nature, 'etat', public.etat_seance(v_s), 'ouverte', v_s.ouverte,
      'publiee', v_s.publiee, 'duree_min', v_s.duree_min, 'demarree_le', v_s.demarree_le,
      'prevue_le', v_s.prevue_le, 'fin_prevue', v_s.fin_prevue,
      'ecart_min', case when v_s.demarree_le is not null and v_s.prevue_le is not null
                        then round(extract(epoch from v_s.demarree_le - v_s.prevue_le) / 60) end),
    'inscrits', v_inscrits,
    'appel', case when v_jour is null then null else jsonb_build_object(
      'jour', v_jour, 'pose', v_pose,
      'presents', coalesce(v_presents, 0),
      'absents', case when v_pose then v_absents else '[]'::jsonb end) end,
    'participants', (select count(distinct r.eleve_id)
                       from public.reponses r join public.eleves e on e.id = r.eleve_id
                      where r.seance_id = p_seance_id and e.numero <> '99'
                        and r.question not like 'pre-%' and r.question not like 'appel-%'
                        and r.question not like 'humeur-%'),
    'reponses', (select count(*) from public.reponses r join public.eleves e on e.id = r.eleve_id
                  where r.seance_id = p_seance_id and e.numero <> '99'),
    'controle', (select jsonb_build_object(
                   'notions', count(distinct co.question),
                   'repondants', count(distinct r.eleve_id),
                   'reussite', case when count(r.id) = 0 then null
                                    else round(100.0 * count(r.id) filter (where r.reponse = co.bonne_reponse) / count(r.id)) end)
                   from public.corriges co
                   left join public.reponses r on r.seance_id = co.seance_id and r.question = co.question
                        and exists (select 1 from public.eleves e where e.id = r.eleve_id and e.numero <> '99')
                  where co.seance_id = p_seance_id and co.question ~ '^pre-[0-9]+$'),
    'missions', (select jsonb_build_object(
                   'declarees', (select count(*) from public.missions m where m.seance_id = p_seance_id),
                   'mediane', (select percentile_cont(0.5) within group (order by n)
                                 from (select count(*) filter (where r.question like 'tp%' and r.reponse in ('true', 'ok')) as n
                                         from public.eleves e
                                         left join public.reponses r on r.eleve_id = e.id and r.seance_id = p_seance_id
                                        where e.classe_id = v_s.classe_id and e.numero <> '99'
                                        group by e.id) t),
                   'finis', (select count(*) from (
                               select e.id from public.eleves e
                                 join public.reponses r on r.eleve_id = e.id and r.seance_id = p_seance_id
                                where e.classe_id = v_s.classe_id and e.numero <> '99'
                                  and r.question like 'tp%' and r.reponse in ('true', 'ok')
                                group by e.id
                               having count(*) >= greatest(1, (select count(*) from public.missions m
                                                                where m.seance_id = p_seance_id))) f))),
    'journal', coalesce((select jsonb_agg(jsonb_build_object('geste', j.geste, 'pour', j.pour,
                                                             'note', j.note, 'fait_le', j.fait_le)
                                          order by j.fait_le)
                           from public.journal_auto j where j.seance_id = p_seance_id), '[]'::jsonb));
end; $$;
grant execute on function public.bilan_seance(bigint) to authenticated;

-- ─── 7. Reconduire une classe pour l'année suivante ────────────────────────
--  `p_ecrire` à faux : l'aperçu — ce qui serait recréé, sans rien écrire.
create or replace function public.reconduire_classe(
  p_classe_id bigint, p_code text, p_nom text, p_ecrire boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c public.classes; v_code text := upper(trim(coalesce(p_code, '')));
  v_annee text; v_neuve bigint; v_mid bigint; v_sid bigint; v_map jsonb := '{}'::jsonb;
  m record; s record; v_compte jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_c from public.classes where id = p_classe_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue', 'detail', 'Classe inconnue.'); end if;
  if v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' then
    return jsonb_build_object('ok', false, 'motif', 'code',
      'detail', 'Un code en majuscules, chiffres et tirets, comme BTS1-DEV-2027.');
  end if;
  if exists (select 1 from public.classes where code = v_code) then
    return jsonb_build_object('ok', false, 'motif', 'pris', 'detail', 'Le code ' || v_code || ' existe déjà.');
  end if;
  v_annee := case when v_c.annee ~ '^[0-9]{4}-[0-9]{4}$'
                  then (left(v_c.annee, 4)::int + 1) || '-' || (right(v_c.annee, 4)::int + 1)
                  else v_c.annee end;

  v_compte := jsonb_build_object(
    'modules',  (select count(*) from public.modules where classe_id = p_classe_id),
    'seances',  (select count(*) from public.seances where classe_id = p_classe_id and numero < 90),
    'corriges', (select count(*) from public.corriges co join public.seances x on x.id = co.seance_id
                  where x.classe_id = p_classe_id and x.numero < 90),
    'concepts', (select count(*) from public.concepts k join public.seances x on x.id = k.seance_id
                  where x.classe_id = p_classe_id and x.numero < 90),
    'missions', (select count(*) from public.missions mi join public.seances x on x.id = mi.seance_id
                  where x.classe_id = p_classe_id and x.numero < 90),
    'passages', (select count(*) from public.points_passage pp join public.seances x on x.id = pp.seance_id
                  where x.classe_id = p_classe_id and x.numero < 90),
    'projets',  (select count(*) from public.projets where classe_id = p_classe_id));

  if not coalesce(p_ecrire, false) then
    return jsonb_build_object('ok', true, 'essai', true, 'code', v_code,
      'nom', coalesce(nullif(trim(p_nom), ''), v_c.nom), 'annee', v_annee, 'compte', v_compte);
  end if;

  insert into public.classes (code, nom, annee)
  values (v_code, coalesce(nullif(trim(p_nom), ''), v_c.nom), v_annee) returning id into v_neuve;

  -- L'appel : sans sa séance 99, aucun étudiant ne pourrait pointer.
  insert into public.seances (classe_id, numero, titre, notee, ouverte)
  select v_neuve, 99, coalesce((select titre from public.seances where classe_id = p_classe_id and numero = 99),
                               'Appel - question du jour'), false, true;

  for m in select * from public.modules where classe_id = p_classe_id order by ordre, id loop
    insert into public.modules (classe_id, code, titre, description, icone, depot, depot_enseignant, site, ordre)
    values (v_neuve, m.code, m.titre, m.description, m.icone, m.depot, m.depot_enseignant, m.site, m.ordre)
    returning id into v_mid;
    v_map := v_map || jsonb_build_object(m.id::text, v_mid);
  end loop;

  for s in select * from public.seances where classe_id = p_classe_id and numero < 90 order by numero loop
    insert into public.seances (classe_id, numero, titre, notee, ouverte, publiee, nature, jalons, duree_min, module_id)
    values (v_neuve, s.numero, s.titre, coalesce(s.notee, false), false, false, coalesce(s.nature, 'cours'),
            s.jalons, s.duree_min, (v_map->>(s.module_id::text))::bigint)
    returning id into v_sid;
    insert into public.corriges (seance_id, question, bonne_reponse, explication, intitule, options, theme)
    select v_sid, question, bonne_reponse, explication, intitule, options, theme
      from public.corriges where seance_id = s.id;
    insert into public.concepts (seance_id, rang, intitule, detail, questions)
    select v_sid, rang, intitule, detail, questions from public.concepts where seance_id = s.id;
    insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
    select v_sid, cle, ordre, libelle, niveau, verbe from public.missions where seance_id = s.id;
    insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
    select v_sid, acte, titre, fin_min, intitule, options, bonne, explication
      from public.points_passage where seance_id = s.id;
  end loop;

  insert into public.projets (classe_id, titre, description, url, icone, ordre)
  select v_neuve, titre, description, url, icone, ordre from public.projets where classe_id = p_classe_id;

  return jsonb_build_object('ok', true, 'essai', false, 'classe_id', v_neuve, 'code', v_code,
                            'annee', v_annee, 'compte', v_compte);
end; $$;
grant execute on function public.reconduire_classe(bigint, text, text, boolean) to authenticated;

-- ─── 8. Ce qui doit tenir ──────────────────────────────────────────────────
do $$
declare
  n int; v_bts1 bigint; v_bts2 bigint; v_11 bigint; v_r jsonb; v_id bigint; v_a bigint; v_b bigint;
  v_s public.seances; v_t public.seances; v_99 bigint; v_auj date := (now() at time zone 'Europe/Paris')::date;
begin
  -- 1. Les briques ne sont pas appelables depuis le portail.
  if has_function_privilege('authenticated', 'public._numero_libre(bigint)', 'execute') then
    raise exception '_numero_libre() est appelable depuis le portail';
  end if;

  select id into v_bts1 from public.classes where code = 'BTS1-DEV-2026';
  select id into v_bts2 from public.classes where code = 'BTS2-SLAM-2026';
  if v_bts1 is null or v_bts2 is null then
    raise notice 'Mise en place : classes réelles absentes, vérifications de comportement sautées.';
    return;
  end if;
  if not public.est_enseignant() then
    raise notice 'Mise en place : fonctions de l''enseignant non vérifiées ici (pas de session).';
    return;
  end if;

  begin
    -- 2. Dupliquer la séance IA 1 du BTS2 : missions renumérotées, contrôle
    --    éteint, fermée et cachée, même module ; jamais la bande 90-99.
    select id into v_11 from public.seances where classe_id = v_bts2 and numero = 11;
    if v_11 is not null then
      v_r := public.dupliquer_seance(v_11);
      if not (v_r->>'ok')::boolean then raise exception 'dupliquer_seance() : %', v_r; end if;
      select * into v_s from public.seances where id = (v_r->>'id')::bigint;
      select * into v_t from public.seances where id = v_11;
      if v_s.numero <> (select max(numero) from public.seances where classe_id = v_bts2 and numero < 90)
         or v_s.ouverte or v_s.publiee or v_s.controle_ouvert
         or v_s.module_id is distinct from v_t.module_id or v_s.nature <> v_t.nature then
        raise exception 'dupliquer_seance() : copie % pour l''original %', row_to_json(v_s), row_to_json(v_t);
      end if;
      select count(*) into n from public.missions
       where seance_id = v_s.id and cle not like 'tp' || v_s.numero || '-%';
      if n > 0 then raise exception 'dupliquer_seance() : % mission(s) gardent la clé de l''original', n; end if;
      if (select count(*) from public.missions where seance_id = v_s.id)
         <> (select count(*) from public.missions where seance_id = v_11) then
        raise exception 'dupliquer_seance() : les missions n''ont pas toutes été recopiées';
      end if;
      if (select count(*) from public.corriges where seance_id = v_s.id)
         <> (select count(*) from public.corriges where seance_id = v_11 and question like 'pre-%') then
        raise exception 'dupliquer_seance() : le contrôle d''entrée n''est pas recopié à l''identique';
      end if;
    end if;
    select id into v_99 from public.seances where classe_id = v_bts1 and numero = 99;
    if (public.dupliquer_seance(v_99)->>'ok')::boolean then
      raise exception 'dupliquer_seance() duplique la séance d''appel';
    end if;

    -- 3. Créer des séances : tout ou rien, et la ligne fautive nommée.
    v_r := public.creer_seances(v_bts1, null, E'40 — Une séance neuve\n\nSéance 41 : Une autre', 'cours', null);
    if not (v_r->>'ok')::boolean or (v_r->>'creees')::int <> 2 then
      raise exception 'creer_seances() : % pour deux lignes lisibles', v_r;
    end if;
    v_a := (v_r->'liste'->0->>'id')::bigint;
    v_b := (v_r->'liste'->1->>'id')::bigint;
    if (select titre from public.seances where id = v_b) <> 'Une autre'
       or (select ouverte or publiee from public.seances where id = v_a) then
      raise exception 'creer_seances() : titre ou état de la séance créée faux';
    end if;
    v_r := public.creer_seances(v_bts1, null, E'42 Bonne ligne\nmauvaise ligne', 'cours', null);
    if (v_r->>'ok')::boolean or v_r->>'detail' not like 'Ligne 2%' then
      raise exception 'creer_seances() : une ligne illisible donne %', v_r;
    end if;
    if exists (select 1 from public.seances where classe_id = v_bts1 and numero = 42) then
      raise exception 'creer_seances() : un refus a laissé la première ligne créée';
    end if;
    if (public.creer_seances(v_bts1, null, '40 Doublon', 'cours', null)->>'ok')::boolean then
      raise exception 'creer_seances() accepte un numéro déjà pris';
    end if;
    if (public.creer_seances(v_bts1, null, '95 Appel bis', 'cours', null)->>'ok')::boolean then
      raise exception 'creer_seances() accepte la bande 90-99';
    end if;

    -- 4. Programmer à la suite : deux créneaux distincts, dans l'ordre des
    --    numéros ; une séance jouée et une classe sans créneau sont écartées.
    perform public.definir_creneaux(v_bts1, E'lundi 15:00-17:00\nmercredi 10:00-12:00');
    delete from public.creneaux where classe_id = v_bts2;
    update public.seances set ouverte = true, demarree_le = now() where classe_id = v_bts1 and numero = 1;
    v_r := public.programmer_seances(array[v_b, v_a,
             (select id from public.seances where classe_id = v_bts1 and numero = 1),
             (select id from public.seances where classe_id = v_bts2 and not ouverte and numero < 90
               order by numero limit 1)], null);
    if jsonb_array_length(v_r->'programmees') <> 2 or jsonb_array_length(v_r->'ecartees') <> 2
       or not exists (select 1 from jsonb_array_elements(v_r->'ecartees') x where x->>'detail' like '%emploi du temps%')
       or not exists (select 1 from jsonb_array_elements(v_r->'ecartees') x where x->>'detail' like '%jouée%') then
      raise exception 'programmer_seances() : % ', v_r;
    end if;
    select * into v_s from public.seances where id = v_a;
    select * into v_t from public.seances where id = v_b;
    if v_s.prevue_le is null or v_t.prevue_le is null or v_s.prevue_le >= v_t.prevue_le
       or v_s.prevue_le <= now() then
      raise exception 'programmer_seances() : séance 40 à %, séance 41 à % — attendu deux créneaux à venir, dans l''ordre',
        v_s.prevue_le, v_t.prevue_le;
    end if;
    if to_char(v_s.prevue_le at time zone 'Europe/Paris', 'HH24:MI') not in ('15:00', '10:00')
       or extract(isodow from v_s.prevue_le at time zone 'Europe/Paris') not in (1, 3) then
      raise exception 'programmer_seances() : % n''est pas un créneau de l''emploi du temps (heure de Paris)', v_s.prevue_le;
    end if;
    if v_s.fin_prevue - v_s.prevue_le <> interval '2 hours' then
      raise exception 'programmer_seances() : la fin ne suit pas le créneau (% → %)', v_s.prevue_le, v_s.fin_prevue;
    end if;

    -- 5. L'agenda de sept jours : les deux créneaux de la semaine, les deux
    --    séances programmées, et ce qui reste à placer.
    v_r := public.agenda(v_auj, 7);
    if jsonb_array_length(v_r->'creneaux') <> 2 then
      raise exception 'agenda() : % créneau(x) sur sept jours, attendu 2', jsonb_array_length(v_r->'creneaux');
    end if;
    select count(*) into n from jsonb_array_elements(v_r->'seances') x where (x->>'id')::bigint in (v_a, v_b);
    if n <> 2 then raise exception 'agenda() : % des deux séances programmées', n; end if;
    if exists (select 1 from jsonb_array_elements(v_r->'a_placer') x where (x->>'id')::bigint in (v_a, v_b)) then
      raise exception 'agenda() : une séance programmée est encore « à placer »';
    end if;

    -- 6. Le bilan : l'appel du jour de la séance, les participants.
    select id into v_id from public.seances where classe_id = v_bts1 and numero = 1;
    insert into public.reponses (eleve_id, seance_id, question, reponse)
    select e.id, v_99, 'appel-' || to_char(v_auj, 'YYYY-MM-DD'), 'A'
      from public.eleves e where e.classe_id = v_bts1 and e.numero in ('01', '02');
    insert into public.reponses (eleve_id, seance_id, question, reponse)
    select e.id, v_id, 'q1', 'B' from public.eleves e where e.classe_id = v_bts1 and e.numero = '02';
    v_r := public.bilan_seance(v_id);
    if (v_r->>'inscrits')::int <> (select count(*) from public.eleves where classe_id = v_bts1 and numero <> '99')
       or (v_r->'appel'->>'presents')::int <> 2 or (v_r->>'participants')::int <> 1
       or jsonb_array_length(v_r->'appel'->'absents') <> (v_r->>'inscrits')::int - 2 then
      raise exception 'bilan_seance() : %', v_r;
    end if;

    -- 7. Reconduire le BTS2 (deux modules : rien ne se range tout seul) :
    --    l'aperçu n'écrit rien ; l'écriture recopie tout, séance d'appel
    --    comprise, et chaque séance retrouve le module de même code dans la
    --    classe NEUVE.
    v_r := public.reconduire_classe(v_bts2, 'bts2-slam-2027', null, false);
    if not (v_r->>'essai')::boolean or exists (select 1 from public.classes where code = 'BTS2-SLAM-2027') then
      raise exception 'reconduire_classe() : l''aperçu a écrit (%)', v_r;
    end if;
    if (public.reconduire_classe(v_bts2, 'BTS1-DEV-2026', null, true)->>'ok')::boolean then
      raise exception 'reconduire_classe() accepte un code déjà pris';
    end if;
    if (public.reconduire_classe(v_bts2, 'bts 2', null, true)->>'ok')::boolean then
      raise exception 'reconduire_classe() accepte un code illisible';
    end if;
    v_r := public.reconduire_classe(v_bts2, 'BTS2-SLAM-2027', null, true);
    v_id := (v_r->>'classe_id')::bigint;
    if v_id is null or (select annee from public.classes where id = v_id) <> '2027-2028' then
      raise exception 'reconduire_classe() : %', v_r;
    end if;
    if not exists (select 1 from public.seances where classe_id = v_id and numero = 99 and ouverte) then
      raise exception 'reconduire_classe() : la classe neuve n''a pas sa séance d''appel ouverte';
    end if;
    if (select count(*) from public.seances where classe_id = v_id and numero < 90)
       <> (select count(*) from public.seances where classe_id = v_bts2 and numero < 90)
       or (select count(*) from public.corriges co join public.seances x on x.id = co.seance_id where x.classe_id = v_id)
       <> (v_r->'compte'->>'corriges')::int
       or (select count(*) from public.missions mi join public.seances x on x.id = mi.seance_id where x.classe_id = v_id)
       <> (v_r->'compte'->>'missions')::int then
      raise exception 'reconduire_classe() : séances, corrigés ou missions manquants (%)', v_r->'compte';
    end if;
    select count(*) into n
      from public.seances a
      join public.seances b on b.classe_id = v_id and b.numero = a.numero
      left join public.modules ma on ma.id = a.module_id
      left join public.modules mb on mb.id = b.module_id
     where a.classe_id = v_bts2 and a.numero < 90
       and (ma.code is distinct from mb.code or (mb.id is not null and mb.classe_id <> v_id));
    if n > 0 then
      raise exception 'reconduire_classe() : % séance(s) neuve(s) hors du module de même code de la classe neuve', n;
    end if;
    if exists (select 1 from public.eleves where classe_id = v_id)
       or exists (select 1 from public.reponses r join public.seances x on x.id = r.seance_id where x.classe_id = v_id)
       or exists (select 1 from public.seances where classe_id = v_id and numero < 90 and (ouverte or publiee)) then
      raise exception 'reconduire_classe() : la classe neuve a des élèves, des réponses ou une séance ouverte';
    end if;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then raise; end if;
  end;
  raise notice 'Mise en place : dupliquer, créer, programmer, agenda, bilan et reconduire vérifiés.';
end $$;
