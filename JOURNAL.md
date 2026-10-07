# Journal du portail — ce qui a changé, et où ça en est

Ce fichier répond à deux questions qu'on se pose toujours en même temps :
**qu'est-ce qui a changé dans le code**, et **est-ce que c'est passé en base**.
Les deux ne vont pas ensemble : un script commité n'est pas un script exécuté.

La colonne « base » se vérifie soi-même, en trente secondes, avec la requête de
fin de fichier. Une date écrite à la main ment dès le lendemain.

---

## Depuis le 8 septembre : les migrations sont automatiques

Le tableau ci-dessous décrit l'état **avant** la mise en place du CI/CD. Il
reste ici comme point de départ, mais il n'a plus vocation à être tenu à la
main : `supabase/migrations/` est désormais la source, et ce qui part sur
`main` part sur Supabase. Voir **[`supabase/LISEZ-MOI.md`](supabase/LISEZ-MOI.md)**.

Et pour ce qui reste à faire au quotidien, ce n'est plus un fichier non plus :
c'est la carte **« À faire »**, en tête de l'espace enseignant du portail,
recalculée depuis la base à chaque affichage.

---

## 7 octobre 2026 — Projet IA BTS2 : une troisième séance à distance

Demandé : prolonger le projet IA pour la séance du jeudi 08/10, toujours à
distance. `distance/projet-ia.html` gagne la partie « Jeudi 8 octobre —
séance 23 : terminer, améliorer, présenter » (six missions : faire le point,
terminer ce qui manque, améliorer et le prouver, sécuriser, présenter le projet
sur sa page `github.io`, rendre). Rendu final par e-mail **lundi 12/10 avant
17 h**, application en ligne jusqu'à 20 h ; bandeau, consignes d'arrivée et
barème mis à jour en conséquence. Les horaires « 15 h – 17 h » sont retirés de
l'en-tête : le jeudi n'a pas les mêmes que lundi et mardi.

**Une migration**, `20261007170000_bts2_projet_ia_seance23.sql` : séance 23
(projet, 6 jalons, échéance 12/10, module `projet-ia`), missions `tp23-m1` à
`m6`, **créée fermée et cachée**. Jeudi : Préparer → la séance 23 → Visible,
puis Ouvrir.

Au passage : la vérification n° 5 de `20261006120000_mise_en_place.sql`
(`agenda()`) dépendait de l'heure — rouge le mercredi après 10 h et le lundi
après 15 h, la seconde séance programmée tombant hors des sept jours comptés
depuis aujourd'hui. Elle compte désormais depuis la première séance
programmée. Ce n'est qu'une assertion : `supabase db push` n'applique pas de
nouveau une migration déjà passée, la production n'est pas touchée. Chaîne
rejouée deux fois sur une base neuve (postgres 16) avec les assertions du
workflow : vert.

---

## 6 octobre 2026 (après-midi) — lot 3 : la mise en place

Demandé : « ok pour le lot 3 » des propositions du 05/10. **Une migration**,
`20261006120000_mise_en_place.sql` — appliquée à Supabase par le workflow dès
la poussée sur `main` ; vérifier dans l'onglet Actions que « appliquer » est
vert avant de conclure qu'elle est en base.

| Item | Où | Quoi |
|---|---|---|
| 3.1 Page d'une séance | `js/pageseance.js`, `js/bilanseance.js` (neufs), `navigation.js` (`#s/…`), `gestion.js`, `preparer.js`, `seance.js`, `raccourcis.js`, `index.html` ; migration (`bilan_seance()`) | `#s/35` : fil d'Ariane, séances voisines, Préparer · En direct · Bilan ; la fiche et la carte du direct y sont hébergées puis rendues ; le Bilan dit le prévu et le fait, l'appel, la participation, le contrôle, les missions ou le quiz, les concepts, l'automate |
| 3.2 Assistant « Nouveau module » | `js/assistant.js` (neuf), `index.html` (`<dialog>`) ; migration (`creer_seances()`) | dépôt (lecture de `mkdocs.yml`), séances (tout ou rien), planning, contenus |
| 3.3 Dupliquer, reconduire | `pageseance.js`, `js/reconduire.js` (neuf) ; migration (`dupliquer_seance()`, `reconduire_classe()`) | copie fermée et cachée, missions renumérotées, contrôle éteint ; reconduction avec aperçu, sans élève ni réponse |
| 3.4 Actions groupées | `js/lot.js` (neuf), `gestion.js` (case par ligne) ; migration (`programmer_seances()`) | programmer à la suite, retirer la date, rendre visibles, ouvrir (projets), clore (différé), ranger |
| 3.5 La semaine à préparer | `js/avenir.js` (neuf), `index.html` ; migration (`agenda()`) | sept jours de créneaux, « Prête ? » et ses manques, placer une séance sur un créneau vide |

Vérifié : la chaîne rejouée deux fois sur une base neuve (postgres 16, comme
le workflow), puis les assertions du workflow. Les vérifications de la
migration ont été cassées dix fois — missions non renumérotées, ligne
illisible ignorée, créneaux déjà pris ignorés, absents mal comptés, pas de
séance d'appel dans la classe neuve, modules non rangés, missions non
recopiées, aperçu qui écrit… — et chacune nomme sa faute. Côté portail :
`t_missions` (semaine, actions groupées, assistant, reconduction, lecture de
`mkdocs.yml`), `t_suivi` (la page : ouverture, En direct, suivre une autre
séance, Bilan, compte rendu, Dupliquer, quitter, Précédent, « Écrire les
missions › »), `t_navigation` (`#s/25/bilan` au rechargement ; axe-core sur la
page, la semaine, la barre et l'assistant ; 320 px) ; dix cassures, dix
défauts nommés. Le contrôle « déclarée deux fois » du workflow a trouvé huit
noms de fonction en double entre les nouveaux modules et les anciens : tous
renommés.

Pas fait dans ce lot : « Cette semaine » (Bilan) ne compare pas encore le
prévu au fait pour toute la classe — l'onglet Bilan de chaque séance le fait
pour elle.

---

## 6 octobre 2026 — lot 2 : l'état d'une séance, le planning, l'automate

Demandé : « faire le lot 2 » des propositions du 05/10. **Une migration**,
`20261006060000_etat_et_planning.sql` — appliquée à Supabase par le workflow
dès la poussée sur `main` ; vérifier dans l'onglet Actions que « appliquer »
est vert avant de conclure qu'elle est en base.

| Item | Où | Quoi |
|---|---|---|
| 2.1 État unique | migration (`etat_seance()`, `_manque_seance()`), `js/etat.js` (neuf), `pilote.js`, `seance.js`, `choixseance.js`, `gestion.js` | un mot calculé en base — brouillon, prête, programmée, en cours, oubliée, terminée (projet : ouvert, caché, clos) ; l'en-tête, la recherche et Préparer le lisent ; quatre étapes sous l'en-tête de la séance |
| 2.2 Planning | migration (`prevue_le`, `fin_prevue`, table `creneaux`, `planifier_seance()`, `definir_creneaux()`, `emploi_du_temps()`), `js/planning.js` (neuf), `index.html` | bloc « Quand » dans la fiche (jour, début, fin, « Prochain créneau libre ») ; carte « L'emploi du temps » dans Préparer ; `encours.js` choisit la séance du créneau en cours, puis la prochaine programmée |
| 2.3 Aujourd'hui | migration (`aujourdhui()`), `js/aujourdhui.js` (neuf), `index.html` | l'agenda du jour en tête d'En cours, toutes classes : un créneau par ligne, son état, un geste (Démarrer, Ouvrir, Clore différé, Rendre visible, Préparer, Compte rendu) |
| 2.4 À l'heure | migration (`auto_ouvrir`, `auto_clore`, `journal_auto`, `seances_a_l_heure()`, pg_cron, `activer_planification()`) | deux options par séance ; la base ouvre au début du créneau (un cours est démarré) et clôt 15 min après la fin ; une fois par créneau, jamais contre un geste de l'enseignant |

**pg_cron** : la migration l'active et pose la tâche « seances-a-l-heure »
(chaque minute) si le serveur le permet ; sinon elle passe et le dit. Le
portail affiche alors « ouverture automatique à l'arrêt » (carte
« Aujourd'hui » et « L'emploi du temps »), et le bouton « Mettre l'automate en
marche » appelle `activer_planification()` une fois l'extension activée dans
Supabase → Database → Extensions. Vérifier en SQL :
`select jobname, schedule, active from cron.job;`

