-- ═══════════════════════════════════════════════════════════════════════════
--  UN QUESTIONNAIRE DE RÉVISION — celui où l'on voit pourquoi on s'est trompé
--
--  Le 16/09, un questionnaire de révision a été cherché pour préparer l'interro
--  écrite sur la POO. Il n'existait pas, et aucun des deux mécanismes en place
--  ne pouvait en tenir lieu :
--
--    · le **contrôle d'acquis** ne montre jamais la correction, et c'est
--      voulu — dire « faux » avant la séance transforme un point de départ en
--      sanction, et fausse la question de certitude qui suit ;
--    · le **questionnaire de bibliothèque** porte `bonne_reponse = 'Z'` :
--      aucune option n'est juste, donc il n'y a rien à corriger.
--
--  Réviser demande exactement l'inverse : répondre, se tromper, **voir
--  pourquoi**, recommencer. C'est une troisième intention, et on ne la
--  bricole pas en détournant l'une des deux autres — c'est comme ça qu'on
--  finit avec deux gestes qui s'écrasent.
--
--  **Ce qui ne change pas** : le questionnaire de révision reste une séance de
--  la bande 90-98, avec son affectation, son interrupteur, son rattachement à
--  une séance. Les trois natures gardent leurs trois gestes. On ajoute un
--  **mode** au modèle, pas une quatrième nature.
--
--  | mode         | à l'écran                        | correction |
--  |--------------|----------------------------------|------------|
--  | `sequentiel` | une question à la fois           | aucune     |
--  | `revisable`  | tout à l'écran, modifiable       | aucune     |
--  | `revision`   | une à la fois, on peut refaire   | **après chaque réponse** |
--
--  Ce que cette migration ajoute :
--    1. le mode `revision` sur `modeles` ;
--    2. `modele_corriges` — les bonnes réponses, hors de portée des étudiants ;
--    3. `creer_modele()` réécrite : l'étoile et la flèche ;
--    4. `affecter_questionnaire()` réécrite : la vraie lettre en corrigé ;
--    5. `mes_questionnaires()` réécrite : la correction, après la réponse ;
--    6. le questionnaire de révision POO du BTS2, posé et affecté.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le troisième mode ──────────────────────────────────────────────────
alter table public.modeles drop constraint if exists modeles_mode_check;
alter table public.modeles add constraint modeles_mode_check
  check (mode in ('sequentiel', 'revisable', 'revision'));

comment on column public.modeles.mode is
  'sequentiel : une question à la fois, sans retour. '
  'revisable : tout à l''écran, modifiable. '
  'revision : une à la fois, correction montrée après chaque réponse, '
  'et on peut recommencer autant de fois qu''on veut.';

-- ─── 2. Où vivent les bonnes réponses, et pourquoi pas dans le modèle ──────
--  `modele_questions` est **lisible par tout le monde** : sa politique RLS dit
--  `for select to anon, authenticated using (true)`, et c'est délibéré — un
--  modèle sans bonne réponse ne porte rien de sensible. Vérifié le 16/09 avec
--  la clé publique du portail : `GET /rest/v1/modele_questions` rend tout,
--  quand `GET /rest/v1/corriges` rend `[]`.
--
--  Y ranger la bonne réponse mettrait donc le corrigé de la révision à une
--  requête de distance, pour n'importe qui. On l'écrit dans une table à part,
--  fermée, que seule une fonction `security definer` traverse.
create table if not exists public.modele_corriges (
  modele_id   bigint not null references public.modeles(id) on delete cascade,
  cle         text   not null,
  bonne       text   not null check (bonne ~ '^[A-D]$'),
  explication text,
  primary key (modele_id, cle)
);

alter table public.modele_corriges enable row level security;

--  Aucune politique pour `anon` : sans politique, RLS refuse tout. La lecture
--  côté étudiant passe par `mes_questionnaires()`, qui filtre ce qu'il a le
--  droit de voir.
drop policy if exists "ens modele corriges" on public.modele_corriges;
create policy "ens modele corriges" on public.modele_corriges
  for all to authenticated
  using (public.est_enseignant()) with check (public.est_enseignant());

