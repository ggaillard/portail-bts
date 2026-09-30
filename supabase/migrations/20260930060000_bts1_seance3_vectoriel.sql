-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 3 DU BTS1 — la base vectorielle entre dans « 60, 47, 72 » (30/09)
--
--  Un acte IV « La base qui cherche par le sens » est ajouté à la trace
--  (embedding, recherche par similarité, pgvector, RAG) : l'assistant de Léa
--  retrouve le rapport sans en connaître les mots, et répète le 47 de
--  l'entrepôt — un chiffre d'IA se lit lui aussi avec sa date et sa source.
--
--  Une seule question du quiz change : la 9 (le marécage) devient la question
--  sur la base vectorielle. Les neuf autres ne bougent pas.
--
--  Bonnes réponses : C A D B C B D A D B — deux A, trois B, deux C, trois D.
--
--  La séance 3 n'a pas encore été jouée. Une migration appliquée ne se
--  réécrit pas : on met à jour ici, et l'écriture REFUSE de toucher à un quiz
--  auquel un étudiant aurait déjà répondu (règle du 16/09).
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

with q (numero, cle, bonne, intitule, options, explication) as (values

  (3, 'q9', 'D',
   'À quelle question une base de données vectorielle sert-elle d''abord à répondre ?',
   array['« quelle ligne porte exactement cet identifiant ? »', '« quelles tables faut-il relier par une jointure ? »', '« quel chiffre a été recalculé dimanche soir ? »', '« quels textes ressemblent le plus à celui-ci ? »'],
   'Un modèle change chaque texte en vecteur ; la base classe les vecteurs du plus proche au plus lointain. Elle cherche ce qui ressemble, pas ce qui est égal.')

)
update public.corriges co
   set bonne_reponse = q.bonne, intitule = q.intitule,
       options = q.options, explication = q.explication
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = q.numero
   and co.seance_id = s.id and co.question = q.cle
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question ~ '^q[0-9]+$');

do $$
declare n int; v_rep int;
begin
  if not exists (select 1 from public.seances s join public.classes c on c.id = s.classe_id
                  where c.code = 'BTS1-DEV-2026' and s.numero = 3) then
    raise notice 'Pas de séance 3 BTS1 : rien à faire.';
    return;
  end if;
  select count(*) into v_rep from public.reponses r
    join public.seances s on s.id = r.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3 and r.question ~ '^q[0-9]+$';
  if v_rep > 0 then
    raise notice 'Séance 3 : % réponse(s) au quiz, la question 9 n''a PAS été réécrite.', v_rep;
    return;
  end if;
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3
     and co.question = 'q9' and co.intitule like '%vectorielle%'
     and co.bonne_reponse = 'D';
  if n <> 1 then
    raise exception 'séance 3 : la question 9 n''a pas été réécrite';
  end if;
end $$;
