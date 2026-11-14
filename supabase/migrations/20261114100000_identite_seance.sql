-- ═══════════════════════════════════════════════════════════════════════════
--  VÉRIFIER L'IDENTITÉ À UNE SÉANCE — NOM ET PRÉNOM, EFFACÉS À LA CLÔTURE (14/11)
--
--  Demande de G. pour la reprise de la séance 5 du BTS1 (18/11) : être sûr,
--  exceptionnellement, que chaque compte est tenu par son titulaire. Choix
--  retenu : à la connexion, l'étudiant tape son nom et son prénom ; l'écran
--  de l'enseignant les compare à SA liste numéro → nom, qui reste dans son
--  navigateur ; les saisies sont effacées à la clôture de la séance.
--
--  La règle « la table eleves ne contient ni nom ni prénom » tient : les
--  saisies vivent dans une table à part, sans lecture directe possible
--  (RLS sans politique, droits retirés), et elles disparaissent :
--    - à la clôture de la séance (déclencheur sur seances.ouverte) ;
--    - au plus tard 24 h après la saisie, à chaque appel des fonctions
--      ci-dessous — filet si la séance n'est jamais close.
--
--  Une séance l'exige quand `seances.identite_exigee` est vrai. La séance
--  concernée est celle de la classe qui l'exige ET qui est ouverte ou prévue
--  aujourd'hui (heure de Paris).
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.seances add column if not exists identite_exigee boolean not null default false;

create table if not exists public.identites_seance (
  seance_id bigint not null references public.seances(id) on delete cascade,
  eleve_id  bigint not null references public.eleves(id)  on delete cascade,
  saisie    text   not null check (char_length(saisie) between 3 and 80),
  saisies   int    not null default 1,
  saisi_le  timestamptz not null default now(),
  primary key (seance_id, eleve_id)
);
alter table public.identites_seance enable row level security;
revoke all on table public.identites_seance from public, anon, authenticated;

-- La séance de la classe qui exige l'identité aujourd'hui, ou null.
create or replace function public.seance_identite(p_classe_id bigint)
returns bigint language sql stable security definer set search_path = public as $$
  select s.id from public.seances s
   where s.classe_id = p_classe_id and s.identite_exigee and s.numero < 90
     and (s.ouverte or (s.prevue_le at time zone 'Europe/Paris')::date
                        = (now() at time zone 'Europe/Paris')::date)
   order by s.ouverte desc, s.prevue_le desc nulls last
   limit 1;
$$;
revoke all on function public.seance_identite(bigint) from public, anon, authenticated;

create or replace function public.purger_identites_perimees()
returns void language sql security definer set search_path = public as $$
  delete from public.identites_seance where saisi_le < now() - interval '24 hours';
$$;
revoke all on function public.purger_identites_perimees() from public, anon, authenticated;

-- Côté étudiant : faut-il déclarer son identité, et l'a-t-on déjà fait ?
create or replace function public.identite_requise()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e public.eleves; v_s bigint;
begin
  perform public.purger_identites_perimees();
  select * into v_e from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('requise', false); end if;
  v_s := public.seance_identite(v_e.classe_id);
  if v_s is null then return jsonb_build_object('requise', false); end if;
  return jsonb_build_object('requise', true, 'seance_id', v_s,
    'faite', exists (select 1 from public.identites_seance i
                      where i.seance_id = v_s and i.eleve_id = v_e.id));
end; $$;
grant execute on function public.identite_requise() to authenticated;

create or replace function public.declarer_identite(p_saisie text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e public.eleves; v_s bigint; v_t text;
begin
  v_t := btrim(regexp_replace(coalesce(p_saisie, ''), '\s+', ' ', 'g'));
  if char_length(v_t) < 3 or v_t !~ ' ' then
    return jsonb_build_object('ok', false, 'motif', 'Écrivez votre nom ET votre prénom.');
  end if;
  if char_length(v_t) > 80 then v_t := left(v_t, 80); end if;
  select * into v_e from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', false, 'motif', 'Connectez-vous d''abord.'); end if;
  v_s := public.seance_identite(v_e.classe_id);
  if v_s is null then return jsonb_build_object('ok', true, 'requise', false); end if;
  insert into public.identites_seance (seance_id, eleve_id, saisie)
  values (v_s, v_e.id, v_t)
  on conflict (seance_id, eleve_id) do update
     set saisie = excluded.saisie,
         saisies = public.identites_seance.saisies + 1,
         saisi_le = now();
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.declarer_identite(text) to authenticated;

-- Côté enseignant : chaque numéro de la classe, et ce qu'il a déclaré.
create or replace function public.identites_classe(p_classe_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s public.seances;
begin
  if not public.est_enseignant() then return jsonb_build_object('ok', false, 'motif', 'refus'); end if;
  perform public.purger_identites_perimees();
  select * into v_s from public.seances where id = public.seance_identite(p_classe_id);
  if not found then return jsonb_build_object('ok', true, 'seance', null); end if;
  return jsonb_build_object('ok', true,
    'seance', jsonb_build_object('id', v_s.id, 'numero', v_s.numero, 'titre', v_s.titre),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', e.numero, 'saisie', i.saisie, 'saisies', i.saisies,
               'heure', to_char(i.saisi_le at time zone 'Europe/Paris', 'HH24:MI'))
             order by e.numero)
        from public.eleves e
        left join public.identites_seance i on i.eleve_id = e.id and i.seance_id = v_s.id
       where e.classe_id = p_classe_id and e.numero <> '99'), '[]'::jsonb));
end; $$;
grant execute on function public.identites_classe(bigint) to authenticated;

-- À la clôture, on efface.
create or replace function public.effacer_identites_a_la_cloture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.ouverte and not new.ouverte then
    delete from public.identites_seance where seance_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists t_effacer_identites on public.seances;
create trigger t_effacer_identites after update of ouverte on public.seances
  for each row execute function public.effacer_identites_a_la_cloture();

-- La reprise de la séance 5 du BTS1, le 18/11, l'exige.
update public.seances s set identite_exigee = true
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 5;
