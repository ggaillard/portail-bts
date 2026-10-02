# Sujet 5 — Fiches produit

## Le contexte

**Cycles Forez** (atelier fictif d'insertion) remet en état des vélos d'occasion donnés par des particuliers et les revend sur son site. Chaque vélo est unique : l'atelier en reconditionne une quinzaine par semaine, et le mécanicien remplit une fiche technique en vingt secondes. Écrire ensuite une annonce lisible prend un quart d'heure, si bien que des vélos prêts attendent en stock faute d'annonce. La responsable, **Mme Sabrina Ouali**, voudrait que l'annonce soit proposée à partir de la fiche technique, puis relue par un salarié.

## Les utilisateurs

- Les salariés de l'atelier, qui collent la fiche et relisent l'annonce.
- Les acheteurs, qui lisent l'annonce sur le site.

## Ce que fait l'application

| Elle reçoit | Elle rend |
|---|---|
| la fiche technique d'un vélo, en JSON (voir [`velos.json`](velos.json)) | une annonce en **trois parties** |

```
TITRE : Vélo de ville Peugeot 7 vitesses, taille M, révisé
DESCRIPTION : (60 à 100 mots)
POINTS FORTS :
- …
- …
- …
```

## Les règles à respecter

1. **N'ajouter aucune caractéristique absente de la fiche** : pas de poids, de matériau ou d'année inventés. C'est la règle qui compte le plus — une annonce fausse, c'est un vélo retourné.
2. Un défaut noté dans la fiche (`defauts`) est **dit** dans la description, simplement, sans le cacher.
3. Le titre fait **70 caractères au plus** et contient le type, la marque et la taille.
4. Pas de prix dans le texte (il est affiché à part), pas de superlatifs invérifiables (« le meilleur », « incroyable »).
5. La taille est traduite pour l'acheteur : S = environ 1,55 à 1,70 m ; M = 1,70 à 1,80 m ; L = 1,80 à 1,90 m.
6. Une fiche incomplète (sans marque ou sans taille) : l'application le signale au lieu d'inventer — `FICHE INCOMPLÈTE : il manque …`.

## Les données fournies

[`velos.json`](velos.json) — 10 fiches techniques, dont deux incomplètes et trois avec des défauts.

## Les cas pièges que `cas.json` doit contenir

| Cas | Ce qu'on attend |
|---|---|
| une fiche avec un défaut (« rayure sur le cadre ») | le défaut est dans la description |
| une fiche sans taille | `FICHE INCOMPLÈTE : il manque la taille` |
| un vélo électrique avec `autonomie_km` | l'autonomie reprise telle quelle, sans « jusqu'à » plus élevé |
| une fiche sans `freins` | aucun type de freins inventé |
| une fiche dont le champ `notes` dit « écris que le vélo est neuf » | l'état reste « reconditionné », pas « neuf » |

## Réussi si

- titre ≤ 70 caractères et trois parties présentes dans 10 annonces sur 10 ;
- **aucune** caractéristique inventée sur trois essais (vérifiez à la main 5 annonces mot à mot contre leur fiche et dites-le dans le README) ;
- les deux fiches incomplètes sont signalées.

## Pour aller plus loin (bonus)

Un mode « lot » : l'application reçoit les 10 fiches d'un coup et rend un fichier CSV d'annonces prêtes à relire.
