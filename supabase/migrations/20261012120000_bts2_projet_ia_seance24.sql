-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — PROJET IA : SÉANCE 24 À DISTANCE (mardi 13/10/2026)
--
--  Demandé le 12/10 : continuer le projet (ou changer de contexte) et
--  prototyper avec des solutions en ligne (SaaS) utilisables SANS carte
--  bancaire, en les comparant au modèle local. Consignes :
--  distance/projet-ia.html, partie « Mardi 13 octobre — séance 24 ».
--  Le kit gagne fournisseurs.py (Ollama, OVHcloud, GitHub Models, Groq,
--  Mistral, Google : même dialecte « chat completions ») et
--  essai_fournisseur.py.
--
--    24 · Projet IA : le même projet, avec une IA en ligne      mardi 13/10
--
--  Même forme que 21-23 : nature « projet », module projet-ia, missions
--  `tp24-mK`, et un questionnaire d'auto-évaluation en mode `revision`,
--  certitude demandée, huit questions, RATTACHÉ à la séance 24 et
--  `reste_ouvert`. Bonnes réponses : deux A, deux B, deux C, deux D.
--
--  Créée FERMÉE et NON PUBLIÉE. Mardi : Préparer → la séance 24 → Visible,
--  puis Ouvrir (le questionnaire s'ouvre avec elle). Rejouable.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min,
                            nature, jalons, echeance)
select c.id, 24, 'À distance - Projet IA : le même projet, avec une IA en ligne sans carte bancaire',
       false, false, 120, 'projet', 6, date '2026-10-13'
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = 24);

update public.seances s
   set module_id = m.id
  from public.classes c, public.modules m
 where c.id = s.classe_id and m.classe_id = c.id
   and c.code = 'BTS2-SLAM-2026' and m.code = 'projet-ia'
   and s.numero = 24 and s.module_id is null;

insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
select s.id, 'tp24-m' || m.ordre, m.ordre, m.libelle, m.niveau, m.verbe
  from public.seances s
  join public.classes c on c.id = s.classe_id
  join (values
    (1, 'Choix écrit au §8 : continuer, ou nouveau contexte et nouveau dépôt',            'guide',    'Concevoir'),
    (2, 'OVHcloud essayé sans compte ; où partent les données, noté',                     'guide',    'Concevoir'),
    (3, 'Application branchée sur fournisseurs.py : healthy, /a-propos répond',            'semi',     'Piloter'),
    (4, 'Local contre en ligne : même jeu, trois essais chacun, tableau du §8, CSV poussés', 'semi',     'Mesurer'),
    (5, 'Conditions citées, décision argumentée, règle écrite, aucune clé dans le dépôt',  'autonome', 'Sécuriser'),
    (6, 'Auto-évaluation faite, erreurs « sûr et faux » recopiées au §8',                 'guide',    'Mesurer')
  ) as m(ordre, libelle, niveau, verbe) on true
 where c.code = 'BTS2-SLAM-2026' and s.numero = 24
on conflict (seance_id, cle) do nothing;

-- ─── Le questionnaire d'auto-évaluation ───────────────────────────────────
create or replace function pg_temp.poser_autoeval(
  p_cle text, p_titre text, p_intro text, p_cible int, p_q jsonb)
returns void language plpgsql as $$
declare
  v_id     bigint;
  v_classe bigint;
  v_cible  bigint;
  v_s      bigint;
  v_num    int;
  v_rep    int;
  q        jsonb;
  v_rang   int := 0;
