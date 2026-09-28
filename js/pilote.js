// ── L'écran de la séance, piloté comme une application ────────────────────
//
// Refonte du 28/09, lot « le direct ». Ce module ne calcule rien : seance.js,
// heure.js, vigilance.js et missions.js remplissent leurs blocs comme avant.
// Il tient ce qui entoure ces blocs, sur le modèle des applications de suivi
// courantes :
//
//   · L'EN-TÊTE COLLANT — classe › module › séance (un clic pour changer),
//     l'état en badge, le chrono, les chiffres qui comptent, l'heure de la
//     dernière mise à jour avec un bouton Pause, et UNE action principale
//     (Démarrer ou Clore). Il reste à l'écran quand on descend dans une vue.
//   · QUATRE VUES — Maintenant, Élèves, Questions, Fin d'heure — au lieu d'un
//     défilement de 3 000 px. La vue choisie se garde d'une séance à l'autre.
//   · LA LISTE DES ÉLÈVES FILTRABLE — six filtres d'un clic, une recherche par
//     numéro ou prénom (les prénoms restent dans ce navigateur), et un clic
//     sur une ligne ouvre la fiche de l'élève (js/fiche.js).
//   · CLORE AVEC « ANNULER » — le geste part après cinq secondes, sauf si l'on
//     se ravise (js/toast.js). Démarrer part tout de suite : il se refait.
//
// Deux portes d'entrée depuis seance.js : `majPilote()` après chaque rendu,
// `marquerEleve()` sur chaque ligne d'élève. Ce module n'importe pas
// seance.js — il agit sur ses boutons par leur identifiant, pour ne pas
// créer de cycle.

import { $, suivi, typo, nomDe, prenomSeul, codeClasseCourante } from './socle.js';
import { lireModules } from './modules.js';
import { toast } from './toast.js';
import { ouvrirFiche } from './fiche.js';
import { rendreCompteRendu } from './compterendu.js';

var VUES = ["maintenant", "eleves", "questions", "fin"];
var SQUELETTE = '<span class="vh">Chargement…</span><span class="squelette"></span>' +
                '<span class="squelette"></span><span class="squelette court"></span>';
var CLE_VUE = "tdc-vue-seance";
var derniereMaj = 0;
var filtre = "tous";
var titresModules = null;

