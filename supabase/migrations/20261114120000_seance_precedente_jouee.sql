-- ═══════════════════════════════════════════════════════════════════════════
--  « SUR LE SEMESTRE » : LA SÉANCE PRÉCÉDENTE EST LA DERNIÈRE JOUÉE (14/11)
--
--  eleves_a_suivre() mesurait les notions oubliées entre la séance du jour et
--  « numéro − 1 ». Depuis le 14/11, la séance 6 du BTS1 (atelier pipeline)
--  est reportée au semestre 2, pour les SLAM : la séance 7 suivra la 5, et
--  « numéro − 1 » désignerait une séance jamais jouée — l'indicateur des
--  notions perdues se serait tu sans rien dire.
--
--  Désormais : la séance précédente est la dernière DÉMARRÉE avant celle du
--  jour (numéro inférieur, hors questionnaires et appel). Même résultat
--  qu'avant tant que les séances se suivent ; juste quand l'une est sautée.
--  Le texte de l'alerte nomme la séance réellement comparée.
--
--  Seul changement par rapport à 20260925070000 : ces trois lignes.
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.eleves_a_suivre(p_classe_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_appel bigint; v_jours date[]; v_jouees bigint[]; v_res jsonb;
        v_der public.seances; v_prec bigint; v_prec_num int;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  select id into v_appel from public.seances where classe_id = p_classe_id and numero = 99;

  select coalesce(array_agg(j order by j desc), '{}') into v_jours from (
    select distinct substring(co.question from 7)::date as j
      from public.corriges co
     where co.seance_id = v_appel and co.question ~ '^appel-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and substring(co.question from 7)::date <= current_date
     order by 1 desc limit 3) t;

  -- Jouée = démarrée, et plus en cours : la séance de l'heure n'est pas encore
  -- « une séance sans réponse » pour qui n'a pas fini de lire l'acte I.
  select coalesce(array_agg(id order by demarree_le desc), '{}') into v_jouees from (
    select id, demarree_le from public.seances
     where classe_id = p_classe_id and numero < 90 and demarree_le is not null
       and (not ouverte or demarree_le::date < current_date)
     order by demarree_le desc limit 3) t;

  -- La dernière séance jouée, et celle qui la précède dans le calendrier du
  -- cours (numéro - 1). C'est entre les deux qu'on mesure ce qui s'est oublié.
  if cardinality(v_jouees) > 0 then
    select * into v_der from public.seances where id = v_jouees[1];
    select id, numero into v_prec, v_prec_num from public.seances
     where classe_id = p_classe_id and numero < v_der.numero and numero < 90
       and demarree_le is not null
     order by numero desc limit 1;
  end if;

  with el as (
    select e.id, e.numero, e.avatar from public.eleves e
     where e.classe_id = p_classe_id and e.numero <> '99'
  ),
  m as (
    select el.*,
      (select count(*) from unnest(v_jours) j
        where not exists (select 1 from public.reponses r
                           where r.eleve_id = el.id and r.seance_id = v_appel
                             and r.question = 'appel-' || to_char(j, 'YYYY-MM-DD')))::int as absences,
      (select count(*) from unnest(v_jouees) s
        where not exists (select 1 from public.reponses r
                           where r.eleve_id = el.id and r.seance_id = s)
          and not exists (select 1 from public.passages pa
                           where pa.eleve_id = el.id and pa.seance_id = s))::int         as muettes,
      (select count(*) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = any(v_jouees)
          and r.question ~ '^q[0-9]+$' and r.correct is not null)::int                  as evaluees,
      (select count(*) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = any(v_jouees)
          and r.question ~ '^q[0-9]+$' and r.correct)::int                              as justes,
      (select count(*) from public.reponses r
         join public.reponses c on c.eleve_id = r.eleve_id and c.seance_id = r.seance_id
                               and c.question = r.question || '-c'
        where r.eleve_id = el.id and r.seance_id = any(v_jouees)
          and r.question ~ '^pre-[0-9]+$' and r.correct is false and c.reponse = 'A')::int as sur_faux,
      -- Réussite de la dernière séance jouée, et des deux d'avant.
      (select count(*) filter (where r.correct) || '/' || count(*) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = v_jouees[1]
          and r.question ~ '^q[0-9]+$' and r.correct is not null)                        as der,
      (select count(*) filter (where r.correct) || '/' || count(*) from public.reponses r
        where r.eleve_id = el.id and r.seance_id = any(v_jouees[2:3])
          and r.question ~ '^q[0-9]+$' and r.correct is not null)                        as avant,
      -- Ce qui s'est oublié en une semaine. Convention des contrôles d'entrée :
      -- la notion pre-0K de la séance N+1 reprend le concept de rang K de la
      -- séance N. Une notion est « perdue » quand l'étudiant avait juste à
      -- TOUTES les questions du quiz qui mesurent ce concept, et se trompe à
      -- la notion correspondante du contrôle d'entrée suivant.
      (select count(*) from public.concepts k
        where v_prec is not null and k.seance_id = v_prec and cardinality(k.questions) > 0
          and not exists (select 1 from unnest(k.questions) qn
                           where not exists (select 1 from public.reponses r
                                              where r.eleve_id = el.id and r.seance_id = v_prec
                                                and r.question = 'q' || qn and r.correct))
          and exists (select 1 from public.reponses r
                       where r.eleve_id = el.id and r.seance_id = v_der.id
                         and r.question = 'pre-' || lpad(k.rang::text, 2, '0')
                         and r.correct is false))::int                                   as oublis
      from el
  ),
  r as (
    select m.*, array_remove(array[
      case when cardinality(v_jours) >= 2 and m.absences >= 2 then
        'Absent à ' || m.absences || ' des ' || cardinality(v_jours) || ' derniers appels' end,
      case when m.muettes >= 2 then
        m.muettes || ' des ' || cardinality(v_jouees) || ' dernières séances sans aucune réponse' end,
      case when m.evaluees >= 6 and m.justes * 100 < m.evaluees * 40 then
        round(m.justes * 100.0 / m.evaluees) || ' % de réussite au quiz sur les dernières séances' end,
      case when m.sur_faux >= 3 then
        'Sûr de lui et faux sur ' || m.sur_faux || ' notions de contrôle d''entrée' end,
      -- La baisse : au moins quatre réponses de chaque côté, et trente points
      -- de moins. Un étudiant qui passe de 90 à 60 % n'est pas en difficulté,
      -- mais il se passe quelque chose, et c'est le moment d'en parler.
      case when split_part(m.der, '/', 2)::int >= 4 and split_part(m.avant, '/', 2)::int >= 4
                and split_part(m.der, '/', 1)::int * 100 / split_part(m.der, '/', 2)::int + 30
                    <= split_part(m.avant, '/', 1)::int * 100 / split_part(m.avant, '/', 2)::int then
        'Réussite en baisse : ' ||
        (split_part(m.avant, '/', 1)::int * 100 / split_part(m.avant, '/', 2)::int) || ' % → ' ||
        (split_part(m.der, '/', 1)::int * 100 / split_part(m.der, '/', 2)::int) ||
        ' % à la dernière séance' end,
      case when m.oublis >= 2 then
        m.oublis || ' notions perdues en une semaine : justes au quiz de la séance ' ||
        v_prec_num || ', fausses au contrôle d''entrée de la ' || v_der.numero end
    ], null) as raisons
      from m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'eleve_id', r.id, 'numero', r.numero, 'avatar', r.avatar,
           'raisons', to_jsonb(r.raisons))
         order by cardinality(r.raisons) desc, r.numero)
         filter (where cardinality(r.raisons) > 0), '[]'::jsonb)
    into v_res from r;

  return jsonb_build_object('ok', true,
    'code', (select c.code from public.classes c where c.id = p_classe_id),
    'appels', cardinality(v_jours), 'seances', cardinality(v_jouees),
    'derniere', v_der.numero,
    'eleves', v_res);
end; $$;

grant execute on function public.eleves_a_suivre(bigint) to authenticated;
