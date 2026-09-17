# Portail BTS SIO — point d'entrée unique

Portail commun de Guillaume Gaillard, année 2026-2027.
<https://ggaillard.github.io/portail-bts/> — dépôt public `ggaillard/portail-bts`.

Répondre en **français**. Modifier directement les fichiers, ne pas se contenter de suggérer.

**[`REFONTE.md`](REFONTE.md)** — l'audit chiffré du 16/09/2026 et le plan de
découpage en modules ES, en étapes cochables. À lire avant toute intervention
de fond sur `index.html` ou sur la navigation : plusieurs défauts y sont déjà
nommés et mesurés, et l'ordre des étapes est choisi. `node outils/mesurer.mjs`
recompte ses chiffres et échoue quand le document a vieilli.

---

## Ce que fait ce dépôt

`index.html` (**509 lignes**) + `styles/` (dix feuilles) + `js/` :

| module | ce qu'il porte |
|---|---|
| `socle.js` | le client Supabase, `$`, l'état partagé `suivi`, les utilitaires d'affichage, la file d'attente de l'étudiant, la table des noms locale |
| `navigation.js` | les deux barres d'onglets, et l'onglet dans l'adresse |
| `afaire.js` | « Ce qui bloque » : la carte épinglée et ses gestes |
| `appel.js` | l'appel du jour, l'humeur, l'assiduité, les numéros absents |
| `enquetes.js` | « Faisons connaissance » (98) et « Recherche de stage » (97) |
| `ensemble.js` | le semestre et les projets |
| `controle.js` | le contrôle d'entrée, des deux côtés de l'écran |
| `seance.js` | pré-vol, démarrer / clore, rafraîchir, chiffres, élève par élève |
| `heure.js` | le parcours de l'heure et le débriefing — les deux lectures qui se projettent |
| `ecran.js` | le mode classe projeté au tableau |
| `bibliotheque.js` | les questionnaires côté enseignant : modèles, affectations, réglages |
| `quiz.js` | les trois modes de rendu côté étudiant |
| `app.js` | l'orchestration : ouvrir l'un ou l'autre espace, la connexion, la déconnexion |

plus `config.js` (URL Supabase, clé anon, codes de classe). Trois rôles :

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

## L'espace enseignant — une zone épinglée, quatre onglets

Les cartes ont d'abord été empilées en trois étages sur une seule page. Cinq
cartes plus tard, l'appel — le geste de trente secondes qu'on fait chaque
heure — se trouvait au milieu d'un défilement de trois écrans. Depuis le
08/09, une seule chose reste toujours à l'écran, le reste vit dans un onglet.

| Zone | La question | Ce qu'on y trouve |
|---|---|---|
| **Épinglée** — Ce qui bloque | *Est-ce que je peux faire cours ?* | `a_faire()` — neuf règles, le geste à faire. Au-dessus des onglets, visible depuis n'importe lequel. Vert = fermer l'onglet. |
| Onglet **Appel du jour** | *Qui est là ?* | Les numéros absents en gros, toutes classes à la fois. **Ouvert par défaut** : c'est le geste du début d'heure. |
| Onglet **Vue d'ensemble** | *Où en est-on ?* | `semestre()` (les séances une par une), Vos classes, Tous les projets. |
| Onglet **Questionnaires** | *Que leur ai-je posé, hors quiz de séance ?* | La **bibliothèque** : les modèles, leurs affectations, puis les questionnaires ponctuels — Faisons connaissance, Recherche de stage. Les contrôles d'entrée n'y sont plus depuis le 17/09 (voir ci-dessous). |
| Onglet **Suivi d'une séance** | *Que s'est-il passé à la S2 ?* | L'**inventaire des contrôles d'entrée** (toutes classes, avec leur interrupteur), puis, pour **une séance choisie** : pré-vol, **parcours de l'heure**, cadence, réussite par question, élève par élève, contrôle d'entrée, débriefing. |

**Ne pas ajouter une carte sans décider de son onglet** — ou sans décider
qu'elle est bloquante, auquel cas elle rejoint `a_faire()` plutôt que de
devenir une carte de plus. La zone épinglée ne contient qu'`a_faire()`, et doit
le rester : c'est sa brièveté qui fait qu'on la lit.

Détails qui comptent, et qu'on retire par erreur en refactorant :

- la barre d'onglets est **collante** (`position:sticky`) — la carte d'appel
  est longue, et perdre le chemin du retour au milieu d'une liste d'absents est
  exactement le problème qu'on essayait de régler ;
- l'onglet Appel porte une **pastille** avec le nombre d'absents du jour, toutes
  classes confondues. Elle disparaît à zéro absent : un « 0 » rouge se lirait
  comme un incident ;
- le titre « Ce qui bloque » se **masque avec sa carte** quand `a_faire()` n'est
  pas déployée. Un intertitre au-dessus de rien se lit comme une panne ;
- flèches gauche/droite entre les onglets, un seul dans l'ordre de tabulation
  (`role="tablist"`, `aria-selected`, `tabindex`).

`semestre()` calcule quatre états — **à produire** (aucun corrigé), **prête**
(corrigés en place, personne n'a répondu), **en cours** (ouverte, des réponses
arrivent), **jouée**. Les séances 90 et au-delà en sont exclues : l'appel, la
connaissance et le stage ne sont pas des séances du semestre.

---

## Où en est la base, et ce qui a changé

**[`supabase/LISEZ-MOI.md`](supabase/LISEZ-MOI.md)** — les migrations et leur
déploiement automatique. Depuis le 8 septembre 2026, **le SQL ne se colle plus
à la main** : une migration poussée sur `main` est vérifiée sur une base neuve
puis appliquée à Supabase. Les scripts destructeurs ou à usage unique restent
dans `supabase/operations/`, hors du circuit automatique.

La carte **« À faire »** du portail (RPC `a_faire()`) remplace toute liste de
tâches tenue à la main : elle est recalculée depuis l'état réel de la base, donc
rien n'y reste par oubli.

**[`JOURNAL.md`](JOURNAL.md)** — l'état de chaque script SQL (commité ≠ exécuté),
ce qui a changé dans le code, et la requête de lecture seule qui vérifie tout
cela soi-même en trente secondes. À relire avant de conclure qu'un correctif est
en service : un script poussé sur GitHub n'est pas un script joué sur Supabase.

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
- **La question de repli propose trois lieux, et aucun aveu** : « Présent »,
  « Présent, à distance », « Présent, sur un autre poste ». « Présent, en
  retard » a été retiré le 16/09. Deux raisons, et la seconde est la vraie :
  `reponses.updated_at` horodate déjà l'arrivée à la minute près et la carte
  l'affiche, donc on faisait saisir une donnée qu'on possède ; et surtout, les
  trois autres options nomment un lieu quand celle-ci nommait un manquement —
  répondre à l'appel devenait un aveu, et la première chose que l'étudiant
  faisait de son heure était de se ranger du mauvais côté. **Ne pas la remettre,
  et ne pas ajouter d'option qui fasse déclarer une faute.**
- **Une option ne se retire jamais d'une question déjà répondue.** Les lettres se
  décaleraient — un « C » qui voulait dire « à distance » se relirait « sur un
  autre poste » — et on réécrirait après coup ce que les étudiants ont dit.
  `20260916080000_appel_sans_retard.sql` ne corrige que le modèle et les
  questions encore vierges ; les jours passés gardent leur formulation.
- Les bonnes réponses sont réparties sur A, B, C et D : ne pas les réaligner sur
  une même lettre en ajoutant des questions, les étudiants repèrent le motif.
- Vue `v_appel` : une ligne par étudiant et par appel, avec `present` et l'heure.
- Vue `v_absences` : le cumul par étudiant, avec les dates manquées.

Ne pas créer de table `presences` ni de RPC dédiée : le modèle existant suffit,
et tout ce qui passe par `reponses` alimente déjà le tableau de bord.

