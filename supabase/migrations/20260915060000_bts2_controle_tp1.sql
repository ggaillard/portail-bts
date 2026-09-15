-- ═══════════════════════════════════════════════════════════════════════════
--  CONTRÔLE D'ACQUIS BTS2 — ce qu'il reste du TP1 « Console & POO »
--
--  Le questionnaire de préparation à l'interro sur table. Il est posé sur la
--  séance 2 (le TP2), parce que **le contrôle appartient à la séance qu'il
--  précède** : les étudiants le font avant d'entrer dans le TP2, et c'est à ce
--  moment-là que l'interro sur le TP1 a lieu. Aucune séance nouvelle n'est
--  créée pour cela — la bande 90-98 est celle des questionnaires, et un
--  contrôle d'acquis n'en est pas un.
--
--  Huit notions, prises dans les trois fiches concept du TP1 : poo.md,
--  collections.md, linq.md. Chacune est doublée d'une question de certitude
--  `pre-NN-c` (bonne_reponse = 'Z', donc jamais comptée juste) : se tromper en
--  étant sûr n'appelle pas le même geste que douter en ayant juste.
--
--  Bonnes réponses : A C B C B D D A — deux A, deux B, deux C, deux D.
--  Une classe repère très vite un motif.
--
--  **Pourquoi des insert plutôt qu'un appel à `creer_controle()`** : cette
--  fonction exige `est_enseignant()`, ce qu'une migration n'est pas. On écrit
--  donc exactement ce qu'elle aurait écrit — mêmes clés `pre-NN`, même
--  question de certitude, `bonne_reponse` en lettre.
--
--  Le contrôle est créé **fermé** (`controle_ouvert` inchangé). On l'ouvre
--  depuis le portail quand on veut qu'il apparaisse : ouvrir d'avance, c'est
--  une classe qui répond la veille.
--
--  Rejouable sans risque : refuse de s'écraser dès qu'une réponse existe.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_seance bigint;
  v_deja   int;
  v_n      int;
  v_max    int;
