// ── Le socle : ce dont tout le reste a besoin ─────────────────────────────
//
// Premier module sorti de app.js (étape A5 de REFONTE.md). Il ne contient que
// ce qui n'appartient à aucun écran en particulier : l'accès à la base, le
// raccourci vers le DOM, l'état partagé, et six utilitaires d'affichage.
//
// Il est sorti AVANT les modules d'écran, et l'ordre n'est pas indifférent :
// le plan annonçait « les feuilles d'abord, le socle ensuite ». C'était faux
// dans ce sens-là. Un module d'écran a besoin de `$`, de `suivi`, de `typo` ;
// si le socle est encore dans app.js, l'écran doit importer app.js, qui
// importe l'écran — un cycle. En sortant le socle en premier, les deux
// importent d'ici et personne n'importe personne.
//
// Ce qui n'est PAS ici, volontairement : les gardes de démarrage. Elles
// s'écrivaient avec `return` au milieu de la fermeture de app.js, ce qu'un
// module ne peut pas faire. Le socle constate (`probleme`), app.js décide.

export const CFG = window.TDC_CONFIG;
export const $ = function(id){ return document.getElementById(id); };

// null si tout va bien, sinon la phrase à montrer à la place du portail.
export const probleme =
  (!CFG || !CFG.url || !CFG.cle)
    ? "Configuration absente : le fichier config.js n'a pas été chargé."
  : (!window.supabase || !window.supabase.createClient)
    ? "La librairie Supabase n'a pas pu être chargée. Vérifiez votre connexion."
  : null;

export const sb = probleme ? null : window.supabase.createClient(CFG.url, CFG.cle, {
  auth: { persistSession: true, autoRefreshToken: true }
});

var suivi = { classeId: null, seanceId: null, titre: "", stats: null,
              minuteur: null, vue: "prog", ecran: false,
              rangs: null, auto: null, chiffres: {}, repIndex: 0, feteFaite: false };

// Le message est un TEXTE, et il le reste jusqu'à l'écran.
//
// Jusqu'au 16/09 cette fonction écrivait son argument dans innerHTML. Sur ses
// 73 appels, douze y versaient une valeur venue de la base — un titre de
// questionnaire (`m.titre`), un nom de classe (`c.nom`), un message d'erreur
// de Supabase. Vérifié en exécutant le portail avec un titre contenant
// `<img src=x onerror=…>` : le code partait, et le message affiché devenait
// « «  » a été supprimé. » — la moitié de la phrase avalée, sans que rien ne
// signale quoi que ce soit.
//
// Aucun des 73 appels ne passe de balise volontairement : vérifié aussi, en
// analysant les arguments un par un. Il n'y a donc rien à préserver, et la
// carcasse se construit sans jamais concaténer de données.
function erreur(zone, texte, ok){
  var z = $(zone);
  z.textContent = "";
  if (!texte) return;
  var d = document.createElement("div");
  d.className = "msg" + (ok ? " ok" : "");
  d.textContent = texte;
  z.appendChild(d);
}

function montrer(id){
  ["chargement","connexion","espace-etu","espace-ens"].forEach(function(s){
    $(s).hidden = (s !== id);
  });
}

// « Dans « SI », que veut dire le I ? » se coupait avant le point
// d'interrogation sur un écran de téléphone, laissant le « ? » seul sur sa
// ligne. Une espace fine INSÉCABLE (U+202F) devant ? ! ; : et à l'intérieur
// des guillemets français : la ponctuation ne quitte plus son mot.
function typo(t){
  return String(t == null ? "" : t)
    .replace(/\s*([?!;:])/g, "\u202f$1")
    .replace(/«\s*/g, "«\u202f")
    .replace(/\s*»/g, "\u202f»");
}

// Compteur qui monte au lieu de sauter : le regard suit le mouvement.
function anime(id, valeur, suffixe, libelle){
  var el = $(id);
  var de = suivi.chiffres[id];
  suivi.chiffres[id] = valeur;
  var petit = "<small>" + libelle + "</small>";
  if (de === undefined || de === valeur || Math.abs(valeur - de) > 400) {
    el.innerHTML = valeur + suffixe + petit;
    return;
  }
  var t0 = performance.now(), duree = 1900;
  (function pas(t){
    var k = Math.min(1, (t - t0) / duree);
    var v = Math.round(de + (valeur - de) * (1 - Math.pow(1 - k, 3)));
    el.innerHTML = v + suffixe + petit;
    if (k < 1) requestAnimationFrame(pas);
  })(t0);
}

// Rejoue une animation d'entrée sur un conteneur qu'on vient d'afficher.
function entree(el){
  if (!el) return;
  el.classList.remove("tdc-entre");
  void el.offsetWidth;                 // force le navigateur à repartir de zéro
  el.classList.add("tdc-entre");
}

// Une barre pousse depuis zéro à l'entrée d'une vue, sinon elle glisse simplement.
function pousse(el, largeur, depuisZero){
  if (!depuisZero) { el.style.width = largeur; return; }
  el.style.width = "0%";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ el.style.width = largeur; });
  });
}

// ── Son : quelques notes de synthèse, aucun fichier. Coupé par défaut. ──
var audio = null;

function son(notes){
  if (!suivi.son || !notes) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    var t = audio.currentTime;
    notes.forEach(function(n, i){
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = n.t || "triangle";
      o.frequency.value = n.f;
      var d = n.d || 0.16, dep = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, dep);
      g.gain.exponentialRampToValueAtTime(n.v || 0.14, dep + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, dep + d);
      o.connect(g); g.connect(audio.destination);
      o.start(dep); o.stop(dep + d + 0.05);
    });
  } catch (e) { /* audio indisponible : on continue en silence */ }
}

var SONS = {
  revele: [{ f: 523 }, { f: 659 }, { f: 784 }],
  serie:  [{ f: 659 }, { f: 880, d: .26 }],
  fini:   [{ f: 523 }, { f: 659 }, { f: 784 }, { f: 1047, d: .3 }],
  vue:    [{ f: 392, d: .09, v: .06 }],
  temps:  [{ f: 330 }, { f: 262, d: .32 }]
};

// La correspondance numéro → nom vit dans CE navigateur et nulle part
// ailleurs : la table `eleves` n'a pas de champ nominatif, et le dépôt est
// public. La clé est ici parce que l'écran projeté la lit aussi.
var NOMS_CLE = "tdc-noms";

// ── Classes réelles et classes de démonstration ───────────────────────────
// Un code qui commence par DEMO désigne une classe de démonstration : elle
// sert à montrer le portail sans toucher aux vraies classes. C'est déjà la
// convention de a_faire() côté base (`code not like 'DEMO%'`) — la même ici,
// pour qu'un seul geste suffise à créer ou retirer une démo.
//
// Elles sont écartées de TOUT ce qui se lit en séance : appel, questionnaires,
// vue d'ensemble, effectifs. Elles restent dans les deux sélecteurs, rangées
// à part, parce que c'est là qu'on va justement quand on veut faire la démo.
function estDemo(c){ return /^DEMO/i.test((c && c.code) || ""); }

function classesReelles(l){ return (l || []).filter(function(c){ return !estDemo(c); }); }

// Les noms que le reste du portail importe d'ici. `suivi` est un objet qu'on
// mute, jamais qu'on remplace : c'est ce qui permet à deux modules de parler
// du même état sans le passer en paramètre partout.
export { suivi, erreur, montrer, typo, anime, entree, pousse, son, SONS,
         NOMS_CLE, estDemo, classesReelles };
