// ── L'état d'une séance, en un mot, et ses étapes ─────────────────────────
//
// Lot 2 des propositions du 05/10 (06/10). Jusque-là, chaque écran lisait six
// colonnes — publiee, ouverte, demarree_le, nature… — et en tirait son propre
// mot : « Projet fermé » dans l'en-tête, « fermée, cachée » dans la recherche,
// « visible · fermée » dans Préparer. Le mot vient maintenant de la base,
// `etat_seance()`, calculée à un seul endroit (migration 20261006060000) :
//
//   cours   brouillon → prete → programmee → en_cours → terminee
//           (ouverte : acceptée sans chrono · oubliee : bien au-delà de sa durée)
//   projet  brouillon → prete → programmee → ouvert (ou cache) → clos
//
// Ce module ne recalcule pas l'état : il le TRADUIT — un libellé, une couleur
// (la grammaire de pilote.css : vert fait, orange à surveiller, bleu en cours,
// gris pas posé), et la place dans les quatre étapes. Deux exceptions, et
// elles sont écrites ici pour qu'on ne les prenne pas pour une seconde source :
//
//   · LE TEMPS PASSE ENTRE DEUX LECTURES. Une séance lue « en cours » devient
//     « oubliée ouverte » à durée + 2 h sans que la base soit relue ; le
//     même calcul que la base (seanceOubliee) le rattrape à l'écran.
//   · LA MIGRATION PEUT NE PAS ÊTRE LÀ. Sans `etat`, on retombe sur la lecture
//     d'avant (« Pas démarrée », « Projet fermé »…) et l'indicateur d'étapes
//     se tait : il ne sait pas dire si une séance est prête.

import { seanceOubliee } from './ouverture.js';

// code → [ton du badge, libellé, étapes franchies]
var ETATS = {
  brouillon:  ["neutre",  "Brouillon",             0],
  prete:      ["ok",      "Prête",                 1],
  programmee: ["encours", "Programmée",            2],
  ouverte:    ["att",     "Ouverte, pas démarrée", 3],
  en_cours:   ["ok",      "En cours",              3],
  oubliee:    ["att",     "Oubliée ouverte",       3],
  terminee:   ["neutre",  "Terminée",              4],
  ouvert:     ["ok",      "Projet ouvert",         3],
  cache:      ["att",     "Ouvert, caché",         3],
  clos:       ["neutre",  "Projet clos",           4],
  propose:    ["ok",      "Proposé",               3],
  eteint:     ["neutre",  "Éteint",                0],
  appel:      ["ok",      "Appel",                 3],
  // La lecture d'avant, quand la base ne dit pas l'état.
  a_venir:    ["neutre",  "Pas démarrée",          1],
  ferme:      ["neutre",  "Projet fermé",          1]
};

var ETAPES_COURS  = ["Préparée", "Programmée", "En cours", "Terminée"];
var ETAPES_PROJET = ["Préparé", "Programmé", "Ouvert", "Clos"];

// La lecture d'avant le lot 2 — celle de pilote.js jusqu'au 05/10.
function etatLocal(s){
  var numero = Number(s.numero !== undefined && s.numero !== null ? s.numero : s.seance);
  if (numero === 99) return "appel";
  if (numero >= 90) return s.ouverte ? "propose" : "eteint";
  if (s.nature === "projet") return !s.ouverte ? "ferme" : (s.publiee === false ? "cache" : "ouvert");
  if (seanceOubliee(s)) return "oubliee";
  if (s.ouverte && s.demarree_le) return "en_cours";
  if (s.ouverte) return "ouverte";
  if (s.demarree_le) return "terminee";
  return "a_venir";
}

// `s` : une ligne de séance (seances_de_classe, aujourdhui, la table) ou le
// pré-vol enrichi par chargerPrevol(). Rend { code, ton, libelle, etape, base }.
function etatDe(s){
  if (!s) return { code: "", ton: "neutre", libelle: "—", etape: 0, base: false };
  var base = !!(s.etat && ETATS[s.etat]);
  var code = base ? s.etat : etatLocal(s);
  if (code === "en_cours" && seanceOubliee(s)) code = "oubliee";
  if (code === "programmee" && s.fin_prevue && Date.parse(s.fin_prevue) < Date.now()) code = "prete";
  var e = ETATS[code];
  return { code: code, ton: e[0], libelle: e[1], etape: e[2], base: base };
}

// « aujourd'hui 15:00–17:00 », « demain 08:30 », « lun. 12 oct. 15:00–17:00 ».
function heureDe(iso){
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function jourDe(iso, maintenant){
  var d = new Date(iso), m = new Date(maintenant || Date.now());
  var j0 = new Date(m.getFullYear(), m.getMonth(), m.getDate()).getTime();
  var j  = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  var ecart = Math.round((j - j0) / 86400000);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart === -1) return "hier";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function quandLisible(debut, fin, maintenant){
  if (!debut) return "";
  return jourDe(debut, maintenant) + " " + heureDe(debut) + (fin ? "–" + heureDe(fin) : "");
}

// Les quatre étapes, dans une liste ordonnée : franchies (✓), l'étape où l'on
// est (aria-current), à venir. « Programmée » est SAUTÉE quand une séance a
// commencé sans avoir été programmée — elle ne l'a pas été, on ne le prétend
// pas. Rien quand la base ne dit pas l'état.
function rendreEtapes(ol, s){
  if (!ol) return;
  var e = etatDe(s);
  ol.innerHTML = "";
  var numero = Number(s && (s.numero !== undefined && s.numero !== null ? s.numero : s.seance));
  ol.hidden = !s || !e.base || numero >= 90;
  if (ol.hidden) return;
  var noms = s.nature === "projet" ? ETAPES_PROJET : ETAPES_COURS;
  noms.forEach(function(nom, i){
    var li = document.createElement("li");
    var franchie = i < e.etape;
    var sautee = i === 1 && franchie && !s.prevue_le;
    var ici = e.etape === 0 ? i === 0 : i === e.etape - 1;
    li.className = "cycle-e" + (sautee ? " sautee" : (franchie ? " faite" : "")) + (ici ? " ici" : "");
    if (ici) li.setAttribute("aria-current", "step");
    var m = document.createElement("span");
    m.className = "cycle-m";
    m.setAttribute("aria-hidden", "true");
    m.textContent = sautee ? "–" : (franchie ? "✓" : String(i + 1));
    li.appendChild(m);
    li.appendChild(document.createTextNode(nom));
    // Pour un lecteur d'écran, la marque ne dit rien : on dit l'état en mots.
    var vh = document.createElement("span");
    vh.className = "vh";
    vh.textContent = sautee ? " (sans programmation)" : (franchie ? " (fait)" : (ici ? " (à faire)" : ""));
    if (vh.textContent) li.appendChild(vh);
    ol.appendChild(li);
  });
}

// Lire des séances avec leur planning et leur état — et, si la migration du
// 06/10 n'est pas encore passée, sans eux plutôt que rien. `requete(colonnes)`
// rend la promesse d'une lecture sb.from("seances").
var COLONNES_PLANNING = "prevue_le,fin_prevue,auto_ouvrir,auto_clore,etat:etat_seance";
function lireAvecPlanning(base, requete){
  return requete(base + "," + COLONNES_PLANNING).then(function(r){
    return r && r.error ? requete(base) : r;
  });
}

export { ETATS, etatDe, etatLocal, rendreEtapes, quandLisible, heureDe, jourDe, lireAvecPlanning };
