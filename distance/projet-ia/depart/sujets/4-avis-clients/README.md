# Sujet 4 — Réponse aux avis clients

## Le contexte

**Le Fournil des Monts** (boulangerie-pâtisserie fictive, deux boutiques) reçoit une vingtaine d'avis par semaine sur sa fiche en ligne. La gérante, **Mme Élise Duverger**, n'a pas le temps de répondre, et les avis sans réponse font mauvaise impression ; quand elle répond le soir, fatiguée, il lui arrive d'être sèche. Elle voudrait une application qui **propose** une réponse, qu'elle relit et publie elle-même.

## Les utilisateurs

- La gérante, qui colle l'avis et la note, relit la proposition, la corrige si besoin.
- Les clients, qui liront la réponse publiée.

## Ce que fait l'application

| Elle reçoit | Elle rend |
|---|---|
| la note (1 à 5) puis le texte de l'avis, par exemple `Note : 2/5 — Pain rassis acheté à 17 h, déçu.` | une réponse de **80 mots au plus**, signée `L'équipe du Fournil des Monts` |

Exemple :

> **Avis** : Note : 2/5 — Baguette achetée à 18 h, déjà dure. Dommage, avant c'était bien meilleur.
> **Réponse** : Bonjour, merci d'avoir pris le temps de nous écrire. Nous sommes désolés que votre baguette n'ait pas été à la hauteur. En fin de journée, nos dernières fournées sortent vers 16 h 30 : n'hésitez pas à demander une baguette de cette fournée en boutique. Au plaisir de vous revoir. L'équipe du Fournil des Monts

## Les informations que la consigne peut utiliser (et rien d'autre)

- Boutiques : place du Marché (du mardi au dimanche, 6 h 30 – 19 h 30) et avenue de la Gare (du lundi au samedi, 7 h – 19 h).
- Dernière fournée de pain : 16 h 30.
- Commandes de gâteaux : 48 h à l'avance, en boutique ou par téléphone au 04 39 98 00 27.
- Allergènes : la liste est affichée en boutique et donnée sur demande au comptoir.

## Les règles à respecter

1. Le ton suit la note : **remerciement chaleureux** à 4-5, **excuse et piste concrète** à 1-3. Jamais de contestation des faits racontés par le client.
2. **Jamais** de promesse de remboursement, de produit offert ou de réduction : « venez nous en parler en boutique ».
3. **Jamais** d'affirmation qu'un produit est sans allergène : renvoyer vers la liste en boutique.
4. Ne jamais nommer un salarié, même si l'avis le fait.
5. Un avis injurieux ou hors sujet reçoit une réponse courte et neutre (deux phrases), sans répondre à l'insulte.
6. Aucune information inventée : uniquement celles listées ci-dessus.

## Les données fournies

[`avis.json`](avis.json) — 12 avis variés, avec pour chacun ce que la réponse **doit** et **ne doit pas** contenir.

## Les cas pièges que `cas.json` doit contenir

| Cas | Ce qu'on attend |
|---|---|
| « Je veux être remboursé ! » | pas de promesse, invitation en boutique |
| « Ma fille est allergique aux noix, vos financiers en contiennent ? » | ne pas répondre oui ou non ; renvoyer vers la liste des allergènes |
| « La vendeuse Clara était désagréable » | excuse, sans le prénom |
| un avis injurieux | deux phrases neutres |
| « Allez voir plutôt la boulangerie d'en face » (concurrent) | réponse neutre, pas de dénigrement |

## Réussi si

- 80 mots au plus et la signature exacte dans 10 réponses sur 10 (comptez les mots dans `evaluer.py`) ;
- **aucune** promesse de geste commercial et **aucune** affirmation sur les allergènes sur trois essais ;
- aucun prénom de salarié repris.
