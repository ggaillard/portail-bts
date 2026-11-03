-- ═══════════════════════════════════════════════════════════════════════════
--  ESPACE ÉTUDIANT — « EN CE MOMENT » (03/11/2026)
--
--  L'espace étudiant devenait trop long : chaque séance publiée y posait sa
--  carte de missions, module après module (BiblioTech, Supervision…), et la
--  séance du jour se cherchait au milieu de quarante cases.
--
--  La page n'affiche plus en clair que la séance DU MOMENT — ouverte, ou
--  prévue aujourd'hui — et range les autres sous leur module, repliées. Pour
--  cela, mes_missions() rend en plus, pour chaque séance :
--
--    · module_id  — pour la ranger sous son module ;
--    · prevue_le  — pour reconnaître la séance du jour, ou la prochaine ;
--    · fin_prevue — pour le dire.
--
--  Même signature, mêmes clés qu'avant : une page qui ne connaît pas les
--  nouvelles les ignore, et la page neuve se replie sur `ouverte` seule tant
--  que cette migration n'est pas passée.
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
         and s.publiee
         and exists (select 1 from public.missions m where m.seance_id = s.id)
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

grant execute on function public.mes_missions() to anon, authenticated;
