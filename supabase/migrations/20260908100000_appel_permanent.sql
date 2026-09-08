-- ═══════════════════════════════════════════════════════════════════════════
--  LA SÉANCE D'APPEL NE SE FERME PAS
--
--  Constat du 08/09 : un étudiant du BTS2 qui répondait à la question du jour
--  voyait « L'enregistrement n'a pas abouti ». Cause : la séance 99 du BTS2
--  était FERMÉE (close le 07/09 depuis le bouton « Clore la séance »), et
--  repondre() refuse toute réponse sur une séance fermée — « Seance fermee ».
--
--  Le défaut n'est pas le clic, c'est que le clic ait été possible. La séance
--  99 n'est pas une séance : c'est le registre d'appel, décrit dès APPEL.sql
--  comme « ouverte en permanence ». La fermer coupe le pointage ET la question
--  d'humeur de toute une classe, en silence, jusqu'à ce qu'un étudiant s'en
--  plaigne.
--
--  Pire : appel_du_jour() continue de FABRIQUER la question du jour même sur
--  une séance fermée. L'étudiant voit donc une question, y répond, et se fait
--  refuser. Rien dans l'écran ne dit pourquoi.
--
--  Trois verrous, du plus large au plus fin :
--    1. l'état est rétabli — toute séance 99 fermée est rouverte ;
--    2. un déclencheur l'empêche de se refermer, quelle que soit la voie
--       employée (portail, SQL Editor, script) ;
--    3. clore_seance() refuse explicitement, pour que l'enseignant ait un
--       motif lisible et non un bouton qui ne fait rien.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Rétablir l'état ────────────────────────────────────────────────────
update public.seances
   set ouverte = true
 where numero = 99
   and ouverte is distinct from true;

-- ─── 2. Le verrou de fond ──────────────────────────────────────────────────
--  Un déclencheur plutôt qu'une contrainte : une contrainte ferait échouer la
--  requête, ce qui casserait un update de masse légitime sur d'autres séances.
--  Ici on corrige la ligne au passage, et on n'ennuie personne.
create or replace function public.appel_reste_ouvert()
returns trigger language plpgsql as $$
begin
  if new.numero = 99 and new.ouverte is distinct from true then
    new.ouverte := true;
  end if;
  return new;
end; $$;

drop trigger if exists appel_reste_ouvert on public.seances;
create trigger appel_reste_ouvert
  before insert or update on public.seances
  for each row execute function public.appel_reste_ouvert();

-- ─── 3. Le refus lisible côté enseignant ───────────────────────────────────
--  Sans ce garde-fou, le bouton « Clore » annoncerait « Séance close » alors
--  que le déclencheur vient de rouvrir la séance : le pire des deux mondes,
--  un message qui ment.
create or replace function public.clore_seance(p_seance_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_numero int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  select numero into v_numero from public.seances where id = p_seance_id;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;

  -- Le registre d'appel reste ouvert toute l'année : le fermer couperait le
  -- pointage et l'humeur pour la classe entière.
  if v_numero = 99 then
    return jsonb_build_object('ok', false, 'motif', 'appel');
  end if;

  -- On ferme aux réponses mais on garde demarree_le : la trace de l'heure
  -- de début reste lisible après coup.
  update public.seances set ouverte = false where id = p_seance_id;
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.clore_seance(bigint) to authenticated;

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
do $$
declare v_fermees int;
begin
  select count(*) into v_fermees
    from public.seances where numero = 99 and ouverte is distinct from true;
  if v_fermees > 0 then
    raise exception 'Il reste % seance(s) d''appel fermee(s) apres correction.', v_fermees;
  end if;
  raise notice 'Appel : toutes les seances 99 sont ouvertes.';
end $$;
