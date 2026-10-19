# ─── L'ordre des étapes d'une séance, lu dans sa trace (19/10/2026) ─────────
#
# Le parcours guidé (suivi.js du dépôt du cours) pose, dans l'ordre de la page :
#   · chaque question du quiz à son ancre <div class="tdc-ici" data-q="N"> ;
#   · le point de passage d'un acte à la FIN de cet acte ;
#   · les questions sans ancre à l'épilogue.
# La base doit connaître ce même ordre pour dire « le 07 est sur la question 6
# depuis 9 min » (carte_parcours) ou « l'acte III a duré 17 min » (analyse_
# seance). Ce module le relit dans la trace ; chaque générateur de séance
# l'écrit dans une migration `…_etapes.sql`, et `controler.py fiche` vérifie
# que la base et la page disent le même ordre.
#
# Une seule fonction pour le calcul, appelée aux deux endroits : le jour où
# suivi.js change sa façon de placer une étape, c'est ici qu'on la change.
import re

_ACTE = re.compile(r'^##\s+\S+\s+ACTE\s+([IVX]+)\s+—', re.M)
_FIN = re.compile(r'^##\s+.*(ÉPILOGUE|EPILOGUE|Réviser après)', re.M | re.I)
_ANCRE = re.compile(r'<div class="tdc-ici" data-q="(\d+)"></div>')
_QUIZ = re.compile(r'^\*\*(\d+)\.\*\* .+?\n`', re.M)
ROMAINS = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8}


def etapes(texte):
    """['q1', 'q2', 'acte-1', 'q3', …] — l'ordre que voit l'étudiant."""
    reperes = []                                   # (position, cle)
    actes = [(m.start(), ROMAINS[m.group(1)]) for m in _ACTE.finditer(texte)]
    fin = _FIN.search(texte)
    fin_pos = fin.start() if fin else len(texte)
    for i, (pos, n) in enumerate(actes):
        # La fin d'un acte : le début du suivant, ou l'épilogue.
        suivant = actes[i + 1][0] if i + 1 < len(actes) else fin_pos
        reperes.append((suivant - 0.5, 'acte-%d' % n))
    ancrees = set()
    for m in _ANCRE.finditer(texte):
        if m.start() < fin_pos:
            reperes.append((m.start(), 'q%s' % m.group(1)))
            ancrees.add(int(m.group(1)))
    out = [c for _, c in sorted(reperes)]
    out += ['q%d' % n for n in sorted({int(x) for x in _QUIZ.findall(texte)}) if n not in ancrees]
    return out


def sql(numero, liste, classe='BTS1-DEV-2026'):
    """La migration qui écrit l'ordre. Rejouable : l'ordre n'a pas d'histoire
    (aucune réponse d'étudiant n'y est attachée), on le réécrit en entier."""
    lignes = ",\n".join("    (%d, '%s')" % (i, c) for i, c in enumerate(liste, 1))
    return '''-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE %(n)d DU BTS1 — l'ordre des étapes, tel que la page les pose
--
--  Produit par outils/seances/etapes.py depuis la trace (ancres tdc-ici et
--  fins d'actes). Lu par carte_parcours() pendant l'heure et par
--  analyse_seance() après. `controler.py fiche` vérifie que la base et la
--  page disent le même ordre.
--
--  Rejouable sans risque : aucune réponse n'est attachée à un rang.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = '%(classe)s' and s.numero = %(n)d;
  if v_id is null then return; end if;
  delete from public.etapes_seance where seance_id = v_id;
  insert into public.etapes_seance (seance_id, rang, cle)
  select v_id, e.rang, e.cle from (values
%(lignes)s
  ) as e(rang, cle);
end $$;
''' % dict(n=numero, classe=classe, lignes=lignes)


def lire_sql(texte):
    """L'inverse, pour les contrôles : (numero, ['q1', …]) d'une migration."""
    mn = re.search(r"s\.numero\s*=\s*(\d+);", texte)
    if not mn:
        return None, []
    return int(mn.group(1)), [c for _, c in sorted(
        (int(r), c) for r, c in re.findall(r"^\s*\((\d+), '((?:q|acte-)\d+)'\)", texte, re.M))]
