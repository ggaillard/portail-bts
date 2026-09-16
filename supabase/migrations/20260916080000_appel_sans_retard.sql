-- ═══════════════════════════════════════════════════════════════════════════
--  L'APPEL NE DEMANDE PLUS SI L'ON EST EN RETARD
--
--  La question de repli proposait quatre réponses :
--
--      Présent · Présent, en retard · Présent, à distance · Présent, sur un
--      autre poste
--
--  « Présent, en retard » part. Deux raisons, et la seconde est la vraie :
--
--    1. Elle ne sert à rien ici. L'appel enregistre `updated_at` : l'heure
--       d'arrivée est déjà dans la base, à la minute près, et la carte
--       l'affiche — « 25 arrivées — de 08:10 à 08:34 ». Demander à quelqu'un
--       de déclarer un retard que le système horodate déjà, c'est lui faire
--       saisir une donnée qu'on possède.
--    2. Elle fait déclarer une faute. Les trois autres options nomment un
--       lieu ; celle-ci nomme un manquement. Répondre à l'appel devient un
--       aveu, et la première chose que l'étudiant fait de son heure est de se
--       ranger du mauvais côté. L'heure d'arrivée, elle, ne juge pas — elle
--       constate, et c'est à l'enseignant d'en faire quelque chose.
--
--  **Ce qui n'est pas touché : les questions déjà répondues.** Retirer une
--  option d'une question à laquelle des étudiants ont répondu décalerait les
--  lettres — un « C » qui voulait dire « à distance » se relirait « sur un
--  autre poste » — et réécrirait après coup ce qu'ils ont dit. On ne corrige
--  que le modèle et les questions encore vierges ; les jours passés gardent
--  leur formulation, avec leurs réponses intactes.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_neuf   text[] := array['Présent', 'Présent, à distance', 'Présent, sur un autre poste'];
  v_modele int;
  v_datees int;
  v_gelees int;
begin
  -- ─── 1. Le modèle, celui dont toutes les questions futures sont tirées ───
  --  appel_du_jour() recopie ce corrigé chaque matin pour fabriquer la
  --  question du jour. Le corriger ici suffit à corriger tous les jours à
  --  venir, sans toucher à la fonction.
  update public.corriges co
     set options = v_neuf
    from public.seances s
   where s.id = co.seance_id
     and s.numero = 99
     and co.question = 'appel-modele'
     and co.options is distinct from v_neuf;
  get diagnostics v_modele = row_count;

  -- ─── 2. Les questions datées encore vierges ──────────────────────────────
  --  Celle d'aujourd'hui a pu être créée avant cette migration, par le premier
  --  étudiant connecté. Tant que personne n'y a répondu, la réécrire ne coûte
  --  rien.
  update public.corriges co
     set options = v_neuf
    from public.seances s
   where s.id = co.seance_id
     and s.numero = 99
     and co.question like 'appel-20%'
     and co.options is distinct from v_neuf
     and not exists (select 1 from public.reponses r
                      where r.seance_id = co.seance_id
                        and r.question  = co.question);
  get diagnostics v_datees = row_count;

  -- ─── 3. Ce qui reste tel quel, et c'est voulu ────────────────────────────
  select count(*) into v_gelees
    from public.corriges co
    join public.seances s on s.id = co.seance_id
   where s.numero = 99
     and co.question like 'appel-20%'
     and 'Présent, en retard' = any(co.options)
     and exists (select 1 from public.reponses r
                  where r.seance_id = co.seance_id
                    and r.question  = co.question);

  raise notice 'Appel : % modèle(s) et % question(s) du jour corrigés. '
               '% question(s) passée(s) gardent leurs quatre options — elles '
               'ont des réponses, les décaler les réécrirait.',
               v_modele, v_datees, v_gelees;
end $$;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  select count(*) into v_n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
   where s.numero = 99 and co.question = 'appel-modele'
     and 'Présent, en retard' = any(co.options);
  if v_n > 0 then
    raise exception '% modèle(s) d''appel proposent encore « en retard »', v_n;
  end if;

  -- Le modèle doit garder sa première option : `bonne_reponse` vaut 'A', et
  -- une liste vide ou décalée ferait un appel auquel on ne peut pas répondre.
  select count(*) into v_n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
   where s.numero = 99 and co.question = 'appel-modele'
     and (co.options is null or co.options[1] is distinct from 'Présent');
  if v_n > 0 then
    raise exception '% modèle(s) d''appel n''ont plus « Présent » en A', v_n;
  end if;

  raise notice 'L''appel propose trois lieux et aucun aveu.';
end $$;
