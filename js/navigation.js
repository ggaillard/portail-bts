// ── Se retrouver dans le portail ──────────────────────────────────────────
//
// Troisième module sorti de app.js. Il porte les deux barres d'onglets — celle
// de l'écran de connexion et celle de l'espace enseignant — et, depuis le
// 17/09, l'adresse.
//
// Elles sont ensemble parce qu'elles suivent le MÊME motif, celui des ARIA
// Authoring Practices : un seul onglet dans l'ordre de tabulation, les flèches
// pour circuler, `aria-selected` en toutes lettres. Elles ne le suivaient pas
// toutes les deux ; les tenir dans un seul fichier est ce qui rend la
// divergence visible la prochaine fois.
//
// Ce module ne connaît personne : il n'importe que le socle, et tout ce qui
// doit se passer quand on change d'onglet passe par le DOM.

import { $ } from './socle.js';

// ── Les onglets de l'espace enseignant ────────────────────────────────────
// « Ce qui bloque » reste épinglé au-dessus : c'est la seule carte qu'on ne
// doit jamais avoir à aller chercher. Tout le reste vit dans un onglet, et
// c'est l'appel qui est ouvert au départ — c'est le geste du début d'heure.
var ONGLETS = ["appel", "ensemble", "quest", "seance"];

// ── L'onglet ouvert s'écrit dans l'adresse ────────────────────────────────
//
// Jusqu'au 17/09, `location` n'apparaissait qu'une fois dans tout le portail,
// pour un `location.reload()`. Conséquences, toutes quotidiennes :
//
//   · un rafraîchissement ramenait TOUJOURS sur le premier onglet. En cours on
//     rafraîchit vingt fois par heure, et on repayait le trajet à chaque fois ;
//   · le bouton Précédent quittait l'application au lieu de revenir à l'onglet
//     précédent — le geste le plus naturel du navigateur ne faisait pas ce
//     qu'il fait partout ailleurs ;
//   · aucun onglet ne pouvait être mis en favori ni envoyé à quelqu'un ;
//   · le titre de la page ne changeait jamais : trois onglets ouverts sur le
//     portail étaient indiscernables dans la barre du navigateur.
//
// Le nom de l'onglet suffit : `#seance`. La classe et la séance choisies n'y
// sont pas — ce serait utile pour partager un lien, mais cela demande de tenir
// deux sélecteurs en accord avec l'adresse, et de décider ce qui gagne quand
// ils divergent. Une chose à la fois.
// Les mêmes mots que les onglets, et pour la même raison : le titre de la page
// est ce qu'on lit dans un onglet de navigateur et dans l'historique. S'il ne
// dit pas ce que dit le bouton, l'historique devient illisible. Les clés, elles,
// sont celles de l'ADRESSE (#appel, #ensemble, #quest, #seance) et ne bougent
// pas : un lien mis en favori le 16/09 doit continuer d'ouvrir le bon onglet.
var TITRES = { appel: "Aujourd'hui", ensemble: "Le semestre",
               quest: "Ma bibliothèque", seance: "La séance" };
var TITRE_BASE = document.title;

function ongletDeLAdresse(){
  var h = String(location.hash || "").replace(/^#/, "");
  return ONGLETS.indexOf(h) >= 0 ? h : null;
}

// `adresse` vaut "pousser" (défaut, une entrée d'historique — c'est elle qui
// fait marcher Précédent), "remplacer" (à l'ouverture : on normalise l'adresse
// sans créer d'entrée) ou "aucun" (on revient D'UN mouvement de l'historique,
// il ne faut surtout pas en réécrire un).
function ouvrirOnglet(cle, adresse){
  if (ONGLETS.indexOf(cle) < 0) cle = "appel";
  ONGLETS.forEach(function(k){
    var o = $("ong-" + k), v = $("volet-" + k);
    var actif = (k === cle);
    o.classList.toggle("actif", actif);
    o.setAttribute("aria-selected", actif ? "true" : "false");
    // Un seul onglet dans l'ordre de tabulation : les flèches font le reste.
    o.tabIndex = actif ? 0 : -1;
    v.hidden = !actif;
  });

  document.title = TITRES[cle] + " — " + TITRE_BASE;

  if (adresse === "aucun") return;
  if (ongletDeLAdresse() === cle) return;          // déjà à la bonne adresse
  try {
    if (adresse === "remplacer") history.replaceState(null, "", "#" + cle);
    else history.pushState(null, "", "#" + cle);
  } catch (e) {
    // Certains contextes refusent l'écriture d'historique (page ouverte depuis
    // le disque, navigation privée verrouillée). L'onglet s'ouvre quand même :
    // l'adresse est un confort, pas la source de vérité.
    location.hash = cle;
  }
}

// Précédent, Suivant, ou une adresse tapée à la main. `pushState` ne déclenche
// pas cet événement — seuls les mouvements de l'utilisateur le font, ce qui est
// exactement ce qu'on veut écouter.
window.addEventListener("hashchange", function(){
  if ($("espace-ens").hidden) return;   // l'étudiant a ses propres ancres
  ouvrirOnglet(ongletDeLAdresse() || "appel", "aucun");
});

ONGLETS.forEach(function(cle, i){
  var o = $("ong-" + cle);
  o.addEventListener("click", function(){
    ouvrirOnglet(cle);
    // Sans cela, quitter un onglet long pour un onglet court laisse la page
    // au-delà de son contenu : l'écran paraît vide et on croit à une panne.
    var nav = $("onglets-ens");
    if (nav && nav.getBoundingClientRect().top < 0) {
      window.scrollTo({ top: nav.offsetTop, behavior: "instant" });
    }
  });
  o.addEventListener("keydown", function(e){
    var d = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
    if (!d) return;
    e.preventDefault();
    var suivant = ONGLETS[(i + d + ONGLETS.length) % ONGLETS.length];
    ouvrirOnglet(suivant);
    $("ong-" + suivant).focus();
  });
});

// ── Onglets de l'écran de connexion ───────────────────────────────────────
//
// Deux implémentations d'un même motif cohabitaient : celle de l'espace
// enseignant, conforme au motif « Tabs » des ARIA Authoring Practices, et
// celle-ci, qui ne l'était pas — pas de flèches, les deux onglets dans l'ordre
// de tabulation, et `aria-selected` recevant un booléen plutôt que la chaîne
// que la spécification demande. C'était pourtant le premier écran que voit un
// étudiant. Une seule façon de faire, désormais, et c'est la bonne.
var CONNEXION = ["etu", "ens"];

function onglet(actif){
  if (CONNEXION.indexOf(actif) < 0) actif = "etu";
  CONNEXION.forEach(function(k){
    var o = $("t-" + k), v = $("p-" + k);
    var vif = (k === actif);
    o.setAttribute("aria-selected", vif ? "true" : "false");
    o.tabIndex = vif ? 0 : -1;
    v.hidden = !vif;
  });
}

CONNEXION.forEach(function(cle, i){
  var o = $("t-" + cle);
  o.addEventListener("click", function(){ onglet(cle); });
  o.addEventListener("keydown", function(e){
    var d = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
    if (!d) return;
    e.preventDefault();
    var suivant = CONNEXION[(i + d + CONNEXION.length) % CONNEXION.length];
    onglet(suivant);
    $("t-" + suivant).focus();
  });
});

export { ONGLETS, ouvrirOnglet, ongletDeLAdresse, onglet };
