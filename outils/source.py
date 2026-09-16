"""Où vit le code du portail, pour les contrôles qui le lisent.

Jusqu'au 16/09/2026, la réponse était simple et écrite en dur dans trois
étapes du workflow : « le plus gros bloc <script> de index.html ». L'étape A3
de REFONTE.md a sorti ce bloc dans js/app.js, et les trois étapes seraient
devenues muettes — `max(..., key=len)` sur une liste vide lève une erreur, ce
qui aurait au moins fait du bruit, mais la suite du chantier va multiplier les
modules et l'erreur serait alors remplacée par un contrôle qui ne regarde
qu'un fichier sur douze.

Une seule fonction sait donc où est le code, et tout le monde l'appelle.

    from source import script, balisage
    js   = script()     # tout le JavaScript du portail, concaténé
    html = balisage()   # index.html sans son script, pour les identifiants

Concaténer les modules est volontaire : les contrôles existants cherchent des
fonctions disparues et des identifiants inexistants, deux questions qui se
posent sur l'ensemble, pas fichier par fichier. Le jour où un contrôle aura
besoin du découpage, `modules()` le rend.
"""

import io
import os
import re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _lire(rel):
    return io.open(os.path.join(RACINE, rel), encoding='utf-8').read()


def modules():
    """[(nom, texte)] — les modules de js/, ou le script en ligne à défaut."""
    dossier = os.path.join(RACINE, 'js')
    if os.path.isdir(dossier):
        noms = sorted(f for f in os.listdir(dossier) if f.endswith('.js'))
        if noms:
            return [('js/' + n, _lire('js/' + n)) for n in noms]

    s = _lire('index.html')
    blocs = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', s, re.S)
    if not blocs:
        raise SystemExit(
            "Aucun code trouvé : ni js/*.js, ni bloc <script> dans index.html.\n"
            "Si le découpage a déplacé le code ailleurs, c'est outils/source.py "
            "qu'il faut corriger — sinon les contrôles passeront au vert en ne "
            "lisant rien.")
    return [('index.html', max(blocs, key=len))]


def script():
    """Tout le JavaScript du portail, d'un seul tenant."""
    return '\n'.join(t for _, t in modules())


def balisage():
    """index.html sans son script : ce qui déclare les identifiants."""
    s = _lire('index.html')
    for bloc in re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', s, re.S):
        s = s.replace(bloc, '')
    return s


if __name__ == '__main__':
    ms = modules()
    for nom, t in ms:
        print('  %-24s %6d octets · %5d lignes' % (nom, len(t), t.count('\n') + 1))
    print('  %-24s %6d octets' % ('total', sum(len(t) for _, t in ms)))
