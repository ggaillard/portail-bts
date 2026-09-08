-- ═══════════════════════════════════════════════════════════════════════════
--  JEU D'ESSAI — toutes les situations d'une séance
--
--  Crée deux classes de démonstration, séparées de vos vraies classes :
--
--   • DEMO-2026        12 élèves, 7 séances, une par scénario
--   • DEMO-GRANDE-2026 30 élèves, 1 séance, pour voir tenir un gros effectif
--
--  Vous choisissez la variante dans le menu « séance » du suivi : aucune
--  manipulation supplémentaire, chaque séance raconte une situation différente.
--
--  À coller dans Supabase → SQL Editor → Run. Le DELETE de tête ne vide que
--  les classes de démonstration : Supabase affichera l'avertissement rouge,
--  confirmez avec le second bouton « Run query ».
--
--  Pour tout supprimer ensuite :
--     delete from public.classes where code like 'DEMO%';
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.classes where code in ('DEMO-2026', 'DEMO-GRANDE-2026');

-- ═══ CLASSE 1 — douze élèves ═══════════════════════════════════════════════
insert into public.classes (code, nom, annee) values
  ('DEMO-2026', 'Classe de demonstration', '2026-2027');

-- L'élève 12 n'a volontairement pas d'avatar : il affiche le repère « • ».
insert into public.eleves (classe_id, numero, avatar, pin)
select c.id, v.n, v.a, v.p
  from public.classes c,
       (values
         ('01','🦊','1101'), ('02','🐢','1102'), ('03','🦉','1103'),
         ('04','🐙','1104'), ('05','🦁','1105'), ('06','🐺','1106'),
         ('07','🦄','1107'), ('08','🐝','1108'), ('09','🐬','1109'),
         ('10','🦋','1110'), ('11','🐧','1111'), ('12', null ,'1112')
       ) as v(n, a, p)
 where c.code = 'DEMO-2026';

-- Sept séances, une par situation
insert into public.seances (classe_id, numero, titre, notee, ouverte)
select c.id, v.num, v.titre, v.notee, v.ouv
  from public.classes c,
       (values
         (1, 'Demarrage - les premieres reponses arrivent',  false, true),
         (2, 'En cours - classe contrastee',                 false, true),
         (3, 'Terminee - objectif atteint, confettis',       false, true),
         (4, 'Classe en difficulte - a reprendre',           false, true),
         (5, 'Classe brillante - longues series',            false, true),
         (6, 'Fermee - aucune reponse possible',             false, false),
         (7, 'Evaluee - correction masquee aux eleves',      true,  true)
       ) as v(num, titre, notee, ouv)
 where c.code = 'DEMO-2026';

-- Dix corrigés par séance, bonne réponse B
insert into public.corriges (seance_id, question, bonne_reponse, explication)
select s.id, 'q' || g, 'B', 'Explication de la question ' || g || '.'
  from public.seances s
  join public.classes c on c.id = s.classe_id,
       generate_series(1, 10) g
 where c.code = 'DEMO-2026';

-- Les réponses, un scénario par séance.
--   rep = questions traitées, jus = bonnes réponses
--   Séance 5 : les bonnes réponses sont groupées en fin de parcours,
--   ce qui produit de longues séries et fait apparaître les badges 🔥.
insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
select e.id, s.id, 'q' || g,
       case when p.juste then 'B' else (array['A','C','D'])[1 + (g % 3)] end,
       p.juste,
       now() - ((p.rep - g) * interval '70 seconds')
  from public.classes c
  join public.eleves  e on e.classe_id = c.id
  join public.seances s on s.classe_id = c.id
  cross join generate_series(1, 10) g
  cross join lateral (
    select r.rep, r.jus,
           case when s.numero = 5 then g > r.rep - r.jus
                else ((g * 7 - 7) % 10) + 1 <= r.jus end as juste
      from (select
              case s.numero
                when 1 then (array[3,2,1,2,0,0,0,0,0,0,0,0])[e.numero::int]
                when 2 then (array[10,10,8,10,6,4,10,7,3,0,9,2])[e.numero::int]
                when 3 then 10
                when 4 then 10
                when 5 then 10
                when 7 then (array[8,6,10,4,9,3,10,5,7,0,6,2])[e.numero::int]
                else 0
              end as rep,
              case s.numero
                when 1 then (array[2,1,1,1,0,0,0,0,0,0,0,0])[e.numero::int]
                when 2 then (array[9,7,6,4,5,1,10,3,2,0,5,0])[e.numero::int]
                when 3 then (array[10,9,8,7,10,6,10,8,9,7,8,6])[e.numero::int]
                when 4 then (array[3,2,4,1,3,2,4,1,2,3,1,2])[e.numero::int]
                when 5 then (array[10,9,10,8,9,10,10,9,8,10,9,8])[e.numero::int]
                when 7 then (array[6,4,9,2,7,1,10,3,5,0,4,1])[e.numero::int]
                else 0
              end as jus
           ) r
  ) p
 where c.code = 'DEMO-2026' and g <= p.rep;

