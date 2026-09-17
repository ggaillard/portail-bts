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


// ── La file d'attente de l'étudiant, et ce qu'on lui dit quand ça rate ─────
//
// Ces six-là sont montées au socle le 17/09, en sortant js/questionnaires.js :
// elles servent aux questionnaires, à l'appel, à l'humeur et aux contrôles,
// c'est-à-dire à tout ce que l'étudiant voit. Les laisser dans app.js aurait
// obligé chaque module d'écran à importer app.js, qui les importe — le cycle
// qu'on évite depuis le début.
//
// `etapes()` lit le DOM dans son ordre plutôt que de tenir une liste : le
// nombre de cartes dépend de la classe et du jour, et une liste figée
// mentirait une fois sur deux.

// Quatre cartes possibles avant « Vos projets ». Empilées, elles ne disent ni
// combien il en reste, ni laquelle est faite. Chaque carte porte donc son rang
// et son état, et le bandeau du haut compte ce qui reste.
// Plus de liste figée : le nombre de questionnaires dépend de la classe et du
// jour. On lit le DOM dans son ordre, ce qui est aussi l'ordre de lecture.
function etapes(){
  return Array.prototype.slice.call(
    document.querySelectorAll("#espace-etu .etape"));
}

function marquerEtape(id, fait){
  var e = $(id);
  if (e) e.setAttribute("data-fait", fait ? "oui" : "non");
  majFile();
}

function majFile(){
  var vus = etapes().filter(function(e){ return e && !e.hidden; });
  // Le rang se recalcule à chaque fois : selon la classe et le jour, il peut
  // y avoir deux cartes ou quatre. Un « 3 » figé mentirait une fois sur deux.
  vus.forEach(function(e, i){
    var h = e.querySelector("h2");
    if (h) h.setAttribute("data-n", i + 1);
  });

  // Une carte peut être visible ET hors file : le questionnaire de révision se
  // refait à volonté, il n'a pas de fin, et le compteur réclamerait
  // indéfiniment « 1 chose à faire ». C'est un état à part entière, et c'est
  // ICI qu'il se dit — pas en marquant la carte « faite », ce qui la replierait
  // sur son titre et la rendrait inutilisable. Le 16/09, c'est exactement ce
  // qui s'est produit : la carte s'affichait pliée, sans question ni options,
  // et la classe n'avait aucun moyen d'y répondre.
  var reste = vus.filter(function(e){
    return e.getAttribute("data-fait") !== "oui"
        && e.getAttribute("data-hors-file") !== "oui";
  });
  var f = $("file-etu");
  if (!f) return;
  f.hidden = !vus.length;
  $("file-reste").textContent = reste.length ? String(reste.length) : "✓";
  // Pas d'énumération : à 390 px elle passait sur trois lignes, et les cartes
  // juste en dessous portent déjà leur numéro et leur nom.
  $("file-txt").textContent = reste.length
    ? (reste.length > 1 ? "choses à faire avant vos projets" : "chose à faire avant vos projets")
    : "Tout est fait. Bonne séance.";
  // Le raccourci n'apparaît qu'une fois la présence marquée : c'est elle qui
  // ne peut pas attendre, le reste peut se faire après.
  var appel = $("bloc-appel");
  $("file-saut").hidden = !(appel && (appel.hidden || appel.getAttribute("data-fait") === "oui"));
}

function motifEnvoi(err){
  var m = (err && err.message) || "";
  if (/non identifie/i.test(m)) return "session";
  if (/ferm/i.test(m))          return "fermee";
  return "autre";
}

function texteEnvoi(err, quoi){
  switch (motifEnvoi(err)) {
    case "session":
      return "Votre session a été reprise sur un autre appareil : rien n'a été " +
             "enregistré. Cliquez « Ce n'est pas moi », puis identifiez-vous à nouveau.";
    case "fermee":
      return quoi === "appel"
        ? "L'appel est fermé pour cette classe. Prévenez votre enseignant : " +
          "votre présence n'est pas enregistrée."
        : "Cette séance est fermée : les réponses n'y sont plus acceptées. " +
          "Prévenez votre enseignant.";
    default:
      return "L'enregistrement n'a pas abouti. Réessayez dans un instant.";
  }
}

function signalerSessionPerimee(err){
  if (motifEnvoi(err) !== "session") return;
  var b = $("b-sortie-etu");
  if (b) { b.classList.add("btn"); b.classList.remove("btn-sec"); }
}


// ── Quatre petits partages ────────────────────────────────────────────────
// Ils ne sont ici que parce que deux écrans les appellent : une rangée de
// pastilles sert à l'appel ET aux projets, la copie dans le presse-papiers à
// trois endroits. Monter au socle ce qui n'a qu'un seul client serait la
// mauvaise direction — le socle deviendrait le nouveau fourre-tout.