begin
  -- ─── 1. La séance visée ──────────────────────────────────────────────────
  select s.id into v_seance
    from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS2-SLAM-2026'
     and s.numero = 2;

  if v_seance is null then
    raise exception 'BTS2-SLAM-2026 : pas de séance 2 (TP2) en base — '
                    'le contrôle d''acquis du TP1 n''a nulle part où vivre.';
  end if;

  -- ─── 2. On n'écrase jamais un contrôle déjà répondu ──────────────────────
  --  Réécrire effacerait les réponses. C'est la règle de `creer_controle()`,
  --  et elle vaut aussi ici.
  select count(*) into v_deja
    from public.reponses r
   where r.seance_id = v_seance and r.question like 'pre-%';

  if v_deja > 0 then
    raise notice 'Contrôle du TP1 : % réponse(s) déjà données, rien n''est '
                 'réécrit. Pour le refaire, il faut assumer de les perdre.',
                 v_deja;
    return;
  end if;

  delete from public.corriges
   where seance_id = v_seance and question like 'pre-%';

  -- ─── 3. Les huit notions ─────────────────────────────────────────────────
  insert into public.corriges (seance_id, question, bonne_reponse,
                               intitule, options, explication)
  select v_seance, q.cle, q.bonne, q.intitule, q.options, q.explication
    from (values

    ('pre-01', 'A',
     'Une classe et un objet, quelle est la différence ?',
     array['La classe est le modèle, l''objet l''exemplaire fabriqué à partir d''elle',
           'La classe est l''exemplaire, l''objet le modèle qui a servi à le faire',
           'Les deux mots désignent exactement la même chose en C#',
           'Un objet peut exister sans qu''aucune classe ne le décrive'],
     'La classe est le moule, l''objet le gâteau. On fabrique autant d''objets qu''on veut à partir d''une seule classe.'),

    ('pre-02', 'C',
     'Pourquoi le champ _chansons est-il privé dans la classe Playlist ?',
     array['Pour que la liste occupe moins de place en mémoire',
           'Pour que le programme compile plus vite',
           'Pour que rien ne s''y ajoute sans passer par AjouterChanson, qui peut vérifier les règles',
           'Pour interdire toute lecture de la liste depuis l''extérieur'],
     'C''est l''encapsulation : une porte d''entrée unique, donc un endroit unique où faire respecter les règles métier.'),

    ('pre-03', 'B',
     'Qu''est-ce que IReadOnlyList change par rapport à List ?',
     array['On peut y ajouter des éléments mais pas les relire',
           'On peut lire et parcourir la collection, pas y ajouter ni en retirer',
           'Les chansons elles-mêmes deviennent impossibles à modifier',
           'La collection est recopiée à chaque lecture, ce qui la rend plus lente'],
     'Lecture seule vue de l''extérieur. L''objet garde la main sur ce qui entre et ce qui sort de sa collection.'),

    ('pre-04', 'C',
     'Pourquoi DureeFormatee() est-elle une méthode et non une propriété ?',
     array['Parce qu''elle est déclarée publique',
           'Parce qu''elle renvoie une chaîne de caractères et non un nombre',
           'Parce qu''elle fait un calcul — et cela se voit à ses parenthèses',
           'Parce que son nom est composé de deux mots collés'],
     'Une propriété expose une donnée ; une méthode fait quelque chose. 354 secondes ne deviennent « 05:54 » que par un calcul.'),

    ('pre-05', 'B',
     'Pour retrouver une chanson à partir de son Id sans parcourir toute la collection, on utilise :',
     array['une List que l''on parcourt avec une boucle for',
           'un Dictionary dont la clé est l''Id de la chanson',
           'une List triée par titre, puis une recherche au milieu',
           'un tableau de chaînes de caractères contenant les Id'],
     'La clé mène droit à la valeur, sans parcours. C''est exactement ce que fait Bibliotheque avec son Dictionary.'),

    ('pre-06', 'D',
     'Qu''est-ce qu''une List garantit et qu''un Dictionary ne garantit pas ?',
     array['L''unicité de chaque élément qu''elle contient',
           'La rapidité de la recherche par identifiant',
           'L''impossibilité d''y ranger deux fois la même valeur',
           'L''ordre dans lequel les éléments ont été ajoutés'],
     'Une playlist a un ordre : c''est une List. Un Dictionary n''en promet aucun, et c''est le prix de son accès direct.'),

    ('pre-07', 'D',
     'Dans chansons.Where(c => c.Genre == "Rock"), comment appelle-t-on la partie « c => … » ?',
     array['Un opérateur de comparaison',
           'Une conversion de type',
           'Une instruction conditionnelle',
           'Une expression lambda'],
     'Le « => » se lit « va vers » ou « tel que » : pour chaque chanson c, garder celles dont le genre est Rock.'),

    ('pre-08', 'A',
     'Que renvoie chansons.Where(c => c.Note >= 4).OrderByDescending(c => c.Note).Take(3) ?',
     array['Les trois chansons les mieux notées parmi celles qui ont 4 ou 5',
           'Les trois chansons les moins bien notées de la collection',
           'Toutes les chansons dont la note atteint au moins 3',
           'La moyenne des notes des trois premières chansons de la liste'],
     'Trois traitements à la chaîne : filtrer, trier, couper. Et rien n''est calculé tant qu''on ne parcourt pas le résultat.')

    ) as q(cle, bonne, intitule, options, explication);

  -- ─── 4. La certitude, posée dans les mêmes termes pour les huit ──────────
  --  Identique d'une notion à l'autre, sinon on ne compare plus rien.
  insert into public.corriges (seance_id, question, bonne_reponse,
                               intitule, options, explication)
  select v_seance, 'pre-' || lpad(i::text, 2, '0') || '-c', 'Z',
         'Sur cette notion, vous diriez :',
         array['Je saurais l''expliquer', 'Je crois avoir compris',
               'J''ai un doute', 'Je ne sais plus'],
         null
    from generate_series(1, 8) as i;

  -- ─── 5. Contrôle ─────────────────────────────────────────────────────────
  select count(*) into v_n
    from public.corriges
   where seance_id = v_seance
     and question like 'pre-%' and question not like '%-c';
  if v_n <> 8 then
    raise exception 'contrôle TP1 : % notions, attendu 8', v_n;
  end if;

  select count(*) into v_n
    from public.corriges
   where seance_id = v_seance and question like 'pre-%-c';
  if v_n <> 8 then
    raise exception 'contrôle TP1 : % questions de certitude, attendu 8', v_n;
  end if;

  select count(*) into v_n
    from public.corriges
   where seance_id = v_seance
     and question like 'pre-%' and question not like '%-c'
     and (intitule is null or options is null or array_length(options, 1) <> 4);
  if v_n > 0 then
    raise exception 'contrôle TP1 : % notion(s) sans intitulé ou sans 4 options', v_n;
  end if;

  -- Jamais plus de deux fois la même bonne lettre sur huit notions.
  select max(k) into v_max from (
    select count(*) as k
      from public.corriges
     where seance_id = v_seance
       and question like 'pre-%' and question not like '%-c'
     group by bonne_reponse) t;
  if v_max > 2 then
    raise exception 'contrôle TP1 : une même lettre est bonne % fois sur 8 — '
                    'motif repérable', v_max;
  end if;

  raise notice 'Contrôle d''acquis TP1 posé sur la séance 2 du BTS2 : '
               '8 notions + 8 certitudes. Il reste FERMÉ — l''ouvrir depuis '
               'le portail le moment venu.';
end $$;

-- ─── Vérification à la main, en lecture seule ──────────────────────────────
--  À coller dans Supabase → SQL Editor si l'on veut revoir ce qui est posé.
--
--  select co.question, co.bonne_reponse, left(co.intitule, 60) as intitule
--    from public.corriges co
--    join public.seances s on s.id = co.seance_id
--    join public.classes c on c.id = s.classe_id
--   where c.code = 'BTS2-SLAM-2026' and s.numero = 2
--     and co.question like 'pre-%' and co.question not like '%-c'
--   order by co.question;
