#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Essai des contrôles : on casse ce qu'ils prétendent voir.

    python3 outils/essai.py --supports /chemin/vers/BTS1_S1_B1_DEV

Un contrôle qui n'a jamais échoué n'a jamais rien vérifié. Le cas réel : un
contrôle de boucle narrative cherchait des jetons d'au moins trois lettres ; sur
« 03 h 47 » et « 60, 47, 72 » il n'en trouvait aucun et passait au vert sans
rien regarder. Il a été vert sur deux séances sur trois pendant une semaine.

Chaque essai copie les deux dépôts dans un bac à sable, y injecte **un** défaut,
et vérifie que le contrôle visé le nomme — le nomme, pas seulement qu'il
échoue : un contrôle qui échoue pour une autre raison ne prouve rien.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)


# ─── les défauts à injecter ────────────────────────────────────────────────
#  (nom, contrôle visé, fichier à toucher, remplacement, mot attendu au rapport)

def _trace(bac, n):
    return os.path.join(bac, 'support', 'docs', 'seances', 'seance-%02d.md' % n)


def _migration(bac, motif):
    import glob
    return glob.glob(os.path.join(bac, 'portail', 'supabase',
                                  'migrations', motif))[0]


ESSAIS = [
    # ── cohérence ──────────────────────────────────────────────────────────
    ("une bonne réponse permutée dans la page", 'coherence',
     lambda b: (_trace(b, 3), r'\| \*\*Rép\.\*\* \| C \|', '| **Rép.** | A |'),
     'la page dit A, la base dit C'),

    ("une option reformulée dans la page", 'coherence',
     lambda b: (_trace(b, 3), r'`B` la jointure', '`B` la liaison'),
     'dans la page'),

    ("le bloc de rattrapage qui diverge de l'insert", 'coherence',
     lambda b: (_migration(b, '*_bts1_seance3.sql'),
                r"\('q5', 'C', 'Quelle famille NoSQL",
                "('q5', 'D', 'Quelle famille NoSQL"),
     "le rattrapage dit D"),

    # ── fiche ──────────────────────────────────────────────────────────────
    ("un concept absent de la trace", 'fiche',
     lambda b: (_trace(b, 3), r'\n4\. \*\*Lac et entrepôt\*\*.*?\n5\.', '\n5.'),
     'concepts dans la trace'),

    ("un intitulé de concept divergent", 'fiche',
     lambda b: (_trace(b, 2), r'\*\*Une API REST\*\*', '**Le style REST**'),
     'dans la trace'),

    ("un numéro de question inexistant", 'fiche',
     lambda b: (_migration(b, '*_debriefing.sql'), r"\[7 8 9\]", '[7 8 14]'),
     'question 14'),

    ("une séance absente du sommaire", 'fiche',
     lambda b: (os.path.join(b, 'support', 'mkdocs.yml'),
                r'seances/seance-03\.md', 'seances/seance-3.md'),
     'sommaire de mkdocs.yml'),

    ("une adresse décommissionnée revenue dans une trace", 'fiche',
     lambda b: (_trace(b, 2), r'ggaillard\.github\.io/portail-bts\]',
                'suivi.gaillard42.workers.dev]'),
     'décommissionnée'),

    ("du code entre accents graves dans un énoncé", 'fiche',
     lambda b: (_trace(b, 3), r'\*\*2\.\*\* L\'opération',
                "**2.** L'opération `JOIN`"),
     "code entre accents graves"),

    # ── pédagogie ──────────────────────────────────────────────────────────
    ("des actes qui débordent de l'heure", 'pedagogie',
     lambda b: (_trace(b, 3), r'\(≈ 17 min\)', '(≈ 40 min)'),
     "min d'actes annoncées"),

    ("un prérequis qui ne nomme pas la séance d'avant", 'pedagogie',
     lambda b: (_trace(b, 3), r'Prérequis : la séance 2\.',
                'Prérequis : quelques notions.'),
     'ne nomme pas la séance 2'),

    ("le titre de récit qui ne revient jamais", 'pedagogie',
     lambda b: (_trace(b, 1), r'\*\*03 h 47\*\* n\'était pas l\'heure',
                "**la panne** n'était pas l'heure"),
     'boucle du cold open'),

    ("une notion testée mais jamais dite", 'pedagogie',
     lambda b: (_trace(b, 3), r'La dénormalisation consiste à',
                'La sérialisation columnaire consiste à'),
     "n'a été dit pendant l'heure"),

    ("une question qui ne sert aucun concept", 'pedagogie',
     lambda b: (_trace(b, 2), r'\[3 4 5\]', '[3 4]'),
     'ne servant aucun concept'),
]


def preparer(supports):
    bac = tempfile.mkdtemp(prefix='essai-controles-')
    shutil.copytree(RACINE, os.path.join(bac, 'portail'),
                    ignore=shutil.ignore_patterns('.git', 'site', '__pycache__'))
    shutil.copytree(supports, os.path.join(bac, 'support'),
                    ignore=shutil.ignore_patterns('.git', 'site', '__pycache__'))
    return bac


def lancer(bac, controle):
    r = subprocess.run(
        [sys.executable, os.path.join(bac, 'portail', 'outils', 'controler.py'),
         controle, '--racine', os.path.join(bac, 'portail'),
         '--supports', os.path.join(bac, 'support')],
        capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--supports', default='/tmp/support')
    a = ap.parse_args()

    # 1. Sur les fichiers tels qu'ils sont, tout doit être vert.
    bac = preparer(a.supports)
    depart = []
    for c in ('coherence', 'fiche', 'pedagogie'):
        code, sortie = lancer(bac, c)
        if code != 0:
            depart.append((c, sortie))
    shutil.rmtree(bac)
    if depart:
        print("Les contrôles ne sont pas au vert avant injection :\n")
        for c, s in depart:
            print("── %s ──\n%s" % (c, s))
        sys.exit("Impossible d'essayer les contrôles sur une base déjà rouge.")
    print("Départ : les trois contrôles sont au vert.\n")

    # 2. Un défaut à la fois.
    rates = []
    for nom, controle, fabrique, attendu in ESSAIS:
        bac = preparer(a.supports)
        chemin, motif, remplacement = fabrique(bac)
        with open(chemin, encoding='utf-8') as f:
            avant = f.read()
        apres, n = re.subn(motif, remplacement, avant, count=1, flags=re.S)
        if n == 0:
            rates.append((nom, "le motif d'injection ne s'applique plus : %s"
                          % motif))
            shutil.rmtree(bac)
            continue
        with open(chemin, 'w', encoding='utf-8') as f:
            f.write(apres)

        code, sortie = lancer(bac, controle)
        shutil.rmtree(bac)

        if code == 0:
            rates.append((nom, "le contrôle « %s » est resté vert" % controle))
        elif attendu not in sortie:
            rates.append((nom, "échec, mais sans nommer le défaut — attendu "
                               "« %s », obtenu :\n%s" % (attendu, sortie)))
        else:
            print("  ✓ %-52s → %s le nomme" % (nom, controle))

    print()
    if rates:
        for nom, pourquoi in rates:
            print("  ✗ %s\n      %s" % (nom, pourquoi))
        sys.exit("%d essai(s) sur %d en échec." % (len(rates), len(ESSAIS)))
    print("Les %d défauts injectés sont tous nommés." % len(ESSAIS))


if __name__ == '__main__':
    main()
