-- ═══════════════════════════════════════════════════════════════════════════
--  BTS2 — PROJET IA : UN QUESTIONNAIRE « VÉRIFIER SON TRAVAIL » PAR SÉANCE
--
--  Demandé le 06/10 : pour chacune des deux séances à distance du projet IA
--  (21 lundi 05/10, 22 mardi 06/10), un questionnaire qui vérifie que le
--  travail a bien été fait, qui fait revoir les concepts importants, et qui
--  est RATTACHÉ à sa séance.
--
--  Ce qui les distingue des auto-évaluations du 02/10 (autoeval-s21/s22) :
--  celles-ci portent sur les notions ; ceux-là portent sur ce que l'on voit
--  QUAND ON A FAIT les missions — la ligne « eval rate », le refus de démarrer
--  sans code, le fichier resultats-….csv, docker compose logs tunnel, le 429
--  pendant la mesure, git log -- .env. On y répond facilement si l'on a lancé
--  les commandes, beaucoup moins sinon. Aucune question ne reprend une
--  question des auto-évaluations. Chaque correction rappelle le concept.
--
--  Réglages, pour les deux :
--    · mode `revision`, certitude demandée : la correction suit chaque
--      réponse, et « sûr mais faux » se lit dans le suivi ;
--    · rattaché à sa séance, avec `reste_ouvert` : il s'ouvre avec elle et
--      NE SE FERME PAS avec elle — les séances ont eu lieu, la vérification
--      se fait après. On l'éteint à la main quand on veut ;
--    · à la création, ouvert si sa séance l'est déjà (c'est ce que le
--      déclencheur aurait fait), fermé sinon. Rejoué, il ne rouvre rien.
--  Bonnes réponses de chaque questionnaire : deux A, deux B, deux C, deux D.
--
--  Et une correction : en production, « Projet IA (1/2) — auto-évaluation »
--  était rattachée à la séance 22 au lieu de la 21. Elle est remise sur la
--  21, seulement si elle pointe encore sur la 22.
--
--  Rejouable : rien n'est réécrit dès qu'une réponse existe.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.poser_verification(
  p_cle text, p_titre text, p_intro text, p_cible int, p_q jsonb)
returns void language plpgsql as $$
declare
  v_id     bigint;
  v_classe bigint;
  v_cible  bigint;
  v_ouv    boolean;
  v_s      bigint;
  v_num    int;
  v_rep    int;
  q        jsonb;
  v_rang   int := 0;
