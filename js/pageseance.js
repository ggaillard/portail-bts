// ── La page d'une séance : Préparer · En direct · Bilan ───────────────────
//
// Lot 3 des propositions du 05/10 (06/10). Jusque-là, une même séance vivait
// à trois endroits — sa fiche dans Préparer, son direct dans En cours, son
// compte rendu sous « Fin d'heure » — reliés par des liens « Suivre › » et
// « Préparer › » qui faisaient changer de moment. Elle a maintenant SA page,
// « #s/35 », avec un fil d'Ariane (moment › classe › module › séance) et
// trois onglets : les trois moments, appliqués à elle seule. Les moments
// restent l'accueil ; la séance devient un objet qu'on ouvre.
//
// La page ne recopie rien : elle HÉBERGE. La fiche de Préparer (#gs-fiche)
// et la carte du direct (#carte-suivi) y sont déplacées quand on l'ouvre, et
// rendues à leur place quand on la quitte. Mêmes identifiants, mêmes modules
// pour les remplir (gestion.js, preparer.js, seance.js, pilote.js…) : rien
// n'existe en deux exemplaires, donc rien ne peut diverger. Le Bilan, lui,
// est neuf (js/bilanseance.js).
//
// Deux règles :
//   · OUVRIR LA PAGE SUR « PRÉPARER » NE CHANGE PAS LA SÉANCE SUIVIE EN
//     DIRECT. Préparer la 12 pendant le cours de la 11 laisse la 11 dans En
//     cours. Seul l'onglet En direct charge la séance dans la carte du direct.
//   · LA PAGE N'EST PAS UN QUATRIÈME MOMENT. L'onglet du haut qui s'allume est
//     celui de l'onglet de la page, et y cliquer ramène à la liste.

import { $, sb, suivi, erreur, typo } from './socle.js';
import { brancherPage, montrerPage, allerSeance, pageOuverte, ouvrirOnglet } from './navigation.js';
import { etatDe, rendreEtapes, quandLisible, lireAvecPlanning } from './etat.js';
import { chargerSeancesDe, pilotage } from './seance.js';
import { lireSeances, ouvrirFormulaire, fermerFormulaire, seancesLues } from './gestion.js';
import { ouvrirSeance, fermerSeance, montrerSeance } from './ouverture.js';
import { ouvrirVue } from './pilote.js';
import { toast } from './toast.js';
import { texteRefus } from './refus.js';
import { rendreBilan } from './bilanseance.js';

var ONGLETS_S = ["preparer", "direct", "bilan"];
var VUES = ["maintenant", "eleves", "questions", "fin"];
var MOMENT = { preparer: ["Préparer", "#quest"], direct: ["En cours", "#appel"], bilan: ["Bilan", "#ensemble"] };
var courante = null;       // { id, s, classeId, onglet }

// ── Héberger, rendre ─────────────────────────────────────────────────────
// La première fois qu'un bloc part, on note sa maison ; il y revient en
// dernier enfant, là où index.html le pose.
var maisons = {};
function heberger(id, ou){
  var el = $(id);
  if (!el || !ou) return;
  if (!maisons[id]) maisons[id] = el.parentNode;
  if (el.parentNode !== ou) ou.appendChild(el);
}
function rendreChezSoi(id){
  var el = $(id);
  if (el && maisons[id] && el.parentNode !== maisons[id]) maisons[id].appendChild(el);
}

// ── Lire la séance ───────────────────────────────────────────────────────
// La liste de Préparer est la source (seances_de_classe : état, ce qui
// manque, planning) : on la relit sur la classe de la séance. La ligne lue
// directement sert de repli — séance d'une démonstration, migration absente.
function attendreClasses(){
  return new Promise(function(fin){
    var n = 0;
    (function essai(){
      var sel = $("gs-classe");
      if ((sel && sel.options.length) || n++ > 40) return fin();
      setTimeout(essai, 100);
    })();
  });
}

