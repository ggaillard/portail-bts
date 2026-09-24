// ── En direct : le canal temps réel du suivi d'une séance ─────────────────
//
// Quinzième module, sorti de seance.js le 25/09 pour qu'il reste sous les
// 700 lignes (§6.1 de REFONTE.md). Il ne sait rien de ce qu'on rafraîchit :
// seance.js lui passe sa fonction `rafraichir`, et lui dit quand la rappeler.

import { $, sb, suivi } from './socle.js';

// Les réponses, les points de passage et les mains levées de CETTE séance
// arrivent par le canal temps réel de Supabase : une main levée s'affiche dans
// la seconde, au lieu d'attendre jusqu'à huit secondes. Plusieurs changements
// rapprochés — trente étudiants qui valident la même question — sont regroupés
// en un seul rafraîchissement.
//
// La boucle n'est pas supprimée, elle devient un filet : trente secondes tant
// que le canal est ouvert, huit s'il tombe. L'appel et l'humeur vivent sur la
// séance 99 et ne passent pas par ce canal : le filet les rattrape.
var canalDirect = null, attenteDirect = null;
var DIRECT_REGROUPE = 400, FILET_DIRECT = 30000, FILET_SANS = 8000;

function brancherDirect(rafraichir){
  debrancherDirect();
  if (!sb || typeof sb.channel !== "function" || !suivi.seanceId) return marquerDirect(false);
  var id = Number(suivi.seanceId);
  var relancer = function(){
    clearTimeout(attenteDirect);
    attenteDirect = setTimeout(rafraichir, DIRECT_REGROUPE);
  };
  canalDirect = sb.channel("suivi-seance-" + id);
  ["reponses", "passages", "mains"].forEach(function(t){
    canalDirect.on("postgres_changes",
      { event: "*", schema: "public", table: t, filter: "seance_id=eq." + id }, relancer);
  });
  canalDirect.subscribe(function(etat){
    var ouvert = etat === "SUBSCRIBED";
    if (suivi.minuteur) {
      clearInterval(suivi.minuteur);
      suivi.minuteur = setInterval(rafraichir, ouvert ? FILET_DIRECT : FILET_SANS);
    }
    marquerDirect(ouvert);
  });
}

function debrancherDirect(){
  clearTimeout(attenteDirect);
  if (canalDirect && sb && typeof sb.removeChannel === "function") sb.removeChannel(canalDirect);
  canalDirect = null;
  suivi.direct = false;
}

// On dit ce qui est vrai : « en direct » seulement quand le canal est ouvert.
function marquerDirect(ouvert){
  suivi.direct = !!ouvert;
  var z = $("suivi-mode");
  if (!z) return;
  z.textContent = ouvert
    ? "En direct : chaque réponse s'affiche dès qu'elle arrive."
    : "Les chiffres se rafraîchissent seuls toutes les huit secondes.";
  z.classList.toggle("direct", !!ouvert);
}


export { brancherDirect, debrancherDirect, marquerDirect };
