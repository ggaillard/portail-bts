-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 6 DU BTS1 — l'ordre des étapes, tel que la page les pose
--
--  Produit par outils/seances/etapes.py depuis la trace (ancres tdc-ici et
--  fins d'actes). Lu par carte_parcours() pendant l'heure et par
--  analyse_seance() après. `controler.py fiche` vérifie que la base et la
--  page disent le même ordre.
--
--  Rejouable sans risque : aucune réponse n'est attachée à un rang.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if v_id is null then return; end if;
  delete from public.etapes_seance where seance_id = v_id;
  insert into public.etapes_seance (seance_id, rang, cle)
  select v_id, e.rang, e.cle from (values
    (1, 'q1'),
    (2, 'acte-1'),
    (3, 'q2'),
    (4, 'q3'),
    (5, 'q4'),
    (6, 'acte-2'),
    (7, 'q5'),
    (8, 'q6'),
    (9, 'acte-3'),
    (10, 'q7'),
    (11, 'q8'),
    (12, 'q9'),
    (13, 'acte-4'),
    (14, 'q10'),
    (15, 'acte-5')
  ) as e(rang, cle);
end $$;
