"""Fournisseurs de modèles — un seul dialecte pour tous.

Ollama, OVHcloud, GitHub Models, Groq, Mistral et Google exposent tous la même
API « chat completions » (le dialecte d'OpenAI). Pour passer de l'un à l'autre,
seuls changent l'adresse, la clé et le nom du modèle : on les règle dans .env,
le code de l'application ne bouge pas.

    FOURNISSEUR=ollama      # ollama | ovh | github | groq | mistral | google
    MODELE=                 # vide = le modèle par défaut du fournisseur
    CLE_API=                # la clé du fournisseur (jamais dans le dépôt)

Pour chaque fournisseur, la table dit aussi OÙ partent les données et si
l'offre gratuite peut s'en servir pour entraîner ses modèles. Ces conditions
CHANGENT : celles-ci ont été relevées le 12/10/2026, à vérifier vous-même
(lien « conditions ») avant d'y envoyer quoi que ce soit.

Aucune dépendance de plus : httpx est déjà dans requirements.txt.
"""
from __future__ import annotations

import os
import time

import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")

FOURNISSEURS: dict[str, dict] = {
    "ollama": {
        "nom": "Ollama, sur votre PC",
        "url": f"{OLLAMA_URL}/v1",
        "sante": f"{OLLAMA_URL}/api/tags",
        "modele": "qwen2.5:3b",
        "cle": "aucune",
        "ou": "chez vous : rien ne sort de votre machine",
        "entrainement": "non",
        "conditions": "https://ollama.com",
    },
    "ovh": {
        "nom": "OVHcloud AI Endpoints",
        "url": "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
        "sante": "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models",
        "modele": "Mistral-Small-3.2-24B-Instruct-2506",
        "cle": "facultative : sans clé, 2 requêtes par minute par adresse IP et par modèle",
        "ou": "France (Gravelines), société française",
        "entrainement": "non, selon OVHcloud",
        "conditions": "https://docs.ovhcloud.com/fr/guides/public-cloud/ai-machine-learning/ai-endpoints-capabilities",
    },
    "github": {
        "nom": "GitHub Models",
        "url": "https://models.github.ai/inference",
        "sante": "https://models.github.ai/catalog/models",
        "modele": "openai/gpt-4o-mini",
        "cle": "un jeton GitHub (fine-grained) avec la permission « Models : read »",
        "ou": "États-Unis (Microsoft / GitHub)",
        "entrainement": "à vérifier dans les conditions",
        "conditions": "https://docs.github.com/fr/github-models",
    },
    "groq": {
        "nom": "Groq",
        "url": "https://api.groq.com/openai/v1",
        "sante": "https://api.groq.com/openai/v1/models",
        "modele": "openai/gpt-oss-20b",
        "cle": "une clé créée sur console.groq.com (compte gratuit, sans carte)",
        "ou": "États-Unis",
        "entrainement": "à vérifier dans les conditions",
        "conditions": "https://console.groq.com/docs/rate-limits",
    },
    "mistral": {
        "nom": "Mistral AI, offre Experiment",
        "url": "https://api.mistral.ai/v1",
        "sante": "https://api.mistral.ai/v1/models",
        "modele": "mistral-small-latest",
        "cle": "une clé de console.mistral.ai (numéro de téléphone vérifié, sans carte)",
        "ou": "France, société française",
        "entrainement": "OUI sur l'offre gratuite, selon Mistral",
        "conditions": "https://help.mistral.ai/en/articles/450104-how-can-i-try-the-api-for-free-with-the-experiment-plan",
    },
    "google": {
        "nom": "Google AI Studio (Gemini)",
        "url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "sante": "https://generativelanguage.googleapis.com/v1beta/openai/models",
        "modele": "gemini-2.5-flash",
        "cle": "une clé de aistudio.google.com (compte Google, 18 ans et plus)",
        "ou": "États-Unis",
        "entrainement": "possible sur l'offre gratuite : lire les conditions",
        "conditions": "https://ai.google.dev/gemini-api/terms",
    },
}

CHOIX = os.getenv("FOURNISSEUR", "ollama").strip().lower()
if CHOIX not in FOURNISSEURS:
    raise SystemExit(f"FOURNISSEUR={CHOIX!r} inconnu. Choix possibles : {', '.join(FOURNISSEURS)}")

F = FOURNISSEURS[CHOIX]
MODELE = os.getenv("MODELE", "").strip() or F["modele"]
CLE_API = os.getenv("CLE_API", "").strip()

if CHOIX != "ollama" and ":" in MODELE:
    raise SystemExit(f"MODELE={MODELE!r} est un nom de modèle Ollama, inconnu de {F['nom']}. "
                     f"Videz MODELE dans .env (le défaut est {F['modele']}) ou donnez un modèle du fournisseur.")

if CHOIX not in ("ollama", "ovh") and not CLE_API:
    raise SystemExit(f"FOURNISSEUR={CHOIX} demande une clé : mettez-la dans .env, ligne CLE_API=… "
                     f"({F['cle']}).")


class QuotaAtteint(Exception):
    """Le fournisseur refuse pour l'instant (HTTP 429) : attendre ou en changer."""


class FournisseurInjoignable(Exception):
    """Réseau, clé refusée, modèle inconnu : le détail est dans le message."""


def _entetes() -> dict:
    h = {"Content-Type": "application/json"}
    if CLE_API:
        h["Authorization"] = f"Bearer {CLE_API}"
    return h


async def demander(messages: list[dict], temperature: float = 0.2,
                   delai_s: float = 120, **options) -> dict:
    """Envoie la conversation au fournisseur choisi et rend
    {"texte", "duree_s", "modele", "fournisseur", "jetons"}.

    `options` passe tel quel dans la requête : response_format, tools, max_tokens…
    """
    corps = {"model": MODELE, "messages": messages, "temperature": temperature, **options}
    debut = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=delai_s) as client:
            r = await client.post(f"{F['url']}/chat/completions", json=corps, headers=_entetes())
    except httpx.HTTPError as exc:
        raise FournisseurInjoignable(f"{F['nom']} injoignable : {exc}") from exc
    duree = time.perf_counter() - debut
    if r.status_code == 429:
        raise QuotaAtteint(f"{F['nom']} : quota atteint (429). Attendez, espacez les essais, "
                           "ou changez de fournisseur.")
    if r.status_code >= 400:
        raise FournisseurInjoignable(f"{F['nom']} : HTTP {r.status_code} — {r.text[:300]}")
    d = r.json()
    message = (d.get("choices") or [{}])[0].get("message", {})
    return {
        "texte": message.get("content") or "",
        "message": message,
        "duree_s": round(duree, 2),
        "modele": d.get("model", MODELE),
        "fournisseur": CHOIX,
        "jetons": d.get("usage", {}),
    }


async def sante() -> dict:
    """Le fournisseur répond-il ? Une lecture légère, qui ne consomme pas de quota de génération."""
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(F["sante"], headers=_entetes())
        r.raise_for_status()
    return {"etat": "ok", "fournisseur": CHOIX, "modele": MODELE}


def fiche() -> dict:
    """Ce que l'application dit d'elle-même : où partent les données."""
    return {"fournisseur": F["nom"], "modele": MODELE, "ou": F["ou"],
            "entrainement": F["entrainement"], "conditions": F["conditions"]}