**La séance 99 ne se ferme pas, et c'est verrouillé en base.** Le 08/09 elle
avait été close sur le BTS2 : `repondre()` renvoyait `Seance fermee` et aucun
étudiant de deuxième année ne pouvait pointer — sans que l'écran dise pourquoi,
puisque `appel_du_jour()` fabrique la question même sur une séance fermée.
Depuis `20260908100000_appel_permanent.sql` : un déclencheur `appel_reste_ouvert`
rouvre toute ligne `numero = 99` qu'on tenterait de fermer, `clore_seance()`
refuse avec le motif `appel`, et le portail masque le bouton « Clore » sur la 99.
**Ne pas ajouter de chemin qui écrive `ouverte = false` sur une séance 99** —
et si un jour ce verrou gêne, le retirer explicitement, pas le contourner.

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

**Deux fonctions sont définies deux fois**, et c'est un piège qui a déjà mordu :

| Fonction | Définie dans | Celle qui gagne |
|---|---|---|
| `preflight_seance()` | `…_seance.sql` puis `…_projet.sql` | **projet** (passe après) |
| `suivi_projet()` | `…_projet.sql` puis `…_questions.sql` | **questions** (passe après) |

Corriger la première version sans corriger la seconde ne sert à rien : la
seconde écrase, en silence. C'est ce qui est arrivé au filtre du compte
d'essai n° 99 — corrigé dans `seance.sql` le 7/09, réécrasé par `projet.sql`
à chaque exécution jusqu'au 8/09. Le workflow contrôle maintenant l'effectif
du pré-vol pour que la régression soit rouge.

`suivi_projet()` est définie **deux fois** — dans `PROJET.sql` et redéfinie à
l'identique dans `QUESTIONS.sql`. Les deux doivent rester d'accord : rejouer
`PROJET.sql` après `QUESTIONS.sql` écraserait l'autre sinon.

### Le quiz BTS2 : sept blocs pour cinq TP

La clé est `q-<indice du bloc>-<question>`, et l'indice du bloc **n'est pas**
le numéro du TP — le TP1 et le TP2 ont deux blocs chacun :

| bloc | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| TP | 0 | 1 | 1 | 2 | 2 | 3 | 4 |

`QUIZ_ENONCES.sql` copie les 35 énoncés en base à leur bonne séance, pour que
la « Réussite par question » montre la question et non la clé. Leur
`bonne_reponse` porte la lettre juste **pour la relecture seulement** : le
tableau de bord corrige lui-même et envoie `ok`/`ko`, donc `correct` reste à
false sur ces lignes. C'est normal, ne pas chercher à le « réparer ».

### La carte « Appel du jour »

Toutes les classes à la fois, sans changer de sélection. Chaque classe affiche,
juste sous le compte, **la ligne des numéros absents en gros** (`.ac-nums`) :
c'est ce qu'on lit à voix haute pour le cahier d'appel, donc rien ne doit
passer devant. Les noms restent en dessous, sur les pastilles, pour lever un
doute — jamais à la place des numéros.

`numerosAbsents()` trie numériquement (`7` avant `14`), le bouton « Copier » de
la classe copie `02, 07, 14`, et « Copier tous les absents » copie, par classe,
la ligne de numéros puis la ligne nommée en dessous.

### La hauteur de la carte est une contrainte, pas un détail

Le 16/09, mesurée : **1 399 px sur un téléphone** pour deux classes. Ce qu'on
vient y chercher — le compte et les numéros absents — faisait 232 px ; les
1 167 px restants le poussaient vers le bas. Quatre gestes, tous mesurés :

| | Avant | Après | Pourquoi |
|---|---|---|---|
| La question de repli | 46 px × classe | 23 px en tout | Elle est la même partout : elle monte en tête de carte **quand elle est identique**, et chaque classe reprend la sienne dès qu'elles diffèrent — à ce moment-là, la différence est l'information. `hisserQuestion()` |
| L'humeur | 133 px × classe | 44 px × classe | Repliée, résumé chargé : « Humeur — 22 réponses, surtout « Ça va » ». Elle ne se lit pas au même moment que l'appel. Un total à zéro n'affiche plus rien. |
| L'assiduité | 130 px | 90 px | « 3/6 absences, pas vu depuis 7 j » tient sur une ligne ; « 3 absences sur 6 » passait à la ligne sur un téléphone. Le chiffre est entier, c'est la formulation qui maigrit. |
| Les classes | l'une sous l'autre | deux colonnes ≥ 58 rem | En dessous, une seule colonne : deux colonnes de 200 px couperaient la ligne des numéros en deux. |

**1 399 → 1 090 px** sur un téléphone, **1 334 → 922 px** sur un bureau.

**La ligne des numéros absents n'a pas bougé d'un pixel, et ne doit pas bouger.**
C'est celle qu'on lit à voix haute. Le bouton « Copier » qu'elle porte fait
22 px et doit rester petit — l'agrandir la repousserait vers le bas à chaque
classe — donc sa zone tactile est étendue par un pseudo-élément : 44 px sous le
doigt, 22 px à l'écran. Il était sous la règle des 44 px depuis le début et
aucun contrôle ne le voyait ; celui qui devait le voir, `t_ens_mob.mjs`, n'a
jamais été déposé dans le dépôt.

**`outils/t_appel.mjs`** mesure tout cela et refuse quatre choses : un
débordement horizontal, une cible tactile sous 44 px (zone étendue comprise —
un contrôle qui ne regarderait que la boîte déclarerait « Copier » faux à tort),
une carte au-dessus de **1 150 px** à 390 px, et la question de repli écrite
plus d'une fois. Il tourne en local, sans base :

```
npx playwright install chromium
node outils/t_appel.mjs
```

Le plafond est arbitraire ; ce qui compte est qu'il ne remonte pas sans qu'on le
décide. Les quatre contrôles ont été essayés en cassant chacun exprès.

La correspondance numéro → nom vit dans `localStorage` (`tdc-noms`), saisie à la
main dans le panneau « Noms des étudiants… ». **Elle ne part jamais vers la
base** : la table `eleves` reste sans nom. Ne pas proposer de la mettre dans
`config.js` — le dépôt est public.

---

## Migration depuis l'ancienne base D1

Relevé du 07/09/2026, avant suppression du Worker `suivi` et de la base D1
`tour-de-controle` :

| Table D1 | Lignes | Sort |
|---|---|---|
| `progression` | 14 | **migrée** — les 14 séances du semestre, `MIGRATION_D1.sql` |
| `eleves` | 30 | non migrée — prénoms seuls, `email` et `mdp` vides |
| `reponses` | 1 | non migrée — la ligne de test « ESSAI Alice » |
| `jetons`, `pl_eleves`, `pl_jalons`, `pl_tp`, `pl_accueil`, `pl_jetons` | 0 | vides |

**Aucun travail d'étudiant n'existait dans D1.** Le BTS2 est passé directement
à Supabase, les tables `pl_*` n'ont jamais servi.

Deux raisons de ne pas réutiliser les prénoms de D1, et pas seulement la
première : la table `eleves` de Supabase ne porte aucun nom, et surtout **la
numérotation de D1 n'est pas celle d'aujourd'hui** — l'export d'août s'arrêtait
à 18, le n° 3 y désigne quelqu'un d'autre que le n° 3 actuel. S'en servir pour
l'appel donnerait une liste fausse.

---

## Les séances de cours du BTS1

`BTS1_SEANCES.sql` crée les séances 1 et 2 et leurs dix corrigés chacune.
**Sans séance en base, rien n'est enregistré** : le site du cours appelle
`repondre(seance_id, 'q1', 'B')`, et l'appel échoue en silence.

Les clés `q1` à `q10` ne sont pas choisies ici : `docs/assets/suivi.js` du dépôt
`BTS1_S1_B1_DEV` les fabrique en lisant la numérotation du bloc « Réviser après la
séance ». **La page fait foi pour l'énoncé et l'ordre des options ; la base fait foi
pour la bonne réponse.** Changer l'un oblige à changer l'autre — l'un ne se déduit
pas de l'autre.

