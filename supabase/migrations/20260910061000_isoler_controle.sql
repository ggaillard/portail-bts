-- ═══════════════════════════════════════════════════════════════════════════
--  LE CONTRÔLE D'ENTRÉE RESTE HORS DES CHIFFRES DE LA SÉANCE
--
--  Les questions du contrôle sont des corrigés de la séance, préfixés
--  « pre- ». Sans exclusion explicite, elles se glisseraient dans tout ce qui
--  compte des questions ou des réponses :
--
--    semestre()          « 83 % juste » mélangerait ce qu'ils savaient AVANT
--                        et ce qu'ils ont appris PENDANT — illisible dans les
--                        deux sens.
--    questions_seance()  « Réussite par question » listerait vingt questions
--                        pour une séance qui en pose dix, dont la moitié sans
--                        rapport avec l'heure qui vient de passer.
--    preflight_seance()  « 10 questions corrigées » en annoncerait vingt.
--
--  Les trois fonctions sont reprises telles quelles, à une clause près
--  chacune. Elles sont redéfinies ici, donc c'est cette version qui gagne —
--  la règle déjà écrite pour preflight_seance(), qui a coûté une erreur.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.semestre()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  return (
  with

  -- L'effectif réel : le compte d'essai n° 99 n'est pas un étudiant.
  effectif as (
    select classe_id, count(*)::int as inscrits
      from public.eleves where numero <> '99' group by classe_id
  ),

  -- Les réponses qui comptent, séance par séance.
  --  · « évaluée » : une question de quiz, corrigée. L'humeur et l'appel n'en
  --    sont pas — on ne réussit pas une présence.
  --  · « jalon franchi » : une case cochée du parcours BTS2, clé « tp… »
  --    valant « true ». Voir CLAUDE.md, ce point a déjà coûté deux erreurs.
  rep as (
    select r.seance_id,
           r.eleve_id,
           (r.correct is not null or r.reponse in ('ok', 'ko'))
             and r.question not like 'humeur-%'
             and r.question not like 'appel-%'
             -- Le contrôle d'entrée n'est pas le quiz de la séance : mélanger
             -- ce qu'ils savaient AVANT et ce qu'ils ont appris PENDANT rend
             -- le taux de réussite illisible dans les deux sens.
             and r.question not like 'pre-%'                  as evaluee,
           (r.correct is true or r.reponse = 'ok')            as juste,
           (r.question like 'tp%' and r.reponse = 'true')     as jalon,
           r.updated_at
      from public.reponses r
      join public.eleves e on e.id = r.eleve_id
     where e.numero <> '99'
  ),

  parseance as (
    select s.id, s.classe_id, s.numero, s.titre, s.nature, s.notee, s.ouverte,
           s.publiee, s.jalons, s.echeance, s.duree_min,
           (select count(*) from public.corriges co where co.seance_id = s.id)::int as corriges,
           (select count(distinct rp.eleve_id) from rep rp where rp.seance_id = s.id)::int as repondants,
           (select count(*) from rep rp where rp.seance_id = s.id and rp.evaluee)::int as evaluees,
           (select count(*) from rep rp where rp.seance_id = s.id and rp.evaluee and rp.juste)::int as justes,
           (select count(*) from rep rp where rp.seance_id = s.id and rp.jalon)::int as jalons_franchis,
           (select max(rp.updated_at) from rep rp where rp.seance_id = s.id) as dernier
      from public.seances s
     where s.numero < 90
  ),

  calcul as (
    select p.*,
           e.inscrits,
           case
             when p.corriges = 0 and p.nature = 'cours' then 'a_produire'
             when p.repondants = 0                      then 'prete'
             when p.ouverte                             then 'en_cours'
             else                                            'jouee'
           end as etat,
           case when p.evaluees > 0
                then round(p.justes * 100.0 / p.evaluees)::int end as reussite,
           -- Avancement d'un projet : jalons franchis rapportés au total
           -- déclaré, sur l'effectif entier — pas sur les seuls actifs, sinon
           -- une classe où trois étudiants travaillent affiche 100 %.
           case when p.nature = 'projet' and coalesce(p.jalons, 0) > 0 and e.inscrits > 0
                then round(p.jalons_franchis * 100.0 / (p.jalons * e.inscrits))::int end as avancement
      from parseance p
      left join effectif e on e.classe_id = p.classe_id
  )

  select jsonb_build_object(
    'ok', true,
    'classes', coalesce((
      select jsonb_agg(cl order by cl->>'code')
        from (
          select jsonb_build_object(
            'code',     c.code,
            'nom',      c.nom,
            'inscrits', coalesce(max(k.inscrits), 0),
            'total',    count(k.id),
            'pretes',   count(*) filter (where k.etat in ('prete', 'en_cours', 'jouee')),
            'jouees',   count(*) filter (where k.etat = 'jouee'),
            'seances',  coalesce(jsonb_agg(jsonb_build_object(
                          'seance_id',   k.id,
                          'numero',      k.numero,
                          'publiee',     k.publiee,
                          'titre',       k.titre,
                          'nature',      k.nature,
                          'notee',       k.notee,
                          'ouverte',     k.ouverte,
                          'etat',        k.etat,
                          'corriges',    k.corriges,
                          'repondants',  k.repondants,
                          'inscrits',    k.inscrits,
                          'reussite',    k.reussite,
                          'avancement',  k.avancement,
                          'jalons',      k.jalons,
                          'echeance',    k.echeance,
                          'dernier', to_char(k.dernier at time zone 'Europe/Paris', 'DD/MM'))
                        order by k.numero), '[]'::jsonb)) as cl
            from public.classes c
            join calcul k on k.classe_id = c.id
           where c.code not like 'DEMO%'
           group by c.id, c.code, c.nom
        ) t), '[]'::jsonb)));
