-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — SÉANCE IA 2 « Prompts et évaluation d'un LLM : trier les tickets »
--
--  Deuxième des six séances IA (verbe dominant : Mesurer), contexte Méca
--  Forez, dépôt étudiant BTS2-IA-MecaForez/seance-02-mesurer.
--
--  Trois choses, dans cet ordre :
--
--   1. La séance 12 (bande 11-16 des séances IA), nature « projet », cinq
--      jalons : un par mission du guide.
--
--   2. Son contrôle d'entrée : six notions `pre-01` à `pre-06`, chacune doublée
--      de sa certitude. Ce qu'il faut savoir EN ENTRANT : lire un objet JSON,
--      un port HTTP, un pourcentage, pourquoi on ne mesure pas sur les données
--      de réglage, plus deux notions de diagnostic — le hasard d'un LLM et le
--      coût inégal des erreurs.
--
--   3. Ses cinq missions `tp12-m1` à `tp12-m5`, pour la carte « Vos missions ».
--
--  Bonnes réponses : B D A C D B — deux B, deux D, un A, un C.
--
--  Séance créée FERMÉE et NON PUBLIÉE, contrôle ÉTEINT. Échéance et
--  publication se règlent dans le portail : Le semestre → Les séances.
--
--  Rejouable sans risque : la séance n'est créée qu'une fois, le contrôle
--  refuse de s'écraser dès qu'une réponse existe, les missions existantes ne
--  sont pas touchées.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La séance 12 ───────────────────────────────────────────────────────
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min,
                            nature, jalons, echeance)
select c.id, 12,
       'IA 2 - Prompts et évaluation d''un LLM : trier les tickets',
       false, false, 180, 'projet', 5,
       date '2026-11-06'                          -- se corrige dans le portail : Le semestre → Les séances
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = 12);

-- ─── 2. Le contrôle d'entrée ───────────────────────────────────────────────
do $$
declare
  v_seance bigint;
  v_deja   int;
  v_n      int;
  v_max    int;
