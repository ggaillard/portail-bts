#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lecture des deux sources d'une séance : la trace écrite et la migration.

Un seul endroit pour les expressions régulières. Les contrôles (fiche,
pédagogie, cohérence) posent des questions ; ce module répond « voici ce que
le fichier dit ». Quand la forme d'une trace change, c'est ici qu'on corrige,
et les trois contrôles suivent.

Aucun contrôle n'écrit de numéro de séance en dur : tout part d'un glob. Une
checklist qu'on doit penser à étendre finit toujours par oublier la séance du
jour.
"""

import glob
import os
import re
import unicodedata


# ═══════════════════════════════════════════════════════════════════════════
#  Outils communs
# ═══════════════════════════════════════════════════════════════════════════

def plat(t):
    """Réduit un texte à ce qui le distingue vraiment d'un autre.

    NFKD et pas NFD : « 42ᵉ » dans un support et « 42e » dans le SQL désignent
    la même option. Sans cette normalisation, le contrôle reste rouge sur une
    différence typographique et on finit par ne plus le regarder — ce qui est
    pire que pas de contrôle du tout.
    """
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '', t.lower().replace('’', "'"))


def mots(t):
    """Les mots d'un texte, sans accents, en minuscules, longueur ≥ 3.

    Le piège rencontré en écrivant le contrôle de la boucle narrative : des
    jetons d'au moins trois lettres ne trouvent rien dans « 03 h 47 » ni dans
    « 60, 47, 72 », et le contrôle passait au vert sans rien regarder. D'où
    `avec_chiffres`, qui garde aussi les nombres.
    """
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return [m for m in re.findall(r"[a-z]{3,}", t)]


def jetons_titre(t):
    """Les jetons d'un titre de récit : mots ≥ 3 lettres ET nombres.

    Un titre peut être entièrement numérique (« 03 h 47 », « 60, 47, 72 »).
    Ne garder que les mots revient à ne rien chercher du tout.
    """
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return [m for m in re.findall(r"[a-z]{3,}|\d+", t)]


# ═══════════════════════════════════════════════════════════════════════════
#  La trace écrite — docs/seances/seance-NN.md
# ═══════════════════════════════════════════════════════════════════════════

class Trace(object):
    """Ce qu'une trace de séance contient, tel qu'elle le dit."""

    def __init__(self, chemin):
        self.chemin = chemin
        self.nom = os.path.basename(chemin)
        m = re.search(r'seance-(\d+)', self.nom)
        self.numero = int(m.group(1)) if m else None
        with open(chemin, encoding='utf-8') as f:
            self.texte = f.read()

        self.front = self._front()
        self.corps = self.texte[self.texte.find('\n---\n', 3) + 5:] \
            if self.texte.startswith('---') else self.texte

    @property
    def corps_seance(self):
        """Ce qui se lit pendant l'heure : du cold open à la fin des actes.

        Le reste de la trace — le quiz de révision, la grille de correction,
        les concepts, le teaser, le « pour aller plus loin » — se lit chez soi,
        après. Le compter dans le temps de lecture de l'heure déclarerait
        trop longues des séances qui tiennent parfaitement.
        """
        deb = re.search(r'^##\s.*COLD OPEN', self.texte, re.M | re.I)
        fin = re.search(r'^##\s.*(ÉPILOGUE|EPILOGUE|Réviser après)',
                        self.texte, re.M | re.I)
        return self.texte[deb.start() if deb else 0:
                          fin.start() if fin else len(self.texte)]

    @property
    def phrases(self):
        """Les phrases de prose du corps de séance, tableaux et code exclus.

        Sans ce tri, l'en-tête d'une trace — un titre, une citation, un
        tableau, aucun point final — passe pour une phrase de 95 mots, et la
        remarque de lisibilité se déclenche sur toutes les séances.
        """
        t = re.sub(r'```.*?```', ' ', self.corps_seance, flags=re.S)
        gardees = [L for L in t.splitlines()
                   if not L.lstrip().startswith(('|', '#', '>', '!!!', '???',
                                                 '---', '```'))]
        out = []
        for bloc in re.split(r'\n\s*\n', '\n'.join(gardees)):
            # Une puce ne finit pas par un point : sans cette coupure, trois
            # puces d'affilée passent pour une phrase de cent trente mots.
            for morceau in re.split(r'\n\s*(?:[-*•]|\d+\.)\s', bloc):
                morceau = re.sub(r'`[^`]*`', ' ', morceau).replace('\n', ' ')
                out += [p.strip() for p in re.split(r'[.!?]\s', morceau)
                        if p.strip()]
        return out

    # ── en-tête ────────────────────────────────────────────────────────────
    def _front(self):
        if not self.texte.startswith('---'):
            return {}
        fin = self.texte.find('\n---', 3)
        if fin < 0:
            return {}
        d = {}
        for ligne in self.texte[3:fin].splitlines():
            if ':' in ligne:
                k, v = ligne.split(':', 1)
                d[k.strip()] = v.strip().strip('"').strip("'")
        return d

    @property
    def titre_recit(self):
        """Le titre entre guillemets français du H1 : « 60, 47, 72 »."""
        m = re.search(r'^#\s+.*?«\s*(.+?)\s*»', self.texte, re.M)
        return m.group(1) if m else None

    # ── structure ──────────────────────────────────────────────────────────
    @property
    def actes(self):
        """[(titre, minutes)] — les actes et leur durée annoncée."""
        out = []
        for m in re.finditer(r'^##\s+.*?ACTE\s+([IVX\d]+)\s*—\s*(.+?)\s*'
                             r'\*\(≈\s*(\d+)\s*min\)\*', self.texte, re.M):
            out.append((m.group(2), int(m.group(3))))
        return out

    @property
    def indices_replies(self):
        """Les blocs « ??? question » — les corrigés que l'élève déplie."""
        return re.findall(r'^\?\?\?\s+question\s+"(.+?)"', self.texte, re.M)

    @property
    def cold_open(self):
        return bool(re.search(r'^##\s.*COLD OPEN', self.texte, re.M | re.I))

    @property
    def teaser(self):
        return bool(re.search(r'^##\s.*TEASER', self.texte, re.M | re.I))

    @property
    def a_retenir(self):
        return bool(re.search(r'^##\s.*À retenir', self.texte, re.M | re.I))

    @property
    def prerequis(self):
        """La phrase « Prérequis : … », telle quelle."""
        m = re.search(r'Pr[ée]requis\s*:\s*(.+)', self.texte)
        return m.group(1).strip() if m else None

    # ── le quiz ────────────────────────────────────────────────────────────
    @property
    def questions(self):
        """[(numero:int, enonce:str, options:[str])], dans l'ordre de la page.

        Le contrat est celui de `extraireQuestions` de suivi.js : un
        paragraphe **N.** puis une ligne qui commence par `A`.
        """
        out = []
        for num, enonce, ligne in re.findall(
                r'^\*\*(\d+)\.\*\* (.+?)\n(`.+)$', self.texte, re.M):
            opts = [o.strip() for o in re.findall(r'`[A-D]`\s*([^·`]+)', ligne)]
            out.append((int(num), enonce.strip(), opts))
        return out

    @property
    def grille(self):
        """Les lettres de la ligne « **Rép.** » du tableau de correction."""
        m = re.search(r'\|\s*\*\*Rép\.\*\*\s*\|(.+?)\|\s*\n', self.texte)
        if not m:
            return []
        return [x.strip() for x in m.group(1).split('|') if x.strip()]

    # ── les concepts du débriefing ─────────────────────────────────────────
    @property
    def concepts(self):
        """[(intitule, detail, [numeros])] de la section « Concepts à connaître ».

        Le format d'une ligne, identique à celui que `definir_concepts()`
        analyse en base :

            1. **Intitulé** — détail libre. [3 4 5]

        Les crochets sont facultatifs ; le détail aussi.
        """
        m = re.search(r'^##\s.*Concepts à connaître\s*$(.*?)(?=^---\s*$|\Z)',
                      self.texte, re.M | re.S)
        if not m:
            return []
        bloc = m.group(1)
        out = []
        # Une entrée numérotée, jusqu'à la suivante : le détail peut courir
        # sur plusieurs lignes, c'est le cas dans les trois séances écrites.
        for e in re.finditer(r'^\d+\.\s+(.+?)(?=^\d+\.\s|\Z)', bloc, re.M | re.S):
            brut = ' '.join(e.group(1).split())
            nums = []
            mq = re.search(r'\[([\d\s]+)\]\s*$', brut)
            if mq:
                nums = [int(x) for x in mq.group(1).split()]
                brut = brut[:mq.start()].strip()
            sep = re.split(r'\s—\s|\s-\s', brut, 1)
            intitule = sep[0].replace('**', '').strip().rstrip(' —-')
            detail = sep[1].strip() if len(sep) > 1 else ''
            out.append((intitule, detail, nums))
        return out


