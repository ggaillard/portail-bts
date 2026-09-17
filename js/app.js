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
         pousse, son, SONS, NOMS_CLE, estDemo, classesReelles } from './socle.js';
import { brancherEcran, modeEcran, rendreEcran, rotationAuto,
         fermerEcran, minuteur } from './ecran.js';
import { ONGLETS, ouvrirOnglet, ongletDeLAdresse } from './navigation.js';

(function(){
"use strict";

// Le socle a déjà lu la configuration et ouvert le client. S'il n'a pas pu,
// il le dit, et le portail s'arrête là plutôt que d'afficher une coquille.
if (probleme) {
  $("chargement").textContent = probleme;
  return;
}


// ── Rendu des cartes projet ────────────────────────────────────────────────
function carte(p){
  var a = document.createElement("a");
  a.className = "projet";
  a.href = p.url;
  a.innerHTML = '<span class="projet-ico"></span><span><span class="projet-t"></span>' +
                '<span class="projet-d"></span></span>';
  a.querySelector(".projet-ico").textContent = p.icone || "•";
  a.querySelector(".projet-t").textContent   = p.titre;
  a.querySelector(".projet-d").textContent   = p.description || "";
  return a;
}

function afficherProjets(conteneur, liste){
  var c = $(conteneur);
  c.innerHTML = "";
  if (!liste || !liste.length) {
    c.innerHTML = '<p class="hint">Aucun projet n\'est encore associé à cette classe.</p>';
    return;
  }
  liste.forEach(function(p){ c.appendChild(carte(p)); });
}

// ── Appel — la question du jour ────────────────────────────────────────────
// L'appel n'est pas un mécanisme à part : c'est la séance numéro 0 de la
// classe, avec une question par date. Y répondre, c'est être présent, et la
// réponse suit le même chemin que toutes les autres — donc le tableau de bord
// enseignant la voit sans rien connaître de l'appel.
// ── Typographie française ─────────────────────────────────────────────────


// ── La file d'attente de l'étudiant ───────────────────────────────────────
// Quatre cartes possibles avant « Vos projets ». Empilées, elles ne disent ni
// combien il en reste, ni laquelle est faite. Chaque carte porte donc son rang
// et son état, et le bandeau du haut compte ce qui reste.
// Plus de liste figée : le nombre de questionnaires dépend de la classe et du
// jour. On lit le DOM dans son ordre, ce qui est aussi l'ordre de lecture.
function etapes(){
  return Array.prototype.slice.call(
    document.querySelectorAll("#espace-etu .etape"));
}

function marquerEtape(id, fait){
  var e = $(id);
  if (e) e.setAttribute("data-fait", fait ? "oui" : "non");
  majFile();
}

function majFile(){
  var vus = etapes().filter(function(e){ return e && !e.hidden; });
  // Le rang se recalcule à chaque fois : selon la classe et le jour, il peut
  // y avoir deux cartes ou quatre. Un « 3 » figé mentirait une fois sur deux.
  vus.forEach(function(e, i){
    var h = e.querySelector("h2");
    if (h) h.setAttribute("data-n", i + 1);
  });

  // Une carte peut être visible ET hors file : le questionnaire de révision se
  // refait à volonté, il n'a pas de fin, et le compteur réclamerait
  // indéfiniment « 1 chose à faire ». C'est un état à part entière, et c'est
  // ICI qu'il se dit — pas en marquant la carte « faite », ce qui la replierait
  // sur son titre et la rendrait inutilisable. Le 16/09, c'est exactement ce
  // qui s'est produit : la carte s'affichait pliée, sans question ni options,
  // et la classe n'avait aucun moyen d'y répondre.
  var reste = vus.filter(function(e){
    return e.getAttribute("data-fait") !== "oui"
        && e.getAttribute("data-hors-file") !== "oui";
  });
  var f = $("file-etu");
  if (!f) return;
  f.hidden = !vus.length;
  $("file-reste").textContent = reste.length ? String(reste.length) : "✓";
  // Pas d'énumération : à 390 px elle passait sur trois lignes, et les cartes
  // juste en dessous portent déjà leur numéro et leur nom.
  $("file-txt").textContent = reste.length
    ? (reste.length > 1 ? "choses à faire avant vos projets" : "chose à faire avant vos projets")
    : "Tout est fait. Bonne séance.";
  // Le raccourci n'apparaît qu'une fois la présence marquée : c'est elle qui
  // ne peut pas attendre, le reste peut se faire après.
  var appel = $("bloc-appel");
  $("file-saut").hidden = !(appel && (appel.hidden || appel.getAttribute("data-fait") === "oui"));
}

function proposerAppel(){
  var bloc = $("bloc-appel");
  bloc.hidden = true;
  erreur("err-appel", "");

  sb.rpc("appel_du_jour").then(function(r){
    // Fonction pas encore déployée, ou pas d'appel aujourd'hui : on n'affiche
    // rien. L'espace étudiant reste utilisable, c'est le comportement d'avant.
    if (!r || r.error || !r.data) { $("bloc-humeur").hidden = true; majFile(); return; }
    var a = r.data;

    bloc.hidden = false;
    $("appel-titre").textContent = typo(a.intitule || "Question du jour");
    marquerEtape("bloc-appel", false);
    proposerHumeur(a.humeur, a.seance_id);

    if (a.repondu) { appelRepondu(a.ma_reponse, null); return; }

    var choix = $("appel-choix");
    choix.innerHTML = "";
    ["A","B","C","D"].forEach(function(lettre, i){
      // Sans libellés en base, on s'en tient aux lettres : la question est
      // alors projetée au tableau, et l'écran ne sert qu'à répondre.
      var opt = (a.options && a.options[i]) ? lettre + ". " + a.options[i] : lettre;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-sec appel-opt";
      b.textContent = opt;
      b.addEventListener("click", function(){ repondreAppel(a, lettre); });
      choix.appendChild(b);
    });
  });
}

// ── Répondre à l'appel et à l'humeur ─────────────────────────────────────
function repondreAppel(a, lettre){
  var boutons = $("appel-choix").querySelectorAll("button");
  Array.prototype.forEach.call(boutons, function(b){ b.disabled = true; });
  erreur("err-appel", "");

  sb.rpc("repondre", {
    p_seance_id: a.seance_id,
    p_question:  a.question,
    p_reponse:   lettre
  }).then(function(r){
    if (r.error) {
      // Une séance fermée refuse les réponses. Réessayer n'y changera rien :
      // il faut le dire, sinon l'étudiant s'acharne et l'enseignant ne sait pas.
      erreur("err-appel", texteEnvoi(r.error, "appel"));
      signalerSessionPerimee(r.error);
      Array.prototype.forEach.call(boutons, function(b){ b.disabled = false; });
      return;
    }
    appelRepondu(lettre, r.data);
  });
}

function appelRepondu(lettre, retour){
  $("appel-choix").innerHTML = "";
  marquerEtape("bloc-appel", true);
  var texte = "Présence enregistrée" + (lettre ? " — vous avez répondu " + lettre + "." : ".");
  if (retour && typeof retour.correct === "boolean") {
    texte += retour.correct
      ? " ✅ Bonne réponse."
      : " ❌ La bonne réponse était " + retour.bonne_reponse + ".";
  }
  erreur("err-appel", texte, true);
}

function proposerHumeur(h, seanceId){
  var bloc = $("bloc-humeur");
  if (!h) { bloc.hidden = true; majFile(); return; }
  bloc.hidden = false;
  erreur("err-humeur", "");
  $("humeur-titre").textContent = typo(h.intitule || "Et aujourd'hui, comment ça va ?");
  marquerEtape("bloc-humeur", false);

  if (h.repondu) return humeurRepondue(h.ma_reponse, h.options);

  var choix = $("humeur-choix");
  choix.innerHTML = "";
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!h.options || !h.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt";
    b.textContent = h.options[i];
    b.addEventListener("click", function(){
      var boutons = choix.querySelectorAll("button");
      Array.prototype.forEach.call(boutons, function(x){ x.disabled = true; });
      sb.rpc("repondre", { p_seance_id: seanceId, p_question: h.question, p_reponse: lettre })
        .then(function(r){
          if (r.error) {
            erreur("err-humeur", texteEnvoi(r.error, "appel"));
            signalerSessionPerimee(r.error);
            Array.prototype.forEach.call(boutons, function(x){ x.disabled = false; });
            return;
          }
          humeurRepondue(lettre, h.options);
        });
    });
    choix.appendChild(b);
  });
}

function humeurRepondue(lettre, options){
  $("humeur-choix").innerHTML = "";
  marquerEtape("bloc-humeur", true);
  var i = ["A","B","C","D"].indexOf(lettre);
  var dit = (options && i >= 0 && options[i]) ? " — " + options[i] : "";
  erreur("err-humeur", "C'est noté, merci" + dit + ".", true);
}

function motifEnvoi(err){
  var m = (err && err.message) || "";
  if (/non identifie/i.test(m)) return "session";
  if (/ferm/i.test(m))          return "fermee";
  return "autre";
}

function texteEnvoi(err, quoi){
  switch (motifEnvoi(err)) {
    case "session":
      return "Votre session a été reprise sur un autre appareil : rien n'a été " +
             "enregistré. Cliquez « Ce n'est pas moi », puis identifiez-vous à nouveau.";
    case "fermee":
      return quoi === "appel"
        ? "L'appel est fermé pour cette classe. Prévenez votre enseignant : " +
          "votre présence n'est pas enregistrée."
        : "Cette séance est fermée : les réponses n'y sont plus acceptées. " +
          "Prévenez votre enseignant.";
    default:
      return "L'enregistrement n'a pas abouti. Réessayez dans un instant.";
  }
}

function signalerSessionPerimee(err){
  if (motifEnvoi(err) !== "session") return;
  var b = $("b-sortie-etu");
  if (b) { b.classList.add("btn"); b.classList.remove("btn-sec"); }
}

// ── Le contrôle d'acquis, avant la séance ─────────────────────────────────
// Deux questions par notion, dans cet ordre : ce qu'ils savent, puis ce qu'ils
// croient savoir. La seconde n'a de valeur que posée APRÈS la première — la
// poser avant reviendrait à demander une note de confiance dans le vide.
//
// Il passe en tête de la file parce qu'il se fait avant la séance : le mettre
// sous les questionnaires reviendrait à le proposer une fois qu'il est trop
// tard.
function chargerControlesEtu(){
  $("controles-etu").innerHTML = "";
  sb.rpc("mes_controles").then(function(r){
    // Fonction pas déployée : rien ne s'affiche, comme avant qu'elle existe.
    if (!r || r.error || !r.data || !r.data.ok) { majFile(); return; }
    rendreControlesEtu(r.data.liste || []);
  });
}

function rendreControlesEtu(liste){
  var z = $("controles-etu");
  z.innerHTML = "";
  (liste || []).forEach(function(d){
    if (!d.questions || !d.questions.length) return;
    z.appendChild(carteControle(d));
    rendreControle(d);
  });
  majFile();
}

function carteControle(d){
  var c = document.createElement("div");
  c.className = "card etape ct-carte";
  c.id = "ct-" + d.seance_id;
  c.setAttribute("data-etape", "Avant la séance " + d.numero);
  c.innerHTML = '<h2></h2><p class="hint"></p><div id="err-ct-' + d.seance_id + '"></div>' +
                '<p class="cn-int"></p><div class="appel-choix"></div>';
  c.querySelector("h2").textContent = "Avant de commencer — séance " + d.numero;
  var h = c.querySelector(".hint");
  h.textContent = "Quelques notions déjà vues, à retrouver avant la séance. " +
    "Répondez, puis dites si vous vous sentiez sûr : c'est l'écart entre les " +
    "deux qui m'indique par où reprendre. ";
  var av = document.createElement("b");
  av.className = "ct-av";
  h.appendChild(av);
  return c;
}

function zoneCt(d, sel){ return $("ct-" + d.seance_id).querySelector(sel); }

function rendreControle(d){
  var errId = "err-ct-" + d.seance_id;
  var reste = d.questions.filter(function(q){ return !q.ma_reponse; });
  marquerEtape("ct-" + d.seance_id, !reste.length);

  if (!reste.length) {
    zoneCt(d, ".ct-av").textContent = "";
    zoneCt(d, ".cn-int").textContent = "";
    zoneCt(d, ".appel-choix").innerHTML = "";
    erreur(errId, "C'est fait, merci. Rien de tout cela ne compte dans vos " +
                  "résultats : c'est un point de départ, pas une note.", true);
    return;
  }
  erreur(errId, "");

  // Les questions arrivent dans l'ordre des clés : pre-01, pre-01-c, pre-02…
  // La certitude suit donc toujours sa notion, sans qu'on ait à les apparier.
  var q = reste[0];
  var faites = d.questions.length - reste.length;
  var notions = Math.round(d.questions.length / 2);
  var rang = Math.floor(faites / 2) + 1;
  var certitude = /-c$/.test(q.question || "");
  zoneCt(d, ".ct-av").textContent = "Notion " + Math.min(rang, notions) + " sur " + notions +
                                    (certitude ? " — votre ressenti." : ".");
  zoneCt(d, ".cn-int").textContent = typo(q.intitule || q.question);

  var choix = zoneCt(d, ".appel-choix");
  choix.innerHTML = "";
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!q.options || !q.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt" + (certitude ? " ct-sur" : "");
    b.textContent = q.options[i];
    b.addEventListener("click", function(){
      var boutons = choix.querySelectorAll("button");
      Array.prototype.forEach.call(boutons, function(x){ x.disabled = true; });
      sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                           p_reponse: lettre }).then(function(rr){
        if (rr.error) {
          erreur(errId, texteEnvoi(rr.error));
          signalerSessionPerimee(rr.error);
          Array.prototype.forEach.call(boutons, function(x){ x.disabled = false; });
          return;
        }
        // Aucune correction affichée, volontairement : dire « faux » avant la
        // séance transforme un point de départ en sanction, et fausse la
        // question de certitude qui suit.
        q.ma_reponse = lettre;
        rendreControle(d);
      });
    });
    choix.appendChild(b);
  });
}

// ── Les questionnaires de l'étudiant ──────────────────────────────────────
// Un questionnaire n'est plus un numéro de séance écrit en dur : c'est une
// séance de la bande 90-98 rattachée à un modèle. mes_questionnaires() les
// renvoie tous, dans l'ordre où ils ont été donnés à la classe, et le portail
// en fabrique une carte chacun.
//
// Deux modes d'affichage, portés par le modèle :
//  · sequentiel — une question à la fois, sans retour en arrière. Douze
//    questions d'un bloc se referment sur un téléphone ; une seule se répond.
//  · revisable  — tout à l'écran, modifiable. Pour un point d'étape qui change
//    en cours d'année.
function chargerQuestionnairesEtu(){
  $("questionnaires-etu").innerHTML = "";
  sb.rpc("mes_questionnaires").then(function(r){
    if (r && !r.error && r.data && r.data.ok) {
      rendreQuestionnairesEtu(r.data.liste || []);
      return;
    }
    // Repli : la migration de la bibliothèque n'est pas encore déployée. On
    // rappelle les deux anciennes fonctions et on les met dans la même forme.
    // Ce repli disparaîtra — il n'existe que pour qu'un déploiement en retard
    // ne vide pas l'écran d'une classe en séance.
    var liste = [];
    var fini = 0;
    var poser = function(){ if (++fini === 2) rendreQuestionnairesEtu(liste); };
    sb.rpc("connaissance").then(function(rc){
      var d = rc && !rc.error && rc.data;
      if (d && d.questions && d.questions.length) {
        liste.push({ seance_id: d.seance_id, numero: 98, titre: "Faisons connaissance",
          intro: "Quelques questions posées une seule fois dans l'année. Il n'y a pas " +
                 "de bonne réponse : elles me servent à adapter les cours à ce que vous êtes.",
          mode: "sequentiel", total: d.total, faites: d.faites, questions: d.questions });
      }
      poser();
    });
    sb.rpc("stage").then(function(rs){
      var d = rs && !rs.error && rs.data;
      if (d && d.questions && d.questions.length) {
        liste.push({ seance_id: d.seance_id, numero: 97, titre: "Votre recherche de stage",
          intro: "Un point d'étape, à remettre à jour dès que quelque chose bouge : " +
                 "vous pouvez changer vos réponses autant de fois que nécessaire.",
          mode: "revisable", total: d.total, faites: d.faites, questions: d.questions });
      }
      poser();
    });
  });
}