revoke all on public.modele_corriges from anon;

comment on table public.modele_corriges is
  'Les bonnes réponses d''un modèle en mode revision. Hors de modele_questions, '
  'qui est lisible par tous : y ranger la lettre juste publierait le corrigé.';

-- ─── 3. `creer_modele()` — l'étoile et la flèche ───────────────────────────
--  ⚠️ Réécrite en entier ; cette définition-ci gagne, puisqu'elle passe après
--  `20260908130000_gerer_questionnaires.sql`. Toute correction apportée là-bas
--  et pas ici serait écrasée en silence — le piège de `preflight_seance()`.
--
--  La forme d'une ligne ne change pas pour les deux anciens modes :
--
--      Quel bac avez-vous obtenu ? · Général · Techno · Pro · Autre
--
--  En mode `revision`, une étoile marque la bonne option — même convention que
--  `creer_controle()`, pour n'avoir qu'une chose à retenir — et une flèche
--  introduit l'explication, celle que l'étudiant lit après avoir répondu :
--
--      Un objet, c'est… · le modèle · *l'exemplaire fabriqué · une méthode
--        → La classe est le moule, l'objet le gâteau.
--
--  Une ligne sans étoile, ou avec deux, fait échouer **tout** le modèle, en
--  disant laquelle. Un questionnaire de révision dont une question n'a pas de
--  bonne réponse compterait la classe entière fausse sans que personne ne le
--  voie. Et une étoile dans un mode sans correction est refusée aussi : elle
--  finirait affichée telle quelle dans l'option.
create or replace function public.creer_modele(
  p_titre text, p_intro text, p_mode text, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id     bigint;
  v_cle    text;
  v_mode   text := coalesce(nullif(btrim(p_mode), ''), 'sequentiel');
  v_ligne  text;
  v_corps  text;
  v_expl   text;
  v_bouts  text[];
  v_opts   text[];
  v_rang   int := 0;
  v_n      int := 0;
  v_etoile int;
  i        int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if coalesce(btrim(p_titre), '') = '' then
    return jsonb_build_object('ok', false, 'motif', 'titre');
  end if;
  if v_mode not in ('sequentiel', 'revisable', 'revision') then
    return jsonb_build_object('ok', false, 'motif', 'mode');
  end if;

  -- Un premier passage qui ne fait que vérifier : on ne crée rien tant qu'une
  -- ligne peut encore faire échouer l'ensemble.
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;

    -- La flèche d'abord : elle peut contenir des « · » sans que ce soient des
    -- options. « → » ou « -> », le second parce qu'on écrit au clavier.
    v_corps := regexp_replace(v_ligne, '\s*(→|->)\s*.*$', '');
    v_expl  := nullif(btrim(coalesce(
                 substring(v_ligne from '\s*(?:→|->)\s*(.*)$'), '')), '');

    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_corps, '\s*[·|]\s*')) x), '');
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

    v_etoile := 0;
    for i in 2 .. array_length(v_bouts, 1) loop
      if v_bouts[i] like '*%' then
        if v_etoile > 0 then
          return jsonb_build_object('ok', false, 'motif', 'deux_etoiles',
            'rang', v_rang, 'texte', left(v_ligne, 80),
            'detail', 'Deux options portent une étoile : une seule peut être la bonne.');
        end if;
        v_etoile := i - 1;
      end if;
    end loop;

    if v_mode = 'revision' and v_etoile = 0 then
      return jsonb_build_object('ok', false, 'motif', 'sans_etoile',
        'rang', v_rang, 'texte', left(v_ligne, 80),
        'detail', 'Un questionnaire de révision corrige : il faut une étoile '
                  'devant la bonne option.');
    end if;
    if v_mode <> 'revision' and v_etoile > 0 then
      return jsonb_build_object('ok', false, 'motif', 'etoile_inutile',
        'rang', v_rang, 'texte', left(v_ligne, 80),
        'detail', 'Ce mode ne corrige rien : l''étoile s''afficherait telle '
                  'quelle. Choisir le mode « révision », ou la retirer.');
    end if;
    if v_mode <> 'revision' and v_expl is not null then
      return jsonb_build_object('ok', false, 'motif', 'explication_inutile',
        'rang', v_rang, 'texte', left(v_ligne, 80),
        'detail', 'Ce mode ne montre aucune correction : l''explication après '
                  '« → » ne serait jamais lue.');
    end if;

    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'motif', 'vide');
  end if;

  -- La clé sert d'identifiant stable et de nom des questions en base.
  v_cle := 'q' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  insert into public.modeles (cle, titre, intro, mode)
  values (v_cle, btrim(p_titre), nullif(btrim(coalesce(p_intro, '')), ''), v_mode)
  returning id into v_id;

  v_rang := 0;
  foreach v_ligne in array regexp_split_to_array(coalesce(p_texte, ''), E'\n') loop
    v_ligne := btrim(v_ligne);
    continue when v_ligne = '';
    v_rang := v_rang + 1;

    v_corps := regexp_replace(v_ligne, '\s*(→|->)\s*.*$', '');
    v_expl  := nullif(btrim(coalesce(
                 substring(v_ligne from '\s*(?:→|->)\s*(.*)$'), '')), '');
    v_bouts := array_remove(array(
      select btrim(x) from unnest(regexp_split_to_array(v_corps, '\s*[·|]\s*')) x), '');

    v_etoile := 0;
    v_opts := '{}';
    for i in 2 .. array_length(v_bouts, 1) loop
      if v_bouts[i] like '*%' then
        v_etoile := i - 1;
        v_opts := v_opts || btrim(substring(v_bouts[i] from 2));
      else
        v_opts := v_opts || v_bouts[i];
      end if;
    end loop;

    insert into public.modele_questions (modele_id, rang, cle, intitule, options)
    values (v_id, v_rang, v_cle || '-' || lpad(v_rang::text, 2, '0'),
            v_bouts[1], v_opts);

    if v_etoile > 0 then
      insert into public.modele_corriges (modele_id, cle, bonne, explication)
      values (v_id, v_cle || '-' || lpad(v_rang::text, 2, '0'),
              chr(64 + v_etoile), v_expl);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'modele_id', v_id,
                            'questions', v_n, 'mode', v_mode);