function lireLigne(id){
  // Déjà dans la liste de Préparer (le cas courant : on vient d'elle) : on la
  // relit sur sa classe, sans passer par la table.
  var deja = ligneDeListe(id);
  if (deja) {
    return lireSeances(seancesLues().classeId).then(function(){ return ligneDeListe(id) || deja; });
  }
  return lireAvecPlanning("id,classe_id,numero,titre,nature,jalons,echeance,duree_min,ouverte,publiee," +
    "demarree_le,module_id,controle_ouvert", function(c){ return sb.from("seances").select(c).eq("id", Number(id)); })
    .then(function(r){
      var x = r && !r.error && (r.data || []).filter(function(y){ return String(y.id) === String(id); })[0];
      if (!x) return null;
      return attendreClasses().then(function(){
        var sel = $("gs-classe");
        if (sel && sel.querySelector('option[value="' + x.classe_id + '"]')) sel.value = String(x.classe_id);
        return lireSeances(x.classe_id);
      }).then(function(){ return ligneDeListe(id) || x; });
    });
}

// seances_de_classe() ne rend pas la classe de chaque ligne : on la pose.
function ligneDeListe(id){
  var l = seancesLues();
  var s = l && l.liste.filter(function(x){ return String(x.id) === String(id); })[0];
  return s ? Object.assign({ classe_id: l.classeId }, s) : null;
}

function ongletParDefaut(s){
  var e = etatDe(s).code;
  if (["en_cours", "ouverte", "oubliee", "ouvert", "cache", "appel", "propose"].indexOf(e) >= 0) return "direct";
  if (e === "terminee" || e === "clos") return "bilan";
  return Number(s.numero) >= 90 ? "direct" : "preparer";
}

// ── Ouvrir la page ───────────────────────────────────────────────────────
function ouvrirPage(id, onglet, sous){
  erreur("err-sp", "");
  // Même séance : on change d'onglet sans relire.
  if (courante && courante.id === String(id)) {
    return montrerOnglet(ONGLETS_S.indexOf(onglet) >= 0 ? onglet : courante.onglet, sous);
  }
  courante = { id: String(id), s: null, classeId: null, onglet: onglet };
  montrerPage(id, ONGLETS_S.indexOf(onglet) >= 0 ? onglet : "preparer", "Séance");
  $("sp-titre").textContent = "Chargement…";
  $("sp-resume").hidden = true;
  ONGLETS_S.forEach(function(k){ $("sp-" + k).hidden = true; });
  return lireLigne(id).then(function(s){
    if (!courante || courante.id !== String(id)) return;      // on est parti entre-temps
    if (!s) {
      $("sp-titre").textContent = "Séance introuvable";
      $("sp-fil").innerHTML = "";
      erreur("err-sp", "Cette séance n'existe pas, ou plus. Elle a pu être supprimée depuis le lien.");
      return;
    }
    courante.s = s;
    courante.classeId = String(s.classe_id);
    return montrerOnglet(ONGLETS_S.indexOf(onglet) >= 0 ? onglet : ongletParDefaut(s), sous);
  });
}

function montrerOnglet(o, sous){
  var c = courante;
  if (!c || !c.s) return Promise.resolve();
  if (Number(c.s.numero) >= 90) o = "direct";       // un questionnaire ou l'appel : son direct seulement
  c.onglet = o;
  ONGLETS_S.forEach(function(k){
    var b = $("spb-" + k), actif = k === o;
    b.classList.toggle("actif", actif);
    b.setAttribute("aria-selected", actif ? "true" : "false");
    b.tabIndex = actif ? 0 : -1;
    b.hidden = Number(c.s.numero) >= 90 && k !== "direct";
    $("sp-" + k).hidden = !actif;
  });
  montrerPage(c.id, o, "Séance " + c.s.numero);
  rendreTete();
  if (o === "preparer") {
    heberger("gs-fiche", $("sp-preparer"));
    ouvrirFormulaire(ligneDeListe(c.id) || c.s, sous || "infos", true);
    return Promise.resolve();
  }
  if (o === "direct") {
    heberger("carte-suivi", $("sp-direct"));
    if (VUES.indexOf(sous) >= 0) ouvrirVue(sous);
    if (String(suivi.seanceId) === c.id) return Promise.resolve();
    var sel = $("pk-classe");
    if (sel) sel.value = c.classeId;
    return chargerSeancesDe(c.classeId, c.id);
  }
  return rendreBilan(c.s, $("sp-bilan-corps"), {
    compteRendu: function(){ allerSeance(c.id, "direct", "fin"); },
    carnet: function(){ allerAuCarnet(c.classeId); }
  });
}