function rendreQuestionnairesEtu(liste){
  var z = $("questionnaires-etu");
  z.innerHTML = "";
  (liste || []).forEach(function(d){
    if (!d.questions || !d.questions.length) return;
    z.appendChild(carteQuestionnaire(d));
    (d.mode === "revision" ? rendreRevision
      : d.mode === "revisable" ? rendreRevisable : rendreSequentiel)(d);
  });
  majFile();
}

// Une carte par questionnaire, bâtie sur le même gabarit que les autres
// étapes : c'est ce qui lui donne son rang, son repli et sa place dans la file.
function carteQuestionnaire(d){
  var c = document.createElement("div");
  c.className = "card etape";
  c.id = "qn-" + d.seance_id;
  c.setAttribute("data-etape", d.titre);
  c.innerHTML = '<h2></h2><p class="hint"></p><div id="err-qn-' + d.seance_id + '"></div>' +
                '<p class="cn-int"></p><div class="appel-choix"></div>';
  c.querySelector("h2").textContent = d.titre;
  var h = c.querySelector(".hint");
  h.textContent = (d.intro || "") + " ";
  var av = document.createElement("b");
  av.className = "qn-av";
  h.appendChild(av);
  return c;
}

function zoneQ(d, sel){ return $("qn-" + d.seance_id).querySelector(sel); }

// ── Mode séquentiel — une question à la fois ─────────────────────────────
function rendreSequentiel(d){
  var reste = d.questions.filter(function(q){ return !q.ma_reponse; });
  var errId = "err-qn-" + d.seance_id;
  marquerEtape("qn-" + d.seance_id, !reste.length);

  if (!reste.length) {
    // La carte reste, repliée. La faire disparaître se lit comme un bogue :
    // « il était là tout à l'heure ».
    zoneQ(d, ".qn-av").textContent = "";
    zoneQ(d, ".cn-int").textContent = "";
    zoneQ(d, ".appel-choix").innerHTML = "";
    erreur(errId, "C'est fait, merci — les " + d.questions.length +
                  " questions sont répondues.", true);
    return;
  }
  erreur(errId, "");

  var q = reste[0], faites = d.questions.length - reste.length;
  zoneQ(d, ".qn-av").textContent = "Question " + (faites + 1) + " sur " + d.questions.length + ".";
  zoneQ(d, ".cn-int").textContent = typo(q.intitule || q.question);

  var choix = zoneQ(d, ".appel-choix");
  choix.innerHTML = "";
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!q.options || !q.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt";
    b.textContent = q.options[i];
    b.addEventListener("click", function(){
      var boutons = choix.querySelectorAll("button");
      Array.prototype.forEach.call(boutons, function(x){ x.disabled = true; });
      sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                           p_reponse: lettre }).then(function(rr){
        if (rr.error) {
          erreur(errId, texteEnvoi(rr.error));
          signalerSessionPerimee(rr.error);
          Array.prototype.forEach.call(boutons, function(x){ x.disabled = false; });
          return;
        }
        // On avance sur l'objet local : pas d'aller-retour entre deux questions.
        q.ma_reponse = lettre;
        rendreSequentiel(d);
      });
    });
    choix.appendChild(b);
  });
}

// ── Mode révisable — tout à l'écran, modifiable ──────────────────────────
function rendreRevisable(d){
  var errId = "err-qn-" + d.seance_id;
  erreur(errId, "");
  marquerEtape("qn-" + d.seance_id, (d.faites || 0) >= d.total);
  var av = zoneQ(d, ".qn-av");
  var compter = function(){
    av.textContent = d.faites
      ? "Vous avez répondu à " + d.faites + " question" + (d.faites > 1 ? "s" : "") +
        " sur " + d.total + "."
      : "";
  };
  compter();

  var z = zoneQ(d, ".appel-choix");
  z.className = "";                       // pas la grille de l'appel : des blocs
  z.innerHTML = "";
  d.questions.forEach(function(q){
    var bloc = document.createElement("div");
    bloc.className = "st-q";
    var t = document.createElement("span");
    t.className = "cn-int";
    t.textContent = typo(q.intitule || q.question);
    bloc.appendChild(t);

    var opts = document.createElement("div");
    opts.className = "st-opts";
    ["A","B","C","D"].forEach(function(lettre, i){
      if (!q.options || !q.options[i]) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "st-opt" + (q.ma_reponse === lettre ? " pris" : "");
      b.textContent = q.options[i];
      b.addEventListener("click", function(){
        if (q.ma_reponse === lettre) return;      // déjà dit : rien à réécrire
        var tous = opts.querySelectorAll("button");
        Array.prototype.forEach.call(tous, function(x){ x.disabled = true; });
        sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                             p_reponse: lettre }).then(function(rr){
          Array.prototype.forEach.call(tous, function(x){ x.disabled = false; });
          if (rr.error) {
            erreur(errId, texteEnvoi(rr.error));
            signalerSessionPerimee(rr.error);
            return;
          }
          var neuf = !q.ma_reponse;
          q.ma_reponse = lettre;
          if (neuf) d.faites = (d.faites || 0) + 1;
          Array.prototype.forEach.call(tous, function(x){ x.className = "st-opt"; });
          b.className = "st-opt pris";
          compter();
          marquerEtape("qn-" + d.seance_id, (d.faites || 0) >= d.total);
          erreur(errId, d.faites >= d.total
            ? "C'est à jour. Revenez le modifier dès que la situation change."
            : "Enregistré.", true);
        });
      });
      opts.appendChild(b);
    });
    bloc.appendChild(opts);
    z.appendChild(bloc);
  });
}

// ── Mode révision — une question à la fois, et la correction après ───────
// La troisième carte étudiante, et la seule qui corrige. Elle existe parce
// qu'aucune des deux autres ne pouvait servir à réviser une interro :
//   · le contrôle d'entrée ne montre jamais la correction — c'est voulu, il
//     mesure un point de départ, et « faux » avant la séance est une sanction ;
//   · le questionnaire ordinaire porte bonne_reponse = 'Z' : rien n'est juste,
//     donc il n'y a rien à corriger.
// Réviser, c'est l'inverse : répondre, se tromper, voir pourquoi, recommencer.
//
// La base ne livre `bonne` et `explication` que sur les questions DÉJÀ
// répondues — mes_questionnaires() s'en charge, et c'est elle qui tient la
// règle, pas cet écran : la fonction est appelée avec la clé publique, un
// étudiant curieux lirait sinon la grille entière avant de commencer.
//
// La carte ne se replie pas quand tout est répondu, contrairement aux deux
// autres : un questionnaire de révision se refait, et le refermer sur un
// « c'est fait » enlèverait exactement ce qu'on vient d'y mettre.
function rendreRevision(d){
  var errId = "err-qn-" + d.seance_id;
  erreur(errId, "");

  // On reprend là où l'étudiant s'est arrêté, pas au début : revenir sur ce
  // qu'il a déjà fait pour atteindre la suite est ce qui fait abandonner.
  if (d._i === undefined) {
    var i = 0;
    while (i < d.questions.length && d.questions[i].ma_reponse) i++;
    d._i = i < d.questions.length ? i : 0;
  }
  if (d._i >= d.questions.length) d._i = 0;

  var q = d.questions[d._i];
  var justes = d.questions.filter(function(x){ return x.juste === true; }).length;
  var faites = d.questions.filter(function(x){ return x.ma_reponse; }).length;

  var av = zoneQ(d, ".qn-av");
  av.textContent = "Question " + (d._i + 1) + " sur " + d.questions.length +
    (faites ? " — " + justes + " juste" + (justes > 1 ? "s" : "") +
              " sur " + faites + " répondue" + (faites > 1 ? "s" : "") + "." : ".");

  zoneQ(d, ".cn-int").textContent = typo(q.intitule || q.question);

  var choix = zoneQ(d, ".appel-choix");
  choix.className = "appel-choix";
  choix.innerHTML = "";

  var repondu = !!q.ma_reponse;
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!q.options || !q.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt rv-opt";
    b.textContent = q.options[i];
    if (repondu) {
      b.disabled = true;
      if (q.bonne === lettre) b.className += " juste";
      else if (q.ma_reponse === lettre) b.className += " rate";
    } else {
      b.addEventListener("click", function(){
        var tous = choix.querySelectorAll("button");
        Array.prototype.forEach.call(tous, function(x){ x.disabled = true; });
        sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                             p_reponse: lettre }).then(function(rr){
          if (rr.error) {
            erreur(errId, texteEnvoi(rr.error));
            signalerSessionPerimee(rr.error);
            Array.prototype.forEach.call(tous, function(x){ x.disabled = false; });
            return;
          }
          // La correction ne s'invente pas ici : on redemande la liste, et la
          // base décide de ce qu'elle livre. Deviner la bonne réponse côté
          // page voudrait dire l'y avoir envoyée — donc l'avoir publiée.
          rafraichirRevision(d);
        });
      });
    }
    choix.appendChild(b);
  });

  // Un seul bloc après les options, vidé à chaque rendu. Insérer verdict,
  // explication et boutons directement dans la carte les y empilerait : douze
  // questions plus tard, la carte porterait douze corrections.
  var apres = $("qn-" + d.seance_id).querySelector(".rv-apres");
  if (!apres) {
    apres = document.createElement("div");
    apres.className = "rv-apres";
    choix.parentNode.appendChild(apres);
  }
  apres.innerHTML = "";

  var suite = document.createElement("div");
  suite.className = "rv-suite";

  if (repondu) {
    var v = document.createElement("p");
    v.className = "rv-verdict " + (q.juste ? "juste" : "rate");
    v.textContent = q.juste ? "Juste." : "Ce n'était pas ça.";
    apres.appendChild(v);
    if (q.explication) {
      var e = document.createElement("p");
      e.className = "rv-expl";
      e.textContent = typo(q.explication);
      apres.appendChild(e);
    }

    var dernier = d._i >= d.questions.length - 1;
    var b1 = document.createElement("button");
    b1.type = "button";
    b1.className = "btn";
    b1.textContent = dernier ? "Revenir à la première" : "Question suivante";
    b1.addEventListener("click", function(){
      d._i = dernier ? 0 : d._i + 1;
      rendreRevision(d);
    });
    suite.appendChild(b1);

    if (faites >= d.questions.length) {
      var s = document.createElement("span");
      s.className = "rv-score";
      s.textContent = justes + " sur " + d.questions.length +
        ". Vous pouvez tout refaire : rien n'est noté ici.";
      suite.appendChild(s);
    }
  }

  apres.appendChild(suite);

  // La file d'attente ne compte pas la révision : elle n'a pas de fin, et un
  // bandeau qui réclame indéfiniment une carte qu'on peut refaire à volonté se
  // lirait comme un reproche. Mais on ne la marque SURTOUT PAS « faite » :
  // `data-fait="oui"` masque l'intitulé et les options (voir la règle CSS
  // `.etape[data-fait="oui"] > .appel-choix`), et la carte se réduirait à son
  // titre — visible, et impossible à utiliser. C'est le défaut du 16/09.
  var carte = $("qn-" + d.seance_id);
  if (carte) {
    carte.setAttribute("data-hors-file", "oui");
    carte.setAttribute("data-fait", "non");
  }
  majFile();
}

// Une seule question a changé, mais on relit la liste entière : c'est la base
// qui décide quelle correction sort, et la refabriquer ici demanderait de
// l'avoir. Un appel de plus par réponse, sur un questionnaire qu'on fait chez
// soi — le coût est nul comparé à publier la grille.
function rafraichirRevision(d){
  sb.rpc("mes_questionnaires").then(function(r){
    var frais = null;
    if (r && !r.error && r.data && r.data.ok) {
      (r.data.liste || []).forEach(function(x){
        if (x.seance_id === d.seance_id) frais = x;
      });
    }
    if (!frais) { erreur("err-qn-" + d.seance_id, "Réessayez dans un instant."); return; }
    d.questions = frais.questions;
    d.faites = frais.faites;
    d.justes = frais.justes;
    rendreRevision(d);
  });
}

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


// Une réponse « évaluée » est celle qui a un corrigé : on ne calcule le taux
// de réussite que sur celles-là. Une mission cochée n'est pas une bonne réponse.
function estEvaluee(r){
  // L'humeur se répond, elle ne se réussit pas : elle n'entre dans aucun taux.
  if (r.question && r.question.indexOf("humeur-") === 0) return false;
  return r.correct === true || r.correct === false || r.reponse === "ok" || r.reponse === "ko";
}
function estJuste(r){
  return r.correct === true || r.reponse === "ok";
}

