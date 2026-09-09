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
