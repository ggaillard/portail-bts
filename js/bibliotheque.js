// ── La bibliothèque de questionnaires, côté enseignant ────────────────────
//
// Les modèles et leurs affectations : écrire un questionnaire une fois, le
// donner à une ou plusieurs classes, l'allumer, l'éteindre, le rattacher à une
// séance. Le modèle à deux étages est décrit dans CLAUDE.md et ne change pas
// ici : un MODÈLE porte le texte ; une AFFECTATION est une séance de la bande
// 90-98, avec ses propres corrigés et ses propres réponses.
//
// Ce fichier et js/quiz.js sont nés d'un seul — 878 lignes — que le plafond de
// 700 a refusé. C'était la bonne réponse : les deux moitiés ne s'appellent
// JAMAIS, dans aucun sens, vérifié avant de couper. Un enseignant qui gère sa
// bibliothèque et un étudiant qui répond ne font pas la même chose.
//
// Il reçoit par brancherBibliotheque() les trois chargements qui vivent du
// côté d'app.js : rafraîchir un questionnaire rafraîchit aussi « Ce qui
// bloque », « Faisons connaissance » et « Recherche de stage », qui lisent les
// mêmes séances. Les importer ferait un cycle.

import { $, sb, suivi, erreur, typo } from './socle.js';

let chargerAFaire = function(){};
let chargerConnaissance = function(){};
let chargerStage = function(){};
let remplirConnaissanceClasse = function(){};

export function brancherBibliotheque(liens){
  chargerAFaire = liens.chargerAFaire;
  chargerConnaissance = liens.chargerConnaissance;
  chargerStage = liens.chargerStage;
  remplirConnaissanceClasse = liens.remplirConnaissanceClasse;
}

// La bibliothèque telle que la base l'a rendue. Partagée avec app.js, qui y
// lit la liste des classes pour ses sélecteurs.
export var BIB = { modeles: [], classes: [] };

function chargerQuestionsSeance(){
  var bloc = $("bloc-corriges");
  if (!suivi.seanceId) { bloc.hidden = true; return Promise.resolve(); }

  return sb.rpc("questions_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    if (r && !r.error && r.data && r.data.ok) return r.data.questions || [];
    // Fonction pas encore déployée : on retente la lecture directe, qui
    // marchera si la RLS l'autorise. Sinon le panneau le dira franchement.
    return sb.from("corriges")
      .select("question,bonne_reponse,intitule,options,explication")
      .eq("seance_id", suivi.seanceId)
      .then(function(rc){ return (rc && rc.data) || []; });
  }).then(function(liste){
    rendreCorriges(liste.slice().sort(function(a, b){
      return a.question < b.question ? -1 : 1;
    }));
  });
}

function rendreCorriges(cor){
  var bloc = $("bloc-corriges"), z = $("liste-corriges");
  cor = cor || [];
  z.innerHTML = "";
  bloc.hidden = false;

  if (!cor.length) {
    $("corriges-titre").textContent = "Les questions de cette séance — aucune";
    z.innerHTML = '<p class="sous-hint" style="margin:.5rem 0 0">Aucun énoncé lisible pour cette séance. ' +
                  'Soit la séance n\'a pas de corrigé, soit la fonction <code>questions_seance()</code> ' +
                  'n\'est pas déployée et la RLS interdit la lecture directe : jouez QUESTIONS.sql.</p>';
    return;
  }
  $("corriges-titre").textContent =
    "Les questions de cette séance — " + cor.length + (cor.length > 1 ? " questions" : " question");

  var lettres = ["A", "B", "C", "D"];
  cor.forEach(function(c){
    var d = document.createElement("div");
    d.className = "cq";
    d.innerHTML = '<span class="cq-cle"></span><span class="cq-txt"></span>' +
                  '<span class="cq-opts"></span><span class="cq-exp"></span>';
    d.querySelector(".cq-cle").textContent = c.question;
    d.querySelector(".cq-txt").textContent = c.intitule || "(pas d'intitulé — l'écran affichera « Question N »)";

    var zo = d.querySelector(".cq-opts");
    if (c.options && c.options.length) {
      c.options.forEach(function(o, i){
        var juste = lettres[i] === c.bonne_reponse;
        var l = document.createElement("span");
        l.className = "cq-opt" + (juste ? " juste" : "");
        l.textContent = lettres[i] + ". " + o + (juste ? "  ✓" : "");
        zo.appendChild(l);
      });
    } else {
      var l = document.createElement("span");
      l.className = "cq-opt juste";
      l.textContent = "Bonne réponse : " + (c.bonne_reponse || "?") +
                      "  — options non déclarées, l'énoncé est projeté au tableau.";
      zo.appendChild(l);
    }
    if (c.explication) d.querySelector(".cq-exp").textContent = c.explication;
    z.appendChild(d);
  });
}

