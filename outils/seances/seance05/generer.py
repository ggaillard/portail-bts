# ─── Séance 5 du BTS1 — « Mardi, 14 h 02 » (19/10/2026) ────────────────────
#
# Produit les trois migrations de la séance depuis UNE seule liste :
#
#   cd portail-bts
#   python3 outils/seances/seance05/generer.py
#
# La trace (docs/seances/seance-05.md) est attendue à côté de portail-bts,
# sous « BTS1 S1 B1 DEV » ou « BTS1_S1_B1_DEV » : on y relit les durées des
# actes (pour l'heure attendue de chaque point de passage) et les options du
# quiz, qui doivent être celles de la page lettre pour lettre.
#
# Ce qui change depuis la séance 4 :
#   · la grille des réponses n'est plus dans la page publique — ce fichier est
#     la seule source de la bonne lettre (controler.py la lit ici) ;
#   · chaque question du quiz est posée dans l'acte, à son ancre
#     <div class="tdc-ici" data-q="N">, et le script vérifie que les dix
#     ancres existent, une fois chacune, entre le cold open et l'épilogue.
import os, re, sys
from collections import Counter

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..', '..', '..'))
MIG = os.path.join(RACINE, 'supabase', 'migrations')
N = 5
SORTIES = ('20261019070000_bts1_seance5.sql',
           '20261019071000_bts1_seance5_debriefing.sql',
           '20261019072000_bts1_seance5_passages.sql')

def trace():
    for nom in ('BTS1 S1 B1 DEV', 'BTS1_S1_B1_DEV', 'sup'):
        p = os.path.join(RACINE, '..', nom, 'docs', 'seances', 'seance-%02d.md' % N)
        if os.path.exists(p):
            return p
    sys.exit('trace de la séance %d introuvable à côté de portail-bts' % N)

# Les intitulés sont interrogatifs, lisibles seuls au tableau ; les options
# sont recopiées de la page. Cinq questions sur dix portent sur ce que MONTRE
# la page (le journal, le pipeline, le Dockerfile, le fichier de Maya) : on n'y
# répond pas sans l'avoir lue — c'est le premier rempart contre « je demande
# à une IA ».
Q = [
 (1,'B',"Mardi, qu'aurait fait l'intégration continue au moment du push de Thomas ?",
  ["elle aurait recopié tel quel le poste de Thomas sur le serveur de production","elle aurait reconstruit le projet sur une machine propre et lancé les tests","elle aurait envoyé un courriel à Maya pour lui rappeler de tester","elle aurait attendu la fin de la journée pour tout livrer ensemble"],
  "La CI reconstruit le projet depuis le dépôt seul, sur une machine propre : pandas absent du dépôt, le test casse à 13 h 40, pas la page d'accueil à 14 h 02."),
 (2,'C',"Dans le pipeline du lendemain, les tests unitaires sont rouges. Que deviennent les étapes suivantes ?",
  ["elles se lancent quand même, mais en affichant un avertissement","elles se lancent seulement si Thomas confirme par un clic","elles ne sont pas lancées, et rien n'arrive en production","elles sont rejouées automatiquement jusqu'à devenir vertes"],
  "Rouge veut dire stop : l'étape qui échoue arrête la chaîne. Construire l'image et déployer restent « pas lancé »."),
 (3,'A',"Quel test vérifie une seule fonction, isolée, en quelques millisecondes ?",
  ["le test unitaire","le test de bout en bout","le test d'intégration","le test en préproduction"],
  "Le test unitaire : une fonction, aucune base, aucun écran. Le bas de la pyramide, celui qu'on écrit en nombre."),
 (4,'D',"À quoi sert la préproduction ?",
  ["à stocker les anciennes versions qui ne servent plus","à faire tourner les tests unitaires plus vite que sur le poste du développeur","à remplacer la production pendant la nuit","à essayer la version sur une copie de la production avant les clients"],
  "Une copie de la production, avec de fausses données : si ça casse, ça casse là, pas devant 9 400 utilisateurs."),
 (5,'A',"Quelle est la différence entre une image et un conteneur ?",
  ["l'image est le modèle figé, le conteneur une exécution de ce modèle","l'image est une capture d'écran, le conteneur une archive","l'image tourne seulement sur le poste, le conteneur seulement en production","aucune, ce sont deux noms pour la même chose"],
  "L'image est le moule, fabriqué une fois et versionné ; chaque conteneur est un gâteau sorti de ce moule."),
 (6,'D',"Dans le Dockerfile de DevSecure, quelle ligne aurait évité l'erreur de pandas, à condition que pandas soit dans requirements.txt ?",
  ["la ligne 1, qui sélectionne la version de Python à utiliser","la ligne 5, qui copie le code de l'équipe dans l'image","la ligne 6, qui démarre l'application au lancement","la ligne 4, qui installe les dépendances dans l'image"],
  "La ligne 4 installe dans l'image ce que requirements.txt déclare. La ligne 5 copie le code, pas les bibliothèques du poste."),
 (7,'B',"Pourquoi peut-on lancer un conteneur à chaque push, alors qu'on ne le ferait pas avec une machine virtuelle ?",
  ["parce qu'un conteneur n'a besoin d'aucun système pour tourner","parce qu'il partage le noyau de l'hôte : léger, il démarre en une seconde","parce qu'un conteneur ne peut contenir qu'un seul fichier","parce que GitHub interdit les machines virtuelles dans ses pipelines"],
  "Une machine virtuelle embarque un système entier ; un conteneur partage le noyau de l'hôte. Quelques mégaoctets, une seconde."),
 (8,'C',"Dans le fichier de Maya, que dit le bloc on, avec push et branches main ?",
  ["le système d'exploitation de la machine sur laquelle le pipeline tourne","la liste des étapes, dans l'ordre où elles s'exécutent","ce qui déclenche le pipeline : un push sur la branche main","le nom de l'image construite à la fin"],
  "on dit QUAND : un push sur main. runs-on choisit la machine, steps liste les étapes."),
 (9,'A',"L'assistant répondait toujours 47. Qu'est-ce qui règle ce second oubli ?",
  ["un pipeline qui reconstruit l'index dès qu'un document ou le modèle change","un message de Léa à l'équipe chaque lundi matin","un assistant plus puissant, qui devine les nouveaux chiffres","la suppression des anciens comptes rendus de la base"],
  "Ce qui doit être refait à chaque changement est écrit dans un pipeline : l'index se reconstruit tout seul, avec le modèle noté dans le dépôt."),
 (10,'C',"Au fond, qu'est-ce qui a manqué mardi à 14 h 02 ?",
  ["un serveur plus puissant pour la page d'accueil","un développeur plus prudent que Thomas","une machine qui teste et livre à partir du dépôt seul","une sauvegarde de la base faite chaque soir"],
  "Personne n'a menti : il manquait une machine qui ne fait confiance qu'au dépôt, et qui n'oublie jamais de tester."),
]