end; $$;

grant execute on function public.creer_modele(text, text, text, text) to authenticated;

-- ─── 4. `affecter_questionnaire()` — la vraie lettre, ou 'Z' ───────────────
--  ⚠️ Réécrite en entier, même raison qu'au 3.
--
--  Un questionnaire ordinaire copie `bonne_reponse = 'Z'` : aucune option
--  n'existe sous cette lettre, donc rien n'est compté juste. Un questionnaire
--  de révision copie la vraie lettre — c'est ce qui permet à `repondre()` de
--  renseigner `correct`, et donc à l'étudiant de savoir.
--
--  Ces réponses-là n'entrent dans aucun chiffre du semestre : `semestre()`
--  exclut la bande 90-98, et le tableau de bord ne lit qu'une séance choisie.
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
  insert into public.corriges (seance_id, question, bonne_reponse, explication,
                               intitule, options)
  select v_s, q.cle,
         case when v_m.mode = 'revision' then coalesce(mc.bonne, 'Z') else 'Z' end,
         case when v_m.mode = 'revision' then mc.explication else null end,
         q.intitule, q.options
    from public.modele_questions q
    left join public.modele_corriges mc
           on mc.modele_id = q.modele_id and mc.cle = q.cle
   where q.modele_id = p_modele_id
   order by q.rang;

  return jsonb_build_object('ok', true, 'seance_id', v_s, 'numero', v_num,
                            'mode', v_m.mode);
end; $$;

