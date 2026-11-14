-- ═══════════════════════════════════════════════════════════════════════════
--  BTS1 — LA SÉANCE 6 (ATELIER PIPELINE) EST REPORTÉE AU SEMESTRE 2 (14/11)
--
--  Décision de G. : semaines réduites, et une classe qui mêle SISR et SLAM.
--  L'atelier « Rouge, puis vert » sera fait au semestre 2, pour les SLAM
--  seulement. Au semestre 1, la séance 7 suit directement la 5.
--
--  Pourquoi la renuméroter (6 → 66) plutôt que la laisser en place : le
--  portail tient pour « prochaine séance » la plus petite séance de cours
--  jamais démarrée (a_faire : contrôle d'entrée éteint, contrôle trop tôt).
--  Une séance 6 jamais jouée y resterait coincée : « À faire » proposerait
--  son contrôle au lieu de celui de la 7, et signalerait comme prématuré
--  le contrôle de la 7. Numérotée 66, elle passe après la séance 14, et rien
--  du semestre 1 ne la voit. Elle reste en base, vide et cachée.
--
--  Le contenu (trace, questions, migrations) attend dans
--  outils/seances/seance06/en-attente-S2/, hors de la chaîne.
--
--  Garde : on ne renumérote que si personne n'y a jamais répondu et qu'elle
--  n'a jamais été démarrée. Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

update public.seances s
   set numero      = 66,
       titre       = 'Atelier mini-pipeline — reporté au semestre 2 (SLAM)',
       prevue_le   = null,
       fin_prevue  = null,
       auto_ouvrir = false,
       auto_clore  = false,
       publiee     = false,
       ouverte     = false
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 6
   and s.demarree_le is null
   and not exists (select 1 from public.reponses r where r.seance_id = s.id)
   and not exists (select 1 from public.seances x
                    where x.classe_id = s.classe_id and x.numero = 66);

do $$
declare n int;
begin
  select count(*) into n from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if n > 0 then
    raise notice 'Séance 6 du BTS1 toujours numérotée 6 (déjà jouée ou déjà répondue) : rien n''est renuméroté.';
  end if;
end $$;
