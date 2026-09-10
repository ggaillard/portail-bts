-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 3 DU BTS1 — « 60, 47, 72 »
--
--  Titre de récit et dix corrigés. Sans corrigé, les réponses des étudiants
--  sont enregistrées mais jamais évaluées, et le tableau de bord reste vide :
--  c'est le défaut qui avait vidé les séances 1 et 2 avant le 07/09.
--
--  **Les options sont recopiées de la page rendue**, pas ressaisies : elles ont
--  été extraites par le composant de suivi lui-même, celui qui les lira en
--  séance. La règle du dépôt tient : la page fait foi pour l'ordre des options,
--  la base fait foi pour la bonne réponse. Permuter une option dans le support
--  oblige à changer bonne_reponse ici — l'un ne se déduit pas de l'autre, et le
--  contrôle de cohérence du workflow compare les deux.
--
--  Les intitulés, eux, sont écrits en clair : interrogatifs, lisibles seuls à
--  la projection au tableau, là où la page n'est pas affichée.
--
--  Bonnes réponses : C A D B C B D A C B — deux A, trois B, trois C, deux D.
--  Une classe repère très vite un motif.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le titre de récit ──────────────────────────────────────────────────
--  La séance existe déjà, créée avec un titre de calendrier par la migration
--  des séances 3 à 14. On lui donne son titre de récit, comme les deux
--  premières.
update public.seances s
   set titre = 'Seance 3 - 60, 47, 72 : ou vit la donnee'
  from public.classes c
 where c.id = s.classe_id
   and c.code = 'BTS1-DEV-2026'
   and s.numero = 3
   and s.titre not like 'Seance 3 - 60%';

-- ─── 2. Les dix corrigés ───────────────────────────────────────────────────
with q (numero, cle, bonne, intitule, options, explication) as (values

  (3, 'q1', 'C',
   'Dans une base relationnelle, comment s''appelle la colonne qui identifie une ligne sans doublon possible ?',
   array['la cle etrangere', 'la jointure', 'la cle primaire', 'l''index'],
   'La cle primaire identifie la ligne. La cle etrangere, elle, pointe vers la cle primaire d''une autre table.'),

  (3, 'q2', 'A',
   'Comment s''appelle l''operation qui recolle deux tables reliees entre elles ?',
   array['une jointure', 'une transaction', 'une agregation', 'une migration'],
   'La jointure suit la fleche entre deux tables et les presente comme une seule.'),

  (3, 'q3', 'D',
   'Que garantit une transaction ?',
   array['que la requete sera rapide', 'que les donnees seront compressees', 'que la base acceptera n''importe quelle forme', 'que l''operation se fait entierement, ou pas du tout'],
   'Tout ou rien. Un virement retire d''un compte ET ajoute a l''autre, jamais la moitie.'),

  (3, 'q4', 'B',
   'Quel est le principal atout d''une base documentaire par rapport au relationnel ?',
   array['elle est toujours plus rapide', 'chaque fiche peut avoir sa propre forme', 'elle garantit mieux l''exactitude', 'elle occupe moins de place'],
   'Schema souple : chaque fiche peut avoir sa forme. C''est le troc du NoSQL — de la souplesse contre des garanties.'),

  (3, 'q5', 'C',
   'Quelle famille NoSQL repond le mieux a « qui connait qui » dans un reseau ?',
   array['cle-valeur', 'document', 'graphe', 'colonnes'],
   'La question porte sur les liens, pas sur les fiches. En relationnel, « les amis des amis des amis » demande trois jointures.'),

  (3, 'q6', 'B',
   'En quoi consiste la denormalisation ?',
   array['supprimer les doublons pour gagner de la place', 'accepter de repeter une information pour eviter une jointure', 'chiffrer les donnees sensibles', 'repartir la base sur plusieurs machines'],
   'On accepte de repeter pour eviter la jointure. Le prix : si l''information change, il faut la changer partout.'),

  (3, 'q7', 'D',
   'Que contient un lac de donnees ?',
   array['uniquement des tables nettoyees et rangees', 'seulement les donnees de moins d''un an', 'les chiffres valides par la direction', 'des donnees brutes, versees sans schema prealable'],
   'Brut, sans schema, sans tri : on verse au cas ou, sans savoir encore ce qu''on cherchera.'),

  (3, 'q8', 'A',
   'Qu''est-ce qui distingue un entrepot de donnees d''un lac ?',
   array['on decide d''avance des questions et on range en consequence', 'il est toujours plus petit', 'il n''accepte que du JSON', 'il ne conserve rien plus de trois mois'],
   'L''entrepot repond a des questions decidees d''avance ; le lac garde tout, y compris ce qu''on ne lira jamais.'),

  (3, 'q9', 'C',
   'Quel est le risque principal d''un lac mal tenu ?',
   array['il devient trop rapide', 'il refuse les nouvelles donnees', 'il devient un marecage dont plus personne ne connait le contenu', 'il perd automatiquement les donnees anciennes'],
   'Un lac dans lequel personne ne range devient un marecage. Le risque est d''organisation, pas de technique.'),

  (3, 'q10', 'B',
   'Pourquoi 60, 47 et 72 peuvent-ils etre justes tous les trois ?',
   array['parce que les trois systemes sont mal synchronises', 'parce qu''ils ne parlent ni du meme moment ni de la meme chose', 'parce que deux d''entre eux sont des estimations', 'parce que l''un des trois est arrondi'],
   'Un constat de maintenant, un constat consolide de dimanche, une prevision. Un chiffre se lit avec sa date et sa source.')

)
insert into public.corriges (seance_id, question, bonne_reponse, intitule, options, explication)
select s.id, q.cle, q.bonne, q.intitule, q.options, q.explication
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where not exists (select 1 from public.corriges co
                    where co.seance_id = s.id and co.question = q.cle);

