"""Projet IA — application de départ.

Une page web, une route qui interroge un modèle de langage servi par Ollama,
et les protections minimales d'un service exposé sur Internet :
code d'accès, taille d'entrée bornée, limite de requêtes par visiteur,
route de santé, journal des temps de réponse.

À adapter à VOTRE sujet : surtout prompt.txt, et la page static/index.html.
"""
import os
import secrets
import time
import logging
from collections import defaultdict, deque
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# ── Réglages : tout vient de l'environnement (fichier .env), rien en dur ──────
OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODELE       = os.getenv("MODELE", "qwen2.5:3b")
CODE_ACCES   = os.getenv("CODE_ACCES", "")          # vide = refus de démarrer
MAX_CARAC    = int(os.getenv("MAX_CARACTERES", "2000"))
PAR_MINUTE   = int(os.getenv("REQUETES_PAR_MINUTE", "10"))
TEMPERATURE  = float(os.getenv("TEMPERATURE", "0.2"))
DELAI_S      = float(os.getenv("DELAI_SECONDES", "120"))

if len(CODE_ACCES) < 8:
    raise SystemExit("CODE_ACCES absent ou trop court (8 caractères minimum) : "
                     "un service public sans code d'accès est ouvert à tous.")

ICI = Path(__file__).parent
CONSIGNE = (ICI / "prompt.txt").read_text(encoding="utf-8")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
journal = logging.getLogger("projet-ia")

app = FastAPI(title="Projet IA", docs_url=None, redoc_url=None)


# ── Limite de requêtes, par visiteur ──────────────────────────────────────────
_vus: dict[str, deque] = defaultdict(deque)

def visiteur(req: Request) -> str:
    # Derrière le tunnel Cloudflare, l'adresse réelle est dans cet en-tête.
    return req.headers.get("cf-connecting-ip") or (req.client.host if req.client else "?")

def limiter(qui: str) -> None:
    maintenant = time.monotonic()
    file = _vus[qui]
    while file and maintenant - file[0] > 60:
        file.popleft()
    if len(file) >= PAR_MINUTE:
        raise HTTPException(429, "Trop de requêtes : attendez une minute.")
    file.append(maintenant)


# ── Les routes ────────────────────────────────────────────────────────────────
class Demande(BaseModel):
    code: str
    texte: str


@app.get("/")
def accueil():
    return FileResponse(ICI / "static" / "index.html")


@app.get("/sante")
async def sante():
    """Pour le healthcheck : l'application répond ET Ollama répond."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
        return {"etat": "ok", "modele": MODELE}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"etat": "ollama injoignable", "detail": str(exc)[:200]},
                            status_code=503)


@app.post("/api/demander")
async def demander(d: Demande, req: Request):
    qui = visiteur(req)
    limiter(qui)            # avant le code : on ne laisse pas essayer des codes à l'infini
    if not secrets.compare_digest(d.code.encode(), CODE_ACCES.encode()):
        journal.warning("code refusé pour %s", qui)
        raise HTTPException(401, "Code d'accès incorrect.")
    texte = d.texte.strip()
    if not texte:
        raise HTTPException(400, "Texte vide.")
    if len(texte) > MAX_CARAC:
        raise HTTPException(413, f"Texte trop long ({len(texte)} caractères, {MAX_CARAC} au plus).")

    corps = {
        "model": MODELE,
        "stream": False,
        "options": {"temperature": TEMPERATURE},
        "messages": [
            {"role": "system", "content": CONSIGNE},
            {"role": "user", "content": texte},
        ],
    }
    debut = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=DELAI_S) as client:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json=corps)
            r.raise_for_status()
    except httpx.HTTPError as exc:
        journal.error("Ollama : %s", exc)
        raise HTTPException(502, "Le modèle ne répond pas. Réessayez dans un instant.")
    duree = time.perf_counter() - debut
    reponse = r.json().get("message", {}).get("content", "")
    journal.info("réponse en %.2f s · %d caractères en entrée · %s", duree, len(texte), qui)
    return {"reponse": reponse, "duree_s": round(duree, 2), "modele": MODELE}