function chargerStats(){
  if (!suivi.classeId || !suivi.seanceId) return Promise.resolve(null);
  return Promise.all([
    sb.from("eleves").select("id,numero,avatar,auth_id").eq("classe_id", suivi.classeId)
      .neq("numero", "99").order("numero"),
    sb.from("reponses").select("eleve_id,question,correct,reponse,updated_at")
      .eq("seance_id", suivi.seanceId),
    // La colonne « intitule » est facultative : si elle n'existe pas, on relit sans.
    sb.from("corriges").select("question,bonne_reponse,intitule,options,explication").eq("seance_id", suivi.seanceId)
      .then(function(r){
        return r.error
          ? sb.from("corriges").select("question,bonne_reponse").eq("seance_id", suivi.seanceId)
          : r;
      })
  ]).then(function(res){
    var eleves = res[0].data || [];
    // Le contrôle d'entrée vit sur la même séance, sous des clés « pre- ».
    // L'inclure ferait compter deux fois : une progression de 20/10, et un
    // taux de réussite qui mélange ce qu'ils savaient avant et ce qu'ils ont
    // appris pendant. Les fonctions SQL font le même tri de leur côté.
    var horsControle = function(x){ return !/^pre-/.test(x.question || ""); };
    var reps = (res[1].data || []).filter(horsControle);
    var cor  = (res[2].data || []).filter(horsControle);

    var par = {};
    reps.forEach(function(r){
      var e = par[r.eleve_id] ||
              (par[r.eleve_id] = { n: 0, ev: 0, ok: 0, ok_mission: 0, maj: null, serie: 0, liste: [] });
      e.n++;
      // Un jalon franchi, c'est une case cochée sur le tableau de bord
      // PlaylistApp : une clé qui commence par « tp », dont la réponse vaut
      // « true ». Le quiz, lui, s'enregistre en « ok » / « ko » sous une clé
      // « q-… » — il compte dans le taux de réussite, pas dans l'avancement.
      // Ne pas restreindre aux clés « -m » : les 29 items du parcours
      // comprennent aussi tp0-1 à tp0-3, les fiches concept « -c0 » et les
      // mises en route « -s1 » / « -s2 ».
      if (/^tp/.test(r.question || "") && (r.reponse === "true" || r.reponse === "ok")) {
        e.ok_mission = (e.ok_mission || 0) + 1;
      }
      if (estEvaluee(r)) { e.ev++; if (estJuste(r)) e.ok++; }
      if (!e.maj || r.updated_at > e.maj) e.maj = r.updated_at;
      e.liste.push(r);
    });

    // Série en cours : bonnes réponses consécutives en fin de parcours.
    Object.keys(par).forEach(function(k){
      var l = par[k].liste.filter(estEvaluee).sort(function(a, b){
        return a.updated_at < b.updated_at ? -1 : 1;
      });
      var s = 0;
      for (var i = l.length - 1; i >= 0; i--) {
        if (estJuste(l[i])) s++; else break;
      }
      par[k].serie = s;
    });

    // Sur une séance de projet, l'avancement se mesure en MISSIONS VALIDÉES
    // sur le nombre de jalons déclarés — pas en nombre de lignes reçues. Sans
    // cela le BTS2 comptait aussi les questions de jalon et les missions en
    // échec, et le pourcentage n'avait plus de sens.
    var projet = suivi.nature === "projet";
    if (projet) {
      Object.keys(par).forEach(function(k){ par[k].n = par[k].ok_mission || 0; });
    }
    var maxN = 0;
    Object.keys(par).forEach(function(k){ if (par[k].n > maxN) maxN = par[k].n; });
    var total = projet ? Math.max(Number(suivi.jalons) || maxN, 1)
                       : Math.max(cor.length, maxN, 1);

    var lignes = eleves.map(function(el){
      var p = par[el.id] || { n: 0, ev: 0, ok: 0, ok_mission: 0, maj: null, serie: 0 };
      return {
        id: el.id, numero: el.numero, avatar: el.avatar || "•",
        connecte: !!el.auth_id, n: p.n, ev: p.ev, ok: p.ok, maj: p.maj, serie: p.serie,
        pct: Math.round(p.n / total * 100),
        reussite: p.ev ? Math.round(p.ok / p.ev * 100) : null
      };
    });

    // Réussite question par question : dit à l'enseignant quoi reprendre.
    var bonneDe = {}, texteDe = {};
    cor.forEach(function(c){
      bonneDe[c.question] = c.bonne_reponse;
      if (c.intitule) texteDe[c.question] = c.intitule;
    });

    var parQ = {};
    reps.forEach(function(r){
      if (!estEvaluee(r)) return;
      var q = parQ[r.question] ||
              (parQ[r.question] = { nom: r.question, n: 0, ok: 0,
                                    bonne: bonneDe[r.question] || null,
                                    texte: texteDe[r.question] || null, choix: {} });
      q.n++;
      if (estJuste(r)) q.ok++;
      // Répartition des réponses données, pour l'écran « Répartition »
      var v = (r.reponse === null || r.reponse === undefined) ? "—" : String(r.reponse);
      q.choix[v] = (q.choix[v] || 0) + 1;
    });
    var questions = Object.keys(parQ).map(function(k){
      var q = parQ[k];
      q.pct = Math.round(q.ok / q.n * 100);
      return q;
    }).sort(function(a, b){
      return (a.pct - b.pct) || (a.nom < b.nom ? -1 : 1);
    });

    var actifs = lignes.filter(function(l){ return l.n > 0; });
    var totalEv = lignes.reduce(function(s, l){ return s + l.ev; }, 0);
    var totalOk = lignes.reduce(function(s, l){ return s + l.ok; }, 0);

    return {
      lignes: lignes, total: total, questions: questions,
      inscrits: lignes.length,
      actifs: actifs.length,
      reponses: lignes.reduce(function(s, l){ return s + l.n; }, 0),
      reussite: totalEv ? Math.round(totalOk / totalEv * 100) : null,
      avancement: lignes.length ? Math.round(
        lignes.reduce(function(s, l){ return s + l.pct; }, 0) / lignes.length) : 0
    };
  });
}

function tuile(valeur, libelle){
  return '<div class="tuile"><div class="tuile-v">' + valeur +
         '</div><div class="tuile-l">' + libelle + '</div></div>';
}

function rendreSuivi(s){
  suivi.stats = s;
  $("stats-attente").hidden = true;
  $("stats-zone").hidden = false;

  // Une séance vide n'est pas une panne : on dit pourquoi, et quoi faire.
  var guide = $("stats-guide");
  if (s.reponses === 0) {
    guide.hidden = false;
    guide.classList.toggle("ok", !!suivi.ouverte);
    guide.innerHTML = suivi.ouverte
      ? "Aucune réponse pour l'instant, et c'est normal : la séance est " +
        "<b>ouverte</b> mais personne n'a encore commencé. Les compteurs se " +
        "rempliront dès les premières réponses de vos élèves."
      : "Aucune réponse, et cette séance est <b>fermée</b> : personne ne peut " +
        "y répondre. Pour l'ouvrir, exécutez dans l'éditeur SQL de Supabase :<br>" +
        "<code>update public.seances set ouverte = true where id = " +
        suivi.seanceId + ";</code>";
  } else {
    guide.hidden = true;
  }

  $("tuiles").innerHTML =
    tuile(s.actifs + " / " + s.inscrits, "en activité") +
    tuile(s.reponses, "réponses") +
    tuile(s.avancement + " %", "avancement moyen") +
    tuile(s.reussite === null ? "—" : s.reussite + " %", "de réussite");

  rendreRythme(s);

  // ── Réussite par question ──
  var q = $("liste-questions");
  q.innerHTML = "";
  if (!s.questions.length) {
    q.innerHTML = '<p class="sous-hint">Aucune question corrigée pour l\'instant. ' +
                  'Ce panneau se remplit dès les premières réponses évaluées.</p>';
  }
  s.questions.forEach(function(qu){
    var t = qu.pct >= 70 ? " bien" : (qu.pct < 40 ? " faible" : "");
    var d = document.createElement("div");
    d.className = "q";
    d.innerHTML =
      '<span class="q-nom"></span>' +
      '<span class="q-barre"><span class="q-fill' + t + '" style="width:' + qu.pct + '%"></span></span>' +
      '<span class="q-pct"></span>';
    d.querySelector(".q-nom").textContent = qu.nom;
    d.querySelector(".q-pct").textContent = qu.ok + "/" + qu.n + " · " + qu.pct + " %";
    q.appendChild(d);
  });

  // ── Élève par élève ──
  var tri = $("pk-tri").value;
  var lignes = s.lignes.slice().sort(function(a, b){
    if (tri === "avancement") return (a.pct - b.pct) || (a.numero < b.numero ? -1 : 1);
    if (tri === "reussite") {
      var ra = a.reussite === null ? 999 : a.reussite;
      var rb = b.reussite === null ? 999 : b.reussite;
      return (ra - rb) || (a.numero < b.numero ? -1 : 1);
    }
    return a.numero < b.numero ? -1 : 1;
  });

  var c = $("liste-eleves");
  c.innerHTML = "";
  lignes.forEach(function(l){
    var d = document.createElement("div");
    d.className = "el" + (l.n === 0 ? " absent" : "");
    var teinte = l.reussite === null ? "" :
                 (l.reussite >= 70 ? " bien" : (l.reussite < 40 ? " faible" : ""));
    var etat = l.n === 0 ? ["chip-rien", "pas commencé"]
             : (l.n >= s.total ? ["chip-fini", "terminé"] : ["chip-cours", "en cours"]);
    d.innerHTML =
      '<span class="el-av"></span>' +
      '<span class="el-num"></span>' +
      '<span class="el-barre"><span class="el-fill' + teinte + '" style="width:' + l.pct + '%"></span></span>' +
      '<span class="el-chiffres"></span>' +
      '<span class="chip ' + etat[0] + '"></span>' +
      '<span class="el-maj"></span>';
    d.querySelector(".el-av").textContent = l.avatar;
    d.querySelector(".el-num").textContent = l.numero;
    d.querySelector(".el-chiffres").textContent =
      l.n + "/" + s.total + (l.reussite === null ? "" : " · " + l.reussite + " %");
    d.querySelector(".chip").textContent = etat[1];
    d.querySelector(".el-maj").textContent = l.maj
      ? new Date(l.maj).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "";
    c.appendChild(d);
  });

  if (suivi.ecran) rendreEcran(s);
}

function rafraichir(){
  return chargerStats().then(function(s){ if (s) rendreSuivi(s); });
}

function lancerBoucle(){
  arreterBoucle();
  suivi.minuteur = setInterval(rafraichir, 8000);
}
function arreterBoucle(){
  if (suivi.minuteur) { clearInterval(suivi.minuteur); suivi.minuteur = null; }
}

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


function lireNoms(){
  try { return JSON.parse(localStorage.getItem(NOMS_CLE) || "{}"); }
  catch (e) { return {}; }
}

function nomDe(codeClasse, numero){
  var m = lireNoms()[codeClasse];
  if (!m) return "";
  var n = String(numero || "").trim();
  return m[n] || m[n.replace(/^0+/, "")] || m[("0" + n).slice(-2)] || "";
}

function enregistrerNoms(texte){
  var map = lireNoms(), lus = 0, ignores = 0;
  String(texte || "").split(/\r?\n/).forEach(function(ligne){
    if (!ligne.trim()) return;
    var p = ligne.split(/[;\t]/).map(function(x){ return x.trim(); });
    if (p.length < 3 || !p[0] || !p[1] || !p[2]) { ignores++; return; }
    (map[p[0]] = map[p[0]] || {})[p[1]] = p[2];
    lus++;
  });
  try { localStorage.setItem(NOMS_CLE, JSON.stringify(map)); }
  catch (e) { return { erreur: true }; }
  return { lus: lus, ignores: ignores };
}

// ── L'appel du jour — présents et absents, à part du reste ────────────────
// L'appel répond à « qui est là ? », le tableau de bord à « où en sont-ils ? ».
// Deux questions différentes : deux blocs, pour qu'on ne lise pas l'une en
// croyant lire l'autre. Et toutes les classes ensemble : l'appel ne dépend pas
// de la séance qu'on est en train de regarder plus bas.
function chargerAppelToutesClasses(classes){
  var carte = $("carte-appel"), z = $("appel-classes");
  z.innerHTML = "";
  carte.hidden = true;
  if (!classes || !classes.length) return;

  var restant = classes.length, affiches = 0, absentsTotal = 0;
  pastilleAppel(null);

  // Les blocs sont créés dans l'ordre des classes puis remplis à l'arrivée
  // des réponses : l'ordre à l'écran ne dépend pas de la vitesse du réseau.
  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "appel-classe";
    bloc.hidden = true;
    z.appendChild(bloc);

    sb.rpc("appel_classe", { p_classe_id: Number(c.id) }).then(function(r){
      restant--;
      var a = (r && !r.error && r.data && r.data.ok) ? r.data : null;
      // Une classe sans séance d'appel — les classes de démonstration — est
      // simplement absente de la carte plutôt que d'y occuper une ligne vide.
      if (a) {
        remplirAppelClasse(bloc, c, a); bloc.hidden = false; affiches++;
        absentsTotal += (a.absents || []).length;
      }
      if (restant === 0) {
        carte.hidden = affiches === 0;
        hisserQuestion();
        signalerNomsAbsents(classes);
        // Le nombre d'absents s'affiche sur l'onglet : c'est le seul chiffre
        // qu'on veut connaître sans avoir à ouvrir quoi que ce soit.
        pastilleAppel(affiches === 0 ? null : absentsTotal);
      }
    });
  });
}

// Les prénoms vivent dans le navigateur, jamais en base. Conséquence directe :
// chaque appareil doit les recevoir une fois — le poste de la salle, puis le
// téléphone. Sans eux, l'appel se fait au numéro et rien ne l'expliquait : on
// croyait à une carte cassée plutôt qu'à une liste jamais collée.
function signalerNomsAbsents(classes){
  var z = $("ac-sans-noms");
  if (!z) return;
  var noms = lireNoms();
  var sans = (classes || []).filter(function(c){
    var m = noms[c.code];
    return !m || !Object.keys(m).length;
  });
  z.innerHTML = "";
  z.hidden = !sans.length;
  if (!sans.length) return;

  var d = document.createElement("div");
  d.className = "msg";
  d.textContent = (sans.length === 1
    ? "Aucun nom chargé pour " + (sans[0].nom || sans[0].code) + " : "
    : "Aucun nom chargé pour " + sans.length + " classes : ") +
    "l'appel s'affiche au numéro seul. Les noms restent dans ce navigateur, " +
    "donc chaque appareil a besoin de sa copie — le poste de la salle, puis le téléphone.";
  var b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-sec";
  b.style.marginTop = ".5rem";
  b.textContent = "Coller les noms maintenant";
  b.addEventListener("click", function(){
    var det = $("bloc-noms");
    det.hidden = false;
    det.open = true;
    det.scrollIntoView({ block: "center" });
    $("noms-saisie").focus();
  });
  d.appendChild(document.createElement("br"));
  d.appendChild(b);
  z.appendChild(d);
}

// La question du jour est la même pour toutes les classes la plupart du temps :
// c'est la question de repli, « Vous êtes là ? … », que appel_du_jour() fabrique
// quand aucune question de la banque n'a été posée. Répétée sous chaque titre de
// classe, elle coûtait deux lignes par classe — 46 px sur un téléphone, deux
// fois — pour dire deux fois la même chose, et elle poussait vers le bas le seul
// bloc qu'on vient chercher : les numéros absents.
//
// Elle monte donc en tête de carte, une seule fois, QUAND ELLE EST IDENTIQUE
// partout. Dès que deux classes n'ont pas la même — une question de la banque
// posée sur l'une seulement — chacune reprend la sienne : à ce moment-là, la
// différence est précisément l'information.
function hisserQuestion(){
  var z = $("ac-question");
  if (!z) return;
  var blocs = $("appel-classes").querySelectorAll(".appel-classe:not([hidden]) .ac-q");
  var textes = Array.prototype.map.call(blocs, function(p){ return p.textContent; });
  var toutes = textes.length > 1 && textes.every(function(t){
    return t && t === textes[0];
  });
  z.hidden = !toutes;
  z.textContent = toutes ? typo(textes[0]) : "";
  Array.prototype.forEach.call(blocs, function(p){ p.hidden = toutes; });
}

// Aucun appel lisible : pas de pastille du tout. Zéro absent : pas de pastille
// non plus — un « 0 » rouge à côté de « Appel du jour » se lirait comme un souci.
function pastilleAppel(n){
  var p = $("ong-appel-n");
  if (!p) return;
  p.hidden = !n;
  p.textContent = n ? String(n) : "";
  p.setAttribute("aria-label", n ? (n + " absents aujourd'hui") : "");
}