# Le contrôle d'entrée : les cinq concepts de la séance 4, DANS L'ORDRE
# (pre-01 = concept 1…) — « Sur le semestre » s'en sert pour repérer les
# notions perdues en une semaine.
PRE = [
 ('pre-01','C',"Dans quel cycle de vie découvre-t-on une erreur de besoin au bout de deux semaines, et non à la fin ?",
  ["Dans la cascade","Dans le cycle en V","Dans une méthode agile","Dans aucun des trois"],
  "L'agile livre par petites itérations montrées au client : l'erreur coûte deux semaines, pas un an."),
 ('pre-02','A',"Quels sont les trois gestes de la culture DevOps ?",
  ["Automatiser, mesurer, collaborer","Coder, tester, documenter","Planifier, livrer, facturer","Sécuriser, chiffrer, sauvegarder"],
  "Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d'une source unique du code."),
 ('pre-03','D',"Thomas a fait un commit de sa correction. Que manque-t-il pour que l'équipe la voie ?",
  ["Un merge dans sa propre branche","Un nouveau message de commit","Une copie du fichier renommée « finale »","Un push vers le dépôt partagé"],
  "Un commit reste sur la machine où il est né tant qu'un push ne l'envoie pas au dépôt partagé."),
 ('pre-04','B',"À quoi sert une pull request ?",
  ["À copier le dépôt d'un collègue sur son poste","À faire relire des changements avant de les fusionner","À envoyer le code en production sans passer par main","À effacer une branche et son historique"],
  "Une demande de fusion, relue et discutée avant d'être acceptée : la décision reste écrite dans l'histoire."),
 ('pre-05','A',"On change de modèle d'embedding. Que faut-il faire de l'index vectoriel ?",
  ["Recalculer tous les vecteurs avec le nouveau modèle","Ne rien faire, les anciens vecteurs restent valables","Recalculer seulement les documents ajoutés depuis","Supprimer les documents les plus anciens"],
  "Deux modèles ne donnent pas les mêmes nombres : des vecteurs mélangés donnent des résultats absurdes, sans erreur visible."),
]