function chargerQuestionnaires(garder){
  var carte = $("carte-qactifs");
  carte.hidden = true;
  if (!garder) erreur("err-qactifs", "");
  sb.rpc("bibliotheque").then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) return;
    BIB.classes = r.data.classes || [];
    rendreBibliotheque(r.data.modeles || []);
    carte.hidden = false;
  });
}

function rendreBibliotheque(modeles){
  var z = $("qa-liste");
  z.innerHTML = "";
  if (!modeles.length) {
    z.innerHTML = '<p class="hint" style="margin:0">Aucun questionnaire pour ' +
      "l'instant. Écrivez le premier ci-dessous.</p>";
    return;
  }
  modeles.forEach(function(m){ z.appendChild(ligneModele(m)); });
}

function ligneModele(m){
  var d = document.createElement("div");
  d.className = "qn-m";
  d.innerHTML = '<div class="qn-tete"><span class="qn-tt"></span>' +
                '<span class="qn-meta"></span></div>' +
                '<div class="qn-cl"></div>';
  d.querySelector(".qn-tt").textContent = m.titre;
  // Le mode se lit ici, et pas ailleurs : c'est la seule chose qui distingue
  // deux modèles autrement identiques, et celle qui décide si les étudiants
  // voient une correction. Se tromper de mode en donnant un questionnaire de
  // révision à une classe, c'est leur donner un quiz muet.
  d.querySelector(".qn-meta").textContent =
    m.questions + (m.questions > 1 ? " questions · " : " question · ") +
    (m.mode === "revision"  ? "révision — la correction s'affiche"
     : m.mode === "revisable" ? "modifiable à volonté"
     : "une question à la fois");

  var parClasse = {};
  (m.affectations || []).forEach(function(a){ parClasse[a.classe_id] = a; });

  // ── Ce qu'on voit, et ce qu'on replie ───────────────────────────────────
  // Mesuré le 16/09 : l'onglet faisait 2 778 px sur un téléphone pour trois
  // questionnaires — sept écrans. La cause n'était pas la densité mais le
  // périmètre : chaque modèle affichait TOUTES les classes, y compris celles
  // où il n'est pas donné, chacune avec ses deux boutons et son sélecteur de
  // séance. Les lignes des classes non concernées coûtaient plus cher que
  // celles des classes concernées.
  //
  // Reste visible ce qu'on touche en séance : les classes où le questionnaire
  // EST donné, avec leur interrupteur. Tout le reste — donner à une autre
  // classe, rattacher à une séance, retirer, supprimer le modèle — est un
  // réglage qu'on fait assis, et passe sous un repli.
  var donnees = BIB.classes.filter(function(c){ return parClasse[c.classe_id]; });
  var autres  = BIB.classes.filter(function(c){ return !parClasse[c.classe_id]; });

  var cl = d.querySelector(".qn-cl");
  donnees.forEach(function(c){
    cl.appendChild(caseClasse(m, c, parClasse[c.classe_id]));
  });

  // Donné à personne : les boutons « Donner à… » sont le seul geste qui ait
  // du sens, ils restent donc dehors. Les replier obligerait à ouvrir un
  // tiroir pour faire la seule chose possible.
  if (!donnees.length) {
    autres.forEach(function(c){ cl.appendChild(caseClasse(m, c, null)); });
    d.appendChild(reglagesModele(m, [], parClasse));
  } else {
    d.appendChild(reglagesModele(m, autres, parClasse));
  }

  // Les réponses, sous le modèle qui les a produites. Un questionnaire qu'on
  // peut poser et allumer mais dont on ne verrait jamais les réponses ne vaut
  // pas la peine d'être écrit.
  (m.affectations || []).forEach(function(a){
    if (!a.commences) return;             // rien à montrer tant que rien n'arrive
    d.appendChild(deplientReponses(m, a));
  });

  return d;
}