function remplirAppelClasse(bloc, c, a){
  bloc.innerHTML = "";
  bloc.dataset.code = c.code || "";
  bloc.dataset.nom  = c.nom || c.code || "";
  bloc.__absents = a.pose ? (a.absents || []) : null;
  var h = document.createElement("h3");
  h.textContent = c.nom || c.code;
  bloc.appendChild(h);

  var q = document.createElement("p");
  q.className = "ac-q";
  bloc.appendChild(q);

  if (!a.pose) {
    q.textContent = "Aucune question posée aujourd'hui — le premier étudiant qui " +
                    "se connectera déclenchera la question de présence.";
    return;
  }
  q.textContent = a.intitule || "";

  var pre = a.presents || [], abs = a.absents || [];

  // « 24 / 31 » se lit sans réfléchir ; « 24 présents » ne dit pas s'il en
  // manque un ou douze.
  var compte = document.createElement("p");
  compte.className = "ac-compte";
  compte.innerHTML = "<b></b> · <span></span>";
  compte.querySelector("b").textContent = a.inscrits
    ? pre.length + " / " + a.inscrits + " présents"
    : pre.length + (pre.length > 1 ? " présents" : " présent");
  compte.querySelector("span").textContent =
    abs.length ? (abs.length + (abs.length > 1 ? " absents" : " absent")) : "personne ne manque";
  bloc.appendChild(compte);

  // Les numéros en gros, avec le prénom collé à chacun quand il est connu.
  // C'est la ligne qu'on lit à voix haute : elle doit se suffire.
  bloc.appendChild(ligneAbsents(c, abs));

  // Ceux dont l'absence se répète. Une absence isolée et une quatrième
  // d'affilée demandent deux gestes différents ; la carte les distinguait
  // pas du tout.
  var suivis = abs.filter(function(x){ return (Number(x.manquees) || 0) >= 2; });
  if (suivis.length) bloc.appendChild(blocAssiduite(c, suivis, a));

  // Les arrivées : une grille de six colonnes sur un écran large, une colonne
  // de vingt-quatre lignes sur un téléphone. Repliées là, dépliées ici — ce
  // qu'on cherche en séance, c'est qui manque, pas qui est venu.
  var det = document.createElement("details");
  det.className = "ac-pre";
  det.open = window.matchMedia("(min-width: 40rem)").matches;
  var som = document.createElement("summary");
  som.textContent = pre.length + (pre.length > 1 ? " arrivées" : " arrivée") +
                    (pre.length ? " — de " + pre[0].heure + " à " + pre[pre.length - 1].heure : "");
  det.appendChild(som);
  var zp = document.createElement("div");
  zp.className = "pastilles";
  det.appendChild(zp);
  bloc.appendChild(det);
  pastilles(zp, pre, "pre", function(x){
    var n = nomDe(c.code, x.numero);
    return x.numero + " " + (x.avatar || "") + " " + x.heure + (n ? " · " + n : "");
  });

  // La rangée de pastilles d'absents a disparu : elle répétait mot pour mot
  // la ligne rouge du dessus, prénoms compris.

  var zh = document.createElement("div");
  bloc.appendChild(zh);
  rendreHumeurClasse(zh, a);
}

// « 04 Marwan   05 Sofia   07 Achille » — le numéro reste en gros, le prénom
// se glisse à côté, plus petit. Sans noms chargés dans ce navigateur, on
// retombe sur les numéros seuls et on dit comment y remédier.
function ligneAbsents(c, abs, libelle, vide){
  var nums = numerosAbsents(abs);
  var d = document.createElement("div");
  d.className = "ac-nums" + (nums.length ? "" : " vide");

  var lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = nums.length ? (libelle || "Absents") : (libelle || "Appel");
  d.appendChild(lbl);

  var v = document.createElement("span");
  v.className = "nums";
  if (!nums.length) {
    v.textContent = vide || "Personne ne manque.";
  } else {
    nums.forEach(function(n){
      var u = document.createElement("span");
      u.className = "ac-u";
      var num = document.createElement("b");
      num.textContent = n;
      u.appendChild(num);
      var nom = nomDe(c.code, n);
      if (nom) {
        var pn = document.createElement("i");
        pn.className = "ac-pn";
        pn.textContent = prenomSeul(nom);
        u.appendChild(pn);
      }
      v.appendChild(u);
    });
  }
  d.appendChild(v);

  if (nums.length) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-mini";
    b.textContent = "Copier";
    b.addEventListener("click", function(){ copierTexte(nums.join(", "), b); });
    d.appendChild(b);
  }
  return d;
}

// Les listes collées viennent souvent en « NOM Prénom ». À l'oral on appelle
// par le prénom : on prend le dernier mot qui n'est pas tout en majuscules,
// et à défaut la chaîne entière — jamais rien d'inventé.
function prenomSeul(nom){
  var mots = String(nom || "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "";
  for (var i = mots.length - 1; i >= 0; i--) {
    if (mots[i] !== mots[i].toUpperCase()) return mots[i];
  }
  return mots[mots.length - 1];
}

// « 04 Marwan — 3 absences sur 4, pas vu depuis 7 jours ». La phrase dit le
// geste : trois absences sur quatre, ce n'est plus un oubli.
function blocAssiduite(c, liste, a){
  var d = document.createElement("div");
  d.className = "ac-suivi";
  var t = document.createElement("b");
  t.textContent = "Absences qui se répètent";
  d.appendChild(t);
  var ul = document.createElement("ul");
  liste.sort(function(x, y){ return (y.manquees || 0) - (x.manquees || 0); });
  liste.forEach(function(x){
    var li = document.createElement("li");
    var nom = nomDe(c.code, x.numero);
    var bouts = [x.manquees + "/" + (x.sur || a.appels_poses || x.manquees) + " absences"];
    if (x.jamais) bouts.push("jamais venu");
    else if (x.depuis !== null && x.depuis !== undefined) {
      bouts.push(x.depuis === 0 ? "vu aujourd'hui"
               : x.depuis === 1 ? "pas vu depuis hier"
               : "pas vu depuis " + x.depuis + " j");
    }
    li.innerHTML = "<b></b><span></span>";
    li.querySelector("b").textContent = x.numero + (nom ? " " + prenomSeul(nom) : "");
    // « 3/6 absences, pas vu depuis 7 j » plutôt que la phrase complète : sur
    // un téléphone, « 3 absences sur 6 » passait à la ligne et doublait la
    // hauteur du bloc. Le chiffre reste entier, c'est la formulation qui maigrit.
    li.querySelector("span").textContent = " — " + bouts.join(", ");
    ul.appendChild(li);
  });
  d.appendChild(ul);
  return d;
}

// Les numéros seuls, gros et espacés : à l'appel on lit des numéros, pas des
// noms. Les noms restent en dessous, sur les pastilles, pour lever un doute.
function numerosAbsents(abs){
  return (abs || []).map(function(x){ return String(x.numero || "").trim(); })
                    .filter(Boolean)
                    .sort(function(a, b){ return Number(a) - Number(b); });
}

function ligneNumeros(c, abs, libelle, vide){
  var nums = numerosAbsents(abs);
  var d = document.createElement("div");
  d.className = "ac-nums" + (nums.length ? "" : " vide");
  var lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = nums.length ? (libelle || "Absents") : (libelle || "Appel");
  var v = document.createElement("span");
  v.className = "nums";
  v.textContent = nums.length ? nums.join("  ") : (vide || "Personne ne manque.");
  d.appendChild(lbl);
  d.appendChild(v);
  if (nums.length) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-mini";
    b.textContent = "Copier";
    b.addEventListener("click", function(){
      copierTexte(nums.join(", "), b);
    });
    d.appendChild(b);
  }
  return d;
}

// Une seule mécanique de copie, pour le bouton de classe comme pour le global.
function copierTexte(texte, bouton){
  var dit = function(ok){
    if (bouton) {
      var avant = bouton.textContent;
      bouton.textContent = ok ? "Copié" : "Échec";
      setTimeout(function(){ bouton.textContent = avant; }, 1600);
    }
    return ok;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texte).then(function(){ return dit(true); },
                                                     function(){ return dit(false); });
  }
  return Promise.resolve(dit(false));
}

// ── Le questionnaire de rentrée, côté enseignant ───────────────────────────
// Une répartition par question, et sous chaque option les numéros de ceux qui
// l'ont choisie : c'est ce qui distingue un camembert d'une information. Savoir
// que trois étudiants n'ont pas d'ordinateur ne sert à rien si on ignore
// lesquels.
function chargerConnaissance(classes){
  var carte = $("carte-connaissance"), z = $("conn-classes");
  z.innerHTML = "";
  carte.hidden = true;
  if (!classes || !classes.length) return;

  var restant = classes.length, affiches = 0;
  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "appel-classe";
    bloc.hidden = true;
    z.appendChild(bloc);

    sb.rpc("connaissance_classe", { p_classe_id: Number(c.id) }).then(function(r){
      restant--;
      var d = (r && !r.error && r.data && r.data.ok) ? r.data : null;
      if (d) { remplirConnaissanceClasse(bloc, c, d); bloc.hidden = false; affiches++; }
      if (restant === 0) carte.hidden = affiches === 0;
    });
  });
}

// Les réponses qui demandent une décision pédagogique, pas seulement une
// statistique. Ajouter une ligne ici suffit à faire remonter un signal.
var SIGNAUX = [
  { q: "conn-04", lettres: ["C","D"], quoi: "pas d'ordinateur à la maison" },
  { q: "conn-05", lettres: ["C","D"], quoi: "connexion faible ou absente" },
  { q: "conn-02", lettres: ["A"],     quoi: "n'a jamais écrit de code" },
  { q: "conn-06", lettres: ["A"],     quoi: "moins d'une heure de travail perso par semaine" },
  { q: "conn-11", lettres: ["D"],     quoi: "s'arrête et attend quand il bloque" },
  { q: "conn-07", lettres: ["D"],     quoi: "orientation par défaut" }
];

function remplirConnaissanceClasse(bloc, c, d){
  bloc.innerHTML = "";
  var h = document.createElement("h3");
  h.textContent = c.nom || c.code;
  bloc.appendChild(h);

  var nq = Number(d.total_questions) || 0;
  var compte = document.createElement("p");
  compte.className = "ac-compte";
  compte.innerHTML = "<b></b> · <span class=\"hint\"></span>";
  compte.querySelector("b").textContent =
    (d.termines || 0) + " / " + (d.inscrits || 0) + " ont terminé";
  compte.querySelector("span").textContent = nq + " questions";
  bloc.appendChild(compte);

  // Ceux qui n'ont pas fini : les numéros d'abord, comme pour l'appel.
  var pas = (d.eleves || []).filter(function(e){ return (Number(e.faites) || 0) < nq; });
  bloc.appendChild(ligneNumeros(c, pas.map(function(e){ return { numero: e.numero }; }),
                                "À relancer", "Tout le monde a répondu."));

  (d.questions || []).forEach(function(q){
    bloc.appendChild(rendreQuestionConnaissance(c, q));
  });

  var sig = rendreSignaux(c, d);
  if (sig) bloc.appendChild(sig);
}

function rendreQuestionConnaissance(c, q){
  var z = document.createElement("div");
  z.className = "cn-q";
  var t = document.createElement("span");
  t.className = "cn-int";
  t.textContent = typo(q.intitule || q.question);
  z.appendChild(t);

  var lettres = ["A","B","C","D"], compte = q.compte || {}, qui = q.qui || {};
  var total = lettres.reduce(function(s, l){ return s + (Number(compte[l]) || 0); }, 0);
  if (!total) {
    var v = document.createElement("p");
    v.className = "hint";
    v.style.margin = "0";
    v.textContent = "Aucune réponse pour l'instant.";
    z.appendChild(v);
    return z;
  }

  (q.options || []).forEach(function(libelle, i){
    var l = lettres[i], n = Number(compte[l]) || 0;
    var ligne = document.createElement("div");
    ligne.className = "jalon";
    ligne.innerHTML = '<span class="jalon-n"></span><span class="jalon-b"></span><span></span>';
    ligne.querySelector(".jalon-n").textContent = l + " · " + n;
    ligne.querySelector(".jalon-b").style.width = Math.round(n / total * 45) + "%";
    ligne.querySelector("span:last-child").textContent = libelle;
    z.appendChild(ligne);

    var nums = qui[l] || [];
    if (nums.length) {
      var d2 = document.createElement("div");
      d2.className = "cn-nums";
      d2.textContent = nums.join(" ");
      z.appendChild(d2);
    }
  });
  return z;
}

function rendreSignaux(c, d){
  var parCle = {};
  (d.questions || []).forEach(function(q){ parCle[q.question] = q; });

  var lignes = [];
  SIGNAUX.forEach(function(sg){
    var q = parCle[sg.q];
    if (!q) return;
    var nums = [];
    sg.lettres.forEach(function(l){ nums = nums.concat((q.qui || {})[l] || []); });
    nums = numerosAbsents(nums.map(function(n){ return { numero: n }; }));
    if (nums.length) lignes.push({ quoi: sg.quoi, nums: nums });
  });
  if (!lignes.length) return null;

  var z = document.createElement("div");
  z.className = "cn-sig";
  var h = document.createElement("h4");
  h.textContent = "À prendre en compte";
  z.appendChild(h);
  var ul = document.createElement("ul");
  lignes.forEach(function(x){
    var li = document.createElement("li");
    var b = document.createElement("b");
    b.textContent = x.nums.map(function(n){
      var nom = nomDe(c.code, n);
      return nom ? n + " " + nom : "n° " + n;
    }).join(", ");
    li.appendChild(b);
    li.appendChild(document.createTextNode(" — " + x.quoi));
    ul.appendChild(li);
  });
  z.appendChild(ul);
  return z;
}

// ── « Le semestre » — la question à laquelle aucune carte ne répondait ─────
// Le portail savait tout dire d'UNE séance et rien de l'ensemble. Savoir si la
// séance 7 avait son corrigé se lisait dans un tableau tenu à la main, donc
// faux au bout de trois semaines. Ici l'état est calculé, il ne se décide pas.
var SEM_ETAT = {
  a_produire: "à produire",
  prete:      "prête",
  en_cours:   "en cours",
  jouee:      "jouée"
};

function chargerSemestre(){
  var carte = $("carte-semestre");
  carte.hidden = true;
  sb.rpc("semestre").then(function(r){
    // Fonction pas déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) return;
    // semestre() ne connaît pas la distinction : le tri se fait ici, comme
    // partout ailleurs dans l'espace enseignant.
    rendreSemestre(classesReelles(r.data.classes || []));
    carte.hidden = false;
  });
}

function rendreSemestre(classes){
  var z = $("sem-classes");
  z.innerHTML = "";
  if (!classes.length) {
    z.innerHTML = '<p class="hint" style="margin:0">Aucune séance à afficher.</p>';
    return;
  }

  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "sem-c";

    var h = document.createElement("h3");
    h.textContent = c.nom || c.code;
    bloc.appendChild(h);

    var seances = c.seances || [];
    var compte = { a_produire: 0, prete: 0, en_cours: 0, jouee: 0 };
    seances.forEach(function(x){ compte[x.etat] = (compte[x.etat] || 0) + 1; });

    // Le bilan d'abord : c'est lui qu'on lit en diagonale.
    var bilan = document.createElement("p");
    bilan.className = "sem-bilan";
    var bouts = [];
    if (compte.jouee)      bouts.push("<b>" + compte.jouee + "</b> jouée" + (compte.jouee > 1 ? "s" : ""));
    if (compte.en_cours)   bouts.push("<b>" + compte.en_cours + "</b> en cours");
    if (compte.prete)      bouts.push("<b>" + compte.prete + "</b> prête" + (compte.prete > 1 ? "s" : ""));
    if (compte.a_produire) bouts.push("<b>" + compte.a_produire + "</b> à produire");
    bilan.innerHTML = bouts.join(" · ") + " — " + seances.length + " séances, " +
                      (c.inscrits || 0) + " étudiants";
    bloc.appendChild(bilan);

    seances.forEach(function(x){ bloc.appendChild(ligneSemestre(x)); });
    z.appendChild(bloc);
  });
}

