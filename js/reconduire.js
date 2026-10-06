// ── Reconduire une classe pour l'année suivante ───────────────────────────
//
// Lot 3 des propositions du 05/10 (06/10). En juin, avant purger_annee() :
// une classe neuve (BTS1-DEV-2027) avec les modules et les séances de celle
// de cette année — corrigés, concepts, missions, points de passage, séance
// d'appel — sans élève, sans réponse, toutes fermées et cachées.
// reconduire_classe() écrit seulement au second geste : le premier montre
// ce qui serait recréé, et le bouton qui écrit n'apparaît qu'après, pour ces
// valeurs-là. Changer un champ le retire.
//
// Ce que la reconduction ne fait pas : les comptes des étudiants (numéros
// et codes se créent hors du portail, la base ne porte aucun nom), l'emploi
// du temps, les équipes, les questionnaires donnés. La carte le dit.

import { $, sb, erreur } from './socle.js';
import { texteRefus } from './refus.js';
import { toast } from './toast.js';

var vu = null;     // les valeurs de l'aperçu affiché

function valeurs(){
  return { classe: $("rn-classe").value, code: $("rn-code").value.trim().toUpperCase(), nom: $("rn-nom").value.trim() };
}

function remplir(){
  var src = $("gs-classe"), sel = $("rn-classe");
  if (!src || !sel || sel.options.length) return;
  sel.innerHTML = src.innerHTML;
  sel.addEventListener("change", proposer);
  proposer();
}

// Le code de l'an prochain : le millésime du code, plus un.
function proposer(){
  var o = $("rn-classe").selectedOptions[0];
  if (!o) return;
  var code = (o.dataset.code || "").replace(/(\d{4})(?!.*\d)/, function(a){ return String(Number(a) + 1); });
  $("rn-code").value = code;
  $("rn-nom").value = o.textContent;
  oublier();
}

function oublier(){
  vu = null;
  $("b-rn-ok").hidden = true;
  $("rn-apercu").textContent = "";
}

function apercu(){
  var v = valeurs();
  erreur("err-rn", "");
  return sb.rpc("reconduire_classe", { p_classe_id: Number(v.classe), p_code: v.code, p_nom: v.nom || null,
                                       p_ecrire: false }).then(function(r){
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) { erreur("err-rn", texteRefus(r)); oublier(); return; }
    var c = d.compte;
    $("rn-apercu").textContent = "« " + d.nom + " » (" + d.code + ", " + d.annee + ") recevrait " +
      c.modules + " module(s), " + c.seances + " séance(s), " + c.corriges + " corrigé(s), " + c.concepts +
      " concept(s), " + c.missions + " mission(s) et " + c.passages + " point(s) de passage. Aucun élève, aucune réponse.";
    vu = JSON.stringify(v);
    $("b-rn-ok").hidden = false;
  });
}

function reconduire(){
  var v = valeurs(), b = $("b-rn-ok");
  if (JSON.stringify(v) !== vu) { oublier(); return Promise.resolve(); }
  b.disabled = true;
  return sb.rpc("reconduire_classe", { p_classe_id: Number(v.classe), p_code: v.code, p_nom: v.nom || null,
                                       p_ecrire: true }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) { erreur("err-rn", texteRefus(r)); return; }
    oublier();
    toast("Classe " + d.code + " créée.");
    erreur("err-rn", "Classe " + d.code + " créée, avec " + d.compte.seances + " séance(s) fermées et cachées. " +
      "Restent hors du portail : les comptes des étudiants. Puis, ici : son emploi du temps. " +
      "Rechargez la page pour la voir dans les listes.", true);
  });
}

function brancherReconduire(){
  var z = $("rn-bloc");
  if (!z || z.dataset.branche) return;
  z.dataset.branche = "oui";
  z.addEventListener("toggle", function(){ if (z.open) remplir(); });
  ["rn-code", "rn-nom"].forEach(function(id){ $(id).addEventListener("input", oublier); });
  $("b-rn-voir").addEventListener("click", apercu);
  $("b-rn-ok").addEventListener("click", reconduire);
}
brancherReconduire();

export { apercu, reconduire, proposer };
