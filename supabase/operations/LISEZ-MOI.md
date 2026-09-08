# Opérations — à lancer à la main, jamais toutes seules

Ce dossier n'est **pas** dans la chaîne de migrations, et c'est délibéré.

Une migration s'applique automatiquement dès qu'elle part sur `main`. Ces
trois scripts n'ont rien à faire dans ce circuit : ils détruisent, ils
déplacent, ou ils ne servent qu'une fois. Les rejouer sans y penser ferait des
dégâts silencieux.

| Script | Ce qu'il fait | Pourquoi il reste ici |
|---|---|---|
| `JEU_ESSAI.sql` | Crée deux classes de démonstration | Il **supprime** d'abord les classes `DEMO%`. Un outil de mise au point, pas une migration. |
| `ELEVES_BTS2.sql` | Inspecte les comptes en double du BTS2 | Sa section de nettoyage supprime des lignes d'`eleves`. On regarde d'abord, on décide, on exécute. |
| `QUIZ_RECLASSEMENT.sql` | Déplace les réponses de quiz rangées sous la mauvaise séance | Correction ponctuelle d'un défaut réparé dans `suivi.js`. La rejouer sur une base déjà corrigée ne ferait rien, mais elle n'a plus lieu d'être. |

**La règle** : si un script peut détruire quelque chose, ou s'il ne vaut que
pour un état précis de la base à un moment précis, il vit ici. Si on peut le
rejouer indéfiniment sans conséquence, c'est une migration.

Chacun s'ouvre sur une section d'inspection, et garde son bloc destructeur en
commentaire, dans une transaction qui finit par `rollback`. Lire, décider,
remplacer `rollback` par `commit`.
