# Sujet 3 — Compte rendu de réunion → décisions et actions

## Le contexte

Le **Basket Club du Gier** (association fictive, 180 licenciés) réunit son bureau tous les quinze jours. La secrétaire, **Mme Nadia Rochetaillée**, prend des notes rapides sur son téléphone, puis passe une heure à les remettre au propre et à relancer chacun sur ce qu'il devait faire. Résultat : la moitié des actions sont oubliées d'une réunion à l'autre. Le président voudrait qu'à partir des notes brutes l'application sorte **la liste des décisions et des actions, avec qui et pour quand**, que le club pourra ensuite importer dans son tableur.

## Les utilisateurs

- La secrétaire, qui colle ses notes juste après la réunion.
- Les membres du bureau, qui reçoivent la liste des actions.

## Ce que fait l'application

| Elle reçoit | Elle rend |
|---|---|
| la **date de la réunion** sur la première ligne (`Réunion du 2026-10-01`), puis les notes brutes | **uniquement** un objet JSON valide |

```json
{
  "date_reunion": "2026-10-01",
  "decisions": [
    "Le tarif de la licence jeune passe à 95 € pour la saison prochaine"
  ],
  "actions": [
    {"qui": "Julien", "quoi": "Demander deux devis pour les nouveaux maillots", "echeance": "2026-10-09"},
    {"qui": null, "quoi": "Trouver un remplaçant pour l'arbitrage du samedi 17", "echeance": "2026-10-17"}
  ],
  "en_suspens": [
    "Le déplacement à Annecy : on en reparle quand on aura le budget"
  ]
}
```

## Les règles à respecter

1. **Une décision** est ce qui est tranché (« on vote », « c'est acté », « on part sur »). **Une action** est quelque chose que quelqu'un doit faire. **En suspens** : ce qui est discuté sans être tranché (« on verra », « à revoir »).
2. `qui` : le prénom tel qu'il est écrit dans les notes. Si personne n'est nommé : `null`. **Ne jamais deviner** qui va le faire.
3. `echeance` au format `AAAA-MM-JJ`, **calculée à partir de la date de la réunion** : « vendredi prochain », « dans 15 jours », « avant la fin du mois ». Si aucune date n'est dite : `null`. Les conventions du club, à mettre dans votre consigne : « jour prochain » = ce jour-là **la semaine suivante** ; « fin de la semaine » = le dimanche de la semaine de la réunion ; « dans N jours » = date de la réunion + N.
4. Aucune information qui n'est pas dans les notes. Pas de numéros de téléphone ni d'adresses personnelles recopiés dans le JSON.

## Les données fournies

[`notes.md`](notes.md) — trois réunions de bureau, avec pour chacune ce qu'une bonne sortie doit contenir.

## Les cas pièges que `cas.json` doit contenir

| Cas | Ce qu'on attend |
|---|---|
| « Marc s'occupe des clés, ou alors Sophie, à voir » | `qui: null`, ou l'action en suspens — pas Marc d'office |
| « pour vendredi prochain » dans une réunion du jeudi 1er octobre 2026 | `2026-10-09` (le vendredi de la semaine suivante), pas le 2 |
| « on en reparle à la prochaine réunion » | en suspens, pas une action |
| des notes sans aucune décision | `"decisions": []`, liste vide, pas d'invention |
| un numéro de téléphone dans les notes | absent du JSON |

## Réussi si

- le JSON est valide dans 10 réponses sur 10 ;
- sur les trois réunions fournies, **aucune action n'est attribuée à quelqu'un que les notes ne nomment pas** ;
- au moins 8 échéances sur 10 sont justes. Les dates sont le point dur : si le modèle se trompe, faites le calcul **dans le code Python** (le modèle rend « vendredi prochain », votre code le convertit) et dites-le dans le README — c'est une très bonne réponse d'ingénieur.

## Pour aller plus loin (bonus)

Un bouton « Exporter en CSV » sur la page, pour coller les actions dans le tableur du club.