begin
  select s.id into v_seance
    from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026'
     and s.numero = 12;

  if v_seance is null then
    raise exception 'BTS2-SLAM-2026 : pas de séance 12 en base — '
                    'la classe existe-t-elle sous ce code ?';
  end if;

  --  Réécrire effacerait les réponses : on s'arrête dès qu'il en existe une.
  select count(*) into v_deja
    from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';

  if v_deja > 0 then
    raise notice 'Contrôle IA 2 : % réponse(s) déjà données, rien n''est réécrit.',
                 v_deja;
    return;
  end if;

  delete from public.corriges
   where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse,
                               intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

    ('pre-01', 'B',
     'Lequel de ces textes est un objet JSON valide ?',
     array['{categorie: "reseau", priorite: "P2"}',
           '{"categorie": "reseau", "priorite": "P2"}',
           '{"categorie": ''reseau'', "priorite": ''P2''}',
           '{"categorie" = "reseau", "priorite" = "P2"}'],
     'En JSON, les clés et les chaînes sont entre guillemets doubles, et chaque clé est suivie de deux-points.'),

    ('pre-02', 'D',
     'Un programme envoie une requête POST à http://localhost:11434/api/chat. Que désigne 11434 ?',
     array['Le numéro de version de l''API interrogée par le programme',
           'L''identifiant unique attribué à cette requête par le serveur',
           'Le nombre maximal de mots que la réponse pourra contenir',
           'Le port sur lequel le serveur attend les requêtes'],
     'Hôte (localhost), port (11434), chemin (/api/chat) : l''adresse complète d''un service HTTP. 11434 est le port d''Ollama.'),

    ('pre-03', 'A',
     'Un programme donne la bonne réponse pour 17 tickets sur 20. Quel est son taux de réussite ?',
     array['85 %', '17 %', '80 %', '3 %'],
     '17 / 20 = 0,85, soit 85 %. Un taux se donne toujours avec son effectif : 85 % de 20 tickets.'),

    ('pre-04', 'C',
     'Pourquoi ne juge-t-on pas un programme sur les exemples qui ont servi à le mettre au point ?',
     array['Parce que ces exemples sont trop peu nombreux pour être lus en entier',
           'Parce que ces exemples ont déjà été supprimés une fois le réglage terminé',
           'Parce qu''il a été ajusté pour eux : son score y serait trop optimiste',
           'Parce que ces exemples sont réservés aux tests unitaires du programme'],
     'Un programme réglé sur des exemples les « connaît ». Seuls des exemples jamais vus disent comment il se comportera en vrai.'),

    ('pre-05', 'D',
     'On pose deux fois exactement la même question à un modèle de langage. Que se passe-t-il le plus souvent ?',
     array['Il signale une erreur, car la question a déjà été posée',
           'Il donne exactement la même réponse, mot pour mot',
           'Il refuse de répondre une seconde fois à la même personne',
           'Il peut donner deux réponses différentes, le texte étant tiré en partie au hasard'],
     'Chaque mot est tiré parmi les plus probables. Deux essais peuvent donc différer : une mesure se rejoue.'),

    ('pre-06', 'B',
     'Un détecteur d''incendie se déclenche parfois pour de la vapeur, mais n''a jamais raté un vrai feu. Quelle erreur doit-il surtout éviter ?',
     array['Se déclencher pour de la vapeur de douche',
           'Rester muet pendant un vrai incendie',
           'Sonner trop fort lors d''une fausse alerte',
           'Se déclencher avec une seconde de retard'],
     'Toutes les erreurs ne coûtent pas pareil. Pour le tri des tickets, l''erreur qui coûte est le P1 classé « pas pressé ».')

    ) as q(cle, bonne, intitule, options, explication);

  --  La certitude, dans les mêmes termes que pour le TP1.
  insert into public.corriges (seance_id, question, bonne_reponse,
                               intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris',
               'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, 6) as i;

  -- ─── Contrôle ─────────────────────────────────────────────────────────
  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%' and question not like '%-c';
  if v_n <> 6 then raise exception 'contrôle IA 2 : % notions, attendu 6', v_n; end if;

  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%-c';
  if v_n <> 6 then raise exception 'contrôle IA 2 : % certitudes, attendu 6', v_n; end if;

  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%' and question not like '%-c'
     and (intitule is null or options is null or array_length(options, 1) <> 4);
  if v_n > 0 then
    raise exception 'contrôle IA 2 : % notion(s) sans intitulé ou sans 4 options', v_n;
  end if;

  select max(k) into v_max from (
    select count(*) as k from public.corriges
     where seance_id = v_seance and question like 'pre-%' and question not like '%-c'
     group by bonne_reponse) t;
  if v_max > 2 then
    raise exception 'contrôle IA 2 : une même lettre est bonne % fois sur 6', v_max;
  end if;

  raise notice 'Séance IA 2 (n° 12, projet, 5 jalons) et son contrôle d''entrée '
               '(6 notions + 6 certitudes) sont posés. Contrôle ÉTEINT, séance '
               'non publiée.';
end $$;


-- ─── 3. Les cinq missions ──────────────────────────────────────────────────
--  Écrites directement (`definir_missions` exige `est_enseignant()`). On
--  n'écrase rien : une fois la séance jouée, elles s'éditent dans le portail.
insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
select s.id, 'tp12-m' || m.ordre, m.ordre, m.libelle, m.niveau, m.verbe
  from public.seances s
  join public.classes c on c.id = s.classe_id
  cross join (values
    (1, 'Grille d''étiquetage et 30 réponses attendues',            'guide',    'Concevoir'),
    (2, 'Un prompt aux réponses exploitables, mesuré',              'guide',    'Mesurer'),
    (3, 'Schéma JSON et variabilité mesurée',                       'semi',     'Mesurer'),
    (4, 'Prompt v2 réglé sur 1-20, testé une fois sur 21-30',       'semi',     'Mesurer'),
    (5, 'Test à l''aveugle et condition de mise en service',        'autonome', 'Sécuriser')
  ) as m(ordre, libelle, niveau, verbe)
 where c.code = 'BTS2-SLAM-2026' and s.numero = 12
on conflict (seance_id, cle) do nothing;

do $$
declare n int;
begin
  select count(*) into n from public.missions m
    join public.seances s on s.id = m.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026' and s.numero = 12;
  if n < 5 then
    raise exception 'séance IA 2 : % mission(s), attendu au moins 5', n;
  end if;
  raise notice 'Séance IA 2 : % missions.', n;
end $$;

-- ─── Vérification à la main, en lecture seule ──────────────────────────────
--  select s.numero, s.titre, s.nature, s.jalons, s.echeance, s.controle_ouvert,
--         count(co.*) filter (where co.question like 'pre-%' and co.question not like '%-c') as notions
--    from public.seances s
--    join public.classes c on c.id = s.classe_id
--    left join public.corriges co on co.seance_id = s.id
--   where c.code = 'BTS2-SLAM-2026' and s.numero = 12
--   group by s.id;