// ── L'en-tête ────────────────────────────────────────────────────────────
function majPilote(apresStats){
  if (apresStats) derniereMaj = Date.now();
  var sel = $("pk-seance"), cl = $("pk-classe");
  if (!sel || !$("sv-tete")) return;
  var opt = sel.options[sel.selectedIndex];
  var aSeance = !!(sel.value && opt);
  var copt = cl && cl.options[cl.selectedIndex];

  var ctx = [];
  if (copt) ctx.push(copt.textContent);
  if (aSeance && opt.dataset.module && !titresModules) lireTitres();
  var mod = aSeance && opt.dataset.module && titresModules && titresModules[opt.dataset.module];
  if (mod) ctx.push(mod);
  $("sv-fil-ctx").textContent = ctx.join(" › ");
  $("sv-fil-seance").textContent = aSeance ? typo(opt.dataset.titre || opt.textContent)
                                           : "Choisir une séance";

  var p = suivi.prevol, s = suivi.stats;
  var badge = $("sv-badge"), action = $("b-sv-action");
  var etat = etatSeance(p);
  badge.className = "badge " + etat[0];
  badge.textContent = aSeance ? etat[1] : "—";

  // Le chrono : seulement pendant une séance de cours démarrée et ouverte.
  var chrono = "";
  if (p && p.nature !== "projet" && p.ouverte && p.demarree_le) {
    var min = Math.max(0, Math.round((Date.now() - new Date(p.demarree_le).getTime()) / 60000));
    chrono = min + (p.duree_min ? " / " + p.duree_min : "") + " min";
  }
  $("sv-chrono").textContent = chrono;

  var kpi = "";
  if (aSeance && s) {
    kpi = s.actifs + "/" + s.inscrits + " actifs · " +
      (p && p.nature === "projet" || s.reussite === null
        ? s.avancement + " % fait" : s.reussite + " % juste");
  }
  $("sv-kpi").textContent = kpi;

  // L'action principale. Un projet reste ouvert (pas de chrono, pas de
  // clôture hebdomadaire), et la séance 99 est le registre d'appel.
  var appel = p && String(p.seance) === "99";
  if (!aSeance || !p || p.nature === "projet" || appel) {
    action.hidden = true;
  } else {
    action.hidden = false;
    action.dataset.geste = p.ouverte ? "clore" : "demarrer";
    action.textContent = p.ouverte ? "Clore la séance" : "Démarrer la séance";
    action.classList.toggle("btn-sec", !!p.ouverte);
  }

  // Le pré-vol se replie quand il n'a plus rien à dire : séance en cours,
  // tout est prêt. On le rouvre d'un clic sur son titre.
  var pv = $("prevol");
  if (pv && p) {
    var pret = /prêt/.test(($("prevol-etat") || {}).textContent || "");
    pv.classList.toggle("pv-replie", !!(pret && p.ouverte && p.demarree_le) && !pv.dataset.ouvert);
  }

  // Les pastilles des vues.
  var vg = (($("vg-compte") || {}).textContent || "").replace(/\D/g, "");
  $("svn-maintenant").textContent = vg && vg !== "0" ? vg : "";
  $("svn-eleves").textContent = s ? String(s.inscrits) : "";
  $("svn-questions").textContent = s && s.questions.length ? String(s.questions.length) : "";

  // L'adresse suit la séance choisie (#appel/s/123) — seulement quand on est
  // sur En cours : ailleurs, elle dit l'onglet ouvert, pas la séance.
  if (aSeance && /^#appel(\/|$)/.test(location.hash || "") && location.hash !== "#appel/s/" + sel.value) {
    try { history.replaceState(null, "", "#appel/s/" + sel.value); } catch (e) {}
  }

  // Pas de séance : l'état vide propose le geste, au lieu d'une phrase.
  var sa = $("stats-attente");
  if (!aSeance && sa && !sa.hidden && !sa.querySelector("button")) {
    sa.innerHTML = "Aucune séance choisie. ";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec";
    b.textContent = "Choisir une séance";
    b.addEventListener("click", function(){ $("sv-choix").hidden = true; $("sv-fil").click(); });
    sa.appendChild(b);
  }

  if (!$("sv-fin").hidden) rendreCompteRendu();
  appliquerFiltres();
  majDepuis();
}

// Les titres des modules, lus à la première séance qui en a un (pas au
// chargement : avant la connexion enseignante, la base refuserait).
var titresEnCours = false;
function lireTitres(){
  if (titresEnCours) return;
  titresEnCours = true;
  lireModules().then(function(l){
    titresEnCours = false;
    if (!l) return;
    titresModules = {};
    l.forEach(function(c){ (c.modules || []).forEach(function(m){
      titresModules[m.id] = (m.icone ? m.icone + " " : "") + m.titre.split(" — ")[0];
    }); });
    majPilote();
  });
}

function etatSeance(p){
  if (!p) return ["neutre", "—"];
  if (p.nature === "projet") return p.ouverte ? ["ok", "Projet ouvert"] : ["neutre", "Projet fermé"];
  if (p.ouverte && p.demarree_le) return ["ok", "En cours"];
  if (p.ouverte) return ["att", "Ouverte"];
  if (p.demarree_le) return ["neutre", "Terminée"];
  return ["neutre", "Pas démarrée"];
}

// « Mis à jour il y a 12 s » : ce qu'on regarde est-il frais ?
function majDepuis(){
  var z = $("sv-maj");
  if (!z) return;
  if (suivi.pause) { z.textContent = "en pause"; z.className = "sv-maj pause"; return; }
  if (!derniereMaj) { z.textContent = ""; return; }
  var sec = Math.round((Date.now() - derniereMaj) / 1000);
  z.textContent = sec < 5 ? "à l'instant" : (sec < 60 ? "il y a " + sec + " s"
                  : "il y a " + Math.round(sec / 60) + " min");
  z.className = "sv-maj" + (sec > 30 ? " vieux" : "");
}

