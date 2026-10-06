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
// Trois onglets, trois moments, depuis le 28/09 : En cours, Préparer, Bilan.
// L'ancienne clé #seance (le suivi d'une séance, qui vit désormais dans En
// cours) reste comprise, pour qu'un favori ne tombe pas dans le vide.
var ONGLETS = ["appel", "quest", "ensemble"];
var ALIAS = { seance: "appel" };

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
var TITRES = { appel: "En cours", quest: "Préparer", ensemble: "Bilan" };
var TITRE_BASE = document.title;

// Depuis le 28/09, l'adresse d'En cours peut porter la séance suivie :
// « #appel/s/123 ». Un favori ou un raccourci sur le téléphone rouvre alors
// cette séance-là. Qui gagne quand l'adresse et les sélecteurs divergent ?
// L'ADRESSE au chargement (encours.js la lit), les SÉLECTEURS ensuite
// (pilote.js réécrit l'adresse à chaque séance choisie).
function seanceDeLAdresse(){
  var m = /^#(?:appel|seance)\/s\/(\d+)$/.exec(location.hash || "") ||
          /^#s\/(\d+)\/(?:direct)(?:\/[a-z]+)?$/.exec(location.hash || "");
  return m ? m[1] : null;
}

// ── La page d'une séance (06/10, lot 3) ───────────────────────────────────
//
// « #s/35 », « #s/35/preparer/missions », « #s/35/direct », « #s/35/bilan ».
// La séance devient un objet qu'on ouvre : une page, trois onglets — les
// trois moments appliqués à UNE séance. L'onglet du haut qui s'allume est
// le moment de l'onglet de la page (Préparer → Préparer, En direct → En
// cours, Bilan → Bilan) : on sait toujours d'où l'on vient, et un clic
// dessus y ramène. Ce module ne construit pas la page — js/pageseance.js le
// fait, et s'inscrit ici par brancherPage() — il tient l'adresse.
var PAGE_MOMENT = { preparer: "quest", direct: "appel", bilan: "ensemble" };
var PAGE_TITRES = { preparer: "Préparer", direct: "En direct", bilan: "Bilan" };
var page = { ouvrir: null, quitter: null };
var pageCourante = null;      // { id, onglet } quand la page est à l'écran

function pageDeLAdresse(){
  var m = /^#s\/(\d+|nouvelle)(?:\/(preparer|direct|bilan))?(?:\/([a-z]+))?$/.exec(location.hash || "");
  return m ? { id: m[1], onglet: m[2] || null, sous: m[3] || null } : null;
}

function brancherPage(o){ page = o; }
function pageOuverte(){ return pageCourante; }

// Aller à la page d'une séance. `adresse` comme pour ouvrirOnglet().
function allerSeance(id, onglet, sous, adresse){
  var cible = "#s/" + id + (onglet ? "/" + onglet : "") + (onglet && sous ? "/" + sous : "");
  if (adresse !== "aucun" && location.hash !== cible) {
    try {
      if (adresse === "remplacer") history.replaceState(null, "", cible);
      else history.pushState(null, "", cible);
    } catch (e) { /* l'adresse est un confort */ }
  }
  if (page.ouvrir) return page.ouvrir(String(id), onglet || null, sous || null);
  return Promise.resolve();
}

// Appelée par la page une fois son onglet choisi : les volets des moments
// se cachent, le moment correspondant s'allume, le titre suit.
function montrerPage(id, onglet, titre){
  var cle = PAGE_MOMENT[onglet] || "quest";
  ONGLETS.forEach(function(k){
    var o = $("ong-" + k), actif = (k === cle);
    o.classList.toggle("actif", actif);
    o.setAttribute("aria-selected", actif ? "true" : "false");
    o.tabIndex = actif ? 0 : -1;
    $("volet-" + k).hidden = true;
  });
  $("volet-seance").hidden = false;
  pageCourante = { id: String(id), onglet: onglet };
  document.title = (titre ? titre + " — " : "") + PAGE_TITRES[onglet] + " — " + TITRE_BASE;
}

function quitterPage(){
  if (!pageCourante) return;
  pageCourante = null;
  if ($("volet-seance")) $("volet-seance").hidden = true;
  if (page.quitter) page.quitter();
}

// À l'ouverture de l'espace : la page si l'adresse en désigne une, sinon
// l'onglet de l'adresse, sinon En cours.
function ouvrirDepuisLAdresse(){
  var p = pageDeLAdresse();
  if (!p) { ouvrirOnglet(ongletDeLAdresse() || "appel", "remplacer"); return; }
  ouvrirOnglet(PAGE_MOMENT[p.onglet] || "appel", "aucun");
  allerSeance(p.id, p.onglet, p.sous, "aucun");
}

function ongletDeLAdresse(){
  var h = String(location.hash || "").replace(/^#/, "").split("/")[0];
  h = ALIAS[h] || h;
  return ONGLETS.indexOf(h) >= 0 ? h : null;
}

// `adresse` vaut "pousser" (défaut, une entrée d'historique — c'est elle qui
// fait marcher Précédent), "remplacer" (à l'ouverture : on normalise l'adresse
// sans créer d'entrée) ou "aucun" (on revient D'UN mouvement de l'historique,
// il ne faut surtout pas en réécrire un).
function ouvrirOnglet(cle, adresse){
  cle = ALIAS[cle] || cle;
  if (ONGLETS.indexOf(cle) < 0) cle = "appel";
  quitterPage();
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
  // En cours garde la séance de l'adresse (#appel/s/123) ; un alias
  // (#seance) se réécrit, lui, en #appel.
  var cible = "#" + cle + (cle === "appel" && seanceDeLAdresse() ? "/s/" + seanceDeLAdresse() : "");
  if (location.hash === cible) return;
  try {
    if (adresse === "remplacer") history.replaceState(null, "", cible);
    else history.pushState(null, "", cible);
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
  var p = pageDeLAdresse();
  if (p) { allerSeance(p.id, p.onglet, p.sous, "aucun"); return; }
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

export { ONGLETS, ouvrirOnglet, ongletDeLAdresse, seanceDeLAdresse, onglet,
         pageDeLAdresse, brancherPage, pageOuverte, allerSeance, montrerPage, ouvrirDepuisLAdresse };
