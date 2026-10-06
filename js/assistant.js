// ── L'assistant « Nouveau module » ────────────────────────────────────────
//
// Lot 3 des propositions du 05/10 (06/10). Jusque-là, un module se montait
// par migration : le module, ses séances une à une, leur rangement, puis
// chaque séance ouverte pour y écrire missions ou concepts. Quatre étapes,
// dans un dialogue (motif Dialog des ARIA Authoring Practices, <dialog>
// natif : focus gardé, Échap ferme) :
//
//   1. LE DÉPÔT — l'adresse GitHub du cours ; le portail lit son mkdocs.yml
//      (titre, site, liste des séances). Un dépôt privé ou sans mkdocs.yml ne
//      se lit pas : on remplit à la main, rien ne bloque ;
//   2. LES SÉANCES — une par ligne, numéro puis titre, préremplies depuis le
//      sommaire du site ; creer_seances() les crée toutes ou aucune ;
//   3. LE PLANNING — programmer_seances() les pose à la suite sur les
//      créneaux libres de la classe, à partir d'une date (facultatif) ;
//   4. LES CONTENUS — la liste des séances créées, chacune avec le lien vers
//      l'onglet de sa page qui reste à écrire (missions, concepts, contrôle).
//
// Chaque étape ÉCRIT en passant à la suivante : fermer en route laisse ce qui
// est fait (un module sans séance, des séances sans date), visible et
// modifiable dans Préparer — rien n'est à moitié écrit en base.

import { $, sb, erreur, typo } from './socle.js';
import { lireModules, rendreModules } from './modules.js';
import { relireGestion } from './gestion.js';
import { allerSeance } from './navigation.js';
import { quandLisible } from './etat.js';
import { texteRefus } from './refus.js';
import { toast } from './toast.js';

var ETAPES = ["Le dépôt", "Les séances", "Le planning", "Les contenus"];
var etat = { pas: 1, module: null, seances: null, classeId: null };

// ── Lire un mkdocs.yml : le titre, le site, et les séances du sommaire ───
// Une entrée de sommaire est une séance si son titre commence par un numéro
// (« 3 — « 60, 47, 72 » ») ou si son chemin en porte un (seance-03.md,
// tp2.md). Le reste (Accueil, Progression…) n'en est pas.
// Pas de guillemet littéral dans une expression régulière (CLAUDE.md) : \x22 et \x27.
function sansGuillemets(x){ return String(x).trim().replace(/^([\x22\x27])(.*)\1$/, "$2"); }
function lireMkdocs(texte){
  var r = { titre: null, site: null, description: null, seances: [] };
  var dansNav = false;
  String(texte || "").split(/\r?\n/).forEach(function(l){
    var m;
    if ((m = /^site_name:\s*(.+?)\s*$/.exec(l))) r.titre = sansGuillemets(m[1]);
    else if ((m = /^site_url:\s*(\S+)/.exec(l))) r.site = sansGuillemets(m[1]);
    else if ((m = /^site_description:\s*(.+?)\s*$/.exec(l))) r.description = sansGuillemets(m[1]);
    if (/^nav:\s*$/.test(l)) { dansNav = true; return; }
    if (dansNav && /^\S/.test(l)) dansNav = false;
    if (!dansNav) return;
    m = /^\s*-\s*([\x22\x27]?)(.+?)\1\s*:\s*(\S+\.md)\s*$/.exec(l);
    if (!m) return;
    var titre = m[2].trim(), chemin = m[3];
    var n = /^(?:s[ée]ance\s*|tp\s*)?(\d{1,2})\s*[—–:.)-]\s*(.+)$/i.exec(titre);
    var numero = n ? Number(n[1]) : null;
    if (numero === null) {
      var p = /(?:seance|séance|tp)[-_ ]?0*(\d{1,2})\b/i.exec(chemin);
      if (p) numero = Number(p[1]);
    }
    if (numero === null || numero >= 90) return;
    r.seances.push({ numero: numero, titre: (n ? n[2] : titre).trim() });
  });
  return r;
}