function reglagesModele(m, autres, parClasse){
  var det = document.createElement("details");
  det.className = "qn-reg";
  var som = document.createElement("summary");
  var bouts = [];
  if (autres.length) bouts.push("donner à " + autres.length + " autre" +
                                (autres.length > 1 ? "s classes" : " classe"));
  var posees = Object.keys(parClasse).length;
  if (posees) bouts.push("rattacher, retirer");
  bouts.push("supprimer");
  som.textContent = "Réglages — " + bouts.join(", ");
  det.appendChild(som);

  var corps = document.createElement("div");
  corps.className = "qn-reg-corps";

  // Rattacher et retirer, classe par classe, pour celles où c'est donné.
  (m.affectations || []).forEach(function(a){
    var bloc = document.createElement("div");
    bloc.className = "qn-reg-cl";
    var t = document.createElement("b");
    t.textContent = a.nom;
    bloc.appendChild(t);
    bloc.appendChild(choixSeance(m, { classe_id: a.classe_id, nom: a.nom, code: a.code }, a));
    bloc.appendChild(boutonRetirer(m, { classe_id: a.classe_id, nom: a.nom }, a, bloc));
    corps.appendChild(bloc);
  });

  // Les classes où il n'est pas donné.
  autres.forEach(function(c){
    var don = document.createElement("button");
    don.type = "button";
    don.className = "btn btn-sec qn-aff";
    don.textContent = "Donner à " + c.nom;
    don.setAttribute("aria-label", "Donner « " + m.titre + " » à " + c.nom);
    don.addEventListener("click", function(){ don.disabled = true; affecter(m, c); });
    corps.appendChild(don);
  });

  // Supprimer le modèle : en dernier, dans le tiroir, jamais à côté du titre.
  // À portée du pouce d'un bouton qu'on touche souvent, c'est un accident qui
  // attend son tour.
  var sup = document.createElement("button");
  sup.type = "button";
  sup.className = "btn btn-sec qn-sup-reg";
  sup.textContent = "Supprimer ce questionnaire";
  sup.addEventListener("click", function(){ supprimerModele(m); });
  corps.appendChild(sup);

  det.appendChild(corps);
  return det;
}

function boutonRetirer(m, c, a, hote){
  var ret = document.createElement("button");
  ret.type = "button";
  ret.className = "btn btn-sec qn-aff";
  ret.textContent = "Retirer de la classe";
  ret.setAttribute("aria-label", "Retirer « " + m.titre + " » de " + c.nom);
  if (a.commences) {
    ret.disabled = true;
    ret.title = "Des réponses existent : le retrait effacerait leur travail.";
    var pq = document.createElement("p");
    pq.className = "qn-pourquoi";
    pq.textContent = "Retrait impossible : " + a.commences + " étudiant" +
      (a.commences > 1 ? "s ont" : " a") + " déjà répondu. " +
      "Éteindre le retire de leur écran sans rien perdre.";
    hote.appendChild(pq);
  } else {
    ret.addEventListener("click", function(){ ret.disabled = true; retirer(m, c, a, ret); });
  }
  return ret;
}

function deplientReponses(m, a){
  var det = document.createElement("details");
  det.className = "qn-rep";
  var som = document.createElement("summary");
  som.textContent = "Réponses — " + a.nom + " (" + a.termines + " / " + a.inscrits + ")";
  det.appendChild(som);
  var corps = document.createElement("div");
  corps.className = "qn-rep-corps";
  corps.innerHTML = '<p class="hint" style="margin:0">Chargement…</p>';
  det.appendChild(corps);

  // On ne charge qu'à l'ouverture : quatre modèles × deux classes feraient
  // huit requêtes à l'affichage de l'onglet, pour des panneaux fermés.
  var charge = false;
  det.addEventListener("toggle", function(){
    if (!det.open || charge) return;
    charge = true;
    sb.rpc("depouiller_questionnaire", { p_seance_id: Number(a.seance_id) })
      .then(function(r){
        if (!r || r.error || !r.data || !r.data.ok) {
          corps.innerHTML = '<p class="hint" style="margin:0">Les réponses ne ' +
            'sont pas lisibles pour ce questionnaire.</p>';
          charge = false;
          return;
        }
        // Même sortie que connaissance_classe() : on réutilise son rendu
        // plutôt que d'en écrire un second qui divergerait.
        remplirConnaissanceClasse(corps, { nom: a.nom, code: a.code }, r.data);
      });
  });
  return det;
}

