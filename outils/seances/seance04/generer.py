# ⚠️ FIGÉ DEPUIS LE 25/09 : les migrations que produit ce script (060000,
# 061000, 071000) sont appliquées en production. La séance 4 a depuis gagné les
# bases vectorielles : c'est vectoriel.py, à côté, qui porte la version
# courante. Ne relancez celui-ci que pour vérifier qu'il redonne à l'identique
# les fichiers d'origine.
#
# Génère les deux migrations de la séance 4 depuis UNE seule liste :
#
#   cd portail-bts
#   python3 outils/seances/seance04/generer.py \
#       supabase/migrations/20260924060000_bts1_seance4.sql \
#       supabase/migrations/20260924061000_bts1_seance4_debriefing.sql
#
# Les options doivent rester celles de docs/seances/seance-04.md, lettre pour
# lettre : `controler.py coherence` le vérifie après coup.
# le bloc de rattrapage est recopié par la machine, jamais ressaisi.
Q = [
 (1,'B',"Dans un cycle en cascade, quand découvre-t-on le plus souvent qu'on s'est trompé de besoin ?",
  ["au moment d'écrire le cahier des charges avec le client","à la fin, quand le client voit enfin le produit","à chaque itération de deux semaines","dès la première ligne de code écrite"],
  "Le client voit le produit à la fin. Une erreur de besoin commise au début se découvre quand tout est déjà construit."),
 (2,'D',"Qu'est-ce qui distingue le cycle en V de la cascade ?",
  ["il supprime complètement l'étape des tests","il livre une nouvelle version toutes les deux semaines","il confie la conception entière au client","chaque étape de conception a son test en miroir"],
  "Chaque étape de la descente a sa vérification préparée d'avance, sur la branche qui remonte."),
 (3,'A',"Que cherche une méthode agile ?",
  ["livrer souvent, par petits morceaux, pour corriger tôt","livrer une seule fois, quand tout est entièrement terminé","suivre un plan fixé d'avance sans jamais le modifier","supprimer les réunions avec le client pour aller plus vite"],
  "De petites itérations montrées au client : une erreur de besoin coûte deux semaines, pas un an."),
 (4,'C',"Quels sont les trois gestes de la culture DevOps vus dans cette séance ?",
  ["coder, tester, documenter","planifier, livrer, facturer","automatiser, mesurer, collaborer","sécuriser, chiffrer, sauvegarder chaque soir"],
  "Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d'une source unique du code."),
 (5,'B',"Qu'est-ce qu'un commit ?",
  ["une copie du dossier envoyée par courriel à l'équipe","un instantané du projet, avec un auteur, une date et un message","une sauvegarde automatique du poste faite chaque nuit","un fichier renommé « version finale » dans le dossier partagé"],
  "Un instantané identifié, daté, signé et expliqué. Fini les fichiers « final_VRAI »."),
 (6,'A',"Pourquoi travailler sur une branche ?",
  ["pour avancer sans toucher à la version principale","pour que le code s'exécute plus vite en production","pour empêcher les collègues de lire son travail","pour ne plus avoir besoin d'écrire de messages"],
  "On travaille à côté de main, qui part en production, et on ne fusionne que quand c'est prêt."),
 (7,'D',"À quoi sert une pull request ?",
  ["copier le dépôt d'un autre sur son propre poste","supprimer une branche devenue inutile","envoyer le code directement en production, sans passer par main","faire relire des changements avant de les fusionner"],
  "Une demande de fusion, relue et discutée avant d'être acceptée. La décision reste écrite dans l'histoire."),
 (8,'C',"Thomas avait fait un commit de sa correction, et pourtant la production ne l'avait pas. Pourquoi ?",
  ["la production refuse tout commit fait le lundi","Git avait effacé la correction pendant la nuit","le commit était resté sur son poste, jamais poussé","la correction contenait elle-même une erreur de calcul"],
  "Un commit reste sur la machine où il est né tant qu'un push ne l'envoie pas au dépôt partagé."),
 (9,'A',"Pour annuler un commit déjà partagé sans réécrire l'historique, on :",
  ["crée un nouveau commit qui défait le précédent","supprime le dépôt et on le recrée depuis zéro","modifie le fichier directement sur le serveur","demande à chacun d'effacer sa copie locale du dépôt"],
  "C'est git revert : on ajoute un commit qui défait, et l'on sait aussi qui est revenu en arrière, et pourquoi."),
 (10,'D',"Pourquoi « ça marche sur mon poste » ne prouve-t-il rien ?",
  ["parce que les postes des développeurs sont moins puissants que les serveurs","parce que Git ne fonctionne que sur un serveur","parce que les tests sont toujours faux sur un poste","parce que la production ne tourne pas avec ce qui est sur le poste"],
  "La production tourne avec ce qui est dans main. Ce qui n'a pas quitté le poste n'existe pour personne d'autre."),
]
PRE = [
 ('pre-01','B',"Dans une base relationnelle, à quoi sert une clé étrangère ?",
  ["À identifier une ligne sans doublon possible","À pointer vers la clé primaire d'une autre table","À chiffrer une colonne qui contient des données sensibles","À trier la table dans l'ordre alphabétique"],
  "La clé primaire identifie la ligne ; la clé étrangère pointe vers celle d'une autre table. C'est la flèche de la relation."),
 ('pre-02','A',"Qu'échange-t-on en choisissant une base NoSQL documentaire ?",
  ["Des garanties, contre de la souplesse et du volume","De la souplesse, contre moins de volume stocké","Rien : seul le langage des requêtes change","De la vitesse, contre une place plus grande sur le disque"],
  "Le relationnel refuse ce qui ne rentre pas ; le NoSQL accepte et vous fait confiance. C'est un échange, pas un progrès."),
 ('pre-03','D',"Les salaires et les contrats du personnel : où les ranger ?",
  ["Dans un lac de données, au cas où","Dans une base clé-valeur, comme un panier","Dans une base orientée graphe","Dans une base relationnelle"],
  "Des montants exacts et des transactions : on veut surtout des garanties, pas de la souplesse."),
 ('pre-04','C',"Qu'est-ce qui distingue un entrepôt de données d'un lac ?",
  ["L'entrepôt garde tout, brut, au cas où","L'entrepôt n'accepte que des fichiers JSON","L'entrepôt range d'avance, pour des questions connues","L'entrepôt efface tout chaque dimanche soir"],
  "Le lac garde tout, brut ; l'entrepôt nettoie et range à l'avance les réponses aux questions qu'on sait déjà poser."),
 ('pre-05','A',"Avant de croire un chiffre affiché, que faut-il demander d'abord ?",
  ["D'où il vient, et de quand il parle","Combien de décimales il affiche","Quelle couleur a le graphique qui le montre","Qui l'a affiché en premier dans l'équipe"],
  "Un chiffre sans date ni source n'est pas une information. 60, 47 et 72 étaient justes tous les trois."),
]
CONCEPTS = [
 "Les cycles de vie — la cascade découvre ses erreurs à la fin, le V met un test en face de chaque étape, l'agile livre souvent pour corriger tôt. [1 2 3]",
 "La culture DevOps — automatiser, mesurer, collaborer : abattre le mur entre ceux qui écrivent le code et ceux qui le font tourner. [4 10]",
 "Le commit — un instantané daté, signé et expliqué, qui reste sur le poste tant qu'on ne l'a pas poussé. [5 8 10]",
 "Branche, pull request, fusion — on travaille à côté, on fait relire, puis on fusionne dans la version principale. [6 7]",
 "Revenir en arrière — un nouveau commit qui défait le précédent, sans effacer l'histoire : c'est ce qui rend le changement sans danger. [9]",
]
import os
ICI = os.path.dirname(os.path.abspath(__file__))

