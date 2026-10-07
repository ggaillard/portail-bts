-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — PROJET IA : UNE TROISIÈME SÉANCE À DISTANCE (jeudi 08/10/2026)
--
--  Demandé le 07/10 : les cours restent à distance, le projet IA est
--  prolongé d'une séance. Consignes : distance/projet-ia.html, partie
--  « Jeudi 8 octobre — séance 23 ». Rendu final par e-mail le lundi 12/10
--  avant 17 h (d'où l'échéance), application en ligne jusqu'à 20 h.
--
--    23 · Projet IA (3/3) — terminer, améliorer, présenter    jeudi 08/10
--
--  Même forme que 21 et 22 (20261002090000_bts2_projet_ia_distance.sql) :
--  nature « projet », rangée dans le module projet-ia, missions `tp23-mK`.
--  Pas de questionnaire d'auto-évaluation : ceux des séances 21 et 22
--  couvrent déjà le projet.
--
--  Créée FERMÉE et NON PUBLIÉE. Le jour même : Préparer → la séance →
--  Visible, puis Ouvrir. Rejouable : une mission déjà présente n'est pas
--  réécrite (une case cochée garde son libellé).
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.seances (classe_id, numero, titre, notee, ouverte, duree_min,
                            nature, jalons, echeance)
select c.id, 23, 'À distance - Projet IA (3/3) : terminer, améliorer, présenter',
       false, false, 120, 'projet', 6, date '2026-10-12'
  from public.classes c
 where c.code = 'BTS2-SLAM-2026'
   and not exists (select 1 from public.seances s
                    where s.classe_id = c.id and s.numero = 23);

update public.seances s
   set module_id = m.id
  from public.classes c, public.modules m
 where c.id = s.classe_id and m.classe_id = c.id
   and c.code = 'BTS2-SLAM-2026' and m.code = 'projet-ia'
   and s.numero = 23 and s.module_id is null;

insert into public.missions (seance_id, cle, ordre, libelle, niveau, verbe)
select s.id, 'tp23-m' || m.ordre, m.ordre, m.libelle, m.niveau, m.verbe
  from public.seances s
  join public.classes c on c.id = s.classe_id
  join (values
    (1, 'Point fait au README (§3), application relancée, nouvelle URL notée',       'guide',    'Concevoir'),
    (2, 'Séances 21 et 22 terminées : format tenu, healthy, URL testée en 4G',        'semi',     'Piloter'),
    (3, 'Deux échecs corrigés, jeu rejoué ×3, ligne « après modification » au §4',  'autonome', 'Mesurer'),
    (4, 'Risques avec la mesure en place, preuves collées, un détournement de plus', 'autonome', 'Sécuriser'),
    (5, 'Projet IA présenté sur sa page github.io',                                  'semi',     'Piloter'),
    (6, 'README complet et poussé ; rendu par e-mail avant lundi 12/10, 17 h',       'guide',    'Piloter')
  ) as m(ordre, libelle, niveau, verbe) on true
 where c.code = 'BTS2-SLAM-2026' and s.numero = 23
on conflict (seance_id, cle) do nothing;

do $$
declare n int; j int;
begin
  if not exists (select 1 from public.classes where code = 'BTS2-SLAM-2026') then
    raise notice 'projet IA 23 : pas de classe BTS2-SLAM-2026 ici, rien n''est posé.';
    return;
  end if;
  select count(*), max(s.jalons) into n, j
    from public.missions m
    join public.seances s on s.id = m.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026' and s.numero = 23;
  if n <> 6 or j <> 6 then
    raise exception 'projet IA 23 : % mission(s) pour % jalon(s), 6 attendues', n, j;
  end if;
end $$;
