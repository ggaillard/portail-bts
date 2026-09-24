# ─── Séance 4, deuxième version : l'arrivée des bases vectorielles (25/09) ──
#
# Les migrations produites par generer.py (060000, 061000, 071000) sont DÉJÀ
# APPLIQUÉES en production : elles ne se réécrivent pas. Ce script produit les
# trois migrations qui les mettent à jour, depuis une seule liste :
#
#   cd portail-bts
#   python3 outils/seances/seance04/vectoriel.py
#
# Il lit les durées d'actes dans la trace (le dépôt des supports est attendu à
# côté de portail-bts, sous « BTS1 S1 B1 DEV » ou « BTS1_S1_B1_DEV »).
import os, re, sys
from collections import Counter

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..', '..', '..'))
MIG = os.path.join(RACINE, 'supabase', 'migrations')
SORTIES = ('20260925060000_bts1_seance4_vectoriel.sql',
           '20260925061000_bts1_seance4_vectoriel_debriefing.sql',
           '20260925062000_bts1_seance4_vectoriel_passages.sql')

def trace():
    for nom in ('BTS1 S1 B1 DEV', 'BTS1_S1_B1_DEV', 'sup'):
        p = os.path.join(RACINE, '..', nom, 'docs', 'seances', 'seance-04.md')
        if os.path.exists(p):
            return p
    sys.exit('trace de la séance 4 introuvable à côté de portail-bts')

# Les options sont recopiées de la page, lettre pour lettre ; les intitulés sont
# interrogatifs, lisibles seuls au tableau. `coherence` compare les deux.
Q = [
 (1,'B',"Dans un cycle en cascade, quand découvre-t-on le plus souvent qu'on s'est trompé de besoin ?",
  ["au moment d'écrire le cahier des charges avec le client","à la fin, quand le client voit enfin le produit","à chaque itération de deux semaines","dès la première ligne de code écrite"],
  "Le client voit le produit à la fin. Une erreur de besoin commise au début se découvre quand tout est déjà construit."),
 (2,'A',"Que cherche une méthode agile ?",
  ["livrer souvent, par petits morceaux, pour corriger tôt","livrer une seule fois, quand tout est entièrement terminé","suivre un plan fixé d'avance sans jamais le modifier","supprimer les réunions avec le client pour aller plus vite"],
  "De petites itérations montrées au client : une erreur de besoin coûte deux semaines, pas un an."),
 (3,'C',"Quels sont les trois gestes de la culture DevOps vus dans cette séance ?",
  ["coder, tester, documenter","planifier, livrer, facturer","automatiser, mesurer, collaborer","sécuriser, chiffrer, sauvegarder chaque soir"],
  "Automatiser ce qui se répète, mesurer ce qui tourne, collaborer autour d'une source unique du code."),
 (4,'B',"Qu'est-ce qu'un commit ?",
  ["une copie du dossier envoyée par courriel à l'équipe","un instantané du projet, avec un auteur, une date et un message","une sauvegarde automatique du poste faite chaque nuit","un fichier renommé « version finale » dans le dossier partagé"],
  "Un instantané identifié, daté, signé et expliqué. Fini les fichiers « final_VRAI »."),
 (5,'D',"À quoi sert une pull request ?",
  ["copier le dépôt d'un autre sur son propre poste","supprimer une branche devenue inutile","envoyer le code directement en production, sans passer par main","faire relire des changements avant de les fusionner"],
  "Une demande de fusion, relue et discutée avant d'être acceptée. La décision reste écrite dans l'histoire."),
 (6,'C',"Thomas avait fait un commit de sa correction, et pourtant la production ne l'avait pas. Pourquoi ?",
  ["la production refuse tout commit fait le lundi","Git avait effacé la correction pendant la nuit","le commit était resté sur son poste, jamais poussé","la correction contenait elle-même une erreur de calcul"],
  "Un commit reste sur la machine où il est né tant qu'un push ne l'envoie pas au dépôt partagé."),
 (7,'A',"Pour annuler un commit déjà partagé sans réécrire l'historique, on :",
  ["crée un nouveau commit qui défait le précédent","supprime le dépôt et on le recrée depuis zéro","modifie le fichier directement sur le serveur","demande à chacun d'effacer sa copie locale du dépôt"],
  "C'est git revert : on ajoute un commit qui défait, et l'on sait aussi qui est revenu en arrière, et pourquoi."),
 (8,'B',"Pourquoi une base de données vectorielle retrouve-t-elle un document ?",
  ["il contient exactement les mêmes mots que la question","son vecteur est proche de celui de la question","il a été ajouté le plus récemment dans la base","son identifiant est égal à celui qu'on demande"],
  "Elle compare des sens, pas des mots : deux textes qui veulent dire la même chose donnent des vecteurs proches."),
 (9,'D',"On change de modèle d'embedding. Que faut-il faire de l'index vectoriel ?",
  ["ne rien faire, les anciens vecteurs restent valables","recalculer seulement les documents ajoutés depuis","supprimer les documents les plus anciens de la base","recalculer tous les vecteurs avec le nouveau modèle"],
  "Deux modèles ne donnent pas les mêmes nombres : des vecteurs mélangés donnent des résultats absurdes, sans erreur visible."),
 (10,'D',"Pourquoi « ça marche sur mon poste » ne prouve-t-il rien ?",
  ["parce que les postes des développeurs sont moins puissants que les serveurs","parce que Git ne fonctionne que sur un serveur","parce que les tests sont toujours faux sur un poste","parce que la production ne tourne pas avec ce qui est sur le poste"],
  "La production tourne avec ce qui est dans main. Ce qui n'a pas quitté le poste n'existe pour personne d'autre."),
]
CONCEPTS = [
 "Les cycles de vie — la cascade découvre ses erreurs à la fin, le V met un test en face de chaque étape, l'agile livre souvent pour corriger tôt. [1 2]",
 "La culture DevOps — automatiser, mesurer, collaborer : abattre le mur entre ceux qui écrivent le code et ceux qui le font tourner. [3 10]",
 "Le commit — un instantané daté, signé et expliqué, qui reste sur le poste tant qu'on ne l'a pas poussé. [4 6 10]",
 "Branche, pull request, retour en arrière — on travaille à côté, on fait relire, on fusionne ; un nouveau commit défait le précédent sans effacer l'histoire. [5 7]",
 "Une base vectorielle — elle compare des sens, pas des mots ; son index est fabriqué par un modèle, daté, et se versionne avec lui. [8 9]",
]
# Trois minutes d'accueil (appel, humeur, cold open) : l'heure fait 55 min, les
# actes 42, le quiz garde ainsi ses dix minutes. La première version comptait
# sept minutes d'accueil pour 48 d'actes — le quiz n'avait plus de temps du tout.
ACCUEIL_MIN = 3
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
 4: ('B', "Léa demande « le nouveau site » ; l'assistant trouve « Refonte du site ». Sur quoi s'appuie-t-il ?",
     ["sur les mots communs aux deux textes", "sur la proximité de leurs vecteurs",
      "sur l'identifiant du projet 42", "sur la date du document"],
     "Les deux textes n'ont presque aucun mot en commun, mais le même sens : leurs vecteurs sont proches."),
 5: None,   # « Ouvrez le capot » : deux minutes d'observation, rien à corriger.
}

