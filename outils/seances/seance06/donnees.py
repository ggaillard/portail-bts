# ─── Séance 6 du BTS1 — « Rouge, puis vert » : la SEULE source des questions ─
#
# Réécrit le 14/11/2026 au format de la séance 5 telle qu'elle est en
# production (questions au fil `!!! fil`, points de passage par acte, quiz
# q1…q10 dans « Réviser »), à partir de la version du 19/10 restée sur la
# branche seance6-suivi. L'histoire est raccordée à « Mardi, 17 h 52 ».
#
# generer.py écrit les migrations ET les blocs de la trace depuis ces listes :
# la page et la base ne peuvent pas diverger.

N = 6

# Le quiz — dix questions. Bonnes réponses : C B D D A C A B C B
# (2 A, 3 B, 3 C, 2 D) : un autre motif que la séance 5.
Q = [
 (1,'C',"Pourquoi créer votre dépôt depuis le modèle plutôt que travailler dans celui de l'enseignant ?",
  ["pour ne pas avoir à écrire de message de commit","parce que le dépôt modèle interdit de lire ses fichiers sans compte","pour avoir votre propre historique et votre propre pipeline","pour que vos commits partent dans le dépôt de l'enseignant"],
  "Même départ pour tous, mais un historique, des commits et un pipeline à soi. Le modèle ne bouge pas."),
 (2,'B',"Dans votre fichier de workflow, quel bloc dit QUAND le pipeline se lance ?",
  ["le bloc steps, avec la liste des étapes","le bloc on, avec push et pull_request","la ligne runs-on, avec la machine","la ligne name, avec le titre du pipeline"],
  "on dit quand ; runs-on, sur quelle machine ; steps, quoi et dans quel ordre."),
 (3,'D',"Pourquoi le pipeline installe-t-il les dépendances à chaque exécution ?",
  ["parce que pytest change de version à chaque commit","parce que GitHub efface votre dépôt après chaque test","parce que l'installation rend le code plus rapide","parce que la machine est neuve et ne contient que le dépôt"],
  "Chaque exécution part d'une machine neuve : ce qui n'est pas déclaré dans le dépôt n'existe pas pour elle. C'est la leçon de mardi, 17 h 52."),
 (4,'D',"Votre premier pipeline porte une croix rouge. Qu'est-ce que cela veut dire ?",
  ["que GitHub a rencontré une panne sur ses serveurs","que le fichier de workflow contient une faute de frappe","que le dépôt doit être supprimé puis recréé","qu'une étape a échoué et que la suite n'a pas été lancée"],
  "Rouge veut dire stop : l'étape qui échoue arrête la chaîne. C'est une information, pas une panne."),
 (5,'A',"Dans une ligne « assert X == Y » d'un journal de tests, que représente X ?",
  ["ce que la fonction a calculé pour les tâches du test","ce que le test attendait comme résultat pour ces tâches-là","le numéro de la ligne où se trouve l'erreur","le temps mis par le pipeline, en secondes"],
  "À gauche ce que le code a obtenu, à droite ce que le test attendait. L'écart dit où chercher."),
 (6,'C',"Le test attend 75 % pour trois tâches faites, une annulée et une à faire. Quelle règle exprime-t-il ?",
  ["une tâche annulée compte comme une tâche faite, pour encourager","un projet n'atteint jamais cent pour cent","les tâches annulées ne comptent pas dans le calcul","le résultat est toujours arrondi à la dizaine"],
  "3 faites sur 4 qui comptent : l'annulée est mise de côté. C'est la règle écrite dans le commentaire de la fonction."),
 (7,'A',"Où le pipeline a-t-il tourné quand vous avez proposé la correction ?",
  ["sur votre branche, avant toute fusion","sur votre poste, avant l'envoi","sur main uniquement, une fois la correction fusionnée","sur le dépôt modèle de l'enseignant"],
  "Le pull_request du bloc on lance le pipeline sur la branche proposée : la coche verte arrive avant la fusion."),
 (8,'B',"Pourquoi passer par une pull request plutôt que modifier main directement ?",
  ["parce que GitHub ne permet pas de modifier main","pour voir la coche verte avant que la correction n'entre dans main","pour que la correction soit faite par une autre personne","parce qu'une pull request lance les tests plus vite"],
  "On ne fusionne que du vert : la pull request montre le résultat du pipeline avant que la correction ne touche main."),
 (9,'C',"Thomas rend le pipeline vert en remplaçant 75 par 60 dans le test. Que faire en relecture ?",
  ["fusionner, puisque le pipeline est vert","relancer le pipeline pour vérifier qu'il reste vert","refuser : il a changé la règle au lieu de corriger le code","supprimer le test, qui gênait depuis trois semaines"],
  "Le vert ne prouve que ce que les tests vérifient. Modifier un test, c'est changer la règle : cela se discute, cela ne se fait pas pour faire taire une croix rouge."),
 (10,'B',"Au fond, qu'avez-vous construit aujourd'hui ?",
  ["un programme qui trouve et corrige tout seul les erreurs dans le code","une machine qui vérifie chaque changement à partir du dépôt seul","une sauvegarde automatique du dépôt chaque nuit","un rapport que la direction remplit elle-même"],
  "Le pipeline ne corrige rien : il vérifie, à chaque changement, depuis le dépôt seul. Corriger reste votre travail."),
]