def s(x): return "'" + x.replace("'", "''") + "'"
def arr(o): return "array[" + ", ".join(s(x) for x in o) + "]"

# ─── Les points de passage ────────────────────────────────────────────────
# Un par acte. `fin_min` n'est pas saisi : il se DÉDUIT des durées écrites
# dans les titres d'actes de la trace, plus le temps d'accueil (appel,
# humeur, contrôle d'entrée, cold open). Changer une durée dans la trace
# change l'heure attendue ici au prochain passage du script.
ACCUEIL_MIN = 7
PASSAGES = {
 1: ('C', "Le client voit un morceau qui fonctionne toutes les deux semaines. De quel cycle s'agit-il ?",
     ["la cascade", "le cycle en V", "l'agile", "aucun des trois"],
     "De petites itérations montrées au client : c'est l'agile. On se trompe tôt, donc moins cher."),
 2: ('B', "La correction de Thomas n'existait que sur son poste. Quel geste DevOps a manqué ?",
     ["mesurer", "collaborer", "automatiser", "documenter"],
     "Collaborer, c'est d'abord une source unique du code, partagée par tous."),
 3: ('D', "Quelle commande envoie un commit du poste vers le dépôt partagé ?",
     ["git commit", "git merge", "git revert", "git push"],
     "Sans push, le commit reste sur la machine où il est né. C'est le geste qui a manqué à Thomas."),
 4: None,   # « Ouvrez le capot » : trois minutes d'observation, rien à corriger.
}
TRACE = os.path.join(ICI, '..', '..', '..', '..', 'BTS1 S1 B1 DEV', 'docs', 'seances', 'seance-04.md')

