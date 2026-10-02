"""Mesurer son application : rejouer un jeu de cas et compter.

    python evaluer.py http://localhost:8000 VOTRE_CODE
    python evaluer.py https://xxxx.trycloudflare.com VOTRE_CODE --essais 3

Chaque cas de cas.json porte un texte d'entrée et ce qu'une bonne réponse
doit contenir (« doit_contenir ») ou ne doit pas contenir (« ne_doit_pas »).
Le script affiche, cas par cas, juste ou faux, et à la fin le taux de réussite
et le temps de réponse médian. Il écrit aussi resultats-AAAAMMJJ-HHMM.csv.

Aucune dépendance : seulement la bibliothèque standard de Python.
"""
import argparse
import csv
import json
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path


def demander(base: str, code: str, texte: str) -> tuple[str, float]:
    corps = json.dumps({"code": code, "texte": texte}).encode()
    req = urllib.request.Request(f"{base.rstrip('/')}/api/demander", data=corps,
                                 headers={"Content-Type": "application/json"})
    debut = time.perf_counter()
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
    return d.get("reponse", ""), time.perf_counter() - debut


def juger(reponse: str, cas: dict) -> bool:
    bas = reponse.lower()
    ok = all(m.lower() in bas for m in cas.get("doit_contenir", []))
    return ok and not any(m.lower() in bas for m in cas.get("ne_doit_pas", []))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("base")
    p.add_argument("code")
    p.add_argument("--cas", default="cas.json")
    p.add_argument("--essais", type=int, default=1, help="rejouer chaque cas N fois")
    a = p.parse_args()

    tous = json.loads(Path(a.cas).read_text(encoding="utf-8"))
    lignes, durees, justes, total = [], [], 0, 0
    for i, cas in enumerate(tous, 1):
        for essai in range(1, a.essais + 1):
            try:
                rep, duree = demander(a.base, a.code, cas["entree"])
            except urllib.error.HTTPError as e:
                rep, duree = f"ERREUR HTTP {e.code}", 0.0
            except Exception as e:  # noqa: BLE001
                rep, duree = f"ERREUR {e}", 0.0
            bon = juger(rep, cas) if not rep.startswith("ERREUR") else False
            total += 1
            justes += bon
            if duree:
                durees.append(duree)
            lignes.append([i, essai, cas.get("nom", ""), "juste" if bon else "faux",
                           round(duree, 2), rep.replace("\n", " ")[:300]])
            print(f"{i:2}.{essai} {'✓' if bon else '✗'} {duree:5.1f} s  {cas.get('nom', '')}")

    nom = time.strftime("resultats-%Y%m%d-%H%M.csv")
    with open(nom, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["cas", "essai", "nom", "verdict", "duree_s", "reponse"])
        w.writerows(lignes)

    print()
    print(f"Réussite : {justes}/{total} = {100 * justes / total:.0f} %")
    if durees:
        print(f"Temps médian : {statistics.median(durees):.1f} s "
              f"(min {min(durees):.1f} s, max {max(durees):.1f} s)")
    print(f"Détail : {nom}")


if __name__ == "__main__":
    main()