end; $$;

grant execute on function public.semestre() to authenticated;

create or replace function public.questions_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s   public.seances;
  v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  select jsonb_build_object(
    'ok', true,
    'seance', v_s.numero,
    'titre',  v_s.titre,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question',      question,
               'intitule',      intitule,
               'options',       to_jsonb(options),
               'bonne_reponse', bonne_reponse,
               'explication',   explication)
             order by question)
        from public.corriges
       where seance_id = p_seance_id
         -- « Réussite par question » parle du quiz de fin de séance. Le
         -- contrôle d'entrée a son propre écran.
         and question not like 'pre-%'), '[]'::jsonb))
  into v_res;

  return v_res;
end; $$;

grant execute on function public.questions_seance(bigint) to authenticated;

create or replace function public.preflight_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s        public.seances;
  v_classe   public.classes;
  v_questions int; v_appel boolean;
  v_eleves int; v_pin int; v_connect int;
  v_avance int; v_seances_avance text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  select * into v_classe from public.classes where id = v_s.classe_id;

  -- Le pré-vol annonce les questions du quiz. Le contrôle d'entrée en a ses
  -- propres, préfixées « pre- » : les additionner ferait annoncer vingt
  -- questions pour une séance qui en pose dix.
  select count(*) into v_questions from public.corriges
   where seance_id = v_s.id and question not like 'pre-%';

  select exists (
    select 1 from public.corriges co
      join public.seances sa on sa.id = co.seance_id
     where sa.classe_id = v_s.classe_id and sa.numero = 99
       and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD')
  ) into v_appel;

  -- Le compte d'essai n° 99 n'est pas un étudiant. Ce filtre existe aussi
  -- dans 20260907100000_seance.sql, qui définit la MÊME fonction : comme ce
  -- fichier passe après, c'est cette version-ci qui gagne. Les deux doivent
  -- rester d'accord, sinon le correctif de l'une est écrasé par l'autre sans
  -- que rien ne le signale. C'est exactement ce qui s'est produit le 8/09.
  select count(*), count(*) filter (where pin is not null),
         count(*) filter (where auth_id is not null)
    into v_eleves, v_pin, v_connect
    from public.eleves
   where classe_id = v_s.classe_id and numero <> '99';

  select count(distinct r.eleve_id),
         string_agg(distinct sa.numero::text, ', ' order by sa.numero::text)
    into v_avance, v_seances_avance
    from public.reponses r
    join public.seances sa on sa.id = r.seance_id
    join public.eleves  e  on e.id = r.eleve_id
   where e.classe_id = v_s.classe_id and sa.numero <> 99 and sa.numero > v_s.numero;

  return jsonb_build_object(
    'ok', true,
    'classe', v_classe.code, 'seance', v_s.numero, 'titre', v_s.titre,
    'nature', v_s.nature, 'jalons', v_s.jalons, 'echeance', v_s.echeance,
    'ouverte', v_s.ouverte, 'notee', v_s.notee,
    'demarree_le', v_s.demarree_le, 'duree_min', v_s.duree_min,
    'questions', v_questions, 'appel_du_jour', v_appel,
    'eleves', v_eleves, 'avec_pin', v_pin, 'deja_connectes', v_connect,
    'en_avance', coalesce(v_avance, 0),
    'seances_en_avance', coalesce(v_seances_avance, '')
  );
end; $$;

grant execute on function public.preflight_seance(bigint) to authenticated;
