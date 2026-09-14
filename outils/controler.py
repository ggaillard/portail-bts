#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les contrôles d'une séance. Trois familles, une seule commande.

    python3 outils/controler.py fiche      [--supports DOSSIER]
    python3 outils/controler.py pedagogie  [--supports DOSSIER]
    python3 outils/controler.py coherence  [--supports DOSSIER]

`--supports` désigne la copie du dépôt étudiant (défaut : /tmp/support).

Aucun contrôle ne connaît de numéro de séance : ils relisent ce que `glob`
leur donne. Ajouter la séance 4 ne demande rien — elle est contrôlée dès
qu'elle existe. Une checklist qu'on doit penser à étendre finit toujours par
oublier la séance du jour.

Deux niveaux de retour :
  · ✗ bloque — la séance ne peut pas tourner en l'état ;
  · ~ remarque — à regarder, sans faire échouer. Un contrôle qui crie pour des
    broutilles finit par n'être plus lu.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lire  # noqa: E402


PORTAIL = 'ggaillard.github.io/portail-bts'
DECOMMISSIONNEES = ['suivi.gaillard42.workers.dev']


# ═══════════════════════════════════════════════════════════════════════════
#  1. La fiche — ce qu'une trace doit porter pour exister
# ═══════════════════════════════════════════════════════════════════════════

def fiche(racine, supports):
    """Douze points, passés à chaque trace découverte."""
    dur, doux = [], []
    ts = lire.traces(supports)
    if not ts:
        return ['aucune trace trouvée sous %s/docs/seances/' % supports], []

    base, _ = lire.corriges(racine)
    concepts_sql = lire.concepts_base(racine)
    nav = ''
    if os.path.exists(os.path.join(supports, 'mkdocs.yml')):
        with open(os.path.join(supports, 'mkdocs.yml'), encoding='utf-8') as f:
            nav = f.read()

    for t in ts:
        p = 'séance %s' % t.numero

        # 1 — front-matter concordant
        if str(t.front.get('seance')) != str(t.numero):
            dur.append("%s : front-matter seance=%s pour le fichier %s"
                       % (p, t.front.get('seance'), t.nom))
        if t.titre_recit and t.front.get('title', '').find(t.titre_recit) < 0:
            dur.append("%s : le title du front-matter ne porte pas le titre de "
                       "récit « %s »" % (p, t.titre_recit))

        # 2 — titre de récit entre guillemets
        if not t.titre_recit:
            dur.append("%s : pas de titre de récit entre « » dans le H1" % p)

        # 3 — cold open
        if not t.cold_open:
            dur.append("%s : pas de section COLD OPEN" % p)

        # 4 — au moins trois actes
        if len(t.actes) < 3:
            dur.append("%s : %d acte(s) daté(s), il en faut au moins 3"
                       % (p, len(t.actes)))

        # 5 — au moins deux indices repliés
        if len(t.indices_replies) < 2:
            dur.append("%s : %d bloc(s) « ??? question », il en faut au moins 2"
                       % (p, len(t.indices_replies)))

        # 6 — l'adresse du portail, et aucune adresse décommissionnée
        if PORTAIL not in t.texte:
            dur.append("%s : l'adresse du portail n'apparaît pas" % p)
        for a in DECOMMISSIONNEES:
            if a in t.texte:
                dur.append("%s : adresse décommissionnée « %s » — les étudiants "
                           "n'entrent que par le portail" % (p, a))

        # 7 — dix questions, quatre options non vides, pas de code dans l'énoncé
        qs = t.questions
        if len(qs) != 10:
            dur.append("%s : %d question(s) dans la page, attendu 10" % (p, len(qs)))
        for num, enonce, opts in qs:
            if len(opts) != 4:
                dur.append("%s q%d : %d option(s), attendu 4" % (p, num, len(opts)))
            if any(not o.strip() for o in opts):
                dur.append("%s q%d : une option vide" % (p, num))
            if '`' in enonce:
                dur.append("%s q%d : du code entre accents graves dans l'énoncé — "
                           "le parseur prendrait le premier <code> pour le début "
                           "des options" % (p, num))

        # 8 — la grille Rép. complète, sans lettre bonne plus de 4 fois
        g = t.grille
        if len(g) != len(qs):
            dur.append("%s : %d question(s) pour %d réponse(s) dans la grille"
                       % (p, len(qs), len(g)))
        if any(x not in 'ABCD' for x in g):
            dur.append("%s : la grille Rép. porte autre chose que A–D : %s"
                       % (p, ' '.join(g)))
        for lettre in 'ABCD':
            if g.count(lettre) > 4:
                dur.append("%s : la lettre %s est bonne %d fois sur %d — une "
                           "classe repère le motif" % (p, lettre, g.count(lettre), len(g)))

        # 9 — présente au sommaire de mkdocs.yml
        if nav and ('seances/%s' % t.nom) not in nav:
            dur.append("%s : absente du sommaire de mkdocs.yml — la page existe "
                       "mais personne ne peut y arriver" % p)

        # 10 — un corrigé en base par question
        for num, _, _ in qs:
            if (t.numero, 'q%d' % num) not in base:
                dur.append("%s q%d : aucun corrigé dans les migrations — la "
                           "réponse serait enregistrée sans jamais être évaluée"
                           % (p, num))

        # 11 — teaser et bloc « À retenir »
        if not t.teaser:
            dur.append("%s : pas de TEASER vers la séance suivante" % p)
        if not t.a_retenir:
            dur.append("%s : pas de bloc « À retenir »" % p)

        # 12 — les concepts de la trace et ceux de la base disent la même chose
        dur += _concepts(p, t, concepts_sql.get(t.numero), qs)

    return dur, doux


