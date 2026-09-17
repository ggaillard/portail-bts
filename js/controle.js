// ── Le contrôle d'entrée : avant la séance, pas après ─────────────────────
//
// Dixième module sorti de app.js. Deux questions par notion, et c'est l'écart
// entre les deux qui vaut le détour : `pre-NN` mesure ce qu'ils SAVENT,
// `pre-NN-c` ce qu'ils CROIENT savoir. Se tromper en étant sûr n'appelle pas le
// même geste que douter en ayant juste, et un chiffre unique confondrait les
// deux — d'où `surs_et_faux`, avec les numéros : ceux-là ne poseront pas de
// question, ils ne savent pas qu'ils ont tort.
//
// Trois règles de ce fichier ne se devinent pas :
//
//   · LE PRÉFIXE `pre-` N'EST PAS DÉCORATIF. C'est lui qui tient le contrôle
//     hors des chiffres du quiz de fin. Quatre endroits font le tri, trois en
//     SQL et un ici ; toute fonction neuve qui compte des questions de séance
//     doit exclure `pre-%`.
//
//   · AUCUNE CORRECTION N'EST MONTRÉE À L'ÉTUDIANT, et c'est voulu. Dire
//     « faux » avant la séance transforme un point de départ en sanction, et
//     fausse la question de certitude qui suit immédiatement.
//
//   · RIEN NE BLOQUE. La séance s'ouvre même sans le contrôle ; le tableau de
//     bord nomme ceux qui ne l'ont pas fait. Un blocage transformerait un oubli
//     en incident à gérer en début d'heure.
//
// Il reçoit `allerAuControle` par brancherControle() : l'inventaire renvoie
// vers l'éditeur, qui vit dans seance.js — l'importer ferait un cycle.

import { $, sb, suivi, erreur, typo, codeClasseCourante, majFile, marquerEtape,
         texteEnvoi, signalerSessionPerimee } from './socle.js';
// Le tableau de bord d'un contrôle affiche la rangée de numéros de ceux qui
// n'y ont pas répondu — la même que celle de l'appel, et pour la même raison :
// c'est elle qu'on lit à voix haute.
import { ligneAbsents } from './appel.js';

let allerAuControle = function(){};
export function brancherControle(liens){ allerAuControle = liens.allerAuControle; }

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

// Le second chiffre d'une étape n'est pas un nombre d'étudiants : ce sont ses
// items. Les nommer évite de lire « 4 sur 4 » comme « tout le monde ».
function motItems(e){
  if (e.cle === "controle") return "notions";
  return e.jalons ? "étapes" : "questions";
}

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

// Depuis le 17/09 il vit dans l'onglet « La séance » (nommé « Suivi d'une
// séance » jusqu'au renommage du 17/09 au soir), avec
// l'éditeur : un contrôle appartient à la vie d'une séance, pas à la
// bibliothèque de questionnaires. Cette carte reste l'INVENTAIRE et ne sait
// toujours pas écrire un contrôle — deux endroits pour le même geste, c'est
// la garantie que l'un des deux divergera.
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
      "l'instant. Ils s'écrivent ici même, dans <b>La séance</b> : choisissez la " +
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

export { chargerControles, chargerControle, chargerControlesEtu, motItems,
         rendreControles, ligneControle };