function ligneSemestre(x){
  var l = document.createElement("div");
  l.className = "sem-l";

  var n = document.createElement("span");
  n.className = "sem-n";
  n.textContent = ("0" + x.numero).slice(-2);
  l.appendChild(n);

  var t = document.createElement("span");
  t.className = "sem-t";
  t.textContent = x.titre || ("Séance " + x.numero);
  t.title = x.titre || "";
  l.appendChild(t);

  if (x.notee) {
    var no = document.createElement("span");
    no.className = "sem-notee";
    no.textContent = "notée";
    l.appendChild(no);
  }

  var e = document.createElement("span");
  e.className = "sem-e " + (x.etat || "");
  e.textContent = SEM_ETAT[x.etat] || x.etat || "";
  l.appendChild(e);

  // Les chiffres, seulement quand ils veulent dire quelque chose. Un « 0/31 ·
  // — % » sur une séance pas encore écrite n'apprend rien et fait du bruit.
  var bouts = [];
  if (x.etat === "a_produire") {
    bouts.push("aucun corrigé");
  } else {
    if (x.repondants) bouts.push(x.repondants + "/" + (x.inscrits || "?"));
    if (x.avancement !== null && x.avancement !== undefined) bouts.push(x.avancement + " % fait");
    else if (x.reussite !== null && x.reussite !== undefined) bouts.push(x.reussite + " % juste");
    if (x.dernier) bouts.push(x.dernier);
  }
  var v = document.createElement("span");
  v.className = "sem-x";
  v.textContent = bouts.join(" · ");
  l.appendChild(v);

  // Publier, c'est décider si les étudiants ont le droit de LIRE la séance sur
  // le site du cours — ce n'est pas « ouverte », qui décide s'ils peuvent y
  // répondre. Le 09/09, la séance 2 était lisible le jour de la séance 1 :
  // rien ne l'empêchait, le sommaire du site liste tout ce qui est écrit.
  //
  // « Démarrer la séance » publie déjà : ce bouton-ci sert aux exceptions —
  // ouvrir en avance à un absent, refermer un brouillon parti trop tôt.
  if (x.seance_id && x.numero < 90) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "sem-pub" + (x.publiee ? " on" : "");
    b.textContent = x.publiee ? "Visible" : "Cachée";
    b.title = x.publiee
      ? "Les étudiants peuvent lire cette séance. Cliquer pour la cacher."
      : "Les étudiants ne voient pas cette séance. Cliquer pour la rendre visible.";
    b.setAttribute("aria-pressed", x.publiee ? "true" : "false");
    b.setAttribute("aria-label", (x.publiee ? "Cacher" : "Rendre visible") +
                   " la séance " + x.numero + " — " + (x.titre || ""));
    b.addEventListener("click", function(){
      var vise = !b.classList.contains("on");
      b.disabled = true;
      sb.rpc("publier_seance", { p_seance_id: Number(x.seance_id),
                                 p_publiee: vise }).then(function(r){
        b.disabled = false;
        if (!r || r.error || !r.data || !r.data.ok) {
          erreur("err-semestre", "Action refusée. Vérifiez que vous êtes bien " +
                                 "connecté en enseignant.");
          return;
        }
        x.publiee = vise;
        b.classList.toggle("on", vise);
        b.textContent = vise ? "Visible" : "Cachée";
        b.setAttribute("aria-pressed", vise ? "true" : "false");
        erreur("err-semestre", "Séance " + x.numero + " — " +
               (vise ? "visible par les étudiants." : "cachée aux étudiants."), true);
      });
    });
    l.appendChild(b);
  }
  return l;
}

// ── « À faire » — la seule liste qui ne peut pas mentir ────────────────────
// Elle n'est stockée nulle part : a_faire() la recalcule depuis l'état réel de
// la base. On ne coche rien, on corrige, et la ligne disparaît d'elle-même.
// Une liste qu'on doit tenir à jour à la main finit toujours par être fausse,
// et une liste fausse est pire que pas de liste.
function chargerAFaire(){
  var carte = $("carte-afaire"), titre = document.querySelector(".epingle");
  carte.hidden = true;
  if (titre) titre.hidden = true;
  sb.rpc("a_faire").then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme avant.
    // Le titre suit la carte — un intertitre au-dessus de rien se lit comme
    // une panne, alors que c'est seulement une fonction non déployée.
    if (!r || r.error || !r.data || !r.data.ok) return;
    rendreAFaire(r.data);
    carte.hidden = false;
    if (titre) titre.hidden = false;
  });
}

var AF_ICONE = { bloquant: "⛔", attention: "⚠️", info: "ℹ️" };

function rendreAFaire(d){
  var b = Number(d.bloquants) || 0, a = Number(d.attentions) || 0;
  var etat = $("af-etat");
  if (b) {
    etat.className = "af-pastille bloc";
    etat.textContent = b + (b > 1 ? " points bloquants" : " point bloquant");
  } else if (a) {
    etat.className = "af-pastille att";
    etat.textContent = a + (a > 1 ? " points de vigilance" : " point de vigilance");
  } else {
    etat.className = "af-pastille rien";
    etat.textContent = "Rien à signaler";
  }

  var z = $("af-liste");
  z.innerHTML = "";
  var taches = d.taches || [];
  if (!taches.length) {
    z.innerHTML = '<p class="hint" style="margin:.3rem 0 0">Les séances sont ouvertes ' +
                  'quand il faut, les corrigés sont là, tout le monde a un code.</p>';
    return;
  }

  // Une information qui ne demande aucun geste n'est pas une tâche. Le 16/09,
  // « Question du jour pas encore créée » occupait, au téléphone, autant de
  // place que « Séance 2 encore ouverte » — alors que la première se règle
  // d'elle-même à la première connexion d'un étudiant et que la seconde
  // laisse une séance ouverte toute la nuit. Deux lignes identiques pour deux
  // urgences opposées : au bout d'une semaine on ne lit plus la carte. On les
  // sépare donc — ce qui réclame un geste en haut, le reste en pied de carte,
  // toujours écrit, mais à sa place. Rien n'est supprimé : une information qui
  // porte une action ou une destination remonte avec les tâches.
  var agir = [], infos = [];
  taches.forEach(function(t){
    if (t.gravite === "info" && !t.action && !t.aller) infos.push(t); else agir.push(t);
  });

  agir.forEach(function(t){
    var l = document.createElement("div");
    l.className = "af-l";
    l.innerHTML = '<span class="af-i"></span><div class="af-c">' +
                  '<p class="af-q"><span></span><span class="af-cl"></span></p>' +
                  '<p class="af-d"></p><p class="af-g" hidden>Le geste : <b></b></p>' +
                  '<div class="af-actes"></div><p class="af-msg" hidden></p></div>';
    l.querySelector(".af-i").textContent = AF_ICONE[t.gravite] || "•";
    l.querySelector(".af-q span:first-child").textContent = t.quoi || "";
    l.querySelector(".af-cl").textContent = t.classe || t.code || "";
    l.querySelector(".af-d").textContent = t.detail || "";
    garnirActes(l, t);
    z.appendChild(l);
  });

  // Si tout ce qui reste est informatif, la carte ne doit pas paraître vide :
  // la phrase de repos passe au-dessus du pied.
  if (!agir.length) {
    var r = document.createElement("p");
    r.className = "hint";
    r.style.margin = ".3rem 0 0";
    r.textContent = "Rien qui demande un geste.";
    z.appendChild(r);
  }

  infos.forEach(function(t){
    var p = document.createElement("p");
    p.className = "af-info";
    p.innerHTML = '<span aria-hidden="true">' + AF_ICONE.info + '</span> <b></b>' +
                  '<span class="af-cl"></span><span class="af-du"></span>';
    p.querySelector("b").textContent = t.quoi || "";
    p.querySelector(".af-cl").textContent = t.classe || t.code || "";
    p.querySelector(".af-du").textContent = t.detail ? " — " + t.detail : "";
    z.appendChild(p);
  });
}

// Les trois verbes que le portail sait exécuter. Ils viennent de la base, qui
// ne renvoie qu'eux — une action inconnue arriverait ici sans bouton plutôt
// qu'avec un bouton qui ne fait rien, et la migration le vérifie de son côté.
var AF_ACTES = {
  demarrer:        { rpc: "demarrer_seance",  args: function(t){ return { p_seance_id: Number(t.seance_id) }; },
                     fini: "Séance démarrée." },
  clore:           { rpc: "clore_seance",     args: function(t){ return { p_seance_id: Number(t.seance_id) }; },
                     fini: "Séance close." },
  ouvrir_controle: { rpc: "ouvrir_controle",  args: function(t){ return { p_seance_id: Number(t.seance_id),
                                                                          p_ouvert: true }; },
                     fini: "Le contrôle est proposé aux étudiants." }
};

// Les quatre onglets où l'on peut être emmené, quand aucune action n'est
// possible. On ne supprime pas la décision — seulement le trajet.
var AF_ONGLETS = { seance: "ong-seance", ensemble: "ong-ensemble",
                   quest: "ong-quest", appel: "ong-appel" };

function garnirActes(ligne, t){
  var z = ligne.querySelector(".af-actes");
  var msg = ligne.querySelector(".af-msg");
  var acte = t.action && AF_ACTES[t.action];

  // Sans action ni destination, le geste reste écrit : il y a des cas où la
  // phrase est tout ce qu'on peut donner (« leur attribuer un code »).
  if (!acte && !t.aller) {
    if (t.geste) {
      ligne.querySelector(".af-g b").textContent = t.geste;
      ligne.querySelector(".af-g").hidden = false;
    }
    return;
  }

  if (acte) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = t.geste || "Faire";
    b.addEventListener("click", function(){
      b.disabled = true;
      erreurLigne(msg, "");
      sb.rpc(acte.rpc, acte.args(t)).then(function(r){
        var d = r && r.data;
        // Les RPC du portail répondent { ok: false, motif } plutôt que de
        // lever : un refus n'est pas une panne, et il porte sa raison.
        if (r.error || (d && d.ok === false)) {
          b.disabled = false;
          erreurLigne(msg, motifAFaire(d), true);
          return;
        }
        ligne.classList.add("fait");
        erreurLigne(msg, acte.fini);
        // La carte se recalcule depuis la base : c'est elle qui décide si la
        // ligne disparaît, pas nous. Un rafraîchissement après une seconde,
        // le temps de lire la confirmation.
        setTimeout(function(){ chargerAFaire(); rafraichirApresActe(t); }, 1100);
      });
    });
    z.appendChild(b);
  }

  if (t.aller && AF_ONGLETS[t.aller]) {
    var a = document.createElement("button");
    a.type = "button";
    a.className = "btn btn-sec";
    a.textContent = acte ? "Voir la séance" : (t.geste || "Y aller");
    a.addEventListener("click", function(){ allerDepuisAFaire(t); });
    z.appendChild(a);
  }
}

function erreurLigne(p, texte, rate){
  p.hidden = !texte;
  p.textContent = texte || "";
  p.className = "af-msg" + (rate ? " rate" : "");
}

// Un refus nommé plutôt qu'un « ça n'a pas marché » : c'est la différence
// entre réessayer bêtement et comprendre. `appel` est le seul motif que l'on
// rencontre vraiment ici — la séance 99 ne se ferme pas, et c'est verrouillé.
function motifAFaire(d){
  var m = d && d.motif;
  if (m === "appel")   return "L'appel ne se ferme pas : c'est le registre de présence.";
  if (m === "refus")   return "Votre session enseignante a expiré. Réidentifiez-vous.";
  if (m === "inconnue") return "Cette séance n'existe plus.";
  return "Le geste n'a pas abouti. Réessayez dans un instant.";
}

// Emmener au bon endroit AVEC la bonne classe et la bonne séance déjà
// choisies. Sans cela, « Y aller » ne ferait que déplacer le problème d'un
// onglet : c'est le trajet — changer d'onglet, choisir la classe, choisir la
// séance — qu'on cherche à supprimer.
function allerDepuisAFaire(t){
  var ong = $(AF_ONGLETS[t.aller]);
  if (!ong) return;
  ong.click();
  if (t.classe_id && $("pk-classe")) {
    $("pk-classe").value = String(t.classe_id);
    $("pk-classe").dispatchEvent(new Event("change"));
  }
  // La liste des séances se remplit après le changement de classe : on pose
  // la séance une fois qu'elle existe dans le sélecteur, pas avant.
  if (t.seance_id && $("pk-seance")) {
    setTimeout(function(){
      var s = $("pk-seance");
      if (!s) return;
      s.value = String(t.seance_id);
      s.dispatchEvent(new Event("change"));
      var bloc = $("prevol") || s;
      if (bloc && bloc.scrollIntoView) bloc.scrollIntoView({ block: "center" });
    }, 350);
  }
}

// Après un geste, la carte concernée doit se remettre à jour elle aussi —
// sinon on referme « Ce qui bloque » sur une carte de séance qui montre encore
// l'état d'avant, et on doute de ce qu'on vient de faire.
function rafraichirApresActe(t){
  if (String(t.seance_id) === String(suivi.seanceId)) chargerPrevol();
  if (t.action === "ouvrir_controle") chargerControles();
  chargerAppelToutesClasses(suivi.classesConnues || []);
}

// ── La recherche de stage, côté enseignant ─────────────────────────────────
// La première chose à voir n'est pas une statistique mais une liste de
// numéros par étape, du moins avancé au plus avancé : ceux qui n'ont pas
// commencé sont en haut, en rouge, parce que ce sont eux qu'il faut appeler.
function chargerStage(classes){
  var carte = $("carte-stage"), z = $("stage-classes");
  z.innerHTML = "";
  carte.hidden = true;
  if (!classes || !classes.length) return;

  var restant = classes.length, affiches = 0;
  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "appel-classe";
    bloc.hidden = true;
    z.appendChild(bloc);

    sb.rpc("stage_classe", { p_classe_id: Number(c.id) }).then(function(r){
      restant--;
      var d = (r && !r.error && r.data && r.data.ok) ? r.data : null;
      if (d) { remplirStageClasse(bloc, c, d); bloc.hidden = false; affiches++; }
      if (restant === 0) carte.hidden = affiches === 0;
    });
  });
}

function remplirStageClasse(bloc, c, d){
  bloc.innerHTML = "";
  var h = document.createElement("h3");
  h.textContent = c.nom || c.code;
  bloc.appendChild(h);

  var compte = document.createElement("p");
  compte.className = "ac-compte";
  compte.innerHTML = "<b></b> · <span class=\"hint\"></span>";
  compte.querySelector("b").textContent =
    (d.repondu || 0) + " / " + (d.inscrits || 0) + " ont fait leur point";
  compte.querySelector("span").textContent = d.maj
    ? "dernière mise à jour le " + dateCourte(d.maj) : "aucune réponse pour l'instant";
  bloc.appendChild(compte);

  // Les quatre étapes, plus ceux qui n'ont rien dit — qui comptent double,
  // puisqu'on ne sait même pas s'ils cherchent.
  var etapes = d.etapes || ["Pas commencé", "En préparation", "Candidatures envoyées", "Trouvé"];
  var lettres = ["A","B","C","D"], etats = d.etats || [];
  lettres.forEach(function(l, i){
    var gens = etats.filter(function(e){ return e.ou === l; });
    bloc.appendChild(ligneEtape(c, "et-" + i, etapes[i] || l, gens));
  });
  var muets = etats.filter(function(e){ return !e.ou; });
  bloc.appendChild(ligneEtape(c, "et-x", "N'a rien déclaré", muets));

  (d.questions || []).forEach(function(q){
    if (q.question === "stage-01") return;   // déjà lue en haut, autrement
    bloc.appendChild(rendreQuestionConnaissance(c, q));
  });
}