// ── Les vues ─────────────────────────────────────────────────────────────
function ouvrirVue(v, focus){
  if (VUES.indexOf(v) < 0) v = "maintenant";
  VUES.forEach(function(k){
    var b = $("svb-" + k), p = $("sv-" + k);
    var actif = k === v;
    b.classList.toggle("actif", actif);
    b.setAttribute("aria-selected", actif ? "true" : "false");
    b.tabIndex = actif ? 0 : -1;
    p.hidden = !actif;
  });
  if (focus) $("svb-" + v).focus();
  if (v === "fin") rendreCompteRendu();
  try { localStorage.setItem(CLE_VUE, v); } catch (e) {}
}

// ── Les élèves : marquer, filtrer, chercher ──────────────────────────────
var INACTIF_MS = 8 * 60000;

function marquerEleve(d, l, total){
  d.dataset.num = l.numero;
  d.dataset.id = l.id;
  d.dataset.etat = l.n === 0 ? "rien" : (l.n >= total ? "fini" : "cours");
  d.dataset.faible = l.reussite !== null && l.reussite < 40 ? "1" : "";
  d.dataset.maj = l.maj || "";
  d.tabIndex = 0;
  d.setAttribute("role", "button");
  d.setAttribute("aria-label", "Ouvrir la fiche de l'élève " + l.numero);
  // Le prénom local, s'il est chargé : c'est ce qu'on cherche.
  var nom = nomDe(codeClasseCourante(), l.numero);
  d.dataset.nom = nom ? prenomSeul(nom).toLowerCase() : "";
  if (nom && !d.querySelector(".el-nom")) {
    var n = document.createElement("span");
    n.className = "el-nom";
    n.textContent = prenomSeul(nom);
    d.querySelector(".el-num").after(n);
  }
  // Heure relative, l'heure exacte au survol.
  var mj = d.querySelector(".el-maj");
  if (mj && l.maj) { mj.title = mj.textContent; mj.textContent = ilYa(l.maj); }
}

