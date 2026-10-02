# Notes brutes de trois réunions de bureau — Basket Club du Gier

*Notes fictives. Ce qui est sous chaque réunion, après « Attendu », sert à écrire vos cas de test : ne le collez pas dans l'application.*

---

## Réunion 1

```
Réunion du 2026-10-01
présents : Nadia, Julien, Marc, Sophie, Karine (trésorière)
- maillots : les U15 n'ont plus rien de correct. Julien demande 2 devis pour vendredi prochain
- licence jeune : vote, passe à 95€ la saison prochaine (5 pour, 0 contre)
- arbitrage du samedi 17 : il manque quelqu'un, qui peut ? personne pour l'instant
- Karine : compte bancaire, il reste 3 200 € après les inscriptions
- tournoi de Noël : on part sur le samedi 19 décembre, gymnase Jean-Macé
- déplacement Annecy pour les seniors : on verra quand on aura le budget
- Sophie envoie le planning des créneaux aux coachs avant la fin de la semaine
```

**Attendu**
- Décisions : licence jeune à 95 € ; tournoi de Noël le samedi 19 décembre au gymnase Jean-Macé.
- Actions : Julien — 2 devis maillots — 2026-10-09 ; personne — trouver un arbitre — 2026-10-17 ; Sophie — envoyer le planning aux coachs — 2026-10-04 (fin de la semaine du 1er octobre : le dimanche).
- En suspens : déplacement à Annecy.
- Le solde bancaire est une information, ni une décision ni une action.

---

## Réunion 2

```
Réunion du 2026-10-15
Nadia, Marc, Karine, Sophie — Julien excusé
- devis maillots reçus (Julien par mail) : 1 820 € et 2 150 €. pas de décision, on attend l'avis des coachs
- clés du gymnase : Marc s'en occupe, ou alors Sophie, à voir avec la mairie
- nouvelle coach U11 : Léa commence le 2 novembre, Karine prépare son contrat d'ici là
- buvette du tournoi : il faut 6 bénévoles, Nadia fait un appel dans le groupe des parents dans 15 jours au plus tard
- sono cassée, on en rachète une ? c'est acté, budget 300 € max
- tél de la mairie pour les clés : 04 39 98 00 42
```

**Attendu**
- Décisions : racheter une sono, 300 € au plus.
- Actions : personne (Marc ou Sophie, pas tranché) — clés du gymnase — `null` ; Karine — contrat de Léa — 2026-11-02 ; Nadia — appel aux bénévoles — 2026-10-30.
- En suspens : le choix du devis des maillots ; qui s'occupe des clés.
- Le numéro de téléphone ne doit pas apparaître dans le JSON.

---

## Réunion 3

```
Réunion du 2026-10-29
tout le bureau
- point rapide sur les résultats, les U13 sont premiers
- on a parlé de la soirée du club mais rien de décidé, on en reparle à la prochaine réunion
- Julien a eu des nouvelles de l'équipementier, rien de neuf
```

**Attendu**
- Décisions : aucune — `[]`.
- Actions : aucune — `[]`.
- En suspens : la soirée du club.
- Le piège : un modèle qui veut « bien faire » invente une action pour Julien. Il ne doit pas.
