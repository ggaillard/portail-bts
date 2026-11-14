# ─── Séance 7 du BTS1 — « Tous les tests étaient verts » : la SEULE source ──
#
# Écrit le 14/11/2026. La séance 6 (atelier pipeline) étant reportée au S2
# pour les SLAM, la 7 suit directement la 5 : son contrôle d'entrée porte sur
# les cinq concepts de la séance 5. generer.py écrit les migrations ET
# insère les blocs (quiz, questions au fil) dans la trace depuis ces listes.

N = 7

# Le quiz. Bonnes réponses : B D A C A B D C A D (3 A, 2 B, 2 C, 3 D).
Q = [
 (1,'B',"Quelle est la vulnérabilité dans l'histoire de mercredi ?",
  ["la personne qui a tapé la phrase piégée","le champ de recherche qui colle la saisie dans la requête","la liste de tous les clients, affichée d'un coup sur l'écran de Sami","le serveur qui héberge le site de DevSecure"],
  "La vulnérabilité est le défaut : la saisie collée telle quelle dans la requête. La personne est la menace, la fuite des clients l'impact."),
 (2,'D',"Une faille très facile à exploiter, mais qui ne donne accès à rien d'important, a un risque :",
  ["maximal, puisqu'elle est très facile à exploiter","nul, puisqu'elle ne donne accès à rien","impossible à estimer sans une attaque réelle","moyen : forte vraisemblance, faible impact"],
  "Risque = vraisemblance × impact : 3 × 1 = 3, la case « moyen » de la matrice. On ne la néglige pas, on ne la traite pas en premier."),
 (3,'A',"Qu'est-ce qu'une menace ?",
  ["ce qui peut exploiter une faille : une personne, un programme","le défaut présent dans le code, que personne n'a encore remarqué","la perte subie si la faille est exploitée","le correctif appliqué après l'attaque"],
  "La menace agit, la vulnérabilité laisse faire, l'impact est ce qu'on perd. Sans vulnérabilité, la menace ne peut rien."),
 (4,'C',"Pourquoi la saisie « ' OR '1'='1 » renvoie-t-elle tous les projets ?",
  ["parce que la base de données est tombée en panne","parce que le mot OR est interdit dans une recherche","parce que la saisie devient une condition toujours vraie dans la requête","parce que le site affiche tout quand il ne trouve rien"],
  "L'apostrophe ferme le texte prévu ; la suite est lue comme du SQL. '1'='1' est toujours vrai : chaque ligne passe le filtre."),
 (5,'A',"Quelle est la parade à l'injection SQL ?",
  ["la requête paramétrée, qui envoie la saisie à part, comme une donnée","interdire les apostrophes et les guillemets dans tous les champs du site","cacher le champ de recherche aux visiteurs","afficher un message d'erreur moins détaillé"],
  "Avec une requête paramétrée, la saisie n'est jamais lue comme du code : on cherche le texte tel quel. Interdire des caractères casse les noms comme O'Brien et se contourne."),
 (6,'B',"En changeant id=42 en id=43 dans l'adresse, Sami lit le rapport d'un autre client. Quelle est la faille ?",
  ["une injection SQL dans l'adresse","un contrôle d'accès absent sur le serveur","une bibliothèque vulnérable","un mot de passe trop court"],
  "Le serveur rend le rapport demandé sans vérifier que l'on a le droit de le lire. L'OWASP range ce défaut en tête de sa liste (A01)."),
 (7,'D',"Qu'est-ce qu'une attaque CSRF ?",
  ["un mot de passe deviné par essais successifs","un script glissé dans un commentaire, qui s'exécute chez chaque lecteur","une requête SQL modifiée par la saisie","une action déclenchée depuis un autre site, avec votre session ouverte"],
  "Le navigateur envoie votre session avec la requête, même si elle part d'une autre page. La parade : un jeton propre à chaque formulaire, que l'autre site ne connaît pas."),
 (8,'C',"Log4Shell (2021) : pourquoi des milliers d'entreprises ont-elles été touchées sans avoir écrit le code fautif ?",
  ["parce qu'elles n'avaient aucun pare-feu","parce que leurs mots de passe étaient trop courts","parce qu'elles utilisaient une bibliothèque qui contenait la faille","parce que leurs serveurs étaient trop anciens"],
  "La faille était dans Log4j, une bibliothèque utilisée partout. Une faille qu'on n'a pas écrite reste notre faille : c'est la chaîne d'approvisionnement logicielle (A03)."),
 (9,'A',"Pourquoi tous les tests étaient-ils verts mercredi ?",
  ["ils vérifiaient ce que le site doit faire, pas ce qu'un attaquant tente","le pipeline avait été désactivé ce jour-là","les tests de sécurité ne peuvent pas tourner dans un pipeline automatique","Sami avait relancé les tests jusqu'à ce qu'ils passent"],
  "Un test ne vérifie que ce qu'on a pensé à vérifier. « refonte rend 3 projets » était vrai ; personne n'avait écrit « une saisie piégée ne rend rien »."),
 (10,'D',"Que veut dire « sécurisé dès la conception » ?",
  ["ajouter un antivirus sur le serveur avant la mise en production","faire vérifier le site par un expert une fois par an","chiffrer toutes les pages du site","penser l'attaque en même temps que la fonction, et la tester comme elle"],
  "Pour chaque saisie : et si on tape autre chose que prévu ? Pour chaque identifiant : qui a le droit ? Les réponses deviennent des tests, que le pipeline relance."),
]