begin
  select id into v_classe from public.classes where code = 'BTS2-SLAM-2026';
  if v_classe is null then
    raise notice '%: pas de classe BTS2-SLAM-2026, rien n''est posé.', p_cle;
    return;
  end if;
  select id into v_cible from public.seances
   where classe_id = v_classe and numero = p_cible;

  select id into v_id from public.modeles where cle = p_cle;
  if v_id is not null then
    select count(*) into v_rep
      from public.reponses r join public.seances s on s.id = r.seance_id
     where s.modele_id = v_id;
    if v_rep > 0 then
      raise notice '%: % réponse(s) déjà données, rien n''est réécrit.', p_cle, v_rep;
      return;
    end if;
    delete from public.modele_corriges  where modele_id = v_id;
    delete from public.modele_questions where modele_id = v_id;
    update public.modeles set titre = p_titre, intro = p_intro,
                              mode = 'revision', certitude = true
     where id = v_id;
  else
    insert into public.modeles (cle, titre, intro, mode, certitude)
    values (p_cle, p_titre, p_intro, 'revision', true)
    returning id into v_id;
  end if;

  for q in select * from jsonb_array_elements(p_q) loop
    v_rang := v_rang + 1;
    insert into public.modele_questions (modele_id, rang, cle, intitule, options, theme)
    values (v_id, v_rang, p_cle || '-' || lpad(v_rang::text, 2, '0'),
            q->>'q', array(select jsonb_array_elements_text(q->'o')), q->>'t');
    insert into public.modele_corriges (modele_id, cle, bonne, explication)
    values (v_id, p_cle || '-' || lpad(v_rang::text, 2, '0'), q->>'b', q->>'e');
  end loop;

  select id into v_s from public.seances
   where classe_id = v_classe and modele_id = v_id;
  if v_s is null then
    select min(g) into v_num
      from generate_series(90, 98) g
     where not exists (select 1 from public.seances s
                        where s.classe_id = v_classe and s.numero = g);
    if v_num is null then
      raise notice '%: la bande 90-98 du BTS2 est pleine, questionnaire non affecté.', p_cle;
      return;
    end if;
    insert into public.seances (classe_id, numero, titre, notee, ouverte,
                                duree_min, nature, modele_id)
    values (v_classe, v_num, p_titre, false, false, 0, 'questionnaire', v_id)
    returning id into v_s;
  end if;

  delete from public.corriges where seance_id = v_s;
  insert into public.corriges (seance_id, question, bonne_reponse, explication,
                               intitule, options, theme)
  select v_s, mq.cle, mc.bonne, mc.explication, mq.intitule, mq.options, mq.theme
    from public.modele_questions mq
    join public.modele_corriges mc on mc.modele_id = mq.modele_id and mc.cle = mq.cle
   where mq.modele_id = v_id
   order by mq.rang;

  if v_cible is not null then
    update public.seances set rattachee_a = v_cible
     where id = v_s and rattachee_a is distinct from v_cible;
    update public.seances set reste_ouvert = true
     where id = v_s and not reste_ouvert;
  end if;
end $$;


