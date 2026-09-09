-- ═══════════════════════════════════════════════════════════════════════════
--  LE CONTRÔLE D'ACQUIS — ce qu'ils savent AVANT d'entrer
--
--  Avant chaque séance et chaque TP, les étudiants répondent sur les notions
--  déjà vues. Deux questions par notion, et c'est l'écart entre les deux qui
--  vaut le détour :
--
--    · la question       — quatre options, une bonne. Ce qu'ils savent.
--    · la certitude      — « je saurais l'expliquer » … « je ne sais plus ».
--                          Ce qu'ils CROIENT savoir.
--
--  Se tromper en étant sûr n'appelle pas le même geste que douter en ayant
--  juste. Un chiffre unique confondrait les deux.
--
--  ─── Où ça vit ───────────────────────────────────────────────────────────
--  Le contrôle appartient à la séance qu'il précède : ses questions sont des
--  corrigés de CETTE séance, préfixés « pre- ». Un contrôle par séance, sans
--  limite de nombre — la bande 90-98 des questionnaires n'aurait pas tenu
--  quatorze séances — et le tableau de bord lit l'entrée et la sortie sur la
--  même ligne.
--
--    pre-01     la question      bonne_reponse = la bonne lettre
--    pre-01-c   la certitude     bonne_reponse = 'Z', rien n'est juste
--
--  Le préfixe n'est pas décoratif : c'est lui qui tient le contrôle HORS des
--  statistiques du quiz de fin de séance. Voir la migration suivante.
--
--  ─── Quand il est proposé ────────────────────────────────────────────────
--  `controle_ouvert`, à part de `publiee` et de `ouverte` : le contrôle se
--  fait AVANT que la séance soit lisible. Les trois états ne se déduisent pas
--  l'un de l'autre.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.seances add column if not exists controle_ouvert boolean not null default false;

-- ─── 1. Écrire un contrôle en collant du texte ─────────────────────────────
--  Une notion par ligne : l'intitulé, puis deux à quatre options séparées par
--  « · ». La bonne option porte une étoile collée devant.
--
--    Que signifie un code 404 ? · la page a changé · *la ressource est
--    introuvable · le serveur a planté · l'accès est refusé
--
--  Une ligne sans étoile, ou avec deux, fait échouer TOUTE la création en
--  disant laquelle : un contrôle dont une notion n'a pas de bonne réponse
--  compterait tout le monde faux sans que personne ne s'en aperçoive.
create or replace function public.creer_controle(p_seance_id bigint, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_num    int;
  v_ligne  text;
  v_bouts  text[];
  v_opts   text[];
  v_rang   int := 0;
  v_n      int := 0;
  v_bonne  int;
  v_i      int;
  v_cle    text;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select numero into v_num from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  -- Les questionnaires et l'appel n'ont pas de notions à réviser avant.
  if v_num >= 90 then return jsonb_build_object('ok', false, 'motif', 'numero'); end if;

  -- Premier passage : on ne crée rien tant qu'une ligne peut faire échouer
  -- l'ensemble.
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

    v_bonne := 0;
    for v_i in 2 .. array_length(v_bouts, 1) loop
      if v_bouts[v_i] like '*%' then
        if v_bonne > 0 then
          return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang,
            'texte', left(v_ligne, 80),
            'detail', 'Deux options sont marquées d''une étoile : il n''en faut qu''une.');
        end if;
        v_bonne := v_i - 1;
      end if;
    end loop;
    if v_bonne = 0 then
      return jsonb_build_object('ok', false, 'motif', 'ligne', 'rang', v_rang,
        'texte', left(v_ligne, 80),
        'detail', 'Aucune bonne réponse : mettez une étoile devant la bonne option, « *comme ceci ».');
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then return jsonb_build_object('ok', false, 'motif', 'vide'); end if;

  -- On remplace le contrôle précédent plutôt que de l'empiler : le réécrire
  -- est le geste normal, l'accumuler ne l'est jamais. Les réponses déjà
  -- données partent avec — c'est pourquoi la fonction refuse d'écraser un
  -- contrôle auquel on a déjà répondu.
  if exists (select 1 from public.reponses r
              where r.seance_id = p_seance_id and r.question like 'pre-%') then
    return jsonb_build_object('ok', false, 'motif', 'reponses',
      'nombre', (select count(*) from public.reponses r
                  where r.seance_id = p_seance_id and r.question like 'pre-%'));
  end if;
  delete from public.corriges where seance_id = p_seance_id and question like 'pre-%';

  v_rang := 0;
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;
    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_ligne, '\s*[·|]\s*')) x), '');

    v_bonne := 0;
    v_opts := '{}';
    for v_i in 2 .. array_length(v_bouts, 1) loop
      if v_bouts[v_i] like '*%' then v_bonne := v_i - 1; end if;
      v_opts := v_opts || btrim(ltrim(v_bouts[v_i], '*'));
    end loop;

    v_cle := 'pre-' || lpad(v_rang::text, 2, '0');
    insert into public.corriges (seance_id, question, bonne_reponse, explication,
                                 intitule, options)
    values (p_seance_id, v_cle, chr(64 + v_bonne), null, v_bouts[1], v_opts);

    -- La certitude, identique pour toutes les notions : on compare des
    -- réponses, elles doivent être posées dans les mêmes termes.
    insert into public.corriges (seance_id, question, bonne_reponse, explication,
                                 intitule, options)
    values (p_seance_id, v_cle || '-c', 'Z', null,
            'Sur cette notion, vous diriez :',
            array['Je saurais l''expliquer', 'Je crois avoir compris',
                  'J''ai un doute', 'Je ne sais plus']);
  end loop;

  return jsonb_build_object('ok', true, 'notions', v_n);
