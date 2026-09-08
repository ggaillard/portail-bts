-- ═══════════════════════════════════════════════════════════════════════════
--  INTITULÉS DES QUESTIONS
--
--  Ajoute une colonne « intitule » aux corrigés, pour que l'écran de classe
--  projette la question en toutes lettres au lieu de « q8 ».
--
--  Le portail fonctionne avec ou sans cette colonne : tant qu'elle n'existe
--  pas, il affiche seulement « Question 8 sur 10 ». Dès qu'elle est remplie,
--  l'intitulé apparaît en grand sous ce repère.
--
--  À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La colonne ─────────────────────────────────────────────────────────
alter table public.corriges add column if not exists intitule text;

-- ─── 2. Les intitulés de la classe de démonstration ────────────────────────
--  Ce sont les dix questions de révision de votre séance 1, réutilisées pour
--  que la démonstration ressemble à une vraie séance.
update public.corriges c
   set intitule = v.txt
  from public.seances s
  join public.classes cl on cl.id = s.classe_id,
       (values
         ('q1',  'Le modele de Laudon decrit un SI en 5 composants. Lequel n''en fait pas partie ?'),
         ('q2',  'Le code d''une application releve de quel composant ?'),
         ('q3',  'Une seule personne connait la procedure de redemarrage. Cela releve de quel composant ?'),
         ('q4',  'La culture DevOps rapproche quels deux mondes ?'),
         ('q5',  'Quelle culture integre la securite des la conception ?'),
         ('q6',  'Quelle culture industrialise la donnee : pipelines, ETL, qualite ?'),
         ('q7',  'Quelle culture met un modele d''IA en production de facon fiable ?'),
         ('q8',  'Git est un outil de quelle nature ?'),
         ('q9',  'Dans l''enquete DevSecure, quelle etait la cause premiere de la panne ?'),
         ('q10', 'Quel est le point commun des quatre cultures Ops ?')
       ) as v(q, txt)
 where c.seance_id = s.id
   and cl.code = 'DEMO-2026'
   and c.question = v.q;

-- ─── 3. Contrôle ───────────────────────────────────────────────────────────
select c.question, left(c.intitule, 60) as intitule
  from public.corriges c
  join public.seances s on s.id = c.seance_id
  join public.classes cl on cl.id = s.classe_id
 where cl.code = 'DEMO-2026' and s.numero = 1
 order by length(c.question), c.question;

-- ═══════════════════════════════════════════════════════════════════════════
--  Pour vos vraies séances, remplissez la colonne au fur et à mesure :
--
--   update public.corriges c set intitule = 'Le texte de la question ?'
--     from public.seances s join public.classes cl on cl.id = s.classe_id
--    where c.seance_id = s.id and cl.code = 'BTS1-DEV-2026'
--      and s.numero = 1 and c.question = 'q1';
-- ═══════════════════════════════════════════════════════════════════════════
