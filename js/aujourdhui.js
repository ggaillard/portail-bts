// ── Aujourd'hui : l'agenda du jour, en tête d'En cours ────────────────────
//
// Lot 2 des propositions du 05/10 (06/10). Jusque-là, commencer le cours du
// jour quand En cours en montrait un autre demandait quatre gestes — Changer,
// la classe, la séance, Démarrer — et rien ne disait qu'une séance était
// prévue à 15 h. La carte lit aujourdhui() : les CRÉNEAUX de l'emploi du
// temps, toutes classes réelles, et les SÉANCES du jour (programmées,
// démarrées ce jour-là, ou un cours encore ouvert). Elle les croise :
//
//   15:00–17:00  BTS SIO 2 - SLAM · 21 — Projet IA (1/2)   [Programmée]  [Ouvrir]
//   10:00–11:00  BTS SIO 1 - Bloc 1 DEV · aucune séance prévue      [Programmer ›]
//
// UNE ligne, UN geste — celui que l'état appelle (etat.js) : Démarrer un
// cours prêt, Ouvrir un projet, Clore une séance oubliée (différé, avec
// « Annuler »), Rendre visible, Préparer une séance qui n'est pas prête,
// le compte rendu d'une séance finie. Le titre, lui, emmène la séance dans
// l'écran du direct juste en dessous.
//
// La carte se relit chaque minute (l'automate de la base ouvre à l'heure), et
// tout de suite quand un geste change une séance ailleurs (évènement
// « tdc-seance-changee »). Sans la migration du 06/10, elle reste cachée.

import { $, sb, suivi, erreur, typo } from './socle.js';
import { etatDe, heureDe } from './etat.js';
import { chargerSeancesDe, chargerPrevol, pilotage } from './seance.js';
import { ouvrirSeance, fermerSeance, montrerSeance, depuisLe } from './ouverture.js';
import { preparerSeance, lireSeances } from './gestion.js';
import { allerEmploiDuTemps } from './planning.js';
import { ouvrirOnglet } from './navigation.js';
import { ouvrirVue } from './pilote.js';
import { toast } from './toast.js';
import { texteRefus } from './refus.js';

var MARGE_MS = 30 * 60000;     // une séance démarrée un peu avant son créneau y appartient
var jourLu = null;

function chargerJour(){
  var carte = $("carte-jour");
  if (!carte) return Promise.resolve();
  return sb.rpc("aujourdhui").then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) { carte.hidden = true; return; }
    jourLu = r.data;
    carte.hidden = false;
    rendreJour(r.data);
  }, function(){ carte.hidden = true; });
}

// Croiser créneaux et séances. Une séance va sur le créneau de sa classe
// qu'elle chevauche (programmée) ou dans lequel elle a démarré ; les autres
// ont leur propre ligne — un cours oublié ouvert d'un autre jour en tête.
function debutFin(s){
  var d = s.prevue_le ? Date.parse(s.prevue_le) : (s.demarree_le ? Date.parse(s.demarree_le) : null);
  var f = s.fin_prevue ? Date.parse(s.fin_prevue) : (d !== null ? d + (Number(s.duree_min) || 55) * 60000 : null);
  return [d, f];
}
function lignesDuJour(d){
  var seances = (d.seances || []).slice(), lignes = [];
  (d.creneaux || []).forEach(function(c){
    var cd = Date.parse(c.debut_le), cf = Date.parse(c.fin_le);
    var ici = seances.filter(function(s){
      if (String(s.classe_id) !== String(c.classe_id)) return false;
      var df = debutFin(s);
      return df[0] !== null && df[0] < cf && cd - MARGE_MS < df[1];
    });
    ici.forEach(function(s){ seances.splice(seances.indexOf(s), 1); });
    if (!ici.length) lignes.push({ debut: cd, fin: cf, creneau: c, seance: null });
    ici.forEach(function(s){ lignes.push({ debut: cd, fin: cf, creneau: c, seance: s }); });
  });
  seances.forEach(function(s){
    var df = debutFin(s);
    lignes.push({ debut: df[0], fin: df[1], creneau: null, seance: s });
  });
  // Un oubli d'un autre jour d'abord (il bloque), puis l'ordre des heures.
  var autreJour = function(l){ return l.seance && l.debut !== null &&
    new Date(l.debut).toDateString() !== new Date(Date.parse(d.maintenant || Date.now())).toDateString() ? 0 : 1; };
  lignes.sort(function(a, b){ return autreJour(a) - autreJour(b) || (a.debut || 0) - (b.debut || 0); });
  return lignes;
}