function fermerPage(){
  courante = null;
  rendreChezSoi("gs-fiche");
  fermerFormulaire();
  rendreChezSoi("carte-suivi");
}

// ── L'en-tête : fil d'Ariane, titre, état, gestes, voisines ──────────────
function rendreTete(){
  var c = courante, s = c.s, e = etatDe(s);
  var l = seancesLues(), ol = $("sp-fil");
  ol.innerHTML = "";
  var m = MOMENT[c.onglet];
  ol.appendChild(maillon(m[0], m[1]));
  var nomClasse = "";
  var opt = $("gs-classe") && $("gs-classe").querySelector('option[value="' + c.classeId + '"]');
  if (opt) nomClasse = opt.textContent;
  if (nomClasse) ol.appendChild(maillon(nomClasse, "#quest"));
  var mod = l && l.modules && String(l.classeId) === c.classeId && l.modules.filter(function(x){
    return String(x.id) === String(s.module_id); })[0];
  if (mod) ol.appendChild(maillon((mod.icone ? mod.icone + " " : "") + mod.titre.split(" — ")[0], null));
  var ici = maillon("Séance " + s.numero, null);
  ici.setAttribute("aria-current", "page");
  ol.appendChild(ici);

  $("sp-titre").textContent = typo(s.numero + " — " + s.titre);
  var bd = $("sp-badge");
  bd.className = "badge " + e.ton;
  bd.textContent = e.libelle;
  // En direct, l'en-tête collant de la carte dit déjà l'état, le chrono et
  // le geste : la page n'en garde que le fil, le titre et ses onglets.
  $("sp-resume").hidden = c.onglet === "direct";
  bd.hidden = c.onglet === "direct";
  $("sp-quand").textContent = quandDe(s);
  rendreEtapes($("sp-etapes"), s);
  $("sp-cycle-l").hidden = $("sp-etapes").hidden;
  rendreGestesPage(s);
  rendreVoisines(s);
}

function maillon(texte, lien){
  var li = document.createElement("li");
  if (lien) {
    var a = document.createElement("a");
    a.href = lien;
    a.textContent = typo(texte);
    li.appendChild(a);
  } else {
    li.textContent = typo(texte);
  }
  return li;
}

function quandDe(s){
  var bouts = [];
  if (s.prevue_le) {
    bouts.push("Prévue " + quandLisible(s.prevue_le, s.fin_prevue));
    var auto = [];
    if (s.auto_ouvrir) auto.push("ouverture");
    if (s.auto_clore) auto.push("clôture");
    if (auto.length) bouts.push(auto.join(" et ") + " automatiques");
  } else if (!s.demarree_le && Number(s.numero) < 90) {
    bouts.push("Pas encore programmée");
  }
  if (s.demarree_le) bouts.push("démarrée " + quandLisible(s.demarree_le));
  return bouts.join(" · ");
}

// Le geste qu'appelle l'état, sur les onglets Préparer et Bilan (En direct,
// la carte a le sien) ; et Dupliquer, toujours.
function gestesDe(s){
  var e = etatDe(s).code, g = [];
  if (Number(s.numero) >= 90) return g;
  if (s.nature === "projet") {
    // Ouvrir est LE geste d'un projet prêt ; d'un projet clos, une exception.
    if (!s.ouverte) g.push({ cle: "ouvrir", libelle: "Ouvrir", principal: e === "prete" || e === "programmee" });
    if (e === "cache") g.push({ cle: "montrer", libelle: "Rendre visible", principal: true });
    if (s.ouverte) g.push({ cle: "clore", libelle: "Clore" });
  } else {
    if (e === "prete" || e === "programmee") g.push({ cle: "demarrer", libelle: "Démarrer", principal: true });
    if (s.ouverte) g.push({ cle: "clore", libelle: "Clore", principal: e === "oubliee" });
  }
  g.push({ cle: "dupliquer", libelle: "Dupliquer" });
  return g;
}

