// ── Les alertes sur le téléphone ──────────────────────────────────────────
//
// Demandé par G le 02/10/2026 : le suivi se lit au téléphone, en circulant
// entre les rangs. Une main levée n'apparaissait que si l'écran était allumé
// et la page ouverte : rien ne prévenait, et l'écran se mettait en veille.
//
// Quatre gestes, tous déclenchés par « À aller voir » (vigilance.js), qui
// connaît déjà les cas URGENTS — main levée non vue, « perdu » à l'humeur :
//
//   · VIBRER quand un cas urgent APPARAÎT (pas à chaque rafraîchissement :
//     on compare à ce qu'on avait déjà vu) ;
//   · une PASTILLE sur l'icône de l'application installée et un « (2) »
//     devant le titre de l'onglet — le nombre de cas urgents en cours ;
//   · une NOTIFICATION quand la page est en arrière-plan, si on l'a permise ;
//   · l'ÉCRAN RESTE ALLUMÉ pendant une séance démarrée et ouverte
//     (Wake Lock), et seulement pendant.
//
// Rien de tout cela ne se déclenche au premier affichage d'une séance : les
// cas déjà là sont la ligne de base, pas une nouveauté. Le bouton 🔔 de
// l'en-tête coupe tout ; le choix se garde sur l'appareil.
//
// Chaque API manque quelque part (pas de vibreur sur iPhone, pas de Wake Lock
// sur un vieux navigateur, pas de pastille hors application installée) : on
// essaie, on n'insiste pas, et rien ne casse quand elle manque.

import { $ } from './socle.js';
import { toast } from './toast.js';

var CLE = "tdc-alertes";
var vus = null, seanceVue = null, verrou = null, voulu = false;

function actives(){
  try { return localStorage.getItem(CLE) !== "non"; } catch (e) { return true; }
}

function brancherAlertes(){
  var b = $("b-sv-alerte");
  if (!b || b._branche) return;
  b._branche = true;
  marquerBouton();
  b.addEventListener("click", function(){
    var on = !actives();
    try { localStorage.setItem(CLE, on ? "oui" : "non"); } catch (e) {}
    marquerBouton();
    // La permission de notifier se demande sur un geste, jamais d'office.
    if (on && "Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (e) {}
    }
    if (!on) { poserCompte(0); lacherEcran(); }
    else if (voulu) garderEcran();
    toast(on ? "Alertes activées : vibration et écran allumé pendant la séance."
             : "Alertes coupées sur cet appareil.");
  });
  document.addEventListener("visibilitychange", function(){
    // Le navigateur rend le verrou quand la page passe en arrière-plan : on le
    // reprend au retour, si la séance tourne toujours.
    if (document.visibilityState === "visible" && voulu && actives()) garderEcran();
  });
}

function marquerBouton(){
  var b = $("b-sv-alerte");
  if (!b) return;
  var on = actives();
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.textContent = on ? "🔔" : "🔕";
  b.title = on ? "Alertes activées (vibration, écran allumé) — toucher pour couper"
               : "Alertes coupées — toucher pour les activer";
  b.setAttribute("aria-label", b.title);
}

// Les cas urgents d'une lecture de « À aller voir », chacun avec une clé
// stable : la main par son identifiant, le « perdu » par l'élève.
function urgents(d){
  var l = [];
  (d.eleves || []).forEach(function(x){
    (x.raisons || []).forEach(function(r){
      if (r.gravite !== "urgent") return;
      var cle = r.cle === "main" && x.main ? "main-" + x.main.id : r.cle + "-" + x.eleve_id;
      l.push({ cle: cle, numero: x.numero, texte: r.texte, main: r.cle === "main" });
    });
  });
  return l;
}

function signaler(d){
  if (!d) return;
  var liste = urgents(d);
  var tourne = d.minutes !== null && d.minutes !== undefined;   // démarrée ET ouverte
  // Changer de séance remet la ligne de base à zéro.
  if (seanceVue !== d.seance_id) { seanceVue = d.seance_id; vus = null; }
  var nouveaux = vus ? liste.filter(function(u){ return !vus[u.cle]; }) : [];
  vus = {};
  liste.forEach(function(u){ vus[u.cle] = true; });

  voulu = tourne;
  if (!actives()) { poserCompte(0); lacherEcran(); return { nouveaux: [] }; }
  poserCompte(liste.length);
  if (tourne) garderEcran(); else lacherEcran();
  if (nouveaux.length) prevenir(nouveaux);
  return { nouveaux: nouveaux };
}

function prevenir(nouveaux){
  var u = nouveaux[0];
  var texte = (u.main ? "✋ " : "😕 ") + u.numero + " — " + u.texte +
    (nouveaux.length > 1 ? " (et " + (nouveaux.length - 1) + " autre" +
                           (nouveaux.length > 2 ? "s" : "") + ")" : "");
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {}
  if (document.visibilityState === "hidden" && "Notification" in window &&
      Notification.permission === "granted") {
    var opts = { body: texte, tag: "tdc-urgent", renotify: true, icon: "icones/icone-192.png" };
    var essai = navigator.serviceWorker && navigator.serviceWorker.getRegistration
      ? navigator.serviceWorker.getRegistration() : Promise.resolve(null);
    essai.then(function(reg){
      if (reg && reg.showNotification) return reg.showNotification("À aller voir", opts);
      return new window.Notification("À aller voir", opts);
    }).catch(function(){});
  } else {
    toast(texte, { duree: 6000, ton: "urgent" });
  }
}

// « (2) Tour de contrôle — En cours » : le titre est la seule chose qu'on voit
// d'un onglet en arrière-plan. navigation.js écrit le titre à chaque
// changement d'onglet ; on retire donc notre préfixe avant de reposer le sien.
function poserCompte(n){
  var t = document.title.replace(/^\(\d+\)\s/, "");
  document.title = (n ? "(" + n + ") " : "") + t;
  try {
    if (n && navigator.setAppBadge) navigator.setAppBadge(n).catch(function(){});
    else if (!n && navigator.clearAppBadge) navigator.clearAppBadge().catch(function(){});
  } catch (e) {}
}

function garderEcran(){
  if (verrou || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  navigator.wakeLock.request("screen").then(function(v){
    verrou = v;
    v.addEventListener("release", function(){ verrou = null; });
  }).catch(function(){ verrou = null; });
}

function lacherEcran(){
  if (verrou) { try { verrou.release(); } catch (e) {} verrou = null; }
}

export { brancherAlertes, signaler, urgents };
