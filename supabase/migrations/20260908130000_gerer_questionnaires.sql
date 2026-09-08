-- ═══════════════════════════════════════════════════════════════════════════
--  GÉRER LES QUESTIONNAIRES DEPUIS LE PORTAIL
--
--  Cinq fonctions, et plus aucune raison d'ouvrir le SQL Editor pour ajouter
--  un questionnaire :
--
--    bibliotheque()            ce qui existe, et où c'est affecté
--    creer_modele()            écrire un questionnaire en collant du texte
--    supprimer_modele()        s'en débarrasser, si personne n'a répondu
--    affecter_questionnaire()  le donner à une classe
--    retirer_questionnaire()   le lui reprendre, si personne n'a répondu
--
--  ouvrir_questionnaire() est généralisée à la bande 90-98 : elle ne
--  connaissait que 97 et 98.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Ce que l'enseignant voit ───────────────────────────────────────────
--  Deux lectures d'une même chose : par modèle (« où est-il posé ? ») et par
--  classe (« qu'est-ce que cette classe a ? »). Le portail se sert des deux ;
--  les calculer deux fois côté client donnerait deux nombres différents un
--  jour ou l'autre.
create or replace function public.bibliotheque()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mod jsonb; v_cl jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  with classes as (
    select c.id, c.code, c.nom from public.classes c where c.code not like 'DEMO%'
  ),
  aff as (
    select s.id as seance_id, s.classe_id, s.numero, s.ouverte, s.modele_id,
           c.code, c.nom,
           (select count(*) from public.corriges co where co.seance_id = s.id) as questions,
           (select count(*) from public.eleves e
             where e.classe_id = s.classe_id and e.numero <> '99')             as inscrits,
           (select count(distinct r.eleve_id) from public.reponses r
              join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
             where r.seance_id = s.id)                                         as commences
      from public.seances s
      join classes c on c.id = s.classe_id
     where s.numero between 90 and 98
  ),
  aff2 as (
    select a.*,
      (select count(*) from (
         select r.eleve_id
           from public.reponses r
           join public.eleves e on e.id = r.eleve_id and e.numero <> '99'
          where r.seance_id = a.seance_id
          group by r.eleve_id
         having count(distinct r.question) >= a.questions and a.questions > 0
       ) t) as termines
      from aff a
  )
  select
    (select jsonb_agg(jsonb_build_object(
       'id', m.id, 'cle', m.cle, 'titre', m.titre, 'intro', m.intro, 'mode', m.mode,
       'questions', (select count(*) from public.modele_questions q where q.modele_id = m.id),
       'affectations', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'seance_id', a.seance_id, 'classe_id', a.classe_id,
                   'code', a.code, 'nom', a.nom, 'numero', a.numero,
                   'ouvert', a.ouverte, 'inscrits', a.inscrits,
                   'commences', a.commences, 'termines', a.termines)
                 order by a.code)
            from aff2 a where a.modele_id = m.id), '[]'::jsonb))
     order by m.cree_le, m.id)
     from public.modeles m),
    (select jsonb_agg(jsonb_build_object(
       'classe_id', c.id, 'code', c.code, 'nom', c.nom,
       'poses', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'modele_id', a.modele_id, 'seance_id', a.seance_id,
                   'numero', a.numero, 'ouvert', a.ouverte,
                   'termines', a.termines, 'inscrits', a.inscrits)
                 order by a.numero)
            from aff2 a where a.classe_id = c.id and a.modele_id is not null), '[]'::jsonb))
     order by c.code)
     from classes c)
  into v_mod, v_cl;

  return jsonb_build_object('ok', true,
    'modeles', coalesce(v_mod, '[]'::jsonb),
    'classes', coalesce(v_cl, '[]'::jsonb));
end; $$;

-- ─── 2. Écrire un questionnaire en collant du texte ────────────────────────
--  Une question par ligne non vide, l'intitulé puis les options séparés par
--  « · » (le même séparateur que les séances de cours) ou par « | ».
--
--    Quel bac avez-vous obtenu ? · Général · Techno · Pro · Autre
--
--  Deux à quatre options. Aucune n'est « bonne » : bonne_reponse vaut 'Z' à
--  l'affectation, pour qu'aucune réponse ne soit comptée juste ou fausse.
--  Une ligne mal formée n'est pas silencieusement ignorée : la fonction
--  refuse tout et dit laquelle. Un questionnaire amputé d'une question sans
--  qu'on le sache est pire qu'un refus.
create or replace function public.creer_modele(
  p_titre text, p_intro text, p_mode text, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id    bigint;
  v_cle   text;
  v_ligne text;
  v_bouts text[];
  v_rang  int := 0;
  v_n     int := 0;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if coalesce(btrim(p_titre), '') = '' then
    return jsonb_build_object('ok', false, 'motif', 'titre');
  end if;
  if coalesce(p_mode, 'sequentiel') not in ('sequentiel', 'revisable') then
    return jsonb_build_object('ok', false, 'motif', 'mode');
  end if;

  -- Un premier passage qui ne fait que vérifier : on ne crée rien tant qu'une
  -- ligne peut encore faire échouer l'ensemble.
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;
    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_ligne, '\s*[·|]\s*')) x), '');
    if array_length(v_bouts, 1) is null or array_length(v_bouts, 1) < 3 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang,
        'texte', left(v_ligne, 80),
        'detail', 'Il faut un intitulé puis au moins deux options, séparés par « · ».');
    end if;
    if array_length(v_bouts, 1) > 5 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang,
        'texte', left(v_ligne, 80),
        'detail', 'Quatre options au maximum : l''écran étudiant n''en propose pas plus.');
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide');
  end if;

  -- La clé sert d'identifiant stable et de nom des questions en base.
  v_cle := 'q' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  insert into public.modeles (cle, titre, intro, mode)
  values (v_cle, btrim(p_titre), nullif(btrim(coalesce(p_intro, '')), ''),
          coalesce(p_mode, 'sequentiel'))
  returning id into v_id;

  v_rang := 0;
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;
    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_ligne, '\s*[·|]\s*')) x), '');
    insert into public.modele_questions (modele_id, rang, cle, intitule, options)
    values (v_id, v_rang, v_cle || '-' || lpad(v_rang::text, 2, '0'),
            v_bouts[1], v_bouts[2:array_length(v_bouts, 1)]);
  end loop;

  return jsonb_build_object('ok', true, 'modele_id', v_id, 'questions', v_n);
