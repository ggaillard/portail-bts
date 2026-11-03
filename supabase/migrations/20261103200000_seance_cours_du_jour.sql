-- ═══════════════════════════════════════════════════════════════════════════
--  LA SÉANCE DE COURS DU JOUR APPARAÎT DANS « EN CE MOMENT » (03/11, soir)
--
--  Constat, compte d'essai BTS1 n° 99, veille de la séance 5 : la partie
--  « En ce moment » de l'espace étudiant disait « Aucune séance ouverte pour
--  l'instant », et rien plus bas. CAUSE : mes_missions() ne rendait que les
--  séances qui ont des MISSIONS — les séances de projet du BTS2. Une séance
--  de cours (tout le BTS1) n'y figurait jamais : la séance du jour ne se
--  voyait nulle part dans l'espace étudiant.
--
--  mes_missions() rend désormais AUSSI les séances de cours sans missions,
--  dès qu'elles sont ouvertes ou prévues aujourd'hui (heure de Paris) ;
--  `missions` y vaut null et `nature` dit laquelle des deux on lit. Le portail
--  en fait une carte « Séance du jour » (js/missions.js, carteCours).
--  Les séances de projet ne changent pas : même filtre qu'avant.
--
--  Ferme aussi le contrôle d'entrée de la séance 4 du BTS1, resté proposé
--  aux étudiants trois semaines après la séance : il passait AVANT la séance
--  du jour, en tête de l'espace étudiant.
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
               -- une séance de COURS : ouverte, ou prévue aujourd'hui (heure de Paris)
            or (coalesce(s.nature, 'cours') = 'cours'
                and not exists (select 1 from public.missions m where m.seance_id = s.id)
                and (s.ouverte
                     or (s.prevue_le at time zone 'Europe/Paris')::date
                        = (now() at time zone 'Europe/Paris')::date))
         )
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

grant execute on function public.mes_missions() to anon, authenticated;

update public.seances s set controle_ouvert = false
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026'
   and s.numero = 4 and s.demarree_le is not null and s.controle_ouvert;
