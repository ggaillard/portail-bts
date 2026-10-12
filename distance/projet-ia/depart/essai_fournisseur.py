"""Essayer un fournisseur de modèle SANS lancer l'application.

    python essai_fournisseur.py                      le fournisseur de .env
    python essai_fournisseur.py ovh                  OVHcloud, sans clé ni compte
    python essai_fournisseur.py groq "Bonjour !"     une autre question

Affiche la réponse, le temps, les jetons consommés, et surtout OÙ sont
parties les données. Lit .env s'il existe (CLE_API, MODELE…), sans l'afficher.
"""
import asyncio
import os
import sys
from pathlib import Path

# .env lu à la main : pas de dépendance de plus
env = Path(__file__).with_name(".env")
if env.exists():
    for ligne in env.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if ligne and not ligne.startswith("#") and "=" in ligne:
            k, v = ligne.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

if len(sys.argv) > 1 and sys.argv[1] != os.environ.get("FOURNISSEUR", "ollama"):
    # Un autre fournisseur que celui de .env : son modèle par défaut, pas celui de .env
    os.environ["FOURNISSEUR"] = sys.argv[1]
    os.environ["MODELE"] = ""
question = sys.argv[2] if len(sys.argv) > 2 else "En une phrase : à quoi sert un code d'accès sur une application publique ?"

import fournisseurs  # noqa: E402  (après le réglage de l'environnement)


async def main() -> None:
    print(f"Fournisseur : {fournisseurs.F['nom']} · modèle {fournisseurs.MODELE}")
    try:
        res = await fournisseurs.demander([{"role": "user", "content": question}], temperature=0.2)
    except fournisseurs.QuotaAtteint as exc:
        sys.exit(f"Quota : {exc}")
    except fournisseurs.FournisseurInjoignable as exc:
        sys.exit(f"Échec : {exc}")
    print(f"\n{res['texte'].strip()}\n")
    print(f"Temps : {res['duree_s']} s · jetons : {res['jetons'] or 'non indiqués'}")
    f = fournisseurs.fiche()
    print(f"Données parties vers : {f['ou']}")
    print(f"Utilisées pour entraîner ? {f['entrainement']} — conditions : {f['conditions']}")


asyncio.run(main())