grant execute on function public.affecter_questionnaire(bigint, bigint) to authenticated;

-- ─── 5. `mes_questionnaires()` — la correction, après la réponse ───────────
--  ⚠️ Réécrite en entier ; elle gagne sur `20260908140000_mes_questionnaires.sql`.
--
--  Deux choses ajoutées, et une seule règle : **la correction ne sort que sur
--  une question déjà répondue.** La renvoyer d'avance ferait de la révision un
--  exercice de lecture — et la fonction est appelée avec la clé publique, donc
--  un étudiant curieux lirait la grille entière avant de commencer.
--
--  Se tromper puis recommencer est permis, et c'est le but : `repondre()`
--  remplace la réponse, la correction suit. Un questionnaire de révision n'est
--  pas une note, c'est un aller-retour.
create or replace function public.mes_questionnaires()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve public.eleves;
  v_out   jsonb;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', true, 'liste', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(x order by (x->>'numero')::int), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'seance_id', s.id,
               'numero',    s.numero,
               'titre',     coalesce(m.titre, s.titre),
               'intro',     m.intro,
               -- Sans modèle rattaché, on retombe sur « une question à la
               -- fois » : c'est le mode le plus sûr sur un téléphone.
               'mode',      coalesce(m.mode, 'sequentiel'),
               'corrige',   coalesce(m.mode, '') = 'revision',
               'total',     (select count(*) from public.corriges co
                              where co.seance_id = s.id),
               'faites',    (select count(*) from public.reponses r
                              where r.seance_id = s.id and r.eleve_id = v_eleve.id),
               'justes',    case when coalesce(m.mode, '') = 'revision' then
                              (select count(*) from public.reponses r
                                where r.seance_id = s.id
                                  and r.eleve_id = v_eleve.id
                                  and r.correct) else null end,
               'questions', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'question',   co.question,
                           'intitule',   coalesce(co.intitule, co.question),
                           'options',    to_jsonb(co.options),
                           'ma_reponse', r.reponse,
                           -- La bonne réponse et le pourquoi : seulement si
                           -- l'étudiant a déjà répondu, et seulement en mode
                           -- révision. Ailleurs, null — il n'y a rien à dire.
                           'bonne',      case when coalesce(m.mode, '') = 'revision'
                                               and r.reponse is not null
                                          then co.bonne_reponse end,
                           'explication', case when coalesce(m.mode, '') = 'revision'
                                                and r.reponse is not null
                                           then co.explication end,
                           'juste',      case when coalesce(m.mode, '') = 'revision'
                                               and r.reponse is not null
                                          then r.correct end)
                         order by co.question)
                    from public.corriges co
                    left join public.reponses r
                           on r.eleve_id  = v_eleve.id
                          and r.seance_id = s.id
                          and r.question  = co.question
                   where co.seance_id = s.id), '[]'::jsonb)
             ) as x
        from public.seances s
        left join public.modeles m on m.id = s.modele_id
       where s.classe_id = v_eleve.classe_id
         and s.numero between 90 and 98
         and s.ouverte
         -- Une séance sans corrigé n'a rien à proposer : l'afficher vide
         -- ferait croire à une panne.
         and exists (select 1 from public.corriges co where co.seance_id = s.id)
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

grant execute on function public.mes_questionnaires() to anon, authenticated;

