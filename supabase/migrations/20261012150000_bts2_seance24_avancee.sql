-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — LA SÉANCE 24 EST AVANCÉE À LUNDI 12/10, AVEC UN NOUVEAU SUJET
--
--  Demandé le 12/10 à 14 h 20 : le premier projet IA est terminé ; cet
--  après-midi doit porter sur un autre thème. Choix de G : avancer la séance 24
--  (IA en ligne sans carte bancaire, comparée au modèle local), avec un sujet
--  DIFFÉRENT du premier et un nouveau dépôt. Le module « IA en entreprise »
--  commence mardi 13 (séance 25) et s'étale sur mardi, mercredi et jeudi.
--
--    • séance 24 : nouveau titre, échéance 12/10, missions 1, 3 et 4 réécrites
--      (aucune n'est cochée : la séance était fermée), OUVERTE et VISIBLE le
--      12/10 seulement — son questionnaire (95) s'ouvre avec elle ;
--    • séance 23 : refermée le 12/10 (rouverte ce matin par
--      20261012090000_bts2_projet_ia_bilan.sql pour un rendu qui n'a plus
--      lieu d'être) ; le questionnaire « bilan » (94) reste ouvert ;
--    • séance 25 : échéance au 14/10 inchangée, séance 26 au 15/10 inchangée.
--
--  Rejouable : les ouvertures et fermetures ne jouent que le 12/10 (heure de
--  Paris) ; les libellés ne sont réécrits que si personne n'a coché la mission.
-- ═══════════════════════════════════════════════════════════════════════════

update public.seances s
   set titre = 'À distance - Projet IA : un nouveau sujet, avec une IA en ligne sans carte bancaire',
       echeance = date '2026-10-12'
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS2-SLAM-2026' and s.numero = 24
   and (s.titre is distinct from 'À distance - Projet IA : un nouveau sujet, avec une IA en ligne sans carte bancaire'
        or s.echeance is distinct from date '2026-10-12');

update public.missions m
   set libelle = v.libelle
  from public.seances s
  join public.classes c on c.id = s.classe_id,
       (values
         (1, 'Nouveau sujet (autre que le premier), dépôt projet-ia-<prenom>-2, README §1 et §8'),
         (3, 'Application du nouveau sujet en ligne : consigne, 10 cas, /a-propos répond'),
         (4, 'Local contre en ligne : même jeu, mêmes réglages, tableau du §8, CSV poussés')
       ) as v(ordre, libelle)
 where m.seance_id = s.id and c.code = 'BTS2-SLAM-2026' and s.numero = 24
   and m.ordre = v.ordre and m.libelle is distinct from v.libelle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question = m.cle);

-- Ouvrir la 24, refermer la 23 : le 12/10 seulement.
update public.seances s
   set publiee = true, ouverte = true
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS2-SLAM-2026' and s.numero = 24
   and not (s.ouverte and s.publiee)
   and (now() at time zone 'Europe/Paris')::date = date '2026-10-12';

update public.seances s
   set ouverte = false
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS2-SLAM-2026' and s.numero = 23
   and s.ouverte
   and (now() at time zone 'Europe/Paris')::date = date '2026-10-12';

do $$
declare n int; v_c bigint;
begin
  select id into v_c from public.classes where code = 'BTS2-SLAM-2026';
  if v_c is null then
    raise notice 'séance 24 avancée : pas de classe BTS2-SLAM-2026, rien à vérifier.';
    return;
  end if;
  select count(*) into n from public.missions m join public.seances s on s.id = m.seance_id
   where s.classe_id = v_c and s.numero = 24;
  if n <> 6 then raise exception 'séance 24 : % mission(s), attendu 6', n; end if;
  select count(*) into n from public.seances
   where classe_id = v_c and numero = 24 and echeance = date '2026-10-12';
  if n <> 1 then raise exception 'séance 24 : échéance non avancée'; end if;
  raise notice 'Séance 24 avancée au 12/10.';
end $$;