// Aucun appel lisible : pas de pastille du tout. Zéro absent : pas de pastille
// non plus — un « 0 » rouge à côté de « Aujourd'hui » se lirait comme un souci.
function pastilleAppel(n){
  var p = $("ong-appel-n");
  if (!p) return;
  p.hidden = !n;
  p.textContent = n ? String(n) : "";
  p.setAttribute("aria-label", n ? (n + " absents aujourd'hui") : "");
}

// Une seule mécanique de copie, pour le bouton de classe comme pour le global.
function copierTexte(texte, bouton){
  var dit = function(ok){
    if (bouton) {
      var avant = bouton.textContent;
      bouton.textContent = ok ? "Copié" : "Échec";
      setTimeout(function(){ bouton.textContent = avant; }, 1600);
    }
    return ok;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texte).then(function(){ return dit(true); },
                                                     function(){ return dit(false); });
  }
  return Promise.resolve(dit(false));
}

function pastilles(id, liste, classe, texte){
  var z = (typeof id === "string") ? $(id) : id;
  if (!z) return;
  z.innerHTML = "";
  liste.forEach(function(x){
    var s = document.createElement("span");
    s.className = "pastille " + classe;
    s.textContent = texte(x);
    z.appendChild(s);
  });
}

function dateCourte(iso){
  var d = new Date(iso);
  return isNaN(d) ? "?" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}


// ── La table des noms, dans CE navigateur et nulle part ailleurs ──────────
// `eleves` n'a ni nom ni prénom, et le dépôt est public : la correspondance
// numéro -> nom vit dans le localStorage, saisie à la main. Elle est au socle
// parce que trois écrans la lisent — l'appel, le parcours de l'heure et les
// deux enquêtes. Ne jamais proposer de la mettre en base ni dans config.js.
//
// `prenomSeul` prend le dernier mot qui n'est pas tout en majuscules : les
// listes collées viennent en « NOM Prénom ». Rien n'est inventé, et rien ne
// part vers la base.

function lireNoms(){
  try { return JSON.parse(localStorage.getItem(NOMS_CLE) || "{}"); }
  catch (e) { return {}; }
}

function nomDe(codeClasse, numero){
  var m = lireNoms()[codeClasse];
  if (!m) return "";
  var n = String(numero || "").trim();
  return m[n] || m[n.replace(/^0+/, "")] || m[("0" + n).slice(-2)] || "";
}

function enregistrerNoms(texte){
  var map = lireNoms(), lus = 0, ignores = 0;
  String(texte || "").split(/\r?\n/).forEach(function(ligne){
    if (!ligne.trim()) return;
    var p = ligne.split(/[;\t]/).map(function(x){ return x.trim(); });
    if (p.length < 3 || !p[0] || !p[1] || !p[2]) { ignores++; return; }
    (map[p[0]] = map[p[0]] || {})[p[1]] = p[2];
    lus++;
  });
  try { localStorage.setItem(NOMS_CLE, JSON.stringify(map)); }
  catch (e) { return { erreur: true }; }
  return { lus: lus, ignores: ignores };
}

// Les listes collées viennent souvent en « NOM Prénom ». À l'oral on appelle
// par le prénom : on prend le dernier mot qui n'est pas tout en majuscules,
// et à défaut la chaîne entière — jamais rien d'inventé.
function prenomSeul(nom){
  var mots = String(nom || "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "";
  for (var i = mots.length - 1; i >= 0; i--) {
    if (mots[i] !== mots[i].toUpperCase()) return mots[i];
  }
  return mots[mots.length - 1];
}

// Le code de la classe sélectionnée : c'est lui qui sert de clé aux prénoms
// rangés dans ce navigateur.
function codeClasseCourante(){
  var l = (suivi.classesConnues || []).filter(function(c){
    return String(c.id) === String(suivi.classeId);
  });
  return l.length ? l[0].code : "";
}

// Les noms que le reste du portail importe d'ici. `suivi` est un objet qu'on
// mute, jamais qu'on remplace : c'est ce qui permet à deux modules de parler
// du même état sans le passer en paramètre partout.
export { suivi, erreur, montrer, typo, anime, entree, pousse, son, SONS,
         NOMS_CLE, estDemo, classesReelles,
         etapes, majFile, marquerEtape, motifEnvoi, texteEnvoi, signalerSessionPerimee,
         pastilles, pastilleAppel, copierTexte, dateCourte,
         lireNoms, enregistrerNoms, nomDe, prenomSeul, codeClasseCourante };
