// ── Les confirmations passagères, avec « Annuler » ────────────────────────
//
// Le motif des applications courantes (Gmail, Drive, Pronote) : un message
// bref, en bas de l'écran, qui disparaît seul — et, pour un geste qui ne se
// rattrape pas, un DÉLAI avec « Annuler » plutôt qu'une boîte de confirmation.
// Clore une séance ferme les réponses de toute la classe : on laisse cinq
// secondes pour se raviser, et le geste ne part vers la base qu'ensuite.
//
// Les messages en place (`erreur(zone, texte, true)`) restent : ils disent ce
// qui s'est passé à l'endroit où l'on regarde. Le toast s'y ajoute pour les
// gestes dont l'effet ne se voit pas là où l'on a cliqué.

import { $ } from './socle.js';

function zone(){ return $("toasts"); }

// toast("Séance démarrée") ; toast("…", { annuler: fn, duree: 5000 })
// Avec `apres`, le geste est DIFFÉRÉ : `apres()` part à la fin du délai, sauf
// si l'on clique « Annuler » avant — auquel cas `annuler()` est appelée.
function toast(texte, o){
  o = o || {};
  var duree = o.duree || (o.apres ? 5000 : 3500);
  var t = document.createElement("div");
  t.className = "toast" + (o.ton ? " " + o.ton : "");
  t.setAttribute("role", "status");
  var m = document.createElement("span");
  m.className = "toast-m";
  m.textContent = texte;
  t.appendChild(m);
  var fini = false, delai;
  function fermer(){ if (t.parentNode) t.parentNode.removeChild(t); }
  if (o.apres || o.annuler) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "toast-b";
    b.textContent = "Annuler";
    b.addEventListener("click", function(){
      if (fini) return;
      fini = true;
      clearTimeout(delai);
      fermer();
      if (o.annuler) o.annuler();
    });
    t.appendChild(b);
  }
  if (o.apres) {
    var barre = document.createElement("span");
    barre.className = "toast-barre";
    barre.style.animationDuration = duree + "ms";
    t.appendChild(barre);
  }
  zone().appendChild(t);
  delai = setTimeout(function(){
    if (fini) return;
    fini = true;
    fermer();
    if (o.apres) o.apres();
  }, duree);
  return t;
}

export { toast };
