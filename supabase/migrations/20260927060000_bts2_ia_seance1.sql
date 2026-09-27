-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — SÉANCE IA 1 « Développer à partir d'une spécification, avec un agent »
--
--  Première des six séances IA (Concevoir · Piloter · Mesurer · Sécuriser),
--  contexte Méca Forez, dépôt étudiant BTS2-IA-MecaForez/seance-01-specifier.
--
--  Deux choses, dans cet ordre :
--
--   1. La séance elle-même, numéro 11. Les TP PlaylistApp occupent 0 à 4, les
--      questionnaires 90 à 98, l'appel 99 : la bande 11 à 16 est réservée aux
--      six séances IA. Nature « projet », parce que chacun avance à son rythme
--      sur cinq missions : cinq jalons, un par mission du guide.
--
--   2. Son contrôle d'entrée : six notions `pre-01` à `pre-06`, chacune doublée
--      de sa certitude `pre-NN-c` (bonne_reponse = 'Z'). Le contrôle appartient
--      à la séance qu'il précède : il vit donc sur la séance 11. Il porte sur
--      ce qu'il faut savoir EN ENTRANT — test automatisé, assertion, branche,
--      diff, règle vérifiable — plus une notion de diagnostic sur l'agent,
--      pour savoir qui croit qu'un agent pose des questions.
--
--  Bonnes réponses : A C B D C A — deux A, un B, deux C, un D.
--
--  Comme pour le TP1, des insert et non `creer_controle()` : cette fonction
--  exige `est_enseignant()`, ce qu'une migration n'est pas.
--
--  La séance est créée FERMÉE et NON PUBLIÉE, le contrôle ÉTEINT. On allume le
--  contrôle depuis la carte « Contrôles d'entrée » au début de l'heure.
--
--  Rejouable sans risque : la séance n'est créée qu'une fois, et le contrôle
--  refuse de s'écraser dès qu'une réponse existe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La séance 11 ───────────────────────────────────────────────────────
insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min,
                            nature, jalons, echeance)
select c.id, 11,
       'IA 1 - Développer à partir d''une spécification, avec un agent',
       false, false, 180, 'projet', 5,
       date '2026-10-16'                          -- se corrige dans le portail : Le semestre → Les séances
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = 11);

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
     and s.numero = 11;

  if v_seance is null then
    raise exception 'BTS2-SLAM-2026 : pas de séance 11 en base — '
                    'la classe existe-t-elle sous ce code ?';
  end if;

  --  Réécrire effacerait les réponses : on s'arrête dès qu'il en existe une.
  select count(*) into v_deja
    from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';

  if v_deja > 0 then
    raise notice 'Contrôle IA 1 : % réponse(s) déjà données, rien n''est réécrit.',
                 v_deja;
    return;
  end if;

  delete from public.corriges
   where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse,
                               intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

    ('pre-01', 'A',
     'À quoi sert un test automatisé comme ceux du TP2 ?',
     array['À vérifier, à chaque exécution, qu''un comportement attendu est toujours obtenu',
           'À rendre le programme plus rapide une fois compilé',
           'À remplacer la documentation du projet pour les autres développeurs',
           'À corriger automatiquement les erreurs trouvées dans le code'],
     'Un test ne corrige rien : il dit, à chaque fois qu''on le lance, si le comportement attendu est toujours là.'),

    ('pre-02', 'C',
     'Dans un test xUnit, que fait Assert.Equal(3, playlist.Nombre) ?',
     array['Il donne la valeur 3 à la propriété Nombre de la playlist',
           'Il compte les chansons de la playlist et affiche le résultat',
           'Il fait échouer le test si Nombre ne vaut pas 3',
           'Il ajoute trois chansons à la playlist avant de continuer'],
     'Une assertion compare l''attendu (3) à l''obtenu (playlist.Nombre). Différents : le test échoue.'),

    ('pre-03', 'B',
     'Que montre la commande git diff main --stat ?',
     array['Le message de chacun des commits de la branche principale',
           'Les fichiers qui diffèrent de la branche main, avec le nombre de lignes changées',
           'L''historique complet des commits, du plus récent au plus ancien',
           'Le résultat de la fusion de la branche courante dans main'],
     'C''est la première commande d''une revue : l''étendue de ce qui a changé, avant d''en lire le détail.'),

    ('pre-04', 'D',
     'Pourquoi faire travailler quelqu''un sur une branche plutôt que directement sur main ?',
     array['Parce qu''une branche compile plus vite que la branche principale',
           'Parce que les tests ne s''exécutent que sur les branches',
           'Parce que Git interdit de committer sur main',
           'Pour isoler ses changements et pouvoir les relire avant de les intégrer'],
     'La branche isole ; la relecture décide. C''est ce qui permet de refuser une livraison, y compris celle d''un agent.'),

    ('pre-05', 'C',
     'Laquelle de ces phrases est une règle de gestion vérifiable ?',
     array['Le logiciel doit être rapide et agréable à utiliser',
           'Les prêts ne doivent pas durer trop longtemps',
           'Un prêt dure au plus 14 jours calendaires après la date du prêt',
           'Il faut éviter que les gens gardent les PC'],
     'Vérifiable = on peut dire, sur un exemple précis, si la règle est respectée. Seule la réponse chiffrée le permet.'),

    ('pre-06', 'A',
     'Un agent de code reçoit une consigne ambiguë. Que fait-il le plus souvent ?',
     array['Il choisit une interprétation et produit un code cohérent avec elle, sans le signaler',
           'Il s''arrête et pose systématiquement une question avant d''écrire du code',
           'Il refuse de travailler tant que la consigne n''est pas précisée',
           'Il écrit une version du code pour chaque interprétation possible'],
     'C''est tout l''enjeu de la séance : là où la spécification est floue, l''agent devine — et son choix a l''air aussi juste que le bon.')

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

  -- ─── 3. Contrôle ─────────────────────────────────────────────────────────
  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%' and question not like '%-c';
  if v_n <> 6 then raise exception 'contrôle IA 1 : % notions, attendu 6', v_n; end if;

  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%-c';
  if v_n <> 6 then raise exception 'contrôle IA 1 : % certitudes, attendu 6', v_n; end if;

  select count(*) into v_n from public.corriges
   where seance_id = v_seance and question like 'pre-%' and question not like '%-c'
     and (intitule is null or options is null or array_length(options, 1) <> 4);
  if v_n > 0 then
    raise exception 'contrôle IA 1 : % notion(s) sans intitulé ou sans 4 options', v_n;
  end if;

  select max(k) into v_max from (
    select count(*) as k from public.corriges
     where seance_id = v_seance and question like 'pre-%' and question not like '%-c'
     group by bonne_reponse) t;
  if v_max > 2 then
    raise exception 'contrôle IA 1 : une même lettre est bonne % fois sur 6', v_max;
  end if;

  raise notice 'Séance IA 1 (n° 11, projet, 5 jalons) et son contrôle d''entrée '
               '(6 notions + 6 certitudes) sont posés. Contrôle ÉTEINT, séance '
               'non publiée.';
end $$;

-- ─── Vérification à la main, en lecture seule ──────────────────────────────
--  select s.numero, s.titre, s.nature, s.jalons, s.echeance, s.controle_ouvert,
--         count(co.*) filter (where co.question like 'pre-%' and co.question not like '%-c') as notions
--    from public.seances s
--    join public.classes c on c.id = s.classe_id
--    left join public.corriges co on co.seance_id = s.id
--   where c.code = 'BTS2-SLAM-2026' and s.numero = 11
--   group by s.id;