select pg_temp.poser_autoeval(
  'autoeval-s24-saas',
  'Prototyper en ligne — auto-évaluation',
  'Huit questions sur la séance 24 : fournisseurs en ligne, quotas, secrets, '
  'souveraineté des données, mesure loyale. Choisissez, dites si vous étiez sûr, '
  'puis lisez la correction. Rien n''est noté : recommencez autant que vous voulez.',
  24,
  $j$[
   {"t":"API","q":"Pourquoi le même code peut-il parler à Ollama, OVHcloud, Groq ou GitHub Models ?",
    "o":["Ils exposent la même API « chat completions » : seuls l'adresse, la clé et le nom du modèle changent","Ils utilisent tous le même modèle","fournisseurs.py traduit chaque réponse dans une langue commune","C'est une coïncidence qui peut cesser à tout moment"],
    "b":"A","e":"Le dialecte d'OpenAI est devenu un standard de fait. Le garder dans un seul module rend le fournisseur interchangeable : on évite d'être enfermé chez l'un d'eux."},
   {"t":"Secrets","q":"Votre application publique utilise Groq. Où doit vivre la clé API ?",
    "o":["Dans static/index.html, pour que la page appelle Groq directement","Dans .env, côté serveur : la page appelle votre application, qui seule appelle Groq","Dans le README, pour l'enseignant","Dans un commit privé"],
    "b":"B","e":"Tout ce que reçoit le navigateur est lisible par le visiteur. Une clé dans la page serait volée en une minute, et votre quota avec."},
   {"t":"Quotas","q":"Pendant la mesure, plusieurs réponses reviennent en erreur 503 « service saturé ». Le plus probable ?",
    "o":["Votre prompt est mal écrit","Le code d'accès est faux","La limite de l'offre gratuite est atteinte (429 chez le fournisseur) : espacer les requêtes ou changer de fournisseur","Le modèle refuse de répondre au sujet"],
    "b":"C","e":"L'application traduit le 429 du fournisseur en 503 pour l'utilisateur. --pause espace les requêtes ; un quota est une limite de l'offre, pas une panne de votre code."},
   {"t":"Souveraineté","q":"Les conditions d'une offre gratuite disent que vos requêtes peuvent servir à entraîner les modèles. Que pouvez-vous y envoyer ?",
    "o":["Tout, puisque c'est gratuit","Les données clients, si elles sont pseudonymisées à moitié","Les documents internes, mais pas les données personnelles","Uniquement des données fictives ou publiques"],
    "b":"D","e":"Ce qui sert à entraîner peut ressortir ailleurs et échappe à l'organisation. Pour un prototype : données fictives ; pour la production : un contrat qui l'exclut, ou du local."},
   {"t":"Souveraineté","q":"Une société américaine héberge vos données dans un centre de données en Europe. Échappent-elles au droit américain ?",
    "o":["Non : une loi comme le Cloud Act peut obliger la société à les communiquer aux autorités américaines","Oui : seul le lieu des serveurs compte","Oui, si le site est en français","Oui, dès que les données sont chiffrées en transit"],
    "b":"A","e":"C'est la nationalité de la société, pas seulement l'adresse du serveur, qui détermine les lois auxquelles elle obéit. D'où l'intérêt des offres européennes, ou du local."},
   {"t":"Mesurer","q":"Pour comparer loyalement local et en ligne, il faut :",
    "o":["prendre le meilleur des trois essais de chacun","le même jeu de cas, la même consigne, la même température, trois essais chacun","un jeu plus facile pour le modèle local, plus petit","comparer seulement le temps de réponse"],
    "b":"B","e":"Une comparaison où deux choses changent ne dit rien. Seul le fournisseur doit varier."},
   {"t":"Concevoir","q":"Votre prototype sur une offre gratuite marche bien. Qu'est-ce que cela prouve pour l'organisation ?",
    "o":["Que la solution est prête pour la production","Que l'offre gratuite suffira toujours","Que le besoin peut être servi par un modèle — pas que quotas, conditions et données le permettent en production","Rien du tout : un prototype ne prouve jamais rien"],
    "b":"C","e":"Un prototype valide l'idée. Passer en production pose d'autres questions : volume, coût, contrat, données réelles, disponibilité."},
   {"t":"Souveraineté","q":"Un texte contient le nom et l'adresse d'un client. Vers quel modèle l'envoyer ?",
    "o":["Le plus rapide","Celui qui a la meilleure note dans la mesure","N'importe lequel, puisque le texte est court","Un modèle local, ou un fournisseur dont le contrat garantit le traitement en Europe et l'absence d'entraînement"],
    "b":"D","e":"C'est une donnée personnelle : le RGPD impose de maîtriser où elle va et ce qu'on en fait. La règle se décide AVANT de choisir le modèle, pas après."}
  ]$j$::jsonb);

-- ─── Contrôles ─────────────────────────────────────────────────────────────
do $$
declare n int; v_c bigint;
begin
  select id into v_c from public.classes where code = 'BTS2-SLAM-2026';
  if v_c is null then
    raise notice 'Projet IA 24 : pas de classe BTS2-SLAM-2026, rien à vérifier.';
    return;
  end if;

  select count(*) into n from public.missions m
    join public.seances s on s.id = m.seance_id
   where s.classe_id = v_c and s.numero = 24;
  if n <> 6 then raise exception 'projet IA 24 : % mission(s), attendu 6', n; end if;

  select count(*) into n from public.seances
   where classe_id = v_c and numero = 24 and nature = 'projet' and jalons = 6;
  if n <> 1 then raise exception 'projet IA 24 : séance absente ou mal réglée'; end if;

  select count(*) into n from public.modele_questions mq
    join public.modeles mo on mo.id = mq.modele_id
   where mo.cle = 'autoeval-s24-saas' and array_length(mq.options, 1) = 4;
  if n <> 8 then raise exception 'auto-évaluation 24 : % question(s) à 4 options, attendu 8', n; end if;

  select count(*) into n from (
    select mc.bonne, count(*) c
      from public.modele_corriges mc join public.modeles mo on mo.id = mc.modele_id
     where mo.cle = 'autoeval-s24-saas'
     group by 1) t
   where c <> 2;
  if n > 0 then raise exception 'auto-évaluation 24 : lettres mal réparties'; end if;

  select count(*) into n from public.seances q
    join public.modeles mo on mo.id = q.modele_id
    join public.seances s on s.id = q.rattachee_a
   where mo.cle = 'autoeval-s24-saas' and s.numero = 24 and q.reste_ouvert;
  if n <> 1 then raise exception 'auto-évaluation 24 : pas rattachée à la séance 24'; end if;

  raise notice 'Projet IA : séance 24 en place, fermée et cachée.';
end $$;