end; $$;

-- ─── 2. L'interrupteur ─────────────────────────────────────────────────────
create or replace function public.ouvrir_controle(p_seance_id bigint, p_ouvert boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_num int; v_n int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select numero into v_num from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;
  if v_num >= 90 then return jsonb_build_object('ok', false, 'motif', 'numero'); end if;

  select count(*) into v_n from public.corriges
   where seance_id = p_seance_id and question like 'pre-%' and question not like '%-c';
  if p_ouvert and v_n = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide');
  end if;

  update public.seances set controle_ouvert = p_ouvert where id = p_seance_id;
  return jsonb_build_object('ok', true, 'ouvert', p_ouvert, 'notions', v_n);
end; $$;

-- ─── 3. Côté étudiant ──────────────────────────────────────────────────────
--  Les contrôles ouverts de sa classe, avec ses propres réponses. Le contrôle
--  se fait AVANT la séance : sa visibilité ne dépend donc ni de `publiee` ni
--  de `ouverte`.
create or replace function public.mes_controles()
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
               'total',     (select count(*) from public.corriges co
                              where co.seance_id = s.id and co.question like 'pre-%'),
               'faites',    (select count(*) from public.reponses r
                              where r.seance_id = s.id and r.eleve_id = v_eleve.id
                                and r.question like 'pre-%'),
               'questions', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'question',   co.question,
                           'intitule',   co.intitule,
                           'options',    to_jsonb(co.options),
                           'ma_reponse', r.reponse)
                         order by co.question)
                    from public.corriges co
                    left join public.reponses r
                           on r.eleve_id  = v_eleve.id
                          and r.seance_id = s.id
                          and r.question  = co.question
                   where co.seance_id = s.id and co.question like 'pre-%'), '[]'::jsonb)
             ) as x
        from public.seances s
       where s.classe_id = v_eleve.classe_id
         and s.numero < 90
         and s.controle_ouvert
         and exists (select 1 from public.corriges co
                      where co.seance_id = s.id and co.question like 'pre-%')
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

