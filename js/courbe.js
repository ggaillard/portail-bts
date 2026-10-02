// ── La courbe de l'heure ──────────────────────────────────────────────────
//
// Demandé par G le 02/10/2026. Les tuiles disent où en est la classe
// MAINTENANT ; rien ne disait comment elle y était arrivée. « La classe a
// décroché à partir de la 30e minute » ne se lisait nulle part.
//
// Deux graphiques empilés, jamais un graphique à deux axes :
//
//   · en haut, l'AVANCEMENT médian des présents (trait plein) et l'ATTENDU
//     (pointillés), tous deux en % de ce que la séance demande — un seul
//     axe, de 0 à 100 % ;
//   · en dessous, les ACTIFS : combien d'étudiants ont fait un geste dans
//     les cinq dernières minutes. C'est cette série qui montre un
//     décrochage — la médiane, elle, ne redescend jamais.
//
// Toucher (ou survoler) le graphique lit la minute sous le doigt dans la
// ligne au-dessus. Une phrase en tête dit ce qu'il faut en retenir ; un
// tableau replié donne les chiffres, cinq minutes par cinq minutes.
//
// Calculé en base (`courbe_seance()`), relu au plus toutes les trente
// secondes : le canal en direct rafraîchit « À aller voir » à chaque
// réponse, la courbe n'a pas besoin de cette cadence.

import { $, sb, suivi } from './socle.js';

var NS = "http://www.w3.org/2000/svg";
var dernier = 0, seanceLue = null, donnees = null;

function chargerCourbe(force){
  var bloc = $("bloc-courbe");
  if (!bloc) return Promise.resolve();
  if (!suivi.seanceId) { bloc.hidden = true; return Promise.resolve(); }
  var maintenant = Date.now();
  if (!force && seanceLue === suivi.seanceId && maintenant - dernier < 30000) {
    return Promise.resolve();
  }
  dernier = maintenant;
  seanceLue = suivi.seanceId;
  return sb.rpc("courbe_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    var d = r && !r.error && r.data;
    // Pas démarrée, rien à mesurer, ou fonction pas encore déployée : rien.
    if (!d || !d.ok || !(d.points || []).length) { bloc.hidden = true; donnees = null; return; }
    donnees = d;
    bloc.hidden = false;
    rendreCourbe(d);
  });
}

function pct(v){ return Math.round(v) + " %"; }

// La phrase à retenir. Trois constats, dans l'ordre où l'on agit :
// l'activité qui chute, l'écart à l'attendu, sinon « dans le rythme ».
function lectureCourbe(d){
  var p = d.points, der = p[p.length - 1];
  var pic = p.reduce(function(a, x){ return x.actifs > a.actifs ? x : a; }, p[0]);
  var phrases = [];
  if (pic.actifs >= 4 && der.m - pic.m >= 5 && der.actifs <= pic.actifs / 2) {
    // La minute où l'activité est passée sous la moitié du pic.
    var chute = p.filter(function(x){ return x.m > pic.m && x.actifs <= pic.actifs / 2; })[0];
    phrases.push({ ton: "att", texte: "L'activité est tombée de " + pic.actifs + " à " + der.actifs +
      " étudiant" + (der.actifs > 1 ? "s" : "") + " depuis la " + chute.m + "ᵉ minute." });
  }
  var ecart = der.avance - der.attendu;
  if (der.attendu >= 10 && ecart <= -15) {
    phrases.push({ ton: "att", texte: "Classe à " + pct(der.avance) + ", attendu " + pct(der.attendu) +
      " : " + Math.abs(Math.round(ecart)) + " points de retard." });
  } else if (der.attendu >= 10 && ecart >= 10) {
    phrases.push({ ton: "ok", texte: "Classe à " + pct(der.avance) + ", en avance sur l'attendu (" + pct(der.attendu) + ")." });
  } else if (!phrases.length) {
    phrases.push({ ton: "ok", texte: "Classe à " + pct(der.avance) + " de la séance, attendu " + pct(der.attendu) + "." });
  }
  return phrases;
}

function svgEl(nom, attrs, parent){
  var n = document.createElementNS(NS, nom);
  Object.keys(attrs || {}).forEach(function(k){ n.setAttribute(k, attrs[k]); });
  if (parent) parent.appendChild(n);
  return n;
}

