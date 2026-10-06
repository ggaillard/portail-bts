// ── La semaine à préparer : en tête de Préparer ───────────────────────────
//
// Lot 3 des propositions du 05/10 (06/10). On préparait séance par séance :
// ouvrir la fiche, lire « Prête à démarrer ? », passer à la suivante. Cette
// carte lit agenda() — les créneaux des sept prochains jours, toutes classes
// réelles, et les séances programmées dessus — et dit pour chacun, d'un coup
// d'œil, si la séance est prête et sinon ce qui lui manque, chaque manque
// menant à l'onglet de la fiche qui le règle :
//
//   lundi 12 octobre
//   15:00–17:00  BTS SIO 2 - SLAM · 11 — IA 1        [Prête]
//   10:00–12:00  BTS SIO 1 - Bloc 1 DEV · rien de programmé   [Y placer… ▾]
//
// Un créneau vide propose les séances de la classe qui ne sont ni jouées ni
// programmées : en choisir une la pose sur ce créneau (planifier_seance). Sans
// emploi du temps, la carte le dit et mène à la carte qui le pose.

import { $, sb, erreur, typo } from './socle.js';
import { etatDe, heureDe } from './etat.js';
import { allerEmploiDuTemps } from './planning.js';
import { toast } from './toast.js';
import { texteRefus } from './refus.js';

var decalage = 0;          // en semaines, à partir d'aujourd'hui
var lu = null;
var MANQUE = { corriges: ["corrigés du quiz", null], concepts: ["concepts", "concepts"],
               missions: ["missions", "missions"], echeance: ["échéance", "infos"], module: ["module", "infos"] };

function jourIso(d){
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function chargerAvenir(){
  var carte = $("carte-avenir");
  if (!carte) return Promise.resolve();
  var debut = new Date();
  debut.setDate(debut.getDate() + 7 * decalage);
  return sb.rpc("agenda", { p_debut: jourIso(debut), p_jours: 7 }).then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) { carte.hidden = true; return; }
    lu = r.data;
    carte.hidden = false;
    rendreAvenir(r.data);
  }, function(){ carte.hidden = true; });
}

// Les lignes d'un jour : chaque créneau avec la séance de sa classe qui le
// chevauche, puis les séances programmées hors de tout créneau.
function lignesDe(d){
  var jours = {};
  var cle = function(iso){ return jourIso(new Date(iso)); };
  (d.creneaux || []).forEach(function(c){
    var k = String(c.jour).slice(0, 10);
    (jours[k] = jours[k] || []).push({ debut: Date.parse(c.debut_le), fin: Date.parse(c.fin_le), creneau: c, seance: null });
  });
  (d.seances || []).forEach(function(s){
    var k = cle(s.prevue_le), l = jours[k] = jours[k] || [];
    var sd = Date.parse(s.prevue_le), sf = Date.parse(s.fin_prevue || s.prevue_le);
    var libre = l.filter(function(x){
      return !x.seance && x.creneau && String(x.creneau.classe_id) === String(s.classe_id) && sd < x.fin && x.debut < sf;
    })[0];
    if (libre) libre.seance = s;
    else l.push({ debut: sd, fin: sf, creneau: null, seance: s });
  });
  return Object.keys(jours).sort().map(function(k){
    return { jour: k, lignes: jours[k].sort(function(a, b){ return a.debut - b.debut; }) };
  });
}

function rendreAvenir(d){
  var debut = new Date(String(d.debut) + "T12:00"), fin = new Date(debut.getTime() + (d.jours - 1) * 86400000);
  var f = function(x){ return x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };
  $("av-periode").textContent = "du " + f(debut) + " au " + f(fin);
  $("b-av-prec").disabled = decalage <= 0;
  var ol = $("av-liste");
  ol.innerHTML = "";
  erreur("err-avenir", "");
  var jours = lignesDe(d);
  var n = { creneaux: 0, pretes: 0, regler: 0, vides: 0 };
  jours.forEach(function(j){
    j.lignes.forEach(function(l){
      if (l.creneau) n.creneaux++;
      if (!l.seance) { n.vides++; return; }
      if (etatDe(l.seance).code === "brouillon") n.regler++; else n.pretes++;
    });
  });
  $("av-resume").textContent = !jours.length ? "" :
    [n.creneaux + (n.creneaux > 1 ? " créneaux" : " créneau"),
     n.pretes + (n.pretes > 1 ? " séances prêtes" : " séance prête"),
     n.regler ? n.regler + " à régler" : "",
     n.vides ? n.vides + (n.vides > 1 ? " créneaux vides" : " créneau vide") : ""].filter(Boolean).join(" · ");
  if (!jours.length) {
    var v = document.createElement("li");
    v.className = "av-vide";
    v.textContent = d.emploi_du_temps ? "Aucun créneau ni séance programmée sur ces sept jours." : "Pas encore d'emploi du temps. ";
    if (!d.emploi_du_temps) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn-discret";
      b.textContent = "Le poser ›";
      b.addEventListener("click", function(){ allerEmploiDuTemps(); });
      v.appendChild(b);
    }
    ol.appendChild(v);
    return;
  }
  jours.forEach(function(j){
    var li = document.createElement("li");
    li.className = "av-jour";
    var h = document.createElement("h3");
    h.className = "av-j";
    h.textContent = new Date(j.jour + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    li.appendChild(h);
    var ul = document.createElement("ul");
    ul.className = "av-lignes";
    j.lignes.forEach(function(l){ ul.appendChild(ligneAvenir(l, d)); });
    li.appendChild(ul);
    ol.appendChild(li);
  });
}

