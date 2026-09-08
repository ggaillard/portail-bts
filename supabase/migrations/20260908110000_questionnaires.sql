-- ═══════════════════════════════════════════════════════════════════════════
--  LES QUESTIONNAIRES S'ACTIVENT DEPUIS LE PORTAIL
--
--  « Faisons connaissance » (séance 98) et « Recherche de stage » (séance 97)
--  ne s'affichaient chez l'étudiant que si leur séance était ouverte — un état
--  vrai, utile, et parfaitement invisible depuis le portail. Pour savoir si un
--  questionnaire était actif, il fallait ouvrir le SQL Editor. La veille d'une
--  rentrée, ce n'est pas un endroit où l'on veut aller.
--
--  Deux fonctions, rien de plus :
--    · questionnaires()          — ce qui existe, ouvert ou non, et où en est
--                                  la classe (inscrits, terminés) ;
--    · ouvrir_questionnaire()    — l'interrupteur, réservé à l'enseignant.
--
--  Le mécanisme sous-jacent ne change pas : connaissance() et stage() filtrent
--  toujours sur `ouverte`. On ne fait qu'exposer et nommer ce qui existait.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Ce que l'enseignant doit voir ──────────────────────────────────────
--  Une ligne par classe et par questionnaire réellement créé. Une classe sans
--  séance 97 ni 98 n'apparaît pas : on ne propose pas d'allumer ce qui
--  n'existe pas.
--
--  « termines » compte les étudiants qui ont répondu à TOUTES les questions,
--  et exclut le compte d'essai n° 99 — le même filtre que partout ailleurs,
--  sinon deux écrans donnent deux nombres pour la même classe.
create or replace function public.questionnaires()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;

  with q as (
    select s.id, s.classe_id, s.numero, s.ouverte,
           c.code, c.nom,
           (select count(*) from public.corriges co where co.seance_id = s.id) as questions,
           (select count(*) from public.eleves e
             where e.classe_id = s.classe_id and e.numero <> '99')            as inscrits
      from public.seances s
      join public.classes c on c.id = s.classe_id
     where s.numero in (97, 98)
       and c.code not like 'DEMO%'
  ),
  faits as (
    select q.id as seance_id, r.eleve_id, count(distinct r.question) as faites
      from q
      join public.reponses r on r.seance_id = q.id
      join public.eleves   e on e.id = r.eleve_id and e.numero <> '99'
     group by q.id, r.eleve_id
  )
  select jsonb_agg(x order by x->>'code', (x->>'numero')::int) into v
    from (
      select jsonb_build_object(
               'classe_id', q.classe_id,
               'code',      q.code,
               'nom',       q.nom,
               'numero',    q.numero,
               'titre',     case q.numero when 98 then 'Faisons connaissance'
                                          when 97 then 'Recherche de stage' end,
               'ouvert',    q.ouverte,
               'questions', q.questions,
               'inscrits',  q.inscrits,
               'commences', (select count(*) from faits f where f.seance_id = q.id),
               'termines',  (select count(*) from faits f
                              where f.seance_id = q.id and f.faites >= q.questions)
             ) as x
        from q
    ) t;

  return jsonb_build_object('ok', true, 'lignes', coalesce(v, '[]'::jsonb));
end; $$;

-- ─── 2. L'interrupteur ─────────────────────────────────────────────────────
--  Volontairement limité aux numéros 97 et 98. Une séance de cours se pilote
--  avec demarrer_seance() / clore_seance(), qui portent le chrono ; un
--  questionnaire n'a pas de chrono, et la séance 99 ne se ferme pas du tout.
--  Trois gestes distincts pour trois natures distinctes : mélanger les trois
--  dans une fonction unique ferait qu'un jour l'un fermerait l'autre.
create or replace function public.ouvrir_questionnaire(
  p_classe_id bigint, p_numero int, p_ouvert boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.est_enseignant() then
    return jsonb_build_object('ok', false, 'motif', 'refus');
  end if;
  if p_numero not in (97, 98) then
    return jsonb_build_object('ok', false, 'motif', 'numero');
  end if;

  select id into v_id from public.seances
   where classe_id = p_classe_id and numero = p_numero;
  if not found then
    return jsonb_build_object('ok', false, 'motif', 'inconnue');
  end if;

  update public.seances set ouverte = p_ouvert where id = v_id;
  return jsonb_build_object('ok', true, 'ouvert', p_ouvert);
end; $$;

grant execute on function public.questionnaires()                        to authenticated;
grant execute on function public.ouvrir_questionnaire(bigint, int, boolean) to authenticated;

-- ─── 3. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select jsonb_array_length(public.questionnaires()->'lignes') into n;
  raise notice 'questionnaires() : % ligne(s).', n;
end $$;
