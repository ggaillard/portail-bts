-- ═══════════════════════════════════════════════════════════════════════════
--  JEU D'ESSAI — classe de démonstration
--
--  Crée une classe DEMO-2026 séparée de vos vraies classes, avec 12 élèves,
--  une séance de 10 questions et des réponses variées. Elle sert à voir le
--  suivi fonctionner et à vous entraîner avant une vraie séance.
--
--  À coller dans Supabase → SQL Editor → New query → Run.
--  Supabase affichera un avertissement « opérations destructives » à cause
--  du DELETE de nettoyage en tête : c'est normal, il ne vide que DEMO-2026.
--  Confirmez avec le second bouton « Run query ».
--
--  Pour tout supprimer plus tard :
--     delete from public.classes where code = 'DEMO-2026';
-- ═══════════════════════════════════════════════════════════════════════════

-- Repartir d'une base propre si le jeu d'essai existe déjà
delete from public.classes where code = 'DEMO-2026';

-- ─── 1. La classe ──────────────────────────────────────────────────────────
insert into public.classes (code, nom, annee) values
  ('DEMO-2026', 'Classe de demonstration (jeu d''essai)', '2026-2027');

-- ─── 2. Douze élèves, avec avatar et code PIN ──────────────────────────────
insert into public.eleves (classe_id, numero, avatar, pin)
select c.id, v.num, v.av, v.pin
  from public.classes c,
       (values
         ('01','🦊','1101'), ('02','🐢','1102'), ('03','🦉','1103'),
         ('04','🐙','1104'), ('05','🦁','1105'), ('06','🐺','1106'),
         ('07','🦄','1107'), ('08','🐝','1108'), ('09','🐬','1109'),
         ('10','🦋','1110'), ('11','🐧','1111'), ('12','🦔','1112')
       ) as v(num, av, pin)
 where c.code = 'DEMO-2026';

-- ─── 3. Une séance ouverte ─────────────────────────────────────────────────
insert into public.seances (classe_id, numero, titre, notee, ouverte)
select id, 1, 'Demonstration - 10 questions', false, true
  from public.classes where code = 'DEMO-2026';

-- ─── 4. Les dix corrigés ───────────────────────────────────────────────────
insert into public.corriges (seance_id, question, bonne_reponse, explication)
select s.id, 'q' || g, 'B', 'Explication de la question ' || g || '.'
  from public.seances s
  join public.classes c on c.id = s.classe_id,
       generate_series(1, 10) g
 where c.code = 'DEMO-2026' and s.numero = 1;

-- ─── 5. Les réponses, volontairement contrastées ───────────────────────────
--  repondu = nombre de questions traitées, juste = nombre de bonnes réponses.
--  La difficulté est répartie sur les questions par une permutation, pour que
--  le panneau « réussite par question » soit lisible et non monotone.
insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
select e.id, s.id, 'q' || g,
       case when ((g * 7 - 7) % 10) + 1 <= v.juste then 'B' else 'C' end,
       ((g * 7 - 7) % 10) + 1 <= v.juste,
       now() - ((v.repondu - g) * interval '80 seconds')
  from public.classes c
  join public.eleves  e on e.classe_id = c.id
  join public.seances s on s.classe_id = c.id and s.numero = 1
  join (values
          ('01', 10, 9), ('02', 10, 7), ('03',  8, 6), ('04', 10, 4),
          ('05',  6, 5), ('06',  4, 1), ('07', 10, 10), ('08', 7, 3),
          ('09',  3, 2), ('10',  0, 0), ('11',  9, 5), ('12',  2, 0)
       ) as v(num, repondu, juste) on v.num = e.numero
  cross join generate_series(1, 10) g
 where c.code = 'DEMO-2026' and g <= v.repondu;

-- ─── 6. Un projet, pour que la classe existe aussi côté étudiant ───────────
insert into public.projets (classe_id, titre, description, url, icone, ordre)
select id, 'Seance de demonstration',
       'Jeu d''essai pour prendre en main le suivi. Aucune note.',
       'https://ggaillard.github.io/portail-bts/', 'DEMO', 1
  from public.classes where code = 'DEMO-2026';

-- ─── 7. Contrôle ───────────────────────────────────────────────────────────
select e.numero, e.avatar, e.pin,
       count(r.id)                              as repondu,
       count(*) filter (where r.correct)        as juste,
       to_char(max(r.updated_at), 'HH24:MI:SS') as derniere_activite
  from public.eleves e
  join public.classes c on c.id = e.classe_id
  left join public.reponses r on r.eleve_id = e.id
 where c.code = 'DEMO-2026'
 group by e.numero, e.avatar, e.pin
 order by e.numero;
