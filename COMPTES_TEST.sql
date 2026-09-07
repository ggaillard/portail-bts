-- ═══════════════════════════════════════════════════════════════════════════
--  COMPTES DE TEST — un par promotion, dans les vraies classes
--
--  Crée l'étudiant n° 99 dans BTS1-DEV-2026 et dans BTS2-SLAM-2026, avec un
--  PIN connu et un avatar « éprouvette » qu'aucun étudiant ne prendra, puis
--  lui fabrique un jeu d'essai sur la première séance ouverte de sa classe :
--  7 questions traitées sur 10, dont 5 justes, étalées dans le temps.
--
--  De quoi vérifier l'identification, l'écran étudiant et le suivi enseignant
--  avant d'ouvrir aux étudiants — sans créer de classe de démonstration.
--
--  À coller dans Supabase → SQL Editor → Run. Le DELETE de tête ne vise que
--  le n° 99 : Supabase affichera l'avertissement rouge, confirmez avec le
--  second bouton « Run query ».
--
--  Pour tout retirer ensuite, rejouer la seule section 1 (les suppressions).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Repartir propre ────────────────────────────────────────────────────
delete from public.reponses r
 using public.eleves e
  join public.classes c on c.id = e.classe_id
 where r.eleve_id = e.id
   and e.numero = '99'
   and c.code in ('BTS1-DEV-2026', 'BTS2-SLAM-2026');

delete from public.eleves e
 using public.classes c
 where c.id = e.classe_id
   and e.numero = '99'
   and c.code in ('BTS1-DEV-2026', 'BTS2-SLAM-2026');

-- ─── 2. Les deux comptes de test ───────────────────────────────────────────
--  BTS1 : numéro 99, PIN 9901, avatar 🧪
--  BTS2 : numéro 99, PIN 9902, avatar 🔬
insert into public.eleves (classe_id, numero, avatar, pin)
select c.id, '99', v.av, v.pin
  from public.classes c,
       (values
         ('BTS1-DEV-2026',  '🧪', '9901'),
         ('BTS2-SLAM-2026', '🔬', '9902')
       ) as v(code, av, pin)
 where c.code = v.code;

-- ─── 3. Le jeu d'essai ─────────────────────────────────────────────────────
--  Sur la première séance ouverte de chaque classe. S'il n'y en a pas encore,
--  cette section n'insère rien : le compte existe quand même, il attend.
with cible as (
  select e.id as eleve_id, prem.id as seance_id
    from public.classes c
    join public.eleves  e on e.classe_id = c.id and e.numero = '99'
    join lateral (
      select s.id
        from public.seances s
       where s.classe_id = c.id and s.ouverte
       order by s.numero
       limit 1
    ) prem on true
   where c.code in ('BTS1-DEV-2026', 'BTS2-SLAM-2026')
),
questions as (
  select t.eleve_id, t.seance_id, co.question, co.bonne_reponse,
         row_number() over (partition by t.seance_id order by co.question) as rang
    from cible t
    join public.corriges co on co.seance_id = t.seance_id
)
insert into public.reponses (eleve_id, seance_id, question, reponse, correct, updated_at)
select q.eleve_id, q.seance_id, q.question,
       case when q.rang in (1, 2, 4, 5, 7)
            then q.bonne_reponse
            else (select l
                    from unnest(array['A','B','C','D']) l
                   where l <> q.bonne_reponse
                  offset (q.rang % 3) limit 1)
       end,
       q.rang in (1, 2, 4, 5, 7),
       now() - ((8 - q.rang) * interval '90 seconds')
  from questions q
 where q.rang <= 7;

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
select c.code                              as classe,
       e.numero, e.avatar, e.pin,
       s.numero                            as seance,
       count(r.id)                         as traitees,
       count(*) filter (where r.correct)   as justes
  from public.classes c
  join public.eleves  e on e.classe_id = c.id and e.numero = '99'
  left join public.reponses r on r.eleve_id = e.id
  left join public.seances  s on s.id = r.seance_id
 where c.code in ('BTS1-DEV-2026', 'BTS2-SLAM-2026')
 group by c.code, e.numero, e.avatar, e.pin, s.numero
 order by c.code;
