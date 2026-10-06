// ── Les actions groupées sur « Les séances » ──────────────────────────────
//
// Lot 3 des propositions du 05/10 (06/10). Programmer six séances d'un
// module, c'était ouvrir six fiches. Chaque ligne de la liste porte
// maintenant une case (gestion.js), chaque module un « tout choisir », et
// une barre apparaît dès qu'une séance est choisie :
//
//   Programmer à la suite · Retirer la date · Rendre visibles · Ouvrir ·
//   Clore · Ranger dans [module]
//
// Programmer passe par programmer_seances() : les séances, dans l'ordre de
// leurs numéros, prennent les créneaux libres suivants de l'emploi du temps.
// Le reste appelle, séance par séance, la fonction que la ligne appellerait
// seule — les mêmes refus, les mêmes motifs — et la carte dit ce qui a été
// fait et ce qui a été refusé, séance par séance. « Clore » part après cinq
// secondes, avec « Annuler », comme partout. Un cours ne s'ouvre pas en lot :
// il se démarre à l'heure, chrono compris.

import { $, sb, erreur } from './socle.js';
import { seancesLues, relireGestion } from './gestion.js';
import { ouvrirSeance, fermerSeance, montrerSeance } from './ouverture.js';
import { quandLisible } from './etat.js';
import { toast } from './toast.js';
import { texteRefus } from './refus.js';

function choisies(){
  var l = seancesLues();
  var ids = [].map.call(document.querySelectorAll("#gs-liste .gs-choix:checked"), function(c){ return String(c.value); });
  return (l ? l.liste : []).filter(function(s){ return ids.indexOf(String(s.id)) >= 0; })
    .sort(function(a, b){ return a.numero - b.numero; });
}

function majBarre(){
  var z = $("gs-lot");
  if (!z) return;
  var c = choisies();
  z.hidden = !c.length;
  $("gs-lot-n").textContent = c.length ? c.length + (c.length > 1 ? " séances choisies" : " séance choisie") +
    " (" + c.map(function(s){ return s.numero; }).join(", ") + ")" : "";
  // Un geste qui ne s'appliquerait à aucune des séances choisies est grisé.
  var peut = {
    programmer: c.some(function(s){ return !s.ouverte && !s.demarree_le; }),
    deprogrammer: c.some(function(s){ return s.prevue_le && !s.demarree_le; }),
    montrer: c.some(function(s){ return !s.publiee; }),
    ouvrir: c.some(function(s){ return s.nature === "projet" && !s.ouverte; }),
    clore: c.some(function(s){ return s.ouverte; })
  };
  [].forEach.call(z.querySelectorAll("[data-lot]"), function(b){ b.disabled = !peut[b.dataset.lot]; });
  var sel = $("gs-lot-module"), l = seancesLues();
  $("gs-lot-ranger").hidden = !(l && l.modules && l.modules.length);
  if (l && l.modules && sel.dataset.pour !== String(l.classeId)) {
    sel.dataset.pour = String(l.classeId);
    sel.innerHTML = '<option value="">Ranger dans…</option>';
    l.modules.forEach(function(m){
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = (m.icone ? m.icone + " " : "") + m.titre;
      sel.appendChild(o);
    });
  }
}

// Après chaque rendu de la liste : un « tout choisir » par module.
function decorer(){
  var liste = $("gs-liste");
  if (!liste) return;
  [].forEach.call(liste.querySelectorAll("h3.gs-module"), function(h){
    var cases = [];
    for (var x = h.nextElementSibling; x && !x.matches("h3"); x = x.nextElementSibling) {
      var c = x.querySelector(".gs-choix");
      if (c) cases.push(c);
    }
    if (!cases.length) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-discret lot-mod";
    b.textContent = "tout choisir";
    b.setAttribute("aria-label", "Choisir toutes les séances : " + h.textContent);
    b.addEventListener("click", function(){
      var tout = cases.every(function(c){ return c.checked; });
      cases.forEach(function(c){ c.checked = !tout; });
      majBarre();
    });
    h.appendChild(b);
  });
  majBarre();
}

// ── Les gestes ───────────────────────────────────────────────────────────
// `un(s)` rend une promesse { ok, detail } ; `garder(s)` dit si la séance
// est concernée. Un refus n'arrête pas les suivantes : on dit lesquelles.
function enSerie(liste, garder, un, nomGeste){
  var faites = [], refus = [], ecartees = liste.filter(function(s){ return !garder(s); });
  var chaine = Promise.resolve();
  liste.filter(garder).forEach(function(s){
    chaine = chaine.then(function(){
      return un(s).then(function(d){
        if (d && d.ok) faites.push(s.numero);
        else refus.push(s.numero + " — " + ((d && d.detail) || texteRefus(d)));
      });
    });
  });
  return chaine.then(function(){ conclure(nomGeste, faites, refus, ecartees); });
}

