-- ═══════════════════════════════════════════════════════════════════════════
--  RECLASSEMENT DES RÉPONSES DE QUIZ BTS2
--
--  Le tableau de bord PlaylistApp rangeait chaque réponse de quiz sous la
--  séance portant le numéro du BLOC de quiz, en croyant y lire un numéro de
--  TP. Il y a sept blocs pour cinq TP — le TP1 et le TP2 en ayant deux
--  chacun — donc trois blocs partaient au mauvais endroit :
--
--      bloc 0 → TP0   correct              bloc 4 → TP2, rangé en séance 4
--      bloc 1 → TP1   correct              bloc 5 → TP3, JAMAIS ENREGISTRÉ
--      bloc 2 → TP1, rangé en séance 2     bloc 6 → TP4, JAMAIS ENREGISTRÉ
--      bloc 3 → TP2, rangé en séance 3
--
--  Les blocs 5 et 6 sortaient en silence : il n'existe pas de séance numéro
--  5 ni 6, et l'envoi abandonnait sans rien dire. Ces réponses-là ne sont pas
--  à déplacer, elles n'existent pas en base. Elles repartiront d'elles-mêmes
--  du poste de l'étudiant, la correction de suivi.js rendant au tableau de
--  bord la capacité de renvoyer ce que le serveur n'a pas.
--
--  Ce fichier NE MODIFIE RIEN tant que la section 2 est commentée.
--  Regarder d'abord, décider, puis exécuter.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Regarder : qu'y a-t-il à déplacer ? ────────────────────────────────
select s.numero            as seance_actuelle,
       left(r.question, 4) as bloc,
       count(*)            as lignes,
       count(distinct r.eleve_id) as etudiants,
       case left(r.question, 4)
         when 'q-2-' then 1 when 'q-3-' then 2 when 'q-4-' then 2
         else s.numero end as seance_correcte
  from public.reponses r
  join public.seances s on s.id = r.seance_id
  join public.classes c on c.id = s.classe_id
 where c.code = 'BTS2-SLAM-2026'
   and r.question like 'q-%'
 group by s.numero, left(r.question, 4)
 order by s.numero, bloc;

--  S'il ne sort aucune ligne dont « seance_actuelle » diffère de
--  « seance_correcte », il n'y a rien à faire : passez directement à
--  QUIZ_ENONCES.sql.

-- ─── 2. Déplacer — À LANCER APRÈS AVOIR LU LA SECTION 1 ────────────────────
--  Décommentez le bloc. La transaction se termine par un rollback : lisez le
--  contrôle, puis remplacez-le par commit si le compte est bon.
/*
begin;

update public.reponses r
   set seance_id = cible.id
  from public.seances source,
       public.classes c,
       public.seances cible
 where r.seance_id = source.id
   and c.id        = source.classe_id
   and c.code      = 'BTS2-SLAM-2026'
   and cible.classe_id = c.id
   and cible.numero    = case left(r.question, 4)
                           when 'q-2-' then 1
                           when 'q-3-' then 2
                           when 'q-4-' then 2
                         end
   and left(r.question, 4) in ('q-2-', 'q-3-', 'q-4-')
   and source.numero <> cible.numero;

-- Contrôle : chaque bloc doit désormais être sur sa séance.
select s.numero as seance, left(r.question, 4) as bloc, count(*) as lignes
  from public.reponses r
  join public.seances s on s.id = r.seance_id
  join public.classes c on c.id = s.classe_id
 where c.code = 'BTS2-SLAM-2026' and r.question like 'q-%'
 group by s.numero, left(r.question, 4)
 order by s.numero, bloc;
--  Attendu : séance 0 → q-0- · séance 1 → q-1- et q-2- · séance 2 → q-3- et
--  q-4- · séance 3 → q-5- (à venir) · séance 4 → q-6- (à venir).

rollback;   -- remplacer par commit; si le compte est bon
*/
