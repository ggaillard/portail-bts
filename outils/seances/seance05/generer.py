# ─── Séance 5 du BTS1 — « Mardi, 17 h 52 » (CI/CD et conteneurisation) ─────
#
# Produit les trois migrations de la séance depuis UNE seule liste :
#
#   cd portail-bts
#   python3 outils/seances/seance05/generer.py
#
# Il lit les durées d'actes dans la trace (le dépôt des supports est attendu à
# côté de portail-bts, sous « BTS1 S1 B1 DEV » ou « BTS1_S1_B1_DEV »).
# Les options sont recopiées de docs/seances/seance-05.md, lettre pour lettre :
# `controler.py coherence` le vérifie après coup.
import os, re, sys
from collections import Counter

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..', '..', '..'))
MIG = os.path.join(RACINE, 'supabase', 'migrations')
SORTIES = ('20261103180000_bts1_seance5.sql',
           '20261103181000_bts1_seance5_debriefing.sql',
           '20261103182000_bts1_seance5_passages.sql')
NUM = 5

def trace():
    for nom in ('BTS1 S1 B1 DEV', 'BTS1_S1_B1_DEV', 'b1', 'sup'):
        p = os.path.join(RACINE, '..', nom, 'docs', 'seances', 'seance-05.md')
        if os.path.exists(p):
            return p
    sys.exit('trace de la séance 5 introuvable à côté de portail-bts')

Q = [
 (1,'C',"Pourquoi une mise en production faite à la main est-elle risquée ?",
  ["elle consomme plus d'énergie sur le serveur","elle est interdite par le règlement européen","chaque geste repose sur la mémoire de quelqu'un","elle n'est possible qu'après les heures de cours"],
  "On oublie, on ne refait jamais pareil, on ne sait pas après coup ce qui a été fait. Mardi, trois lignes de la check-list ont sauté."),
 (2,'A',"Que fait l'intégration continue ?",
  ["elle construit et teste le code à chaque push","elle livre le code au client à la fin du projet","elle fusionne toutes les branches à minuit","elle évite de relire les pull requests"],
  "CI : à chaque push, le code est construit et testé. On sait en quelques minutes si le changement casse quelque chose."),
 (3,'D',"Dans un pipeline, une étape de test échoue. Que se passe-t-il ?",
  ["le déploiement continue, avec un avertissement","les tests sont relancés jusqu'à ce qu'ils passent","le code fautif est effacé du dépôt","la chaîne s'arrête et rien n'est déployé"],
  "Au premier rouge, la chaîne s'arrête. C'est ce qui aurait évité la page blanche de mardi."),
 (4,'B',"Un test qui vérifie une seule fonction, isolée du reste, est un test :",
  ["de bout en bout","unitaire","de charge","d'intégration"],
  "Unitaire : une fonction, rien autour. L'intégration vérifie des morceaux qui se parlent, le bout en bout le parcours d'un utilisateur."),
 (5,'C',"À quoi sert la préproduction ?",
  ["à garder une sauvegarde de la base de données","à héberger le site les jours de panne","à essayer la version sans les vrais utilisateurs","à ranger les anciennes versions du code"],
  "Une copie de la production, sans les vrais utilisateurs : si la version casse, elle casse devant l'équipe, pas devant le client."),
 (6,'A',"Quelle est la différence entre une image et un conteneur ?",
  ["l'image est le modèle figé, le conteneur l'image en marche","l'image tourne sous Linux, le conteneur sous Windows","l'image contient le code, le conteneur contient les tests","aucune, ce sont deux noms pour la même chose"],
  "L'image est le colis plombé ; le conteneur, le colis ouvert et au travail. On lance autant de conteneurs qu'on veut à partir d'une image."),
 (7,'D',"Que décrit un Dockerfile ?",
  ["la liste des utilisateurs autorisés","le réseau de l'entreprise","le planning des mises en production","les étapes pour fabriquer l'image"],
  "C'est la recette de l'image : partir de Python 3.12, copier, installer, lancer. Un fichier texte, qui se commite."),
 (8,'B',"Pourquoi un conteneur règle-t-il la panne de Python de mardi ?",
  ["il rend le code plus rapide à exécuter","il emporte la bonne version de Python avec le code","il interdit d'installer Python sur le serveur","il traduit le code dans une version plus ancienne"],
  "La version est écrite dans le Dockerfile (FROM python:3.12-slim) : ce n'est plus le serveur qui décide, c'est l'image."),
 (9,'C',"Dans un workflow GitHub Actions, que dit la partie « on » ?",
  ["sur quelle machine la chaîne tourne","quelles commandes la chaîne lance","quel événement déclenche la chaîne","qui a le droit de modifier la chaîne"],
  "on : quand ? Ici, un push sur main. runs-on dit sur quelle machine, steps quelles commandes."),
 (10,'A',"L'assistant répétait 47. Qu'est-ce qui l'en empêche désormais ?",
  ["la reconstruction de l'index fait partie de la chaîne","un second assistant vérifie le premier","Léa reçoit une alerte chaque matin","un test interdit d'afficher le chiffre 47"],
  "L'index est fabriqué par un script : dans le workflow, personne n'a plus à s'en souvenir."),
]

