-- ═══════════════════════════════════════════════════════════════════════════
--  Séance 2, question 9 : retirer l'indice typographique — 18/09/2026
--
--  POURQUOI CE FICHIER EST SÉPARÉ DE CELUI DES ACCENTS
--
--  La migration 20260918060000 remet les accents sur les 268 textes de quiz
--  des séances 1 à 3, et elle porte une garantie vérifiable : elle n'ajoute
--  que des signes diacritiques, aucun mot n'y est réécrit. Cette garantie ne
--  vaut que si rien d'autre ne s'y glisse. Le changement ci-dessous EST un
--  changement de mot ; il a donc son fichier, et il se révoque tout seul.
--
--  CE QU'IL CORRIGE
--
--  « Dans une API REST, que désigne l'adresse /api/projets/42 ? »
--
--     A  la 42e page du site
--     B  une ressource précise, le projet 42      ← la bonne
--     C  une erreur
--     D  un dossier sur le serveur
--
--  Une fois les accents rétablis, B est la SEULE option de cette question à
--  en porter un — les trois autres n'en veulent aucun, légitimement. La bonne
--  réponse se repère alors à sa typographie, sans être lue : le jumeau exact
--  de l'indice de longueur que le contrôle « pedagogie » traque depuis
--  toujours. C'est un défaut que la correction des accents a CRÉÉ, et il faut
--  le dire ainsi.
--
--  « dossier » devient « répertoire ». Synonyme exact dans ce contexte, terme
--  plus juste dans un cours de systèmes d'information, et il porte un accent :
--  l'indice disparaît sans que la question change de sens ni de difficulté.
--
--  La lettre attendue ne bouge pas (B). Aucune réponse déjà enregistrée ne
--  change de justesse.
--
--  Le contrôle qui l'a trouvé : outils/controler.py, famille « coherence » —
--  « une seule option accentuée, et c'est la bonne ».
--
--  La forme du tuple est celle des migrations de séance, « bonne » comprise,
--  pour qu'outils/lire.py reconstitue l'état final en lisant les fichiers dans
--  l'ordre. « bonne » n'est jamais écrite : l'update ne touche que les options.
-- ═══════════════════════════════════════════════════════════════════════════

with q(numero, cle, bonne, intitule, options, explication) as (values
  (2, 'q9', 'B',
   'Dans une API REST, que désigne l''adresse /api/projets/42 ?',
   array['la 42e page du site', 'une ressource précise, le projet 42', 'une erreur', 'un répertoire sur le serveur'],
   'Chaque chose a une adresse. C''est la première des trois idées de REST.')
)
update public.corriges co
   set options = q.options
  from q
  join public.classes c on c.code = 'BTS1-DEV-2026'          -- <<< À MODIFIER
  join public.seances s on s.classe_id = c.id and s.numero = q.numero
 where co.seance_id = s.id
   and co.question  = q.cle;

-- ─── Contrôle ──────────────────────────────────────────────────────────────
select s.numero as seance, co.question, co.bonne_reponse, co.options
  from public.corriges co
  join public.seances s  on s.id = co.seance_id
  join public.classes cl on cl.id = s.classe_id
 where cl.code = 'BTS1-DEV-2026' and s.numero = 2 and co.question = 'q9';
