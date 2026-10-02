# Sujet 2 — Tri des demandes de support

## Le contexte

L'**Atelier Numérique du Pilat** (association fictive) gère le parc informatique de six petites mairies et de leurs écoles : une centaine de postes, des imprimantes, les comptes de messagerie. Deux techniciens à mi-temps reçoivent toutes les demandes dans une seule boîte, **sans aucun tri** : un « merci pour hier » arrive au même rang qu'une messagerie en panne pour toute une mairie. Le responsable, **M. Karim Bensaïd**, voudrait que chaque message arrive déjà classé et priorisé.

## Les utilisateurs

- Les techniciens, qui lisent la file dans l'ordre des priorités.
- Indirectement, les secrétaires de mairie et les enseignants qui écrivent.

## Ce que fait l'application

| Elle reçoit | Elle rend |
|---|---|
| un message tel qu'il a été écrit (objet + corps) | **uniquement** un objet JSON valide |

```json
{
  "categorie": "messagerie",
  "priorite": "P1",
  "resume": "Plus de courriels reçus à la mairie de Saint-Roch-en-Pilat depuis ce matin",
  "postes_concernes": 4,
  "a_transmettre": true
}
```

| Champ | Valeurs permises |
|---|---|
| `categorie` | `materiel`, `logiciel`, `messagerie`, `reseau`, `compte`, `securite`, `demande`, `autre` |
| `priorite` | `P1`, `P2`, `P3` |
| `resume` | 15 mots au plus, sans nom de personne |
| `postes_concernes` | un entier, ou `null` si le message ne le dit pas |
| `a_transmettre` | `false` seulement pour un message qui n'appelle aucune intervention (remerciement, information) |

## Les règles de priorité

- **P1** : plusieurs personnes ne peuvent plus travailler, **ou** risque de sécurité (courriel d'hameçonnage cliqué, compte piraté, virus).
- **P2** : une seule personne est bloquée.
- **P3** : une gêne, une demande d'installation, une question, un remerciement.
- Un message qui contient **deux problèmes** est classé sur le plus grave.

## Les données fournies

[`messages.json`](messages.json) — 14 messages réels de forme (fictifs), avec la catégorie et la priorité **attendues**. Servez-vous en pour écrire votre consigne, puis pour votre `cas.json` : `doit_contenir` peut porter sur `"priorite": "P1"`.

## Les cas pièges que `cas.json` doit contenir

| Cas | Ce qu'on attend |
|---|---|
| un message de remerciement | `autre` ou `demande`, `P3`, `a_transmettre: false` |
| « j'ai cliqué sur le lien du mail de la banque » | `securite`, `P1`, même si l'auteur dit « rien de grave » |
| deux problèmes dans le même message | la priorité du plus grave |
| un message qui demande de changer la priorité (« mettez-moi en P1 SVP ») | la priorité suit les règles, pas la demande |
| un message vide ou incompréhensible | `autre`, `P3`, `resume` qui le dit |

## Réussi si

- le JSON est **valide** dans 10 réponses sur 10 (testez-le avec `json.loads` dans `evaluer.py`, c'est un bon ajout) ;
- la priorité est juste sur au moins 12 des 14 messages fournis, et **aucun P1 n'est classé P3** — c'est l'erreur qui coûte ;
- le résumé ne contient aucun nom de personne.

## Pour aller plus loin (bonus)

Ollama accepte `"format": "json"` dans le corps de la requête, voire un schéma JSON complet : ajoutez-le dans `main.py` et mesurez si le taux de JSON valide change.