CONCEPTS = [
 "L'intégration continue — à chaque push, une machine propre reconstruit le projet depuis le dépôt seul et lance les tests. [1 10]",
 "Le pipeline — des étapes enchaînées ; une étape rouge arrête la suite, et rien n'arrive en production. [2 8]",
 "Les étages de tests — unitaire, intégration, bout en bout ; on essaie d'abord en préproduction. [3 4]",
 "Image et conteneur — l'image est le modèle figé et versionné, le conteneur son exécution ; le Dockerfile en est la recette. [5 6 7]",
 "Automatiser ce qui se répète — tests, images, index : ce qui doit être refait à chaque changement est écrit dans un fichier et fait par une machine. [9 10]",
]

# Trois minutes d'accueil (appel, humeur, cold open) : l'heure fait 55 min,
# les actes 43 ; les questions étant posées DANS les actes, il ne reste à la
# fin que l'épilogue et les concepts.
ACCUEIL_MIN = 3
# Un point par acte, à la fin : une question qui APPLIQUE l'acte (celle de
# l'indice). Le rapport d'expertise de l'indice reste fermé tant que le point
# n'a pas de réponse — chercher d'abord, vérifier ensuite.
PASSAGES = {
 1: ('B', "Dans un pipeline, où se placent les tests ?",
     ["après le déploiement en production", "entre l'installation des dépendances et le déploiement",
      "avant même de récupérer le code poussé", "à la place de la préproduction"],
     "On teste avant de déployer, jamais après : un test rouge doit arrêter la chaîne avant qu'elle n'atteigne quiconque."),
 2: ('C', "Quel test aurait vu la page d'accueil en erreur 500 ?",
     ["le test unitaire de la fonction d'arrondi", "un test qui lit seulement la base des projets",
      "le test de bout en bout qui ouvre l'accueil", "aucun test ne peut voir une erreur 500"],
     "Seul le bout en bout voit ce que voit l'utilisateur : il ouvre l'accueil et lit la réponse du serveur."),
 3: ('D', "Dans le Dockerfile de DevSecure, quelle ligne fixe la version de Python ?",
     ["la ligne 4", "la ligne 6", "la ligne 5", "la ligne 1"],
     "FROM python:3.12-slim : la base de l'image fixe la version, la même sur tous les postes."),
 4: ('B', "Thomas pousse sur sa branche correctif. Le pipeline de Maya se lance-t-il ?",
     ["oui, à chaque push, quelle que soit la branche", "non : il ne se déclenche que sur la branche main",
      "oui, mais sans lancer les tests", "non : il faut toujours le lancer à la main"],
     "Le bloc on ne déclenche que sur main. D'où l'usage d'ajouter pull_request, pour tester avant le merge."),
 5: None,   # « Ouvrez le capot » : deux minutes d'observation, rien à corriger.
}

def s(x): return "'" + x.replace("'", "''") + "'"
def arr(o): return "array[" + ", ".join(s(x) for x in o) + "]"

# ── Vérifications avant d'écrire quoi que ce soit ──────────────────────────
c = Counter(b for _, b, *_ in Q)
assert max(c.values()) <= 3, c
assert len(Q) == 10 and [n for n, *_ in Q] == list(range(1, 11))
t = open(trace(), encoding='utf-8').read()
actes = [(m.group(1).strip(), int(m.group(2))) for m in
         re.finditer(r'^##\s+\S+\s+ACTE\s+[IVX]+\s+—\s+(.*?)\s+\*\(≈\s*(\d+)\s*min\)\*', t, re.M)]
assert len(actes) == len(PASSAGES), actes

# Les options de la page, lettre pour lettre.
page = {}
for num, enonce, ligne in re.findall(r'^\*\*(\d+)\.\*\* (.+?)\n(`.+)$', t, re.M):
    page[int(num)] = (enonce.strip(), [o.strip() for o in re.findall(r'`[A-D]`\s*([^·`]+)', ligne)])
for n, b, it, o, e in Q:
    assert page[n][1] == o, ('options q%d différentes de la page' % n, page[n][1], o)