begin
  select id into v_classe from public.classes where code = 'BTS2-SLAM-2026';
  if v_classe is null then
    raise notice '%: pas de classe BTS2-SLAM-2026, rien n''est posé.', p_cle;
    return;
  end if;
  select id, ouverte into v_cible, v_ouv from public.seances
   where classe_id = v_classe and numero = p_cible;

  -- Le modèle
  select id into v_id from public.modeles where cle = p_cle;
  if v_id is not null then
    select count(*) into v_rep
      from public.reponses r join public.seances s on s.id = r.seance_id
     where s.modele_id = v_id;
    if v_rep > 0 then
      raise notice '%: % réponse(s) déjà données, rien n''est réécrit.', p_cle, v_rep;
      return;
    end if;
    delete from public.modele_corriges  where modele_id = v_id;
    delete from public.modele_questions where modele_id = v_id;
    update public.modeles set titre = p_titre, intro = p_intro,
                              mode = 'revision', certitude = true
     where id = v_id;
  else
    insert into public.modeles (cle, titre, intro, mode, certitude)
    values (p_cle, p_titre, p_intro, 'revision', true)
    returning id into v_id;
  end if;

  -- Les questions et leurs corrigés (les lettres justes restent hors de
  -- modele_questions, lisible par anon)
  for q in select * from jsonb_array_elements(p_q) loop
    v_rang := v_rang + 1;
    insert into public.modele_questions (modele_id, rang, cle, intitule, options, theme)
    values (v_id, v_rang, p_cle || '-' || lpad(v_rang::text, 2, '0'),
            q->>'q', array(select jsonb_array_elements_text(q->'o')), q->>'t');
    insert into public.modele_corriges (modele_id, cle, bonne, explication)
    values (v_id, p_cle || '-' || lpad(v_rang::text, 2, '0'), q->>'b', q->>'e');
  end loop;

  -- L'affectation au BTS2, dans la bande 90-98
  select id into v_s from public.seances
   where classe_id = v_classe and modele_id = v_id;
  if v_s is null then
    select min(g) into v_num
      from generate_series(90, 98) g
     where not exists (select 1 from public.seances s
                        where s.classe_id = v_classe and s.numero = g);
    if v_num is null then
      raise exception '%: la bande 90-98 du BTS2 est pleine — libérez une place '
                      '(retirer un questionnaire de la classe) puis rejouez.', p_cle;
    end if;
    insert into public.seances (classe_id, numero, titre, notee, ouverte,
                                duree_min, nature, modele_id)
    values (v_classe, v_num, p_titre, false, coalesce(v_ouv, false), 0,
            'questionnaire', v_id)
    returning id into v_s;
  end if;

  delete from public.corriges where seance_id = v_s;
  insert into public.corriges (seance_id, question, bonne_reponse, explication,
                               intitule, options, theme)
  select v_s, mq.cle, mc.bonne, mc.explication, mq.intitule, mq.options, mq.theme
    from public.modele_questions mq
    join public.modele_corriges mc on mc.modele_id = mq.modele_id and mc.cle = mq.cle
   where mq.modele_id = v_id
   order by mq.rang;

  -- Rattaché à sa séance, et il reste ouvert quand elle se ferme
  if v_cible is not null then
    update public.seances
       set rattachee_a = v_cible, reste_ouvert = true
     where id = v_s
       and (rattachee_a is distinct from v_cible or not reste_ouvert);
  end if;
end $$;


