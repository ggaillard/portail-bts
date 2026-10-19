# ─── Séance 6 du BTS1 — « Rouge, puis vert » — atelier (19/10/2026) ───────
#
# Produit les trois migrations de la séance depuis UNE seule liste :
#
#   cd portail-bts
#   python3 outils/seances/seance06/generer.py
#
# La trace (docs/seances/seance-06.md) est attendue à côté de portail-bts,
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
N = 6
SORTIES = ('20261019100000_bts1_seance6.sql',
           '20261019101000_bts1_seance6_debriefing.sql',
           '20261019102000_bts1_seance6_passages.sql')

def trace():
    for nom in ('BTS1 S1 B1 DEV', 'BTS1_S1_B1_DEV', 'sup'):
        p = os.path.join(RACINE, '..', nom, 'docs', 'seances', 'seance-%02d.md' % N)
        if os.path.exists(p):
            return p
    sys.exit('trace de la séance %d introuvable à côté de portail-bts' % N)

# Les intitulés sont interrogatifs, lisibles seuls au tableau ; les options
# sont recopiées de la page. Un ATELIER : les points de passage (plus bas)
# portent sur le dépôt de l'étudiant — on n'y répond qu'en ayant fait l'étape,
# et une IA qui n'a pas vu son journal ne le peut pas davantage.
Q = [
 (1,'C',"Pourquoi créer votre dépôt depuis le modèle plutôt que travailler dans celui de l'enseignant ?",
  ["pour ne pas avoir à écrire de message de commit","parce que le dépôt modèle interdit de lire ses fichiers sans compte","pour avoir votre propre historique et votre propre pipeline","pour que vos commits partent dans le dépôt de l'enseignant"],
  "Même départ pour tous, mais un historique, des commits et un pipeline à soi. Le modèle ne bouge pas."),
 (2,'A',"Dans votre fichier de workflow, quel bloc dit QUAND le pipeline se lance ?",
  ["le bloc on, avec push et pull_request","le bloc steps, avec la liste des étapes","la ligne runs-on, avec la machine","la ligne name, avec le titre du pipeline"],
  "on dit quand ; runs-on, sur quelle machine ; steps, quoi et dans quel ordre."),
 (3,'D',"Pourquoi le pipeline installe-t-il les dépendances à chaque exécution ?",
  ["parce que pytest change de version à chaque commit","parce que GitHub efface votre dépôt après chaque test","parce que l'installation rend le code plus rapide","parce que la machine est neuve et ne contient que le dépôt"],
  "Chaque exécution part d'une machine neuve : ce qui n'est pas déclaré dans le dépôt n'existe pas pour elle — la leçon du 14 h 02."),
 (4,'B',"Votre premier pipeline porte une croix rouge. Qu'est-ce que cela veut dire ?",
  ["que GitHub a rencontré une panne sur ses serveurs","qu'une étape a échoué et que la suite n'a pas été lancée","que le fichier de workflow contient une faute de frappe","que le dépôt doit être supprimé puis recréé"],
  "Rouge veut dire stop : l'étape qui échoue arrête la chaîne. C'est une information, pas une panne."),
 (5,'A',"Dans une ligne « assert X == Y » d'un journal de tests, que représente X ?",
  ["ce que la fonction a calculé pour les tâches du test","ce que le test attendait comme résultat pour ces tâches-là","le numéro de la ligne où se trouve l'erreur","le temps mis par le pipeline, en secondes"],
  "À gauche ce que le code a obtenu, à droite ce que le test attendait. L'écart dit où chercher."),
 (6,'C',"Le test attend 75 % pour trois tâches faites, une annulée et une à faire. Quelle règle exprime-t-il ?",
  ["une tâche annulée compte comme une tâche faite, pour encourager","un projet n'atteint jamais cent pour cent","les tâches annulées ne comptent pas dans le calcul","le résultat est toujours arrondi à la dizaine"],
  "3 faites sur 4 qui comptent : l'annulée est mise de côté. C'est la règle écrite dans le commentaire de la fonction."),
 (7,'D',"Où le pipeline a-t-il tourné quand vous avez proposé la correction ?",
  ["sur votre poste, avant l'envoi","sur main uniquement, une fois la correction fusionnée","sur le dépôt modèle de l'enseignant","sur votre branche, avant toute fusion"],
  "Le pull_request du bloc on lance le pipeline sur la branche proposée : la coche verte arrive avant la fusion."),
 (8,'B',"Pourquoi passer par une pull request plutôt que modifier main directement ?",
  ["parce que GitHub ne permet pas de modifier main","pour voir la coche verte avant que la correction n'entre dans main","pour que la correction soit faite par une autre personne","parce qu'une pull request lance les tests plus vite"],
  "On ne fusionne que du vert : la pull request montre le résultat du pipeline avant que la correction ne touche main."),
 (9,'C',"Thomas rend le pipeline vert en remplaçant 75 par 60 dans le test. Que faire en relecture ?",
  ["fusionner, puisque le pipeline est vert","relancer le pipeline pour vérifier qu'il reste vert","refuser : il a changé la règle au lieu de corriger le code","supprimer le test, qui gênait depuis trois semaines"],
  "Le vert ne prouve que ce que les tests vérifient. Modifier un test, c'est changer la règle : cela se discute, cela ne se fait pas pour faire taire une croix rouge."),
 (10,'A',"Au fond, qu'avez-vous construit aujourd'hui ?",
  ["une machine qui vérifie chaque changement à partir du dépôt seul","un programme qui trouve et corrige tout seul les erreurs dans le code","une sauvegarde automatique du dépôt chaque nuit","un rapport que la direction remplit elle-même"],
  "Le pipeline ne corrige rien : il vérifie, à chaque changement, depuis le dépôt seul. Corriger reste votre travail."),
]