-- ─── 6. Le questionnaire de révision POO du BTS2 ───────────────────────────
--  Douze questions, écrites pour l'interro sur table du TP1 « Console & POO ».
--
--  **Ce ne sont pas les questions du contrôle d'acquis**, et c'est délibéré :
--  le contrôle de la séance 2 mesure ce qu'ils ont gardé du TP1 sans aide.
--  Réviser sur les mêmes huit notions, correction affichée, le viderait de son
--  sens — on mesurerait la mémoire de la veille.
--
--  Elles couvrent en revanche exactement les cinq exercices de l'interro :
--  le vocabulaire (ex. 1), le choix List / Dictionary (ex. 2), les requêtes
--  LINQ (ex. 3), la lecture d'une trace console (ex. 4), la lecture de code
--  (ex. 5).
--
--  Bonnes réponses : trois A, trois B, trois C, trois D. Une classe repère un
--  motif plus vite qu'on ne le croit.
--
--  Les insert sont directs : `creer_modele()` exige `est_enseignant()`, ce
--  qu'une migration n'est pas. On écrit exactement ce qu'elle aurait écrit.
do $$
declare
  v_cle    text := 'revision-poo-tp1';
  v_id     bigint;
  v_classe bigint;
  v_s      bigint;
  v_num    int;
  v_n      int;
  v_max    int;
  v_rep    int;