# Le contrôle d'entrée : les cinq concepts de la séance 5, DANS LEUR ORDRE
# (déployer à la main, pipeline, tests, conteneur, workflow).
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

# Les questions au fil de l'heure : (clé, bonne, énoncé, options, explication,
# texte de la trace AVANT lequel le bloc s'insère). Elles portent sur ce que
# l'étudiant a SOUS LES YEUX dans son dépôt. 1 A·2 B·1 C… au plus 2 par lettre.
FIL = [
 ('f01', 'C', "Dans la troisième règle du fichier de tests, combien de tâches comptent dans le calcul ?",
  ["5", "3", "4", "1"],
  "Cinq tâches, dont une annulée mise de côté : il en reste quatre qui comptent, dont trois faites.",
  "> 🔑 **Un dépôt à soi, créé depuis un modèle**"),
 ('f02', 'D', "Quelle ligne de votre fichier fait tourner le pipeline aussi sur une correction proposée ?",
  ["la ligne runs-on", "la ligne run: pytest", "la ligne uses: actions/checkout", "la ligne pull_request"],
  "pull_request, dans le bloc on : le pipeline tourne sur la branche proposée, avant toute fusion.",
  "> 🔑 **Le fichier de workflow**"),
 ('f03', 'B', "Une étape est rouge. Qu'arrive-t-il à l'étape « Calculer l'avancement de la refonte » ?",
  ["elle tourne quand même", "elle n'est pas lancée", "elle affiche 0 %", "elle est relancée jusqu'au vert"],
  "Au premier rouge, la chaîne s'arrête : ce qui suit est grisé, pas lancé.",
  "## 🔴 ACTE III — LIRE LA CROIX ROUGE"),
 ('f04', 'A', "Dans la ligne AssertionError, le nombre à droite de == est :",
  ["ce que le test attendait", "ce que le code a calculé", "le nombre de tests passés", "la durée de l'étape, en secondes"],
  "À droite, l'attendu (75) ; à gauche, ce que le code a obtenu (60).",
  "Maintenant, le code. Ouvrez `devsecure/avancement.py`"),
 ('f05', 'D', "Sur les cinq tâches du test, par combien la dernière ligne du code divise-t-elle ?",
  ["3", "4", "1", "5"],
  "len(taches) compte les cinq tâches, l'annulée comprise : 3 sur 5, soit 60.",
  "> 🔑 **Lire une croix rouge**"),
 ('f06', 'B', "Avant de fusionner, où voyez-vous que votre correction passe les tests ?",
  ["dans le dossier tests", "au bas de la pull request, la coche verte", "dans le README du dépôt", "dans le dépôt modèle de l'enseignant"],
  "« All checks have passed » : le pipeline a tourné sur votre branche, la coche verte est sous la pull request.",
  "5. **Merge pull request**"),
 ('f07', 'A', "Après la fusion, pourquoi le pipeline repart-il sur main ?",
  ["parce que la fusion est un push sur main", "parce que GitHub relance tout chaque heure",
   "parce que le test a changé", "parce que la pull request a été fermée"],
  "Une fusion ajoute un commit à main : c'est un push, et le bloc on le déclenche.",
  "### 🧪 Indice n° 2 — et si Thomas modifiait le test ?"),
]
