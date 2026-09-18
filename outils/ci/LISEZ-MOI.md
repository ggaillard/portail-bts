# `outils/ci/` — la copie de travail des workflows

## Pourquoi ce dossier existe

GitHub ne lit les workflows que dans `.github/workflows/`. Ce dossier-là est
**protégé** : le pont entre Claude et l'ordinateur refuse d'y écrire, et c'est
une bonne chose — un fichier qui déclenche une exécution ne doit pas pouvoir
être modifié à distance sans que personne ne regarde.

Conséquence : toute correction apportée à un workflow depuis une session Claude
restait bloquée dans un dossier à part, hors du dépôt, et il fallait **penser**
à la recopier. Le 17/09 on a mesuré ce que « penser à » vaut : le workflow
déployé datait d'avant le découpage en modules, sa première étape cherchait le
script dans un bloc `<script>` disparu, elle échouait donc, et les deux étapes
suivantes — dont « toute fonction appelée est-elle définie » — ne s'exécutaient
plus. **Deux jours de poussées non vérifiées, sans que rien ne le dise.**

Un contrôle qui ne tourne pas ressemble exactement à un contrôle qui passe.

## Ce que fait ce dossier

Les workflows sont écrits ici, dans le dépôt, donc versionnés et poussés comme
n'importe quel fichier. `outils/mesurer.mjs` compare ensuite chaque fichier de
`outils/ci/` à son jumeau de `.github/workflows/` et **échoue quand les deux
diffèrent**, en donnant la commande de copie. L'oubli devient visible au lieu
d'être silencieux.

## Le geste, quand mesurer.mjs le réclame

Depuis la racine du dépôt, dans PowerShell :

    Copy-Item outils\ci\*.yml .github\workflows\ -Force

Puis Commit + Sync. `node outils/mesurer.mjs` doit repasser au vert.