function caseClasse(m, c, a){
  var l = document.createElement("div");
  l.className = "qn-c" + (a ? " pose" : "");
  l.innerHTML = '<span class="qn-cn"></span><span class="qn-cd"></span>' +
                '<span class="qn-actes"></span>';
  l.querySelector(".qn-cn").textContent = c.nom;
  var etat = l.querySelector(".qn-cd");
  var actes = l.querySelector(".qn-actes");

  if (!a) {
    etat.textContent = "pas donné à cette classe";
    var don = document.createElement("button");
    don.type = "button";
    don.className = "btn btn-sec qn-aff";
    don.textContent = "Donner à cette classe";
    don.setAttribute("aria-label", "Donner « " + m.titre + " » à " + c.nom);
    don.addEventListener("click", function(){ don.disabled = true; affecter(m, c); });
    actes.appendChild(don);
    return l;
  }

  // Donné. L'interrupteur d'abord : c'est le geste courant, celui qu'on refait.
  // Retirer est rare et destructeur, il vient après.
  var bouts = [a.ouvert ? "visible par les étudiants" : "préparé, pas encore visible"];
  if (a.rattachee_a) bouts.push("suit la séance " + a.rattachee_numero);
  if (a.inscrits) {
    bouts.push(a.termines + " / " + a.inscrits + " terminé" + (a.termines > 1 ? "s" : ""));
  }
  etat.textContent = bouts.join(" · ");

  var b = document.createElement("button");
  b.type = "button";
  b.className = "qa-b" + (a.ouvert ? " on" : "");
  b.innerHTML = '<span class="pt"></span><span class="et"></span>';
  b.querySelector(".et").textContent = a.ouvert ? "Proposé" : "Éteint";
  b.setAttribute("aria-pressed", a.ouvert ? "true" : "false");
  b.setAttribute("aria-label", (a.ouvert ? "Éteindre" : "Proposer") + " « " +
                 m.titre + " » pour " + c.nom);
  b.addEventListener("click", function(){ basculer(m, c, a, b); });
  actes.appendChild(b);

  // « Retirer » et « Avec la séance… » vivent désormais dans le tiroir des
  // réglages : ce sont des gestes qu'on fait assis, pas en séance. Ce qui
  // reste ici est ce qu'on touche debout — le nom, l'état, l'interrupteur.
  return l;
}

function choixSeance(m, c, a){
  var lig = document.createElement("label");
  lig.className = "qn-rat";
  var txt = document.createElement("span");
  txt.textContent = "Avec la séance";
  lig.appendChild(txt);

  var sel = document.createElement("select");
  sel.setAttribute("aria-label", "Séance accompagnée par « " + m.titre +
                   " » pour " + c.nom);
  var aucune = document.createElement("option");
  aucune.value = "";
  aucune.textContent = "— aucune, je l'allume moi-même —";
  sel.appendChild(aucune);

  (c.seances || []).forEach(function(s){
    var o = document.createElement("option");
    o.value = String(s.seance_id);
    o.textContent = s.numero + " — " + s.titre + (s.en_cours ? "  ·  en cours" : "");
    if (String(a.rattachee_a) === String(s.seance_id)) o.selected = true;
    sel.appendChild(o);
  });

  if (!(c.seances || []).length) {
    aucune.textContent = "— aucune séance de cours pour cette classe —";
    sel.disabled = true;
  }

  sel.addEventListener("change", function(){
    sel.disabled = true;
    rattacher(m, c, a, sel);
  });
  lig.appendChild(sel);
  return lig;
}