function rendreCourbe(d){
  var p = d.points;
  var resume = $("cb-resume");
  resume.innerHTML = "";
  lectureCourbe(d).forEach(function(x){
    var s = document.createElement("span");
    s.className = "cb-phrase " + x.ton;
    s.textContent = x.texte;
    resume.appendChild(s);
  });

  // Géométrie : une unité du dessin = un pixel. La largeur est celle de la
  // carte au moment du rendu (entre 260 et 640 px) : avec une largeur fixe,
  // le texte du SVG se réduisait à 6 px sur un téléphone et montait à 20 px
  // au bureau. La marge gauche porte les graduations.
  var svg = $("cb-svg");
  var W = Math.round(Math.min(640, Math.max(260, svg.parentNode.getBoundingClientRect().width || 300)));
  var G = 34, D = 8, H1 = 120, H2 = 40, ESP = 18, H = H1 + ESP + H2 + 18;
  var mMax = Math.max(p[p.length - 1].m, 10);
  var x = function(m){ return G + (W - G - D) * m / mMax; };
  var y = function(v){ return 6 + (H1 - 6) * (1 - Math.min(100, v) / 100); };
  var aMax = Math.max(4, p.reduce(function(a, q){ return Math.max(a, q.actifs); }, 0));
  var yb = function(n){ return H1 + ESP + H2 * (1 - n / aMax); };

  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);

  // Grille discrète : 0, 50, 100 %.
  [0, 50, 100].forEach(function(v){
    svgEl("line", { x1: G, x2: W - D, y1: y(v), y2: y(v), class: "cb-grille" }, svg);
    var t = svgEl("text", { x: G - 5, y: y(v) + 4, class: "cb-axe", "text-anchor": "end" }, svg);
    t.textContent = v + "%";
  });
  // Les minutes, toutes les 10 (15 au-delà d'une heure).
  var pas = mMax > 60 ? 15 : 10;
  for (var m = 0; m <= mMax; m += pas) {
    var tm = svgEl("text", { x: x(m), y: H - 2, class: "cb-axe", "text-anchor": "middle" }, svg);
    tm.textContent = m + "′";
  }

  var trace = function(cle){
    return p.map(function(q, i){ return (i ? "L" : "M") + x(q.m).toFixed(1) + " " + y(q[cle]).toFixed(1); }).join(" ");
  };
  svgEl("path", { d: trace("attendu"), class: "cb-attendu" }, svg);
  svgEl("path", { d: trace("avance"), class: "cb-avance" }, svg);

  // Étiquettes directes au bout des deux traits (deux séries : légende ET
  // étiquette, l'identité ne repose jamais sur la seule couleur).
  var der = p[p.length - 1];
  var ya = Math.max(18, y(der.avance)), yt = Math.max(18, y(der.attendu));

  // Les actifs : des barres fines, posées sur leur ligne de base.
  svgEl("line", { x1: G, x2: W - D, y1: H1 + ESP + H2, y2: H1 + ESP + H2, class: "cb-grille" }, svg);
  var tA = svgEl("text", { x: G - 5, y: H1 + ESP + 10, class: "cb-axe", "text-anchor": "end" }, svg);
  tA.textContent = aMax;
  var lb = Math.max(1, (W - G - D) / (mMax + 1) - 0.6);
  p.forEach(function(q){
    if (!q.actifs) return;
    svgEl("rect", { x: (x(q.m) - lb / 2).toFixed(1), y: yb(q.actifs).toFixed(1),
                 width: lb.toFixed(1), height: (H1 + ESP + H2 - yb(q.actifs)).toFixed(1),
                 rx: Math.min(1.5, lb / 2), class: "cb-actifs" }, svg);
  });

  // Le curseur : une ligne verticale et un point, déplacés au toucher.
  var curseur = svgEl("line", { x1: 0, x2: 0, y1: 4, y2: H1 + ESP + H2, class: "cb-curseur" }, svg);
  var point = svgEl("circle", { r: 4, cx: 0, cy: 0, class: "cb-point" }, svg);
  var lire = function(q){
    curseur.setAttribute("x1", x(q.m)); curseur.setAttribute("x2", x(q.m));
    point.setAttribute("cx", x(q.m)); point.setAttribute("cy", y(q.avance));
    $("cb-lu").textContent = q.m + "ᵉ min · classe " + pct(q.avance) + " · attendu " +
      pct(q.attendu) + " · " + q.actifs + " actif" + (q.actifs > 1 ? "s" : "") + " sur 5 min";
  };
  lire(der);
  var suivre = function(ev){
    var r = svg.getBoundingClientRect();
    if (!r.width) return;
    var ux = (ev.clientX - r.left) / r.width * W;
    var mm = Math.round((ux - G) / (W - G - D) * mMax);
    mm = Math.max(p[0].m, Math.min(der.m, mm));
    var q = p.filter(function(z){ return z.m === mm; })[0] || der;
    lire(q);
  };
  svg.onpointermove = suivre;
  svg.onpointerdown = suivre;
  svg.onpointerleave = function(){ lire(der); };

  // Les étiquettes directes, posées au-dessus du bout de chaque trait.
  var ea = svgEl("text", { x: x(der.m) - 3, y: ya - 5, class: "cb-et cb-et-avance", "text-anchor": "end" }, svg);
  ea.textContent = "classe";
  var et = svgEl("text", { x: x(der.m) - 3, y: Math.abs(yt - ya) < 14 ? ya + 15 : yt - 5, class: "cb-et", "text-anchor": "end" }, svg);
  et.textContent = "attendu";

  // Les chiffres, pour qui ne lit pas un graphique (et pour vérifier).
  var t = $("cb-table");
  t.innerHTML = "<thead><tr><th scope='col'>Minute</th><th scope='col'>Classe</th>" +
                "<th scope='col'>Attendu</th><th scope='col'>Actifs (5 min)</th></tr></thead>";
  var tb = document.createElement("tbody");
  p.filter(function(q){ return q.m % 5 === 0 || q === der; }).forEach(function(q){
    var tr = document.createElement("tr");
    [q.m + "′", pct(q.avance), pct(q.attendu), String(q.actifs)].forEach(function(v){
      var td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
}

export { chargerCourbe, rendreCourbe, lectureCourbe };