function ligneAvenir(l, d){
  var s = l.seance, c = l.creneau;
  var li = document.createElement("li");
  li.className = "av-l" + (s ? "" : " av-libre");
  var h = document.createElement("span");
  h.className = "av-h";
  h.textContent = heureDe(new Date(l.debut).toISOString()) + (l.fin > l.debut ? "–" + heureDe(new Date(l.fin).toISOString()) : "");
  li.appendChild(h);
  var t = document.createElement("span");
  t.className = "av-t";
  var cl = document.createElement("span");
  cl.className = "av-c";
  cl.textContent = (s ? s.nom : c.nom) || "";
  t.appendChild(cl);
  li.appendChild(t);
  if (s) {
    var a = document.createElement("a");
    a.className = "av-s";
    a.href = "#s/" + s.id + "/preparer";
    a.textContent = typo(s.numero + " — " + s.titre);
    t.appendChild(a);
    var e = etatDe(s);
    var bd = document.createElement("span");
    bd.className = "badge " + (e.code === "brouillon" ? "att" : e.ton);
    bd.textContent = e.code === "brouillon" ? "À régler" : e.libelle;
    li.appendChild(bd);
    if (s.manque && s.manque.length) t.appendChild(manques(s));
    else if (e.code !== "brouillon") {
      var p = document.createElement("span");
      p.className = "av-m";
      p.textContent = "Prête" + (s.auto_ouvrir ? " · ouverture automatique" : "");
      t.appendChild(p);
    }
    return li;
  }
  var vide = document.createElement("span");
  vide.className = "av-m";
  vide.textContent = "Rien de programmé.";
  t.appendChild(vide);
  li.appendChild(placer(c, d));
  return li;
}

// « manque : missions · échéance », chaque mot menant à l'onglet qui le règle.
function manques(s){
  var p = document.createElement("span");
  p.className = "av-m";
  p.appendChild(document.createTextNode("manque : "));
  s.manque.forEach(function(k, i){
    if (i) p.appendChild(document.createTextNode(" · "));
    var m = MANQUE[k] || [k, "infos"];
    if (!m[1]) { p.appendChild(document.createTextNode(m[0])); return; }
    var a = document.createElement("a");
    a.href = "#s/" + s.id + "/preparer/" + m[1];
    a.textContent = m[0];
    p.appendChild(a);
  });
  return p;
}

// Un créneau vide : les séances de la classe à placer, dans un sélecteur.
function placer(c, d){
  var z = document.createElement("span");
  z.className = "av-placer";
  var a = (d.a_placer || []).filter(function(s){ return String(s.classe_id) === String(c.classe_id); });
  if (!a.length) {
    var r = document.createElement("span");
    r.className = "av-m";
    r.textContent = "aucune séance à placer";
    z.appendChild(r);
    return z;
  }
  var sel = document.createElement("select");
  sel.setAttribute("aria-label", "Séance à placer le " + new Date(c.debut_le).toLocaleDateString("fr-FR",
    { weekday: "long", day: "numeric" }) + " à " + heureDe(c.debut_le) + " — " + c.nom);
  var o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "Y placer une séance…";
  sel.appendChild(o0);
  a.forEach(function(s){
    var o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.numero + " — " + s.titre + (s.etat === "brouillon" ? " (à régler)" : "");
    sel.appendChild(o);
  });
  sel.addEventListener("change", function(){
    if (!sel.value) return;
    sel.disabled = true;
    var s = a.filter(function(x){ return String(x.id) === sel.value; })[0];
    sb.rpc("planifier_seance", { p_seance_id: Number(sel.value), p_prevue_le: c.debut_le, p_fin_prevue: c.fin_le,
                                 p_auto_ouvrir: false, p_auto_clore: false }).then(function(r){
      sel.disabled = false;
      if (!r || r.error || !r.data || !r.data.ok) { erreur("err-avenir", texteRefus(r)); return; }
      toast("Séance " + s.numero + " placée " + new Date(c.debut_le).toLocaleDateString("fr-FR",
        { weekday: "long", day: "numeric", month: "long" }) + " à " + heureDe(c.debut_le) + ".");
      document.dispatchEvent(new Event("tdc-seance-changee"));
    });
  });
  z.appendChild(sel);
  return z;
}

function brancherAvenir(){
  if (!$("carte-avenir") || $("carte-avenir").dataset.branche) return;
  $("carte-avenir").dataset.branche = "oui";
  $("b-av-prec").addEventListener("click", function(){ if (decalage > 0) { decalage--; chargerAvenir(); } });
  $("b-av-suiv").addEventListener("click", function(){ decalage++; chargerAvenir(); });
  document.addEventListener("tdc-seance-changee", function(){ if (lu) chargerAvenir(); });
}
brancherAvenir();

export { chargerAvenir, lignesDe };
