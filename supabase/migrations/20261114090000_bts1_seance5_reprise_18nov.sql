-- ═══════════════════════════════════════════════════════════════════════════
--  BTS1 — LA SÉANCE 5 EST REPROGRAMMÉE LE MERCREDI 18/11, 12 h – 13 h (14/11)
--
--  Mercredi 04/11, 14 étudiants sur 31 n'ont rien pu enregistrer : 392
--  sessions anonymes ouvertes ce jour-là, dont 224 entre 12 h 30 et 12 h 35,
--  contre la limite Supabase par adresse IP (toute la salle sort par la même).
--  Correctif côté portail dans js/app.js ; la limite est à 500 par heure
--  (Authentication → Rate Limits, constaté le 14/11).
--
--  La séance 5 est rejouée le 18/11. Elle est refermée d'ici là, puis
--  l'automate (seances_a_l_heure, chaque minute) la rouvre à 12 h 00 heure de
--  Paris et relance le chrono (demarree_le = now()) ; il la referme à 13 h 15.
--  Les réponses déjà données restent : rien n'est effacé.
--
--  Rejouable sans risque : mêmes valeurs à chaque passage. Sur une base neuve,
--  la séance 5 existe déjà (20261103180000_bts1_seance5.sql).
-- ═══════════════════════════════════════════════════════════════════════════

update public.seances s
   set prevue_le   = timestamptz '2026-11-18 12:00:00 Europe/Paris',
       fin_prevue  = timestamptz '2026-11-18 13:00:00 Europe/Paris',
       auto_ouvrir = true,
       auto_clore  = true,
       ouverte     = case when now() < timestamptz '2026-11-18 12:00:00 Europe/Paris'
                          then false else s.ouverte end
  from public.classes c
 where c.id = s.classe_id
   and c.code = 'BTS1-DEV-2026'
   and s.numero = 5;
