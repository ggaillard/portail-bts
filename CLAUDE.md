# Portail BTS SIO — point d'entrée unique

Portail commun de Guillaume Gaillard, année 2026-2027.
<https://ggaillard.github.io/portail-bts/> — dépôt public `ggaillard/portail-bts`.

Répondre en **français**. Modifier directement les fichiers, ne pas se contenter de suggérer.

---

## Ce que fait ce dépôt

Un seul fichier de rendu, `index.html` (~1 500 lignes, autonome), plus `config.js`
(URL Supabase, clé anon, codes de classe). Trois rôles :

1. **Identifier** l'étudiant — code de classe, numéro, PIN à 4 chiffres, avatar.
2. **Orienter** — la liste des projets de sa classe, lus dans `public.projets`.
3. **Suivre** — l'espace enseignant : progression, classement, répartition, en direct.

Tous les sites de cours vivent sous `ggaillard.github.io`, donc **même origine** :
la session Supabase ouverte ici est partagée. Les sites appellent `qui_suis_je()`
au chargement et reprennent l'identité. **Aucun site de cours ne doit reproposer
une saisie de numéro** : cela contournerait le PIN.

Ancienne plateforme : `suivi.gaillard42.workers.dev` (Cloudflare Worker, base D1).
**Décommissionnée.** Ne plus jamais l'écrire dans un contenu ni y écrire de données.

---

## Base de données — Supabase, région Francfort

| Table | Contenu |
|---|---|
| `classes` | `code`, `nom`, `annee` |
| `eleves` | `classe_id`, `numero`, `avatar`, `pin`, `auth_id`, `vu_le` |
| `seances` | `classe_id`, `numero`, `titre`, `notee`, `ouverte` |
| `corriges` | `seance_id`, `question`, `bonne_reponse`, `explication`, `intitule` |
| `reponses` | `eleve_id`, `seance_id`, `question`, `reponse`, `correct`, `updated_at` |
| `projets` | `classe_id`, `titre`, `description`, `url`, `icone`, `ordre` |
| `enseignants` | comptes autorisés à ouvrir l'espace enseignant |

Fonctions : `rejoindre()`, `repondre()`, `qui_suis_je()`, `avatars_pris()`,
`choisir_avatar()`, `est_enseignant()`, `purger_annee()`. RLS actif partout.

**Règle absolue :** `eleves` ne contient **ni nom, ni prénom, ni adresse**.
Numéro, avatar, PIN. Ne jamais proposer d'y ajouter un champ nominatif. La
correspondance numéro ↔ étudiant réel vit hors ligne, dans le tableau de suivi
Drive de l'enseignant.

### Scripts SQL du dépôt

| Fichier | Rôle |
|---|---|
| `SQL_PORTAIL.md` | installation : PIN, table `projets`, fonctions `rejoindre` / `qui_suis_je` |
| `INTITULES.sql` | ajoute la colonne `corriges.intitule` et remplit les libellés |
| `JEU_ESSAI.sql` | classes `DEMO-2026` (12 élèves) et `DEMO-GRANDE-2026` (30 élèves) |
| `COMPTES_TEST.sql` | étudiant n° 99 dans chaque classe réelle, pour tester avant d'ouvrir |
| `APPEL.sql` | la séance d'appel, la question du jour, les vues de présence |

Toute écriture passe par **Supabase → SQL Editor → Run**. Aucun connecteur
Supabase n'est disponible côté assistant : produire du SQL à coller, jamais
prétendre exécuter.

---

## L'appel — question du jour

L'appel n'est pas un mécanisme à part : c'est **une séance numéro 99 par classe**,
intitulée « Appel - question du jour » (99 et non 0 : le BTS2 utilise déjà la séance 0 pour son TP0), ouverte en permanence et non notée. On y
ajoute chaque jour de cours **une** question nommée `appel-AAAA-MM-JJ`.

- Y répondre, c'est être présent. L'absence est l'absence de réponse.
- La question est **simple et courte** : elle remet en route, elle ne trie pas.
- `APPEL.sql` embarque une **banque prête** : 14 questions BTS1 (une par séance)
  et 5 BTS2 (une par TP), chacune réactivant la séance précédente. Avant un cours,
  une seule ligne change — la classe et le numéro de la séance qui commence.
- Les bonnes réponses sont réparties sur A, B, C et D : ne pas les réaligner sur
  une même lettre en ajoutant des questions, les étudiants repèrent le motif.
- Vue `v_appel` : une ligne par étudiant et par appel, avec `present` et l'heure.
- Vue `v_absences` : le cumul par étudiant, avec les dates manquées.

Ne pas créer de table `presences` ni de RPC dédiée : le modèle existant suffit,
et tout ce qui passe par `reponses` alimente déjà le tableau de bord.

---

## Le questionnaire de rentrée — « Faisons connaissance »

Séance **98** (99 = l'appel, 98 = la connaissance : deux numéros hauts, hors
progression). Douze questions posées **une seule fois dans l'année**, clés
`conn-01` à `conn-12`, `bonne_reponse = 'Z'` — aucune réponse n'est juste,
donc rien ne pollue le taux de réussite. Script : `CONNAISSANCE.sql`.

Quatre thèmes, trois questions chacun : parcours et niveau en informatique,
conditions de travail, objectifs et projection, façon d'apprendre.

- `connaissance()` — côté étudiant : renvoie les douze questions et là où il en
  est. Le portail en affiche **une à la fois** ; la carte disparaît d'elle-même
  quand tout est répondu.
