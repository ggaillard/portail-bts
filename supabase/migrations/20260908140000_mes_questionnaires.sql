-- ═══════════════════════════════════════════════════════════════════════════
--  CÔTÉ ÉTUDIANT — UNE SEULE FONCTION POUR TOUS LES QUESTIONNAIRES
--
--  connaissance() et stage() faisaient la même chose sur deux numéros écrits
--  en dur. Un troisième questionnaire aurait demandé une troisième fonction,
--  une troisième carte, un troisième chemin à tester.
--
--  mes_questionnaires() renvoie TOUS les questionnaires ouverts de la classe
--  de l'étudiant, dans l'ordre où ils lui ont été donnés, avec leur mode
--  d'affichage et ses propres réponses.
--
--  Les deux anciennes fonctions restent : le portail les appelle encore en
--  repli tant que cette migration n'est pas déployée partout. Elles ne sont
--  pas modifiées, donc rien de ce qui marche aujourd'hui ne peut casser.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.mes_questionnaires()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_eleve public.eleves;
  v_out   jsonb;
begin
  select * into v_eleve from public.eleves where auth_id = auth.uid() limit 1;
  if not found then return jsonb_build_object('ok', true, 'liste', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(x order by (x->>'numero')::int), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'seance_id', s.id,
               'numero',    s.numero,
               'titre',     coalesce(m.titre, s.titre),
               'intro',     m.intro,
               -- Sans modèle rattaché, on retombe sur « une question à la
               -- fois » : c'est le mode le plus sûr sur un téléphone.
               'mode',      coalesce(m.mode, 'sequentiel'),
               'total',     (select count(*) from public.corriges co
                              where co.seance_id = s.id),
               'faites',    (select count(*) from public.reponses r
                              where r.seance_id = s.id and r.eleve_id = v_eleve.id),
               'questions', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'question',   co.question,
                           'intitule',   coalesce(co.intitule, co.question),
                           'options',    to_jsonb(co.options),
                           'ma_reponse', r.reponse)
                         order by co.question)
                    from public.corriges co
                    left join public.reponses r
                           on r.eleve_id  = v_eleve.id
                          and r.seance_id = s.id
                          and r.question  = co.question
                   where co.seance_id = s.id), '[]'::jsonb)
             ) as x
        from public.seances s
        left join public.modeles m on m.id = s.modele_id
       where s.classe_id = v_eleve.classe_id
         and s.numero between 90 and 98
         and s.ouverte
         -- Une séance sans corrigé n'a rien à proposer : l'afficher vide
         -- ferait croire à une panne.
         and exists (select 1 from public.corriges co where co.seance_id = s.id)
    ) t;

  return jsonb_build_object('ok', true, 'liste', v_out);
end; $$;

grant execute on function public.mes_questionnaires() to anon, authenticated;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.seances
   where numero between 90 and 98 and nature <> 'questionnaire';
  if n > 0 then
    raise exception '% seance(s) de la bande 90-98 n''ont pas la nature questionnaire', n;
  end if;
  raise notice 'Bande 90-98 : toutes les seances sont des questionnaires.';
end $$;