Séances créées **fermées** : c'est « Démarrer la séance » qui ouvre et lance le
chrono. Une séance ouverte d'avance, c'est une classe qui répond la veille.

Le script sait aussi rattraper un corrigé déjà présent mais vide d'intitulé et
d'options — cas d'une séance créée à la main. Il ne réécrit une `bonne_reponse`
que si la ligne n'avait jamais été renseignée.

---

## L'appel — ce qu'il montre, et pourquoi

Trois défauts corrigés le 09/09, tous visibles à l'écran :

- **Le compte d'essai n° 99 comptait comme absent.** Tous les jours, pour
  toutes les classes : « 8 absents » quand il y en avait 7, et un effectif de
  32 pour 31 étudiants. Le filtre `numero <> '99'` existe partout ailleurs et
  manquait dans `appel_classe()` seule. **Le vérifier en ajoutant toute
  fonction qui compte des étudiants.**
- **Aucun dénominateur.** « 24 présents » ne dit pas s'il en manque un ou
  douze. `appel_classe()` rend `inscrits` ; la carte affiche « 24 / 31 ».
- **Aucune mémoire.** Une absence isolée et une quatrième d'affilée demandent
  deux gestes différents. La fonction rend maintenant, pour chaque absent,
  `manquees` / `sur` (combien d'appels posés il n'a pas honorés) et `depuis`
  (jours depuis sa dernière venue), ou `jamais`. La carte en tire un bloc
  « Absences qui se répètent », à partir de deux absences.

**Les prénoms.** Ils sont affichés **collés aux numéros** dans la ligne rouge,
qui est celle qu'on lit à voix haute : elle doit se suffire. `prenomSeul()`
prend le dernier mot qui n'est pas tout en majuscules — les listes collées
viennent en « NOM Prénom » — et à défaut la chaîne entière. **Rien n'est
inventé, et rien n'entre en base :** `appel_classe()` ne rend que des numéros.

Conséquence directe de ce choix : les noms vivent dans le `localStorage` du
navigateur, donc **chaque appareil a besoin de sa copie** — le poste de la
salle, puis le téléphone. Le portail le dit lui-même quand une classe n'a pas
de noms chargés, avec le bouton pour les coller. Sans ce message, on croyait la
carte cassée plutôt qu'à une liste jamais collée.

La rangée de pastilles d'absents a disparu : elle répétait mot pour mot la
ligne rouge. Les arrivées, elles, sont **repliées sur un téléphone** et
dépliées sur grand écran — vingt-quatre lignes à franchir avant d'atteindre ce
qu'on cherche vraiment, qui manque.

---

## Publiée, ouverte : deux choses différentes

Le 09/09, la séance 1 faite avec le BTS1 — et la séance 2 déjà lisible sur le
site du cours. Rien ne l'empêchait : le sommaire de MkDocs liste les quatorze
séances dès qu'elles sont écrites, et `ouverte` ne gouverne que
l'enregistrement des réponses.

| Colonne | Ce qu'elle décide | Quand elle est vraie |
|---|---|---|
| `ouverte` | La séance **accepte des réponses** | Pendant l'heure |
| `publiee` | Les étudiants ont le droit de la **lire** | À partir du jour de la séance, **et pour toujours** |

`publiee` ne redevient pas fausse toute seule : la trace écrite sert à réviser,
et un absent doit pouvoir rattraper. **Clore une séance ne la dépublie pas** —
un test le vérifie, parce que c'est le raccourci qu'on prendrait un jour.

**« Démarrer la séance » publie aussi.** On ne démarre jamais une séance qu'on
voulait cacher, et un geste de plus le jour J serait un geste oublié un jour
sur deux. `publier_seance(seance_id, publiee)` sert aux exceptions : ouvrir en
avance pour un absent, refermer un brouillon parti trop tôt. Elle refuse les
numéros ≥ 90 — questionnaires et appel n'ont pas de trace écrite à dévoiler.

Le portail montre l'état dans « Le semestre » : un bouton **Visible / Cachée**
par séance. `semestre()` rend donc `seance_id` et `publiee` — sans le premier
on ne peut pas basculer, sans le second on ne sait pas quoi basculer.

**Côté site du cours** (`docs/assets/suivi.js`, dépôt étudiant), deux gestes, et
il faut les deux :

1. **Le sommaire est élagué** sur *toutes* les pages du site, pas seulement
   celles de séance : c'est dans le menu qu'on clique pour aller voir trop loin.
2. **Le contenu d'une séance non publiée est masqué**, titre excepté, remplacé
   par « Cette séance n'a pas encore eu lieu ». Ne pas reprendre la formule de
   la séance fermée — « le contenu ci-dessous reste consultable » — qui
   dévoilerait exactement ce qu'on protège.

**La session anonyme est établie AVANT de lire les publications.** Sans elle la
requête peut échouer, la liste revient vide, et rien n'est élagué : le défaut
reviendrait à l'identique, en silence.

---

## Le contrôle d'acquis — avant la séance, pas après

Avant chaque séance et chaque TP, les étudiants répondent sur les notions déjà
vues. **Deux questions par notion**, et c'est l'écart entre les deux qui vaut
le détour :

| | Ce qu'elle mesure |
|---|---|
| `pre-NN` | Ce qu'ils **savent**. Quatre options, une bonne. |
| `pre-NN-c` | Ce qu'ils **croient savoir**. « Je saurais l'expliquer » … « Je ne sais plus ». `bonne_reponse = 'Z'`. |

Se tromper en étant sûr n'appelle pas le même geste que douter en ayant juste.
Un chiffre unique confondrait les deux. Le tableau de bord affiche donc
`surs_et_faux` **avec les numéros** : ceux-là ne poseront pas de question, ils
ne savent pas qu'ils ont tort.

**Le contrôle appartient à la séance qu'il précède** — ses questions sont des
corrigés de cette séance. Pas un questionnaire de la bibliothèque : la bande
90-98 n'aurait pas tenu quatorze séances, et rien n'aurait relié le contrôle à
son heure.

**Le préfixe `pre-` n'est pas décoratif.** C'est lui qui tient le contrôle hors
des chiffres du quiz de fin. Quatre endroits font le tri, et il faut les
quatre — trois en SQL, un dans le portail :

| Où | Sinon |
|---|---|
| `semestre()` | « 83 % juste » mélangerait ce qu'ils savaient avant et ce qu'ils ont appris pendant |
| `questions_seance()` | « Réussite par question » listerait vingt questions pour une séance qui en pose dix |
| `preflight_seance()` | « 10 questions corrigées » en annoncerait vingt |
| `chargerStats()` | Une progression de 20/10, et un taux de réussite faux |

**Toute nouvelle fonction qui compte des questions ou des réponses de séance
doit exclure `pre-%`.**

`debriefing()` suit la même règle : elle ne lit que les clés `^q[0-9]+$`.

**Trois états, trois interrupteurs**, et ils ne se déduisent pas l'un de
l'autre : `controle_ouvert` (le contrôle est proposé — **avant** la séance),
`publiee` (la trace écrite est lisible), `ouverte` (les réponses sont
acceptées).

Les fonctions : `creer_controle(seance_id, texte)` — une notion par ligne,
options séparées par « · », **une étoile devant la bonne** ; `ouvrir_controle()` ;
`mes_controles()` côté étudiant ; `controle_seance()` côté enseignant.

Règles qui ne se devinent pas :

- **Une ligne sans étoile, ou avec deux, fait échouer toute la création**, en
  disant laquelle. Un contrôle dont une notion n'a pas de bonne réponse
  compterait tout le monde faux sans que personne ne s'en aperçoive.
- **Réécrire un contrôle est refusé dès qu'une réponse existe** — le réécrire
  effacerait les réponses. Éteindre reste possible, et ne perd rien.
- **Aucune correction n'est montrée à l'étudiant.** Dire « faux » avant la
  séance transforme un point de départ en sanction, et fausse la question de
  certitude qui suit immédiatement.