# Le contrôle d'entrée : les cinq concepts de la séance 5, DANS LEUR ORDRE.
PRE = [
 ('pre-01','A',"Mardi à 17 h 44, Noah a sauté trois lignes de sa check-list. Quelle leçon en tire-t-on ?",
  ["Ce qui se répète doit être fait par une machine","Il faut une check-list plus longue","Il faut mettre en production le matin","Il faut deux personnes pour lire la check-list"],
  "La check-list était bonne ; c'est la mémoire humaine qui lâche à 17 h 44. Une machine, elle, refait les mêmes gestes à chaque fois."),
 ('pre-02','D',"Dans un pipeline, une étape échoue. Que deviennent les suivantes ?",
  ["Elles se lancent avec un avertissement","Elles se lancent si quelqu'un confirme","Elles sont rejouées jusqu'à devenir vertes","Elles ne sont pas lancées"],
  "Au premier rouge, la chaîne s'arrête : rien n'arrive en production."),
 ('pre-03','A',"Quel test vérifie une seule fonction, isolée, en quelques millisecondes ?",
  ["Le test unitaire","Le test de bout en bout","Le test d'intégration","Le test en préproduction"],
  "Unitaire : une fonction, rien autour. Beaucoup de petits tests rapides, quelques grands tests lents."),
 ('pre-04','C',"Quelle est la différence entre une image et un conteneur ?",
  ["Aucune, ce sont deux noms pour la même chose","L'image tourne sur le poste, le conteneur en production","L'image est le modèle figé, le conteneur l'image en marche","L'image est une archive, le conteneur une capture d'écran"],
  "Le colis plombé et le colis au travail : une image numérotée, autant de conteneurs qu'on veut."),
 ('pre-05','B',"Dans le workflow de l'équipe de Noah, que veut dire « needs: tester » sous le travail livrer ?",
  ["tester attend que livrer soit terminé","livrer ne démarre que si tester est vert","un testeur humain doit valider avant de livrer","livrer et tester tournent en même temps"],
  "needs règle l'ordre : livrer attend tester, et ne part que si tout y est vert."),
]

CONCEPTS = [
 "Vulnérabilité, menace, risque — le défaut, ce qui peut l'exploiter, et ce qu'on y perd ; risque = vraisemblance × impact. [1 2 3]",
 "L'injection — une saisie collée dans une requête devient du code ; la parade est la requête paramétrée. [4 5]",
 "Le contrôle d'accès — IDOR et CSRF : c'est au serveur de vérifier, à chaque demande, que la personne a le droit. [6 7]",
 "Le Top 10 OWASP — dix familles de risques, une langue commune ; une bibliothèque vulnérable est une faille qu'on n'a pas écrite. [8]",
 "Sécurisé dès la conception — un test ne vérifie que ce qu'on a pensé à vérifier : on écrit aussi les tests de l'attaque. [9 10]",
]