def traces(racine):
    """Toutes les traces de séance trouvées sous `racine`, par numéro."""
    motif = os.path.join(racine, 'docs', 'seances', 'seance-*.md')
    return [Trace(f) for f in sorted(glob.glob(motif))]


# ═══════════════════════════════════════════════════════════════════════════
#  Les migrations — supabase/migrations/*_bts1_seance*.sql
# ═══════════════════════════════════════════════════════════════════════════

_CORRIGE = re.compile(
    r"\(\s*(\d+)(?:::int)?\s*,\s*'(q\d+)'\s*,\s*'([A-D])'\s*,\s*\n"
    r"\s*'((?:[^']|'')*)'\s*,\s*\n\s*array\[(.*?)\]\s*,", re.S)

_RATTRAPAGE = re.compile(
    r"\(\s*'(q\d+)'\s*,\s*'([A-D])'\s*,\s*'((?:[^']|'')*)'\s*,"
    r"\s*array\[(.*?)\]\s*,", re.S)


def _options(bloc):
    return [o.replace("''", "'") for o in re.findall(r"'((?:[^']|'')*)'", bloc)]


def corriges(racine):
    """Ce que les migrations disent : {(seance, 'qN'): (lettre, [options])}.

    Le glob couvre `*_bts1_seances.sql` comme `*_bts1_seance3.sql` et toutes
    les séances à venir. Le premier écrit de ce contrôle ne lisait qu'un seul
    fichier : la séance 3, écrite dans sa propre migration, n'était vérifiée
    par personne.
    """
    base, fichiers = {}, sorted(glob.glob(os.path.join(
        racine, 'supabase', 'migrations', '*_bts1_seance*.sql')))
    for f in fichiers:
        with open(f, encoding='utf-8') as fh:
            sql = fh.read()
        for m in _CORRIGE.finditer(sql):
            base[(int(m.group(1)), m.group(2))] = (
                m.group(3), _options(m.group(5)))
    return base, fichiers