// Le geste qu'appelle l'état, et le libellé du bouton.
function gesteDuJour(s){
  if (!s) return { cle: "programmer", libelle: "Programmer ›" };
  var e = etatDe(s).code, projet = s.nature === "projet";
  if (e === "brouillon") return { cle: "preparer", libelle: "Préparer ›" };
  if (e === "oubliee") return { cle: "clore", libelle: "Clore", principal: true };
  if (e === "cache") return { cle: "montrer", libelle: "Rendre visible" };
  if (e === "terminee" || e === "clos") return { cle: "bilan", libelle: "Compte rendu ›" };
  if (e === "en_cours" || e === "ouvert") return { cle: "suivre", libelle: "Suivre ›" };
  return projet ? { cle: "ouvrir", libelle: "Ouvrir", principal: true }
                : { cle: "demarrer", libelle: "Démarrer", principal: true };
}

function rendreJour(d){
  var maintenant = Date.parse(d.maintenant) || Date.now();
  var date = new Date(String(d.jour) + "T12:00");
  $("jour-date").textContent = typo(date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) +
    " · ouverture automatique " + (d.automatique ? "en marche" : "à l'arrêt"));
  var ul = $("jour-liste");
  ul.innerHTML = "";
  erreur("err-jour", "");
  var lignes = lignesDuJour(d);
  if (!lignes.length) {
    var li = document.createElement("li");
    li.className = "jour-vide";
    li.textContent = "Pas de cours prévu aujourd'hui. ";
    if (!d.emploi_du_temps) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn-discret";
      b.textContent = "Poser l'emploi du temps ›";
      b.addEventListener("click", function(){ allerEmploiDuTemps(); });
      li.appendChild(b);
    }
    ul.appendChild(li);
    return;
  }
  lignes.forEach(function(l){ ul.appendChild(ligneDuJour(l, maintenant)); });
}

function ligneDuJour(l, maintenant){
  var s = l.seance, c = l.creneau;
  var li = document.createElement("li");
  var encours = l.debut !== null && l.debut <= maintenant && maintenant < (l.fin || l.debut);
  li.className = "jour-l" + (encours ? " maintenant" : "") + (s ? "" : " jour-libre");
  var h = document.createElement("span");
  h.className = "jour-h";
  // Une séance d'un autre jour (un cours oublié ouvert) : son heure d'alors
  // se lirait comme un créneau d'aujourd'hui. On dit depuis quand.
  var autreJour = l.debut !== null && new Date(l.debut).toDateString() !== new Date(maintenant).toDateString();
  h.textContent = l.debut === null ? "—" : (autreJour ? "depuis " + depuisLe(new Date(l.debut).toISOString(), maintenant)
    : heureDe(new Date(l.debut).toISOString()) + (l.fin ? "–" + heureDe(new Date(l.fin).toISOString()) : ""));
  if (encours) {
    var vh = document.createElement("span");
    vh.className = "vh";
    vh.textContent = " (en ce moment)";
    h.appendChild(vh);
  }
  li.appendChild(h);

  var t = document.createElement("span");
  t.className = "jour-t";
  var cl = document.createElement("span");
  cl.className = "jour-c";
  cl.textContent = (s ? s.nom : c.nom) || "";
  t.appendChild(cl);
  if (s) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-discret jour-s";
    b.textContent = typo(s.numero + " — " + s.titre);
    b.setAttribute("aria-label", "Suivre la séance " + s.numero + " — " + s.titre);
    b.addEventListener("click", function(){ suivreDuJour(s); });
    t.appendChild(b);
    var m = noteDuJour(s);
    if (m) {
      var n = document.createElement("span");
      n.className = "jour-m";
      n.textContent = m;
      t.appendChild(n);
    }
  } else {
    var v = document.createElement("span");
    v.className = "jour-m";
    v.textContent = "Aucune séance programmée sur ce créneau.";
    t.appendChild(v);
  }
  li.appendChild(t);

  if (s) {
    var e = etatDe(s);
    var bd = document.createElement("span");
    bd.className = "badge " + e.ton;
    bd.textContent = e.libelle;
    li.appendChild(bd);
  }
  var g = gesteDuJour(s);
  var a = document.createElement("button");
  a.type = "button";
  a.className = (g.principal ? "btn" : "qa-b") + " jour-a";
  a.textContent = g.libelle;
  a.dataset.geste = g.cle;
  a.setAttribute("aria-label", g.libelle.replace(" ›", "") + (s ? " — séance " + s.numero : " — " + (c && c.nom)));
  a.addEventListener("click", function(){ faireDuJour(g.cle, s, c, a); });
  li.appendChild(a);
  return li;
}

// Ce que l'automate a fait, ou fera ; ce qui manque.
var MANQUE = { corriges: "corrigés", concepts: "concepts", missions: "missions",
               echeance: "échéance", module: "module" };