ACCUEIL_MIN = 3
PASSAGES = {
 1: ('B', "Dans la matrice de l'acte I, un risque de vraisemblance 2 et d'impact 3 vaut :",
     ["3", "6", "5", "9"],
     "2 × 3 = 6 : la case « élevé ». À traiter avant les risques moyens."),
 2: ('C', "Quel caractère de la saisie a « fermé » le texte prévu dans la requête de mercredi ?",
     ["le signe égal", "le mot OR", "l'apostrophe", "le chiffre 1"],
     "L'apostrophe referme le texte que le code avait ouvert : tout ce qui suit est lu comme du SQL."),
 3: ('D', "Un étudiant change id=12 en id=13 dans l'adresse de son bulletin et lit celui d'un camarade. Quelle famille OWASP ?",
     ["l'injection", "les défaillances cryptographiques", "la chaîne d'approvisionnement logicielle", "le contrôle d'accès"],
     "Le serveur ne vérifie pas qui demande : contrôle d'accès défaillant, A01, en tête du Top 10."),
 4: ('A', "Quel test aurait viré au rouge mercredi, avant la mise en production ?",
     ["la recherche « ' OR '1'='1 » ne rend aucun projet", "la recherche « refonte » rend trois projets",
      "la page d'accueil s'affiche", "le rapport 42 s'ouvre pour son propre client"],
     "Le seul test qui joue l'attaque. Les trois autres étaient déjà verts, et le sont restés."),
 5: None,   # « Ouvrez le capot » : deux minutes sur le site de l'OWASP.
}

# Les questions au fil de l'heure — au plus 2 par lettre.
# (clé, bonne, énoncé, options, explication, marqueur de la trace)
FIL = [
 ('f01', 'C', "Le champ de recherche colle la saisie telle quelle dans la requête. C'est :",
  ["une menace", "un impact", "une vulnérabilité", "un risque"],
  "C'est le défaut du code : la vulnérabilité. La personne qui en profite est la menace.", "<<FIL1>>"),
 ('f02', 'A', "Vraisemblance 3, impact 3 : où se place ce risque dans la matrice ?",
  ["élevé", "moyen", "faible", "hors de la matrice"],
  "3 × 3 = 9, la case la plus haute : à traiter en premier.", "<<FIL2>>"),
 ('f03', 'D', "Avec la saisie « refonte », combien de projets la recherche rend-elle, d'après le journal ?",
  ["aucun", "2 314", "un seul", "trois"],
  "Trois résultats à 10 h 31 min 07 : la recherche fait son travail. C'est la saisie suivante qui pose problème.", "<<FIL3>>"),
 ('f04', 'B', "Dans la requête paramétrée, que devient la saisie « ' OR '1'='1 » ?",
  ["une condition toujours vraie", "un simple texte, cherché tel quel", "une erreur qui arrête le site", "une requête supprimée par la base"],
  "Elle est envoyée à part, comme une donnée : la base cherche un mot-clé qui s'écrirait ainsi, et n'en trouve aucun.", "<<FIL4>>"),
 ('f05', 'A', "Qui doit vérifier que l'utilisateur a le droit de lire le rapport 43 ?",
  ["le serveur, à chaque demande", "le navigateur de l'utilisateur", "l'utilisateur lui-même", "personne : l'adresse est difficile à deviner"],
  "Le navigateur et l'adresse sont entre les mains de l'utilisateur : seul le serveur peut refuser.", "<<FIL5>>"),
 ('f06', 'C', "Un commentaire contient un script qui s'exécute chez chaque lecteur. Dans quelle famille l'OWASP le range-t-il ?",
  ["le contrôle d'accès", "la chaîne d'approvisionnement logicielle", "l'injection", "les défaillances cryptographiques"],
  "Le XSS est une injection : du code glissé dans une donnée, exécuté cette fois dans la page du lecteur.", "<<FIL6>>"),
 ('f07', 'D', "Le test de l'attaque est écrit dans le dépôt. Quand sera-t-il relancé ?",
  ["une fois par an, lors de l'audit", "seulement si Sami y pense", "jamais : un test ne tourne qu'une fois", "à chaque push, avec les autres tests"],
  "C'est le pipeline de la séance 5 : chaque push relance tous les tests, ceux de l'attaque compris.", "<<FIL7>>"),
]

# Le commentaire de la grille de révision, par tranche de score.
GRILLE = """    - **8 à 10** — Vous savez nommer une faille, la mesurer et écrire le test qui
      l'arrête. En séance 8, vous passerez tout un site au crible.
    - **5 à 7** — Les trois mots se mélangent encore. Reprenez le tableau de l'acte I :
      le défaut, ce qui l'exploite, ce qu'on y perd.
    - **0 à 4** — Retenez **deux** choses : une saisie collée dans une requête devient
      du code, et la requête paramétrée l'en empêche ; c'est au serveur, pas au
      navigateur, de vérifier qui a le droit.
"""