begin
  -- ── 6.1 Le modèle ────────────────────────────────────────────────────────
  select id into v_id from public.modeles where cle = v_cle;

  if v_id is not null then
    -- Réécrire un modèle auquel une classe a déjà répondu effacerait le
    -- travail. Même règle que `creer_controle()`.
    select count(*) into v_rep
      from public.reponses r
      join public.seances s on s.id = r.seance_id
     where s.modele_id = v_id;
    if v_rep > 0 then
      raise notice 'Révision POO : % réponse(s) déjà données, le texte n''est '
                   'pas réécrit.', v_rep;
      return;
    end if;
    delete from public.modele_corriges  where modele_id = v_id;
    delete from public.modele_questions where modele_id = v_id;
    update public.modeles set mode = 'revision' where id = v_id;
  else
    insert into public.modeles (cle, titre, intro, mode)
    values (v_cle, 'Réviser l''interro — Console & POO',
            'Douze questions pour préparer l''interro écrite sur le TP1. '
            'Vous voyez la correction dès que vous avez répondu, et vous '
            'pouvez recommencer autant de fois que vous voulez. Rien n''est '
            'noté ici.',
            'revision')
    returning id into v_id;
  end if;

  -- ── 6.2 Les douze questions ──────────────────────────────────────────────
  insert into public.modele_questions (modele_id, rang, cle, intitule, options)
  select v_id, q.rang, v_cle || '-' || lpad(q.rang::text, 2, '0'),
         q.intitule, q.options
    from (values

    (1, 'Dans « var c = new Chanson(); », comment appelle-t-on ce que la variable c désigne ?',
     array['Une classe', 'Un objet', 'Une méthode', 'Une propriété']),

    (2, 'Rendre un champ privé et n''y donner accès que par des méthodes publiques, cela s''appelle :',
     array['l''héritage', 'la surcharge', 'l''encapsulation', 'la sérialisation']),

    (3, 'Vous écrivez « p.DureeTotale() » avec des parenthèses. Cela vous dit que DureeTotale est :',
     array['un champ privé', 'une propriété en lecture seule', 'une constante de la classe', 'une méthode']),

    (4, 'Dans « chansons.Where(c => c.Note == 5) », la partie « c => … » est :',
     array['une expression lambda', 'une boucle abrégée', 'une conversion de type', 'un opérateur de comparaison']),

    (5, 'La collection qui associe une clé unique à une valeur s''appelle :',
     array['une List', 'un tableau', 'un Dictionary', 'une file']),

    (6, 'Vous devez garder les chansons dans l''ordre où l''utilisateur les a ajoutées. Vous choisissez :',
     array['un Dictionary<int, Chanson>', 'une List<Chanson>', 'un HashSet<Chanson>', 'un Dictionary<string, int>']),

    (7, 'Vous devez retrouver une chanson à partir de son Id sans parcourir toute la collection. Vous choisissez :',
     array['une List<Chanson> triée par titre', 'un tableau de Chanson', 'une List<Chanson> parcourue au foreach', 'un Dictionary<int, Chanson>']),

    (8, 'Quelle est la requête qui donne les trois chansons les plus longues ?',
     array['chansons.Take(3).OrderBy(c => c.DureeSecondes)',
           'chansons.Where(c => c.DureeSecondes > 3)',
           'chansons.OrderBy(c => c.DureeSecondes).Take(3)',
           'chansons.OrderByDescending(c => c.DureeSecondes).Take(3)']),

    (9, 'Pour compter combien de chansons il y a dans chaque genre, vous partez de :',
     array['chansons.GroupBy(c => c.Genre)',
           'chansons.OrderBy(c => c.Genre)',
           'chansons.Select(c => c.Genre)',
           'chansons.Where(c => c.Genre != null)']),

    (10, 'La liste contient Imagine (Id 1), Yesterday (Id 2), Hey Joe (Id 3). Après « foreach (var c in chansons) parId[c.Id] = c; », qu''affiche « Console.WriteLine(parId[3].Titre); » ?',
     array['Imagine', 'Hey Joe', '3', 'Yesterday']),

    (11, 'Une propriété publique expose la collection : « public List<Chanson> Chansons { get; } ». Pourquoi préférer IReadOnlyList<Chanson> ?',
     array['Parce que la lecture devient plus rapide',
           'Parce que les chansons deviennent impossibles à modifier',
           'Parce que l''extérieur peut lire et parcourir, mais plus ajouter ni retirer',
           'Parce que la collection est recopiée à chaque appel']),

    (12, 'Un objet Chanson a DureeSecondes = 125. Qu''affiche « Console.WriteLine($"{c.DureeSecondes / 60}:{c.DureeSecondes % 60}"); » ?',
     array['2:5', '2:05', '125:0', '1:25'])

    ) as q(rang, intitule, options);

  -- ── 6.3 Les bonnes réponses et le pourquoi ───────────────────────────────
  insert into public.modele_corriges (modele_id, cle, bonne, explication)
  select v_id, v_cle || '-' || lpad(q.rang::text, 2, '0'), q.bonne, q.expl
    from (values

    (1, 'B', 'La classe est le modèle écrit une fois ; l''objet est l''exemplaire fabriqué à partir d''elle. Le moule et le gâteau.'),
    (2, 'C', 'L''encapsulation : une porte d''entrée unique, donc un seul endroit où faire respecter les règles.'),
    (3, 'D', 'Les parenthèses signalent un calcul. Une propriété expose une donnée, une méthode fait quelque chose.'),
    (4, 'A', 'Le « => » se lit « tel que » : pour chaque chanson c, garder celles dont la note vaut 5.'),
    (5, 'C', 'Un Dictionary<clé, valeur>. La clé mène droit à la valeur, sans parcours.'),
    (6, 'B', 'Une List garde l''ordre d''insertion. Un Dictionary n''en promet aucun — c''est le prix de son accès direct.'),
    (7, 'D', 'Le Dictionary trouve par la clé sans parcourir. Une List, même triée, demanderait une recherche.'),
    (8, 'D', 'Trier du plus long au plus court (OrderByDescending), puis couper les trois premières (Take). Trier d''abord, couper ensuite : l''inverse coupe au hasard.'),
    (9, 'A', 'GroupBy range les chansons par genre ; on compte ensuite chaque groupe avec Count().'),
    (10, 'B', 'parId[3] est la chanson dont l''Id vaut 3, donc Hey Joe. La clé est l''Id, pas la position.'),
    (11, 'C', 'Lecture seule vue de l''extérieur : l''objet garde la main sur ce qui entre et sort. Les chansons elles-mêmes, elles, restent modifiables.'),
    (12, 'A', '125 / 60 vaut 2 en division entière, 125 modulo 60 vaut 5. La console écrit « 2:5 » — sans le zéro, parce que rien ne l''a demandé. C''est exactement ce que DureeFormatee() corrige avec un format.')

    ) as q(rang, bonne, expl);

  -- ── 6.4 L'affectation au BTS2 SLAM ───────────────────────────────────────
  select id into v_classe from public.classes where code = 'BTS2-SLAM-2026';
  if v_classe is null then
    raise notice 'Pas de classe BTS2-SLAM-2026 : le modèle est créé, pas affecté.';
  else
    select id into v_s from public.seances
     where classe_id = v_classe and modele_id = v_id;

    if v_s is null then
      select min(g) into v_num
        from generate_series(90, 98) g
       where not exists (select 1 from public.seances s
                          where s.classe_id = v_classe and s.numero = g);
      if v_num is null then
        raise exception 'BTS2-SLAM-2026 : la bande 90-98 est pleine.';
      end if;

      -- Créée FERMÉE. On l'allume depuis le portail quand on veut qu'elle
      -- apparaisse — ou toute seule, si on la rattache à une séance en cours.
      insert into public.seances (classe_id, numero, titre, notee, ouverte,
                                  duree_min, nature, modele_id)
      values (v_classe, v_num, 'Réviser l''interro — Console & POO',
              false, false, 0, 'questionnaire', v_id)
      returning id into v_s;
    end if;

    delete from public.corriges where seance_id = v_s;
    insert into public.corriges (seance_id, question, bonne_reponse, explication,
                                 intitule, options)
    select v_s, q.cle, mc.bonne, mc.explication, q.intitule, q.options
      from public.modele_questions q
      join public.modele_corriges mc
        on mc.modele_id = q.modele_id and mc.cle = q.cle
     where q.modele_id = v_id
     order by q.rang;
  end if;

  -- ── 6.5 Contrôle ─────────────────────────────────────────────────────────
  select count(*) into v_n from public.modele_questions where modele_id = v_id;
  if v_n <> 12 then
    raise exception 'révision POO : % questions, attendu 12', v_n;
  end if;

  select count(*) into v_n from public.modele_corriges where modele_id = v_id;
  if v_n <> 12 then
    raise exception 'révision POO : % bonnes réponses, attendu 12', v_n;
  end if;

  -- Une bonne réponse qui désigne une option inexistante compterait tout le
  -- monde faux, en silence.
  select count(*) into v_n
    from public.modele_questions q
    join public.modele_corriges mc
      on mc.modele_id = q.modele_id and mc.cle = q.cle
   where q.modele_id = v_id
     and ascii(mc.bonne) - 64 > coalesce(array_length(q.options, 1), 0);
  if v_n > 0 then
    raise exception 'révision POO : % bonne(s) réponse(s) hors des options', v_n;
  end if;

  select count(*) into v_n
    from public.modele_corriges
   where modele_id = v_id and coalesce(btrim(explication), '') = '';
  if v_n > 0 then
    raise exception 'révision POO : % question(s) sans explication — le seul '
                    'intérêt du mode révision est là', v_n;
  end if;

  select max(k) into v_max from (
    select count(*) as k from public.modele_corriges
     where modele_id = v_id group by bonne) t;
  if v_max > 3 then
    raise exception 'révision POO : une même lettre est bonne % fois sur 12 — '
                    'motif repérable', v_max;
  end if;

  raise notice 'Révision POO : 12 questions, correction après chaque réponse. '
               'La séance est FERMÉE — l''allumer depuis « Questionnaires », '
               'ou la rattacher à la séance du jour.';
end $$;

-- ─── Contrôle général ──────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  -- Le corrigé de la révision ne doit jamais être lisible sans passer par une
  -- fonction : une politique pour `anon` ici publierait la grille.
  select count(*) into v_n from pg_policies
   where schemaname = 'public' and tablename = 'modele_corriges'
     and 'anon' = any(roles);
  if v_n > 0 then
    raise exception 'modele_corriges : une politique ouvre la table à anon';
  end if;

  select count(*) into v_n from pg_constraint
   where conname = 'modeles_mode_check'
     and pg_get_constraintdef(oid) like '%revision%';
  if v_n <> 1 then
    raise exception 'le mode revision n''est pas admis par la contrainte';
  end if;

  raise notice 'Mode révision en place : la correction se voit après la '
               'réponse, jamais avant.';
end $$;