**Aucun emploi du temps n'est posé par la migration** (le dépôt est public) :
il se tape dans Préparer → L'emploi du temps, une ligne par créneau.

Vérifié : la chaîne rejouée deux fois sur une base neuve (postgres 16 sans
pg_cron, comme le workflow), puis sur une base AVEC pg_cron, où la tâche a
réellement ouvert une séance programmée à la minute suivante. Les
vérifications de la migration ont été cassées trois fois (sans la ligne
« déjà ouverte », sans « déjà close », l'automate rendu appelable par
`authenticated`) : chacune nomme sa faute. Côté portail : `t_suivi` (état,
étapes, repli sans migration, agenda, séance du jour ; cassé en retirant la
règle du créneau et le repli des colonnes), `t_missions` (bloc « Quand »,
prochain créneau, emploi du temps ; cassé en envoyant `planifier_seance` à
chaque enregistrement), `t_navigation` (axe-core voit maintenant l'agenda, la
fiche et l'emploi du temps ; cassé avec une légende à 1,3 : 1).

Pas fait dans ce lot : « Cette semaine » ne compare pas encore le prévu au
fait, et `a_faire()` n'a pas de règle « séance du jour pas prête » — l'agenda
le montre déjà, et réécrire `a_faire()` en entier pour une ligne n'en valait
pas le risque.

---

## 5 octobre 2026 (soir) — lot 1 : ergonomie et accessibilité

Accepté : le lot 1 des propositions du même jour (`claude/application-seance-propositions.md`
dans le projet). **Aucune migration.** Mesuré avant, avec axe-core 4.14 (WCAG
2.2 AA) : tous les boutons principaux à 2,5 : 1 en thème sombre, « Me
connecter » compris ; l'encre pâle à 2,6–3,0 : 1 en clair ; deux pastilles
juste sous 4,5 ; un tableau défilant inatteignable au clavier ; quatre
teintes de texte en dur qui tombaient à 2,2 : 1 sur fond sombre. Après :
**zéro violation**, en clair et en sombre, à 390 et 1 280 px.

| Item | Où | Quoi |
|---|---|---|
| 1.1 Contrastes | `styles/socle.css` (jetons), `etudiant.css`, `appel.css`, `ensemble.css`, `missions.css`, `pilote.css` | `--ink-faint`, `--ok`, `--signal` ajustés ; `--on-accent` neuf ; plus de texte en dur sur fond du thème ; liens au jeton |
| 1.2 Clavier | `index.html`, `fiche.js` | les cinq zones `.scroll` : `tabindex`, `role="region"`, un nom |
| 1.3 Vocabulaire | `js/interrupteur.js` (neuf), `bibliotheque.js`, `controle.js`, `preparer.js`, `qseance.js`, `ensemble.js`, `gestion.js`, `prevol.js` | un interrupteur `role="switch"` pour « Proposé aux étudiants » et « Visible » ; « Clore » aussi pour un projet ; « visible / cachée » partout |
| 1.4 Boutons | `styles/composants.css` (neuve, en dernier), `styleguide.html` (neuve) | trois niveaux, inventaire des composants, guide qui calcule ses propres contrastes |
| 1.5 Erreurs | `js/refus.js` (neuf) | les 14 « Action refusée. Vérifiez… » remplacés : session, réseau, fonction absente, raison de la base |
| 1.6 Séances | `js/choixseance.js` (neuf), `index.html`, `pilote.js` | « Aller à une séance » : recherche, groupes classe › module, état, récentes, questionnaires à part |
| 1.7 Clavier | `js/raccourcis.js` (neuf), `index.html` (`<dialog>`) | Ctrl+K, D, P, 1-4, /, ? ; à une touche coupables (WCAG 2.1.4) ; pas de raccourci pour Clore |
| 1.8 Aides | `index.html` | sept aides de carte réduites à une phrase + « En savoir plus » |
| 1.9 Contrôle | `outils/t_navigation.mjs` | axe-core (version fixée) sur connexion, trois onglets, guide, deux thèmes ; 320 px sans défilement latéral |

Contrôles : `t_navigation` (cassé : blanc remis sur le bouton sombre → 9
violations nommées), `t_messages` (refus), `t_suivi` (sélecteur et
raccourcis ; cassé deux fois : Entrée sans effet → 3 défauts, raccourcis non
coupables → « coupés, « 2 » change encore de vue »), `t_pilotage`,
`t_missions` (vocabulaire). Vérification manuelle trimestrielle : liste dans
CLAUDE.md, « Ergonomie et accessibilité ».

---

## 5 octobre 2026 — ouvrir une séance depuis l'écran où on la regarde

Demandé : « l'application de gestion des séances n'est pas très pratique,
certaines fonctionnalités semblent masquées ; je ne vois pas comment activer
les séances des BTS 2 sur l'IA ». **Aucune migration** : les trois fonctions
utilisées (`enregistrer_seance`, `clore_seance`, `publier_seance`) sont en base
depuis septembre.

Relevé sur le portail en service, avant correction :

- **IA 1 et IA 2 (BTS2) inactivables depuis En cours.** Créées « fermées, non
  publiées » par leur migration. Le pré-vol disait « Séance fermée — les
  étudiants ne peuvent plus rien valider » sans aucun bouton : ceux du pré-vol
  sont masqués depuis le 28/09 (`#prevol > .pick`), et l'en-tête cachait son
  action pour **tout** projet. La zone des chiffres proposait une requête SQL à
  recopier dans Supabase. Seul chemin : Préparer → la classe → Modifier → deux
  cases → Enregistrer.
- **La séance 3 du BTS1, démarrée le 30/09, jamais close.** En cours s'ouvrait
  dessus chaque matin (« ouverte et démarrée » = l'heure en train de se jouer),
  badge « En cours », chrono « 7294 / 55 min », rythme « dans le rythme »,
  « Plus rien depuis 7289 min ».

Corrigé :

| Où | Quoi |
|---|---|
| `js/ouverture.js` (neuf) | Ouvrir (publie ET ouvre, **sans** `demarrer_seance` : pas de chrono, pas de « séance du jour » pour cinq semaines), fermer, rendre visible ; « oubliée ouverte » = la règle d'`a_faire()` (cours, durée + 120 min) |
| `js/prevol.js` (neuf, sorti de `seance.js`) | Chaque ⚠️ du pré-vol porte son geste : Ouvrir le projet, Le rendre visible, Fermer (différé), Démarrer, Clore (différé), Écrire les missions ›, Poser l'échéance ›. Un cours joué et clos dit « Séance terminée » au lieu de « 1 point à régler » |
| `js/pilote.js` | En-tête : « Ouvrir le projet » sur un projet fermé ; badges « Ouvert, caché » et « Oubliée ouverte » ; chrono « ouverte depuis 5 j » |
| `js/seance.js` | Le pré-vol lit `publiee` à côté de `preflight_seance()` ; plus de SQL dans le message de séance fermée ; rythme d'une séance oubliée |
| `js/encours.js` | La règle 1 ne prend plus un projet ni une séance oubliée ouverte pour « l'heure en train de se jouer » |
| `js/gestion.js` | Préparer › Les séances : sur chaque ligne, Ouvrir / Fermer / Clore, Rendre visible (ouverte mais cachée), Suivre › (vers En cours) |
| `js/vigilance.js` | « depuis 7289 min » se lit « depuis 5 j » |

Contrôles : `t_suivi.mjs` (cinq états, cassé deux fois : action d'en-tête
retirée → « action de l'en-tête « », attendu « Ouvrir le projet » » ; publiee
non envoyée → « ouvrir n'envoie pas publiee ET ouverte »), `t_pilotage.mjs`
(séance oubliée, cassé une fois → « s'ouvre sur la séance 2, oubliée ouverte
depuis cinq jours »), `t_missions.mjs` (gestes de ligne, cassé une fois → deux
défauts nommés).

---

## 2 octobre 2026 — les indicateurs : l'heure, la semaine, les équipes

Demandé : « pas assez d'indicateurs de suivi, en temps réel et en fin de
semaine ; suivre les avancements et détecter les étudiants en difficulté
depuis le téléphone ». Détail et règles dans CLAUDE.md, « Les indicateurs ».

| Migration | Ce qu'elle fait |
|---|---|
| `20261002060000_suivi_lecture_projets_courbe.sql` | `temps_lecture()` (3,5 mots/s, 4 à 25 s) et `gestes_lus()` ; `vigilance_seance()` **réécrite** : « sans le temps de lire » remplace « 3 réponses à moins de 5 s », projet en retard (≤ la moitié de la médiane du groupe) et bloqué (rien validé depuis 25 min pendant qu'un tiers avance), « fatigué » en information, humeur et médiane rendues ; `courbe_seance()` |
| `20261002070000_semaine.sql` | `semaine_classe()`, `meteo_classe()`, `trajectoires_classe()`, et leurs briques `_semaine_eleves()` / `_raisons_semaine()` (fermées à l'API) |
| `20261002080000_equipes.sql` | le module CPMS du BTS2 enregistré s'il manque ; tables `equipes`, `equipe_membres`, `equipe_jalons`, `journaux`, `appreciations`, `pairs` (aucune politique) ; `definir_equipes()`, `poser_jalon()`, `apprecier()`, `equipes_module()`, `modules_equipes()` ; côté étudiant `mon_equipe()`, `ecrire_journal()`, `repartir_points()` |
| `20260928080000_modules.sql` (**déjà appliquée**, contrôle assoupli) | « exactement 3 modules » rendait la chaîne rouge au second passage dès le 4e module : on compte maintenant les trois que cette migration pose, et on cherche le doublon par dépôt. Effet en production : aucun, elle n'est pas rejouée |

Côté sites de cours : `BTS1_S1_B1_DEV/docs/assets/suivi.js` (quiz et points
de passage) et `playlist-csharp/docs/index.html` (quiz d'auto-évaluation)
grisent les options le temps de lire, avec la même formule.

## 30 septembre 2026 — la base vectorielle en séance 3, et réviser une séance au choix

La séance 3 du BTS1 (« 60, 47, 72 ») gagne un acte IV « La base qui cherche par
le sens » ; la séance 4 n'en garde que l'angle « l'index se versionne ». Dans la
fiche d'une séance de cours (Préparer), un bouton **« Proposer la révision »**
fabrique depuis son quiz et ses concepts un questionnaire de révision
(correction après chaque réponse, certitude, bilan par concept) et le propose
à la classe ; le même bouton l'éteint ensuite.

| Migration | Ce qu'elle fait |
|---|---|
| `20260930060000_bts1_seance3_vectoriel.sql` | séance 3 : la question 9 (le marécage) devient la question sur la base vectorielle, bonne réponse D ; refuse d'écrire si le quiz a déjà une réponse |
| `20260930061000_bts1_seance3_vectoriel_debriefing.sql` | séance 3 : six concepts, dont « Une base vectorielle » [9] ; « Lac et entrepôt » passe à [7 8] |
| `20260930070000_reviser_une_seance.sql` | `reviser_seance(seance, ouvrir)` (enseignant) et `_reviser_seance()` (fermée à l'API) ; clé `revision-seance-<id>`, un seul par séance, texte figé dès la première réponse ; pose « Réviser la séance 2 » au BTS1, **fermé** |
| `20260930080000_activer_revision_seance2_bts1.sql` | « Réviser la séance 2 » rattaché à la séance 3 du BTS1 et proposé |
| `20260930090000_seance4_cachee_et_coherence.sql` | BTS1 : contrôle de la séance 4 éteint (la carte « Séance 4 » se montrait pendant la 3), séances 1-2 jouées republiées, titre de la 3 accentué ; `a_faire()` réécrite — « contrôle éteint » ne vise plus que la prochaine séance de cours, nouvelle règle « contrôle proposé trop tôt » |

## 28 septembre 2026 — le tableau de bord refondu par moment

Trois onglets au lieu de quatre — **En cours** (appel + la séance du jour +
contrôles), **Préparer** (séances par module, questionnaires, modules),
**Bilan** (semestre par module, classes, questionnaires de rentrée et de stage
repliés) ; « Ce qui bloque » sur une ligne ; le suivi s'ouvre sur la séance
en cours. Détail dans CLAUDE.md.

| Migration | Ce qu'elle fait |
|---|---|
| `20260928090000_donnees_reelles.sql` | le BTS2 reprend le nom « BTS SIO 2 - SLAM » (il portait « PlaylistApp C# », un nom de module) ; les séances déjà démarrées ou répondues par un vrai étudiant sont rendues **visibles** (séances 1-2 du BTS1, TP0 du BTS2 étaient « Cachée ») |
| `20260928100000_carnet.sql` | `carnet_classe(classe_id)` : élèves × séances jouées, réponses, réussite, jalons, présence — pour le carnet de Bilan. Une fonction, aucune donnée touchée ; refus hors session enseignante vérifié |
| `20260929055000_rattachement_lisible.sql` | `seances.reste_ouvert` et `visible_jusqu_au`, `regler_questionnaire()` ; le déclencheur de suivi ne ferme plus un questionnaire « reste ouvert » ; `bibliotheque()` réécrite (réglages, module des séances candidates, « terminé » sans les clés de certitude) |
| `20260929060000_questionnaire_themes.sql` | thème par question, certitude (`<clé>-c`), bilan par thème ; `creer_modele()` (une seule signature, `p_certitude`), `mes_questionnaires()` (masque après l'échéance), `depouiller_questionnaire()` réécrites ; déclencheur `corrige_prend_theme` |
| `20260929070000_revision_playlistapp.sql` | le questionnaire « Réviser PlaylistApp » : 24 questions, 4 thèmes × 6, certitude, affecté au BTS2 **fermé** |

**Opération faite à la main le même jour, avec l'accord de l'enseignant** : le
BTS2 compte **13 étudiants**, la base en portait 25. Les fiches **14 à 25** ont
été supprimées depuis la session enseignante du portail (onze sans aucune
réponse ; la 25 portait une seule case `tp1-m1` cochée le 03/09, avant la
rentrée — un essai). Restent 01-13 et le compte d'essai n° 99. Les
dénominateurs (« x/13 », appel, taux) sont justes depuis.

---

## 28 septembre 2026 — les modules

| Migration | Ce qu'elle fait |
|---|---|
| `20260928080000_modules.sql` | table `modules` (un module = une classe + un dépôt GitHub obligatoire), `seances.module_id`, déclencheur `module_coherent`, trois modules (Bloc 1 DEV, PlaylistApp, IA Méca Forez) et le rangement des séances existantes ; cinq fonctions (`mes_modules`, `modules_enseignant`, `enregistrer_module`, `supprimer_module`, `ranger_seance`) ; `seances_de_classe()` réécrite |

Dépôts créés le même jour : `ggaillard/BTS2-IA-MecaForez` (public) et
`ggaillard/BTS2-IA-MecaForez-Prof` (privé), remplis avec les séances 1 et 2.

Rejouée deux fois sur une base neuve avec le socle de `supabase.yml` : 0
bloquant ; ses huit vérifications ont chacune été cassées exprès pour voir
qu'elles échouent.

---

## 28 septembre 2026 — la séance IA 2 du BTS2

| Migration | Ce qu'elle fait |
|---|---|
| `20260928060000_bts2_ia_seance2.sql` | crée la séance **12** du BTS2 (projet, 5 jalons, échéance 06/11 à régler dans Le semestre → Les séances), son contrôle d'entrée (6 notions + 6 certitudes, **éteint**, réponses B D A C D B) et ses 5 missions `tp12-m1` à `tp12-m5` ; séance **non publiée et fermée** |

Rejouée deux fois sur une base neuve avec le socle de `supabase.yml` : 0
bloquant, une attention attendue (« Contrôle d'entrée éteint — séance 12 »).

---

## 27 septembre 2026 — la séance IA 1 du BTS2, les missions, et la gestion des séances

| Migration | Ce qu'elle fait |
|---|---|
| `20260927060000_bts2_ia_seance1.sql` | crée la séance **11** du BTS2 (projet, 5 jalons) et son contrôle d'entrée (6 notions + 6 certitudes, **éteint**) ; séance **non publiée et fermée** |
| `20260927070000_missions_et_seances.sql` | table `missions` ; `mes_missions`, `valider_mission` (étudiant) ; `definir_missions`, `grille_missions`, `seances_de_classe`, `enregistrer_seance` (enseignant) ; les cinq missions de la séance 11 |

Côté portail : `js/missions.js` (carte « Vos missions », grille élèves ×
missions et son éditeur dans l'onglet La séance), `js/gestion.js` (carte « Les
séances » dans l'onglet Le semestre), `styles/missions.css`, contrôle
`outils/t_missions.mjs` — lancé par le workflow.

Rejoué deux fois sur une base neuve avec le socle de `supabase.yml` : 0
bloquant ; essais fonctionnels des six fonctions (cocher deux fois n'écrit
qu'une ligne, `suivi_projet()` compte les missions cochées, retrait d'une
mission cochée refusé, bande 90-99 et renumérotation refusées).

**À faire en production, dans le portail, une fois appliqué :** onglet Le
semestre → Les séances → BTS2 → séance 11 → corriger l'échéance, cocher
**Publiée** et **Ouverte** le jour venu. Sans cela, la carte « Vos missions »
reste invisible aux étudiants — c'est voulu.

---

## 25 septembre 2026 — la séance 4 accueille les bases vectorielles

La séance 4 n'avait pas été jouée (ni publiée, ni démarrée, aucune réponse) :
on l'a enrichie. Le cold open ajoute un assistant qui cherche par le sens et
répète un vieux chiffre ; un acte IV nouveau, « La base qui cherche par le
sens » (embedding, recherche par similarité, RAG, pgvector, et surtout :
**l'index se versionne avec le modèle qui l'a fabriqué**). Cinq actes, 42 min.

| Migration | Ce qu'elle fait |
|---|---|
| `20260925060000_bts1_seance4_vectoriel.sql` | réécrit les dix corrigés (deux questions vectorielles) — **refuse** s'il existe une seule réponse au quiz |
| `20260925061000_bts1_seance4_vectoriel_debriefing.sql` | les cinq concepts, dont « Une base vectorielle » |
| `20260925062000_bts1_seance4_vectoriel_passages.sql` | cinq points de passage ; l'accueil passe de 7 à 3 min — le quiz retrouve ses 10 min |

Produites par `outils/seances/seance04/vectoriel.py` ; `generer.py` est figé.

Et, le même jour, les deux propositions de suivi qui restaient —
`20260925070000_suivi_semestre_et_direct.sql` :

- « Sur le semestre » : **réussite en baisse** et **notions perdues en une
  semaine**. Cette seconde règle repose sur une convention désormais écrite
  dans le gabarit : la notion pre-0K du contrôle d'entrée de N+1 reprend le
  concept de rang K de N.
- **Affichage instantané** : `reponses`, `passages` et `mains` publiées en
  temps réel ; lecture enseignante sur `passages` et `mains` (sinon Supabase
  ne diffuse rien). Le contrôle de fin de `20260924070000` interdisait toute
  politique sur ces deux tables : il ne regarde plus que `points_passage`.

À vérifier une fois appliqué, dans le SQL Editor :

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- attendu, entre autres : reponses, passages, mains — et PAS points_passage
```

Deux ajustements d'outillage, nés de ce premier cas de « séance réécrite » :

- `controler.py coherence` comparait le rattrapage d'un fichier à l'état
  FINAL de la base : une réécriture voulue faisait crier le fichier d'origine.
  Il compare désormais au bloc d'insert **du même fichier** (`lire.inserts_par_fichier`).
- Le contrôle de fin de `20260924071000` exigeait exactement 4 points : au
  rejeu de la chaîne, il en trouve 5. Il exige « au moins 4 ». Son effet en
  production est inchangé — il a déjà été appliqué.

---

## 24 septembre 2026 — la séance 4, et le suivi pendant l'heure

Cinq migrations, toutes rejouées deux fois sur une base neuve, **avec
`est_enseignant()` à vrai puis à faux** — la seconde passe est celle qui
ressemble à la production :

| Migration | Ce qu'elle pose |
|---|---|
| `20260924060000_bts1_seance4.sql` | titre, dix corrigés, contrôle d'entrée (5 notions de la séance 3, créé fermé) |
| `20260924061000_bts1_seance4_debriefing.sql` | corrige **deux défauts** du débriefing, réécrit les concepts S1 à S4 |
| `20260924070000_suivi_temps_reel.sql` | points de passage, main levée, `vigilance_seance()`, `eleves_a_suivre()` |
| `20260924071000_bts1_seance4_passages.sql` | les quatre points de passage de la séance 4 |
| `20260924080000_vigilance_ajustements.sql` | redéfinit `vigilance_seance()` et `eleves_a_suivre()` : la séance en cours n'est plus « jouée », les passages comptent comme réponse, silence à 20 min sur un TP |

Les deux défauts du débriefing, trouvés en écrivant la séance 4 :

- **Les concepts des séances 1 à 3 n'ont probablement jamais atteint la
  production.** La migration appelait `definir_concepts()`, qui répond
  « refus » hors session enseignante, et `perform` jetait la réponse sans la
  lire. Rejoué avec `est_enseignant()` à faux : zéro concept en base.
- **Chaque détail de concept perdait ses deux premières lettres** :
  `position(' — ') + 5` au lieu de `+ 3`. « matériel » devenait « tériel ».

Les deux migrations de séance sont **produites** par
`outils/seances/seance04/generer.py`, depuis une seule liste : le bloc de
rattrapage ne peut plus diverger de l'insert, puisque personne ne le tape.

Ce qu'il faut vérifier en production une fois appliqué :

```sql
select s.numero, count(k.id) as concepts, min(k.detail) as un_detail
  from seances s join classes c on c.id = s.classe_id
  left join concepts k on k.seance_id = s.id
 where c.code = 'BTS1-DEV-2026' and s.numero between 1 and 4
 group by s.numero order by s.numero;
-- attendu : 5 concepts par séance, et des détails qui commencent par un mot entier
```

---

## 14 septembre 2026 — les contrôles de séance existent enfin pour de bon

Trois notes du projet décrivaient depuis le 10/09 un job `fiche` de douze points
et un job `pedagogie` de huit contrôles. **Ni l'un ni l'autre n'était dans
`verifier-portail.yml`** : le fichier n'avait que `syntaxe` et `coherence`. Une
règle écrite quelque part et nulle part appliquée finit par être crue appliquée,
ce qui est pire que pas de règle.

Ils sont écrits, et ils vivent dans **`outils/`**, pas dans le YAML : on les
rejoue chez soi avant de pousser, en trois commandes. Un contrôle qu'on ne peut
pas rejouer chez soi est un contrôle qu'on finit par contourner.

| Job | Ce qu'il regarde |
|---|---|
| `coherence` | la page et la base, question par question, **et les deux blocs de chaque migration entre eux** |
| `fiche` | les douze points de forme d'une trace, dont la liste de concepts, identique en base |
| `pedagogie` | durée de lecture, durée des actes, prérequis, vocabulaire, longueur des bonnes réponses, boucle narrative |
| `essai` | casse quatorze fois, exprès, et vérifie que le défaut est **nommé** |

### Ce que les contrôles ont trouvé en s'exécutant la première fois

Six défauts réels, tous corrigés dans la foulée :

1. **Le job `coherence` ne lisait qu'une seule migration** — `*_bts1_seances.sql`.
   La séance 3, écrite dans son propre fichier, n'était vérifiée par personne.
   Le glob est devenu `*_bts1_seance*.sql`, et toutes les séances à venir y
   entrent d'elles-mêmes.
2. **Sept questions sur dix divergeaient dans la migration de la séance 3** :
   l'`insert` portait les distracteurs rallongés, le bloc de rattrapage les
   anciens, courts. Au prochain rejeu, le rattrapage aurait remis les anciens.
   Le bloc a été **régénéré depuis l'insert**, pas ressaisi.
3. **Les séances 1 et 2 n'avaient aucune liste « Concepts à connaître »**, alors
   que la migration de débriefing en écrivait cinq chacune en base. La source et
   la copie ne se ressemblaient pas ; le portail projetait quelque chose dont la
   trace écrite ne parlait pas.
4. **Les concepts de la séance 3 ne portaient pas leurs numéros de question** :
   la trace ne disait plus sur quoi chaque concept se mesure.
5. **Les distracteurs de la séance 1 q9 et de la séance 2 q10 étaient restés
   courts dans la page** alors que le SQL les avait rallongés. Un élève qui n'a
   rien suivi cochait la plus longue.
6. **La boucle du cold open ne se refermait ni en séance 1 ni en séance 2** : ni
   « 03 h 47 » ni « à la seconde près » ne revenait après les actes. Une phrase
   de clôture a été ajoutée à chacune.

### Et deux contrôles qui étaient aveugles

Trouvés parce que `essai.py` a essayé de les casser et n'y est pas arrivé :

- **la boucle narrative** cherchait le titre de récit dans tout ce qui suit les
  actes, **quiz compris** — or la dernière question porte justement sur le
  retournement, donc le titre s'y trouve toujours. Le contrôle passait au vert
  quoi qu'il arrive ;
- **le vocabulaire du quiz** était comparé au corps entier de la trace, **lequel
  contient le quiz**. Chaque terme s'y trouvait par construction.

C'est la leçon de ce dépôt, rencontrée pour la troisième fois : **tout contrôle
ajouté doit être testé en cassant ce qu'il prétend voir.** Le job `essai` le
fait maintenant à chaque passage.

### Une chose à savoir sur le seuil de vocabulaire

Rendu bloquant au mot près, il sortait **vingt et une lignes rouges sur trois
séances justes** — « souvent », « distingue », « entièrement » ne sont pas des
notions. Il bloque désormais seulement quand un énoncé ou une bonne réponse
compte au moins deux mots pleins et qu'**aucun** n'a été prononcé pendant
l'heure ; le reste sort en remarque. Un contrôle qui crie pour des broutilles
finit par n'être plus lu.

### Ce qui reste à faire

- **Pousser.** La VM n'a ni identifiants git ni `gh` : les deux dépôts sont à
  jour sur le disque, pas sur GitHub.
- La migration `20260910080000_debriefing.sql` **n'est toujours pas sur GitHub**,
  donc pas appliquée : elle attend le même push.
- La séance 4 — « Culture DevOps, cycle de vie & versioning Git » — est à écrire,
  à partir de `GABARIT_SEANCE.md` du dépôt étudiant.

---

## État des scripts SQL au 8 septembre 2026 — avant le CI/CD

Relevé fait en lisant Supabase avec la clé `anon`, celle du portail.

| Script | Ce qu'il fait | En base ? |
|---|---|---|
| `SQL_PORTAIL.md` | Tables, RPC d'identification, projets | ✅ |
| `INTITULES.sql` | Colonnes `intitule` et `options` sur `corriges` | ✅ |
| `COMPTES_TEST.sql` | Étudiant n° 99 dans chaque classe | ✅ |
| `APPEL.sql` + `APPEL_AUTO.sql` | Séance 99, question du jour auto-créée | ✅ |
| `HUMEUR.sql` | Question d'humeur après l'appel | ✅ |
| `SEANCE.sql` | `demarree_le`, `duree_min`, pré-vol, chrono | ⚠️ **à rejouer** — l'effectif du pré-vol compte encore le n° 99 |
| `PROJET.sql` | Nature projet, jalons, échéance | ⚠️ **à rejouer** — jalons présents, mais `echeance` toujours vide |
| `JALONS.sql` | 15 questions d'avancement sur les 5 TP | ✅ |
| `QUESTIONS.sql` | `questions_seance()`, comptage des jalons corrigé | ❓ à vérifier |
| `CONNAISSANCE.sql` | Séance 98, questionnaire de rentrée BTS1 | ✅ |
| `STAGE.sql` | Séance 97, suivi de recherche de stage BTS2 | ✅ |
| `QUIZ_RECLASSEMENT.sql` | Déplace les réponses de quiz mal rangées | ❓ à vérifier |
| `QUIZ_ENONCES.sql` | Les 35 énoncés du quiz BTS2 en base | ❓ à vérifier |
| `BTS1_SEANCES.sql` | Séances 1 et 2 du BTS1 + 20 corrigés | ❓ à vérifier |
| `MIGRATION_D1.sql` | Séances 3 à 14 | ✅ sans objet — elles existaient déjà |
| `ELEVES_BTS2.sql` | Inspection des comptes en double | 🔍 inspection seulement |

**Deux points ouverts, tous les deux visibles à l'écran :**

- L'**échéance du projet BTS2 est vide**. Tant qu'elle l'est, « jours restants »
  et « en risque » ne disent rien, et le pré-vol annonce qu'il ne peut rien dire
  du rythme. Rejouer la section 2 de `PROJET.sql`.
- La **séance 99 du BTS2 est fermée**. Une séance fermée refuse les réponses :
  aucun étudiant de deuxième année ne peut pointer sa présence. La rouvrir depuis
  le portail (« Démarrer la séance »). **Corrigé à la source** par
  `20260908100000_appel_permanent.sql` — voir plus bas ; en attendant que la
  migration soit poussée, le clic reste la façon de débloquer la classe.

---

## Ce qui a changé dans le code — 7 et 8 septembre 2026

### Un contrôle d'acquis avant chaque séance

Deux questions par notion : ce qu'ils savent, puis ce qu'ils croient savoir.
C'est l'écart qui sert. Se tromper en étant sûr n'appelle pas le même geste que
douter en ayant juste, et un chiffre unique confondrait les deux — le tableau
de bord nomme donc ceux qui se trompent en étant sûrs, puisque ceux-là ne
poseront aucune question.

Le contrôle appartient à la séance qu'il précède : ses questions sont des
corrigés de cette séance, préfixés `pre-`. Pas un questionnaire de la
bibliothèque — la bande 90-98 n'aurait pas tenu quatorze séances, et rien
n'aurait relié le contrôle à son heure.

Ce préfixe fait tout le travail d'isolement : sans lui, les réponses du
contrôle se glisseraient dans « 83 % juste », dans « Réussite par question »,
dans « 10 questions corrigées » et dans l'avancement élève par élève. Quatre
endroits font le tri, trois en SQL et un dans le portail, et il faut les quatre.

Vous l'écrivez en collant du texte, une notion par ligne, **une étoile devant
la bonne option**. Une ligne sans étoile ou avec deux fait échouer toute la
création en disant laquelle : un contrôle dont une notion n'a pas de bonne
réponse compterait tout le monde faux sans que rien ne le signale.

Rien ne bloque l'étudiant qui ne l'a pas fait — il est simplement nommé dans le
tableau de bord, prénom compris. Et aucune correction ne lui est montrée :
dire « faux » avant la séance transforme un point de départ en sanction, et
fausserait la question de certitude qui suit.

### L'appel comptait un absent qui n'existe pas

Le compte d'essai n° 99 figurait parmi les absents. Tous les jours, pour toutes
les classes : « 24 présents · 8 absents » quand il y en avait 7, et un effectif
de 32 pour 31 étudiants. Le filtre `numero <> '99'` existe dans le pré-vol, le
semestre, les questionnaires et le dépouillement — il manquait dans
`appel_classe()`, et là seulement.

Trois autres choses ont changé dans cette carte :

- **« 24 / 31 présents »** au lieu de « 24 présents ». Le nombre seul ne dit
  pas s'il en manque un ou douze.
- **Les prénoms sont collés aux numéros** dans la ligne rouge, celle qu'on lit
  à voix haute. `prenomSeul()` prend le dernier mot qui n'est pas en
  majuscules, les listes venant en « NOM Prénom ». Rien n'entre en base : la
  fonction ne rend que des numéros, les noms restent dans le navigateur.
- **Un bloc « Absences qui se répètent »** : pour chaque absent, combien
  d'appels il a manqués sur combien de posés, et depuis quand on ne l'a pas vu.
  Une absence isolée et une quatrième d'affilée demandent deux gestes
  différents ; la carte ne les distinguait pas du tout.

La rangée de pastilles d'absents a disparu — elle répétait la ligne rouge mot
pour mot. Et le portail dit désormais quand aucun nom n'est chargé dans ce
navigateur, avec le bouton pour les coller : les noms ne quittant jamais le
poste, chaque appareil a besoin de sa copie, et rien ne l'expliquait.

Sur un téléphone, les vingt-quatre arrivées faisaient une colonne de
vingt-quatre lignes avant d'atteindre le reste : elles sont repliées là,
dépliées sur grand écran. **2 807 px de carte avant, 2 074 après.**

### La séance 2 était lisible le jour de la séance 1

Constat du 09/09, après la première heure avec le BTS1. Le sommaire du site du
cours liste les quatorze séances dès qu'elles sont écrites, et rien ne l'en
empêchait : `ouverte` ne gouverne que l'enregistrement des réponses, pas la
lecture.

Deux notions qu'on confondait, désormais séparées : **`ouverte`** dit si la
séance accepte des réponses — vraie pendant l'heure ; **`publiee`** dit si les
étudiants ont le droit de la lire — vraie à partir du jour de la séance, et
pour toujours, parce que la trace écrite sert à réviser et qu'un absent doit
pouvoir rattraper. Clore ne dépublie pas.

« Démarrer la séance » publie aussi : on ne démarre jamais une séance qu'on
voulait cacher, et un geste de plus le jour J serait un geste oublié un jour
sur deux. Le bouton **Visible / Cachée** de la carte « Le semestre » sert aux
exceptions.

Côté site du cours, deux gestes et il faut les deux : le **sommaire est élagué**
sur toutes les pages — c'est dans le menu qu'on clique pour aller voir trop
loin — et le **contenu d'une séance non publiée est masqué**, titre excepté.
La session anonyme est établie avant la lecture des publications : sans elle la
requête peut échouer, rien n'est élagué, et le défaut revient en silence.

### Le portail sur le téléphone du prof

Audit à 390 px : **4 651 px** à faire défiler pour atteindre la progression des
élèves, et sept cibles sous 44 px. Les énoncés de la séance étaient dépliés par
défaut et placés avant les chiffres — deux mille pixels avant la moindre
information sur la classe.

Ils sont maintenant repliés et placés après ; « Élève par élève » passe avant
« Réussite par question » ; la barre d'onglets tient sur une ligne qui défile
au lieu de deux, ce qui rendait 88 px en permanence puisqu'elle est collante ;
`input`, `select` et `.btn` portent `min-height:44px`. **2 900 px, aucune cible
trop petite.**

### Une bibliothèque de questionnaires, écrits depuis le portail

L'interrupteur de la veille ne suffisait pas : il pilotait deux questionnaires
dont les numéros étaient écrits dans le code. En ajouter un troisième
demandait une migration, un numéro, une fonction côté étudiant et une fonction
de dépouillement.

Le modèle est maintenant à deux étages. Un **modèle** porte le texte, écrit une
fois ; une **affectation** est une séance dans une classe, avec ses propres
réponses. Écrire « Faisons connaissance » une fois et le donner à deux classes
fait deux jeux de réponses et un seul texte à corriger.

Dans l'onglet Questionnaires : chaque modèle, ses classes en cases à cocher,
et pour chaque classe cochée un interrupteur. **Cocher prépare, l'interrupteur
montre** — deux gestes séparés, sinon on publierait ce qu'on vient d'écrire.
Sous chaque modèle, un dépliant par classe donne les réponses, chargé
seulement à l'ouverture.

Écrire un questionnaire, c'est coller un bloc de texte : une question par
ligne, l'intitulé puis deux à quatre options séparés par « · ». Une ligne mal
formée fait **échouer toute la création**, en disant laquelle et pourquoi —
un questionnaire amputé d'une question sans qu'on le sache serait pire.

Retirer un questionnaire d'une classe est refusé dès qu'une réponse existe, et
le message dit quoi faire à la place : l'éteindre, ce qui le retire de l'écran
des étudiants sans rien perdre.

Côté étudiant, `mes_questionnaires()` remplace les deux fonctions figées : le
portail fabrique une carte par questionnaire ouvert, dans l'ordre où ils ont
été donnés, en mode « une question à la fois » ou « tout à l'écran » selon le
modèle. Un repli sur les anciennes fonctions reste en place tant que la
migration n'est pas déployée partout : un déploiement en retard ne doit pas
vider l'écran d'une classe en séance.

**Et un contrôle qui manquait.** Le découpage a emporté sept fonctions —
`repondreAppel`, `proposerHumeur`, `texteEnvoi` — sans que rien ne le signale :
`node --check` ne voit qu'une syntaxe valide, et l'erreur n'arrive qu'au clic.
Le workflow vérifie désormais que toute fonction appelée est définie.

### Les questionnaires s'activent maintenant depuis le portail

« Faisons connaissance » était déjà actif pour les BTS1 — 12 questions, séance
98 ouverte — mais rien ne le disait : l'état vivait dans une colonne `ouverte`
que seul le SQL Editor montrait. Deux fonctions l'exposent désormais,
`questionnaires()` et `ouvrir_questionnaire()`, et l'onglet **Questionnaires**
porte un interrupteur par classe, avec le nombre de questions et où en est la
classe. Éteindre ne détruit rien : rallumer remet chacun où il en était.

L'interrupteur n'accepte que les numéros 97 et 98. Une séance de cours se
pilote avec son propre geste, qui porte le chrono ; la séance 99 ne se ferme
pas. Trois natures, trois gestes — les fondre en un seul finirait comme
`preflight_seance()` définie deux fois, où la seconde écrasait la première.

### La vue étudiant sur un téléphone

Rien ne débordait, aucune cible n'était trop petite — mais il fallait faire
défiler 2 256 px de cartes empilées sans savoir combien il en restait ni où
l'on allait.

- **Une file d'attente** en haut : ce qui reste avant « Vos projets », et un
  raccourci vers eux une fois la présence marquée — la seule chose qui ne peut
  pas attendre. Sans énumération : à 390 px elle passait sur trois lignes.
- **Chaque carte porte son rang**, recalculé à l'affichage : selon la classe et
  le jour il y a deux cartes ou quatre.
- **Une carte finie se replie** sur son titre et une ligne verte. La page passe
  de 2 256 à 1 769 px quand l'appel et l'humeur sont faits. Elle ne disparaît
  pas : « il était là tout à l'heure » se lit comme un bogue.
- **Typographie française** : « Dans « SI », que veut dire le I ? » se coupait
  avant le point d'interrogation, qui restait seul sur sa ligne. `typo()` pose
  une espace fine insécable devant `? ! ; :` et dans les guillemets.

### Les classes de démonstration comptaient comme des vraies

Quatre classes en base — BTS1, BTS2, et deux démos — et les quatre
apparaissaient partout : sélecteurs, tableau « Vos classes », semestre, et un
appel interrogé pour rien sur des classes sans séance 99.

Règle posée : **un code qui commence par `DEMO` est une démonstration**. C'était
déjà la convention de `a_faire()` en base ; c'est maintenant la même dans le
portail. Les démos disparaissent de tout ce qui se lit en séance et restent
dans les deux sélecteurs, dans un groupe « Démonstration » — la base n'est pas
touchée, rien n'est supprimé.

### Les dépôts sont rangés sous leur classe

`projets.classe_id` décide de ce qu'un étudiant trouve après s'être identifié.
L'écran enseignant affichait une liste à plat avec le code de classe collé
devant la description. Il montre maintenant une section par classe, et dit
explicitement quand une classe n'a aucun dépôt : ses étudiants s'identifieraient
pour ne rien trouver.

Au passage, un défaut d'affichage qui traînait des deux côtés : `.projet-t` est
un `<span>`, sa marge basse n'agissait pas, et le titre du projet se collait à
sa description. `display:block` sur les deux.

### Un compte ouvert sur deux appareils : le second déloge le premier

Après la réouverture de la séance 99, l'erreur persistait — mais ce n'était
plus la même. `repondre()` renvoyait `Non identifie` : `rejoindre()` rattache
le compte au **dernier appareil identifié**, et la page déjà ouverte sur le
premier ne s'en aperçoit pas. Elle continue d'afficher « Vous êtes le numéro
99 » et tous les envois échouent.

Le message disait « Réessayez dans un instant » — faux, comme pour la séance
fermée. Les quatre points d'envoi (appel, humeur, connaissance, stage) passent
maintenant par une seule fonction `texteEnvoi()` qui distingue trois cas :
session reprise ailleurs, séance fermée, et le reste. Dans le premier cas, le
bouton « Ce n'est pas moi » passe en bouton principal : la sortie est là.

Ce n'est pas un cas de laboratoire. Un étudiant qui ouvre le portail sur le
poste de la salle puis sur son téléphone déloge le poste ; de retour dessus,
« ça ne marche plus ».

### L'espace enseignant tenait sur trois écrans de défilement

Cinq cartes empilées : l'appel — le geste de trente secondes qu'on fait chaque
heure — se trouvait au milieu, entre « Vos classes » et « Faisons
connaissance ». En séance, on cherchait.

L'espace est maintenant **une zone épinglée et quatre onglets** :

- **Ce qui bloque** reste au-dessus, visible depuis n'importe quel onglet. Son
  titre se masque avec sa carte : un intertitre au-dessus de rien se lit comme
  une panne.
- **Appel du jour**, ouvert par défaut — c'est le geste du début d'heure. Il
  porte une pastille avec le nombre d'absents, toutes classes confondues, qui
  disparaît quand il n'y a personne d'absent : un « 0 » rouge se lirait comme
  un incident.
- **Vue d'ensemble** : le semestre, vos classes, tous les projets.
- **Questionnaires** : la rentrée du BTS1, la recherche de stage du BTS2 — deux
  choses qu'on ouvre quelques fois dans l'année, pas chaque semaine.
- **Suivi d'une séance** : le pré-vol, la cadence, la réussite par question.

La barre d'onglets est collante, et changer d'onglet depuis le bas d'une longue
carte ramène en haut — sinon on tombe au-delà du contenu et l'écran paraît vide.
Flèches gauche/droite au clavier, un seul onglet dans l'ordre de tabulation.

### L'appel du BTS2 était fermé, et le message disait de réessayer

Un étudiant qui répondait à la question du jour voyait « L'enregistrement n'a
pas abouti. Réessayez dans un instant. » Réessayer ne pouvait rien donner : la
séance 99 du BTS2 avait été close la veille, et `repondre()` refuse toute
réponse sur une séance fermée — `Seance fermee`, HTTP 400. Reproduit avec le
compte d'essai n° 99 du BTS2, refus identique.

Trois défauts se sont additionnés, et chacun est corrigé :

1. **Le bouton « Clore la séance » s'appliquait à la séance 99.** Or la 99
   n'est pas une séance : c'est le registre d'appel, décrit dès `APPEL.sql`
   comme « ouverte en permanence ». La clore coupe le pointage **et** la
   question d'humeur de toute une classe. Le bouton disparaît maintenant sur la
   99, `clore_seance()` refuse avec le motif `appel`, et un déclencheur
   `appel_reste_ouvert` rouvre la ligne quelle que soit la voie employée —
   portail, SQL Editor, script.
2. **`appel_du_jour()` fabriquait la question du jour même sur une séance
   fermée.** L'étudiant voyait donc une question, y répondait, et se faisait
   refuser sans rien comprendre. Le verrou ci-dessus rend l'état impossible.
3. **Le message côté étudiant mentait.** Il dit désormais « L'appel est fermé
   pour cette classe. Prévenez votre enseignant : votre présence n'est pas
   enregistrée. » — un message qui dit quoi faire, au lieu d'un message qui
   fait perdre cinq minutes. Même correction sur la question d'humeur.

Quatre assertions sont ajoutées au workflow : aucune séance 99 fermée après la
chaîne, un `update` direct ne la ferme pas, `clore_seance(99)` rend `appel`, et
— pour que le verrou ne déborde pas — une séance ordinaire se ferme toujours.


### Le comptage de l'avancement BTS2 était faux, deux fois

Le tableau de bord PlaylistApp n'enregistre pas les missions comme les quiz :
une case cochée vaut `true` sous une clé `tp…`, une question de quiz vaut
`ok`/`ko` sous une clé `q-…`, et son option choisie vaut `0` à `3` sous
`q-…-pick`. Compter toutes les lignes affichait « 15/5 » ; puis compter
`reponse = 'ok'` sur `tp%-m%` affichait zéro pour tout le monde — car aucune
mission ne vaut `ok`, et les 29 items du parcours ne sont pas tous des `-m`.

Règle juste : **clé commençant par `tp`, réponse `true`**. Elle redonne bien
3, 5, 8, 7 et 6 jalons par TP.

### Le quiz BTS2 partait au mauvais endroit, et un tiers se perdait

Sept blocs de quiz pour cinq TP — le TP1 et le TP2 en ont deux chacun — mais
`tpDeLaCle()` lisait l'indice du bloc comme un numéro de TP. Le quiz LINQ
partait sur la séance du TP2, celui du TP2 sur les séances TP3 et TP4, et les
blocs 5 et 6 étaient perdus : il n'existe pas de séance numéro 5 ni 6, et
l'envoi sortait en silence.

Second défaut, qui aurait rendu la correction sans effet : `dernierEnvoi` était
construit sur l'état **fusionné**, donc tout ce qu'un poste avait en local et
que le serveur n'avait pas était réputé déjà envoyé.

### Les séances de cours du BTS1 n'avaient aucun corrigé

Le site du cours appelle `repondre(seance_id, 'q1', 'B')`. Sans corrigé, les
réponses sont enregistrées mais jamais évaluées, et le tableau de bord reste
vide. `BTS1_SEANCES.sql` ajoute les vingt corrigés des séances 1 et 2.

### Le pré-vol comptait un étudiant de trop

Le compte d'essai n° 99 entrait dans l'effectif du pré-vol alors que le tableau
de bord l'exclut déjà. Deux écrans, deux nombres pour la même classe.

### Ce que le portail montre en plus

- **Appel du jour** : toutes les classes ensemble, les numéros absents en gros,
  un bouton qui les copie. Les noms viennent du `localStorage` de l'enseignant,
  jamais de la base.
- **Faisons connaissance** : le questionnaire de rentrée BTS1, une question à la
  fois, avec un bloc « À prendre en compte » qui nomme les cas qui appellent une
  décision — pas d'ordinateur, connexion faible, jamais codé.
- **Recherche de stage** : le point d'étape BTS2, révisable, avec les numéros
  rangés par étape et la date de dernière mise à jour collée au numéro.
- La question d'appel n'est plus comptée comme un point à régler dans le
  pré-vol : elle se crée d'elle-même à la première connexion.

---

## Vérifier soi-même où en est la base

À coller dans Supabase → SQL Editor. Aucune modification, que de la lecture.

```sql
select c.code,
       s.numero,
       left(s.titre, 40)                             as titre,
       s.nature,
       s.ouverte,
       s.jalons,
       s.echeance,
       count(co.*)                                   as corriges
  from public.classes c
  join public.seances s   on s.classe_id = c.id
  left join public.corriges co on co.seance_id = s.id
 where c.code in ('BTS1-DEV-2026', 'BTS2-SLAM-2026')
 group by c.code, s.numero, s.titre, s.nature, s.ouverte, s.jalons, s.echeance
 order by c.code, s.numero;
```

Ce qu'on doit y lire :

- BTS1 : séances 1 à 14, plus 98 et 99. **Dix corrigés sur les séances 1 et 2**,
  douze sur la 98, trois sur la 99.
- BTS2 : séances 0 à 4 en `projet`, jalons 3/5/8/7/6, **une échéance non vide**,
  et 8 à 13 corrigés chacune (3 questions de jalon + les énoncés de quiz).
  Plus la 97 avec 6, et la 99 **ouverte** avec 3.
- Une séance de cours sans corrigé enregistre les réponses sans jamais les
  évaluer. Une séance de projet sans jalons calcule un pourcentage sur zéro.

---

## Règles qui ne se devinent pas

- **La page fait foi pour l'énoncé et l'ordre des options ; la base fait foi
  pour la bonne réponse.** Permuter des options dans un support oblige à changer
  la `bonne_reponse` du script. L'un ne se déduit pas de l'autre.
- **Pas de code entre accents graves dans l'énoncé d'une question** du quiz
  BTS1 : le parseur prend le premier `<code>` du paragraphe comme début des
  options.
- `suivi_projet()` est définie **deux fois**, dans `PROJET.sql` et dans
  `QUESTIONS.sql`. Les deux doivent rester d'accord.
- Répartir les bonnes réponses sur A, B, C et D. Une classe repère très vite un
  motif.
- La table `eleves` ne contient **ni nom, ni prénom, ni adresse**. Jamais.