- **Rien ne bloque.** La séance s'ouvre même sans le contrôle ; le tableau de
  bord nomme ceux qui ne l'ont pas fait. Un blocage transformerait un oubli en
  incident à gérer en début d'heure.
- La carte passe **en tête de la file étudiante**, avant les questionnaires :
  la proposer plus bas reviendrait à la proposer trop tard.

---

## Le débriefing — après la séance, et projeté

Le contrôle d'acquis dit ce qu'ils avaient gardé de la dernière fois ; le
débriefing dit **ce qu'ils emportent de celle-ci**. Même carte, même écran, aux
deux bouts de l'heure.

Jusqu'ici l'heure se terminait sur « Réussite par question » : un tableau juste,
mais qui parle de questions. Un élève lit « q7 : 41 % » et n'en fait rien. Le
débriefing renverse la lecture — on projette les **concepts**, et chacun porte la
mesure de ce que la classe vient d'en montrer.

```
Concept 2 — Les codes de statut        ▓▓▓▓▓▓░░░░  62 %   fragile
            mesuré sur les questions 3, 4 et 5
```

### D'où viennent les concepts

**Le support est la source.** Chaque trace écrite porte une section « Concepts à
connaître » (voir le `CLAUDE.md` du dépôt de cours). Mais le portail ne lit pas le
markdown, et c'est le portail qui projette : la liste est donc **recopiée en base**
par une migration, et le workflow `fiche` vérifie que les deux disent la même
chose — même discipline que pour les corrigés.

| | |
|---|---|
| `concepts` | table : `seance_id`, `rang`, `intitule`, `detail`, `questions int[]` |
| `definir_concepts(seance_id, texte)` | un concept par ligne : `Intitulé — le détail. [3 4 5]` |
| `debriefing(seance_id)` | les indicateurs de l'heure **et** les concepts mesurés |

`questions` est ce qui transforme un taux de réussite en phrase utilisable :
sans lui, le concept s'affiche « sans mesure » — il est projeté quand même, sans
chiffre. Mieux vaut un blanc qu'un zéro, qui se lirait « personne n'a réussi »
au lieu de « on n'a pas mesuré ».

### Les seuils

`acquis ≥ 75 %` · `fragile 45–74 %` · `à revoir < 45 %`. Arbitraires, et c'est
assumé : ce qui compte est qu'ils soient **les mêmes d'une séance à l'autre**,
sinon deux concepts ne se comparent plus. Ils vivent dans `debriefing()`, à un
seul endroit.

Le taux d'un concept se calcule sur **l'ensemble de ses questions réunies**, pas
comme la moyenne de leurs taux : deux questions inégalement répondues ne pèsent
pas pareil, et la moyenne des taux le cacherait.

### L'écran projeté

Quatrième vue du mode classe, à côté de Progression / Classement / Répartition —
bouton **Débriefing**, ou **Projeter** depuis la carte du suivi, qui ouvre l'écran
directement dessus.

Règles qui ne se devinent pas :

- **Il n'entre pas dans la rotation automatique.** Il conclut l'heure, il ne
  tourne pas pendant. Cliquer « Débriefing » arrête d'ailleurs la rotation : on
  ne veut pas que l'écran reparte sur le classement au milieu de la conclusion.
- **Aucun avatar, aucun nom, aucun podium.** Un concept « à revoir » désigne un
  point du cours, jamais quelqu'un. C'est la différence de nature avec les trois
  autres vues, et c'est pour ça que l'écran est volontairement calme.
- **Le mobilier de l'heure en cours est masqué** : « personne n'a encore
  répondu » sous un débriefing se lit comme une contradiction.
- **Une phrase de conclusion nomme ce par quoi on recommence** — « On reprend la
  prochaine fois par le 3. » Sans elle, l'écran ne dit rien à faire.
- **Un numéro de question inexistant fait échouer toute l'écriture**, en le
  nommant : un concept mesuré sur une question qui n'existe pas afficherait
  « 0 % » sans que personne ne comprenne pourquoi.
- **Réécrire est libre** — aucune réponse d'élève n'est attachée à un concept.
  C'est ce qui distingue `definir_concepts()` de `creer_controle()`.
- **L'appel et les questionnaires (n° ≥ 90) n'ont pas de concepts.** Rien à y
  conclure.

Et la boucle : **les concepts d'une séance sont exactement ce que teste le
contrôle d'entrée de la suivante.** Écrire les uns, c'est écrire l'autre.

### Où on le voit — et pourquoi ce n'est pas là qu'on l'écrit

Un contrôle appartient à sa séance, donc **tout ce qui le concerne est sous
« Suivi d'une séance »** : l'inventaire en tête de l'onglet, l'éditeur plus bas
derrière deux sélecteurs. Il a vécu jusqu'au 17/09 à cheval sur deux onglets —
l'inventaire sous « Questionnaires », l'éditeur ici — avec deux libellés et
deux niveaux de titre : on ne savait pas lequel faisait autorité, donc on
regardait les deux. **Ne pas en remettre une moitié ailleurs.** Le 15/09, huit notions posées sur le TP2 du BTS2 y ont
été cherchées dans **Questionnaires**, où elles n'étaient pas : écrites,
appliquées en base, et introuvables. Le modèle était bon ; **c'est la lecture qui
manquait.**

`controles()` rend la liste de tout ce qui est écrit — classe, séance, nombre de
notions, allumé ou non, combien y ont répondu — et la carte « Contrôles
d'entrée » de l'onglet Questionnaires l'affiche, avec l'interrupteur et un
bouton qui ouvre la séance concernée dans l'onglet du suivi.

**Cette carte ne sait pas écrire un contrôle, et c'est volontaire.** Un contrôle
s'écrit en regardant la séance qu'il prépare ; deux endroits pour le même geste,
c'est la garantie que l'un des deux divergera. Elle répond à trois questions et
pas une de plus : qu'est-ce qui existe, pour quelle classe, les étudiants le
voient-ils.

`a_faire()` porte la neuvième règle correspondante — **contrôle écrit mais
éteint, sur une séance pas encore démarrée**. Après le démarrage, éteint est
l'état normal et la règle se tait. ⚠️ `a_faire()` est **réécrite en entier** dans
`20260915120000_controles_visibles.sql`, et c'est cette définition qui gagne :
corriger `20260908080000_a_faire.sql` sans corriger celle-ci ne changerait
rien — le piège de `preflight_seance()`, une troisième fois.

---

## Le parcours de l'heure — où en est chacun, et où en est le groupe

Chaque heure commence par la même suite, et elle n'était lisible nulle part
d'un seul tenant : l'appel dans son onglet, l'humeur sous la classe, le
contrôle d'entrée derrière deux sélecteurs, le quiz dans les tuiles. Quatre
écrans pour une question qu'on se pose debout, une fois par heure — **qui n'a
pas démarré ?**

| | L'étape | Où elle vit |
|---|---|---|
| 1 | **Appel** | séance 99, `appel-AAAA-MM-JJ` |
| 2 | **Comment ça va** | séance 99, `humeur-AAAA-MM-JJ` |
| 3 | **Contrôle d'entrée** | les `pre-NN` de **cette** séance — ce qu'ils ont gardé du cours d'avant |
| 4 | **Le quiz** | les questions de la séance, ou **les jalons du TP** quand c'en est un |

`parcours_seance(seance_id)` rend deux lectures d'une même donnée, calculées au
même endroit — même principe que `bibliotheque()` :

- **`etapes`** — l'entonnoir : 28 → 25 → 18 → 0. Où ça coince pour le groupe.
- **`eleves`** — la ligne par étudiant, avec **`bloque`** : la *première* étape
  non faite. C'est elle qu'on lit en séance, parce qu'elle nomme le geste.

Règles qui ne se devinent pas :

- **La quatrième étape se compte différemment selon la nature de la séance.**
  `seances.jalons` distingue les deux, comme le fait déjà `suivi_projet()` : un
  TP se mesure en jalons franchis (`tp%` à `true`/`ok`), une séance de cours en
  questions répondues. Le nom de l'étape change avec — « Le quiz de la séance »
  ou « Le TP » — et **le portail lit ce nom dans la réponse**, il ne le réécrit
  pas : deux noms pour la même chose à deux endroits de l'écran est ce qui fait
  douter de ce qu'on lit.
