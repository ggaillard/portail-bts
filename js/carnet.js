// ── Le carnet d'une classe : élèves × séances ─────────────────────────────
//
// Lot « après la séance » (28/09), dans Bilan. Le motif du carnet de notes
// (Pronote, Moodle) : une ligne par élève, une colonne par séance jouée,
// chaque case colorée — on repère d'un coup d'œil le décrochage sur plusieurs
// séances, que la séance du jour ne montre jamais.
//
//   · deux lectures d'un bouton : AVANCEMENT (ce qu'il a fait) ou RÉUSSITE
//     (ce qu'il a réussi) ; un projet se lit toujours en jalons ;
//   · une case vide n'est pas un zéro : « — » quand rien n'a été fait, et gris ;
//   · « décroche » quand les deux dernières séances jouées sont vides ;
//   · un clic sur un élève ouvre sa fiche (fiche.js) ;
//   · « Exporter (CSV) » pour le tableur ou l'ENT.
//
// Tout vient de `carnet_classe()`, calculé en base : une classe entière,
// c'est plus de lignes de réponses qu'une lecture REST n'en rend d'un coup.

import { $, sb, suivi, typo, nomDe, prenomSeul, classesReelles } from './socle.js';
import { ouvrirFiche } from './fiche.js';
import { telechargerCsv } from './exporter.js';

var donnees = null, classe = null, mode = "avancement";

function valeur(s, c){
  if (!c || !c.n && !c.jal) return null;
  if (s.nature === "projet") return s.jalons ? Math.min(100, Math.round(c.jal / s.jalons * 100)) : null;
  if (mode === "reussite") return c.ev ? Math.round(c.ok / c.ev * 100) : null;
  return s.questions ? Math.min(100, Math.round(c.n / s.questions * 100)) : null;
}

function ton(v){ return v === null ? "rien" : (v >= 70 ? "ok" : (v >= 40 ? "att" : "ko")); }

function decroche(e){
  var jouees = (donnees.seances || []).slice(-2);
  return jouees.length === 2 && jouees.every(function(s){
    var c = e.cases[s.id]; return !c || (!c.n && !c.jal);
  });
}

function chargerCarnet(classes){
  var carte = $("carte-carnet");
  if (!carte) return Promise.resolve();
  var reelles = classesReelles(classes || []);
  var sel = $("cn-classe");
  if (!sel.options.length) {
    reelles.forEach(function(c){
      var o = document.createElement("option");
      o.value = c.id; o.textContent = c.nom; o.dataset.code = c.code;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function(){ lire(sel.value); });
    [].forEach.call(document.querySelectorAll("#cn-mode .filtre"), function(b){
      b.addEventListener("click", function(){
        mode = b.dataset.mode;
        [].forEach.call(document.querySelectorAll("#cn-mode .filtre"), function(x){
          x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        rendreCarnet();
      });
    });
    $("b-cn-csv").addEventListener("click", exporter);
    var ouvrir = function(e){
      var tr = e.target.closest && e.target.closest("tr[data-id]");
      if (!tr || (e.type === "keydown" && e.key !== "Enter")) return;
      ouvrirFiche({ id: tr.dataset.id, numero: tr.dataset.num, classeId: classe });
    };
    $("cn-table").addEventListener("click", ouvrir);
    $("cn-table").addEventListener("keydown", ouvrir);
  }
  if (!sel.value) return Promise.resolve();
  return lire(sel.value);
}

function lire(classeId){
  classe = classeId;
  return sb.rpc("carnet_classe", { p_classe_id: Number(classeId) }).then(function(r){
    var carte = $("carte-carnet");
    // Fonction pas déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) { carte.hidden = true; return; }
    carte.hidden = false;
    donnees = r.data;
    rendreCarnet();
  });
}

function codeClasse(){
  var o = $("cn-classe").selectedOptions[0];
  return o ? o.dataset.code : "";
}

function rendreCarnet(){
  var t = $("cn-table");
  if (!t || !donnees) return;
  var seances = donnees.seances || [], eleves = donnees.eleves || [];
  t.innerHTML = "";
  if (!seances.length) {
    $("cn-resume").textContent = "Aucune séance jouée dans cette classe pour l'instant.";
    return;
  }
  var th = document.createElement("thead"), tr = document.createElement("tr");
  tr.innerHTML = '<th scope="col">N°</th><th scope="col">Présence</th>';
  var mod = null;
  seances.forEach(function(s){
    var c = document.createElement("th");
    c.scope = "col";
    c.textContent = s.numero;
    c.title = typo(s.titre) + (s.nature === "projet" ? " (projet, en jalons)" : "");
    if (mod !== null && s.module_id !== mod) c.className = "cn-sep";
    mod = s.module_id;
    tr.appendChild(c);
  });
  th.appendChild(tr); t.appendChild(th);
  var tb = document.createElement("tbody");
  var nDecroche = 0;
  eleves.forEach(function(e){
    var r = document.createElement("tr");
    r.dataset.id = e.id; r.dataset.num = e.numero;
    r.tabIndex = 0;
    var nom = nomDe(codeClasse(), e.numero);
    var dec = decroche(e);
    if (dec) nDecroche++;
    var tdN = document.createElement("th");
    tdN.scope = "row";
    tdN.className = "cn-el";
    tdN.textContent = e.numero + (nom ? " " + prenomSeul(nom) : "");
    if (dec) {
      var b = document.createElement("span");
      b.className = "badge ko cn-dec";
      b.textContent = "décroche";
      tdN.appendChild(b);
    }
    r.appendChild(tdN);
    var tdP = document.createElement("td");
    tdP.className = "cn-pres";
    tdP.textContent = donnees.appels ? e.presents + "/" + donnees.appels : "—";
    if (donnees.appels && donnees.appels - e.presents >= 2) tdP.classList.add("att");
    r.appendChild(tdP);
    var modC = null;
    seances.forEach(function(s){
      var v = valeur(s, e.cases[s.id]);
      var td = document.createElement("td");
      td.className = "cn-c " + ton(v) + (modC !== null && s.module_id !== modC ? " cn-sep" : "");
      modC = s.module_id;
      td.textContent = v === null ? "—" : v;
      td.title = "Séance " + s.numero + " — " + (v === null ? "rien fait" : v + " %");
      r.appendChild(td);
    });
    tb.appendChild(r);
  });
  t.appendChild(tb);
  $("cn-resume").textContent = eleves.length + " élèves · " + seances.length + " séances jouées · " +
    (mode === "reussite" ? "réussite en %" : "avancement en %") + " (un projet se lit en jalons)" +
    (nDecroche ? " · " + nDecroche + (nDecroche > 1 ? " élèves décrochent" : " élève décroche") +
     " : rien sur les deux dernières séances" : "");
}

function exporter(){
  if (!donnees) return;
  var seances = donnees.seances || [];
  var l = [["Numéro", "Prénom (local)", "Présence"].concat(seances.map(function(s){
    return "S" + s.numero + " " + s.titre + " (" + (s.nature === "projet" ? "jalons %" : (mode === "reussite" ? "réussite %" : "avancement %")) + ")";
  }))];
  (donnees.eleves || []).forEach(function(e){
    var n = nomDe(codeClasse(), e.numero);
    l.push([e.numero, n ? prenomSeul(n) : "", donnees.appels ? e.presents + "/" + donnees.appels : ""]
      .concat(seances.map(function(s){ var v = valeur(s, e.cases[s.id]); return v === null ? "" : v; })));
  });
  telechargerCsv("carnet-" + codeClasse() + "-" + mode + ".csv", l);
}

export { chargerCarnet, rendreCarnet, valeur, decroche };