function depotDe(url){
  var m = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(String(url || "").trim());
  return m ? { compte: m[1], depot: m[2] } : null;
}
function codeDuDepot(nom){
  return String(nom || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// ── Ouvrir, fermer, avancer ──────────────────────────────────────────────
function ouvrirAssistant(classeId){
  var d = $("as-dialog");
  if (!d) return;
  etat = { pas: 1, module: null, seances: null, classeId: null };
  var sel = $("as-classe"), src = $("gs-classe");
  sel.innerHTML = src ? src.innerHTML : "";
  sel.value = String(classeId || (src && src.value) || "");
  ["as-depot", "as-titre-m", "as-code", "as-icone", "as-site", "as-depot-ens", "as-description", "as-texte"]
    .forEach(function(id){ $(id).value = ""; });
  $("as-icone").value = "📦";
  $("as-nature").value = "cours";
  $("as-duree").value = "55";
  $("as-lu").textContent = "";
  $("as-depuis").value = new Date().toISOString().slice(0, 10);
  $("as-places").innerHTML = "";
  erreur("err-as", "");
  montrerPas(1);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  $("as-depot").focus();
}

function fermerAssistant(){
  var d = $("as-dialog");
  if (d && d.open) d.close();
}

function montrerPas(n){
  etat.pas = n;
  [1, 2, 3, 4].forEach(function(k){ $("as-pas-" + k).hidden = k !== n; });
  var ol = $("as-etapes");
  ol.innerHTML = "";
  ETAPES.forEach(function(nom, i){
    var li = document.createElement("li");
    li.className = "cycle-e" + (i + 1 < n ? " faite" : "") + (i + 1 === n ? " ici" : "");
    if (i + 1 === n) li.setAttribute("aria-current", "step");
    var m = document.createElement("span");
    m.className = "cycle-m";
    m.setAttribute("aria-hidden", "true");
    m.textContent = i + 1 < n ? "✓" : String(i + 1);
    li.appendChild(m);
    li.appendChild(document.createTextNode(nom));
    ol.appendChild(li);
  });
  $("b-as-prec").hidden = n === 1 || n === 4;
  $("b-as-suiv").textContent = ["", etat.module ? "Enregistrer, puis suivant ›" : "Créer le module ›",
                                etat.seances ? "Suivant ›" : "Créer les séances ›", "Suivant ›", "Terminer"][n];
  // Les séances créées ne se recréent pas : revenir en arrière les montre.
  $("as-texte").readOnly = !!etat.seances;
  $("as-nature").disabled = !!etat.seances;
  $("as-duree").disabled = !!etat.seances;
  if (n === 3) preparerPlanning();
  if (n === 4) rendreContenus();
}

function suivant(){
  erreur("err-as", "");
  var b = $("b-as-suiv");
  if (etat.pas === 1) { b.disabled = true; return creerModule().then(function(){ b.disabled = false; }); }
  if (etat.pas === 2) {
    if (etat.seances) { montrerPas(3); return Promise.resolve(); }
    b.disabled = true;
    return creerSeances().then(function(){ b.disabled = false; });
  }
  if (etat.pas === 3) { montrerPas(4); return Promise.resolve(); }
  fermerAssistant();
  return Promise.resolve();
}

// ── Étape 1 : le dépôt ───────────────────────────────────────────────────
function lireDepot(){
  var d = depotDe($("as-depot").value);
  if (!d) { $("as-lu").textContent = "Une adresse de la forme https://github.com/compte/depot."; return Promise.resolve(); }
  if (!$("as-code").value) $("as-code").value = codeDuDepot(d.depot);
  if (!$("as-site").value) $("as-site").value = "https://" + d.compte.toLowerCase() + ".github.io/" + d.depot + "/";
  $("as-lu").textContent = "Lecture de mkdocs.yml…";
  var url = "https://raw.githubusercontent.com/" + d.compte + "/" + d.depot + "/HEAD/mkdocs.yml";
  return fetch(url).then(function(r){ return r.ok ? r.text() : null; }, function(){ return null; }).then(function(t){
    if (!t) {
      $("as-lu").textContent = "Pas de mkdocs.yml lisible (dépôt privé, ou pas de site) : remplissez à la main.";
      return;
    }
    var m = lireMkdocs(t);
    if (m.titre && !$("as-titre-m").value) $("as-titre-m").value = m.titre;
    if (m.site) $("as-site").value = m.site;
    if (m.description && !$("as-description").value) $("as-description").value = m.description;
    if (m.seances.length && !$("as-texte").value) {
      $("as-texte").value = m.seances.map(function(s){ return s.numero + " — " + s.titre; }).join("\n");
    }
    $("as-lu").textContent = "Lu : « " + (m.titre || d.depot) + " », " + m.seances.length +
      (m.seances.length > 1 ? " séances au sommaire." : " séance au sommaire.");
  });
}

function creerModule(){
  var classe = Number($("as-classe").value);
  return sb.rpc("enregistrer_module", {
    p_module_id: etat.module ? Number(etat.module) : null,
    p_classe_id: classe,
    p_code: $("as-code").value.trim(), p_titre: $("as-titre-m").value.trim(),
    p_description: $("as-description").value.trim() || null, p_icone: $("as-icone").value.trim() || null,
    p_depot: $("as-depot").value.trim().replace(/\.git$/, ""),
    p_depot_enseignant: $("as-depot-ens").value.trim() || null,
    p_site: $("as-site").value.trim() || null, p_ordre: null
  }).then(function(r){
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) { erreur("err-as", "Le module n'a pas été créé. " + texteRefus(r)); return; }
    etat.module = d.id;
    etat.classeId = classe;
    lireModules(true).then(function(l){ if (l) rendreModules(l); });
    montrerPas(2);
    $("as-texte").focus();
  });
}

// ── Étape 2 : les séances ────────────────────────────────────────────────
function creerSeances(){
  return sb.rpc("creer_seances", {
    p_classe_id: etat.classeId, p_module_id: Number(etat.module), p_texte: $("as-texte").value,
    p_nature: $("as-nature").value, p_duree_min: $("as-duree").value === "" ? null : Number($("as-duree").value)
  }).then(function(r){
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) { erreur("err-as", "Aucune séance créée. " + texteRefus(r)); return; }
    etat.seances = d.liste;
    toast(d.creees + (d.creees > 1 ? " séances créées" : " séance créée") + ", fermées et cachées.");
    relireGestion();
    montrerPas(3);
  });
}