- **Une étape non posée n'est pas une étape à zéro.** Pas de contrôle écrit →
  `pose = false`, et l'écran dit « pas posé ». « 0 / 13 » se lirait « personne
  ne l'a fait ». Même choix que `debriefing()`, qui préfère un blanc à un zéro.
  Et **une étape non posée ne bloque personne** : le portail ne doit jamais
  envoyer voir quelqu'un pour un contrôle qui n'existe pas.
- **Le jour est celui de la séance, pas aujourd'hui** (`demarree_le::date`).
  Avec `current_date`, relire le parcours d'une séance passée afficherait toute
  la classe absente.
- **La liste est triée par l'étape où l'on bute, pas par numéro ni par
  « bloqué ou non ».** Celui qui n'a pas pointé passe avant celui qui n'a pas
  fini le quiz : c'est l'ordre dans lequel on va les voir.
- **`numero <> '99'` et `pre-%` exclu du quiz** — les deux règles habituelles,
  et deux assertions les tiennent dans la migration.
- **Une séance ≥ 90 n'a pas de parcours** : elle *est* une étape du parcours
  d'une séance de cours. La RPC refuse avec le motif `pas_un_cours`.

### La vue projetée ne montre aucun numéro

Le parcours se projette **pendant** l'heure — contrairement au débriefing, qui
la conclut — et il reste donc dans la rotation automatique, juste après la
progression. Mais il n'affiche **que les quatre barres** : projeter « il manque
le 07 à l'appel » désigne quelqu'un devant la classe, quand « il en manque
trois » fait le même travail — chacun sait s'il a pointé — sans mettre personne
au tableau. **Le détail par étudiant reste sur l'écran de l'enseignant**, qui
est le seul à le regarder. Ne pas ajouter les numéros à la vue projetée.

Les entamés apparaissent derrière les finis, en teinte plus sombre : sans cette
nuance, « 0 / 31 » sur le quiz laisse croire que personne n'a commencé alors
que neuf sont dessus.

---

## Les questionnaires — une bibliothèque, pas des numéros en dur

Un questionnaire était un numéro de séance écrit dans le code : 98 pour
« Faisons connaissance », 97 pour « Recherche de stage ». En ajouter un
troisième demandait une migration, un numéro, une fonction côté étudiant, une
fonction de dépouillement — autrement dit : moi. Ce n'est pas tenable pour
quelque chose qu'on écrit la veille d'un cours.

**Le modèle est à deux étages :**

| | Ce que c'est | Ce qu'il porte |
|---|---|---|
| **Modèle** (`modeles`, `modele_questions`) | Le texte, écrit une fois | Titre, intro, mode d'affichage, les questions |
| **Affectation** (une `seance`, `modele_id`) | Le questionnaire donné à une classe | Ses propres corrigés, ses propres réponses |

Écrire « Faisons connaissance » une fois et l'affecter à deux classes donne
deux séances, deux jeux de réponses, **un seul texte à corriger**.

**La bande 90-98 est celle des questionnaires.** En dessous, les séances de
cours. Au-dessus, 99, l'appel, qui ne se ferme pas. Les trois se pilotent avec
trois gestes distincts, et cela doit le rester :

| Nature | Le geste | Pourquoi il est à part |
|---|---|---|
| cours (< 90) | `demarrer_seance()` / `clore_seance()` | Elles portent un chrono |
| questionnaire (90-98) | `ouvrir_questionnaire()` | Pas de chrono, pas de note |
| appel (99) | aucun — verrouillé ouvert | Le fermer coupe le pointage |

Les fondre en une fonction unique ferait qu'un jour l'une fermerait l'autre.
C'est exactement ce qui s'est produit avec `preflight_seance()` définie deux
fois.

**Les fonctions :**

| Fonction | Ce qu'elle fait |
|---|---|
| `bibliotheque()` | Les modèles avec leurs affectations, **et** les classes avec ce qui y est posé. Deux lectures d'une même chose, calculées au même endroit. |
| `creer_modele(titre, intro, mode, texte)` | Analyse un bloc collé : une question par ligne, intitulé puis 2 à 4 options séparés par « · » ou « \| ». |
| `affecter_questionnaire(modele_id, classe_id)` | Crée la séance **fermée** et copie les questions en corrigés. |
| `retirer_questionnaire(seance_id)` | Efface la séance — **refuse dès qu'une réponse existe**. |
| `supprimer_modele(modele_id)` | Idem, sur tout le modèle. |
| `mes_questionnaires()` | Côté étudiant : tous les questionnaires ouverts de sa classe, d'un coup. |
| `depouiller_questionnaire(seance_id)` | Les réponses de n'importe lequel. Même sortie que `connaissance_classe()`, dont elle est calquée. |

**Règles qui ne se devinent pas :**

- **`creer_modele()` refuse tout dès qu'une ligne est mal formée, et dit
  laquelle.** Ignorer la ligne en silence donnerait un questionnaire amputé
  d'une question sans que personne ne le sache — pire qu'un refus.
- **`bonne_reponse = 'Z'`** sur les corrigés d'un questionnaire : aucune option
  n'existe sous cette lettre, donc rien n'est compté juste. C'est ce qui
  distingue un questionnaire d'un quiz.
- **L'affectation crée une séance fermée.** Préparer et publier d'un même clic
  ferait apparaître chez les étudiants ce qu'on venait d'écrire.
- **Retirer refuse dès qu'il y a des réponses ; éteindre, jamais.** Éteindre
  retire le questionnaire de l'écran des étudiants sans rien perdre, et c'est
  ce qu'on veut presque toujours. Le portail **le dit avant le clic** : dès que
  `commences > 0`, le bouton « Retirer de la classe » est désactivé et une
  ligne explique pourquoi. Le message de refus reste, en second rideau.
