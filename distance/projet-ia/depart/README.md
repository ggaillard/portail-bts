# [Nom de l'application]

> Projet IA — BTS SIO 2 SLAM — [Prénom NOM] — octobre 2026
> **URL publique** : https://[…].trycloudflare.com — code d'accès envoyé à l'enseignant par e-mail

## 1. Concevoir

**Sujet choisi** : [n° et intitulé de la liste]

**L'organisation (fictive) et son besoin**, en trois phrases : qui, quel problème aujourd'hui, ce que l'application change.

**Trois cas d'usage**, sous la forme « En tant que …, je veux …, afin de … » :

1. …
2. …
3. …

**Ce que l'application ne fait pas** (au moins deux limites assumées) : …

## 2. Le modèle et la machine

| | |
|---|---|
| Carte graphique et mémoire vidéo (VRAM) | ex. NVIDIA RTX 3060, 12 Go — ou « aucune, processeur seul » |
| Mémoire vive | … Go |
| Modèle retenu | ex. `qwen2.5:7b` |
| Pourquoi celui-là | ce que la VRAM permettait, ce que vous avez essayé avant |
| Modèle comparé | ex. `qwen2.5:3b` |

## 3. Piloter — le journal

| Séance | Ce qui est fait | Ce qui a bloqué, et comment c'est réglé |
|---|---|---|
| Lundi 05/10 | … | … |
| Mardi 06/10 | … | … |

## 4. Mesurer

Jeu de **10 cas au moins** dans `cas.json`, dont au moins deux hors sujet et un qui tente de détourner les consignes.

| | Modèle retenu | Modèle comparé |
|---|---|---|
| Réussite (sur N cas × 3 essais) | … % | … % |
| Temps de réponse médian | … s | … s |

**Ce que les échecs montrent** (deux exemples commentés, et ce que vous avez changé) : …

## 5. Sécuriser

| Risque | Ce qui pourrait arriver | Mesure prise dans le projet |
|---|---|---|
| L'URL est publique | n'importe qui utilise votre PC et votre électricité | code d'accès, limite de requêtes |
| Ollama exposé | … | … |
| Détournement des consignes | … | … |
| Données personnelles | … | … |
| Secrets dans le dépôt | … | … |

## 6. Mettre en production — comment refaire

```bash
cp .env.example .env      # puis remplir
docker compose up -d --build
docker compose ps
docker compose logs tunnel
```

## 7. Usage de l'IA pendant le projet

Ce que vous avez demandé à un assistant, et ce que vous avez gardé, modifié ou refusé.
