// ── « Où en est chacun » : la carte du parcours, pendant l'heure ──────────
//
// 19/10/2026. Depuis le parcours guidé, une séance de cours est une suite
// d'étapes — dix questions posées dans les actes, un point de passage à la
// fin de chacun. « À aller voir » dit qui aider ; le parcours de l'heure dit
// combien ont passé chaque grande étape. Il manquait la lecture qu'on fait
// d'un coup d'œil, debout, entre deux rangs : une ligne par étudiant, une
// case par étape, et l'endroit où chacun EST en ce moment.
//
//   · `carte_parcours()` (20261019090000) calcule tout en base : l'ordre des
//     étapes (etapes_seance, écrit par le générateur de la séance), l'état de
//     chaque case, l'étape où chacun est et depuis combien de minutes, et le
//     BOUCHON — trois présents au moins, et le quart d'entre eux, arrêtés sur
//     la même étape. Le portail ne recompte rien.
//   · Les plus en arrière en premier, puis ceux qui y sont depuis le plus
//     longtemps : l'ordre dans lequel on va les voir. Les absents ne font
//     pas une ligne chacun : une seule ligne les nomme, à la fin.
//   · Nominatif, donc jamais projeté — même règle qu'« À aller voir ».
//   · Une séance de projet, ou une séance sans étapes : la carte se masque.

import { $, sb, suivi, nomDe, prenomSeul } from './socle.js';
import { ouvrirFiche } from './fiche.js';

// Ce que montre une case, et ce que lit un lecteur d'écran.
var CASE = {
  J: ["✓", "juste", "ca-j"],
  F: ["✗", "faux", "ca-f"],
  X: ["✓", "fait", "ca-x"],
  ".": ["", "pas encore", "ca-v"]
};
// Au-delà de cinq minutes sur la même étape, la case en cours change de ton.
var LONG_MIN = 5;

function chargerCarte(){
  var bloc = $("bloc-carte");
  if (!bloc) return Promise.resolve();
  if (!suivi.seanceId) { bloc.hidden = true; return Promise.resolve(); }
  var id = Number(suivi.seanceId);
  return sb.rpc("carte_parcours", { p_seance_id: id }).then(function(r){
    var d = r && !r.error && r.data;
    // Fonction absente, projet, séance sans étapes : on masque, sans
    // message d'erreur en pleine séance.
    if (!d || !d.ok || String(suivi.seanceId) !== String(id)) { bloc.hidden = true; return; }
    bloc.hidden = false;
    rendreCarte(d);
  }, function(){ bloc.hidden = true; });
}

