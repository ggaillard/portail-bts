"""Projet IA — application de départ.

Une page web, une route qui interroge un modèle de langage, et les protections
minimales d'un service exposé sur Internet : code d'accès, taille d'entrée
bornée, limite de requêtes par visiteur, route de santé, journal des temps.

Le modèle est servi par Ollama sur votre PC, ou par un fournisseur en ligne :
c'est FOURNISSEUR, dans .env, qui décide (voir fournisseurs.py). Le reste du
code ne change pas.

À adapter à VOTRE sujet : surtout prompt.txt, et la page static/index.html.
"""
import os
import secrets
import time
import logging
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import fournisseurs

# ── Réglages : tout vient de l'environnement (fichier .env), rien en dur ──────
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
    """Pour le healthcheck : l'application répond ET le fournisseur du modèle répond."""
    try:
        return await fournisseurs.sante()
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"etat": "modèle injoignable", "detail": str(exc)[:200]},
                            status_code=503)


@app.get("/a-propos")
def a_propos():
    """Transparence : l'utilisateur a le droit de savoir qu'il parle à une IA, et où partent ses données."""
    return fournisseurs.fiche()


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

    messages = [
        {"role": "system", "content": CONSIGNE},
        {"role": "user", "content": texte},
    ]
    try:
        res = await fournisseurs.demander(messages, temperature=TEMPERATURE, delai_s=DELAI_S)
    except fournisseurs.QuotaAtteint as exc:
        journal.warning("%s", exc)
        raise HTTPException(503, "Le service de modèle est saturé : réessayez dans une minute.")
    except fournisseurs.FournisseurInjoignable as exc:
        journal.error("%s", exc)
        raise HTTPException(502, "Le modèle ne répond pas. Réessayez dans un instant.")
    journal.info("réponse en %.2f s · %s · %s · %d caractères en entrée · %s",
                 res["duree_s"], res["fournisseur"], res["modele"], len(texte), qui)
    return {"reponse": res["texte"], "duree_s": res["duree_s"],
            "modele": res["modele"], "fournisseur": res["fournisseur"]}