-- ─── 3. Rattraper un corrigé présent mais vide ─────────────────────────────
--  Un corrigé peut exister sans intitulé ni options — créé à la main, ou par un
--  essai. L'insert ci-dessus l'aurait laissé tel quel, donc vide à l'écran.
update public.corriges co
   set intitule    = q.intitule,
       options     = q.options,
       explication = q.explication,
       bonne_reponse = q.bonne
  from (values
    ('q1', 'C', 'Dans une base relationnelle, comment s''appelle la colonne qui identifie une ligne sans doublon possible ?', array['la cle etrangere', 'la jointure', 'la cle primaire', 'l''index'], 'La cle primaire identifie la ligne. La cle etrangere, elle, pointe vers la cle primaire d''une autre table.'),
    ('q2', 'A', 'Comment s''appelle l''operation qui recolle deux tables reliees entre elles ?', array['une jointure', 'une transaction', 'une agregation', 'une migration'], 'La jointure suit la fleche entre deux tables et les presente comme une seule.'),
    ('q3', 'D', 'Que garantit une transaction ?', array['que la requete sera rapide', 'que les donnees seront compressees', 'que la base acceptera n''importe quelle forme', 'que l''operation se fait entierement, ou pas du tout'], 'Tout ou rien. Un virement retire d''un compte ET ajoute a l''autre, jamais la moitie.'),
    ('q4', 'B', 'Quel est le principal atout d''une base documentaire par rapport au relationnel ?', array['elle est toujours plus rapide', 'chaque fiche peut avoir sa propre forme', 'elle garantit mieux l''exactitude', 'elle occupe moins de place'], 'Schema souple : chaque fiche peut avoir sa forme. C''est le troc du NoSQL — de la souplesse contre des garanties.'),
    ('q5', 'C', 'Quelle famille NoSQL repond le mieux a « qui connait qui » dans un reseau ?', array['cle-valeur', 'document', 'graphe', 'colonnes'], 'La question porte sur les liens, pas sur les fiches. En relationnel, « les amis des amis des amis » demande trois jointures.'),
    ('q6', 'B', 'En quoi consiste la denormalisation ?', array['supprimer les doublons pour gagner de la place', 'accepter de repeter une information pour eviter une jointure', 'chiffrer les donnees sensibles', 'repartir la base sur plusieurs machines'], 'On accepte de repeter pour eviter la jointure. Le prix : si l''information change, il faut la changer partout.'),
    ('q7', 'D', 'Que contient un lac de donnees ?', array['uniquement des tables nettoyees et rangees', 'seulement les donnees de moins d''un an', 'les chiffres valides par la direction', 'des donnees brutes, versees sans schema prealable'], 'Brut, sans schema, sans tri : on verse au cas ou, sans savoir encore ce qu''on cherchera.'),
    ('q8', 'A', 'Qu''est-ce qui distingue un entrepot de donnees d''un lac ?', array['on decide d''avance des questions et on range en consequence', 'il est toujours plus petit', 'il n''accepte que du JSON', 'il ne conserve rien plus de trois mois'], 'L''entrepot repond a des questions decidees d''avance ; le lac garde tout, y compris ce qu''on ne lira jamais.'),
    ('q9', 'C', 'Quel est le risque principal d''un lac mal tenu ?', array['il devient trop rapide', 'il refuse les nouvelles donnees', 'il devient un marecage dont plus personne ne connait le contenu', 'il perd automatiquement les donnees anciennes'], 'Un lac dans lequel personne ne range devient un marecage. Le risque est d''organisation, pas de technique.'),
    ('q10', 'B', 'Pourquoi 60, 47 et 72 peuvent-ils etre justes tous les trois ?', array['parce que les trois systemes sont mal synchronises', 'parce qu''ils ne parlent ni du meme moment ni de la meme chose', 'parce que deux d''entre eux sont des estimations', 'parce que l''un des trois est arrondi'], 'Un constat de maintenant, un constat consolide de dimanche, une prevision. Un chiffre se lit avec sa date et sa source.')
       ) as q(cle, bonne, intitule, options, explication),
       public.classes c,
       public.seances s
 where c.code = 'BTS1-DEV-2026'
   and s.classe_id = c.id
   and s.numero = 3
   and co.seance_id = s.id
   and co.question = q.cle
   and co.intitule is null;

-- ─── 4. Contrôle ───────────────────────────────────────────────────────────
do $$
declare n int; v_titre text;
begin
  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3
     and co.question not like 'pre-%';
  if n <> 10 then raise exception 'seance 3 : % corriges de quiz, attendu 10', n; end if;

  select count(*) into n
    from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3
     and co.question not like 'pre-%'
     and (co.intitule is null or co.options is null or array_length(co.options, 1) <> 4);
  if n > 0 then raise exception '% corrige(s) de la seance 3 sans intitule ou sans 4 options', n; end if;

  -- Jamais plus de trois fois la même bonne lettre : une classe repère le motif.
  select max(k) into n from (
    select count(*) as k from public.corriges co
      join public.seances s on s.id = co.seance_id
      join public.classes c on c.id = s.classe_id
     where c.code = 'BTS1-DEV-2026' and s.numero = 3 and co.question not like 'pre-%'
     group by co.bonne_reponse) t;
  if n > 3 then raise exception 'une meme lettre est bonne % fois sur 10 : motif repérable', n; end if;

  select s.titre into v_titre from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 3;
  raise notice 'Seance 3 : 10 corriges, titre « % ».', v_titre;
end $$;