def actes_de_la_trace(chemin):
    import re
    t = open(chemin, encoding='utf-8').read()
    return [(m.group(1).strip(), int(m.group(2))) for m in
            re.finditer(r'^##\s+\S+\s+ACTE\s+[IVX]+\s+—\s+(.*?)\s+\*\(≈\s*(\d+)\s*min\)\*', t, re.M)]

def passages_sql():
    actes = actes_de_la_trace(TRACE)
    assert len(actes) == len(PASSAGES), (actes, list(PASSAGES))
    lignes, fin = [], ACCUEIL_MIN
    for i, (titre, duree) in enumerate(actes, 1):
        fin += duree
        q = PASSAGES[i]
        if q:
            b, it, o, e = q
            lignes.append("    (%d, %s, %d, %s, %s, %s, %s)" % (i, s(titre.capitalize()), fin, s(it), arr(o), s(b), s(e)))
        else:
            lignes.append("    (%d, %s, %d, null, null, null, null)" % (i, s(titre.capitalize()), fin))
    return ",\n".join(lignes)

from collections import Counter
c = Counter(b for _,b,*_ in Q); assert max(c.values()) <= 3, c
lettres = ' '.join(b for _,b,*_ in Q)

ins = ",\n\n".join("  (4, %s, %s,\n   %s,\n   %s,\n   %s)" % (s('q%d'%n), s(b), s(i), arr(o), s(e)) for n,b,i,o,e in Q)
rat = ",\n".join("    (%s, %s, %s, %s, %s)" % (s('q%d'%n), s(b), s(i), arr(o), s(e)) for n,b,i,o,e in Q)
pre = ",\n\n".join("    (%s, %s,\n     %s,\n     %s,\n     %s)" % (s(k), s(b), s(i), arr(o), s(e)) for k,b,i,o,e in PRE)

A = open(os.path.join(ICI, 'tpl_seance.sql'), encoding='utf-8').read()
A = A.replace('@@LETTRES@@', lettres).replace('@@INSERT@@', ins).replace('@@RATTRAPAGE@@', rat).replace('@@PRE@@', pre).replace('@@NPRE@@', str(len(PRE)))
B = open(os.path.join(ICI, 'tpl_debrief.sql'), encoding='utf-8').read()
B = B.replace('@@CONCEPTS@@', ",\n".join("      " + s(x) for x in CONCEPTS))
import sys
C = open(os.path.join(ICI, 'tpl_passages.sql'), encoding='utf-8').read().replace('@@PASSAGES@@', passages_sql())
if len(sys.argv) > 3:
    open(sys.argv[3], 'w', encoding='utf-8', newline='\r\n').write(C)
open(sys.argv[1], 'w', encoding='utf-8', newline='\r\n').write(A)
open(sys.argv[2], 'w', encoding='utf-8', newline='\r\n').write(B)
print('ok', lettres, dict(c))