select pg_temp.poser_verification(
  'verif-s21-projet-ia',
  'Projet IA (1/2) — vérifier son travail',
  'Huit questions sur ce que vous avez fait lundi : on y répond sans peine '
  'quand on a lancé les commandes. Dites si vous étiez sûr, puis lisez la '
  'correction : chacune reprend un point important du projet.',
  21,
  $j$[
   {"t":"Machine","q":"Avec « ollama run … --verbose », une ligne « eval rate » s'affiche après chaque réponse. Que mesure-t-elle ?",
    "o":["le temps de chargement du modèle en mémoire","la vitesse de génération, en tokens par seconde","la part du modèle qui tient dans la carte graphique","la taille du modèle sur le disque"],
    "b":"B","e":"C'est le chiffre à noter au §2 : il dit si le modèle est utilisable. Très bas, il signale souvent qu'une partie du modèle tourne sur le processeur — « ollama ps » le confirme."},
   {"t":"Local","q":"Vous lancez « uvicorn main:app --env-file .env --reload » sans avoir rempli CODE_ACCES. Que se passe-t-il ?",
    "o":["L'application démarre et accepte n'importe quel code","L'application démarre et refuse toutes les demandes","Uvicorn tire un code au hasard et l'affiche","L'application refuse de démarrer : il faut un code d'au moins 8 caractères"],
    "b":"D","e":"main.py s'arrête dès le démarrage si CODE_ACCES manque ou fait moins de 8 caractères. Mieux vaut un service qui ne démarre pas qu'un service public ouvert à tous sans que personne s'en aperçoive."},
   {"t":"Local","q":"Lundi, l'application tourne sans Docker, directement sur votre PC. Dans .env, OLLAMA_URL vaut alors :",
    "o":["http://localhost:11434","http://host.docker.internal:11434","http://ollama:11434","l'adresse publique en trycloudflare.com"],
    "b":"A","e":"Sans conteneur, l'application et Ollama sont sur la même machine : localhost suffit. Mardi, dans le conteneur, localhost désigne le conteneur lui-même — c'est pour cela que l'adresse change."},
   {"t":"Mesurer","q":"Pour evaluer.py, une réponse est « juste » quand :",
    "o":["le modèle a répondu en moins de 120 secondes","le modèle lui-même la juge proche de la réponse attendue","elle contient tous les mots de « doit_contenir » et aucun de « ne_doit_pas »","l'application a renvoyé le code HTTP 200"],
    "b":"C","e":"Le jugement est une recherche de mots, sans tenir compte des majuscules : rustique, mais reproductible. Tout tient au choix des mots attendus — un mot trop courant (« le », « oui ») rend le cas toujours juste."},
   {"t":"Mesurer","q":"Après un passage d'evaluer.py, où relisez-vous ce que le modèle a répondu à un cas faux ?",
    "o":["dans le fichier resultats-AAAAMMJJ-HHMM.csv créé par le script","dans cas.json, qu'evaluer.py complète","dans le README, rempli automatiquement","nulle part : seul le taux de réussite est gardé"],
    "b":"A","e":"Le CSV garde, cas par cas et essai par essai, le verdict, la durée et le début de la réponse : c'est là qu'on comprend un échec avant de le commenter au §4. Le .gitignore le tient hors du dépôt."},
   {"t":"Mesurer","q":"Pourquoi evaluer.py donne-t-il le temps médian plutôt que la moyenne ?",
    "o":["Parce que la médiane est toujours plus basse","Parce qu'une réponse très lente — souvent la première, le temps de charger le modèle — ne fausse pas la valeur","Parce que Python ne sait pas calculer une moyenne sans bibliothèque","Parce que la fiche du sujet l'impose"],
    "b":"B","e":"Au premier appel, Ollama charge le modèle en mémoire : cet essai peut durer dix fois plus. La moyenne en serait tirée vers le haut ; la médiane décrit ce que vit un utilisateur ordinaire."},
   {"t":"Mesurer","q":"Votre jeu de 10 cas réussit à 100 % dès le premier passage. Qu'en conclure ?",
    "o":["Le projet est terminé : la mesure est parfaite","Il faut retirer les cas hors sujet, devenus inutiles","Les cas sont sans doute trop faciles : il manque ceux qui piègent, ceux de la fiche du sujet","Le modèle est trop gros pour la machine"],
    "b":"C","e":"Un cas qui réussit toujours ne mesure rien : il ne départagera ni deux modèles, ni deux versions de la consigne. Les pièges de la fiche du sujet sont là pour ça — au moins deux cas doivent rester difficiles."},
   {"t":"Sécurité","q":"Vous envoyez un texte de 5 000 caractères avec le bon code. L'application répond :",
    "o":["200, avec une réponse tronquée","401, code d'accès incorrect","429, trop de requêtes","413, texte trop long (MAX_CARACTERES vaut 2 000)"],
    "b":"D","e":"Une entrée bornée protège votre machine : un texte énorme occuperait le modèle de longues minutes et ralentirait tous les autres visiteurs. La limite se règle dans .env, pas dans le code."}
  ]$j$::jsonb);