function ligneEtape(c, classe, libelle, gens){
  var z = document.createElement("div");
  z.className = "et-etape " + classe;
  var t = document.createElement("div");
  t.className = "et-tete";
  var b = document.createElement("b");
  b.textContent = gens.length + " · " + libelle;
  t.appendChild(b);
  z.appendChild(t);
  if (!gens.length) return z;

  var nums = document.createElement("div");
  nums.className = "et-nums";
  // Le numéro d'abord, le nom s'il est connu, la fraîcheur ensuite : on lit
  // « 07 — 12/09 » comme « ce point date d'il y a trois semaines ».
  nums.textContent = gens.map(function(e){
    var nom = nomDe(c.code, e.numero);
    return e.numero + (nom ? " " + nom : "") + (e.maj ? " (" + e.maj + ")" : "");
  }).join("   ");
  z.appendChild(nums);
  return z;
}

// Combien de chaque humeur, dans l'ordre des options. Une barre par smiley :
// on lit l'état du groupe sans avoir à compter.
// L'humeur se replie, et son résumé porte déjà la réponse.
//
// Quatre barres par classe faisaient 133 px chacune — 266 px pour deux classes,
// soit plus que le compte et les numéros absents réunis. Or l'humeur ne se lit
// pas au même moment que l'appel : l'appel est le geste de trente secondes du
// début d'heure, l'humeur est ce qu'on regarde une fois assis. La pousser sous
// un repli ne la perd pas — le résumé dit combien ont répondu et ce qui domine,
// donc l'essentiel tient sur la ligne fermée.
//
// Un total à zéro n'affiche plus rien du tout : « personne n'a encore dit son
// humeur » occupait une ligne pour ne rien apprendre sur une carte dont le
// sujet est qui est là.
function rendreHumeurClasse(z, a){
  z.innerHTML = "";
  var opts = a.humeur_options, compte = a.humeur || {};
  if (!opts || !opts.length) return;

  var lettres = ["A","B","C","D"];
  var total = lettres.reduce(function(s, l){ return s + (compte[l] || 0); }, 0);
  if (!total) return;

  // Ce qui domine, nommé : « 9 · Ça va » en dit plus que « 22 réponses ».
  var fort = 0;
  lettres.forEach(function(l, i){ if ((compte[l] || 0) > (compte[lettres[fort]] || 0)) fort = i; });

  var det = document.createElement("details");
  det.className = "ac-hum";
  var som = document.createElement("summary");
  som.textContent = "Humeur — " + total + (total > 1 ? " réponses" : " réponse") +
    (opts[fort] ? ", surtout « " + opts[fort].replace(/^\S+\s*/, "") + " »" : "");
  det.appendChild(som);

  opts.forEach(function(libelle, i){
    var n = compte[lettres[i]] || 0;
    var l = document.createElement("div");
    l.className = "jalon";
    l.innerHTML = '<span class="jalon-n"></span><span class="jalon-b"></span><span></span>';
    l.querySelector(".jalon-n").textContent = libelle.slice(0, 2);
    l.querySelector(".jalon-b").style.width = Math.round(n / total * 55) + "%";
    l.querySelector("span:last-child").textContent =
      n + " · " + libelle.replace(/^\S+\s*/, "");
    det.appendChild(l);
  });
  z.appendChild(det);
}

// Le geste du matin : la liste des absents, nommée, prête à coller dans le
// cahier d'appel. Les numéros sans nom connu restent des numéros.
function copierAbsents(){
  var blocs = $("appel-classes").querySelectorAll(".appel-classe");
  var sortie = [];
  Array.prototype.forEach.call(blocs, function(b){
    if (!b.__absents) return;
    var nums = numerosAbsents(b.__absents);
    if (!nums.length) { sortie.push(b.dataset.nom + " — aucun absent"); return; }
    // Les numéros d'abord, en clair : c'est la ligne qu'on recopie sur le
    // cahier d'appel. Les noms suivent, entre parenthèses, pour vérifier.
    var noms = nums.map(function(n){
      var nom = nomDe(b.dataset.code, n);
      return nom ? n + " " + nom : n;
    });
    sortie.push(b.dataset.nom + " — absents : " + nums.join(", ") +
                "\n  " + noms.join(" · "));
  });
  var texte = sortie.join("\n");
  if (!texte) { erreur("err-noms", "Rien à copier : l'appel n'est pas encore chargé."); return; }

  copierTexte(texte).then(function(ok){
    erreur("err-noms", ok ? "Liste copiée." : "Copie refusée par le navigateur — la voici :\n" + texte, ok);
    $("bloc-noms").hidden = false;
    if (!ok) $("bloc-noms").open = true;
  });
}

function pastilles(id, liste, classe, texte){
  var z = (typeof id === "string") ? $(id) : id;
  if (!z) return;
  z.innerHTML = "";
  liste.forEach(function(x){
    var s = document.createElement("span");
    s.className = "pastille " + classe;
    s.textContent = texte(x);
    z.appendChild(s);
  });
}

// ── Séance de projet — une autre lecture ──────────────────────────────────
// Sur un projet, personne n'est « en retard sur l'horloge » : chacun avance à
// sa vitesse. Ce qui alerte, c'est l'ARRÊT et l'écart à l'échéance.
function chargerProjet(){
  return sb.rpc("suivi_projet", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    suivi.projet = (r && !r.error && r.data && r.data.ok) ? r.data : null;
    if (suivi.stats) rendreRythme(suivi.stats);
  });
}

function rendreProjet(zone, p){
  var pr = suivi.projet;
  if (!pr) {
    zone.className = "rythme mort";
    zone.textContent = "Séance de projet — lecture de l'avancement en cours…";
    return;
  }
  var alerte = (pr.arretes || []).length || (pr.en_risque || 0);
  zone.className = "rythme " + (alerte ? "retard" : "ok");

  var t = "<b>Séance de projet</b> — chacun à son rythme, pas de cadence horaire.";
  if (pr.echeance) {
    t += " Échéance dans <b>" + pr.jours_restants + " jours</b>";
    if (pr.en_risque) t += ", <b>" + pr.en_risque + " au rythme actuel n'iront pas au bout</b>";
    t += ".";
  }
  zone.innerHTML = t;

  // Répartition : où se masse la classe le long des jalons.
  var rep = pr.repartition || [];
  if (rep.length) {
    var maxE = rep.reduce(function(m, x){ return Math.max(m, x.eleves); }, 1);
    var d = document.createElement("div");
    d.style.marginTop = ".5rem";
    rep.forEach(function(x){
      var l = document.createElement("div");
      l.className = "jalon";
      l.innerHTML = '<span class="jalon-n"></span><span class="jalon-b"></span><span class="jalon-c"></span>';
      l.querySelector(".jalon-n").textContent = x.faits + "/" + pr.jalons;
      l.querySelector(".jalon-b").style.width = Math.round(x.eleves / maxE * 55) + "%";
      l.querySelector(".jalon-c").textContent = x.eleves + (x.eleves > 1 ? " étudiants" : " étudiant");
      d.appendChild(l);
    });
    zone.appendChild(d);
  }

  if (pr.jamais_commence) {
    var j = document.createElement("div");
    j.style.marginTop = ".4rem";
    j.textContent = pr.jamais_commence + (pr.jamais_commence > 1
      ? " étudiants n'ont rien rendu sur cette séance."
      : " étudiant n'a rien rendu sur cette séance.");
    zone.appendChild(j);
  }

  var arr = pr.arretes || [];
  if (arr.length) {
    var a = document.createElement("div");
    a.style.marginTop = ".5rem";
    a.innerHTML = "<b>À l'arrêt</b> — plus rien depuis une semaine ou plus :" +
                  '<div class="pastilles" id="pj-arr"></div>';
    zone.appendChild(a);
    pastilles("pj-arr", arr, "abs", function(x){
      return x.numero + " " + (x.avatar || "") + " · " + x.faits + "/" + pr.jalons + " · " + x.jours + " j";
    });
  }
}

// ── Avant de commencer — le contrôle d'avant-séance ────────────────────────
// Quatre vérifications en une requête. Aucune ne devine : chacune dit ce qui
// manque et ce qu'il faut faire, pour que le défaut se règle avant l'heure et
// pas devant la classe.
// Les énoncés passent par une fonction plutôt que par une lecture directe de
// corriges : la RLS protège cette table — un étudiant ne doit jamais y lire
// les bonnes réponses — et la lecture directe revenait vide, sans le dire.
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

function chargerPrevol(){
  var bloc = $("prevol");
  if (!suivi.seanceId) { bloc.hidden = true; suivi.prevol = null; return Promise.resolve(); }
  return sb.rpc("preflight_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) { bloc.hidden = true; suivi.prevol = null; return; }
    suivi.prevol = r.data;
    rendrePrevol(r.data);
    suivi.projet = null;
    if (r.data.nature === "projet") chargerProjet();
    chargerControle();
    suivi.debrief = null;
    chargerDebrief();
    suivi.parcours = null;
    chargerParcours();
  });
}

// ── Le parcours de l'heure ────────────────────────────────────────────────
// Chaque heure commence par la même suite, et jusqu'ici elle n'était lisible
// nulle part d'un seul tenant : l'appel dans son onglet, l'humeur sous la
// classe, le contrôle d'entrée derrière deux sélecteurs, le quiz dans les
// tuiles. Quatre écrans pour une question qu'on se pose debout, une fois par
// heure : qui n'a pas démarré ?
//
// Deux lectures, dans cet ordre, parce qu'elles ne servent pas au même
// moment : l'entonnoir dit où ça coince pour le groupe, la liste repliée dit
// chez qui. On ouvre la seconde quand la première a montré qu'il y avait une
// raison de l'ouvrir.
function chargerParcours(apres){
  var bloc = $("bloc-parcours");
  bloc.hidden = true;
  if (!suivi.seanceId) return;
  // L'appel et les questionnaires n'ont pas de parcours : ils SONT des étapes
  // du parcours d'une séance de cours.
  if (suivi.prevol && Number(suivi.prevol.seance) >= 90) return;

  sb.rpc("parcours_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    var d = r && !r.error && r.data;
    // La RPC peut manquer si la migration n'est pas déployée : on masque la
    // carte plutôt que d'afficher une erreur en séance, comme partout ailleurs.
    if (!d || !d.ok) { suivi.parcours = null; if (apres) apres(); return; }
    suivi.parcours = d;
    bloc.hidden = false;
    rendreParcours(d);
    if (apres) apres();
  });
}

// Le nom vient de la base, pas d'une table écrite ici : la quatrième étape
// s'appelle « Le quiz de la séance » au BTS1 et « Le TP » au BTS2, et deux
// noms différents pour la même chose dans deux endroits de l'écran est
// exactement ce qui fait douter de ce qu'on lit. Le repli ne sert qu'au cas
// où la RPC ne serait pas déployée.
function nomEtape(cle, d){
  var e = ((d || suivi.parcours || {}).etapes || []).filter(function(x){
    return x.cle === cle;
  });
  if (e.length && e[0].nom) return e[0].nom;
  return { appel: "Appel", humeur: "Comment ça va",
           controle: "Contrôle d'entrée", quiz: "Le quiz" }[cle] || cle;
}

// Le second chiffre d'une étape n'est pas un nombre d'étudiants : ce sont ses
// items. Les nommer évite de lire « 4 sur 4 » comme « tout le monde ».
function motItems(e){
  if (e.cle === "controle") return "notions";
  return e.jalons ? "étapes" : "questions";
}

// L'ordre du parcours, et donc l'ordre de l'urgence : quelqu'un qui n'a pas
// pointé est plus loin en arrière que quelqu'un qui n'a pas fini le quiz.
// C'est cet ordre qui trie la liste et la phrase de synthèse.
var ETAPES_ORDRE = ["appel", "humeur", "controle", "quiz"];
function rangEtape(cle){
  var i = ETAPES_ORDRE.indexOf(cle);
  return i < 0 ? ETAPES_ORDRE.length : i;
}

function rendreParcours(d){
  var z = $("pa-entonnoir");
  z.innerHTML = "";

  (d.etapes || []).forEach(function(e){
    var l = document.createElement("div");
    l.className = "pa-e" + (e.pose ? "" : " pas-pose");

    var n = document.createElement("span");
    n.className = "pa-e-n";
    n.textContent = e.nom;
    l.appendChild(n);

    var j = document.createElement("span");
    j.className = "pa-e-j";
    var f = document.createElement("span");
    f.style.width = (e.pose && e.total ? Math.round(e.fait / e.total * 100) : 0) + "%";
    j.appendChild(f);
    l.appendChild(j);

    var c = document.createElement("span");
    c.className = "pa-e-c";
    // Une étape non posée n'est pas une étape à zéro. « 0 / 13 » se lirait
    // « personne ne l'a fait » au lieu de « il n'existe pas » — même choix
    // que le débriefing, qui préfère un blanc à un zéro.
    c.textContent = e.pose ? (e.fait + " / " + e.total) : "pas posé";
    l.appendChild(c);
    z.appendChild(l);

    // Ceux qui sont dedans sans être au bout : sans cette ligne, « 0 / 31 »
    // sur le quiz laisse croire que personne n'a commencé.
    if (e.pose && e.entames && e.entames > e.fait) {
      var p = document.createElement("p");
      p.className = "pa-e-p";
      var n = e.entames - e.fait;
      // « 4 sans aller au bout (sur 4) » se lisait « 4 sur 4 », c'est-à-dire
      // tout le monde. Le second chiffre n'est pas un effectif, c'est le
      // nombre d'items de l'étape : on le nomme.
      p.textContent = n + (n > 1 ? " sont dedans" : " est dedans") +
        (e.sur > 1 ? " sans avoir fini les " + e.sur + " " + motItems(e) : " sans avoir fini") + ".";
      z.appendChild(p);
    }
  });

  // La phrase qui nomme le geste. Sans elle, l'entonnoir informe sans rien
  // demander — et c'est exactement ce qu'on reprochait à « Réussite par
  // question ».
  var eleves = d.eleves || [];
  var bloques = eleves.filter(function(x){ return x.bloque; });
  var par = {};
  bloques.forEach(function(x){ par[x.bloque] = (par[x.bloque] || 0) + 1; });
  // Dans l'ordre du parcours, pas dans celui où les clés sont tombées : on
  // annonce d'abord ceux qui sont le plus en arrière, parce que ce sont eux
  // qu'on va voir en premier.
  var bouts = ETAPES_ORDRE.filter(function(k){ return par[k]; }).map(function(k){
    return par[k] + " à « " + nomEtape(k, d) + " »";
  });
  $("pa-bloques").textContent = bloques.length
    ? bloques.length + " étudiant" + (bloques.length > 1 ? "s n'ont" : " n'a") +
      " pas fini : " + bouts.join(", ") + "."
    : "Tout le monde est allé au bout de ce qui est posé.";

  var zl = $("pa-lignes");
  zl.innerHTML = "";
  // Les plus en arrière d'abord, pas les bloqués en vrac : celui qui n'a pas
  // pointé passe avant celui qui n'a pas fini le quiz. Trier par numéro
  // mettrait le 02 qui a tout fini au-dessus du 30 qui n'est pas là ; trier
  // par « bloqué ou non » remontait ceux qu'on cherche le moins.
  eleves.slice().sort(function(a, b){
    var ra = a.bloque ? rangEtape(a.bloque) : 99;
    var rb = b.bloque ? rangEtape(b.bloque) : 99;
    if (ra !== rb) return ra - rb;
    return a.numero < b.numero ? -1 : 1;
  }).forEach(function(x){ zl.appendChild(ligneParcours(d, x)); });
}

