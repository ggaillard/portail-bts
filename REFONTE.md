# Refonte du portail — audit mesuré et plan

Écrit le 16/09/2026. Chaque chiffre a été compté, pas estimé.

**Les sections 1 à 4 décrivent le portail AVANT le chantier**, le 16/09 au
matin : c'est le constat, il ne bouge plus, et c'est ce qui permet de mesurer
le chemin parcouru. **L'état d'aujourd'hui est au §5bis**, et
`node outils/mesurer.mjs` le recompte : il échoue quand le dépôt et ce
document ne disent plus la même chose, en nommant l'écart.

Ce document est fait pour être coché. Chaque étape du plan est livrable seule,
vérifiable seule, et annulable seule.

---

## 1. Ce qu'on a mesuré

### Le fichier

| | |
|---|---|
| `index.html` | **5 847 lignes**, 259 Ko |
| dont CSS (lignes 10-900) | 890 lignes, **476 règles**, **299 classes** |
| dont HTML (lignes 901-1345) | 444 lignes |
| dont JavaScript (lignes 1346-5845) | **4 499 lignes** |
| fonctions de premier niveau | **146** |
| variables de premier niveau | 17 |
| fonctions RPC appelées | **35** |

Les fonctions ne sont pas monstrueuses : **22 lignes de médiane**, 30 de
moyenne. Le problème n'est pas leur taille, c'est leur nombre au même endroit.
Les six plus longues :

```
248  rendreEcran          119  ligneControle
127  rendreRevision        92  rendreSuivi
123  chargerStats          92  rendreAFaire
```

### Ce que les fonctions touchent

En regroupant les 146 fonctions par les identifiants qu'elles manipulent, des
familles nettes apparaissent — la séparation existe déjà dans la tête, elle
n'est simplement écrite nulle part :

```
18  appel du jour          13  suivi d'une séance
16  socle (erreurs, DOM)   11  vue d'ensemble
16  questionnaires         10  contrôles d'entrée
14  écran projeté           3  connexion
41  indéterminé (utilitaires, petits rendus partagés)
```

### Le style

**13 media queries sur 10 seuils différents, écrites de quatre façons :**

```
@media (max-width: 30rem)     @media (max-width:620px)
@media(max-width:27rem)       @media (max-width:640px)
@media(max-width:33.9rem)     @media(min-width:34rem)
@media (min-width: 58rem)     @media(min-width:38rem)
```

620 px, 640 px, 27 rem, 30 rem, 33.9 rem, 34 rem, 38 rem, 58 rem : des pixels
et des rem mêlés, avec et sans espace, sans qu'aucun de ces seuils ne soit
nommé nulle part. Pour savoir ce qui change à 640 px il faut lire les 890
lignes. C'est la cause directe des trois séances passées à remesurer des
hauteurs au téléphone.

En revanche, les **17 variables CSS déclarées sont toutes utilisées** : la
palette et la typographie tiennent déjà. L'oubli est dans l'autre sens — une
`var()` employée sans être déclarée nulle part (§3.7).

### Les habitudes de code

| | |
|---|---|
| `createElement` | 161 |
| `textContent =` | 215 |
| `innerHTML =` | 114 |
| `addEventListener` | 61 |
| `onclick=` en chaîne de caractères | **0** |
| `style=` en dur (HTML + JS) | 25, plus 26 `.style.` |

Zéro `onclick` en chaîne : la règle est déjà tenue, sans être écrite. Le
gabarit habituel est sain — `innerHTML` pose une carcasse sans données, puis
`textContent` y verse les valeurs. C'est une bonne convention. Elle n'est
écrite nulle part, donc elle a une exception (§2.4).

---

## 2. Ce qui rend le dépôt difficile à maintenir

### 2.1 — Tout est dans un seul fichier

Conséquences concrètes, pas théoriques :

- **La recherche de texte ne discrimine plus.** `grep "controle"` renvoie du
  SQL, du CSS, du HTML et quatre familles de JavaScript.
- **L'outil de commit ne raconte plus rien.** Chaque modification est « M
  index.html », quel que soit son objet. La revue d'un diff de 5 847 lignes se
  fait sans repères.
- **Un conflit de fusion touche tout.** Deux modifications sans rapport se
  disputent le même fichier.
- **Le contexte à charger est toujours maximal.** Corriger la carte d'appel
  demande d'ouvrir les 4 499 lignes de script.

### 2.2 — Aucun seuil de rupture nommé

Voir §1. Dix seuils, quatre syntaxes, zéro nom. → **corrigé en A1** : six
seuils, une syntaxe, une table qui les déclare et un contrôle qui la fait
respecter (§5bis).

### 2.3 — Les tests savent voir, mais ils s'installent mal

`outils/t_appel.mjs`, `t_revision.mjs` et `t_pilotage.mjs` sont bons : chacun a
été cassé volontairement pour prouver qu'il voit ce qu'il annonce. Mais ils
ouvrent le portail en **réécrivant son HTML à coups d'expressions
régulières** :

```js
.replace(/<script src=[^>]*><\/script>/g, '')
.replace('<script>', faux + '<script>')
.replace('\n})();', '\nwindow.__e = { … };\n})();')
```

Le jour où une balise `<script>` change de forme, les trois fichiers cessent de
tester quoi que ce soit — sans échouer. Un test qui devient muet sans le dire
est pire qu'un test absent. Le découpage en modules impose de toute façon de
changer cette méthode, et la meilleure est plus simple (§4.3).

### 2.4 — `erreur()` écrit du HTML avec des données de la base

```js
function erreur(zone, texte, ok){
  $(zone).innerHTML = texte ? '<div class="msg…">' + texte + '</div>' : '';
}
```