# Les ancres : une par question, dans les actes.
debut = t.index('COLD OPEN'); fin = t.index('ÉPILOGUE')
ancres = [int(x) for x in re.findall(r'<div class="tdc-ici" data-q="(\d+)"></div>', t)]
assert sorted(ancres) == list(range(1, 11)), ('ancres', ancres)
for m in re.finditer(r'<div class="tdc-ici" data-q="(\d+)"></div>', t):
    assert debut < m.start() < fin, ('ancre hors des actes', m.group(1))

ENTETE = '''-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — « Mardi, 14 h 02 » (19/10/2026)
--
--  Produit par outils/seances/seance05/generer.py. %s
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════
'''

# ── 1. Titre, corrigés, contrôle d'entrée ─────────────────────────────────
lettres = ' '.join(b for _, b, *_ in Q)
noms = {'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D'}
rep = ', '.join('%d %s' % (c[l], l) for l in 'ABCD')
ins = ",\n\n".join("  (%d, %s, %s,\n   %s,\n   %s,\n   %s)" % (N, s('q%d' % n), s(b), s(i), arr(o), s(e)) for n, b, i, o, e in Q)
rat = ",\n".join("    (%s, %s, %s, %s, %s)" % (s('q%d' % n), s(b), s(i), arr(o), s(e)) for n, b, i, o, e in Q)
pre = ",\n\n".join("    (%s, %s,\n     %s,\n     %s,\n     %s)" % (s(k), s(b), s(i), arr(o), s(e)) for k, b, i, o, e in PRE)
A = open(os.path.join(ICI, 'tpl_seance.sql'), encoding='utf-8').read()
A = (A.replace('@@LETTRES@@', lettres).replace('@@REPARTITION@@', rep)
      .replace('@@INSERT@@', ins).replace('@@RATTRAPAGE@@', rat)
      .replace('@@PRE@@', pre).replace('@@NPRE@@', str(len(PRE))))

# ── 2. Les concepts ────────────────────────────────────────────────────────
B = (ENTETE % "Les cinq concepts, écrits par\n--  migration_definir_concepts() (20260924061000) — réponse LUE : un\n--  `perform` la jetterait, et la migration serait verte sans rien écrire.") + '''
do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\\n',
''' + ",\n".join("      " + s(x) for x in CONCEPTS) + '''));
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'concepts de la séance 5 non écrits : %', v_r;
    end if;
  end if;
end $$;
'''

# ── 3. Les points de passage ───────────────────────────────────────────────
pl, fin_min = [], ACCUEIL_MIN
for i, (titre, duree) in enumerate(actes, 1):
    fin_min += duree
    p = PASSAGES[i]
    titre = titre[0].upper() + titre[1:].lower()
    if p:
        b, it, o, e = p
        pl.append("    (%d, %s, %d, %s, %s, %s, %s)" % (i, s(titre), fin_min, s(it), arr(o), s(b), s(e)))
    else:
        pl.append("    (%d, %s, %d, null::text, null::text[], null::text, null::text)" % (i, s(titre), fin_min))
C = (ENTETE % ("Un point de passage par acte ; fin d'acte =\n--  %d min d'accueil + les durées de la trace (dernier acte à la %de minute).\n--  Réécrire un point est libre tant que personne ne l'a passé ; après, seul\n--  le texte de l'explication change — la règle du 16/09." % (ACCUEIL_MIN, fin_min))) + '''
with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
''' + ",\n".join(pl) + '''
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 5
on conflict (seance_id, acte) do update
   set titre = excluded.titre, fin_min = excluded.fin_min,
       intitule    = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.intitule else excluded.intitule end,
       options     = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.options else excluded.options end,
       bonne       = case when exists (select 1 from public.passages pa
                                        where pa.seance_id = points_passage.seance_id
                                          and pa.acte = points_passage.acte)
                          then points_passage.bonne else excluded.bonne end,
       explication = excluded.explication;

do $$
declare n int;
begin
  select count(*) into n from public.points_passage pp
    join public.seances s on s.id = pp.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if n not in (0, %d) then raise exception 'séance 5 : %% point(s) de passage, attendu %d', n; end if;
end $$;
''' % (len(actes), len(actes))

for nom, txt in zip(SORTIES, (A, B, C)):
    # LF dans le dépôt ; le clone Windows convertit lui-même (core.autocrlf).
    open(os.path.join(MIG, nom), 'w', encoding='utf-8', newline='\n').write(txt)
print('ok', lettres, dict(c), 'fin des actes :', fin_min, 'min ;', len(actes), 'actes')
