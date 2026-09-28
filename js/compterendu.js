// ── Le compte rendu d'une séance ──────────────────────────────────────────
//
// Lot « après la séance » (28/09). Dans la vue « Fin d'heure », sous le
// débriefing : ce qu'on recopie dans le cahier de textes et ce qu'on garde
// pour la suite — qui était là, ce qui est acquis, ce qui est à reprendre,
// qui revoir. « Clore » y amène d'office.
//
// Rien de nouveau en base : il assemble ce que l'écran de la séance a déjà
// lu (suivi.prevol, suivi.stats, suivi.parcours, suivi.debrief). Deux sorties,
// les deux habituelles : « Copier » (un texte à coller) et « CSV » (une ligne
// par élève). Les prénoms viennent de la table locale et ne quittent pas
// l'appareil.

import { $, suivi, nomDe, prenomSeul, codeClasseCourante, copierTexte } from './socle.js';
import { telechargerCsv } from './exporter.js';

function nomCourt(numero){
  var n = nomDe(codeClasseCourante(), numero);
  return n ? numero + " " + prenomSeul(n) : numero;
}

// Les faits, une fois : le texte, l'écran et le CSV en sont trois lectures.
function faits(){
  var p = suivi.prevol, s = suivi.stats, pa = suivi.parcours, d = suivi.debrief;
  if (!s || !p) return null;
  var titre = (($("pk-seance") || {}).selectedOptions || [])[0];
  var f = {
    titre: titre ? (titre.dataset.titre || titre.textContent) : "",
    date: p.demarree_le ? new Date(p.demarree_le).toLocaleDateString("fr-FR",
            { weekday: "long", day: "numeric", month: "long" }) : "pas démarrée",
    inscrits: s.inscrits, actifs: s.actifs,
    reussite: s.reussite, avancement: s.avancement, projet: p.nature === "projet",
    absents: [], presents: null, aRevoir: [], fragiles: [], acquis: [], eleves: []
  };
  if (pa && pa.eleves) {
    f.absents = pa.eleves.filter(function(e){ return !e.appel; }).map(function(e){ return e.numero; });
    f.presents = pa.eleves.length - f.absents.length;
  }
  (d && d.concepts || []).forEach(function(c){
    var t = c.rang + ". " + c.intitule + (c.taux !== null && c.taux !== undefined ? " (" + c.taux + " %)" : "");
    if (c.verdict === "a_revoir") f.aRevoir.push(t);
    else if (c.verdict === "fragile") f.fragiles.push(t);
    else if (c.verdict === "acquis") f.acquis.push(t);
  });
  // À revoir : rien fait, ou moins de 40 % de réussite. Les absents sont à
  // part — on ne « revoit » pas quelqu'un qui n'était pas là, on le rattrape.
  (s.lignes || []).forEach(function(l){
    var absent = f.absents.indexOf(l.numero) >= 0;
    var motif = absent ? "absent" : (l.n === 0 ? "rien fait" : (l.reussite !== null && l.reussite < 40 ? l.reussite + " % de réussite" : ""));
    f.eleves.push({ numero: l.numero, n: l.n, pct: l.pct, reussite: l.reussite, absent: absent, motif: motif });
  });
  return f;
}

function texte(f){
  var l = [];
  l.push("Séance " + f.titre + " — " + f.date);
  if (f.presents !== null) l.push("Présents : " + f.presents + "/" + f.inscrits +
    (f.absents.length ? " — absents : " + f.absents.map(nomCourt).join(", ") : ""));
  l.push((f.projet ? "Avancement moyen : " + f.avancement + " %" :
          "Réussite : " + (f.reussite === null ? "—" : f.reussite + " %") + " · avancement " + f.avancement + " %") +
         " · " + f.actifs + "/" + f.inscrits + " actifs");
  if (f.acquis.length) l.push("Acquis : " + f.acquis.join(" ; "));
  if (f.fragiles.length) l.push("Fragiles : " + f.fragiles.join(" ; "));
  if (f.aRevoir.length) l.push("À reprendre : " + f.aRevoir.join(" ; "));
  var revoir = f.eleves.filter(function(e){ return e.motif && !e.absent; });
  if (revoir.length) l.push("À revoir : " + revoir.map(function(e){ return nomCourt(e.numero) + " (" + e.motif + ")"; }).join(", "));
  return l.join("\n");
}

function rendreCompteRendu(){
  var z = $("cr-corps");
  if (!z) return;
  var f = faits();
  $("bloc-cr").hidden = !f;
  if (!f) return;
  z.innerHTML = "";
  var pre = document.createElement("pre");
  pre.className = "cr-texte";
  pre.textContent = texte(f);
  z.appendChild(pre);
}

function brancherCompteRendu(){
  if (!$("bloc-cr") || $("bloc-cr").dataset.branche) return;
  $("bloc-cr").dataset.branche = "oui";
  $("b-cr-copier").addEventListener("click", function(){
    var f = faits();
    if (f) copierTexte(texte(f), $("b-cr-copier"));
  });
  $("b-cr-csv").addEventListener("click", function(){
    var f = faits();
    if (!f) return;
    var l = [["Numéro", "Prénom (local)", "Présent", "Réponses", "Avancement %", "Réussite %", "À revoir"]];
    f.eleves.forEach(function(e){
      var n = nomDe(codeClasseCourante(), e.numero);
      l.push([e.numero, n ? prenomSeul(n) : "", e.absent ? "non" : "oui", e.n, e.pct,
              e.reussite === null ? "" : e.reussite, e.motif]);
    });
    telechargerCsv("compte-rendu-" + (f.titre || "seance") + ".csv", l);
  });
}
brancherCompteRendu();

export { rendreCompteRendu, faits, texte };