`erreur()` est appelée depuis **72 endroits**, répartis dans 26 fonctions.
**Douze de ces appels** interpolent une valeur venue de la base :
`m.titre` (un titre de questionnaire), `c.nom` (un nom de classe),
`r.error.message`. Vérifié en exécutant le portail avec un titre contenant
`<img src=x onerror=…>` : **le code s'exécute**, l'image est créée, et le texte
affiché devient « `«  » a été supprimé.` ».

À mettre à sa juste place : aujourd'hui, seul l'enseignant crée des titres, et
l'enseignant est déjà le compte le plus puissant du portail. Ce n'est donc pas
une porte ouverte, c'est une porte sans serrure dans un couloir où personne
d'autre ne passe. Mais elle sera dans le passage le jour où un texte saisi par
un étudiant rejoindra `erreur()`. Le correctif fait trois lignes et ne change
aucun appel.

### 2.5 — Le déploiement a une marche invisible

Le 15/09, une assertion de `supabase.yml` exigeait zéro point dans `a_faire()`
sur une base neuve, alors qu'une migration y dépose volontairement un contrôle
éteint. Le job `appliquer` dépendant du job `verifier`, **cinq migrations sont
restées une semaine sur GitHub sans jamais atteindre la production**, pendant
que le portail appelait des fonctions absentes. Le job était rouge ; rien ne
disait que le déploiement, lui, était arrêté.

C'est corrigé, mais la leçon reste : il manque un endroit qui dise « la
production est-elle à jour ? » sans avoir à lire l'onglet Actions.

---

## 3. Ce qui rend le portail difficile à parcourir

Les normes de référence : **ARIA Authoring Practices** (motif *Tabs*) et
**WCAG 2.1 niveau AA**. Chaque point ci-dessous nomme le critère visé.

### 3.1 — Les quatre onglets ne relèvent pas de la même logique

| Libellé | Ce que c'est |
|---|---|
| Appel du jour | un **moment** |
| Vue d'ensemble | une **portée** |
| Questionnaires | un **objet** |
| Suivi d'une séance | une **activité** |

Un moment, une portée, un objet, une activité : quatre taxonomies dans une
barre de quatre onglets. Le lecteur ne peut pas déduire d'un onglet où
chercher, puisqu'il n'y a pas de règle à déduire. C'est le défaut de
cohérence classique, et c'est celui qui coûte le plus cher : il se paie à
chaque consultation, pour toujours.

### 3.2 — Les contrôles d'entrée sont dans deux onglets

- Onglet **Questionnaires** → carte « Contrôle**s** d'entrée » (`carte-controles`)
- Onglet **Suivi d'une séance** → bloc « Contrôle d'entrée » (`bloc-controle`)

Même objet, deux emplacements, deux libellés (pluriel / singulier), deux
niveaux de titre (`h2` / `h3`). On ne sait pas lequel fait autorité, donc on
regarde les deux.

Dans le même onglet **Questionnaires** cohabitent « Vos questionnaires » (la
catégorie) et « Faisons connaissance » et « Recherche de stage » (deux
questionnaires particuliers). Une catégorie et deux de ses membres au même
niveau.

### 3.3 — L'adresse ne dit jamais où l'on est

`location` n'apparaît qu'une fois dans tout le fichier, pour un
`location.reload()`. Donc :

- un rafraîchissement ramène **toujours** sur « Appel du jour » ;
- le bouton **Précédent** du navigateur quitte l'application au lieu de revenir
  à l'onglet précédent ;
- aucun onglet ne peut être mis en favori ni envoyé à quelqu'un ;
- le titre de la page ne change jamais : plusieurs onglets ouverts sont
  indiscernables.

C'est le point qui pèse le plus au quotidien, parce qu'il frappe à chaque
reprise de session — et en cours, on reprend la session vingt fois par heure.

### 3.4 — Deux systèmes d'onglets pour un seul motif

| | `.onglets` / `.onglet` (enseignant) | `.tabs` / `.tab` (connexion) |
|---|---|---|
| `role="tablist"` | oui | oui |
| flèches ← → | oui | **non** |
| un seul onglet tabulable | oui | **non** |
| `type="button"` | oui | **non** |

Le motif *Tabs* des ARIA Authoring Practices est correctement implémenté en
haut de l'espace enseignant, et pas du tout dans l'écran de connexion — le
tout premier écran que voit un étudiant. Deux implémentations à maintenir, dont
une fausse.

### 3.5 — Aucun message d'état n'est annoncé