def rattrapages(racine):
    """Le second bloc d'une migration : {fichier: {(seance,'qN'): (lettre, opts)}}.

    Un fichier de séance porte chaque tuple deux fois — l'`insert` qui crée le
    corrigé, puis l'`update` qui rattrape un corrigé présent mais vide. Ne
    corriger que le premier laisse le second remettre l'ancienne version au
    rejeu suivant, en silence.

    Le numéro de séance n'apparaît pas dans le bloc de rattrapage : il est lu
    dans le `s.numero = N` de la clause `where` qui suit.
    """
    out = {}
    for f in sorted(glob.glob(os.path.join(
            racine, 'supabase', 'migrations', '*_bts1_seance*.sql'))):
        with open(f, encoding='utf-8') as fh:
            sql = fh.read()
        for bloc in re.finditer(
                r'update public\.corriges.*?from \(values(.*?)\)\s*as q\('
                r'.*?s\.numero\s*=\s*(\d+)', sql, re.S):
            n = int(bloc.group(2))
            d = out.setdefault(os.path.basename(f), {})
            for m in _RATTRAPAGE.finditer(bloc.group(1)):
                d[(n, m.group(1))] = (m.group(2), _options(m.group(4)))
    return out


def concepts_base(racine):
    """Ce que la migration du débriefing écrit : {seance: [(intitule, [nums])]}.

    Les appels ont la forme :

        where c.code = 'BTS1-DEV-2026' and s.numero = 3;
        ...
        perform public.definir_concepts(v_id, concat_ws(E'\\n',
          'Intitulé — détail. [1 2 3]',
          ...));
    """
    out = {}
    for f in sorted(glob.glob(os.path.join(
            racine, 'supabase', 'migrations', '*_debriefing.sql'))):
        with open(f, encoding='utf-8') as fh:
            sql = fh.read()
        for m in re.finditer(
                r"s\.numero\s*=\s*(\d+);(.*?)definir_concepts\(v_id,\s*"
                r"concat_ws\(E'\\n',(.*?)\)\);", sql, re.S):
            n, corps = int(m.group(1)), m.group(3)
            lignes = []
            for L in re.findall(r"'((?:[^']|'')*)'", corps):
                brut = L.replace("''", "'").strip()
                if not brut:
                    continue
                nums = []
                mq = re.search(r'\[([\d\s]+)\]\s*$', brut)
                if mq:
                    nums = [int(x) for x in mq.group(1).split()]
                    brut = brut[:mq.start()].strip()
                intitule = re.split(r'\s—\s|\s-\s', brut, 1)[0].strip()
                lignes.append((intitule, nums))
            out[n] = lignes
    return out