- **Le mode appartient au modèle** : `sequentiel` (une question à la fois, sans
  retour) ou `revisable` (tout à l'écran, modifiable).
- `connaissance()` et `stage()` **restent** et ne sont pas modifiées : le
  portail s'en sert en repli tant que la bibliothèque n'est pas déployée. Repli
  à retirer une fois la migration passée partout.

### Deux gestes, deux boutons — et pas une case à cocher

Une ligne de classe portait **une case à cocher** (l'affectation) et **une
pastille** (l'interrupteur), le tout dans un `<label>` cliquable de bout en
bout. Décocher appelait `retirer_questionnaire()`, qui **efface la séance**.
Autrement dit : vouloir arrêter un questionnaire et cliquer à côté de la
pastille supprimait l'affectation — et cliquer sur le texte « 19 / 31 terminés »
aussi, puisque le label entier basculait la case.

Depuis le 15/09, la ligne porte **deux boutons nommés** et aucune zone cliquable
par accident :

| | Le geste | Ce qu'il fait | Réversible ? |
|---|---|---|---|
| Affectation | **Donner à cette classe** / **Retirer de la classe** | Crée ou efface la séance de cette classe | Retirer devient **impossible** dès la première réponse |
| Visibilité | **Proposé / Éteint** | Décide si les étudiants le voient | Toujours, autant de fois qu'on veut |

L'interrupteur est placé **avant** le retrait : c'est le geste courant, celui
qu'on refait. Retirer est rare et destructeur, il vient après — et il est
**désactivé avec sa raison écrite** dès que `commences > 0`, plutôt que de
laisser partir un clic qui échouera de toute façon.

### « Avec la séance… » — un questionnaire rattaché à un moment du semestre

Un questionnaire était donné à une **classe**, et rien ne disait à quel moment
il allait. On l'allumait à la main le jour dit, on l'éteignait le lendemain
quand on y repensait.

`seances.rattachee_a` porte désormais le lien : *ce questionnaire accompagne la
séance N*. **Le modèle ne change pas** — le questionnaire reste une séance
90-98 avec ses corrigés et ses réponses, et les trois natures gardent leurs
trois gestes. On ajoute une colonne, pas une fusion.

| | |
|---|---|
| `rattacher_questionnaire(seance_id, cible)` | attache ; `cible` à null détache |
| déclencheur `rattachement_coherent` | refuse : un cours qui se rattache, une cible ≥ 90, une cible d'une autre classe |
| déclencheur `questionnaire_suit` | le questionnaire **suit `ouverte`** de sa séance |

**Un déclencheur sur la colonne, pas une retouche de `demarrer_seance()` et
`clore_seance()`** : toutes les routes qui ouvrent une séance passent par
`ouverte`, aucune par une seule fonction. Retoucher les deux fonctions aurait
laissé passer les chemins qu'on oublie, et il aurait fallu les réécrire en
entier — avec le risque d'écrasement qu'on connaît. Pas de récursion : le
déclencheur ne s'arme que sur `numero < 90` et n'écrit que sur des 90-98.

Règles qui ne se devinent pas :

- **Rattacher à une séance déjà en cours l'allume tout de suite.** « La séance
  du jour » n'aurait aucun sens si elle n'allumait rien.
- **Détacher n'éteint pas.** Un questionnaire visible qui disparaîtrait de
  l'écran des étudiants parce qu'on a changé son rangement serait une surprise.
  L'interrupteur reste le seul geste qui décide de ce qu'ils voient.
- **La cible supprimée détache le lien** (`on delete set null`) : un
  rattachement vers une séance disparue allumerait ou n'allumerait rien, au
  hasard.
- ⚠️ `bibliotheque()` est **réécrite en entier** dans
  `20260916060000_questionnaire_rattache.sql` — elle y gagne le rattachement de
  chaque affectation et la liste `seances` des cibles possibles, `en_cours`
  marquant la séance du jour. C'est cette définition qui gagne.

### Le mode « révision » — le seul écran étudiant qui dise « faux »

Le 16/09, un questionnaire de révision a été cherché pour préparer l'interro
écrite sur la POO. Il n'existait pas, et **aucun des deux mécanismes en place ne
pouvait en tenir lieu** :

| | Pourquoi il ne peut pas servir à réviser |
|---|---|
| Contrôle d'acquis | Ne montre jamais la correction, et c'est voulu : `mes_controles()` ne rend que l'intitulé et les options. Dire « faux » avant la séance transforme un point de départ en sanction, et fausse la question de certitude qui suit. |
| Questionnaire ordinaire | `bonne_reponse = 'Z'` : aucune option n'est juste, donc il n'y a rien à corriger. |

Réviser demande l'inverse : répondre, se tromper, **voir pourquoi**,
recommencer. C'est une troisième intention, et elle prend la forme d'un
**troisième mode du modèle** — pas d'une quatrième nature de séance. Le
questionnaire de révision reste une séance 90-98, avec son affectation, son
interrupteur et son rattachement.

| mode | à l'écran | correction |
|---|---|---|
| `sequentiel` | une question à la fois, sans retour | aucune |
| `revisable` | tout à l'écran, modifiable | aucune |
| `revision` | une à la fois, et on peut tout refaire | **après chaque réponse** |

**Écrire un questionnaire de révision** : une **étoile devant la bonne option**
— même convention que `creer_controle()`, pour n'avoir qu'une chose à retenir —
et une **flèche `→`** (ou `->`) introduit l'explication :

```
Un objet, c'est : · le modèle écrit une fois · *l'exemplaire fabriqué · une méthode
  → La classe est le moule, l'objet le gâteau.
```

Règles qui ne se devinent pas :

- **La bonne réponse ne vit pas dans `modele_questions`.** Cette table est
  lisible par tout le monde — sa politique dit `for select to anon,
  authenticated using (true)`, et c'est délibéré. Vérifié le 16/09 avec la clé
  publique : `GET /rest/v1/modele_questions` rend tout, `GET /rest/v1/corriges`
  rend `[]`. Les lettres justes vivent donc dans **`modele_corriges`**, sans
  aucune politique pour `anon` : sans politique, RLS refuse tout. **Ne jamais
  ajouter de colonne de correction à `modele_questions`** — ce serait publier la
  grille.
- **La correction ne sort que sur une question déjà répondue**, et c'est
  `mes_questionnaires()` qui tient la règle, pas la page. La fonction est
  appelée avec la clé publique : la livrer d'avance mettrait le corrigé entier à
  une requête de distance.
- **La page ne devine jamais la bonne réponse.** Après chaque envoi elle
  redemande `mes_questionnaires()` — un appel de plus, sur un questionnaire
  qu'on fait chez soi. Calculer le verdict côté page voudrait dire lui avoir
  envoyé la grille.
- **Une ligne sans étoile fait échouer toute la création**, en disant laquelle.
  Une question sans bonne réponse compterait la classe entière fausse.
- **Une étoile ou une flèche dans un mode qui ne corrige pas est refusée** :
  l'étoile finirait affichée telle quelle, l'explication ne serait jamais lue.
- **La carte ne se replie pas quand tout est répondu**, contrairement aux deux
  autres, et elle ne compte pas dans la file d'attente : un questionnaire de
  révision se refait, et le refermer sur un « c'est fait » enlèverait ce qu'on
  vient d'y mettre.
- **Les réponses de révision n'entrent dans aucun chiffre du semestre** :
  `semestre()` exclut la bande 90-98, et le tableau de bord ne lit qu'une séance
  choisie. `correct` est renseigné — c'est ce qui permet de dire « juste » — mais
  rien ne le compte ailleurs.
- ⚠️ `creer_modele()`, `affecter_questionnaire()` et `mes_questionnaires()` sont
  **réécrites en entier** dans `20260916070000_questionnaire_revision.sql`, et ce
  sont ces définitions qui gagnent. Corriger les versions du 08/09 sans corriger
  celles-ci ne changerait rien — le piège de `preflight_seance()`, une quatrième
  fois.

Le questionnaire posé : `revision-poo-tp1`, douze questions, affecté au BTS2
SLAM, **créé fermé**. Ses questions ne sont **pas** celles du contrôle d'acquis
de la séance 2, délibérément : réviser sur les huit mêmes notions, correction
affichée, viderait le contrôle de son sens. Elles couvrent en revanche les cinq
exercices de l'interro — vocabulaire, choix `List` / `Dictionary`, requêtes
LINQ, trace console, lecture de code.

---

## Le portail enseignant sur un téléphone

Il se pilote au téléphone en séance, pas seulement à la souris au bureau.

> **Ce document a menti ici jusqu'au 17/09 :** il annonçait une vérification par
> `t_ens_mob.mjs` — @fantome t_ens_mob.mjs, cité ici pour dire qu'il n'a jamais
> existé dans ce dépôt, et `outils/mesurer.mjs` refuse désormais toute autre
> citation d'un contrôle absent. Les quatre
> points ci-dessous sont des mesures réelles, faites une fois, à la main — pas
> des contrôles qui tournent. Ce qui tourne aujourd'hui et couvre une partie de
> cette liste : `outils/t_appel.mjs` (la carte d'appel, quatre largeurs),
> `outils/t_pilotage.mjs` (« Ce qui bloque » et les Questionnaires),
> `outils/t_suivi.mjs` (les tuiles de chiffres). Le reste attend son contrôle.

Mesuré à 390 px :

- **aucune cible tactile sous 44 px** — onglets, sélecteurs, boutons,
  interrupteurs. `input, select` et `.btn` portent `min-height:44px` ;
- **la barre d'onglets tient sur une ligne** et défile latéralement. Quatre
  onglets sur 390 px passaient sur deux lignes, soit 88 px perdus en
  permanence puisqu'elle est collante ;
- **« Élève par élève » passe avant « Réussite par question »** : sur un
  téléphone, en séance, c'est la première chose qu'on veut voir ;
- **les énoncés de la séance sont repliés et placés après les chiffres.**
  Dépliés et placés avant, ils faisaient deux mille pixels à franchir avant
  d'atteindre la moindre information sur la classe. **4 651 px de page avant,
  2 900 après.**

---

## L'espace étudiant sur un téléphone

La plupart des étudiants répondent au téléphone. Trois contraintes, vérifiées
par **`outils/t_etudiant.mjs`** à 360, 390 et 768 px — le contrôle porte ce nom
depuis le 17/09 ; le `t_mobile.mjs` que ce document citait avant n'a jamais
existé dans ce dépôt (@fantome t_mobile.mjs), et pendant ce temps cet écran
n'était vérifié par rien :

- **aucun débordement horizontal** — la page ne défile jamais latéralement ;
- **aucune cible tactile sous 44 px de haut**, interrupteurs compris ;
- **la page raccourcit à mesure qu'on avance** : 1 660 px à 390 px avec l'appel
  et l'humeur encore à faire, et chaque carte finie rendue à son titre.

Le contrôle vérifie aussi que **le compteur du bandeau vaut exactement le
nombre de cartes visibles ni faites ni hors file** : un « 2 » quand il en reste
trois, et l'étudiant croit avoir fini.

Trois mécanismes, à ne pas défaire :

1. **Une file d'attente.** Un bandeau collant en haut compte ce qui reste avant
   « Vos projets », et propose un raccourci vers eux **une fois la présence
   marquée seulement** — c'est la seule chose qui ne peut pas attendre. Pas
   d'énumération dans le bandeau : à 390 px elle passait sur trois lignes.
2. **Chaque carte porte son rang**, recalculé à l'affichage (`data-n`). Selon
   la classe et le jour il y a deux cartes ou quatre : un numéro figé mentirait
   une fois sur deux.
3. **Une carte finie se replie** sur son titre et une ligne verte
   (`data-fait="oui"`). Elle ne disparaît pas — « il était là tout à l'heure »
   se lit comme un bogue.

**Typographie : `typo()` avant tout intitulé affiché.** Elle pose une espace
fine insécable (U+202F) devant `? ! ; :` et dans les guillemets français. Sans
elle, « Dans « SI », que veut dire le I ? » se coupait en fin de ligne et
laissait le « ? » seul sur la sienne.

**Le piège du découpage.** Le 08/09, une refonte de l'espace étudiant a
emporté sept fonctions — `repondreAppel`, `proposerHumeur`, `texteEnvoi`… —
sans qu'aucun contrôle ne bronche : `node --check` ne voit qu'une syntaxe
valide, et l'erreur n'arrive qu'au clic, en séance. Le workflow vérifie
désormais que **toute fonction appelée est définie**. Ne pas retirer ce
contrôle.

**Et le piège des `<span>` :** `.projet-t`, `.qa-t`, `.qa-d` sont des `<span>`.
Sans `display:block`, leur marge basse n'agit pas et le titre se colle à sa
description. Le défaut est passé deux fois — le vérifier en ajoutant un libellé.

---

## Classes réelles et classes de démonstration

**Un code de classe qui commence par `DEMO` désigne une démonstration.** La
convention existait déjà côté base — `a_faire()` écrit `code not like 'DEMO%'`
— elle est maintenant la même dans le portail, avec `estDemo()` et
`classesReelles()` comme seuls points de décision.

Les démos sont écartées de **tout ce qui se lit en séance** : appel du jour,
questionnaires, `semestre()`, tableau « Vos classes », dépôts. Elles restent
dans les **deux sélecteurs de classe** — celui du suivi et celui de
l'identification — rangées dans un `<optgroup>` « Démonstration », parce que
c'est là qu'on va quand on veut justement faire la démo.

Créer une démo = créer une classe dont le code commence par `DEMO`. La retirer
de partout = renommer son code. Aucun autre geste, aucune liste à tenir.

**Ne pas coder en dur `BTS1-DEV-2026` / `BTS2-SLAM-2026` dans le portail :** les
codes changent chaque année, la convention non.

---

## Un projet appartient à une classe

`projets.classe_id` : c'est ce qui décide de ce qu'un étudiant trouve dans
« Vos projets » après s'être identifié. L'espace enseignant les affiche donc
**groupés sous leur classe** (« Les dépôts, par classe »), et une classe sans
projet le dit à sa place — ses étudiants s'identifieraient pour ne rien
trouver. `a_faire()` le signale par ailleurs comme un point de vigilance.

---

## Un compte ne vit que sur un appareil à la fois

`rejoindre()` fait `update eleves set auth_id = auth.uid()`. **Le dernier
appareil identifié gagne, et l'ancien est délogé sans le savoir** : sa page
reste affichée comme si de rien n'était, et le premier envoi échoue avec
`Non identifie`. C'est arrivé le 08/09 sur le compte d'essai n° 99 du BTS2,
repris depuis un autre poste pendant qu'il était ouvert.

Cas réel en TP : un étudiant ouvre le portail sur le poste de la salle, puis
sur son téléphone ; de retour sur le poste, « ça ne marche plus ». Le remède
est « Ce n'est pas moi » puis se réidentifier — pas d'attendre.

Le portail traduit donc les échecs d'envoi en trois cas, dans `texteEnvoi()`,
et **les quatre points d'envoi passent par là** (appel, humeur, connaissance,
stage) :

| Erreur de la base | Ce que voit l'étudiant |
|---|---|
| `Non identifie` | Session reprise sur un autre appareil, se réidentifier. Le bouton « Ce n'est pas moi » passe en bouton principal. |
| `Seance fermee` | L'appel / la séance est fermée, prévenir l'enseignant. Réessayer n'y changerait rien. |
| autre | « Réessayez dans un instant » — le seul cas où c'est vrai. |

**Ne pas revenir à un message unique.** « Réessayez dans un instant » pour tout
est ce qui a fait chercher pendant deux séances une panne qui se réglait en un
clic.

---

## Points de vigilance

- **Le portail ne s'ouvre plus par double-clic.** `js/app.js` est un module ES,
  et un navigateur refuse un import depuis `file://`. En local :
  `node outils/serveur.mjs` puis <http://127.0.0.1:8080>, ou l'extension
  *Live Server* de VS Code. C'est le seul coût du découpage, il était mesuré
  avant d'être accepté.
- **Le découpage se poursuit par étapes, il ne s'improvise pas.**
  [`REFONTE.md`](REFONTE.md) tient le plan : A1 à A4, A7 et A8 sont faites, A5
  est commencée (`socle.js`, `ecran.js` sortis). **`app.js` n'a plus le droit
  de grossir** : `outils/mesurer.mjs` compare sa taille à la ligne
  `@chantier` de REFONTE.md et échoue si elle monte. Ne pas déplacer de fonction au détour d'une correction.
  L'avertissement d'origine — « les animations, le minuteur et le mode classe
  sont imbriqués » — a été mesuré : ces quatorze fonctions font 618 lignes et
  n'ont que quatre portes d'entrée (`modeEcran`, `rendreEcran`, `rotationAuto`,
  `fermerEcran`). Elles partiront **d'un seul tenant**, jamais en morceaux.
- **L'ordre des feuilles de `styles/` fait partie du rendu.** Deux règles de
  même spécificité se départagent par leur position ; le découpage a été fait
  par tranches contiguës pour n'y rien changer. Réordonner la liste de
  `index.html`, ou déplacer une règle d'une feuille à l'autre, peut modifier
  l'affichage sans modifier une déclaration. `node outils/comparer.mjs <avant>`
  compare boîte et styles calculés de chaque élément, à sept largeurs.
- **Les seuils de rupture sont déclarés une fois**, dans la table `@seuil` en
  tête de `styles/socle.css`. `outils/mesurer.mjs` refuse toute media query
  absente de cette table. Une variable CSS ne peut pas servir à cela :
  `@media (max-width: var(--x))` ne s'applique jamais.
- **Un nom qui déménage emmène ses usages.** C'est la faute du découpage, et
  elle est silencieuse : la page se charge, et l'erreur arrive à l'usage, sur
  un écran précis, peut-être en séance. Le contrôle du workflow ne la voit pas
  — il lit la concaténation des modules, où un import oublié est invisible.
  `outils/mesurer.mjs` lit chaque fichier séparément et refuse deux choses :
  appeler `machin()` sans l'avoir défini ni importé, et **employer** un nom
  qu'un autre module exporte sans l'importer (`SEM_ETAT[…]`, `suivi.seanceId`,
  un gestionnaire passé en valeur).
- **Un module d'écran n'importe jamais `app.js`.** Ce serait un cycle —
  `app.js` importe déjà l'écran. Ce qui descend (`$`, `suivi`, `typo`…) vient
  de `socle.js` ; ce qui remonte (`chargerDebrief`, `chargerParcours`) est
  reçu par `brancherEcran()`, appelée une fois au démarrage. **Un module
  possède aussi ses propres boutons** : les brancher ailleurs reviendrait à
  pouvoir déplacer l'un sans l'autre, et `comparer.mjs` ne verrait rien —
  c'est `outils/t_ecran.mjs` qui clique.
- **Sur le suivi d'une séance, le chiffre est PLUS GROS sur un téléphone qu'au
  bureau** — 1.7rem sous 34rem, 1.45rem au-dessus. Ce n'est pas une coquille :
  ces quatre tuiles sont ce qu'on lit debout, entre deux rangs, sans s'arrêter ;
  au bureau on les lit assis. La valeur « en activité » s'écrit **`12/31`, sans
  espaces** — avec elles, à 1.7rem, elle se coupe en deux à 360 px et la tuile
  gagne 30 px pour rien. Les marges, elles, restent à leur valeur de bureau :
  c'est leur réveil qui faisait déborder la page. `outils/t_suivi.mjs` mesure
  les trois. Et la grille s'écrit `minmax(0,1fr)`, jamais `1fr` : `1fr` vaut
  `minmax(auto,1fr)`, donc une colonne ne descend pas sous la largeur
  insécable de son contenu, et ces quatre valeurs viennent de la base.
- **`erreur()` ne concatène plus de données.** Elle construit sa carcasse et
  y verse le texte par `textContent`. Ne pas revenir à `innerHTML` : douze de
  ses appels y versent une valeur venue de la base.
- **L'onglet ouvert vit dans l'adresse** (`#appel`, `#ensemble`, `#quest`,
  `#seance`), et le titre de la page le suit. Un rechargement garde l'onglet,
  Précédent revient au précédent. `ouvrirOnglet(cle, adresse)` prend
  « pousser » (défaut), « remplacer » (à l'ouverture) ou « aucun » (quand on
  répond à un mouvement d'historique — y réécrire l'adresse ferait une boucle).
  La classe et la séance choisies n'y sont PAS : à décider avant de les y
  mettre, car il faudra trancher qui gagne quand l'adresse et les sélecteurs
  divergent.
- **Les deux barres d'onglets suivent le même motif** (ARIA Authoring
  Practices, *Tabs*) et vivent dans le même fichier, `js/navigation.js`. Elles
  ont divergé une fois — l'écran de connexion, le premier que voit un étudiant,
  n'avait ni flèches ni `tabindex` roulant. Les garder côte à côte est ce qui
  rendra la prochaine divergence visible.
- **Toute zone qui reçoit un message porte `aria-live="polite"`.** WCAG 4.1.3 :
  une erreur qui apparaît sans être annoncée n'existe pas pour qui n'a pas les
  yeux dessus. `outils/t_navigation.mjs` refuse toute zone `err-*` sans
  annonce — ajouter une zone de message, c'est ajouter l'attribut.
- **Les contrôles ouvrent le portail servi, pas réécrit.** `outils/serveur.mjs`
  le sert comme GitHub Pages, `outils/portail.mjs` substitue `config.js`, le
  client Supabase et une ligne du script au passage sur le réseau — et
  **échoue bruyamment** si son ancre disparaît, au lieu de passer au vert en ne
  testant rien.
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

Cinq contrôles tournent sur chaque poussée, et ils répondent à cinq questions
différentes :

| Workflow | Question |
|---|---|
| `verifier-portail.yml` · **syntaxe** | `index.html` s'affiche-t-il encore ? Syntaxe JS, `$("id")` existants, et **toute fonction appelée est-elle définie** |
| `verifier-portail.yml` · **gabarits** | Les chiffres de `REFONTE.md` sont-ils ceux du dépôt (`mesurer.mjs`), et les neuf contrôles de navigateur passent-ils ? `t_chargement` · `t_appel` · `t_revision` · `t_pilotage` · `t_ecran` · `t_messages` · `t_navigation` · `t_suivi` · `t_etudiant` |
| `verifier-portail.yml` · **coherence** | Les bonnes réponses de la base collent-elles aux supports ? |
| `verifier-portail.yml` · **fiche** | **Cette séance est-elle prête ?** Douze points, appliqués à chaque `docs/seances/seance-*.md` trouvée |
| `supabase.yml` · **verifier** | La chaîne de migrations se rejoue-t-elle deux fois sur une base vierge, et les invariants tiennent-ils ? |

### Un contrôle trop strict bloque plus qu'il ne protège

Le 16/09, deux migrations poussées les 15 et 16 étaient sur `main` et **pas**
dans la base : `controles()` répondait 404, `seances.rattachee_a` n'existait pas.
Le portail, lui, affichait la nouvelle IHM — il masque toute carte dont la RPC
manque, donc « Contrôles d'entrée » ne s'affichait nulle part et « Avec la
séance… » n'avait rien à proposer. On cherchait un bogue d'interface ; c'était
un déploiement arrêté.

Cause : `supabase.yml` · **verifier** exigeait que `a_faire()` renvoie **zéro
point, toutes gravités confondues**, sur une base neuve. Or la migration du
15/09 pose un contrôle d'acquis **éteint** sur la séance 2 du BTS2 — et la
neuvième règle d'`a_faire()`, ajoutée le même jour, existe précisément pour le
signaler. Le job est donc devenu rouge par construction. `appliquer` dépend de
`verifier` ; il n'a plus jamais tourné.

L'assertion vérifie maintenant ce qui est vraiment anormal :

- **zéro bloquant** — un bloquant sur une base neuve veut dire que la chaîne
  laisse la base dans un état où l'on ne peut pas faire cours ;
- **aucune tâche en double** — deux fois la même, c'est une insertion rejouée
  qui a dupliqué ce qu'elle posait, exactement ce que le second passage cherche ;
- les **attentions sont écrites au journal**, pas comptées comme des pannes.
  « Écrit mais pas encore allumé » est un état normal de préparation.

La leçon vaut au-delà de ce cas : **un contrôle qui prend un état normal pour
une panne ne rend pas la base plus sûre — il arrête le reste.** Avant de resserrer
une assertion, se demander ce qu'elle rendra rouge le jour où tout va bien.

### La fiche — pourquoi elle ne connaît aucun numéro de séance

Elle découvre les traces écrites par `glob`, et passe la même fiche à chacune.
Ajouter la séance 4 ne demande donc rien : elle est contrôlée dès qu'elle
existe. **Une checklist qu'on doit penser à étendre finit toujours par oublier
la séance du jour** — c'est la seule raison de ce choix.

Les douze points : le front-matter et le nom de fichier concordent · titre de
récit entre guillemets · cold open · au moins trois actes · au moins deux
indices repliés · l'adresse du portail présente et aucune adresse
décommissionnée · dix questions à quatre options non vides, sans code dans un
énoncé · une grille « Rép. » complète, en A–D, sans lettre bonne plus de quatre
fois · présente au sommaire de `mkdocs.yml` · un corrigé en base par question ·
un teaser · un bloc « À retenir » · **une liste « Concepts à connaître »
identique à celle de la base, dont les numéros de questions existent**.

Le dernier point est celui qui a motivé la fiche : sans lui, deux listes
divergent en silence et on débriefe sur des concepts que la trace écrite ne
nomme pas.
