// ── Les raccourcis clavier, et leur aide ──────────────────────────────────
//
// Lot 1 des propositions du 05/10, item 1.7. Le portail ne connaissait
// qu'Échap. Au bureau, pendant l'heure, les gestes qui reviennent cent fois —
// changer de séance, mettre en pause, passer aux élèves — demandaient la
// souris à chaque fois (critère « adaptabilité » de Bastien & Scapin : les
// utilisateurs expérimentés doivent pouvoir aller plus vite).
//
//   Ctrl+K  aller à une séance (de n'importe quel onglet)
//   D       démarrer la séance, ou ouvrir le projet — jamais clore : un geste
//           qui coupe les réponses de toute la classe ne part pas d'une touche
//   P       pause / reprise de la mise à jour
//   1 à 4   les quatre vues de la séance
//   /       chercher un élève
//   ?       l'aide, qui liste tout cela
//
// Règles qui ne se devinent pas :
//   · WCAG 2.1.4 : un raccourci d'UNE touche doit pouvoir se couper. L'aide
//     porte un interrupteur, gardé dans ce navigateur. Ctrl+K reste actif :
//     avec une touche de modification, il ne se déclenche pas en tapant.
//   · Jamais dans un champ de saisie, jamais pendant la projection ou une
//     fiche élève ouverte, jamais côté étudiant.
//   · L'aide est un <dialog> natif ouvert par showModal() : le focus y entre,
//     y reste, Échap le referme et rend le focus d'où l'on venait.

import { $, suivi } from './socle.js';
import { ouvrirVue } from './pilote.js';
import { ouvrirOnglet, pageOuverte, allerSeance } from './navigation.js';
import { interrupteur, reglerInterrupteur } from './interrupteur.js';

var CLE = "tdc-raccourcis";
var VUES_RC = ["maintenant", "eleves", "questions", "fin"];

function raccourcisActifs(){
  try { return localStorage.getItem(CLE) !== "non"; } catch (e) { return true; }
}

function dansUnChamp(el){
  if (!el) return false;
  var t = (el.tagName || "").toLowerCase();
  return t === "input" || t === "textarea" || t === "select" || el.isContentEditable;
}

function ouvrirAideRaccourcis(){
  var d = $("rc-aide");
  if (!d || d.open) return;
  var z = $("rc-inter");
  if (z && !z.firstChild) {
    z.appendChild(interrupteur({ libelle: "Raccourcis à une touche", on: raccourcisActifs(),
      nom: "Raccourcis à une touche (D, P, 1 à 4, /, ?)",
      change: function(vise, b){
        try { localStorage.setItem(CLE, vise ? "oui" : "non"); } catch (e) {}
        reglerInterrupteur(b, vise);
      } }));
  }
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
}

// La carte du direct vit dans En cours, ou dans la page d'une séance sur
// son onglet En direct (06/10, lot 3) : les touches la suivent.
function directVisible(){
  if ($("volet-appel") && !$("volet-appel").hidden) return true;
  var p = pageOuverte();
  return !!(p && p.onglet === "direct");
}

function allerAUneSeance(){
  var p = pageOuverte();
  if (p) { if (p.onglet !== "direct") allerSeance(p.id, "direct", null, "remplacer"); }
  else ouvrirOnglet("appel");
  var c = $("sv-choix"), f = $("sv-fil");
  if (c && c.hidden && f) f.click();       // pilote.js ouvre le panneau et y met le focus
  else if ($("cs-saisie")) $("cs-saisie").focus();
}

function surTouche(e){
  if ($("espace-ens") && $("espace-ens").hidden) return;
  if (suivi.ecran || ($("fiche-eleve") && !$("fiche-eleve").hidden)) return;
  if ($("rc-aide") && $("rc-aide").open) return;     // le dialogue gère ses touches

  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    allerAUneSeance();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || dansUnChamp(e.target)) return;
  if (!raccourcisActifs()) return;

  var enCours = directVisible();
  var k = e.key;
  if (k === "?") { e.preventDefault(); ouvrirAideRaccourcis(); return; }
  if (!enCours) return;
  if (k === "d" || k === "D") {
    var a = $("b-sv-action");
    if (a && !a.hidden && !a.disabled && (a.dataset.geste === "demarrer" || a.dataset.geste === "ouvrir")) {
      e.preventDefault(); a.click();
    }
  } else if (k === "p" || k === "P") {
    if ($("b-sv-pause")) { e.preventDefault(); $("b-sv-pause").click(); }
  } else if (/^[1-4]$/.test(k)) {
    e.preventDefault(); ouvrirVue(VUES_RC[Number(k) - 1], true);
  } else if (k === "/") {
    e.preventDefault(); ouvrirVue("eleves"); if ($("sv-recherche")) $("sv-recherche").focus();
  }
}

function brancherRaccourcis(){
  if (document.body.dataset.raccourcis) return;
  document.body.dataset.raccourcis = "oui";
  document.addEventListener("keydown", surTouche);
  if ($("b-raccourcis")) $("b-raccourcis").addEventListener("click", ouvrirAideRaccourcis);
  if ($("rc-fermer")) $("rc-fermer").addEventListener("click", function(){ $("rc-aide").close(); });
}
brancherRaccourcis();

export { ouvrirAideRaccourcis, raccourcisActifs, surTouche };