function rendreCarte(d){
  var etapes = d.etapes || [];
  var presents = (d.eleves || []).filter(function(x){ return x.present; });
  var absents = (d.eleves || []).filter(function(x){ return !x.present; });

  $("ca-compte").textContent = d.presents ? d.finis + "/" + d.presents + " finis" : "";

  // Le bouchon, en une phrase : c'est ce qu'on lit avant la grille.
  var b = $("ca-bouchon");
  if (d.bouchon) {
    var x = d.bouchon;
    b.textContent = "⚠ " + x.ici + " étudiants sont sur " + caLieu(x) +
      (x.ici_5min ? " — " + x.ici_5min + " depuis plus de " + LONG_MIN + " min" : "") +
      ". Un endroit qui coince pour plusieurs : à reprendre pour tous, à voix haute.";
    b.hidden = false;
  } else {
    b.hidden = true;
  }

  var t = $("ca-grille");
  t.innerHTML = "";
  var cap = document.createElement("caption");
  cap.className = "vh";
  cap.textContent = "Une ligne par étudiant présent, une colonne par étape de la séance, dans l'ordre de la page.";
  t.appendChild(cap);

  var thead = document.createElement("thead");
  var tr = document.createElement("tr");
  var th0 = document.createElement("th");
  th0.scope = "col";
  th0.textContent = "N°";
  tr.appendChild(th0);
  etapes.forEach(function(e){
    var th = document.createElement("th");
    th.scope = "col";
    th.className = e.type === "passage" ? "ca-acte" : "";
    // « III » plutôt que « Acte III » : la colonne fait 18 px.
    th.textContent = e.type === "passage" ? e.libelle.replace(/^Acte /, "") : e.libelle.replace(/^Q/, "");
    th.title = caTitreEtape(e);
    if (e.ici) {
      var n = document.createElement("span");
      n.className = "ca-ici-n" + (d.bouchon && d.bouchon.rang === e.rang ? " bouchon" : "");
      n.textContent = e.ici;
      n.setAttribute("aria-label", e.ici + " en ce moment");
      th.appendChild(n);
    }
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  t.appendChild(thead);

  var tbody = document.createElement("tbody");
  presents.forEach(function(x){ tbody.appendChild(caLigne(d, x, etapes)); });
  t.appendChild(tbody);

  var a = $("ca-absents");
  a.textContent = absents.length
    ? "Pas encore là : " + absents.map(function(x){ return caNommer(d.code, x.numero); }).join(", ")
    : "";
  a.hidden = !absents.length;
}

function caLigne(d, x, etapes){
  var tr = document.createElement("tr");
  tr.className = "ca-l" + (x.ici === null || x.ici === undefined ? " fini" : "") +
                 (x.depuis >= LONG_MIN ? " long" : "") + (x.main ? " main" : "");
  var th = document.createElement("th");
  th.scope = "row";
  var bt = document.createElement("button");
  bt.type = "button";
  bt.className = "ca-num";
  bt.textContent = caNommer(d.code, x.numero);
  bt.setAttribute("aria-label", "Élève " + x.numero + " : " + caResumeLigne(x) + ". Ouvrir sa fiche.");
  bt.addEventListener("click", function(){
    ouvrirFiche({ id: x.eleve_id, numero: x.numero, classeId: suivi.classeId });
  });
  th.appendChild(bt);
  tr.appendChild(th);

  var cases = String(x.cases || "");
  etapes.forEach(function(e, i){
    var td = document.createElement("td");
    var code = cases.charAt(i) || ".";
    var c = CASE[code] || CASE["."];
    if (code === "." && x.ici === e.rang) {
      // L'étape où il EST : un rond, et les minutes dès qu'elles comptent.
      td.className = "ca-ici" + (x.depuis >= LONG_MIN ? " long" : "");
      td.textContent = x.depuis >= 2 ? x.depuis + "′" : "●";
      td.title = e.libelle + " — en cours" + (x.depuis !== null && x.depuis !== undefined ? " depuis " + x.depuis + " min" : "");
    } else {
      td.className = c[2];
      td.textContent = c[0];
      td.title = e.libelle + " — " + c[1];
    }
    tr.appendChild(td);
  });
  return tr;
}

function caResumeLigne(x){
  if (x.ici === null || x.ici === undefined) return "parcours terminé";
  return "sur " + (x.ici_cle ? caLibelleCle(x.ici_cle) : "l'étape " + x.ici) +
    (x.depuis ? " depuis " + x.depuis + " min" : "") +
    (x.sorties ? ", a quitté la page " + x.sorties + " fois" : "") +
    (x.main ? ", main levée" : "");
}

function caLibelleCle(cle){
  var m = /^acte-(\d+)$/.exec(cle);
  if (m) return "le point de passage de l'acte " + ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][Number(m[1])];
  return "la question " + String(cle).replace(/^q/, "");
}

function caLieu(e){ return caLibelleCle(e.cle); }

function caTitreEtape(e){
  var t = e.libelle + (e.intitule ? " — " + e.intitule : "");
  t += "\n" + e.passes + " l'ont passée" + (e.type === "question" || e.justes || e.faux
    ? " · " + e.justes + " juste" + (e.justes > 1 ? "s" : "") + ", " + e.faux + " faux" : "");
  if (e.ici) t += " · " + e.ici + " dessus en ce moment";
  if (e.sorties) t += " · " + e.sorties + " ont quitté la page ici";
  return t;
}

function caNommer(code, numero){
  var nom = nomDe(code, numero);
  return nom ? numero + " " + prenomSeul(nom) : String(numero);
}

export { chargerCarte, rendreCarte };