def s(x): return "'" + x.replace("'", "''") + "'"
def arr(o): return "array[" + ", ".join(s(x) for x in o) + "]"

c = Counter(b for _, b, *_ in Q)
assert max(c.values()) <= 3, c
t = open(trace(), encoding='utf-8').read()
actes = [(m.group(1).strip(), int(m.group(2))) for m in
         re.finditer(r'^##\s+\S+\s+ACTE\s+[IVX]+\s+—\s+(.*?)\s+\*\(≈\s*(\d+)\s*min\)\*', t, re.M)]
assert len(actes) == len(PASSAGES), actes

ENTETE = '''-- ═══════════════════════════════════════════════════════════════════════════
--  SÉANCE 4 DU BTS1 — l'arrivée des bases vectorielles (25/09/2026)
--
--  Produit par outils/seances/seance04/vectoriel.py. %s
--
--  La séance 4 n'a pas encore été jouée : ses migrations d'origine (060000,
--  061000, 071000) sont appliquées, mais personne n'y a répondu. On les met à
--  jour ici — une migration appliquée ne se réécrit pas — et CHAQUE écriture
--  refuse de toucher à ce que des étudiants auraient déjà répondu.
--
--  Rejouable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════
'''

# ── 1. Les dix corrigés ────────────────────────────────────────────────────
lignes = ",\n\n".join("  (4, %s, %s,\n   %s,\n   %s,\n   %s)" % (s('q%d' % n), s(b), s(i), arr(o), s(e))
                      for n, b, i, o, e in Q)