function noteDuJour(s){
  var bouts = [];
  (s.journal || []).forEach(function(j){
    if (j.note === "deja") return;
    bouts.push((j.geste === "ouvrir" ? "ouverte" : "close") + " automatiquement à " + heureDe(j.fait_le));
  });
  var fait = function(g){ return (s.journal || []).some(function(j){ return j.geste === g; }); };
  if (s.auto_ouvrir && !fait("ouvrir") && !s.ouverte && s.prevue_le) bouts.push("ouverture automatique à " + heureDe(s.prevue_le));
  if (s.auto_clore && !fait("clore") && s.ouverte && s.fin_prevue) {
    bouts.push("clôture automatique à " + heureDe(new Date(Date.parse(s.fin_prevue) + 15 * 60000).toISOString()));
  }
  if (etatDe(s).code === "brouillon" && s.manque && s.manque.length) {
    bouts.push("manque : " + s.manque.map(function(k){ return MANQUE[k] || k; }).join(", "));
  }
  return bouts.join(" · ");
}

// ── Les gestes ───────────────────────────────────────────────────────────
function suivreDuJour(s){
  var sel = $("pk-classe");
  if (sel) sel.value = String(s.classe_id);
  return chargerSeancesDe(s.classe_id, s.id).then(function(){
    var c = $("carte-suivi");
    if (c && c.scrollIntoView) c.scrollIntoView({ block: "start" });
  });
}

function faireDuJour(cle, s, c, bouton){
  erreur("err-jour", "");
  if (cle === "programmer") {
    ouvrirOnglet("quest");
    if ($("gs-classe")) $("gs-classe").value = String(c.classe_id);
    return lireSeances(c.classe_id).then(function(){
      erreur("err-gs-liste", "Choisissez la séance à programmer : sa fiche propose le prochain créneau libre.", true);
    });
  }
  if (cle === "preparer") return preparerSeance(s.classe_id, s.id, "infos");
  if (cle === "suivre") return suivreDuJour(s);
  if (cle === "bilan") return suivreDuJour(s).then(function(){ ouvrirVue("fin"); });
  if (cle === "demarrer") {
    // Le geste même de l'en-tête (pilotage), sur la séance qu'on vient de
    // charger : un seul chemin pour démarrer, quel que soit le bouton.
    return suivreDuJour(s).then(function(){
      pilotage("demarrer_seance", "Séance démarrée : les réponses sont ouvertes, le chrono part.");
      toast("Séance " + s.numero + " démarrée : les réponses sont ouvertes, le chrono part.");
    });
  }
  bouton.disabled = true;
  if (cle === "ouvrir") {
    return ouvrirSeance(s.id).then(function(d){
      return apresDuJour(d, bouton, "Séance " + s.numero + " ouverte et visible.", s).then(function(){
        if (d.ok) return suivreDuJour(s);
      });
    });
  }
  if (cle === "montrer") {
    return montrerSeance(s.id, true).then(function(d){
      return apresDuJour(d, bouton, "Séance " + s.numero + " visible.", s);
    });
  }
  if (cle === "clore") {
    toast("La séance " + s.numero + " va être close : plus aucune réponse ne sera acceptée.", {
      apres: function(){
        fermerSeance(s.id).then(function(d){
          apresDuJour(d, bouton, "Séance " + s.numero + " close. Les réponses déjà données restent.", s);
        });
      },
      annuler: function(){ bouton.disabled = false; toast("Clôture annulée. La séance reste ouverte."); }
    });
  }
}

// L'agenda se relit par l'évènement ; l'écran du direct, s'il regarde
// cette séance-là, doit dire le nouvel état sans rechargement.
function apresDuJour(d, bouton, message, s){
  bouton.disabled = false;
  if (!d || !d.ok) { erreur("err-jour", d && d.detail ? d.detail : texteRefus(d)); return Promise.resolve(); }
  toast(message);
  document.dispatchEvent(new Event("tdc-seance-changee"));
  if (String(suivi.seanceId) === String(s.id)) chargerPrevol();
  return Promise.resolve();
}

function brancherJour(){
  if (!$("carte-jour") || $("carte-jour").dataset.branche) return;
  $("carte-jour").dataset.branche = "oui";
  document.addEventListener("tdc-seance-changee", function(){ if (jourLu) chargerJour(); });
  // Chaque minute, seulement si on la regarde : l'automate ouvre à l'heure.
  setInterval(function(){
    if (!jourLu || suivi.pause || document.hidden) return;
    if ($("volet-appel") && $("volet-appel").hidden) return;
    chargerJour();
  }, 60000);
}
brancherJour();

export { chargerJour, lignesDuJour, gesteDuJour, noteDuJour };
