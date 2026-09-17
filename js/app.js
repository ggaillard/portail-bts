// ── Le portail — tout le script, en un module ─────────────────────────────
//
// Sorti de index.html le 16/09/2026 (étape A3 de REFONTE.md). Le contenu n'a
// pas changé d'une ligne : c'est le point de l'étape. Ce qui change est la
// façon dont le navigateur le charge, et cette étape-là se publie et se
// vérifie en production AVANT qu'une seule fonction ne soit déplacée.
//
// Trois choses à savoir, toutes vérifiées avant d'écrire ce fichier :
//
//   · un module est différé : il s'exécute après l'analyse du document, donc
//     après config.js et après le client Supabase, qui sont des scripts
//     classiques. `window.TDC_CONFIG` et `window.supabase` sont là quand ces
//     lignes s'exécutent, exactement comme avant ;
//
//   · un module a sa propre portée : plus rien ne fuit vers `window`. La
//     fermeture (function(){ … })() ci-dessous fait donc double emploi, et
//     elle reste quand même — elle est l'ancre que outils/portail.mjs utilise
//     pour exposer les fonctions internes aux contrôles, et la retirer
//     rendrait les trois contrôles muets sans les faire échouer ;
//
//   · un module ne se charge PAS depuis file://. Ouvrir index.html par
//     double-clic ne marche plus : « Access to script … has been blocked by
//     CORS policy ». En local, `node outils/serveur.mjs` puis
//     http://127.0.0.1:8080, ou l'extension Live Server de VS Code. C'est le
//     seul coût de ce découpage, et il était mesuré avant d'être accepté.
//
// La suite du chantier sortira d'ici un module par sujet. Tant que ce fichier
// est seul, il dépasse le plafond de 400 lignes du §6.1 de REFONTE.md, et
// outils/mesurer.mjs le dit : c'est voulu, c'est la marche du milieu.

import { CFG, $, sb, probleme, suivi, erreur, montrer, typo, anime, entree,
         pousse, son, SONS, NOMS_CLE, estDemo, classesReelles,
         etapes, majFile, marquerEtape, motifEnvoi, texteEnvoi,
         signalerSessionPerimee, pastilles, pastilleAppel, copierTexte,
         dateCourte, lireNoms, enregistrerNoms, nomDe, prenomSeul,
         codeClasseCourante } from './socle.js';
import { brancherEcran, modeEcran, rendreEcran, rotationAuto,
         fermerEcran, minuteur } from './ecran.js';
import { ONGLETS, ouvrirOnglet, ongletDeLAdresse } from './navigation.js';
import { brancherBibliotheque, BIB, chargerQuestionnaires,
         chargerQuestionsSeance, rendreBibliotheque } from './bibliotheque.js';
import { chargerQuestionnairesEtu, rendreQuestionnairesEtu,
         rendreRevision } from './quiz.js';
import { carte, afficherProjets, rendreProjet, rendreProjetsParClasse,
         chargerSemestre, rendreSemestre } from './ensemble.js';
import { chargerAppelToutesClasses, proposerAppel, proposerHumeur,
         ligneAbsents, numerosAbsents, copierAbsents } from './appel.js';
import { chargerConnaissance, chargerStage,
         remplirConnaissanceClasse } from './enquetes.js';
import { brancherControle, chargerControles, chargerControle,
         chargerControlesEtu, motItems, rendreControles,
         ligneControle } from './controle.js';
import { brancherSeance, chargerSeancesDe, activerSeance, rafraichir,
         arreterBoucle, rafraichirApresActe, chargerStats, rendreSuivi,
         allerAuControle, rendreRythme, pilotage } from './seance.js';
import { chargerParcours, rendreParcours, chargerDebrief,
         enregistrerConcepts } from './heure.js';
import { chargerAFaire, rendreAFaire } from './afaire.js';