A = (ENTETE % ("Les dix corrigés, réordonnés : la cascade, l'agile,\n--  DevOps, commit, pull request, push, revert, puis deux questions sur la\n--  base vectorielle, et le retournement.\n--\n--  Bonnes réponses : " + ' '.join(b for _, b, *_ in Q) + " — deux A, trois B, deux C, trois D.")) + '''
update public.seances s
   set titre = 'Séance 4 - Ça marche sur mon poste : versionner le code et l''index'
  from public.classes c
 where c.id = s.classe_id and c.code = 'BTS1-DEV-2026' and s.numero = 4
   and not exists (select 1 from public.reponses r where r.seance_id = s.id);

with q (numero, cle, bonne, intitule, options, explication) as (values

''' + lignes + '''

)
update public.corriges co
   set bonne_reponse = q.bonne, intitule = q.intitule,
       options = q.options, explication = q.explication
  from q, public.classes c, public.seances s
 where c.code = 'BTS1-DEV-2026' and s.classe_id = c.id and s.numero = q.numero
   and co.seance_id = s.id and co.question = q.cle
   -- La règle du 16/09 : on ne réécrit jamais après coup ce que des
   -- étudiants ont répondu. Une seule réponse au quiz, et rien ne bouge.
   and not exists (select 1 from public.reponses r
                    where r.seance_id = s.id and r.question ~ '^q[0-9]+$');

do $$
declare n int; v_rep int;
begin
  select count(*) into v_rep from public.reponses r
    join public.seances s on s.id = r.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4 and r.question ~ '^q[0-9]+$';
  if v_rep > 0 then
    raise notice 'Séance 4 : % réponse(s) au quiz, les corrigés n''ont PAS été réécrits.', v_rep;
    return;
  end if;
  select count(*) into n from public.corriges co
    join public.seances s on s.id = co.seance_id
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4
     and co.question = 'q8' and co.intitule like '%vectorielle%';
  if n <> 1 and exists (select 1 from public.seances s join public.classes c on c.id = s.classe_id
                         where c.code = 'BTS1-DEV-2026' and s.numero = 4) then
    raise exception 'séance 4 : la question 8 n''a pas été réécrite';
  end if;
end $$;
'''

# ── 2. Les concepts ────────────────────────────────────────────────────────
B = (ENTETE % "Les cinq concepts : le cinquième est la base\n--  vectorielle. Écrits par migration_definir_concepts(), réponse LUE.") + '''
do $$
declare v_id bigint; v_r jsonb;
begin
  select s.id into v_id from public.seances s
    join public.classes c on c.id = s.classe_id
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  if v_id is not null then
    v_r := public.migration_definir_concepts(v_id, concat_ws(E'\\n',
''' + ",\n".join("      " + s(x) for x in CONCEPTS) + '''));
    if not coalesce((v_r->>'ok')::boolean, false) then
      raise exception 'concepts de la séance 4 non écrits : %', v_r;
    end if;
  end if;
end $$;
'''

# ── 3. Les points de passage ───────────────────────────────────────────────
pl, fin = [], ACCUEIL_MIN
for i, (titre, duree) in enumerate(actes, 1):
    fin += duree
    p = PASSAGES[i]
    if p:
        b, it, o, e = p
        pl.append("    (%d, %s, %d, %s, %s, %s, %s)" % (i, s(titre.capitalize()), fin, s(it), arr(o), s(b), s(e)))
    else:
        pl.append("    (%d, %s, %d, null::text, null::text[], null::text, null::text)" % (i, s(titre.capitalize()), fin))
C = (ENTETE % ("Cinq points de passage, un par acte ; l'acte IV\n--  est la base vectorielle. Fin d'acte = %d min d'accueil + les durées de la\n--  trace ; le dernier acte finit à la %de minute, le quiz garde le reste." % (ACCUEIL_MIN, fin))) + '''
with p (acte, titre, fin_min, intitule, options, bonne, explication) as (values
''' + ",\n".join(pl) + '''
)
insert into public.points_passage (seance_id, acte, titre, fin_min, intitule, options, bonne, explication)
select s.id, p.acte, p.titre, p.fin_min, p.intitule, p.options, p.bonne, p.explication
  from p
  join public.classes c on c.code = 'BTS1-DEV-2026'
  join public.seances s on s.classe_id = c.id and s.numero = 4
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
   where c.code = 'BTS1-DEV-2026' and s.numero = 4;
  if n not in (0, %d) then raise exception 'séance 4 : %% point(s) de passage, attendu %d', n; end if;
end $$;
''' % (len(actes), len(actes))

for nom, txt in zip(SORTIES, (A, B, C)):
    open(os.path.join(MIG, nom), 'w', encoding='utf-8').write(txt)
print('ok', ' '.join(b for _, b, *_ in Q), dict(c), 'fin des actes :', fin)