-- ─── 4. Côté enseignant ────────────────────────────────────────────────────
--  Par notion : la bonne réponse, ce qu'ils ont répondu, et ce qu'ils disaient
--  savoir. « surs_et_faux » est le chiffre qui décide de commencer par cette
--  notion : ceux-là ne poseront pas de question, ils ne savent pas qu'ils ont
--  tort.
create or replace function public.controle_seance(p_seance_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s public.seances;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select * into v_s from public.seances where id = p_seance_id;
  if not found then return jsonb_build_object('ok', false, 'motif', 'inconnue'); end if;

  return (
    with eleves as (
      select e.id, e.numero from public.eleves e
       where e.classe_id = v_s.classe_id and e.numero <> '99'
    ),
    notions as (
      select co.question as cle, co.intitule, co.options, co.bonne_reponse
        from public.corriges co
       where co.seance_id = p_seance_id
         and co.question like 'pre-%' and co.question not like '%-c'
    ),
    rep as (
      select r.question, r.reponse, e.numero, e.id as eleve_id
        from public.reponses r
        join eleves e on e.id = r.eleve_id
       where r.seance_id = p_seance_id and r.question like 'pre-%'
    ),
    -- A et B = « je sais » ; C et D = « je doute ». La ligne de partage est
    -- arbitraire mais elle doit être la même partout, sinon les chiffres de
    -- deux notions ne se comparent plus.
    croise as (
      select n.cle,
             count(*) filter (where q.reponse is not null)                    as repondants,
             count(*) filter (where q.reponse = n.bonne_reponse)              as justes,
             count(*) filter (where c.reponse in ('A','B'))                   as surs,
             count(*) filter (where q.reponse = n.bonne_reponse
                               and c.reponse in ('A','B'))                    as surs_et_justes,
             count(*) filter (where q.reponse is not null
                               and q.reponse <> n.bonne_reponse
                               and c.reponse in ('A','B'))                    as surs_et_faux,
             count(*) filter (where q.reponse = n.bonne_reponse
                               and c.reponse in ('C','D'))                    as justes_mais_doutent
        from notions n
        cross join eleves e
        left join rep q on q.eleve_id = e.id and q.question = n.cle
        left join rep c on c.eleve_id = e.id and c.question = n.cle || '-c'
       group by n.cle
    ),
    qui as (
      select n.cle,
             coalesce(jsonb_agg(q.numero order by q.numero)
                      filter (where q.reponse is not null
                              and q.reponse <> n.bonne_reponse
                              and c.reponse in ('A','B')), '[]'::jsonb) as numeros_surs_et_faux
        from notions n
        join eleves e on true
        left join rep q on q.eleve_id = e.id and q.question = n.cle
        left join rep c on c.eleve_id = e.id and c.question = n.cle || '-c'
       group by n.cle
    ),
    faits as (
      select r.eleve_id, count(distinct r.question) as n
        from rep r group by r.eleve_id
    )
    select jsonb_build_object(
      'ok', true,
      'seance_id', v_s.id, 'numero', v_s.numero, 'titre', v_s.titre,
      'ouvert',   v_s.controle_ouvert,
      'notions',  (select count(*) from notions),
      'inscrits', (select count(*) from eleves),
      'termines', (select count(*) from faits
                    where n >= (select count(*) * 2 from notions)
                      and (select count(*) from notions) > 0),
      'a_relancer', coalesce((select jsonb_agg(e.numero order by e.numero)
                     from eleves e
                    where not exists (select 1 from faits f where f.eleve_id = e.id)),
                    '[]'::jsonb),
      'lignes', coalesce((select jsonb_agg(jsonb_build_object(
                    'cle', n.cle, 'intitule', n.intitule,
                    'options', to_jsonb(n.options), 'bonne', n.bonne_reponse,
                    'repondants', c.repondants, 'justes', c.justes,
                    'surs', c.surs, 'surs_et_justes', c.surs_et_justes,
                    'surs_et_faux', c.surs_et_faux,
                    'justes_mais_doutent', c.justes_mais_doutent,
                    'numeros_surs_et_faux', w.numeros_surs_et_faux)
                  order by c.justes, n.cle)
                  from notions n
                  join croise c on c.cle = n.cle
                  join qui    w on w.cle = n.cle), '[]'::jsonb))
  );
end; $$;

grant execute on function public.creer_controle(bigint, text)     to authenticated;
grant execute on function public.ouvrir_controle(bigint, boolean) to authenticated;
grant execute on function public.controle_seance(bigint)          to authenticated;
grant execute on function public.mes_controles()                  to anon, authenticated;