**Zéro `aria-live`** dans tout le fichier, pour 72 appels à `erreur()` et des
rafraîchissements permanents. Une erreur apparaît sans que rien ne la signale à
qui n'a pas les yeux sur la bonne zone. C'est un manquement à **WCAG 4.1.3
(Messages d'état, niveau AA)**. Deux attributs le règlent.

### 3.6 — Pas de lien d'évitement

Aucun lien « Aller au contenu ». La carte « Ce qui bloque » étant épinglée
au-dessus des onglets, un usage au clavier la traverse à chaque fois.
**WCAG 2.4.1 (Contournement de blocs, niveau A)**. Une ligne de HTML et quatre
de CSS.

### 3.7 — Une variable de couleur jamais déclarée, et un texte illisible

```css
.db-v.sans_mesure{ background:var(--surface-2,#EEF1F4); color:var(--ink-faint) }
```

`--surface-2` n'est **définie nulle part** — ni en thème clair, ni en thème
sombre. La valeur de repli `#EEF1F4` s'applique donc toujours, y compris quand
tout le reste de la page est sombre. Contraste mesuré du texte sur ce fond :

| | |
|---|---|
| thème clair (`--ink-faint` = `#8697A6`) | **2,65 : 1** |
| thème sombre (`--ink-faint` = `#71828F`) | **3,50 : 1** |

**WCAG 1.4.3 (Contraste minimum, niveau AA)** exige 4,5 : 1 pour du texte
normal. Les deux thèmes échouent, le clair largement. C'est la seule des 17
variables de couleur qui manque à l'appel — les 16 autres sont déclarées dans
les deux thèmes et utilisées. Une valeur de repli dans un `var()` est
précisément ce qui fait qu'un oubli ne se voit pas : la page ne casse pas, elle
devient seulement illisible à un endroit. `outils/mesurer.mjs` refuse désormais
toute `var(--x)` sans déclaration.

### 3.8 — Ce qui va déjà bien, et qu'il ne faut pas casser

À dire, parce qu'une refonte détruit surtout par inadvertance :

- `lang="fr"`, `viewport` correct, un seul `h1`, hiérarchie de titres sans saut ;
- `prefers-reduced-motion` respecté (3 occurrences) ;
- `:focus-visible` traité ;
- cibles tactiles à 44 px, atteintes et vérifiées ;
- aucune image, donc aucun `alt` manquant ;
- 17 variables CSS déclarées, toutes utilisées (le manque est à l'inverse : une
  `var()` sans déclaration, §3.7).

---

## 4. Le découpage proposé

Modules ES natifs, **sans outil de compilation**. GitHub Pages sert les `.js`
tels quels : votre *Commit + Sync* dans VS Code continue de suffire, et il n'y
a aucune étape à ne pas oublier avant de publier.

### 4.1 — L'arborescence

```
index.html              structure seule, ~450 lignes
config.js               inchangé, script classique, chargé avant les modules
styles/
  socle.css             variables, seuils, typographie, boutons, cartes, champs
  navigation.css        onglets, volets, file d'attente, lien d'évitement
  appel.css  questionnaires.css  seance.css  ecran.css
js/
  socle.js              CFG, $, sb, erreur(), typo(), pousse(), son()
  session.js            connexion, qui_suis_je, déconnexion, session périmée
  navigation.js         onglets, volets, et l'état dans l'adresse
  afaire.js             « Ce qui bloque » et ses gestes
  appel.js              appel du jour, humeur, assiduité
  ensemble.js           semestre, projets, jalons
  questionnaires.js     bibliothèque, affectations, réglages
  quiz.js               les trois modes de rendu côté étudiant
  controles.js          contrôles d'entrée — un seul endroit
  seance.js             pré-vol, parcours, débriefing, statistiques
  ecran.js              vue projetée
  etudiant.js           espace étudiant
  app.js                assemblage et démarrage
outils/
  serveur.mjs           petit serveur statique, partagé par les tests
  mesurer.mjs           recompte les chiffres de ce document
  t_*.mjs               inchangés dans leur intention
```

### 4.2 — Vérifié, pas supposé

Un prototype à quatre fichiers a été monté et exécuté avant d'écrire ce plan :

- modules ES avec imports relatifs servis en HTTP : **fonctionnent**, zéro erreur ;
- `config.js` en script classique s'exécute **avant** les modules : `window.TDC_CONFIG` est lu correctement ;
- le client Supabase du CDN, script classique lui aussi, est disponible dans les modules ;
- la fausse couche Supabase des tests s'injecte par `page.route()`, **sans toucher `index.html`**.

### 4.3 — Ce que le découpage apporte aux tests

Aujourd'hui les tests charcutent le HTML (§2.3). Avec des modules, ils
n'auront plus le choix — et la méthode obligatoire est meilleure :

```js
await p.route('**/supabase-js@2/**', (r) => r.fulfill({ … }));
await p.goto(url);   // le portail réel, servi tel qu'il sera publié
```

Le portail testé devient le portail publié, au lieu d'une version réécrite par
expression régulière.

### 4.4 — Ce plan lève une règle écrite dans `CLAUDE.md`

Il faut le dire franchement, parce que la règle est explicite et qu'elle a été
écrite pour une bonne raison :

> **`index.html` est autonome et unique.** Ne pas le découper en modules ni le
> réécrire : les animations, le minuteur et le mode classe y sont imbriqués.

L'objection porte sur un groupe précis. Il a donc été mesuré plutôt que discuté.
Les quatorze fonctions du mode classe — `rendreEcran`, `minuteur`, `confettis`,
`rotationAuto`, `pleinEcran`, `banniere`… — pèsent **618 lignes** et
communiquent avec le reste du portail par :

| | |
|---|---|
| appels **sortants** | `anime`, `entree`, `pousse`, `typo` (des utilitaires de socle), `chargerDebrief`, `chargerParcours` |
| appels **entrants** | `modeEcran`, `rendreEcran`, `rotationAuto`, `fermerEcran` — et rien d'autre |

Quatre portes d'entrée pour 618 lignes : ce n'est pas un enchevêtrement, c'est
un module qui s'ignore. La règle décrivait ce qu'on croyait du code ; la mesure
dit autre chose.

Ce qui reste vrai dans l'avertissement, et qui est repris dans le plan : ce
groupe **part d'un seul tenant**, jamais en morceaux, et **l'étape A3 publie
d'abord un module unique contenant tout le script actuel**, vérifié en
production, avant qu'une seule fonction ne bouge. `CLAUDE.md` est à mettre à
jour au moment d'engager A3 — pas avant, pour qu'une session qui lirait le
dépôt entre-temps ne découpe rien sur la foi d'un plan non commencé.

### 4.5 — Ce qu'on perd, et il faut le dire

**Ouvrir `index.html` par double-clic cessera de marcher.** Mesuré :

```
Access to script at 'file:///…/js/app.js' from origin 'null'
has been blocked by CORS policy
```

Les modules ES exigent `http://` ou `https://`. Aujourd'hui le fichier unique
s'ouvre depuis le disque ; demain il faudra un serveur local — l'extension
*Live Server* de VS Code, ou `npx serve`, ou `node outils/serveur.mjs`. Une
touche à presser, mais c'est une habitude à changer, et c'est le seul vrai
coût de ce plan.

---

## 5. Le plan, par étapes

Chaque étape est publiable seule. Aucune n'a besoin de la suivante pour être
utile, et chacune s'annule par un `git revert` d'un seul commit.

### Chantier A — Le code

- [x] **A1. Un seul jeu de seuils.** ✅ 16/09. Dix seuils en quatre syntaxes →
      **six, en rem, écrits pareil**, déclarés dans une table `@seuil` en tête
      de `styles/socle.css` que `outils/mesurer.mjs` lit et fait respecter.
      *Le plan disait « six variables CSS » : c'était faux, et c'est mesuré —
      `@media (max-width: var(--x))` ne s'applique jamais, les custom
      properties ne sont pas évaluées dans une media query et `@custom-media`
      n'existe dans aucun navigateur. On ne remplace donc pas l'écriture, on
      refuse ce qui sort de la liste.*
- [x] **A2. Le CSS dans `styles/`.** ✅ 16/09. 926 lignes → **dix feuilles**,
      découpées par tranches contiguës pour que l'ordre de la cascade ne bouge
      pas d'un cran. `outils/comparer.mjs` : identique aux sept largeurs.
- [x] **A3. Le script en module.** ✅ 16/09, **à publier et à vérifier en
      production avant A5**. `index.html` passe de 5 847 à **472 lignes** ;
      `js/app.js` porte les 4 529 lignes, sans une virgule de changée.
      `comparer.mjs` : identique aux sept largeurs.
- [x] **A4. Les contrôles ouvrent le portail réel.** ✅ 16/09.
      `outils/serveur.mjs` le sert comme GitHub Pages ; `outils/portail.mjs`
      substitue `config.js`, le client Supabase et **une seule ligne** dans le
      script, au passage sur le réseau. Les trois `t_*.mjs` n'ont plus une
      seule expression régulière sur le HTML.
- [x] **A5-A6. Le découpage est fait.** ✅ 17/09. `app.js` est passé de
      **4 529 à 582 lignes**, et **treize modules** existent :

      | | | | |
      |---|---|---|---|
      | `socle.js` 372 | `appel.js` 521 | `ecran.js` 646 | `afaire.js` 243 |
      | `navigation.js` 146 | `enquetes.js` 253 | `seance.js` 579 | `heure.js` 305 |
      | `ensemble.js` 290 | `controle.js` 361 | `bibliotheque.js` 488 | `quiz.js` 340 |

      Ce qui reste dans `app.js` : ouvrir l'espace étudiant, ouvrir l'espace
      enseignant, la connexion, la déconnexion, la liste des classes. C'est
      l'orchestration, et c'est tout — il n'a plus de sujet à lui.
      *(note d'origine, 16/09 :*
      `js/socle.js` (167 l.) et `js/ecran.js` (646 l.) sont sortis. Reste
      `quiz.js`, `appel.js`. *Le plan disait « les feuilles d'abord, le socle
      ensuite ». Faux dans ce sens : un module d'écran a besoin de `$`, de
      `suivi`, de `typo` ; si le socle est encore dans `app.js`, l'écran doit
      importer `app.js`, qui importe l'écran — un cycle. Le socle sort en
      premier, et plus personne n'importe personne.)*
- [x] **A6bis. Le reste.** ✅ 17/09. `ensemble.js`, `appel.js`, `enquetes.js`,
      puis le morceau le plus enchevêtré — le suivi d'une séance — en trois :
      `controle.js` (le contrôle d'entrée), `seance.js` (pré-vol, pilotage,
      chiffres) et `heure.js` (le parcours et le débriefing, les deux lectures
      qui se projettent). Enfin `afaire.js`, la carte épinglée.
- [x] **A7. `erreur()` réparée.** ✅ 16/09. La carcasse se construit sans
      jamais concaténer de données ; aucun des 73 appels n'a changé.
      `outils/t_messages.mjs` rejoue l'injection et vérifie aussi que le texte
      s'affiche **en entier** — échapper en mangeant la moitié du message
      serait un autre défaut, pas un correctif.
- [x] **A8. `outils/mesurer.mjs`.** ✅ 16/09. Recompte les chiffres, tient la
      table des seuils, refuse une `var()` non déclarée, et surveille la
      taille des modules — `app.js` ne peut que diminuer (§6.1).

### Chantier B — La navigation

- [x] **B1. L'onglet est dans l'adresse.** ✅ 17/09. `#appel`, `#ensemble`,
      `#quest`, `#seance` ; le titre de la page suit ; Précédent revient à
      l'onglet précédent ; un rechargement garde l'onglet. La classe et la
      séance choisies n'y sont pas — ce serait utile pour partager un lien,
      mais il faudrait décider ce qui gagne quand l'adresse et les sélecteurs
      divergent. Une chose à la fois.
- [x] **B2. Les contrôles d'entrée, en un seul endroit.** ✅ 17/09. La carte
      d'inventaire rejoint l'onglet « Suivi d'une séance », au-dessus de
      l'éditeur : un contrôle appartient à la vie d'une séance, pas à la
      bibliothèque. *Le plan disait « la carte disparaît, un lien la
      remplace » : à la relecture, non — elle et le bloc plus bas ne font pas
      la même chose. Elle est l'INVENTAIRE (ce qui existe, pour quelle classe,
      les étudiants le voient-ils) et ne sait pas écrire un contrôle,
      volontairement. La supprimer aurait retiré la seule vue d'ensemble.*
      Mesuré à 390 px : onglet Questionnaires **1 604 → 996 px**, Suivi
      1 575 → 2 207 px. L'onglet Questionnaires est désormais la bibliothèque,
      et rien d'autre.
- [x] **B3. Un seul système d'onglets.** ✅ 17/09. L'écran de connexion suit
      le même motif que l'espace enseignant : `type="button"`, un seul onglet
      tabulable, flèches ← →, `aria-selected` en toutes lettres. Les deux
      barres vivent maintenant dans `js/navigation.js`, côte à côte : c'est ce
      qui rendra la prochaine divergence visible.
- [x] **B4. `aria-live`.** ✅ 17/09. Les seize zones de message, la pastille
      d'état de « Ce qui bloque », le bandeau de file de l'étudiant et la ligne
      de chargement : dix-neuf annonces là où il n'y en avait aucune.
- [x] **B5. Lien d'évitement.** ✅ 17/09. Premier élément focalisable de la
      page, invisible tant qu'il n'a pas le focus — sorti de l'écran, pas
      masqué : `display:none` le retirerait aussi de l'ordre de tabulation.
- [x] **B5bis. `--surface-2` déclarée.** ✅ 16/09. `.db-v.sans_mesure` utilise
      `--surface-alt` et `--ink-soft` : 4,84 : 1 en clair, 6,52 : 1 en sombre,
      contre 2,65 : 1 avant (§3.7).
- [ ] **B6. Renommer les onglets dans une seule taxonomie** (§3.1). Proposition
      à trancher ensemble, pas à appliquer d'office :

  | Aujourd'hui | Proposition | Ce que c'est |
  |---|---|---|
  | Appel du jour | **Aujourd'hui** | la journée |
  | Suivi d'une séance | **La séance** | l'heure en cours |
  | Vue d'ensemble | **Le semestre** | le semestre |
  | Questionnaires | **Ma bibliothèque** | le matériel réutilisable |

  Les trois premiers sont trois échelles de temps — jour, heure, semestre — et
  se déduisent l'un de l'autre. Le quatrième reste à part, et c'est assumé :
  une bibliothèque de matériel réutilisable est un lieu, pas un moment. Une
  taxonomie à deux catégories clairement séparées vaut mieux que quatre
  catégories mêlées.

- [x] **B8. Les tuiles de chiffres sur un téléphone.** ✅ 17/09. Leur mise en
      forme étroite était écrite mais sans effet depuis le début (§5bis). Elle
      est rétablie, pas telle quelle : le chiffre passe à **1.7rem sous 34rem**
      et **revient à 1.45rem au-dessus** — plus gros sur un téléphone qu'au
      bureau, et c'est le sens de l'écran, celui qu'on lit debout entre deux
      rangs. Les marges, elles, n'ont pas été touchées : c'est leur réveil qui
      faisait déborder la page de 36 px.

      La valeur « en activité » s'écrit désormais **`12/31` et non `12 / 31`** :
      avec les espaces, à 1.7rem, elle se coupe en deux à 360 px et la tuile
      gagne 30 px pour rien (mesuré : tuile 75 → 105 px, grille 175 → 205 px).
      Serrée, elle tient — et c'est aussi comme cela qu'on écrit un score.

      Mesuré aux sept largeurs, contre l'état du 16/09 :

      | Largeur | Chiffre | Grille des quatre tuiles |
      |---|---|---|
      | 360 px | 23,2 → **27,2 px** | 166 → **175 px** |
      | 390 px | 23,2 → **27,2 px** | 166 → **175 px** |
      | 480 px | 23,2 → **27,2 px** | 149 → **158 px** |
      | 620 px | inchangé | 96 → **88 px** (une valeur ne se coupe plus) |
      | 640 / 768 / 1280 px | inchangé | **identique au pixel** |

      Neuf pixels pour un chiffre 17 % plus grand, et rien d'autre ne bouge :
      `outils/comparer.mjs` ne relève, sous 544 px, que les tuiles et le
      décalage vertical de ce qui les suit. Nouveau contrôle : `t_suivi.mjs`
      (le huitième), cassé de quatre façons avant d'être cru — chiffre revenu
      à la taille du bureau, espaces remis dans « 12 / 31 », carte des
      contrôles renvoyée dans Questionnaires, `minmax(0,1fr)` redevenu `1fr`.

- [x] **B7. L'espace étudiant.** ✅ 17/09, **et il dément ce que j'en avais
      dit** : voir « Ce que B7 a démenti » au §5bis. Mesuré plutôt que lu, cet
      espace tient déjà ses promesses — bandeau qui compte ce qui reste, rang
      sur chaque carte, carte finie repliée et non disparue, 1 660 px à 390 px
      sans débordement, aucune cible sous 44 px. Le travail livré ici n'est
      donc pas une refonte, c'est de le mettre **sous mesure** :
      `outils/t_etudiant.mjs`, le neuvième contrôle, et le premier à regarder
      l'écran que trente personnes ouvrent en même temps.

### Ordre conseillé

`A1 → A2 → A3` (publier, vérifier en production) `→ A4 → B1 → B2 → B3 → B4 →
B5 → A5 → A6 → A7 → A8 → B8 → B7 → B6`.

**Tout est fait sauf B6**, qui arrive en dernier **exprès** : renommer les
onglets pendant l'année scolaire désoriente ; la fin d'un semestre est le bon
moment, et c'est une décision à prendre ensemble, pas à appliquer d'office.
B8 et B7 ont changé de place dans l'ordre parce que B8 est né d'une découverte
faite en A1 — une règle écrite qui ne s'appliquait pas — et qu'il valait mieux
la traiter tant qu'on l'avait sous les yeux.

---

## 5bis. Journal des mesures

`outils/mesurer.mjs` compare le dépôt à la ligne « aujourd'hui ». Quand une
valeur bouge parce que le plan avance, on met à jour **le tableau et le
fichier** : c'est ce qui les empêche de diverger en silence.

| | 16/09 avant | après A1-A4 |
|---|---|---|
| `index.html` | 5 847 lignes | **472** |
| feuilles de style | 0 | **10** (1 054 lignes) |
| modules | 0 | **1** (4 529 lignes — la marche A3) |
| règles CSS | 476 | 470 |
| media queries | 13 | 12 |
| seuils distincts | 10 | **8** (6 de largeur + 2 de préférence) |
| fonctions de premier niveau | 146 | 146 |
| `aria-live` | 0 | 0 *(chantier B)* |

Après A5 (partiel) et A7 :

| | après A1-A4 | après A5-A7 |
|---|---|---|
| modules | 1 | **3** — `app.js` 3 845, `ecran.js` 646, `socle.js` 167 |
| contrôles d'écran | 3 | **6** |
| `innerHTML =` | 114 | 113 |

Après B1, B3, B4, B5 (17/09) :

| | après A5-A7 | après B1-B5 |
|---|---|---|
| modules | 3 | **4** — `navigation.js` 146 |
| `js/app.js` | 3 845 | **3 802** |
| `aria-live` | 0 | **19** |
| contrôles | 6 | **7** |
| `location` dans le code | 1 (un `reload`) | l'adresse porte l'onglet |

Après B2 et la suite du découpage (17/09) :

| | après B1-B5 | aujourd'hui |
|---|---|---|
| modules | 4 | **13** |
| `js/app.js` | 3 802 | **582** |
| contrôles | 7 | 7, plus deux règles neuves dans `mesurer.mjs` |

**Le chantier A est terminé.** `index.html` : 5 847 → 509 lignes. Le style dans
dix feuilles, le script dans treize modules dont aucun ne dépasse 646 lignes, et
`app.js` réduit à ce qu'il aurait toujours dû être : l'orchestration, et rien
d'autre. Le rendu n'a pas bougé d'un pixel à sept largeurs — sauf à 640 px, une
fois, par décision (§5bis).

Le plafond de 700 lignes a refusé un module **quatre fois**, et il avait raison
les quatre : `questionnaires.js` portait deux sujets (l'enseignant et
l'étudiant), `appel.js` deux (le début d'heure et les enquêtes annuelles),
`seance.js` deux (le pilotage et les deux lectures projetées). Chaque refus a
produit une coupe que personne n'avait vue en écrivant le plan — et les deux
moitiés, à chaque fois, ne s'appelaient jamais.

### Ce que le découpage casse, et comment on l'a su

Trois fois en une heure, la même faute : une fonction déménage, et l'endroit
qui l'employait ne la suit pas. `SEM_ETAT` dans la vue d'ensemble, `suivi` dans
la bibliothèque, `copierAbsents` câblé sur un bouton depuis `app.js`. Dans les
trois cas **la page se charge** : l'erreur n'arrive qu'à l'usage, sur un écran
précis, peut-être en séance.

Le contrôle du workflow ne pouvait pas les voir : il travaille sur la
CONCATÉNATION des modules, où un import oublié est invisible — la fonction
existe, ailleurs. `outils/mesurer.mjs` lit donc désormais **chaque fichier
séparément**, comme le navigateur, avec deux règles :

- un module appelle `machin()` sans l'avoir défini ni importé ;
- un module **emploie** un nom qu'un autre module exporte, sans l'importer —
  celle-ci attrape les usages qui ne sont pas des appels : `SEM_ETAT[x.etat]`,
  `suivi.seanceId`, un gestionnaire passé en valeur.

La seconde règle ne cherche que les noms exportés ailleurs, et c'est
délibéré : chercher tous les identifiants inconnus produisait surtout du bruit
— variables de boucle, clés d'objet, paramètres déstructurés — et un contrôle
qui crie pour rien finit coupé le jour où il a raison.

*Et une quatrième, dans l'outillage cette fois : `outils/portail.mjs` posait
les noms d'`app.js` APRÈS les exports des modules, si bien qu'un nom devenu
`undefined` dans `app.js` écrasait la vraie fonction venue du module. La clé
existait, sa valeur ne valait rien, et le contrôle échouait sur « n'est pas une
fonction » sans que rien ne désigne la cause.*

`comparer.mjs` à sept largeurs : **deux différences, et deux seulement** — le
lien d'évitement et le conteneur `#contenu` qui lui sert de cible. Toutes les
hauteurs de page sont identiques au pixel. Trois éléments ont changé de place
dans l'arbre sans changer de boîte : les trois sections, qui entrent dans
`#contenu`.

*Au passage, `comparer.mjs` a dû être corrigé : sa clé contenait le chemin
complet de chaque élément, si bien que l'insertion d'un seul conteneur faisait
« disparaître » puis « apparaître » les 419 éléments de la page — 5 880
différences pour un `div`. Un contrôle qui crie autant ne se lit plus. La clé
est maintenant ce que l'élément EST ; l'endroit où il se trouve est comparé à
part, et un déplacement dans l'arbre se compte au lieu de s'égrener.*

### Ce que A1-A4 a changé à l'écran : une chose, à une largeur

`outils/comparer.mjs` relève, pour **chaque élément visible**, sa boîte et
seize styles calculés, à sept largeurs, avant et après. Verdict :

- **identique à 360, 390, 480, 620, 768 et 1280 px** ;
- **à 640 px exactement**, la ligne du semestre se replie désormais, comme
  elle le faisait déjà à 620 px et en dessous. C'est la fusion assumée de deux
  seuils qui disaient la même chose (« l'écran est étroit ») à 20 px d'écart.
  La carte du semestre gagne 248 px à cette seule largeur.

### Ce que A5 et A7 ont changé, et ce qu'il a fallu vérifier autrement

`comparer.mjs` ne voit que des boîtes. Sortir 646 lignes du mode classe
déplace aussi **le branchement de ses neuf boutons** : ils étaient câblés au
premier niveau du script, ils le sont désormais dans `brancherEcran()`,
appelée une fois au démarrage. Si cet appel disparaissait, l'écran
s'afficherait parfaitement et ne répondrait à rien — et `comparer.mjs` le
trouverait identique au pixel près. C'est le trou exact qu'ouvre un
découpage : le gabarit tient, le câblage est parti.

`outils/t_ecran.mjs` clique donc, et regarde où va la vue. Cassé trois fois :
appel à `brancherEcran()` commenté, écouteur d'Échap oublié, bouton branché
sur la mauvaise vue — il a nommé les trois.

Trouvé au passage : `new Event("change")`, ajouté le 16/09 au matin, aurait
fait échouer le contrôle « toute fonction appelée est-elle définie » dès la
première poussée. `Event` manquait à la liste des noms natifs du workflow.
Personne ne l'avait vu parce que rien n'avait été poussé depuis.

### Deux choses trouvées en chemin

**Des règles écrites qui ne s'appliquaient pas.** Le bloc
`@media(max-width:33.9rem)` portait quatre déclarations pour les tuiles de
chiffres du suivi. Deux d'entre elles — `padding` et `font-size` — étaient
écrasées par les règles `.tuile` et `.tuile-v` ordinaires, écrites **plus bas**
dans la feuille et de même spécificité. Sur un téléphone, les tuiles étaient
donc centrées (ça, ça passait) mais à la taille du bureau, depuis toujours.
Les valeurs conservées sont celles qui s'appliquaient vraiment : le rendu ne
bouge pas. **Réveiller l'intention d'origine fait déborder la page de 36 px à
360 px** — mesuré — donc c'est une décision d'IHM, pas un nettoyage :
→ **B8** ci-dessous.

### Ce que B7 a démenti, et ce que ça dit de la méthode

En ouvrant B7, j'ai affirmé — dans la conversation, pas dans ce document — que
l'espace étudiant n'avait « ni repères d'avancement ni retour en arrière ».
C'était **lu dans le balisage, pas mesuré**. Mesuré, c'est faux :

| Ce que j'affirmais | Ce que la mesure dit |
|---|---|
| pas de repère d'avancement | le bandeau compte ce qui reste (« 2 choses à faire »), chaque carte porte son rang, recalculé à chaque rendu |
| pas de retour en arrière | une carte finie **se replie** au lieu de disparaître, et garde son accusé |
| écran trop long sur un téléphone | 1 660 px à 390 px, sans un pixel de débordement |
| cibles tactiles à surveiller | aucune sous 44 px, à 360 comme à 390 px |

La leçon n'est pas « l'audit s'est trompé une fois » : c'est que **la partie de
l'audit écrite en lisant le code vaut moins que la partie écrite en mesurant**,
et que la différence ne se voit pas à la relecture. Toutes les affirmations
mesurées de §1 sont recomptées par `outils/mesurer.mjs` ; celles qui ne le sont
pas sont des opinions bien informées, et doivent se lire comme telles.

La réponse à B7 n'est donc pas une refonte, c'est une mise sous mesure :
`outils/t_etudiant.mjs`, neuvième contrôle, sur le seul écran du portail que
trente personnes ouvrent en même temps et dont une panne se paie en minutes de
cours. Il a été cassé cinq fois avant d'être cru : carte finie qui disparaît
au lieu de se replier, questionnaire de révision remis dans la file, repli CSS
désactivé, compteur de file qui ne déduit plus les cartes faites, rang figé à
« 1 · », cible tactile ramenée à 33 px. Il a nommé les six.

**Un garde-fou plutôt qu'un défaut.** En corrigeant B8, `1fr` a été remplacé
par `minmax(0,1fr)` sur la grille des tuiles. À dire honnêtement : avec les
valeurs que ce tableau de bord affiche vraiment, les deux écritures donnent le
**même rendu au pixel**, aux sept largeurs. Ce n'est pas une réparation, c'est
une protection — `1fr` vaut `minmax(auto,1fr)`, donc une colonne ne descend
jamais sous la largeur insécable de son contenu, et `12/31` n'a plus d'espace
où se couper. Les quatre chiffres viennent de la base ; une grille ne doit pas
pouvoir être cassée par la longueur d'une valeur. `t_suivi.mjs` le vérifie avec
une valeur volontairement absurde — le seul moyen de vérifier un garde-fou.

**Un jeu d'essai qui ne convenait plus, et personne pour le dire.**
`outils/comparer.mjs` appelait ses cinq fonctions de rendu dans des `try/catch`
muets. Son jeu d'essai avait cessé de convenir à `rendreSuivi()` : la fonction
écrivait `undefined/13` dans la première tuile puis levait une exception avalée
en silence, et la comparaison continuait sur une page à moitié remplie. Les
tuiles étaient donc comparées sur une valeur qui n'existe pas — et c'est sa
largeur insécable qui a fait croire, une heure durant, à un débordement de
67 px. Le jeu d'essai est corrigé, et **un jeu d'essai refusé est désormais
remonté** au lieu d'être avalé.

**Deux contrôles qui n'existaient pas, et le document qui les annonçait.**
`CLAUDE.md` disait « Vérifié par `t_ens_mob.mjs` » et « vérifiées par
`t_mobile.mjs` ». Ni l'un ni l'autre n'a jamais existé dans ce dépôt —
`git log --all` ne les connaît pas. Deux écrans entiers se croyaient couverts,
dont l'espace étudiant, celui que trente personnes ouvrent en même temps.

Ce n'est pas un oubli isolé, c'est une classe d'erreurs : rien, jusqu'ici, ne
reliait ce que les documents affirment à ce que le dépôt contient. La réponse
est donc une règle, §6.6, et elle tient dans `outils/mesurer.mjs` — cassée
quatre fois avant d'être crue : citation d'un contrôle absent, contrôle présent
mais jamais lancé, étape de workflow qui appelle un outil disparu, aveu
`@fantome` qui a survécu au retour du contrôle. Elle a nommé les quatre.

**Un contrôle qui pouvait devenir muet.** L'ancienne façon d'ouvrir le portail
reposait sur trois substitutions dans son HTML. `outils/portail.mjs` n'en fait
plus qu'une, et **échoue bruyamment** si son point d'ancrage disparaît :
essayé, en changeant `})();` en `}());`, il s'arrête en le disant au lieu de
passer au vert. Les trois contrôles refusent aussi de conclure quand IBM Plex
ne s'est pas chargée : essayé aussi, en la neutralisant — une hauteur mesurée
sans la bonne police ne se compare à aucun plafond.

---

## 6. Les règles à tenir ensuite

À reverser dans `CLAUDE.md` une fois le chantier A engagé.

1. **Un module, un sujet, 700 lignes au plus.** `outils/mesurer.mjs` le
   vérifie. *Le plafond était 400 dans la première écriture de ce plan —
   chiffre posé au jugé, avant d'avoir sorti le moindre module. Le premier, le
   mode classe, en fait 646 d'un seul tenant et il est cohérent : treize
   fonctions, quatre portes d'entrée, un seul sujet. Le couper en deux pour
   satisfaire un nombre que personne n'avait mesuré aurait donné deux fichiers
   qu'il faut ouvrir ensemble.* Le plafond ne sert pas à viser : il sert à ce
   qu'aucun module ne redevienne un `app.js` sans qu'on le voie.

   *Pendant le découpage, `app.js` a été déclaré ici avec sa taille du jour —
   il avait le droit d'être gros, pas de grossir. La ligne `@chantier` a été
   retirée le 17/09 : à 582 lignes, `app.js` passe le plafond comme n'importe
   quel module, et il n'y a plus rien à excepter.*
2. **Aucun seuil hors de la table.** La liste des seuils est déclarée une fois,
   en commentaire `@seuil` en tête de `styles/socle.css`, avec ce que chacun
   gouverne. `outils/mesurer.mjs` refuse toute media query qui n'y figure pas.
   *Une variable CSS ne peut pas servir à cela* — `@media (max-width: var(--x))`
   ne s'applique jamais, c'est vérifié. Ajouter un seuil est une décision : une
   largeur de plus à vérifier à chaque changement, pour toujours.
3. **`innerHTML` ne reçoit jamais de donnée.** Il pose une carcasse ; les
   valeurs entrent par `textContent`. La règle est déjà suivie à une exception
   près — elle devient explicite.
4. **Un test qui n'a jamais échoué ne prouve rien.** Tout contrôle neuf est
   cassé une fois, volontairement, et on note ce qu'il a dit.
5. **Un contrôle d'intégration ne bloque que ce qui empêche de faire cours.**
   Le 15/09, une assertion trop stricte a arrêté le déploiement une semaine
   (§2.5).
6. **Un contrôle cité existe, et un contrôle qui existe tourne.**
   `outils/mesurer.mjs` refuse les deux dérives, dans les deux sens : un
   document qui nomme un `outils/…` absent, et un `outils/t_*.mjs` que
   `verifier-portail.yml` n'appelle pas.

   *Cette règle est née d'une panne, le 17/09 : `CLAUDE.md` annonçait deux
   vérifications — « Vérifié par `t_ens_mob.mjs` », « vérifiées par
   `t_mobile.mjs` » — par des fichiers qui n'ont jamais existé dans ce dépôt.
   Deux écrans entiers, l'espace étudiant compris, se croyaient couverts et ne
   l'étaient par rien. **Une promesse de contrôle est pire que pas de
   contrôle** : devant une case vide on regarde, devant une case cochée on
   passe. Et l'inverse coûte aussi cher — un contrôle rangé dans `outils/` que
   rien n'appelle ne protège que le jour où quelqu'un pense à le lancer, donc
   jamais, passé trois semaines.*

   Un nom peut être cité pour dire qu'il ne vérifie rien : cela se **déclare**,
   comme `@chantier` et `@seuil`, par `@fantome <fichier>` dans le document.
   L'aveu coûte une ligne — c'est ce qui sépare « j'assume ce nom mort » de
   « j'ai oublié ». Un `@fantome` qui nomme un fichier redevenu présent est
   refusé à son tour : l'aveu ne survit pas au contrôle.

7. **Le dépôt est public.** Ni clé `service_role`, ni nom d'élève, ni
   correspondance numéro↔nom. La règle existe déjà dans `CLAUDE.md` ; le
   découpage en modules multiplie les fichiers, donc les occasions de
   l'oublier.

---

## 7. Ce que ce document ne traite pas

- **La base.** Les 35 fonctions RPC et leurs migrations sont hors sujet ici.
  Elles ont leur propre discipline, qui tient.
- **Le choix d'un cadre** (React, Svelte, Vue). Il n'est pas nécessaire au
  problème posé, et il coûterait une étape de compilation avant chaque
  publication — exactement ce qui vous a bloqué une semaine. À rouvrir si un
  jour l'écriture de l'interface devient le goulot ; ce n'est pas le cas.
- **Le contenu pédagogique.** Séances, sujets, corrigés : ailleurs.