function rendreGestesPage(s){
  var z = $("sp-actes");
  z.innerHTML = "";
  gestesDe(s).forEach(function(g){
    var b = document.createElement("button");
    b.type = "button";
    b.className = g.principal ? "btn" : "btn btn-sec";
    b.textContent = g.libelle;
    b.dataset.geste = g.cle;
    b.addEventListener("click", function(){ faireDepuisPage(g.cle, s, b); });
    z.appendChild(b);
  });
}

function rendreVoisines(s){
  var l = seancesLues();
  var liste = (l && String(l.classeId) === String(s.classe_id) ? l.liste : []).slice()
    .sort(function(a, b){ return a.numero - b.numero; });
  var i = liste.map(function(x){ return String(x.id); }).indexOf(String(s.id));
  [["b-sp-prec", i - 1, "‹ Séance ", "Séance précédente : "], ["b-sp-suiv", i + 1, "Séance ", "Séance suivante : "]]
    .forEach(function(x){
      var b = $(x[0]), v = i >= 0 ? liste[x[1]] : null;
      b.hidden = !v;
      if (!v) return;
      b.textContent = x[0] === "b-sp-suiv" ? x[2] + v.numero + " ›" : x[2] + v.numero;
      b.setAttribute("aria-label", x[3] + v.numero + " — " + v.titre);
      b.onclick = function(){ allerSeance(v.id, courante ? courante.onglet : null); };
    });
}

// ── Les gestes ───────────────────────────────────────────────────────────
function faireDepuisPage(cle, s, b){
  erreur("err-sp", "");
  if (cle === "demarrer") {
    // Le geste même de l'en-tête du direct, sur la séance qu'on y charge.
    return allerSeance(s.id, "direct").then(function(){
      pilotage("demarrer_seance", "Séance démarrée : les réponses sont ouvertes, le chrono part.");
      toast("Séance " + s.numero + " démarrée : les réponses sont ouvertes, le chrono part.");
    });
  }
  if (cle === "dupliquer") return dupliquer(s, b);
  b.disabled = true;
  if (cle === "ouvrir") return ouvrirSeance(s.id).then(function(d){ apres(d, b, "Séance " + s.numero + " ouverte et visible."); });
  if (cle === "montrer") return montrerSeance(s.id, true).then(function(d){ apres(d, b, "Séance " + s.numero + " visible."); });
  if (cle === "clore") {
    toast("La séance " + s.numero + " va être close : plus aucune réponse ne sera acceptée.", {
      apres: function(){
        fermerSeance(s.id).then(function(d){ apres(d, b, "Séance " + s.numero + " close. Les réponses déjà données restent."); });
      },
      annuler: function(){ b.disabled = false; toast("Clôture annulée. La séance reste ouverte."); }
    });
  }
}

function apres(d, b, message){
  b.disabled = false;
  if (!d || !d.ok) { erreur("err-sp", d && d.detail ? d.detail : texteRefus(d)); return; }
  toast(message);
  document.dispatchEvent(new Event("tdc-seance-changee"));
  relirePage();
}

// Une copie naît fermée et cachée ; on l'ouvre sur Préparer, où l'on
// corrige son titre — et son contrôle d'entrée, qui portait sur ce qui
// précédait l'original.
function dupliquer(s, b){
  b.disabled = true;
  return sb.rpc("dupliquer_seance", { p_seance_id: Number(s.id) }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) { erreur("err-sp", texteRefus(r)); return; }
    toast("Copie créée : séance " + d.numero + ", fermée et cachée" +
          (d.notions ? ". Son contrôle d'entrée est recopié, éteint : à relire." : "."));
    document.dispatchEvent(new Event("tdc-seance-changee"));
    return allerSeance(d.id, "preparer");
  });
}