- `connaissance_classe(p_classe_id)` — côté enseignant : la répartition par
  question **et `qui`**, la liste des numéros par réponse. C'est `qui` qui rend
  le chiffre utilisable : savoir que trois étudiants n'ont pas d'ordinateur ne
  sert à rien si on ignore lesquels.

Le bloc « À prendre en compte » se pilote par la table `SIGNAUX` dans
`index.html` : une ligne `{ q, lettres, quoi }` par réponse qui appelle une
décision pédagogique. Ajouter une ligne suffit à faire remonter un signal.

Ne pas ajouter de question à bonne réponse dans la séance 98 : elle n'est pas
une évaluation, et le portail la présente comme telle aux étudiants.

---

## Le suivi de stage — BTS2

Séance **97** (99 l'appel, 98 la connaissance, 97 le stage). Six questions,
clés `stage-01` à `stage-06`, `bonne_reponse = 'Z'`. Script : `STAGE.sql`.

Différence de fond avec la séance 98 : **celle-ci se révise**. La bonne réponse
d'hier est fausse demain, et c'est l'évolution qu'on veut lire. Le portail
affiche donc les six questions ensemble, réponse en cours en évidence, et un
clic la remplace — pas de « une question à la fois » ici.

L'ordre des options va toujours **du moins avancé au plus avancé** : c'est ce
qui permet de lire la colonne A comme « ceux qu'il faut aider ». Ne pas
réordonner les options sans réordonner la lecture qui en dépend.

`stage_classe()` renvoie `etats` — chaque étudiant rangé sous sa réponse à
`stage-01`, avec la date de sa dernière mise à jour. Une promotion « à jour »
depuis six semaines ne dit plus rien de vrai : la date est affichée à côté de
chaque numéro pour cette raison.

Ceux qui n'ont rien déclaré forment une cinquième ligne, après les quatre
étapes : on ne sait même pas s'ils cherchent, ce qui est pire que d'être en
retard.

---

## L'espace enseignant

`chargerStats()` charge en parallèle `eleves`, `reponses` et `corriges` pour la
séance sélectionnée, puis alimente Progression, Classement et Répartition.

`estEvaluee()` distingue les deux natures de réponse du système :

- **une question de quiz** — `correct` vaut `true` ou `false` ;
- **une mission cochée** — `reponse` vaut `"ok"` ou `"ko"`, et n'entre pas dans
  le taux de réussite. C'est ce qui permet au même écran de suivre le BTS1
  (quiz par séance) et le BTS2 (missions de TP).

Ne pas réécrire cette distinction : une mission cochée n'est pas une bonne réponse.

### Ce que le BTS2 écrit vraiment en base

Vérifié dans `playlist-csharp/docs/assets/suivi.js` et écrit noir sur blanc dans
son `SUIVI_SUPABASE.md` :

| Clé | Valeur enregistrée | Ce que c'est |
|---|---|---|
| `tp2-m1`, `tp1-c0`, `tp2-s1`, `tp0-1` | `true` / `false` | une case cochée du parcours — **un jalon** |
| `q-3-2` | `ok` / `ko` | une question de quiz — compte dans la réussite |
| `q-3-2-pick` | `0` à `3` | l'option choisie — jamais un jalon |

**Un jalon franchi = une clé qui commence par `tp` et dont la réponse vaut
`true`.** Deux erreurs faites et corrigées, à ne pas refaire :

- compter toutes les lignes → « 15/5 », les quiz comptés comme des jalons ;
- compter `reponse = 'ok'` sur `tp%-m%` → zéro partout, car aucune mission ne
  vaut `ok`, et parce que les 29 items ne sont pas tous des `-m` : le TP0 n'en
  a aucun, et chaque TP a sa fiche concept `-c0` et ses mises en route `-s`.

Les 29 items se répartissent en 3 · 5 · 8 · 7 · 6, ce que déclare `PROJET.sql`.

### La carte « Appel du jour »

Toutes les classes à la fois, sans changer de sélection. Chaque classe affiche,
juste sous le compte, **la ligne des numéros absents en gros** (`.ac-nums`) :
c'est ce qu'on lit à voix haute pour le cahier d'appel, donc rien ne doit
passer devant. Les noms restent en dessous, sur les pastilles, pour lever un
doute — jamais à la place des numéros.

`numerosAbsents()` trie numériquement (`7` avant `14`), le bouton « Copier » de
la classe copie `02, 07, 14`, et « Copier tous les absents » copie, par classe,
la ligne de numéros puis la ligne nommée en dessous.

La correspondance numéro → nom vit dans `localStorage` (`tdc-noms`), saisie à la
main dans le panneau « Noms des étudiants… ». **Elle ne part jamais vers la
base** : la table `eleves` reste sans nom. Ne pas proposer de la mettre dans
`config.js` — le dépôt est public.

---

## Points de vigilance

- **`index.html` est autonome et unique.** Ne pas le découper en modules ni le
  réécrire : les animations, le minuteur et le mode classe y sont imbriqués.
- **Ne jamais committer la clé `service_role`.** Seule la clé `anon` va dans
  `config.js`, et c'est prévu : les règles RLS la rendent inoffensive.
- **Les vues `v_appel` et `v_absences` sont révoquées pour `anon` et
  `authenticated`.** Elles se lisent depuis le SQL Editor, pas depuis le front.
- **Le PIN est stocké en clair**, volontairement : l'enseignant doit pouvoir le
  redonner à un étudiant qui l'a perdu. Ne pas proposer de le hacher.
- **L'avatar est unique dans la classe** — c'est ce qui rend le repère visuel
  fiable en projection. Les comptes de test prennent 🧪 et 🔬.

## Workflow

Le dépôt est **public** et publié par GitHub Pages. Demander confirmation avant
tout `git push`.