# Le contrôle d'entrée : les cinq concepts de la séance 5, DANS L'ORDRE.
PRE = [
 ('pre-01','B',"Que fait l'intégration continue à chaque push ?",
  ["Elle copie le poste du développeur sur le serveur","Elle reconstruit le projet sur une machine propre et lance les tests","Elle envoie un rappel à l'équipe pour tester","Elle attend la fin de la journée pour tout livrer"],
  "Une machine propre, le dépôt seul, tous les tests : ce qui manque au dépôt se voit tout de suite."),
 ('pre-02','D',"Dans un pipeline, une étape échoue. Que deviennent les suivantes ?",
  ["Elles se lancent avec un avertissement","Elles se lancent si quelqu'un confirme","Elles sont rejouées jusqu'à devenir vertes","Elles ne sont pas lancées"],
  "Rouge veut dire stop : rien n'arrive en production."),
 ('pre-03','A',"Quel test vérifie une seule fonction, isolée, en quelques millisecondes ?",
  ["Le test unitaire","Le test de bout en bout","Le test d'intégration","Le test en préproduction"],
  "La base de la pyramide : beaucoup, rapides, précis."),
 ('pre-04','C',"Quelle est la différence entre une image et un conteneur ?",
  ["Aucune, ce sont deux noms pour la même chose","L'image tourne sur le poste, le conteneur en production","L'image est le modèle figé, le conteneur une exécution","L'image est une archive, le conteneur une capture"],
  "Le moule et le gâteau : une image versionnée, autant de conteneurs qu'on veut."),
 ('pre-05','B',"L'index de l'assistant doit être refait à chaque nouveau compte rendu. Qui s'en charge ?",
  ["Léa, chaque lundi matin","Un pipeline déclenché par le changement","L'assistant lui-même, quand il le juge utile","Personne : un index ne se refait pas"],
  "Ce qui doit être refait à chaque changement est écrit dans un fichier et fait par une machine."),
]

CONCEPTS = [
 "Son dépôt depuis un modèle — même départ pour tous, un historique et un pipeline à soi. [1]",
 "Le fichier de workflow — on dit quand, runs-on sur quelle machine, steps quoi et dans quel ordre ; il est versionné avec le code. [2 3]",
 "Lire une croix rouge — l'étape, le test, puis l'écart entre l'obtenu et l'attendu. [4 5]",
 "Corriger le code, pas le test — le test dit la règle ; on ne le change que si la règle change. [6 9]",
 "La pull request vérifiée — le pipeline tourne sur la branche avant la fusion : on ne fusionne que du vert. [7 8 10]",
]

# Trois minutes d'accueil, comme en séance 5. Les points de passage d'un
# ATELIER sont des preuves de faire : ils portent sur le dépôt de l'étudiant.
ACCUEIL_MIN = 3
PASSAGES = {
 1: ('C', "Dans tests/test_avancement.py de VOTRE dépôt, combien y a-t-il de fonctions de test ?",
     ["2", "3", "4", "5"],
     "Quatre règles : projet vide, tout fait, annulées mises de côté, projet entièrement annulé."),
 2: ('D', "Dans l'onglet Actions de votre dépôt, quelle étape de votre premier pipeline est rouge ?",
     ["Récupérer le code", "Installer Python", "Installer les dépendances", "Lancer les tests"],
     "Les tests : le code ne respecte pas la règle des tâches annulées. L'étape du rapport n'a pas été lancée."),
 3: ('B', "Dans le journal de l'étape rouge, que dit la ligne AssertionError ?",
     ["assert 75 == 60", "assert 60 == 75", "assert 47 == 60", "assert 0 == 75"],
     "Le code a obtenu 60 (3 sur 5), le test attendait 75 (3 sur 4) : l'annulée a été comptée."),
 4: ('A', "Après la fusion, que dit la dernière étape du pipeline de main ?",
     ["Avancement de la refonte du site : 60 %", "Avancement de la refonte du site : 47 %",
      "Avancement de la refonte du site : 75 %", "Avancement de la refonte du site : 72 %"],
     "60 % : 18 tâches faites sur les 30 qui comptent. La direction lisait 47 % parce que les 8 annulées étaient comptées."),
 5: None,   # « Rendre » : l'e-mail est le rendu, rien à corriger ici.
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
--  SÉANCE 6 DU BTS1 — « Rouge, puis vert » (19/10/2026)
--
--  Produit par outils/seances/seance06/generer.py. %s
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\\n',
''' + ",\n".join("      " + s(x) for x in CONCEPTS) + '''));
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'concepts de la séance 6 non écrits : %', v_r;
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
  join public.seances s on s.classe_id = c.id and s.numero = 6
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 6;
  if n not in (0, %d) then raise exception 'séance 6 : %% point(s) de passage, attendu %d', n; end if;
end $$;
''' % (len(actes), len(actes))

# ── 4. L'ordre des étapes (ajouté le 19/10, avec carte_parcours) ────────────
#  Après 20261019090000, qui crée la table.
sys.path.insert(0, os.path.join(ICI, '..'))
import etapes as _etapes
D = _etapes.sql(N, _etapes.etapes(t))
SORTIES = SORTIES + ('20261019103000_bts1_seance6_etapes.sql',)

for nom, txt in zip(SORTIES, (A, B, C, D)):
    # LF dans le dépôt ; le clone Windows convertit lui-même (core.autocrlf).
    open(os.path.join(MIG, nom), 'w', encoding='utf-8', newline='\n').write(txt)
print('ok', lettres, dict(c), 'fin des actes :', fin_min, 'min ;', len(actes), 'actes')