def _concepts(p, t, en_base, qs):
    """Point 12 : la trace est la source, la base en est la copie."""
    ecarts = []
    de_la_trace = t.concepts
    if not de_la_trace:
        return ["%s : pas de section « Concepts à connaître » — c'est elle qui "
                "alimente le débriefing de fin d'heure et le contrôle d'entrée "
                "de la séance suivante" % p]
    if en_base is None:
        return ["%s : %d concepts dans la trace, aucun en base — le portail "
                "projette la base, pas le markdown" % (p, len(de_la_trace))]
    if len(de_la_trace) != len(en_base):
        ecarts.append("%s : %d concepts dans la trace, %d en base"
                      % (p, len(de_la_trace), len(en_base)))
    numeros = {n for n, _, _ in qs}
    for i, ((it, _, nt), (ib, nb)) in enumerate(zip(de_la_trace, en_base), 1):
        if lire.plat(it) != lire.plat(ib):
            ecarts.append("%s concept %d : « %s » dans la trace, « %s » en base"
                          % (p, i, it, ib))
        if nt and sorted(nt) != sorted(nb):
            ecarts.append("%s concept %d : mesuré sur %s dans la trace, sur %s "
                          "en base" % (p, i, nt, nb))
        for n in nb:
            if n not in numeros:
                ecarts.append("%s concept %d : renvoie à la question %d, qui "
                              "n'existe pas — le concept afficherait 0 %% sans "
                              "que personne ne comprenne pourquoi" % (p, i, n))
    if all(not nt for _, _, nt in de_la_trace):
        ecarts.append("%s : aucun concept de la trace ne porte ses numéros de "
                      "question entre crochets — la trace ne dit plus sur quoi "
                      "chaque concept se mesure" % p)
    return ecarts


# ═══════════════════════════════════════════════════════════════════════════
#  2. La pédagogie — les conditions matérielles de la compréhension
# ═══════════════════════════════════════════════════════════════════════════

MOTS_PAR_MINUTE = 200
LECTURE_MAX = 14          # minutes
ACTES_MIN, ACTES_MAX = 35, 52


def pedagogie(racine, supports):
    """Ce job ne juge pas le fond — aucune machine ne le fait."""
    dur, doux = [], []
    ts = lire.traces(supports)
    if not ts:
        return ['aucune trace trouvée sous %s/docs/seances/' % supports], []

    for t in ts:
        p = 'séance %s' % t.numero

        # 1 — la trace se lit dans l'heure
        n = len(t.corps_seance.replace('|', ' ').split())
        minutes = n / float(MOTS_PAR_MINUTE)
        if minutes > LECTURE_MAX:
            dur.append("%s : corps de %d mots, soit ≈ %.0f min de lecture — "
                       "au-delà de %d min, la trace ne peut pas cohabiter avec "
                       "les actes et le quiz" % (p, n, minutes, LECTURE_MAX))

        # 2 — les actes tiennent dans l'heure
        total = sum(m for _, m in t.actes)
        if t.actes and not (ACTES_MIN <= total <= ACTES_MAX):
            dur.append("%s : %d min d'actes annoncées — hors de [%d, %d], il ne "
                       "reste pas la place du cold open et du quiz"
                       % (p, total, ACTES_MIN, ACTES_MAX))

        # 3 — le prérequis nomme la séance d'avant
        if t.numero and t.numero > 1:
            pre = t.prerequis or ''
            if ('séance %d' % (t.numero - 1)) not in pre and 'aucun' not in pre.lower():
                dur.append("%s : le prérequis ne nomme pas la séance %d — un "
                           "absent ne sait pas quoi rattraper"
                           % (p, t.numero - 1))

        # 4 — le quiz ne demande que ce que la séance dit
        d, r = _vocabulaire(p, t)
        dur += d
        doux += r

        # 5 — la bonne réponse ne se devine pas à sa longueur
        d, r = _longueurs(p, t)
        dur += d
        doux += r

        # 6 — chaque question sert un concept
        mesurees = set()
        for _, _, nums in t.concepts:
            mesurees |= set(nums)
        if mesurees:
            orphelines = sorted({n for n, _, _ in t.questions} - mesurees)
            if orphelines:
                dur.append("%s : question(s) %s ne servant aucun concept — le "
                           "débriefing n'en dira rien"
                           % (p, ', '.join('q%d' % n for n in orphelines)))
            sans_question = [i for i, (_, _, nums) in enumerate(t.concepts, 1)
                             if not nums]
            if sans_question:
                doux.append("%s : concept(s) %s sans question — projeté(s) sans "
                            "mesure" % (p, ', '.join(map(str, sans_question))))

        # 7 — la boucle du cold open se referme
        if t.titre_recit:
            jt = lire.jetons_titre(t.titre_recit)
            if not jt:
                doux.append("%s : titre de récit sans jeton exploitable, boucle "
                            "non vérifiée" % p)
            else:
                zone = lire.jetons_titre(_apres_les_actes(t))
                if not any(j in zone for j in jt):
                    dur.append("%s : le titre de récit « %s » ne revient nulle "
                               "part après les actes — la boucle du cold open "
                               "reste ouverte" % (p, t.titre_recit))

        # remarques de lisibilité
        for phrase in t.phrases:
            if len(phrase.split()) > 45:
                doux.append("%s : phrase de %d mots — « %s… »"
                            % (p, len(phrase.split()),
                               ' '.join(phrase.split()[:9])))

    return dur, doux


