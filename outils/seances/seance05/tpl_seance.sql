-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — « Mardi, 14 h 02 »
--
--  Titre de récit, dix corrigés, et le contrôle d'entrée qui précède la
--  séance (cinq notions de la séance 4, chacune doublée de sa certitude).
--
--  Produit par outils/seances/seance05/generer.py : ne pas retoucher à la
--  main, changer la liste Python et relancer.
--
--  Écrit AVEC les accents : depuis le 18/09, c'est la règle — les textes de ce
--  fichier sont ce que trente étudiants lisent sur leur téléphone.
--
--  Les blocs 2 et 3 ne sont pas saisis à la main : ils sont produits par la
--  même liste Python, ce qui rend l'écart qui a touché la séance 3 (sept
--  questions sur dix différentes entre l'insert et le rattrapage) impossible
--  par construction. `coherence` le vérifie quand même.
--
--  Bonnes réponses : @@LETTRES@@ — @@REPARTITION@@.
--
--  Depuis la séance 5, la grille des réponses n'est PLUS dans la trace
--  écrite (dépôt public) : c'est ce fichier, et lui seul, qui fait foi pour
--  la bonne lettre. `controler.py` lit la grille ici quand la page n'en a pas.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
update public.seances s
   set titre = 'Séance 5 - Mardi, 14 h 02 : tester et livrer sans s''en souvenir'
  from public.classes c
 where c.id = s.classe_id
   and c.code = 'BTS1-DEV-2026'
   and s.numero = 5
   and s.titre not like 'Séance 5 - Mardi%';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values

@@INSERT@@

)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── 3. Rattraper un corrigé présent mais vide ─────────────────────────────
update public.corriges co
   set intitule      = q.intitule,
       options       = q.options,
       explication   = q.explication,
       bonne_reponse = q.bonne
  from (values
@@RATTRAPAGE@@
       ) as q(cle, bonne, intitule, options, explication),
       public.classes c,
       public.seances s
 where c.code = 'BTS1-DEV-2026'
   and s.classe_id = c.id
   and s.numero = 5
   and co.seance_id = s.id
   and co.question = q.cle
   and co.intitule is null;

-- ─── 4. Le contrôle d'entrée — ce qu'il reste de la séance 4 ───────────────
--  Les cinq concepts de « Ça marche sur mon poste », une question chacun, plus la question
--  de certitude posée dans les mêmes termes partout. Écrit par insert et non
--  par `creer_controle()`, qui exige `est_enseignant()` — ce qu'une migration
--  n'est pas. Créé FERMÉ : on l'ouvre depuis le portail le jour J.
--  Refuse d'écraser un contrôle auquel quelqu'un a déjà répondu.
do $$
declare v_seance bigint; v_deja int;
begin
  select s.id into v_seance
    from public.seances s join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_seance is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 5 en base';
  end if;

  select count(*) into v_deja from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';
  if v_deja > 0 then
    raise notice 'Contrôle de la séance 5 : % réponse(s) déjà données, rien n''est réécrit.', v_deja;
    return;
  end if;

  delete from public.corriges where seance_id = v_seance and question like 'pre-%';

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

@@PRE@@

    ) as q(cle, bonne, intitule, options, explication);

  insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris',
               'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, @@NPRE@@) as i;
end $$;

-- ─── 5. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int; v_titre text;
begin
  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5
     and co.question not like 'pre-%';
  if n <> 10 then raise exception 'séance 5 : % corrigés de quiz, attendu 10', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5
     and co.question not like 'pre-%'
     and (co.intitule is null or co.options is null or array_length(co.options, 1) <> 4);
  if n > 0 then raise exception '% corrigé(s) de la séance 5 sans intitulé ou sans 4 options', n; end if;

  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = 5 and co.question not like 'pre-%'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une même lettre est bonne % fois sur 10 : motif repérable', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5
     and co.question ~ '^pre-[0-9]+$';
  -- Pas d'exception ici : un contrôle déjà répondu est conservé tel quel,
  -- quel que soit son nombre de notions. Un état normal ne doit pas rendre
  -- la chaîne rouge.

  select s.titre into v_titre from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  raise notice 'Séance 5 : 10 corrigés, % notions de contrôle, titre « % ».', n, v_titre;
end $$;
