# La base du portail — migrations et déploiement

## Le principe

**Ce qui part sur `main` part sur Supabase.** Une migration ajoutée dans
`migrations/` et poussée est appliquée à la base de production, celle où
travaillent 44 étudiants. C'est tout l'intérêt — plus de copier-coller dans le
SQL Editor, plus de doute sur ce qui est passé — et c'est aussi ce qui demande
les garde-fous décrits plus bas.

Avant, l'état du dépôt et l'état de la base n'avaient aucun rapport garanti :
un script commité pouvait n'avoir jamais été exécuté, et rien ne le disait.
C'est ce qui a laissé passer une échéance de projet jamais posée pendant deux
semaines, et une séance d'appel fermée pour tout un BTS2.

## Ce qu'il faut créer une fois

Deux secrets, dans **Settings → Secrets and variables → Actions** du dépôt.
**Je ne les manipule pas et je ne les vois pas** : à créer vous-même.

| Secret | Où le prendre |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → Generate new token |
| `SUPABASE_DB_PASSWORD` | Le mot de passe de la base, choisi à la création du projet. Réinitialisable dans Settings → Database → Database password |

La référence du projet (`pjuymnnblbydpjlpnoeh`) n'est pas un secret : elle est
déjà dans `config.js`, servi publiquement.

**Recommandé** : Settings → Environments → `production` → cocher *Required
reviewers* et vous mettre en relecteur. Le workflow s'arrêtera alors avant
d'écrire, et attendra un clic de votre part. Une migration qui part par erreur
un dimanche soir est plus facile à arrêter qu'à défaire.

## Ce que fait le workflow

`.github/workflows/supabase.yml`, à chaque poussée touchant `migrations/` :

1. **Vérifier** — monte une base PostgreSQL neuve, y pose le socle historique,
   puis rejoue **toutes** les migrations **deux fois**. Deux fois, parce
   qu'une migration qui passe une fois et échoue la seconde n'est pas
   idempotente. Puis il compte : 2 projets par classe, 20 corrigés sur les
   séances 1 et 2, 14 séances au BTS1. C'est ce test qui aurait attrapé les
   liens de projets dupliqués du socle.
2. **Appliquer** — `supabase db push` sur la vraie base, seulement si l'étape
   précédente est verte.

Rien n'atteint la production sans avoir été rejoué proprement sur une base
vierge.

## Écrire une migration

Nom : `AAAAMMJJHHMMSS_ce_que_ca_fait.sql`. L'ordre d'application est l'ordre
alphabétique des noms — donc chronologique.

Trois exigences, dans l'ordre d'importance :

1. **Rejouable.** `create table if not exists`, `add column if not exists`,
   `create or replace function`, et une garde `not exists` sur chaque `insert`.
   C'est l'exigence qui compte : le workflow rejoue tout, deux fois, à chaque
   fois.
2. **Sans destruction.** Un script qui supprime va dans `operations/`.
3. **Commentée.** Pas ce que fait le SQL — cela se lit — mais pourquoi il
   existe, et quel défaut il corrige.

## Sur une base neuve

La chaîne suppose le socle d'août 2026 déjà posé : les tables `classes`,
`eleves`, `seances`, `corriges`, `reponses`, et la fonction
`est_enseignant()`. La première migration le **vérifie** et échoue avec un
message lisible si quelque chose manque — elle ne le crée pas.

C'est volontaire : `est_enseignant()` décide qui voit les données de la classe
entière. La recréer avec un corps deviné serait le pire endroit où se tromper.
Si elle manque, c'est qu'on ne vise pas la bonne base.

## Si `db push` veut rejouer ce qui est déjà appliqué

Au premier passage, l'historique de migrations de Supabase est vide : le
workflow va donc appliquer les seize migrations sur une base qui les contient
déjà. **C'est sans danger** — elles sont toutes idempotentes, et c'est vérifié
à chaque exécution. Deux d'entre elles feront même du bien : l'échéance du
projet BTS2 et l'effectif du pré-vol, qui n'avaient jamais été rejoués.

Pour marquer une migration comme déjà appliquée sans l'exécuter :

```
supabase migration repair --status applied 20260825120000
```
