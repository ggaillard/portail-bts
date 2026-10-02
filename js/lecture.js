// ── Le temps de lecture : lire avant de répondre ──────────────────────────
//
// Demandé par G le 02/10/2026 : des étudiants répondaient sans avoir lu —
// quatre questions en dix secondes. « Il doit y avoir un temps de lecture
// avant de répondre. »
//
// Une question s'affiche, ses options restent grisées le temps de la lire,
// avec un décompte, puis elles s'allument. Le temps dépend de la longueur :
// 3,5 mots par seconde, entre 4 et 25 secondes.
//
// LA MÊME FORMULE vit à trois endroits, et c'est voulu : ici, dans la base
// (`temps_lecture()`, qui compte ce qui passe quand même) et dans le suivi.js
// des sites de cours. Changer l'une, c'est changer les trois — la migration
// 20261002060000 vérifie la sienne sur un exemple, outils/t_lecture.mjs
// vérifie que celle-ci rend la même chose.
//
// Ce n'est PAS appliqué à l'appel, à l'humeur, aux certitudes (`-c`) ni aux
// questionnaires d'opinion : on ne fait pas attendre quelqu'un pour dire
// « présent » ou « ça va ».

function tempsLecture(intitule, options){
  var t = String(intitule || "").trim();
  if (!t) return 0;
  var mots = (t + " " + (options || []).join(" ")).trim().split(/\s+/).length;
  return Math.min(25, Math.max(4, Math.ceil(mots / 3.5)));
}

// Grise les boutons le temps de lire, avec un décompte écrit dans `zone`
// (un élément du DOM, vidé à la fin). Rend une fonction qui annule — à
// appeler si la carte se redessine avant la fin, sinon un ancien minuteur
// rallumerait des boutons qui n'existent plus, ou plus les mêmes.
//
// Le décompte est annoncé une fois (aria-live poli sur la zone), pas chaque
// seconde : un lecteur d'écran qui égrène « 7, 6, 5… » empêche justement
// de lire la question.
function verrouillerLecture(boutons, secondes, zone){
  var liste = Array.prototype.slice.call(boutons || []);
  if (!secondes || !liste.length) { if (zone) zone.textContent = ""; return function(){}; }
  // Le décompte se recalcule sur l'HEURE, pas en comptant les tics : un
  // onglet en arrière-plan voit ses minuteurs ralentis à un par minute, et un
  // décompte « à la main » rendrait la main bien après la fin de la lecture.
  var fin = Date.now() + secondes * 1000, fini = false;
  var reste = function(){ return Math.ceil((fin - Date.now()) / 1000); };
  liste.forEach(function(b){ b.disabled = true; b.classList.add("en-lecture"); });
  var ecrire = function(){
    if (zone) zone.textContent = "Prenez le temps de lire… " + reste() + " s";
  };
  if (zone) { zone.className = "lecture-zone"; zone.setAttribute("aria-live", "off"); ecrire(); }
  var tic = setInterval(function(){
    if (reste() > 0) { ecrire(); return; }
    liberer();
  }, 1000);
  function liberer(){
    if (fini) return;
    fini = true;
    clearInterval(tic);
    liste.forEach(function(b){ b.disabled = false; b.classList.remove("en-lecture"); });
    if (zone) { zone.setAttribute("aria-live", "polite"); zone.textContent = ""; }
  }
  return function annuler(){ fini = true; clearInterval(tic); };
}

// Une seule zone de décompte par carte, créée à la demande juste avant les
// options : la placer ailleurs la ferait lire après les boutons.
function zoneLecture(conteneur){
  if (!conteneur || !conteneur.parentNode) return null;
  var z = conteneur.previousElementSibling;
  if (z && z.classList && z.classList.contains("lecture-zone")) return z;
  z = document.createElement("p");
  z.className = "lecture-zone";
  conteneur.parentNode.insertBefore(z, conteneur);
  return z;
}

// Le geste complet : calculer, griser, décompter. `cle` retient l'heure de
// fin de lecture de chaque question : une carte redessinée pendant le
// décompte (une erreur d'envoi, un rafraîchissement) reprend le temps QUI
// RESTE — ni zéro, ce qui offrirait un contournement, ni tout depuis le
// début, ce qui ferait relire ce qu'on vient de lire.
var finLecture = {};
function lireAvantDeRepondre(cle, intitule, options, conteneur){
  if (!conteneur) return;
  var z = zoneLecture(conteneur);
  if (conteneur._annulerLecture) { conteneur._annulerLecture(); conteneur._annulerLecture = null; }
  if (!(cle in finLecture)) finLecture[cle] = Date.now() + tempsLecture(intitule, options) * 1000;
  var reste = Math.ceil((finLecture[cle] - Date.now()) / 1000);
  if (reste <= 0) { if (z) z.textContent = ""; return; }
  conteneur._annulerLecture = verrouillerLecture(conteneur.querySelectorAll("button"), reste, z);
}

export { tempsLecture, verrouillerLecture, zoneLecture, lireAvantDeRepondre };
