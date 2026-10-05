// ── L'interrupteur : un seul composant pour « proposé aux étudiants » ─────
//
// Lot 1 des propositions du 05/10 (claude/application-seance-propositions.md,
// item 1.3). Relevé ce jour-là : quatre vocabulaires pour des états voisins —
// une pastille « Proposé / Éteint » ici, un bouton « Le proposer aux
// étudiants / Éteindre » là, « Proposer / Éteindre » sur l'écran du direct,
// « Proposer la révision / Éteindre la révision » dans la fiche, « Visible /
// Cachée » dans le semestre. Même geste, cinq dessins et cinq libellés : on
// relisait chaque fois pour savoir si le bouton DISAIT l'état ou FAISAIT
// l'action (critère d'homogénéité de Bastien & Scapin).
//
// Désormais :
//
//   · un état binaire qui se rebascule à volonté est un INTERRUPTEUR — motif
//     *Switch* des ARIA Authoring Practices : un <button role="switch">,
//     `aria-checked`, un libellé FIXE qui nomme l'état quand il est allumé
//     (« Proposé aux étudiants », « Visible par les étudiants »). Le libellé ne
//     change jamais ; c'est la position du curseur qui change. Un lecteur
//     d'écran dit « Proposé aux étudiants, interrupteur, activé ».
//   · une ACTION qui change le cours de la séance reste un bouton nommé par
//     son verbe : Démarrer, Ouvrir, Clore. Elles ont un chrono, ou un délai
//     avec « Annuler » ; ce ne sont pas des états qu'on bascule en passant.
//
// La classe `on` reste posée en plus d'`aria-checked` : les gestionnaires
// existants lisent `classList.contains("on")` pour savoir quoi viser, et ce
// composant ne devait pas les réécrire. Le curseur ne bouge qu'une fois la
// base d'accord : on relit, on ne suppose pas.

function interrupteur(o){
  var b = document.createElement("button");
  b.type = "button";
  equiperInterrupteur(b, o.libelle);
  if (o.classe) b.className += " " + o.classe;
  // Le nom accessible COMMENCE par le libellé visible (WCAG 2.5.3) et dit
  // de quoi il s'agit quand dix interrupteurs se suivent.
  if (o.nom) b.setAttribute("aria-label", o.nom);
  reglerInterrupteur(b, !!o.on);
  if (o.change) b.addEventListener("click", function(){ o.change(!interrupteurAllume(b), b); });
  return b;
}

// Pour un bouton déjà écrit dans index.html : lui donner la forme une fois.
function equiperInterrupteur(b, libelle){
  if (!b) return b;
  if (!b.dataset.inter) {
    b.dataset.inter = "1";
    b.classList.add("inter");
    b.setAttribute("role", "switch");
    b.innerHTML = '<span class="inter-piste" aria-hidden="true"><span class="inter-bouton"></span></span>' +
                  '<span class="inter-l"></span>';
  }
  if (libelle) b.querySelector(".inter-l").textContent = libelle;
  return b;
}

function reglerInterrupteur(b, on){
  if (!b) return;
  b.setAttribute("aria-checked", on ? "true" : "false");
  b.classList.toggle("on", !!on);
}

function interrupteurAllume(b){
  return !!b && b.getAttribute("aria-checked") === "true";
}

export { interrupteur, equiperInterrupteur, reglerInterrupteur, interrupteurAllume };