select pg_temp.poser_verification(
  'verif-s22-projet-ia',
  'Projet IA (2/2) — vérifier son travail',
  'Huit questions sur ce que vous avez fait mardi : on y répond sans peine '
  'quand on a mis l''application en production soi-même. Dites si vous étiez '
  'sûr, puis lisez la correction : chacune reprend un point important du projet.',
  22,
  $j$[
   {"t":"Tunnel","q":"Où trouvez-vous l'adresse publique https://….trycloudflare.com de votre application ?",
    "o":["dans le journal du service tunnel : « docker compose logs tunnel »","dans .env, à la ligne OLLAMA_URL","dans l'interface de votre box","dans la réponse de la route /sante"],
    "b":"A","e":"C'est cloudflared qui obtient l'adresse au démarrage et l'écrit dans son journal. Rien à régler dans la box : la connexion part de votre PC."},
   {"t":"Tunnel","q":"Après un redémarrage du PC, l'adresse publique notée dans votre README ne répond plus. La cause la plus probable :",
    "o":["le code d'accès a expiré","Cloudflare a bloqué votre application","le tunnel a redémarré et a reçu une nouvelle adresse : il faut la relever et la mettre à jour","Ollama a supprimé le modèle"],
    "b":"C","e":"Un tunnel rapide (trycloudflare.com) est gratuit et sans compte, mais son adresse change à chaque redémarrage. Relisez « docker compose logs tunnel », mettez le README à jour, et prévenez par e-mail si le rendu est déjà parti."},
   {"t":"Production","q":"Dans « docker compose ps », la colonne des ports affiche 127.0.0.1:8000->8000/tcp. Cela veut dire :",
    "o":["que l'application est joignable par tout Internet sur le port 8000","que le port 8000 n'est ouvert que sur votre PC lui-même : Internet passe par le tunnel","que l'application n'a pas démarré","qu'Ollama est publié sur le port 8000"],
    "b":"B","e":"Publié sur 127.0.0.1, le port n'est pas joignable depuis le réseau, pas même depuis un autre appareil de la maison. Seul le tunnel, à l'intérieur du compose, atteint l'application par app:8000."},
   {"t":"Production","q":"Pourquoi le service tunnel attend-il que l'application soit « healthy » pour démarrer ?",
    "o":["Pour économiser la bande passante","Parce que cloudflared ne sait pas démarrer seul","Pour que l'adresse publique ne change pas","Pour ne rien publier tant que l'application ne peut pas répondre"],
    "b":"D","e":"« depends_on » avec « condition: service_healthy » enchaîne les démarrages : au lancement, tant que /sante échoue — Ollama injoignable, par exemple — aucune adresse publique ne s'ouvre sur un service en panne."},
   {"t":"Mesurer","q":"Avec 10 cas et « --essais 3 », evaluer.py affiche une série d'« ERREUR HTTP 429 ». Que faire ?",
    "o":["Monter REQUETES_PAR_MINUTE à 40 le temps de la mesure, relancer, puis remettre 10","Supprimer la limite de requêtes dans main.py","Passer à un modèle plus petit","Rien : ces cas comptent comme réussis"],
    "b":"A","e":"429, c'est la limite de requêtes qui fait son travail — contre vous aussi : 30 demandes en quelques minutes dépassent 10 par minute. On l'élargit le temps de mesurer, sans la retirer, et on la remet avant de rendre."},
   {"t":"Mesurer","q":"Vous changez MODELE dans .env pour essayer le modèle de comparaison. Ensuite :",
    "o":["« docker compose restart app » suffit","rien : l'application relit .env à chaque demande","« ollama pull » du modèle, puis « docker compose up -d », qui recrée le conteneur avec le nouveau réglage","il faut obligatoirement reconstruire l'image avec --build"],
    "b":"C","e":"Les valeurs de .env sont lues à la création du conteneur : « restart » relance le même conteneur avec les anciennes, « up -d » voit le changement et le recrée. Vérifiez dans la réponse quel modèle a vraiment répondu."},
   {"t":"Mesurer","q":"Pour que la comparaison de deux modèles soit juste, qu'est-ce qui change entre les deux passages ?",
    "o":["le jeu de cas, adapté à chaque modèle","seulement MODELE : mêmes cas, même nombre d'essais, même température, même consigne","la température, plus haute pour le petit modèle","le nombre d'essais, plus grand pour le modèle le plus lent"],
    "b":"B","e":"Si deux choses changent à la fois, on ne sait plus laquelle explique l'écart. Une seule variable bouge ; tout le reste est figé, et noté au §4."},
   {"t":"Secrets","q":"« git log --all --oneline -- .env » n'affiche rien. Cela prouve :",
    "o":["que .env est vide","que le dépôt n'a encore aucun commit","que .env a été supprimé de GitHub après coup","qu'aucun commit, sur aucune branche, n'a jamais contenu .env"],
    "b":"D","e":"C'est la preuve demandée au §5. Si une ligne s'affichait, le code aurait été publié : l'effacer ensuite ne suffit pas, il reste dans l'historique — il faut alors changer le code d'accès."}
  ]$j$::jsonb);