(function(){
"use strict";

// Le socle a déjà lu la configuration et ouvert le client. S'il n'a pas pu,
// il le dit, et le portail s'arrête là plutôt que d'afficher une coquille.
if (probleme) {
  $("chargement").textContent = probleme;
  return;
}


// ── Rendu des cartes projet ────────────────────────────────────────────────


// ── Appel — la question du jour ────────────────────────────────────────────
// L'appel n'est pas un mécanisme à part : c'est la séance numéro 0 de la
// classe, avec une question par date. Y répondre, c'est être présent, et la
// réponse suit le même chemin que toutes les autres — donc le tableau de bord
// enseignant la voit sans rien connaître de l'appel.
// ── Typographie française ─────────────────────────────────────────────────


// ── La file d'attente de l'étudiant ───────────────────────────────────────


// ── Répondre à l'appel et à l'humeur ─────────────────────────────────────


// ── Le contrôle d'acquis, avant la séance ─────────────────────────────────


// ── Les questionnaires de l'étudiant ──────────────────────────────────────


// ── Mode séquentiel — une question à la fois ─────────────────────────────


// ── Mode révisable — tout à l'écran, modifiable ──────────────────────────


// ── Mode révision — une question à la fois, et la correction après ───────


// ── Choix de l'avatar ──────────────────────────────────────────────────────
var AVATARS = ["🦊","🐢","🦉","🐙","🦁","🐺","🦄","🐝","🐬","🦋",
               "🐧","🦔","🐳","🦅","🐨","🦝","🐸","🦖","🦩","🐍",
               "🦎","🐊","🦦","🐼","🦒","🐯","🦓","🐘","🦥","🐐",
               "🦡","🐇","🦭","🦈","🐴","🦌","🐡","🐖","🦃","🦚"];

function proposerAvatar(moi){
  $("bloc-avatar").hidden = false;
  var grille = $("grille-avatars");

  sb.rpc("avatars_pris", { p_classe_code: moi.classe_code }).then(function(r){
    var pris = {};
    (r.data || []).forEach(function(x){ pris[x.avatar || x] = true; });
    grille.innerHTML = "";

    AVATARS.forEach(function(a){
      var b = document.createElement("button");
      b.className = "av";
      b.type = "button";
      b.textContent = a;
      b.setAttribute("aria-label", "Choisir l'avatar " + a);
      if (pris[a]) { b.disabled = true; }
      else {
        b.addEventListener("click", function(){
          erreur("err-avatar", "");
          sb.rpc("choisir_avatar", { p_avatar: a }).then(function(rc){
            if (rc.error) { erreur("err-avatar", rc.error.message); return; }
            $("bloc-avatar").hidden = true;
            $("mon-avatar").textContent = a;
          });
        });
      }
      grille.appendChild(b);
    });
  });
}

// ── Espace étudiant ────────────────────────────────────────────────────────
function ouvrirEspaceEtudiant(moi){
  $("mon-numero").textContent   = moi.numero;
  $("mon-numero-2").textContent = moi.numero;
  $("ma-classe").textContent    = moi.classe_nom || moi.classe_code;
  $("mon-avatar").textContent   = moi.avatar || "";
  montrer("espace-etu");

  if (!moi.avatar) proposerAvatar(moi);
  proposerAppel();
  chargerControlesEtu();
  chargerQuestionnairesEtu();

  sb.from("projets").select("titre,description,url,icone,ordre")
    .eq("classe_id", moi.classe_id).order("ordre")
    .then(function(r){ afficherProjets("mes-projets", r.data); });
}

/* ══════════════════════════════════════════════════════════════════════════
   SUIVI D'UNE SÉANCE — vue téléphone et projection au tableau
   ══════════════════════════════════════════════════════════════════════════ */


// ── Projection au tableau ──────────────────────────────────────────────────


// ── Son : quelques notes de synthèse, aucun fichier. Coupé par défaut. ──


// ── Minuteur de séance : le bouton fait défiler arrêt, 5, 10, 15 minutes ──


// ── Vue « Débriefing » : les concepts de l'heure, et ce qu'ils ont donné ────


// ── Vue « Répartition » : ce que la classe a répondu, question par question ──


// ── Pied d'écran : fil d'activité et horodatage ──


function ouvrirEcran(){
  if (!suivi.stats) return;
  suivi.ecran = true;
  // Repartir à blanc : sinon tout le monde clignote au premier affichage.
  suivi.precedent = null;
  suivi.series = null;          // pas d'annonce de série au premier affichage
  suivi.fil = "";
  suivi.transition = true;
  $("classe-ecran").hidden = false;
  rendreEcran(suivi.stats);
}


// ── Les noms, dans CE navigateur et nulle part ailleurs ───────────────────
// La base ne contient que des numéros, et c'est une règle qu'on ne casse pas.
// Mais devant la classe il faut des noms. On les garde donc côté enseignant,
// dans le stockage local du navigateur : rien ne part vers Supabase.


// ── L'appel du jour — présents et absents, à part du reste ────────────────


// ── Le questionnaire de rentrée, côté enseignant ───────────────────────────


// ── « Le semestre » — la question à laquelle aucune carte ne répondait ─────


// ── « À faire » — la seule liste qui ne peut pas mentir ────────────────────


// ── La recherche de stage, côté enseignant ─────────────────────────────────


// ── Séance de projet — une autre lecture ──────────────────────────────────


// ── Avant de commencer — le contrôle d'avant-séance ────────────────────────


// ── Le parcours de l'heure ────────────────────────────────────────────────


// ── Le contrôle d'entrée, côté enseignant ─────────────────────────────────


// ── Le débriefing, côté enseignant ────────────────────────────────────────


$("b-controle").addEventListener("click", function(){
  var b = $("b-controle");
  var vise = !b.classList.contains("on");
  b.disabled = true;
  erreur("err-controle", "");
  sb.rpc("ouvrir_controle", { p_seance_id: Number(suivi.seanceId),
                              p_ouvert: vise }).then(function(r){
    b.disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      erreur("err-controle", (r && r.data && r.data.motif === "vide")
        ? "Écrivez d'abord les notions à contrôler."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-controle", vise
      ? "Le contrôle est proposé aux étudiants. Il apparaît en tête de leur écran."
      : "Le contrôle n'est plus proposé. Les réponses déjà données sont conservées.", true);
    chargerControle();
    chargerControles();
  });
});

$("b-db-creer").addEventListener("click", enregistrerConcepts);
$("b-pa-ecran").addEventListener("click", function(){
  ouvrirEcran();
  modeEcran("par");
});

$("b-db-ecran").addEventListener("click", function(){
  // Projeter depuis la carte : on ouvre l'écran ET on l'amène directement
  // sur le débriefing, sans passer par la vue de progression.
  ouvrirEcran();
  modeEcran("deb");
});

$("b-ct-creer").addEventListener("click", function(){
  var texte = $("ct-texte").value;
  erreur("err-ct-neuf", "");
  if (!texte.trim()) { erreur("err-ct-neuf", "Collez au moins une notion."); return; }
  var b = $("b-ct-creer");
  b.disabled = true;
  sb.rpc("creer_controle", { p_seance_id: Number(suivi.seanceId),
                             p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      // Comme pour les questionnaires : une ligne mal formée fait échouer tout,
      // et la base dit laquelle. Un contrôle dont une notion n'a pas de bonne
      // réponse compterait tout le monde faux sans que personne ne le voie.
      erreur("err-ct-neuf",
        (d && d.motif === "ligne") ? "Ligne " + d.rang + " : " + d.detail +
                                     " — « " + d.texte + " »"
      : (d && d.motif === "reponses") ? d.nombre + " réponse" +
          (d.nombre > 1 ? "s ont" : " a") + " déjà été enregistrée" +
          (d.nombre > 1 ? "s" : "") + " : le contrôle ne peut plus être réécrit. " +
          "Éteignez-le si vous ne voulez plus le proposer."
      : (d && d.motif === "vide") ? "Aucune notion lisible dans ce texte."
      : "Enregistrement refusé. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-ct-neuf", d.notions + (d.notions > 1 ? " notions enregistrées" :
           " notion enregistrée") + ". Allumez le contrôle pour le proposer.", true);
    $("ct-texte").value = "";
    chargerControle();
  });
});


// ── Le rythme — la classe suit-elle la cadence ? ───────────────────────────


// ── Sélecteurs classe et séance ────────────────────────────────────────────


// ── L'inventaire des contrôles d'entrée ───────────────────────────────────


// ── La bibliothèque de questionnaires ─────────────────────────────────────


// L'aide du mode révision n'apparaît que sur ce mode : l'étoile et la flèche
// n'ont aucun sens dans les deux autres, où elles sont d'ailleurs refusées.
$("qn-mode").addEventListener("change", function(){
  $("qn-aide-revision").hidden = $("qn-mode").value !== "revision";
  $("qn-texte").placeholder = $("qn-mode").value === "revision"
    ? "Un objet, c'est : · le modèle écrit une fois · *l'exemplaire fabriqué "
      + "· une méthode → La classe est le moule, l'objet le gâteau."
    : "Ce semestre, le rythme vous a paru : · Trop lent · Juste · Trop rapide · Intenable";
});

$("b-qn-creer").addEventListener("click", function(){
  var titre = $("qn-titre").value, texte = $("qn-texte").value;
  erreur("err-qn-neuf", "");
  if (!titre.trim())  { erreur("err-qn-neuf", "Donnez-lui un titre."); return; }
  if (!texte.trim())  { erreur("err-qn-neuf", "Collez au moins une question."); return; }

  var b = $("b-qn-creer");
  b.disabled = true;
  sb.rpc("creer_modele", { p_titre: titre, p_intro: $("qn-intro").value,
                           p_mode: $("qn-mode").value, p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      // La base refuse tout dès qu'une ligne est mal formée, et dit laquelle :
      // un questionnaire amputé d'une question sans qu'on le sache serait pire.
      // Les refus qui nomment une ligne se disent tous de la même façon : le
      // rang, la raison, et la ligne. C'est ce qui permet de corriger sans
      // relire les vingt autres.
      var parLigne = { ligne: 1, sans_etoile: 1, deux_etoiles: 1,
                       etoile_inutile: 1, explication_inutile: 1 };
      erreur("err-qn-neuf", (d && parLigne[d.motif])
        ? "Ligne " + d.rang + " : " + d.detail + " — « " + d.texte + " »"
        : (d && d.motif === "vide")
        ? "Aucune question lisible dans ce texte."
        : "Création refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-qn-neuf", "« " + titre + " » est créé, " + d.questions +
           " questions. Cochez les classes à qui le donner.", true);
    $("qn-titre").value = ""; $("qn-intro").value = ""; $("qn-texte").value = "";
    $("qn-neuf").open = false;
    chargerQuestionnaires();
  });
});


// Un sélecteur qui range les démos dans leur propre groupe : la liste du haut
// ne contient que ce dont on se sert en cours.
function remplirSelecteurClasses(sel, classes, valeur, texte){
  sel.innerHTML = "";
  var demos = [];
  (classes || []).forEach(function(c){
    var o = document.createElement("option");
    o.value = valeur(c); o.textContent = texte(c);
    if (estDemo(c)) demos.push(o); else sel.appendChild(o);
  });
  if (demos.length) {
    var g = document.createElement("optgroup");
    g.label = "Démonstration";
    demos.forEach(function(o){ g.appendChild(o); });
    sel.appendChild(g);
  }
  if (!sel.options.length) {
    sel.innerHTML = '<option value="">Aucune classe disponible</option>';
  }
}

// ── Espace enseignant ──────────────────────────────────────────────────────
function ouvrirEspaceEnseignant(){
  montrer("espace-ens");

  // L'onglet vient de l'adresse quand elle en porte un : c'est ce qui fait
  // qu'un rafraîchissement en pleine séance ne renvoie plus à l'appel.
  // « remplacer » : on normalise l'adresse sans ajouter d'entrée, sinon le
  // premier Précédent ne ferait que retirer le dièse.
  ouvrirOnglet(ongletDeLAdresse() || "appel", "remplacer");

  sb.from("classes").select("id,code,nom").order("code").then(function(rc){
    var toutes = rc.data || [];
    // Les démos restent joignables par le sélecteur, mais elles ne comptent
    // dans aucun chiffre et n'apparaissent dans aucune carte du jour.
    var classes = classesReelles(toutes);
    var corps = $("t-classes").querySelector("tbody");
    corps.innerHTML = "";

    // Sélecteur de classe du panneau de suivi
    remplirSelecteurClasses($("pk-classe"), toutes,
      function(c){ return c.id; }, function(c){ return c.nom; });

    suivi.classesConnues = classes;
    chargerAppelToutesClasses(classes);
    chargerConnaissance(classes);
    chargerStage(classes);
    chargerQuestionnaires();
    chargerControles();
    chargerAFaire();
    chargerSemestre();
    if (classes.length) chargerSeancesDe(classes[0].id);

    classes.forEach(function(c){
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + c.nom + "</td><td class='num'>" + c.code +
                     "</td><td class='num' data-e>…</td><td class='num' data-c>…</td>" +
                     "<td class='num' data-s>…</td>";
      corps.appendChild(tr);

      sb.from("eleves").select("auth_id").eq("classe_id", c.id).then(function(re){
        var l = re.data || [];
        tr.querySelector("[data-e]").textContent = l.length;
        tr.querySelector("[data-c]").textContent = l.filter(function(x){ return x.auth_id; }).length;
      });
      sb.from("seances").select("id").eq("classe_id", c.id).then(function(rs){
        tr.querySelector("[data-s]").textContent = (rs.data || []).length;
      });
    });

    // Un projet appartient à une classe : on l'affiche sous elle, et non dans
    // une liste à plat où le code de classe était collé devant la description.
    sb.from("projets").select("titre,description,url,icone,ordre,classe_id")
      .order("classe_id").order("ordre")
      .then(function(rp){
        rendreProjetsParClasse(classes, rp.data || []);
      });
  });
}


// ── Formulaire étudiant ────────────────────────────────────────────────────
$("f-etu").addEventListener("submit", function(e){
  e.preventDefault();
  erreur("err-etu", "");
  $("b-etu").disabled = true;
  $("b-etu").textContent = "Connexion…";

  sb.rpc("rejoindre", {
    p_classe_code: $("classe").value,
    p_numero:      $("numero").value.trim(),
    p_pin:         $("pin").value.trim() || null
  }).then(function(r){
    $("b-etu").disabled = false;
    $("b-etu").textContent = "Me connecter";
    if (r.error) { erreur("err-etu", r.error.message); return; }
    ouvrirEspaceEtudiant(r.data);
  });
});

// ── Formulaire enseignant ──────────────────────────────────────────────────
$("f-ens").addEventListener("submit", function(e){
  e.preventDefault();
  erreur("err-ens", "");
  $("b-ens").disabled = true;
  $("b-ens").textContent = "Connexion…";

  sb.auth.signInWithPassword({ email: $("email").value, password: $("mdp").value })
    .then(function(r){
      $("b-ens").disabled = false;
      $("b-ens").textContent = "Me connecter";
      if (r.error) { erreur("err-ens", "Identifiants refusés."); return; }
      return sb.rpc("est_enseignant").then(function(re){
        if (re.data) { ouvrirEspaceEnseignant(); }
        else {
          erreur("err-ens", "Ce compte n'est pas déclaré comme enseignant.");
          sb.auth.signOut();
        }
      });
    });
});

// ── Déconnexion ────────────────────────────────────────────────────────────
function sortir(){
  arreterBoucle();
  sb.auth.signOut().then(function(){ location.reload(); });
}
$("b-sortie-etu").addEventListener("click", sortir);
$("b-sortie-ens").addEventListener("click", sortir);

// ── Commandes du suivi de séance ───────────────────────────────────────────
$("pk-classe").addEventListener("change", function(){
  chargerSeancesDe(this.value);
});

$("pk-seance").addEventListener("change", activerSeance);
$("b-copier-abs").addEventListener("click", copierAbsents);
$("b-noms").addEventListener("click", function(){
  var d = $("bloc-noms");
  d.hidden = false; d.open = !d.open;
  if (d.open && !$("noms-saisie").value) {
    // On repart de ce qui est deja connu, pour completer plutot que resaisir.
    var map = lireNoms(), lignes = [];
    Object.keys(map).forEach(function(code){
      Object.keys(map[code]).sort().forEach(function(num){
        lignes.push(code + ";" + num + ";" + map[code][num]);
      });
    });
    $("noms-saisie").value = lignes.join("\n");
  }
});
$("b-noms-ok").addEventListener("click", function(){
  var r = enregistrerNoms($("noms-saisie").value);
  if (r.erreur) { erreur("err-noms", "Le navigateur refuse d'enregistrer (navigation privée ?)."); return; }
  erreur("err-noms", r.lus + " noms enregistrés dans ce navigateur" +
         (r.ignores ? ", " + r.ignores + " lignes ignorées (format attendu : CLASSE;numéro;nom)" : "") + ".", true);
  chargerAppelToutesClasses(suivi.classesConnues || []);
  chargerConnaissance(suivi.classesConnues || []);
  chargerStage(suivi.classesConnues || []);
  chargerAFaire();
  chargerSemestre();
});
$("b-noms-vider").addEventListener("click", function(){
  try { localStorage.removeItem(NOMS_CLE); } catch (e) {}
  $("noms-saisie").value = "";
  erreur("err-noms", "Noms effacés de ce navigateur.", true);
  chargerAppelToutesClasses(suivi.classesConnues || []);
  chargerConnaissance(suivi.classesConnues || []);
  chargerStage(suivi.classesConnues || []);
  chargerAFaire();
  chargerSemestre();
});

$("b-demarrer").addEventListener("click", function(){
  pilotage("demarrer_seance", "Séance démarrée. Le chrono part maintenant.");
});
$("b-clore").addEventListener("click", function(){
  pilotage("clore_seance", "Séance close. Les réponses sont figées.");
});

$("b-rafraichir").addEventListener("click", rafraichir);
$("pk-tri").addEventListener("change", function(){
  if (suivi.stats) rendreSuivi(suivi.stats);
});
$("b-ecran").addEventListener("click", ouvrirEcran);

// Le mode classe branche ses propres boutons, et reçoit ici les deux
// chargements qui vivent de ce côté-ci — sans quoi il faudrait qu'il importe
// app.js, qui l'importe déjà.
brancherEcran({ chargerDebrief: chargerDebrief, chargerParcours: chargerParcours });
brancherControle({ allerAuControle: allerAuControle });
brancherSeance({ chargerAFaire: chargerAFaire });
brancherBibliotheque({ chargerAFaire: chargerAFaire,
                       chargerConnaissance: chargerConnaissance,
                       chargerStage: chargerStage,
                       remplirConnaissanceClasse: remplirConnaissanceClasse });


// ── Démarrage ──────────────────────────────────────────────────────────────
function chargerClasses(){
  return sb.from("classes").select("code,nom").order("code").then(function(r){
    remplirSelecteurClasses($("classe"), r.data || [],
      function(c){ return c.code; }, function(c){ return c.nom; });
  });
}

sb.auth.getSession().then(function(s){
  var session = s.data && s.data.session;
  if (session) {
    return sb.rpc("est_enseignant").then(function(re){
      if (re.data) { ouvrirEspaceEnseignant(); return; }
      return sb.rpc("qui_suis_je").then(function(rm){
        if (rm.data) { ouvrirEspaceEtudiant(rm.data); }
        else { return chargerClasses().then(function(){ montrer("connexion"); }); }
      });
    });
  }
  return sb.auth.signInAnonymously().then(function(){
    return chargerClasses().then(function(){ montrer("connexion"); });
  });
}).catch(function(){
  $("chargement").textContent =
    "Connexion au service impossible. Réessayez dans un instant, ou prévenez votre enseignant.";
});

})();