end; $$;

-- ─── 3. Donner un questionnaire à une classe ───────────────────────────────
--  L'affectation crée une séance FERMÉE : on choisit le questionnaire d'un
--  côté, on l'allume de l'autre. Créer et ouvrir d'un même geste ferait
--  apparaître chez les étudiants un questionnaire qu'on venait seulement de
--  préparer.
create or replace function public.affecter_questionnaire(
  p_modele_id bigint, p_classe_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m   public.modeles;
  v_num int;
  v_s   bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_m from public.modeles where id = p_modele_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'modele'); end if;
  if not exists (select 1 from public.classes where id = p_classe_id) then
    return jsonb_build_object('ok', false, 'motif', 'classe');
  end if;

  select id into v_s from public.seances
   where classe_id = p_classe_id and modele_id = p_modele_id;
  if found then
    return jsonb_build_object('ok', true, 'seance_id', v_s, 'deja', true);
  end if;

  -- Le premier numéro libre de la bande, en partant de 90. Neuf places : au
  -- delà, c'est qu'on empile des questionnaires sans jamais en retirer.
  select min(g) into v_num
    from generate_series(90, 98) g
   where not exists (select 1 from public.seances s
                      where s.classe_id = p_classe_id and s.numero = g);
  if v_num is null then
    return jsonb_build_object('ok', false, 'motif', 'plein');
  end if;

  insert into public.seances (classe_id, numero, titre, notee, ouverte,
                              duree_min, nature, modele_id)
  values (p_classe_id, v_num, v_m.titre, false, false, 0, 'questionnaire', p_modele_id)
  returning id into v_s;

  -- Les corrigés sont la copie du modèle au moment de l'affectation.
  -- bonne_reponse = 'Z' : aucune option n'existe sous cette lettre, donc
  -- aucune réponse n'est comptée juste. C'est ce qui distingue un
  -- questionnaire d'un quiz.
  insert into public.corriges (seance_id, question, bonne_reponse, explication,
                               intitule, options)
  select v_s, q.cle, 'Z', null, q.intitule, q.options
    from public.modele_questions q
   where q.modele_id = p_modele_id
   order by q.rang;

  return jsonb_build_object('ok', true, 'seance_id', v_s, 'numero', v_num);
end; $$;

-- ─── 4. Reprendre, et supprimer ────────────────────────────────────────────
--  Les deux refusent dès qu'une réponse existe. Un questionnaire auquel une
--  classe a répondu n'est plus un brouillon : l'éteindre le retire de l'écran
--  des étudiants sans rien perdre, et c'est ce qu'on veut presque toujours.
create or replace function public.retirer_questionnaire(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; v_num int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select numero into v_num from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_num not between 90 and 98 then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;

  select count(*) into v_n from public.reponses where seance_id = p_seance_id;
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'motif', 'reponses', 'nombre', v_n);
  end if;

  delete from public.corriges where seance_id = p_seance_id;
  delete from public.seances  where id = p_seance_id;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.supprimer_modele(p_modele_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select count(*) into v_n
    from public.reponses r
    join public.seances s on s.id = r.seance_id
   where s.modele_id = p_modele_id;
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'motif', 'reponses', 'nombre', v_n);
  end if;

  delete from public.corriges co
   using public.seances s
   where s.id = co.seance_id and s.modele_id = p_modele_id;
  delete from public.seances where modele_id = p_modele_id;
  delete from public.modeles where id = p_modele_id;
  return jsonb_build_object('ok', true);
end; $$;

-- ─── 5. L'interrupteur, généralisé à toute la bande ────────────────────────
create or replace function public.ouvrir_questionnaire(
  p_classe_id bigint, p_numero int, p_ouvert boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  -- 90 à 98 : la bande des questionnaires. En dessous, les séances de cours,
  -- qui se pilotent avec demarrer_seance() / clore_seance() parce qu'elles
  -- portent un chrono. Au-dessus, 99, l'appel, qui ne se ferme pas.
  if p_numero not between 90 and 98 then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;

  select id into v_id from public.seances
   where classe_id = p_classe_id and numero = p_numero;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;

  update public.seances set ouverte = p_ouvert where id = v_id;
  return jsonb_build_object('ok', true, 'ouvert', p_ouvert);
end; $$;

grant execute on function public.bibliotheque()                              to authenticated;
grant execute on function public.creer_modele(text, text, text, text)        to authenticated;
grant execute on function public.supprimer_modele(bigint)                    to authenticated;
grant execute on function public.affecter_questionnaire(bigint, bigint)      to authenticated;
grant execute on function public.retirer_questionnaire(bigint)               to authenticated;
grant execute on function public.ouvrir_questionnaire(bigint, int, boolean)  to authenticated;