-- ─── La correction : l'auto-évaluation 1/2 sur la séance 21 ────────────────
--  Seulement si elle pointe sur la 22 : un autre choix fait à la main est
--  gardé. Le déclencheur de rattachement vérifie la classe de la cible.
update public.seances q
   set rattachee_a = s21.id
  from public.classes c, public.modeles mo, public.seances s21, public.seances s22
 where c.code = 'BTS2-SLAM-2026'
   and mo.cle = 'autoeval-s21-projet-ia'
   and q.classe_id = c.id and q.modele_id = mo.id
   and s21.classe_id = c.id and s21.numero = 21
   and s22.classe_id = c.id and s22.numero = 22
   and q.rattachee_a = s22.id;


-- ─── Contrôles ─────────────────────────────────────────────────────────────
do $$
declare n int; v_c bigint;
begin
  select id into v_c from public.classes where code = 'BTS2-SLAM-2026';
  if v_c is null then
    raise notice 'Vérifier son travail : pas de classe BTS2-SLAM-2026, rien à vérifier.';
    return;
  end if;

  select count(*) into n from public.modele_questions mq
    join public.modeles mo on mo.id = mq.modele_id
   where mo.cle in ('verif-s21-projet-ia', 'verif-s22-projet-ia');
  if n <> 16 then raise exception 'vérifier son travail : % question(s), attendu 16', n; end if;

  select count(*) into n from (
    select mo.cle, mc.bonne, count(*) c
      from public.modele_corriges mc join public.modeles mo on mo.id = mc.modele_id
     where mo.cle in ('verif-s21-projet-ia', 'verif-s22-projet-ia')
     group by 1, 2) t
   where c <> 2;
  if n > 0 then raise exception 'vérifier son travail : lettres mal réparties'; end if;

  select count(*) into n from public.modele_questions mq
    join public.modeles mo on mo.id = mq.modele_id
   where mo.cle in ('verif-s21-projet-ia', 'verif-s22-projet-ia')
     and array_length(mq.options, 1) <> 4;
  if n > 0 then raise exception 'vérifier son travail : % question(s) sans 4 options', n; end if;

  -- Chaque questionnaire du projet IA suit la bonne séance
  select count(*) into n
    from (values ('verif-s21-projet-ia', 21), ('verif-s22-projet-ia', 22),
                 ('autoeval-s21-projet-ia', 21), ('autoeval-s22-projet-ia', 22)) v(cle, num)
    join public.modeles mo on mo.cle = v.cle
    join public.seances q   on q.modele_id = mo.id and q.classe_id = v_c
    left join public.seances s on s.id = q.rattachee_a
   where s.numero is distinct from v.num;
  if n > 0 then raise exception 'projet IA : % questionnaire(s) rattaché(s) à la mauvaise séance', n; end if;

  select count(*) into n
    from public.modeles mo
    join public.seances q on q.modele_id = mo.id and q.classe_id = v_c
   where mo.cle in ('verif-s21-projet-ia', 'verif-s22-projet-ia')
     and q.nature = 'questionnaire' and q.numero between 90 and 98 and q.reste_ouvert;
  if n <> 2 then raise exception 'vérifier son travail : % affectation(s) conforme(s), attendu 2', n; end if;

  raise notice 'Projet IA : deux questionnaires « vérifier son travail » rattachés aux séances 21 et 22.';
end $$;
