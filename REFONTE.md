# Refonte du portail — audit mesuré et plan

Écrit le 16/09/2026. Chaque chiffre de ce document a été compté sur
`index.html` tel qu'il est dans le dépôt ce jour-là, et non estimé. Les
commandes qui les recomptent sont dans `outils/mesurer.mjs` : si un chiffre
d'ici ne correspond plus, c'est le document qui a vieilli, pas la mesure.

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

Voir §1. Dix seuils, quatre syntaxes, zéro nom. Le correctif tient en six
variables et une convention.

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

- [ ] **A1. Nommer les seuils de rupture.** Six variables, une convention
      écrite, les 13 media queries réécrites dessus. Aucun pixel ne bouge :
      les trois tests de gabarit le prouvent avant et après.
- [ ] **A2. Sortir le CSS** vers `styles/`. Zéro JavaScript touché, donc zéro
      risque de régression fonctionnelle.
- [ ] **A3. Passer en module** — `index.html` + `js/app.js` contenant tout le
      script actuel, à l'identique. Publier, et **vérifier en production**
      avant d'aller plus loin : c'est l'étape qui valide la mécanique.
- [ ] **A4. Adapter les trois tests** au serveur statique et à `page.route()`
      (§4.3). Les casser à nouveau, chacun, pour vérifier qu'ils voient
      encore.
- [ ] **A5. Extraire les modules feuilles** — `ecran.js`, `quiz.js`,
      `appel.js`. Un commit par module.
- [ ] **A6. Extraire les modules centraux** — `socle.js`, `session.js`,
      `navigation.js`, puis le reste.
- [ ] **A7. Réparer `erreur()`** (§2.4) : `textContent` pour le texte, la
      classe posée sur l'élément. Aucun appel à changer.
- [ ] **A8. `outils/mesurer.mjs`** : recompter les chiffres de ce document, et
      échouer si un module dépasse 400 lignes. Ce qui a dérivé une fois
      dérivera deux fois.

### Chantier B — La navigation

- [ ] **B1. L'état dans l'adresse.** `#appel`, `#seance`, `#quest`,
      `#ensemble` ; le titre de la page suit l'onglet ; le bouton Précédent
      revient à l'onglet précédent. **À faire tôt** : c'est le point qui se
      paie vingt fois par heure (§3.3).
- [ ] **B2. Un seul endroit pour les contrôles d'entrée** (§3.2) : ils
      appartiennent à la vie d'une séance, pas à la bibliothèque. La carte de
      l'onglet Questionnaires disparaît, un lien la remplace.
- [ ] **B3. Un seul système d'onglets** : l'écran de connexion adopte celui de
      l'espace enseignant, flèches et `tabindex` compris (§3.4).
- [ ] **B4. `aria-live`** sur les zones d'erreur et les pastilles d'état
      (§3.5).
- [ ] **B5. Lien d'évitement** (§3.6).
- [ ] **B5bis. Déclarer `--surface-2`** dans les deux thèmes, et remonter le
      contraste de `.db-v.sans_mesure` au-dessus de 4,5 : 1 (§3.7). Petit,
      isolé, à faire dès qu'on touche au CSS.
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

- [ ] **B7. L'espace étudiant.** Aujourd'hui une pile de cartes sous l'avatar,
      avec une file d'attente en bandeau. À reprendre une fois B1 en place, car
      l'étudiant aussi rafraîchit sa page.

### Ordre conseillé

`A1 → A2 → A3` (publier, vérifier en production) `→ A4 → B1 → B2 → B3 → B4 →
B5 → A5 → A6 → A7 → A8 → B6 → B7`.

B6 arrive tard **exprès** : renommer les onglets pendant l'année scolaire
désoriente ; la fin d'un semestre est le bon moment.

---

## 6. Les règles à tenir ensuite

À reverser dans `CLAUDE.md` une fois le chantier A engagé.

1. **Un module, un sujet, 400 lignes au plus.** Au-delà, on découpe.
   `outils/mesurer.mjs` le vérifie.
2. **Aucun seuil de rupture en dur.** Les media queries n'utilisent que les
   variables nommées de `styles/socle.css`.
3. **`innerHTML` ne reçoit jamais de donnée.** Il pose une carcasse ; les
   valeurs entrent par `textContent`. La règle est déjà suivie à une exception
   près — elle devient explicite.
4. **Un test qui n'a jamais échoué ne prouve rien.** Tout contrôle neuf est
   cassé une fois, volontairement, et on note ce qu'il a dit.
5. **Un contrôle d'intégration ne bloque que ce qui empêche de faire cours.**
   Le 15/09, une assertion trop stricte a arrêté le déploiement une semaine
   (§2.5).
6. **Le dépôt est public.** Ni clé `service_role`, ni nom d'élève, ni
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