# Le contrôle d'entrée : les cinq concepts de la séance 4, DANS LEUR ORDRE.
PRE = [
 ('pre-01','C',"Quel cycle de vie livre souvent, par petites itérations, pour corriger tôt ?",
  ["La cascade","Le cycle en V","L'agile","Aucun des trois"],
  "L'agile livre toutes les deux à quatre semaines : une erreur de besoin coûte deux semaines, pas un an."),
 ('pre-02','A',"Quels sont les trois gestes de la culture DevOps ?",
  ["Automatiser, mesurer, collaborer","Coder, tester, documenter","Planifier, livrer, facturer","Sécuriser, chiffrer, sauvegarder"],
  "Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d'une source unique du code."),
 ('pre-03','D',"Thomas a fait un commit, mais la production ne l'a jamais eu. Que manquait-il ?",
  ["Un merge de main dans sa branche","Un message de commit plus clair","Un revert du commit précédent","Un push vers le dépôt partagé"],
  "Un commit reste sur la machine où il est né tant qu'un push ne l'envoie pas au dépôt partagé."),
 ('pre-04','B',"À quoi sert une pull request ?",
  ["À copier le dépôt d'un autre sur son poste","À faire relire des changements avant de les fusionner","À envoyer le code en production sans passer par main","À supprimer une branche devenue inutile"],
  "Une demande de fusion, relue et discutée avant d'être acceptée. La décision reste écrite dans l'histoire."),
 ('pre-05','A',"Une base vectorielle retrouve un document parce que :",
  ["son vecteur est proche de celui de la question","il contient exactement les mots de la question","il est le plus récent de la base","son identifiant est celui qu'on demande"],
  "Elle compare des sens, pas des mots ; et son index, fabriqué par un modèle, se versionne avec lui."),
]

CONCEPTS = [
 "Déployer à la main — chaque geste repose sur la mémoire de quelqu'un : on oublie, on ne refait jamais pareil ; ce qui se répète se confie à une machine. [1 10]",
 "Le pipeline CI/CD — build, tests, préproduction, production, enchaînés à chaque push ; au premier rouge, rien n'est livré. [2 3 5]",
 "Les tests automatisés — unitaire pour une fonction, intégration pour des morceaux qui se parlent, bout en bout pour le parcours d'un utilisateur. [4]",
 "Le conteneur — le Dockerfile est la recette, l'image le modèle figé, le conteneur l'image en marche : le code tourne pareil partout. [6 7 8]",
 "Le workflow — le pipeline écrit dans le dépôt : on dit quand, jobs et steps disent quoi et comment ; il se versionne comme le code. [9 10]",
]