function rattacher(m, c, a, sel){
  var cible = sel.value ? Number(sel.value) : null;
  erreur("err-qactifs", "");
  sb.rpc("rattacher_questionnaire", { p_seance_id: Number(a.seance_id),
                                      p_cible: cible }).then(function(r){
    sel.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      erreur("err-qactifs", (d && d.motif === "autre_classe")
        ? "Cette séance appartient à une autre classe."
        : (d && d.motif === "pas_un_cours")
          ? "On ne rattache un questionnaire qu'à une séance de cours."
          : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      rafraichirQuestionnaires();
      return;
    }
    if (!cible) {
      erreur("err-qactifs", "« " + m.titre + " » ne suit plus aucune séance pour " +
             c.nom + ". Son état n'a pas changé : c'est l'interrupteur qui décide " +
             "de ce que voient les étudiants.", true);
    } else {
      erreur("err-qactifs", "« " + m.titre + " » accompagne la séance " + d.numero +
             " de " + c.nom + (d.allume_maintenant
               ? " — elle est en cours, il vient d'être proposé."
               : ". Il s'allumera au démarrage de cette séance."), true);
    }
    rafraichirQuestionnaires();
  });
}

function basculer(m, c, a, b){
  var vise = !b.classList.contains("on");
  b.disabled = true;
  erreur("err-qactifs", "");
  sb.rpc("ouvrir_questionnaire", { p_classe_id: Number(c.classe_id),
                                   p_numero: Number(a.numero),
                                   p_ouvert: vise }).then(function(r){
    b.disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      erreur("err-qactifs", "Action refusée. Vérifiez que vous êtes bien " +
                            "connecté en enseignant.");
      return;
    }
    erreur("err-qactifs", "« " + m.titre + " » " +
           (vise ? "est maintenant proposé à " : "n'est plus proposé à ") + c.nom + ".", true);
    rafraichirQuestionnaires();
  });
}

function affecter(m, c){
  erreur("err-qactifs", "");
  sb.rpc("affecter_questionnaire", { p_modele_id: Number(m.id),
                                     p_classe_id: Number(c.classe_id) }).then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) {
      erreur("err-qactifs", (r && r.data && r.data.motif === "plein")
        ? "Cette classe a déjà neuf questionnaires : retirez-en un d'abord."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      rafraichirQuestionnaires();
      return;
    }
    erreur("err-qactifs", "« " + m.titre + " » est préparé pour " + c.nom +
           ". Il reste éteint : allumez-le quand vous voulez le proposer.", true);
    rafraichirQuestionnaires();
  });
}

function retirer(m, c, a, bouton){
  if (!a) { rafraichirQuestionnaires(); return; }
  erreur("err-qactifs", "");
  sb.rpc("retirer_questionnaire", { p_seance_id: Number(a.seance_id) }).then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) {
      var d = r && r.data;
      erreur("err-qactifs", (d && d.motif === "reponses")
        ? "Impossible de retirer « " + m.titre + " » de " + c.nom + " : " +
          d.nombre + " réponse" + (d.nombre > 1 ? "s ont" : " a") +
          " déjà été enregistrée" + (d.nombre > 1 ? "s" : "") +
          ". Éteignez-le : il disparaît de l'écran des étudiants sans rien perdre."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      rafraichirQuestionnaires();
      return;
    }
    erreur("err-qactifs", "« " + m.titre + " » a été retiré de " + c.nom + ".", true);
    rafraichirQuestionnaires();
  });
}

function supprimerModele(m){
  erreur("err-qactifs", "");
  sb.rpc("supprimer_modele", { p_modele_id: Number(m.id) }).then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) {
      var d = r && r.data;
      erreur("err-qactifs", (d && d.motif === "reponses")
        ? "« " + m.titre + " » a déjà reçu " + d.nombre + " réponse" +
          (d.nombre > 1 ? "s" : "") + " : il ne peut pas être supprimé. " +
          "Décochez ses classes ou éteignez-le."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-qactifs", "« " + m.titre + " » a été supprimé.", true);
    rafraichirQuestionnaires();
  });
}

function rafraichirQuestionnaires(){
  chargerQuestionnaires(true);
  chargerConnaissance(suivi.classesConnues || []);
  chargerStage(suivi.classesConnues || []);
  chargerAFaire();
}

export { chargerQuestionnaires, chargerQuestionsSeance, rendreBibliotheque };