function ilYa(iso){
  var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return "";
  if (s < 60) return "à l'instant";
  if (s < 3600) return "il y a " + Math.round(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.round(s / 3600) + " h";
  return "il y a " + Math.round(s / 86400) + " j";
}

function correspond(d, f, q){
  var ok = f === "tous" || (f === "faible" ? d.dataset.faible === "1"
         : f === "inactif" ? (d.dataset.etat !== "fini" && (!d.dataset.maj ||
             Date.now() - new Date(d.dataset.maj).getTime() > INACTIF_MS))
         : d.dataset.etat === f);
  if (ok && q) ok = d.dataset.num.indexOf(q) === 0 || (d.dataset.nom || "").indexOf(q) >= 0;
  return ok;
}

function appliquerFiltres(){
  var l = $("liste-eleves");
  if (!l) return;
  var q = (($("sv-recherche") || {}).value || "").trim().toLowerCase();
  var lignes = [].slice.call(l.querySelectorAll(".el"));
  var vus = 0;
  lignes.forEach(function(d){
    var ok = correspond(d, filtre, q);
    d.classList.toggle("el-cache", !ok);
    if (ok) vus++;
  });
  var c = $("sv-compte-el");
  if (c) c.textContent = !lignes.length ? "" : (vus === lignes.length
    ? lignes.length + " élèves" : vus + " sur " + lignes.length + " élèves");
}

function choisirFiltre(b){
  filtre = b.dataset.f;
  [].forEach.call($("sv-filtres").querySelectorAll(".filtre"), function(x){
    var on = x === b;
    x.classList.toggle("on", on);
    x.setAttribute("aria-pressed", on ? "true" : "false");
  });
  appliquerFiltres();
}

// ── Branchements, une fois ───────────────────────────────────────────────
function brancherPilote(){
  if (!$("sv-tete") || $("sv-tete").dataset.branche) return;
  $("sv-tete").dataset.branche = "oui";

  $("sv-fil").addEventListener("click", function(){
    var c = $("sv-choix"), ouvert = c.hidden;
    c.hidden = !ouvert;
    $("sv-fil").setAttribute("aria-expanded", ouvert ? "true" : "false");
    if (ouvert) $("pk-seance").focus();
  });
  // Choisir une séance referme le sélecteur : on l'a ouvert pour ça. Le
  // squelette remplace « Chargement… » une fois activerSeance() passée.
  $("pk-seance").addEventListener("change", function(){
    if ($("pk-seance").value) { $("sv-choix").hidden = true; $("sv-fil").setAttribute("aria-expanded", "false"); }
    derniereMaj = 0;
    setTimeout(function(){
      var sa = $("stats-attente");
      if (sa && sa.textContent === "Chargement…") sa.innerHTML = SQUELETTE;
      majPilote();
    }, 0);
  });

  VUES.forEach(function(v, i){
    var b = $("svb-" + v);
    b.addEventListener("click", function(){ ouvrirVue(v); });
    b.addEventListener("keydown", function(e){
      var d = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      ouvrirVue(VUES[(i + d + VUES.length) % VUES.length], true);
    });
  });
  var memo = null;
  try { memo = localStorage.getItem(CLE_VUE); } catch (e) {}
  ouvrirVue(memo || "maintenant");

  [].forEach.call($("sv-filtres").querySelectorAll(".filtre"), function(b){
    b.addEventListener("click", function(){ choisirFiltre(b); });
  });
  $("sv-recherche").addEventListener("input", appliquerFiltres);

  var liste = $("liste-eleves");
  var ouvrir = function(e){
    var d = e.target.closest && e.target.closest(".el");
    if (!d || !d.dataset.id) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    ouvrirFiche({ id: d.dataset.id, numero: d.dataset.num, classeId: suivi.classeId,
                  seanceId: suivi.seanceId });
  };
  liste.addEventListener("click", ouvrir);
  liste.addEventListener("keydown", ouvrir);

  $("b-sv-pause").addEventListener("click", function(){
    suivi.pause = !suivi.pause;
    var b = $("b-sv-pause");
    b.textContent = suivi.pause ? "Reprendre" : "Pause";
    b.setAttribute("aria-pressed", suivi.pause ? "true" : "false");
    majDepuis();
    if (!suivi.pause && $("b-rafraichir")) $("b-rafraichir").click();
  });

  $("b-sv-action").addEventListener("click", function(){
    var geste = $("b-sv-action").dataset.geste;
    if (geste === "demarrer") {
      $("b-demarrer").click();
      toast("Séance démarrée : les réponses sont ouvertes, le chrono part.");
    } else if (geste === "clore") {
      var b = $("b-sv-action");
      b.disabled = true;
      toast("La séance va être close : plus aucune réponse ne sera acceptée.", {
        // Une fois close, on va d'office au compte rendu : c'est ce qu'on
        // fait ensuite, et il est prêt.
        apres: function(){ b.disabled = false; $("b-clore").click(); ouvrirVue("fin"); },
        annuler: function(){ b.disabled = false; toast("Clôture annulée. La séance reste ouverte."); }
      });
    }
  });

  var pvTete = document.querySelector("#prevol .prevol-tete");
  if (pvTete) {
    pvTete.addEventListener("click", function(){
      var pv = $("prevol");
      if (!pv.classList.contains("pv-replie") && !pv.dataset.ouvert) return;
      pv.dataset.ouvert = pv.dataset.ouvert ? "" : "oui";
      pv.classList.toggle("pv-replie", !pv.dataset.ouvert);
    });
  }

  setInterval(function(){ majDepuis(); if (suivi.prevol && suivi.prevol.ouverte) majPilote(); }, 5000);
}
brancherPilote();

export { majPilote, marquerEleve, ouvrirVue, appliquerFiltres, ilYa, etatSeance };