function conclure(nomGeste, faites, refus, ecartees, motRefus){
  var bouts = [];
  if (faites.length) bouts.push(nomGeste + " : " + faites.join(", ") + ".");
  if (ecartees.length) bouts.push("Pas concernée" + (ecartees.length > 1 ? "s" : "") + " : " +
    ecartees.map(function(s){ return s.numero; }).join(", ") + ".");
  if (refus.length) bouts.push((motRefus || "Refusé") + " : " + refus.join(" ; ") + ".");
  Promise.resolve(relireGestion()).then(function(){
    erreur("err-gs-liste", bouts.join(" "), !refus.length);
  });
  document.dispatchEvent(new Event("tdc-seance-changee"));
  if (faites.length) toast(nomGeste + " : " + faites.length + (faites.length > 1 ? " séances." : " séance."));
}

function rpc(nom, args){
  return sb.rpc(nom, args).then(function(r){
    return r && !r.error && r.data ? r.data : { ok: false, detail: texteRefus(r) };
  });
}

function faireEnLot(geste, bouton){
  var c = choisies();
  if (!c.length) return;
  erreur("err-gs-liste", "");
  if (geste === "programmer") {
    bouton.disabled = true;
    return rpc("programmer_seances", { p_ids: c.map(function(s){ return Number(s.id); }), p_depuis: null }).then(function(d){
      bouton.disabled = false;
      if (!d.ok) { erreur("err-gs-liste", d.detail || texteRefus(d)); return; }
      var faites = (d.programmees || []).map(function(x){ return x.numero + " " + quandLisible(x.prevue_le, x.fin_prevue); });
      var refus = (d.ecartees || []).map(function(x){ return x.numero + " — " + x.detail; });
      conclure("Programmées à la suite", faites, refus, [], "Pas programmée");
    });
  }
  if (geste === "deprogrammer") {
    return enSerie(c, function(s){ return s.prevue_le && !s.demarree_le; }, function(s){
      return rpc("planifier_seance", { p_seance_id: Number(s.id), p_prevue_le: null, p_fin_prevue: null,
                                       p_auto_ouvrir: false, p_auto_clore: false });
    }, "Date retirée");
  }
  if (geste === "montrer") {
    return enSerie(c, function(s){ return !s.publiee; }, function(s){ return montrerSeance(s.id, true); }, "Rendues visibles");
  }
  if (geste === "ouvrir") {
    return enSerie(c, function(s){ return s.nature === "projet" && !s.ouverte; },
      function(s){ return ouvrirSeance(s.id); }, "Ouvertes et visibles");
  }
  if (geste === "clore") {
    var ouvertes = c.filter(function(s){ return s.ouverte; });
    bouton.disabled = true;
    toast(ouvertes.length + (ouvertes.length > 1 ? " séances vont être closes" : " séance va être close") +
          " : plus aucune réponse n'y sera acceptée.", {
      apres: function(){
        bouton.disabled = false;
        enSerie(c, function(s){ return s.ouverte; }, function(s){ return fermerSeance(s.id); }, "Closes");
      },
      annuler: function(){ bouton.disabled = false; toast("Clôture annulée : rien n'a changé."); }
    });
  }
}

function ranger(sel){
  var m = sel.value;
  if (!m) return;
  var c = choisies();
  sel.disabled = true;
  enSerie(c, function(s){ return String(s.module_id) !== String(m); }, function(s){
    return rpc("ranger_seance", { p_seance_id: Number(s.id), p_module_id: Number(m) });
  }, "Rangées dans " + sel.options[sel.selectedIndex].textContent).then(function(){
    sel.disabled = false;
    sel.value = "";
  });
}

function brancherLot(){
  if (!$("gs-lot") || $("gs-lot").dataset.branche) return;
  $("gs-lot").dataset.branche = "oui";
  $("gs-liste").addEventListener("change", function(e){
    if (e.target && e.target.classList && e.target.classList.contains("gs-choix")) majBarre();
  });
  [].forEach.call($("gs-lot").querySelectorAll("[data-lot]"), function(b){
    b.addEventListener("click", function(){ faireEnLot(b.dataset.lot, b); });
  });
  $("gs-lot-module").addEventListener("change", function(){ ranger($("gs-lot-module")); });
  $("b-gs-lot-vider").addEventListener("click", function(){
    [].forEach.call(document.querySelectorAll("#gs-liste .gs-choix:checked"), function(c){ c.checked = false; });
    majBarre();
  });
  document.addEventListener("tdc-liste-rendue", decorer);
}
brancherLot();

export { choisies, majBarre };
