-- ═══════════════════════════════════════════════════════════════════════════
--  LA PROCHAINE SÉANCE DE COURS S'ANNONCE DÈS LA VEILLE (03/11, soir)
--
--  20261103200000 ne rendait une séance de cours que le JOUR où elle est
--  prévue. La veille au soir, l'espace étudiant du BTS1 restait donc vide.
--  On élargit à la semaine qui vient : moment.js l'annonce alors comme
--  « Prochaine séance : mercredi 4 novembre », avec sa carte, et la place en
--  « En ce moment » le jour même. Le bouton « Ouvrir la séance » n'apparaît
--  toujours qu'une fois la séance ouverte.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.mes_missions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_eleve public.eleves; v_out jsonb;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', true, 'liste', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(x order by (x->>'numero')::int), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'seance_id',  s.id,
               'numero',     s.numero,
               'titre',      s.titre,
               'ouverte',    s.ouverte,
               'echeance',   s.echeance,
               'module_id',  s.module_id,
               'prevue_le',  s.prevue_le,
               'fin_prevue', s.fin_prevue,
               'nature',     s.nature,
               'missions',  (
                  select jsonb_agg(jsonb_build_object(
                           'cle',     m.cle,
                           'ordre',   m.ordre,
                           'libelle', m.libelle,
                           'niveau',  m.niveau,
                           'verbe',   m.verbe,
                           'fait',    r.id is not null,
                           'le',      r.updated_at)
                         order by m.ordre)
                    from public.missions m
                    left join public.reponses r
                           on r.eleve_id  = v_eleve.id
                          and r.seance_id = s.id
                          and r.question  = m.cle
                          and r.reponse   in ('true', 'ok')
                   where m.seance_id = s.id)
             ) as x
        from public.seances s
       where s.classe_id = v_eleve.classe_id
         and s.numero < 90
         and (
               -- une séance de projet : publiée, avec ses missions (comme avant)
               (s.publiee and exists (select 1 from public.missions m where m.seance_id = s.id))
               -- une séance de COURS : ouverte, ou prévue d'aujourd'hui à J+7 (heure de Paris)
            or (coalesce(s.nature, 'cours') = 'cours'
                and not exists (select 1 from public.missions m where m.seance_id = s.id)
                and (s.ouverte
                     or (s.prevue_le at time zone 'Europe/Paris')::date
                        between (now() at time zone 'Europe/Paris')::date
                            and (now() at time zone 'Europe/Paris')::date + 7))
         )
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

grant execute on function public.mes_missions() to anon, authenticated;
