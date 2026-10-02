-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — Projet IA : le rendu passe par e-mail (02/10/2026, 21 h)
--
--  Les séances ont lieu de 15 h à 17 h ; les échanges et le rendu passent par
--  la messagerie Gmail de l'enseignant, plus par Pronote. Seul le libellé de
--  la dernière mission de la séance 22 le disait : on le corrige, sans
--  toucher à sa clé (tp22-m5) ni à une case déjà cochée.
--  Rejouable : ne change rien si le libellé est déjà le bon.
-- ═══════════════════════════════════════════════════════════════════════════

update public.missions m
   set libelle = 'Rendu envoyé par e-mail avant 17 h, application en ligne jusqu''à 20 h'
  from public.seances s
  join public.classes c on c.id = s.classe_id
 where m.seance_id = s.id
   and c.code = 'BTS2-SLAM-2026' and s.numero = 22 and m.cle = 'tp22-m5'
   and m.libelle is distinct from 'Rendu envoyé par e-mail avant 17 h, application en ligne jusqu''à 20 h';

do $$
declare n int;
begin
  select count(*) into n from public.missions m
    join public.seances s on s.id = m.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026' and s.numero = 22 and m.cle = 'tp22-m5'
     and m.libelle ilike '%Pronote%';
  if n > 0 then raise exception 'projet IA : la mission tp22-m5 parle encore de Pronote'; end if;
end $$;