function ligneParcours(d, x){
  var l = document.createElement("div");
  l.className = "pa-l" + (x.bloque ? "" : " fini");

  var n = document.createElement("span");
  n.className = "pa-num";
  n.textContent = x.numero;
  l.appendChild(n);

  var pts = document.createElement("span");
  pts.className = "pa-pts";
  // Quatre pastilles dans l'ordre des étapes, toujours les quatre : on lit une
  // colonne pour voir qui manque à l'appel, une ligne pour voir où quelqu'un
  // s'est arrêté. En sauter une décalerait les colonnes d'une ligne à l'autre.
  [["appel", x.appel ? 1 : 0, 1],
   ["humeur", x.humeur ? 1 : 0, 1],
   ["controle", x.controle, d.controle_sur],
   ["quiz", x.quiz, d.quiz_sur]].forEach(function(e){
    var p = document.createElement("span");
    var fait = e[1], sur = e[2];
    p.className = "pa-pt " + (!sur ? "absent" : fait >= sur ? "fait" : fait > 0 ? "entame" : "");
    p.textContent = !sur ? "·" : sur === 1 ? (fait ? "✓" : "") : String(fait);
    p.title = nomEtape(e[0], d) + (sur > 1 ? " — " + fait + " sur " + sur
                                        : !sur ? " — pas posé" : fait ? " — fait" : " — pas fait");
    pts.appendChild(p);
  });
  l.appendChild(pts);

  var ou = document.createElement("span");
  ou.className = "pa-ou";
  var nom = nomDe(d.code, x.numero);
  ou.textContent = (nom ? prenomSeul(nom) + " — " : "") +
    (x.bloque ? nomEtape(x.bloque, d) : "au bout");
  l.appendChild(ou);
  return l;
}


// Le code de la classe sélectionnée : c'est lui qui sert de clé aux prénoms
// rangés dans ce navigateur.
function codeClasseCourante(){
  var l = (suivi.classesConnues || []).filter(function(c){
    return String(c.id) === String(suivi.classeId);
  });
  return l.length ? l[0].code : "";
}

// ── Le contrôle d'entrée, côté enseignant ─────────────────────────────────
// Il répond à une question que le pré-vol ne pose pas : « qu'est-ce qu'ils
// ont gardé de la dernière fois ? ». On le lit avant de commencer, pas après.
function chargerControle(){
  var bloc = $("bloc-controle");
  bloc.hidden = true;
  if (!suivi.seanceId) return;
  // Les questionnaires et l'appel n'ont pas de notions à réviser avant.
  if (suivi.prevol && Number(suivi.prevol.seance) >= 90) return;

  sb.rpc("controle_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    // Fonction pas déployée : le bloc reste absent, comme les autres cartes.
    if (!r || r.error || !r.data || !r.data.ok) return;
    suivi.controle = r.data;
    rendreControleEns(r.data);
    bloc.hidden = false;
  });
}

function rendreControleEns(d){
  var b = $("b-controle");
  b.classList.toggle("on", !!d.ouvert);
  b.querySelector(".et").textContent = d.ouvert ? "Proposé" : "Éteint";
  b.setAttribute("aria-pressed", d.ouvert ? "true" : "false");
  b.disabled = !d.notions;
  b.title = d.notions ? "" : "Écrivez d'abord les notions à contrôler.";

  var r = $("ct-resume");
  if (!d.notions) {
    r.textContent = "Aucune notion pour cette séance. Écrivez-les ci-dessous : " +
      "les étudiants y répondront avant de venir.";
    $("ct-lignes").innerHTML = "";
    $("ct-neuf").open = true;
    return;
  }
  var bouts = [d.notions + (d.notions > 1 ? " notions" : " notion"),
               d.termines + " / " + d.inscrits + " ont répondu"];
  r.textContent = bouts.join(" · ");
  $("ct-neuf").open = false;

  var z = $("ct-lignes");
  z.innerHTML = "";
  (d.lignes || []).forEach(function(l){ z.appendChild(ligneControle(l)); });

  // Ceux qui ne l'ont pas fait : les numéros, comme pour l'appel. Rien ne les
  // bloque, mais on ne peut pas s'appuyer sur un contrôle que le tiers de la
  // classe n'a pas rempli.
  var manquants = (d.a_relancer || []).map(function(n){ return { numero: n }; });
  if (manquants.length) {
    z.appendChild(ligneAbsents({ code: codeClasseCourante() },
      manquants, "Pas encore fait", "Tout le monde l'a fait."));
  }
}

// ── Le débriefing, côté enseignant ────────────────────────────────────────
// La même donnée que l'écran projeté, en version téléphone : on la lit pour
// savoir quoi dire, puis on projette.
function chargerDebrief(apres){
  var bloc = $("bloc-debrief");
  if (!suivi.seanceId) { bloc.hidden = true; suivi.debrief = null; return; }
  // Ni l'appel ni les questionnaires ne se débriefent : rien à y conclure.
  if (suivi.prevol && Number(suivi.prevol.seance) >= 90) { bloc.hidden = true; return; }

  sb.rpc("debriefing", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) { bloc.hidden = true; return; }
    suivi.debrief = r.data;
    rendreDebriefEns(r.data);
    bloc.hidden = false;
    if (typeof apres === "function") apres();
  });
}

function rendreDebriefEns(d){
  var liste = d.concepts || [];
  var r = $("db-resume");

  if (!liste.length) {
    r.textContent = "Aucun concept écrit pour cette séance. Recopiez ci-dessous la " +
      "section « Concepts à connaître » de la trace écrite : c'est elle qu'on projette " +
      "en fin d'heure.";
    $("db-lignes").innerHTML = "";
    $("db-neuf").open = true;
    $("b-db-ecran").disabled = true;
    return;
  }
  $("db-neuf").open = false;
  $("b-db-ecran").disabled = false;

  var faibles = liste.filter(function(c){ return c.verdict === "a_revoir"; });
  var bouts = [liste.length + (liste.length > 1 ? " concepts" : " concept"),
               d.repondants + " / " + d.inscrits + " ont répondu au quiz"];
  if (d.reussite !== null) bouts.push(d.reussite + " % de réussite");
  r.textContent = bouts.join(" · ") +
    (faibles.length ? " — on reprend par le " +
       faibles.map(function(c){ return c.rang; }).join(" et le ") + "." : "");

  var z = $("db-lignes");
  z.innerHTML = "";
  liste.forEach(function(c){ z.appendChild(ligneConcept(c)); });
}

// Un concept : son rang (c'est par ce numéro qu'on le désignera à l'oral),
// son intitulé, et le chiffre que la classe vient de lui donner.
function ligneConcept(c){
  var MOTS = { acquis: "acquis", fragile: "fragile",
               a_revoir: "à revoir", sans_mesure: "sans mesure" };
  var d = document.createElement("div");
  d.className = "db-l";
  d.innerHTML = '<span class="db-r"></span><span class="db-i"></span>' +
                '<span class="db-v"></span><span class="db-d"></span>';
  d.querySelector(".db-r").textContent = c.rang + ".";
  d.querySelector(".db-i").textContent = typo(c.intitule);

  var v = d.querySelector(".db-v");
  v.classList.add(c.verdict);
  v.textContent = (c.taux === null ? "" : c.taux + " % · ") + MOTS[c.verdict];

  var det = d.querySelector(".db-d");
  det.textContent = typo(c.detail || "");
  if ((c.questions || []).length) {
    var q = document.createElement("span");
    q.className = "db-q";
    q.textContent = "  mesuré sur " +
      (c.questions.length > 1 ? "les questions " : "la question ") +
      c.questions.join(", ");
    det.appendChild(q);
  }
  return d;
}

function enregistrerConcepts(){
  var texte = $("db-texte").value;
  erreur("err-db-neuf", "");
  if (!texte.trim()) { erreur("err-db-neuf", "Collez au moins un concept."); return; }
  var b = $("b-db-creer");
  b.disabled = true;
  sb.rpc("definir_concepts", { p_seance_id: Number(suivi.seanceId),
                               p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      // La base nomme la ligne fautive et le numéro en cause : on la répète
      // telle quelle plutôt que de dire « format invalide », ce qui obligerait
      // à tout relire pour trouver la ligne.
      erreur("err-db-neuf",
        (d && d.texte) ? d.texte
      : (d && d.motif === "numero")
          ? "L'appel et les questionnaires n'ont pas de concepts à débriefer."
      : "Enregistrement refusé. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-db-neuf", d.concepts + (d.concepts > 1 ? " concepts enregistrés."
                                                       : " concept enregistré."), true);
    $("db-texte").value = "";
    chargerDebrief();
  });
}

// Une notion : ce qu'ils ont répondu, et ce qu'ils disaient savoir. Les moins
// réussies d'abord — la fonction les rend déjà dans cet ordre.
function ligneControle(l){
  var d = document.createElement("div");
  d.className = "ct-l";
  var i = document.createElement("div");
  i.className = "ct-i";
  i.textContent = typo(l.intitule || l.cle);
  d.appendChild(i);

  var rep = Number(l.repondants) || 0, justes = Number(l.justes) || 0;
  var pct = rep ? Math.round(justes * 100 / rep) : null;

  var b = document.createElement("div");
  b.className = "ct-b";
  var j = document.createElement("span");
  j.className = "ct-jauge";
  if (rep) {
    var ok = document.createElement("i");
    ok.className = "ok";
    ok.style.width = (justes * 100 / rep) + "%";
    j.appendChild(ok);
    var ko = document.createElement("i");
    ko.className = "ko";
    ko.style.width = ((rep - justes) * 100 / rep) + "%";
    j.appendChild(ko);
  }
  b.appendChild(j);
  var c = document.createElement("span");
  c.className = "ct-c";
  c.textContent = rep ? (justes + "/" + rep + " · " + pct + " %") : "aucune réponse";
  b.appendChild(c);
  d.appendChild(b);

  // L'écart entre savoir et croire savoir. C'est lui qui dit par quoi
  // commencer : se tromper en étant sûr n'appelle pas le même geste que
  // douter en ayant juste.
  var sf = Number(l.surs_et_faux) || 0, jd = Number(l.justes_mais_doutent) || 0;
  if (sf || jd) {
    var a = document.createElement("span");
    a.className = "ct-alerte";
    var bouts = [];
    if (sf) {
      var qui = (l.numeros_surs_et_faux || []).join(" ");
      bouts.push("⚠️ " + sf + (sf > 1 ? " se trompent" : " se trompe") +
                 " en étant sûr" + (sf > 1 ? "s" : "") + (qui ? " — " + qui : ""));
    }
    if (jd) bouts.push(jd + (jd > 1 ? " ont juste mais doutent" : " a juste mais doute"));
    a.textContent = bouts.join(" · ");
    d.appendChild(a);
  }
  return d;
}

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

function rendrePrevol(p){
  var bloc = $("prevol");
  bloc.hidden = false;

  var projet = p.nature === "projet";
  var lignes = [];

  if (projet) {
    // Sur un projet, ce ne sont pas dix questions qu'on attend, mais des
    // jalons déclarés et une échéance : sans eux, aucun avancement n'est lisible.
    lignes.push(p.jalons
      ? [true,  p.jalons + " jalons déclarés", ""]
      : [false, "Aucun jalon déclaré", "l'avancement se calculera sur l'étudiant le plus avancé, faute de repère"]);
    lignes.push(p.echeance
      ? [true,  "Échéance au " + dateCourte(p.echeance), ""]
      : [false, "Pas d'échéance", "impossible de dire qui n'ira pas au bout au rythme actuel"]);
  } else {
    // Le corrigé : sans lui, rien n'est évalué et la Répartition reste vide.
    lignes.push(p.questions > 0
      ? [true,  p.questions + " questions corrigées", ""]
      : [false, "Aucun corrigé pour cette séance", "les réponses seront enregistrées mais jamais évaluées"]);
  }
  // L'appel : sans lui, pas de trace de présence pour la journée.
  lignes.push(p.appel_du_jour
    ? [true,  "Question d'appel posée pour aujourd'hui", ""]
    : [null,  "Question d'appel pas encore créée", "elle se crée d'elle-même à la première connexion d'un étudiant, rien à faire"]);
  // L'état : une séance fermée refuse tout, en silence.
  if (projet) {
    lignes.push(p.ouverte
      ? [true,  "Séance ouverte en permanence", ""]
      : [false, "Séance fermée", "les étudiants ne peuvent plus rien valider sur ce projet"]);
  } else {
    lignes.push(p.ouverte
      ? [true,  "Séance ouverte" + (p.demarree_le ? ", démarrée à " + heureCourte(p.demarree_le) : ", pas encore démarrée"), ""]
      : [false, "Séance fermée", "personne ne peut répondre tant qu'elle n'est pas démarrée"]);
  }
  // Les accès : un étudiant sans PIN ne peut pas entrer.
  var accesOk = p.eleves > 0 && p.avec_pin === p.eleves;
  lignes.push(accesOk
    ? [true,  p.eleves + " étudiants, tous avec un code PIN (" + p.deja_connectes + " déjà connectés)", ""]
    : [false, p.avec_pin + " codes PIN pour " + p.eleves + " étudiants", "les étudiants sans PIN ne pourront pas s'identifier"]);

  var ul = $("prevol-liste");
  ul.innerHTML = "";
  lignes.forEach(function(l){
    var li = document.createElement("li");
    li.innerHTML = '<span class="pv-i"></span><span><b></b><span class="pv-ko"></span></span>';
    li.querySelector(".pv-i").textContent = l[0] === true ? "✅" : (l[0] === null ? "ℹ️" : "⚠️");
    li.querySelector("b").textContent = l[1];
    li.querySelector(".pv-ko").textContent = l[2] ? " — " + l[2] : "";
    ul.appendChild(li);
  });

  // Seul un vrai blocage compte : une ligne d'information (null) n'est pas
  // un point à régler, sinon le pré-vol crie au loup tous les matins.
  var manque = lignes.filter(function(l){ return l[0] === false; }).length;
  var etat = $("prevol-etat");
  etat.textContent = manque ? (manque + (manque > 1 ? " points à régler" : " point à régler")) : "Tout est prêt";
  etat.className = "prevol-etat " + (manque ? "ko" : "ok");

  // Un projet reste ouvert : ni chrono à lancer, ni séance à clore chaque semaine.
  // La séance 99 est le registre d'appel : la clore couperait le pointage et
  // l'humeur pour la classe entière. Le bouton disparaît, la base refuse aussi.
  var appel = String(p.seance) === "99";
  $("b-demarrer").hidden = projet;
  $("b-clore").hidden = projet || appel;
  $("b-demarrer").textContent = p.demarree_le && p.ouverte ? "Redémarrer le chrono" : "Démarrer la séance";
  $("b-clore").disabled = !p.ouverte;
}

