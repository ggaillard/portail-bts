-- ═══════════════════════════════════════════════════════════════════════════
--  ACTIVER « Réviser la séance 2 » POUR LE BTS1 — 30/09, à la demande
--
--  Le questionnaire posé par 20260930070000 était fermé et rattaché à rien.
--  Demande de l'enseignant, le jour de la séance 3 : l'activer. Deux gestes,
--  les mêmes que ceux du portail :
--    · le RATTACHER à la séance 3 (il apparaît dans « Questionnaires de la
--      séance » de l'écran du direct, et suit désormais la séance 3) ;
--    · le PROPOSER tout de suite (ouverte = vrai) : les étudiants le voient.
--
--  On l'éteint ensuite depuis le portail (« Éteindre ») : cette migration ne
--  repasse pas sur la base de production, et sur une base neuve elle ne
--  touche qu'une séance qui n'est encore rattachée à rien.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_q bigint; v_s3 bigint;
begin
  select s.id into v_q from public.seances s
    join public.modeles m on m.id = s.modele_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and m.cle = 'revision-seance-' || (
         select x.id from public.seances x where x.classe_id = c.id and x.numero = 2);
  select s.id into v_s3 from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3;
  if v_q is null or v_s3 is null then
    raise notice 'Révision de la séance 2 ou séance 3 absente : rien à activer.';
    return;
  end if;
  update public.seances set rattachee_a = v_s3, ouverte = true
   where id = v_q and rattachee_a is null;
  raise notice 'Révision de la séance 2 : rattachée à la séance 3 et proposée.';
end $$;