def _apres_les_actes(t):
    """La prose qui suit le dernier acte, quiz de révision exclu.

    Sans cette exclusion, le contrôle de boucle passe au vert dès qu'une
    question du quiz reprend le titre — ce qu'elle fait presque toujours,
    puisque la dernière question porte justement sur le retournement. Il ne
    vérifiait alors plus rien.
    """
    import re as _re
    debut = 0
    for m in _re.finditer(r'^##\s.*ACTE\s', t.texte, _re.M):
        debut = m.start()
    zone = t.texte[debut:]
    zone = _re.sub(r'^\*\*\d+\.\*\* .*\n`.*$', '', zone, flags=_re.M)   # les questions
    zone = _re.sub(r'^\|.*\|\s*$', '', zone, flags=_re.M)               # la grille
    return zone


def _vocabulaire(p, t):
    """Le quiz ne doit demander que ce que l'heure a dit.

    Deux niveaux, et la frontière a été calibrée sur les trois séances écrites :

    · **bloque** quand un énoncé — ou la bonne réponse — compte au moins deux
      mots pleins et qu'*aucun* n'a été prononcé pendant l'heure. C'est une
      notion qui sort de nulle part, et aucune des trois séances réelles n'en
      contient.
    · **remarque** pour les mots isolés. Une langue n'est pas un lexique clos :
      « distingue », « souvent », « entièrement » ne sont pas des notions, et
      bloquer dessus rendrait le contrôle illisible en une semaine. Vingt et
      une lignes rouges sur trois séances justes, c'est un contrôle qu'on
      désactive.

    Exception : les questions négatives (« lequel n'en fait PAS partie »)
    attendent un intrus ; leur bonne réponse est justement ce que la séance ne
    dit pas — on ne regarde alors que l'énoncé.

    `corps_seance` et non `corps` : le corps entier contient le quiz de
    révision, donc chaque terme d'une question s'y trouvait par construction et
    le contrôle ne vérifiait rien du tout.
    """
    dur, doux, isoles = [], [], []
    corps = set(lire.mots(t.corps_seance))
    grille = t.grille
    for i, (num, enonce, opts) in enumerate(t.questions):
        negative = any(x in enonce.lower() for x in
                       (' pas ', "n'est pas", 'sauf', 'jamais'))
        cibles = [('énoncé', enonce)]
        if not negative and i < len(grille) and grille[i] in 'ABCD':
            k = 'ABCD'.index(grille[i])
            if k < len(opts):
                cibles.append(('bonne réponse', opts[k]))
        for quoi, texte in cibles:
            pleins = [m for m in lire.mots(texte) if len(m) > 5]
            inconnus = [m for m in pleins if m not in corps]
            if len(pleins) >= 2 and len(inconnus) == len(pleins):
                dur.append("%s q%d : %s — aucun de ses mots (%s) n'a été dit "
                           "pendant l'heure" % (p, num, quoi,
                                                ', '.join(pleins)))
            elif inconnus:
                isoles += ['q%d %s' % (num, m) for m in inconnus]
    if isoles:
        doux.append("%s : mots du quiz absents de l'heure — %s%s"
                    % (p, ', '.join(isoles[:6]),
                       '…' if len(isoles) > 6 else ''))
    return dur, doux