function dateCourte(iso){
  var d = new Date(iso);
  return isNaN(d) ? "?" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// Les énoncés de la séance, tels qu'ils sont en base. Répondus ou non : c'est
// la relecture d'avant-cours, celle qui permet de voir qu'une question ne colle
// pas au TP ou qu'un intitulé manque, pendant qu'il est encore temps.
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

function heureCourte(iso){
  var d = new Date(iso);
  return isNaN(d) ? "?" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function pilotage(action, question){
  if (!suivi.seanceId) return;
  erreur("err-prevol", "");
  $("b-demarrer").disabled = true; $("b-clore").disabled = true;
  sb.rpc(action, { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    $("b-demarrer").disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      // « appel » n'est pas un refus de droits : c'est un refus de principe.
      erreur("err-prevol", (r && r.data && r.data.motif === "appel")
        ? "La séance d'appel reste ouverte toute l'année : la clore couperait le pointage de la classe."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      $("b-clore").disabled = false;
      return;
    }
    erreur("err-prevol", question, true);
    // On relit l'état plutôt que de le supposer : la source de vérité est la base.
    chargerPrevol().then(rafraichir);
    // Ouvrir ou clore une séance change ce qui reste à faire : la carte suit.
    chargerAFaire();
    chargerSemestre();
  });
}

// ── Le rythme — la classe suit-elle la cadence ? ───────────────────────────
// Cadence déduite : durée de la séance divisée par le nombre de questions.
// On ne compte que les étudiants actifs DEPUIS le démarrage : ceux qui ont une
// ou deux séances d'avance travaillent ailleurs, ils ne sont ni en retard ni
// à rattraper, et ils n'ont pas à tirer la moyenne.
function rendreRythme(s){
  var zone = $("rythme"), p = suivi.prevol;
  if (!p) { zone.hidden = true; return; }
  zone.hidden = false;

  // Deux natures, deux lectures. Le reste de cette fonction ne vaut que
  // pour une séance de cours, où la classe avance ensemble.
  if (p.nature === "projet") return rendreProjet(zone, p);

  if (!p.demarree_le || !p.ouverte) {
    zone.className = "rythme mort";
    zone.innerHTML = "Séance non démarrée : pas de repère de temps. " +
                     "Le chrono part au clic sur <b>Démarrer la séance</b>.";
    return zone.appendChild(noteAvance(p));
  }
  if (!p.questions) {
    zone.className = "rythme mort";
    zone.innerHTML = "Pas de corrigé : impossible de calculer une cadence.";
    return zone.appendChild(noteAvance(p));
  }

  var debut = new Date(p.demarree_le).getTime();
  var minutes = Math.max(0, (Date.now() - debut) / 60000);
  var cadence = p.duree_min / p.questions;
  // floor et non ceil : à la 22e minute avec une cadence de 5,5 min, quatre
  // questions devraient être finies — pas cinq, dont l'intervalle vient de commencer.
  var attendu = Math.min(p.questions, Math.floor(minutes / cadence));

  // Les actifs du jour : ceux dont la dernière réponse est postérieure au top départ.
  var actifs = (s.lignes || []).filter(function(l){
    return l.maj && new Date(l.maj).getTime() >= debut;
  });
  var moyenne = actifs.length
    ? actifs.reduce(function(a, l){ return a + l.n; }, 0) / actifs.length : 0;
  var ecart = moyenne - attendu;

  var etat = ecart >= 0.5 ? "avance" : (ecart >= -0.5 ? "ok" : "retard");
  var mot  = etat === "avance" ? "en avance"
           : (etat === "ok" ? "dans le rythme"
           : (ecart >= -1.5 ? "léger retard" : "en retard"));

  zone.className = "rythme " + etat;
  zone.innerHTML =
    "<b>" + Math.round(minutes) + " min</b> sur " + p.duree_min + " · " +
    "attendu <b>question " + attendu + "</b> sur " + p.questions + " · " +
    "classe à <b>" + moyenne.toFixed(1).replace(".", ",") + "</b> (" + actifs.length + " actifs) · " +
    "<b>" + mot + "</b>";
  zone.appendChild(noteAvance(p));
}

// Les étudiants qui travaillent au-delà de cette séance, comptés à part.
function noteAvance(p){
  var d = document.createElement("div");
  if (!p || !p.en_avance) { d.hidden = true; return d; }
  d.style.marginTop = ".35rem";
  d.style.opacity = ".85";
  d.textContent = p.en_avance + (p.en_avance > 1 ? " étudiants travaillent " : " étudiant travaille ") +
    "au-delà de cette séance (séance " + p.seances_en_avance + ") — hors du calcul du rythme.";
  return d;
}

// ── Sélecteurs classe et séance ────────────────────────────────────────────
function activerSeance(){
  var sel = $("pk-seance");
  var opt = sel.options[sel.selectedIndex];
  if (!sel.value) {
    suivi.seanceId = null;
    suivi.stats = null;
    suivi.prevol = null;
    arreterBoucle();
    $("prevol").hidden = true;
    $("bloc-corriges").hidden = true;
    $("stats-zone").hidden = true;
    $("stats-attente").hidden = false;
    return;
  }
  suivi.seanceId = sel.value;
  suivi.titre = opt.dataset.titre || opt.textContent;
  suivi.ouverte = !!opt.dataset.ouverte;
  suivi.nature  = opt.dataset.nature || "cours";
  suivi.jalons  = opt.dataset.jalons || null;
  $("stats-attente").textContent = "Chargement…";
  chargerPrevol();
  chargerQuestionsSeance();
  rafraichir().then(lancerBoucle);
}

function chargerSeancesDe(classeId){
  suivi.classeId = classeId;
  suivi.seanceId = null;
  suivi.stats = null;
  arreterBoucle();
  $("stats-zone").hidden = true;
  $("stats-attente").hidden = false;
  $("stats-attente").textContent = "Sélectionnez une séance pour voir le détail élève par élève.";

  return sb.from("seances").select("id,numero,titre,ouverte,notee,nature,jalons")
    .eq("classe_id", classeId).order("numero").then(function(r){
      var sel = $("pk-seance");
      sel.innerHTML = '<option value="">Choisir une séance…</option>';
      (r.data || []).forEach(function(s){
        var o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.numero + " — " + s.titre +
          (s.ouverte ? " · ouverte" : " · fermée") + (s.notee ? " · notée" : "");
        o.dataset.titre = s.numero + " — " + s.titre;
        o.dataset.ouverte = s.ouverte ? "1" : "";
        o.dataset.nature  = s.nature || "cours";
        if (s.jalons) o.dataset.jalons = s.jalons;
        sel.appendChild(o);
      });
      // Une séance est chargée d'office : le panneau n'est jamais vide à l'arrivée.
      if (sel.options.length > 1) {
        sel.selectedIndex = 1;
        activerSeance();
      }
    });
}

// ── Les contrôles d'entrée, vus de l'onglet Questionnaires ────────────────
// Un contrôle vit sur la séance qu'il précède, derrière deux sélecteurs. Le
// 15/09, huit notions posées sur le TP2 du BTS2 ont été cherchées ici, où
// elles n'étaient pas. Le modèle reste le bon — c'est la lecture qui manquait.
//
// Cette carte ne sait pas écrire un contrôle, et c'est volontaire : un
// contrôle s'écrit en regardant la séance qu'il prépare. Elle répond à trois
// questions et pas une de plus : qu'est-ce qui existe, pour quelle classe,
// et les étudiants le voient-ils ?
function chargerControles(){
  var carte = $("carte-controles");
  carte.hidden = true;
  sb.rpc("controles").then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) return;
    rendreControles(r.data.liste || []);
    carte.hidden = false;
  });
}

function rendreControles(liste){
  var z = $("ctl-liste");
  z.innerHTML = "";
  if (!liste.length) {
    // Le vide se dit avec le chemin pour en sortir, sinon il se lit comme une
    // panne — c'est ce qui s'est passé le 15/09, dans l'autre sens.
    z.innerHTML = '<p class="hint" style="margin:0">Aucun contrôle écrit pour ' +
      "l'instant. Ils s'écrivent dans <b>Suivi d'une séance</b> : choisissez la " +
      'classe et la séance, puis « Écrire le contrôle de cette séance ».</p>';
    return;
  }
  liste.forEach(function(c){ z.appendChild(ligneControleGlobal(c)); });
}

function ligneControleGlobal(c){
  var d = document.createElement("div");
  d.className = "qn-m";
  d.innerHTML = '<div class="qn-tete"><span class="qn-tt"></span>' +
                '<span class="qn-meta"></span></div>' +
                '<div class="ctl-bas"><span class="ctl-ou"></span></div>';

  // La classe d'abord, et en toutes lettres : la question posée est « est-ce
  // bien affecté au BTS2 ? ». Un code de classe seul n'y répond pas.
  d.querySelector(".qn-tt").textContent = c.classe;
  d.querySelector(".qn-meta").textContent =
    c.notions + (c.notions > 1 ? " notions" : " notion") +
    (c.inscrits ? " · " + c.repondu + " / " + c.inscrits + " y ont répondu" : "");

  var ou = d.querySelector(".ctl-ou");
  ou.textContent = "Séance " + c.numero + " — " + c.titre +
    (c.demarree ? " · déjà démarrée" : "");

  var bas = d.querySelector(".ctl-bas");

  var b = document.createElement("button");
  b.type = "button";
  b.className = "qa-b" + (c.ouvert ? " on" : "");
  b.innerHTML = '<span class="pt"></span><span class="et"></span>';
  b.querySelector(".et").textContent = c.ouvert ? "Proposé" : "Éteint";
  b.setAttribute("aria-pressed", c.ouvert ? "true" : "false");
  b.setAttribute("aria-label", (c.ouvert ? "Éteindre" : "Proposer") +
    " le contrôle de la séance " + c.numero + " pour " + c.classe);
  b.addEventListener("click", function(){ basculerControle(c, b); });
  bas.appendChild(b);

  var v = document.createElement("button");
  v.type = "button";
  v.className = "btn btn-sec ctl-voir";
  v.textContent = "Voir le détail";
  v.setAttribute("aria-label", "Ouvrir la séance " + c.numero + " de " +
    c.classe + " dans le suivi");
  v.addEventListener("click", function(){ allerAuControle(c); });
  bas.appendChild(v);

  return d;
}

function basculerControle(c, b){
  var vise = !b.classList.contains("on");
  b.disabled = true;
  erreur("err-controles", "");
  sb.rpc("ouvrir_controle", { p_seance_id: Number(c.seance_id),
                              p_ouvert: vise }).then(function(r){
    b.disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      erreur("err-controles", (r && r.data && r.data.motif === "vide")
        ? "Ce contrôle n'a aucune notion : rien à proposer."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-controles", vise
      ? "Proposé à " + c.classe + ". Il apparaît en tête de l'écran des étudiants."
      : "Éteint pour " + c.classe + ". Les réponses déjà données sont conservées.", true);
    chargerControles();
    // La carte du suivi montre la même chose : si elle est ouverte sur cette
    // séance, elle mentirait jusqu'au prochain rafraîchissement.
    if (suivi && String(suivi.seanceId) === String(c.seance_id)) chargerControle();
  });
}

// « Voir le détail » : l'onglet du suivi, la bonne classe, la bonne séance.
// Sans cela, on lit « séance 2 du BTS2 » et on doit refaire soi-même deux
// sélections — c'est la moitié du problème qu'on vient de régler.
function allerAuControle(c){
  ouvrirOnglet("seance");
  var sc = $("pk-classe");
  if (String(sc.value) !== String(c.classe_id)) {
    sc.value = String(c.classe_id);
  }
  chargerSeancesDe(sc.value).then(function(){
    var ss = $("pk-seance");
    for (var i = 0; i < ss.options.length; i++) {
      if (String(ss.options[i].value) === String(c.seance_id)) {
        ss.selectedIndex = i;
        activerSeance();
        break;
      }
    }
    var b = $("bloc-controle");
    if (b) b.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ── La bibliothèque de questionnaires ─────────────────────────────────────
// Deux niveaux, et pas trois : un MODÈLE — le texte, écrit une fois — et ses
// AFFECTATIONS — une séance par classe, avec ses réponses à elle. Cocher une
// classe prépare le questionnaire ; l'interrupteur le montre aux étudiants.
// Les deux gestes sont séparés à dessein : préparer et publier dans le même
// clic ferait apparaître chez les étudiants ce qu'on venait d'écrire.
var BIB = { classes: [] };

// garder : ne pas effacer le message en cours. Sans cela, la confirmation
// (« est préparé pour BTS SIO 1 ») et surtout le refus expliqué (« 9 réponses
// ont déjà été enregistrées ») étaient balayés par le rechargement qui les
// suit immédiatement — l'enseignant cliquait et rien ne se disait.
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

// Le tiroir des réglages : un seul par questionnaire. Il porte ce qu'on ne
// fait pas en séance — donner à une autre classe, rattacher à une séance,
// retirer, supprimer — et son résumé dit ce qu'il contient, pour qu'on sache
// s'il vaut la peine de l'ouvrir sans l'ouvrir.
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

// « Retirer de la classe » — extrait de caseClasse pour vivre dans le tiroir.
// La règle ne change pas : une seule réponse suffit à rendre le retrait
// impossible, et on le dit AVANT le clic plutôt que de laisser partir un geste
// qui échouera de toute façon.
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

// Une ligne par classe, et deux gestes distincts, chacun nommé :
//   · l'AFFECTATION — « Donner à cette classe » / « Retirer de la classe » ;
//   · l'INTERRUPTEUR — Proposé / Éteint, ce que voient les étudiants.
// C'était une case à cocher et une pastille sur une même ligne cliquable.
// Décocher appelait retirer_questionnaire(), qui efface la séance : le geste
// « j'arrête ce questionnaire » tombait sur le bouton destructeur, et le geste
// sans risque — éteindre — n'était visible que si on savait déjà qu'il existait.
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

// « Avec la séance… » — les séances de cours de cette classe, celle du jour
// signalée. Détacher ne change pas ce que voient les étudiants : l'interrupteur
// reste le seul geste qui décide de cela.
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

// Retirer efface la séance et ses questions. La base refuse dès qu'une
// réponse existe — et c'est bien : à ce moment-là on veut éteindre, pas
// détruire. On le dit plutôt que de laisser un refus muet.
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

// Un seul point de rechargement : les cartes de dépouillement dépendent des
// mêmes séances, et deux écrans qui se contredisent coûtent plus cher qu'un
// aller-retour de plus.
function rafraichirQuestionnaires(){
  chargerQuestionnaires(true);
  chargerConnaissance(suivi.classesConnues || []);
  chargerStage(suivi.classesConnues || []);
  chargerAFaire();
}

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

// Une classe sans projet n'est pas une erreur d'affichage : ses étudiants
// s'identifient et ne trouvent rien à ouvrir. On le dit à sa place, sous son
// nom — a_faire() le signale par ailleurs comme un point à régler.
function rendreProjetsParClasse(classes, projets){
  var z = $("tous-projets");
  z.innerHTML = "";
  if (!classes.length) {
    z.innerHTML = '<p class="hint" style="margin:0">Aucune classe.</p>';
    return;
  }
  classes.forEach(function(c){
    var siens = projets.filter(function(p){ return p.classe_id === c.id; });
    var h = document.createElement("h3");
    h.className = "sous-titre";
    h.textContent = c.nom;
    z.appendChild(h);

    var code = document.createElement("p");
    code.className = "sous-hint";
    // « 0 dépôt » ferait doublon avec la phrase juste en dessous.
    code.textContent = siens.length
      ? c.code + " — " + siens.length + (siens.length > 1 ? " dépôts" : " dépôt")
      : c.code;
    z.appendChild(code);

    if (!siens.length) {
      var vide = document.createElement("p");
      vide.className = "hint";
      vide.textContent = "Aucun projet associé : ses étudiants s'identifient " +
        "puis ne trouvent aucun support à ouvrir.";
      z.appendChild(vide);
      return;
    }
    var grille = document.createElement("div");
    grille.className = "projets";
    siens.forEach(function(p){ grille.appendChild(carte(p)); });
    z.appendChild(grille);
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
