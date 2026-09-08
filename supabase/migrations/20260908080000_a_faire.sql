-- ═══════════════════════════════════════════════════════════════════════════
--  « À FAIRE » — ce qui bloque, calculé depuis la base
--
--  Une liste de tâches écrite à la main ment dès le lendemain : on coche, on
--  oublie de décocher, et au bout de trois semaines on ne la regarde plus.
--  Celle-ci est recalculée à chaque affichage à partir de l'état réel. Elle
--  ne peut pas être en retard, et rien n'y reste par oubli.
--
--  Trois niveaux, dans cet ordre à l'écran :
--    bloquant   quelque chose ne marchera pas en séance
--    attention  quelque chose marchera mal, ou ne dira rien
--    info       à savoir, sans geste à faire
--
--  Les constats viennent de défauts réellement rencontrés : une séance 99
--  fermée qui empêchait tout un BTS2 de pointer, une séance de cours sans
--  corrigé qui enregistrait sans jamais évaluer, une échéance vide qui rendait
--  l'indicateur de rythme muet.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.a_faire()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_res jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  with

  -- ── L'appel : une séance 99 fermée, et personne ne peut pointer ─────────
  appel_ferme as (
    select c.code, c.nom, 'bloquant' as gravite, 1 as rang,
           'Appel fermé' as quoi,
           'La séance 99 est fermée : aucun étudiant ne peut marquer sa présence.' as detail,
           'Suivi d''une séance → séance 99 → Démarrer la séance' as geste
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero = 99 and not s.ouverte
  ),

  -- ── Un cours ouvert sans corrigé enregistre sans jamais évaluer ─────────
  cours_sans_corrige as (
    select c.code, c.nom, 'bloquant', 2,
           'Séance ' || s.numero || ' ouverte sans corrigé',
           'Les réponses seront enregistrées mais jamais évaluées : ni réussite, ni répartition.',
           'Ajouter les corrigés de cette séance, ou refermer la séance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'cours' and s.ouverte and s.numero < 90
       and not exists (select 1 from public.corriges co where co.seance_id = s.id)
  ),

  -- ── Un étudiant sans code ne peut pas entrer ───────────────────────────
  sans_code as (
    select c.code, c.nom, 'bloquant', 3,
           count(*) || ' étudiant' || case when count(*) > 1 then 's' else '' end || ' sans code',
           'Ils ne pourront pas s''identifier au portail.',
           'Leur attribuer un code à quatre chiffres'
      from public.eleves e
      join public.classes c on c.id = e.classe_id
     where e.pin is null and e.numero <> '99'
     group by c.code, c.nom
  ),

  -- ── Un projet sans échéance ne dit rien du rythme ──────────────────────
  projet_sans_echeance as (
    select distinct c.code, c.nom, 'attention', 4,
           'Projet sans échéance',
           'Sans date de fin, « jours restants » et « en risque » restent vides : le rythme ne peut pas être jugé.',
           'Poser une échéance sur les séances de projet'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'projet' and s.echeance is null
  ),

  -- ── Un projet sans jalons calcule un pourcentage sur zéro ──────────────
  projet_sans_jalons as (
    select c.code, c.nom, 'attention', 5,
           'Séance ' || s.numero || ' sans jalons déclarés',
           'L''avancement se calculera sur l''étudiant le plus avancé, faute de repère.',
           'Déclarer le nombre de jalons de ce TP'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'projet' and coalesce(s.jalons, 0) = 0
  ),

  -- ── Une séance de cours oubliée ouverte ────────────────────────────────
  --  Bien après sa durée prévue : elle accepte encore des réponses depuis
  --  n'importe où, y compris de chez soi, le soir.
  cours_oublie as (
    select c.code, c.nom, 'attention', 6,
           'Séance ' || s.numero || ' encore ouverte',
           'Démarrée il y a ' ||
             floor(extract(epoch from (now() - s.demarree_le)) / 3600)::int ||
             ' h, bien au-delà de sa durée : elle accepte toujours des réponses.',
           'Clore la séance'
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.nature = 'cours' and s.ouverte and s.numero < 90
       and s.demarree_le is not null
       and now() - s.demarree_le > (coalesce(s.duree_min, 55) + 120) * interval '1 minute'
  ),

  -- ── Une classe sans projet n'ouvre sur rien ────────────────────────────
  sans_projet as (
    select c.code, c.nom, 'attention', 7,
           'Aucun projet associé',
           'Les étudiants s''identifient, puis ne trouvent aucun support à ouvrir.',
           'Ajouter au moins un lien de projet pour cette classe'
      from public.classes c
     where c.code not like 'DEMO%'
       and not exists (select 1 from public.projets p where p.classe_id = c.id)
  ),

  -- ── La question du jour : rien à faire, mais bon à savoir ──────────────
  appel_pas_pose as (
    select c.code, c.nom, 'info', 8,
           'Question du jour pas encore créée',
           'Elle se crée d''elle-même à la première connexion d''un étudiant.',
           ''
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero = 99 and s.ouverte
       and not exists (select 1 from public.corriges co
                        where co.seance_id = s.id
                          and co.question = 'appel-' || to_char(current_date, 'YYYY-MM-DD'))
  ),

  tout as (
    select * from appel_ferme
    union all select * from cours_sans_corrige
    union all select * from sans_code
    union all select * from projet_sans_echeance
    union all select * from projet_sans_jalons
    union all select * from cours_oublie
    union all select * from sans_projet
    union all select * from appel_pas_pose
  )

  select jsonb_build_object(
    'ok', true,
    'bloquants',  (select count(*) from tout where gravite = 'bloquant'),
    'attentions', (select count(*) from tout where gravite = 'attention'),
    'taches', coalesce((select jsonb_agg(jsonb_build_object(
                 'classe',  nom,
                 'code',    code,
                 'gravite', gravite,
                 'quoi',    quoi,
                 'detail',  detail,
                 'geste',   geste)
               order by rang, code) from tout), '[]'::jsonb))
  into v_res;

  return v_res;
end; $$;

grant execute on function public.a_faire() to authenticated;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
select a_faire()->'bloquants' as bloquants, a_faire()->'attentions' as attentions;