def _longueurs(p, t):
    """La bonne réponse ne doit pas être repérable à sa longueur."""
    dur, doux = [], []
    grille = t.grille
    plus_longue, plus_longue_total = 0, 0
    for i, (num, _, opts) in enumerate(t.questions):
        if i >= len(grille) or grille[i] not in 'ABCD':
            continue
        k = 'ABCD'.index(grille[i])
        if k >= len(opts):
            continue
        bonne = len(opts[k])
        autres = [len(o) for j, o in enumerate(opts) if j != k]
        if not autres:
            continue
        plus_longue_total += 1
        if bonne == max(bonne, *autres):
            plus_longue += 1
        if bonne >= 2 * (sum(autres) / float(len(autres))):
            doux.append("%s q%d : bonne réponse %d signes contre %.0f en moyenne "
                        "— rallonger les distracteurs, jamais raccourcir la bonne"
                        % (p, num, bonne, sum(autres) / float(len(autres))))
    if plus_longue_total and plus_longue > 6:
        dur.append("%s : la bonne réponse est la plus longue %d fois sur %d — un "
                   "élève qui n'a rien suivi coche la plus longue"
                   % (p, plus_longue, plus_longue_total))
    return dur, doux


# ═══════════════════════════════════════════════════════════════════════════
#  3. La cohérence — la page et la base disent-elles la même chose ?
# ═══════════════════════════════════════════════════════════════════════════

def coherence(racine, supports):
    """La page fait foi pour l'ordre et le libellé ; la base pour la bonne
    réponse. L'un ne se déduit pas de l'autre."""
    dur, doux = [], []
    base, fichiers = lire.corriges(racine)
    if not base:
        return ['aucun corrigé trouvé dans supabase/migrations/*_bts1_seance*.sql'], []

    for t in lire.traces(supports):
        p = 'séance %s' % t.numero
        grille = t.grille
        qs = t.questions
        if len(qs) != len(grille):
            dur.append("%s : %d questions pour %d réponses dans la grille"
                       % (p, len(qs), len(grille)))
            continue
        for i, (num, _, opts_page) in enumerate(qs):
            cle = (t.numero, 'q%d' % num)
            if cle not in base:
                dur.append("%s q%d : absente des migrations" % (p, num))
                continue
            bonne, opts_sql = base[cle]
            if bonne != grille[i]:
                dur.append("%s q%d : la page dit %s, la base dit %s"
                           % (p, num, grille[i], bonne))
            if len(opts_page) != len(opts_sql):
                dur.append("%s q%d : %d options dans la page, %d en base"
                           % (p, num, len(opts_page), len(opts_sql)))
            else:
                for a, b in zip(opts_page, opts_sql):
                    if lire.plat(a) != lire.plat(b):
                        dur.append("%s q%d : « %s » dans la page, « %s » en base"
                                   % (p, num, a.strip(), b))

    # Les deux blocs d'une même migration doivent s'accorder.
    for f, tuples in lire.rattrapages(racine).items():
        for cle, (bonne, opts) in sorted(tuples.items()):
            if cle not in base:
                dur.append("%s : le bloc de rattrapage porte %s séance %d, que "
                           "l'insert ne crée pas" % (f, cle[1], cle[0]))
                continue
            b0, o0 = base[cle]
            if b0 != bonne:
                dur.append("%s : séance %d %s — l'insert dit %s, le rattrapage "
                           "dit %s" % (f, cle[0], cle[1], b0, bonne))
            if [lire.plat(x) for x in o0] != [lire.plat(x) for x in opts]:
                dur.append("%s : séance %d %s — les options du rattrapage "
                           "diffèrent de celles de l'insert ; au prochain rejeu, "
                           "le rattrapage remettrait l'ancienne version"
                           % (f, cle[0], cle[1]))

    if not dur:
        doux.append("%d questions vérifiées dans %d migration(s)."
                    % (len(base), len(fichiers)))
    return dur, doux


# ═══════════════════════════════════════════════════════════════════════════

CONTROLES = {'fiche': fiche, 'pedagogie': pedagogie, 'coherence': coherence}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('controle', choices=sorted(CONTROLES))
    ap.add_argument('--racine', default='.', help='dépôt portail-bts')
    ap.add_argument('--supports', default='/tmp/support', help='dépôt étudiant')
    a = ap.parse_args()

    dur, doux = CONTROLES[a.controle](a.racine, a.supports)
    for r in doux:
        print('  ~ ' + r)
    for e in dur:
        print('  ✗ ' + e)
    if dur:
        sys.exit('%d point(s) bloquant(s) — contrôle « %s ».'
                 % (len(dur), a.controle))
    print('Contrôle « %s » : rien à signaler.' % a.controle)


if __name__ == '__main__':
    main()
