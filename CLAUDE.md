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

## L'espace enseignant

`chargerStats()` charge en parallèle `eleves`, `reponses` et `corriges` pour la
séance sélectionnée, puis alimente Progression, Classement et Répartition.

`estEvaluee()` distingue les deux natures de réponse du système :

- **une question de quiz** — `correct` vaut `true` ou `false` ;
- **une mission cochée** — `reponse` vaut `"ok"` ou `"ko"`, et n'entre pas dans
  le taux de réussite. C'est ce qui permet au même écran de suivre le BTS1
  (quiz par séance) et le BTS2 (missions de TP).

Ne pas réécrire cette distinction : une mission cochée n'est pas une bonne réponse.

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