# Trois minutes d'accueil (appel, humeur, cold open), comme la séance 4 :
# l'heure fait 55 min, les actes 42, le quiz garde ses dix minutes.
ACCUEIL_MIN = 3
PASSAGES = {
 1: ('C', "Mardi, la page d'accueil est tombée. Quelle ligne de la check-list avait sauté ?",
     ["récupérer main", "redémarrer le service", "lancer les tests", "prévenir l'équipe"],
     "Les tests n'avaient pas été lancés : « on n'avait pas le temps ». Une machine, elle, a toujours le temps."),
 2: ('B', "Dans quel ordre un pipeline enchaîne-t-il ses étapes ?",
     ["test, build, déploiement", "build, test, déploiement", "déploiement, test, build", "build, déploiement, test"],
     "On construit, on teste, et seulement si tout est vert, on déploie."),
 3: ('A', "Le poste de Thomas a Python 3.12, le serveur Python 3.8. Qu'apporte le conteneur ?",
     ["la même version de Python partout", "une mise à jour automatique du serveur", "un code compatible avec toutes les versions", "la suppression de Python sur le serveur"],
     "La version est écrite dans l'image : elle voyage avec le code."),
 4: ('D', "Dans un workflow, quel mot dit QUAND la chaîne se lance ?",
     ["jobs", "steps", "needs", "on"],
     "on : l'événement déclencheur. jobs et steps disent quoi et comment, needs dans quel ordre."),
 5: None,   # « Ouvrez le capot » : deux minutes d'observation, rien à corriger.
}

def s(x): return "'" + x.replace("'", "''") + "'"
def arr(o): return "array[" + ", ".join(s(x) for x in o) + "]"

def actes_de_la_trace(chemin):
    t = open(chemin, encoding='utf-8').read()
    return [(m.group(1).strip(), int(m.group(2))) for m in
            re.finditer(r'^##\s+\S+\s+ACTE\s+[IVX]+\s+—\s+(.*?)\s+\*\(≈\s*(\d+)\s*min\)\*', t, re.M)]

def passages_sql():
    actes = actes_de_la_trace(trace())
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
    return ",\n".join(lignes), len(actes)

c = Counter(b for _,b,*_ in Q); assert max(c.values()) <= 3, c
longue = sum(1 for _,b,_,o,_ in Q if len(o['ABCD'.index(b)]) == max(map(len, o)))
assert longue <= 6, longue
lettres = ' '.join(b for _,b,*_ in Q)
noms = {'A':'A','B':'B','C':'C','D':'D'}
repart = ', '.join('%d %s' % (c[l], l) for l in 'ABCD')

ins = ",\n\n".join("  (%d, %s, %s,\n   %s,\n   %s,\n   %s)" % (NUM, s('q%d'%n), s(b), s(i), arr(o), s(e)) for n,b,i,o,e in Q)
rat = ",\n".join("    (%s, %s, %s, %s, %s)" % (s('q%d'%n), s(b), s(i), arr(o), s(e)) for n,b,i,o,e in Q)
pre = ",\n\n".join("    (%s, %s,\n     %s,\n     %s,\n     %s)" % (s(k), s(b), s(i), arr(o), s(e)) for k,b,i,o,e in PRE)

A = open(os.path.join(ICI, 'tpl_seance.sql'), encoding='utf-8').read()
A = (A.replace('@@LETTRES@@', lettres).replace('@@REPART@@', repart)
      .replace('@@INSERT@@', ins).replace('@@RATTRAPAGE@@', rat)
      .replace('@@PRE@@', pre).replace('@@NPRE@@', str(len(PRE))))

B = """-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 5 DU BTS1 — les cinq concepts, projetés en fin d'heure
--
--  Produit par outils/seances/seance05/generer.py. Écrits par
--  migration_definir_concepts() (20260924061000), réponse LUE : un refus fait
--  échouer la migration au lieu de passer au vert sans rien écrire.
--
--  Rejouable sans risque : réécrire les concepts est libre, aucune réponse
--  d'élève n'y est attachée.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 5;
  if v_id is null then
    raise exception 'BTS1-DEV-2026 : pas de séance 5 en base';
  end if;
  v_r := public.migration_definir_concepts(v_id, concat_ws(E'\\n',
@@CONCEPTS@@));
  if not coalesce((v_r->>'ok')::boolean, false) then
    raise exception 'concepts de la séance 5 non écrits : %', v_r;
  end if;
end $$;
""".replace('@@CONCEPTS@@', ",\n".join("      " + s(x) for x in CONCEPTS))

pas, nactes = passages_sql()
C = (open(os.path.join(ICI, 'tpl_passages.sql'), encoding='utf-8').read()
       .replace('@@PASSAGES@@', pas).replace('@@NACTES@@', str(nactes)))

for nom, texte in zip(SORTIES, (A, B, C)):
    open(os.path.join(MIG, nom), 'w', encoding='utf-8', newline='\n').write(texte)
print('ok', lettres, dict(c), 'plus longue juste :', longue, '/ 10')