// Après un geste de la page : la liste relue, l'en-tête redessiné.
function relirePage(){
  if (!courante || !courante.classeId) return Promise.resolve();
  var id = courante.id;
  return lireSeances(courante.classeId).then(function(){
    if (!courante || courante.id !== id) return;
    courante.s = ligneDeListe(id) || courante.s;
    montrerOnglet(courante.onglet);
  });
}

function allerAuCarnet(classeId){
  ouvrirOnglet("ensemble");
  var sel = $("cn-classe");
  if (sel && sel.querySelector('option[value="' + classeId + '"]')) {
    sel.value = String(classeId);
    sel.dispatchEvent(new Event("change"));
  }
  var c = $("carte-carnet");
  if (c && c.scrollIntoView) c.scrollIntoView({ block: "start" });
}

// ── Branchements ─────────────────────────────────────────────────────────
function brancherPageSeance(){
  if (!$("volet-seance") || $("volet-seance").dataset.branche) return;
  $("volet-seance").dataset.branche = "oui";
  brancherPage({ ouvrir: ouvrirPage, quitter: fermerPage });

  ONGLETS_S.forEach(function(o, i){
    var b = $("spb-" + o);
    b.addEventListener("click", function(){ if (courante) allerSeance(courante.id, o, null, "remplacer"); });
    b.addEventListener("keydown", function(e){
      var d = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
      if (!d || !courante) return;
      e.preventDefault();
      var visibles = ONGLETS_S.filter(function(k){ return !$("spb-" + k).hidden; });
      var k = visibles[(visibles.indexOf(o) + d + visibles.length) % visibles.length];
      allerSeance(courante.id, k, null, "remplacer").then(function(){ $("spb-" + k).focus(); });
    });
  });

  // La fiche s'ouvre sur une autre séance (après l'enregistrement d'une
  // séance neuve, par exemple) : la page la suit.
  document.addEventListener("tdc-fiche-ouverte", function(e){
    var p = pageOuverte();
    if (!courante || !p || p.onglet !== "preparer" || !e.detail || !e.detail.id) return;
    var s = ligneDeListe(e.detail.id);
    if (!s) return;
    if (String(e.detail.id) !== courante.id) {
      courante.id = String(e.detail.id);
      try { history.replaceState(null, "", "#s/" + courante.id + "/preparer"); } catch (x) {}
    }
    courante.s = s;
    rendreTete();
    montrerPage(courante.id, "preparer", "Séance " + s.numero);
  });

  // Une autre séance choisie dans la carte du direct (« Changer », Ctrl+K) :
  // la page la suit, son adresse aussi.
  document.addEventListener("tdc-seance-suivie", function(e){
    var p = pageOuverte();
    if (!courante || !p || p.onglet !== "direct" || !e.detail || String(e.detail.id) === courante.id) return;
    var id = String(e.detail.id);
    courante.id = id;
    try { history.replaceState(null, "", "#s/" + id + "/direct"); } catch (x) {}
    lireLigne(id).then(function(s){
      if (!s || !courante || courante.id !== id) return;
      courante.s = s;
      courante.classeId = String(s.classe_id);
      rendreTete();
      montrerPage(id, "direct", "Séance " + s.numero);
    });
  });

  // Un geste ailleurs (l'agenda, la liste, l'automate) : l'en-tête se relit
  // sur la liste déjà relue par qui a fait le geste.
  document.addEventListener("tdc-seance-changee", function(){
    if (!courante || !courante.s) return;
    var s = ligneDeListe(courante.id);
    if (s) { courante.s = s; rendreTete(); }
  });
}
brancherPageSeance();

export { ouvrirPage, fermerPage, gestesDe, ongletParDefaut };
