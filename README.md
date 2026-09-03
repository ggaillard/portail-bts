# 🛫 Portail BTS SIO — Tour de contrôle

Point d'entrée unique pour toutes les classes. L'étudiant s'identifie une fois,
puis accède aux projets associés à sa classe sans ressaisir quoi que ce soit.

**Adresse : https://ggaillard.github.io/portail-bts/**

---

## Comment ça marche

Tous les sites de cours vivent sur `ggaillard.github.io`. C'est **la même origine**
au sens du navigateur : la session ouverte sur le portail est donc reconnue
automatiquement par le site BTS1 et par le tableau de bord PlaylistApp.
L'étudiant ne saisit son numéro qu'une seule fois par poste.

```
                    ggaillard.github.io/portail-bts
                    numéro + code PIN, ou compte enseignant
                                  │
                    session Supabase partagée
                                  │
           ┌──────────────────────┴──────────────────────┐
           ▼                                             ▼
  /BTS1_S1_B1_DEV                              /playlist-csharp
  les 14 séances                               les 5 TP
```

## Deux profils

| Profil | Identification | Ce qu'il voit |
|---|---|---|
| **Étudiant** | Classe + numéro + code à 4 chiffres | Les projets de sa classe uniquement |
| **Enseignant** | Adresse électronique + mot de passe | Toutes les classes, leurs effectifs et tous les projets |

Le code PIN est exigé **seulement si l'étudiant en a un**. Tant que la colonne
`pin` est vide, l'ancien fonctionnement par simple numéro reste actif : vous
pouvez donc déployer le portail avant de distribuer les codes.

## Données personnelles

La base ne contient **ni nom, ni prénom, ni adresse électronique d'élève**.
Un étudiant est un numéro, un avatar et un code à 4 chiffres. La correspondance
entre le numéro et l'identité reste hors ligne, dans le tableau de bord enseignant.

Hébergement à Francfort, dans l'Union européenne. Suppression en fin d'année
scolaire via `select public.purger_annee('2026-2027');`.

## Mise en place

1. Exécuter les trois passes SQL de [SQL_PORTAIL.md](SQL_PORTAIL.md) dans Supabase.
2. Activer GitHub Pages : **Settings → Pages → Source : GitHub Actions**.
3. Récupérer la liste des PIN et la reporter dans le tableau de bord enseignant.
4. Distribuer à chaque étudiant **son** numéro et **son** code, jamais la liste entière.

## Ajouter un projet à une classe

```sql
insert into public.projets (classe_id, titre, description, url, icone, ordre)
select id, 'Titre du projet', 'Une phrase de description.',
       'https://ggaillard.github.io/mon-projet/', 'ABC', 3
  from public.classes where code = 'BTS1-DEV-2026';
```

Le champ `icone` est un court libellé de trois lettres environ, affiché dans
la pastille de la carte. `ordre` contrôle l'ordre d'affichage.

## Ajouter une classe

Créer la classe et ses étudiants comme d'habitude, puis lui associer ses projets.
Le portail la fera apparaître automatiquement dans la liste déroulante : aucune
modification de code n'est nécessaire.

## Dépannage

| Symptôme | Cause |
|---|---|
| « Numéro introuvable dans cette classe » | Mauvaise classe sélectionnée, ou numéro à saisir sur deux chiffres (07 et non 7) |
| « Code PIN incorrect » | Vérifier le PIN dans Supabase, ou le réinitialiser (voir SQL_PORTAIL.md) |
| « Ce compte n'est pas déclaré comme enseignant » | L'identifiant du compte manque dans la table `enseignants` |
| La liste des classes est vide | La passe 1 du SQL n'a pas été exécutée, ou aucune classe n'existe |
| L'étudiant doit se réidentifier sur chaque site | Navigation privée, ou effacement des données de site |