// ── Étape 3 : le planning ────────────────────────────────────────────────
function preparerPlanning(){
  $("as-edt").textContent = "";
  return sb.rpc("emploi_du_temps").then(function(r){
    var c = r && r.data && r.data.ok && (r.data.classes || []).filter(function(x){ return String(x.id) === String(etat.classeId); })[0];
    var n = c && c.creneaux ? c.creneaux.length : 0;
    $("b-as-programmer").disabled = !n;
    $("as-edt").textContent = n ? "La classe a " + n + (n > 1 ? " créneaux" : " créneau") + " par semaine dans l'emploi du temps."
      : "La classe n'a pas d'emploi du temps : programmez plus tard (Préparer › L'emploi du temps), cette étape se saute.";
  });
}

function programmer(){
  var b = $("b-as-programmer");
  b.disabled = true;
  return sb.rpc("programmer_seances", { p_ids: (etat.seances || []).map(function(s){ return Number(s.id); }),
                                         p_depuis: $("as-depuis").value || null }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) { erreur("err-as", texteRefus(r)); return; }
    var ul = $("as-places");
    ul.innerHTML = "";
    (d.programmees || []).forEach(function(x){
      var li = document.createElement("li");
      li.textContent = "Séance " + x.numero + " — " + quandLisible(x.prevue_le, x.fin_prevue);
      ul.appendChild(li);
    });
    (d.ecartees || []).forEach(function(x){
      var li = document.createElement("li");
      li.textContent = "Séance " + x.numero + " — pas programmée : " + x.detail;
      ul.appendChild(li);
    });
    document.dispatchEvent(new Event("tdc-seance-changee"));
    relireGestion();
  });
}

// ── Étape 4 : les contenus ───────────────────────────────────────────────
function rendreContenus(){
  var ul = $("as-contenus");
  ul.innerHTML = "";
  var projet = $("as-nature").value === "projet";
  (etat.seances || []).forEach(function(s){
    var li = document.createElement("li");
    var t = document.createElement("span");
    t.className = "as-c-t";
    t.textContent = typo(s.numero + " — " + s.titre);
    li.appendChild(t);
    [[projet ? "missions" : "concepts", projet ? "Missions ›" : "Concepts ›"], ["controle", "Contrôle ›"]].forEach(function(x){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn-discret";
      b.textContent = x[1];
      b.setAttribute("aria-label", x[1].replace(" ›", "") + " de la séance " + s.numero);
      b.addEventListener("click", function(){ fermerAssistant(); allerSeance(s.id, "preparer", x[0]); });
      li.appendChild(b);
    });
    ul.appendChild(li);
  });
}

function brancherAssistant(){
  var d = $("as-dialog");
  if (!d || d.dataset.branche) return;
  d.dataset.branche = "oui";
  if ($("b-gs-module")) $("b-gs-module").addEventListener("click", function(){ ouvrirAssistant(); });
  $("b-as-fermer").addEventListener("click", fermerAssistant);
  $("b-as-lire").addEventListener("click", lireDepot);
  $("as-depot").addEventListener("change", lireDepot);
  $("b-as-suiv").addEventListener("click", suivant);
  $("b-as-prec").addEventListener("click", function(){ if (etat.pas > 1) montrerPas(etat.pas - 1); });
  $("b-as-programmer").addEventListener("click", programmer);
}
brancherAssistant();

export { ouvrirAssistant, lireMkdocs, depotDe, codeDuDepot };