-- ═══ CLASSE 2 — trente élèves, pour voir tenir un gros effectif ════════════
insert into public.classes (code, nom, annee) values
  ('DEMO-GRANDE-2026', 'Classe de demonstration - 30 eleves', '2026-2027');

insert into public.eleves (classe_id, numero, avatar, pin)
select c.id, lpad(g::text, 2, '0'),
       (array['🦊','🐢','🦉','🐙','🦁','🐺','🦄','🐝','🐬','🦋',
              '🐧','🦔','🐳','🦅','🐨','🦝','🐸','🦖','🦩','🐍',
              '🦎','🐊','🦦','🐼','🦒','🐯','🦓','🐘','🦥','🐐'])[g],
       lpad((2000 + g)::text, 4, '0')
  from public.classes c, generate_series(1, 30) g
 where c.code = 'DEMO-GRANDE-2026';

insert into public.seances (classe_id, numero, titre, notee, ouverte)
select id, 1, 'Grande classe - 30 eleves en activite', false, true
  from public.classes where code = 'DEMO-GRANDE-2026';

insert into public.corriges (seance_id, question, bonne_reponse, explication)
select s.id, 'q' || g, 'B', 'Explication de la question ' || g || '.'
  from public.seances s
  join public.classes c on c.id = s.classe_id,
       generate_series(1, 10) g
 where c.code = 'DEMO-GRANDE-2026';

-- Avancement et réussite variés.
--   niveau  = force de l'élève, de 2 à 9
--   juste   = croise le niveau de l'élève et la difficulté de la question,
--             sans plafonner le niveau : les questions dures restent
--             accessibles aux bons élèves
--   fausse  = la lettre erronée dépend de l'élève ET de la question, pour que
--             les quatre options se remplissent dans la vue Répartition
insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
select e.id, s.id, 'q' || g,
       case when p.juste then 'B'
            else (array['A','C','D'])[1 + ((e.numero::int + g) % 3)] end,
       p.juste,
       now() - ((p.rep - g) * interval '55 seconds')
  from public.classes c
  join public.eleves  e on e.classe_id = c.id
  join public.seances s on s.classe_id = c.id and s.numero = 1
  cross join generate_series(1, 10) g
  cross join lateral (
    select r.rep,
           ((e.numero::int * 13 + g * 7) % 10) < r.niveau as juste
      from (select 3 + ((e.numero::int * 7) % 8) as rep,
                   2 + ((e.numero::int * 3) % 8) as niveau) r
  ) p
 where c.code = 'DEMO-GRANDE-2026' and g <= p.rep;

-- ═══ CONTRÔLE ══════════════════════════════════════════════════════════════
select c.code, s.numero, s.titre, s.ouverte, s.notee,
       count(r.id)                        as reponses,
       count(*) filter (where r.correct)  as justes
  from public.classes c
  join public.seances s on s.classe_id = c.id
  left join public.reponses r on r.seance_id = s.id
 where c.code like 'DEMO%'
 group by c.code, s.numero, s.titre, s.ouverte, s.notee
 order by c.code, s.numero;
