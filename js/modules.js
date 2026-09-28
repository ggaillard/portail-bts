// ── Les modules : le contenu s'organise par module ────────────────────────
//
// Depuis le 28/09. Un module appartient à une classe et porte son dépôt
// GitHub (obligatoire), son dépôt enseignant et son site (facultatifs). Une
// séance de cours ou de projet se range dans un module de sa classe.
//
//   · CÔTÉ ÉTUDIANT, « Vos projets » se lit module par module : pour chacun,
//     le cours en ligne quand il y en a un, et le dépôt. `mes_modules()` ne
//     livre jamais le dépôt enseignant — c'est la base qui décide de ce qui
//     sort, pas cette page. Tant que la fonction n'est pas déployée, on
//     revient à la table `projets`, comme avant.
//
//   · CÔTÉ ENSEIGNANT, la carte « Les modules, par classe » (onglet Le
//     semestre) les liste avec leurs trois liens et leur nombre de séances,
//     dit combien de séances restent à ranger, et permet de créer ou régler
//     un module. Ranger une séance se fait dans la carte « Les séances »,
//     en la modifiant : une séance se range en la regardant.
//
// Les modules ne sont lus qu'une fois par ouverture (`lireModules()`), et la
// carte « Les séances » s'en sert pour grouper ses lignes. Après un
// enregistrement, on relit, puis on prévient la carte des séances.

import { $, sb, erreur, typo, classesReelles } from './socle.js';
import { carte, afficherProjets, rendreProjetsParClasse } from './ensemble.js';

let apres = function(){};
export function brancherModules(liens){ apres = (liens && liens.apres) || apres; }

let promesse = null;
let classesEns = [];

// Rend la liste `classes` de modules_enseignant(), ou null si la fonction
// n'est pas déployée — auquel cas chaque carte se comporte comme avant.
function lireModules(forcer){
  if (!promesse || forcer) {
    // Un échec ne se garde pas en mémoire : lu avant la connexion enseignante,
    // il aurait condamné toutes les lectures suivantes à « pas de modules ».
    var p = promesse = sb.rpc("modules_enseignant").then(function(r){
      if (!r || r.error || !r.data || !r.data.ok || !Array.isArray(r.data.classes)) {
        if (promesse === p) promesse = null;
        return null;
      }
      return r.data.classes;
    }, function(){ if (promesse === p) promesse = null; return null; });
  }
  return promesse;
}

function modulesDe(liste, classeId){
  if (!liste) return null;
  var c = liste.filter(function(x){ return String(x.classe_id) === String(classeId); })[0];
  return c ? c.modules : [];
}

// Les liens d'un module, dans l'ordre où on les ouvre : le cours, puis le
// dépôt. Le dépôt enseignant n'est ajouté que si on le demande — côté
// enseignant — et `mes_modules()` ne le livre de toute façon pas.
function liensDe(m, avecEnseignant){
  var l = [];
  if (m.site) l.push({ url: m.site, icone: "🌐", titre: "Le cours en ligne",
                       description: m.site.replace(/^https:\/\//, "").replace(/\/$/, "") });
  l.push({ url: m.depot, icone: "GIT", titre: "Le dépôt GitHub",
           description: m.depot.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "") });
  if (avecEnseignant && m.depot_enseignant) {
    l.push({ url: m.depot_enseignant, icone: "🔒", titre: "Le dépôt enseignant",
             description: m.depot_enseignant.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "") });
  }
  return l;
}

function blocModule(m, avecEnseignant){
  var b = document.createElement("section");
  b.className = "md-bloc";
  b.dataset.module = m.code;
  var h = document.createElement("h3");
  h.className = "md-titre";
  h.innerHTML = '<span class="md-ico" aria-hidden="true"></span><span class="md-nom"></span>';
  h.querySelector(".md-ico").textContent = m.icone || "📦";
  h.querySelector(".md-nom").textContent = typo(m.titre);
  b.appendChild(h);
  if (m.description) {
    var d = document.createElement("p");
    d.className = "md-desc";
    d.textContent = typo(m.description);
    b.appendChild(d);
  }
  var g = document.createElement("div");
  g.className = "projets";
  liensDe(m, avecEnseignant).forEach(function(p){ g.appendChild(carte(p)); });
  b.appendChild(g);
  return b;
}

// ── Côté étudiant ────────────────────────────────────────────────────────
function chargerModulesEtu(classeId){
  return sb.rpc("mes_modules").then(function(r){
    var liste = r && !r.error && r.data && r.data.ok && r.data.liste;
    if (liste && liste.length) { rendreModulesEtu(liste); return; }
    return repliProjets(classeId);
  }, function(){ return repliProjets(classeId); });
}

function repliProjets(classeId){
  return sb.from("projets").select("titre,description,url,icone,ordre")
    .eq("classe_id", classeId).order("ordre")
    .then(function(r){ afficherProjets("mes-projets", r.data); });
}

function rendreModulesEtu(liste){
  var z = $("mes-projets");
  z.innerHTML = "";
  z.classList.add("md-etu");
  liste.forEach(function(m){ z.appendChild(blocModule(m, false)); });
}

// ── Côté enseignant ──────────────────────────────────────────────────────
function chargerModules(classes){
  classesEns = classes || [];
  return lireModules(true).then(function(liste){
    if (!liste) return repliProjetsEns();
    rendreModules(liste);
  });
}

// La fonction n'est pas déployée : la carte d'avant, telle quelle.
function repliProjetsEns(){
  return sb.from("projets").select("titre,description,url,icone,ordre,classe_id")
    .order("classe_id").order("ordre")
    .then(function(rp){ rendreProjetsParClasse(classesEns, rp.data || []); });
}

function rendreModules(liste){
  var z = $("tous-projets");
  var titre = $("md-carte-titre");
  if (titre) titre.textContent = "Les modules, par classe";
  var aide = $("md-carte-hint");
  if (aide) aide.textContent = "Un module appartient à une classe et a son dépôt GitHub. " +
    "Ses étudiants le trouvent dans « Vos projets » ; ses séances se rangent " +
    "dans la carte « Les séances », en les modifiant.";
  // Le formulaire a pu être déplacé sous une classe : on le remet au bas de
  // la carte avant de vider la liste, qui l'emporterait sinon avec elle.
  var f = $("f-md");
  if (f) { $("carte-modules").appendChild(f); f.hidden = true; }
  z.innerHTML = "";
  var reelles = classesReelles(liste.map(function(c){
    return { id: c.classe_id, code: c.code, nom: c.nom, modules: c.modules, sans_module: c.sans_module };
  }));
  if (!reelles.length) {
    z.innerHTML = '<p class="hint" style="margin:0">Aucune classe.</p>';
    return;
  }
  reelles.forEach(function(c){
    var h = document.createElement("h3");
    h.className = "sous-titre";
    h.textContent = c.nom;
    z.appendChild(h);

    var code = document.createElement("p");
    code.className = "sous-hint";
    var n = c.modules.length;
    code.textContent = c.code + (n ? " — " + n + (n > 1 ? " modules" : " module") : "");
    z.appendChild(code);

    // Ce qui reste à ranger se dit à sa place, sous la classe. Un zéro ne
    // s'affiche pas : il se lirait comme une alerte.
    if (c.sans_module > 0) {
      var r = document.createElement("p");
      r.className = "md-reste";
      r.textContent = c.sans_module + (c.sans_module > 1
        ? " séances ne sont rangées dans aucun module" : " séance n'est rangée dans aucun module") +
        " — à ranger dans « Les séances ».";
      z.appendChild(r);
    }

    if (!n) {
      var vide = document.createElement("p");
      vide.className = "hint";
      vide.textContent = "Aucun module : ses étudiants s'identifient puis ne trouvent aucun support à ouvrir.";
      z.appendChild(vide);
    }
    c.modules.forEach(function(m){
      var b = blocModule(m, true);
      var pied = document.createElement("div");
      pied.className = "md-pied";
      pied.innerHTML = '<span class="md-meta"></span>' +
        '<button class="qa-b md-b" type="button">Modifier</button>';
      pied.querySelector(".md-meta").textContent = m.code + " · " +
        (m.seances ? m.seances + (m.seances > 1 ? " séances" : " séance") : "aucune séance");
      pied.querySelector(".md-b").setAttribute("aria-label", "Modifier le module " + m.titre);
      pied.querySelector(".md-b").addEventListener("click", function(){ ouvrirModule(c, m); });
      b.appendChild(pied);
      z.appendChild(b);
    });
    var neuf = document.createElement("button");
    neuf.className = "btn btn-sec md-neuf";
    neuf.type = "button";
    neuf.textContent = "Nouveau module";
    neuf.dataset.classe = c.id;
    neuf.setAttribute("aria-label", "Nouveau module pour " + c.nom);
    neuf.addEventListener("click", function(){ ouvrirModule(c, null); });
    z.appendChild(neuf);
  });
}

// ── Le formulaire ────────────────────────────────────────────────────────
// Un seul, déplacé sous la classe dont on parle : ouvert en bas de la carte,
// il se retrouvait à deux écrans du bouton qui l'avait ouvert.
var CHAMPS = ["code", "titre", "description", "icone", "depot", "depot_enseignant", "site"];

function ouvrirModule(c, m){
  var f = $("f-md");
  if (!f) return;
  var ancre = m ? document.querySelector('.md-bloc[data-module="' + m.code + '"]') : null;
  var z = $("tous-projets");
  // Après le module qu'on modifie, ou après le bouton « Nouveau module ».
  var apresQui = ancre || z.querySelector('.md-neuf[data-classe="' + c.id + '"]');
  if (apresQui && apresQui.parentNode) apresQui.parentNode.insertBefore(f, apresQui.nextSibling);
  f.hidden = false;
  f.dataset.id = m ? m.id : "";
  f.dataset.classe = c.id;
  $("md-f-titre").textContent = m ? "Modifier « " + m.titre + " »" : "Nouveau module — " + c.nom;
  CHAMPS.forEach(function(k){ $("md-" + k.replace("_", "-")).value = m && m[k] ? m[k] : ""; });
  $("md-ordre").value = m ? m.ordre : "";
  // Supprimer n'est offert qu'à un module vide : la base refuserait sinon,
  // et un bouton qui échoue à coup sûr n'a rien à faire là.
  var sup = $("b-md-suppr");
  sup.hidden = !m;
  sup.disabled = !!(m && m.seances);
  $("md-suppr-note").textContent = m && m.seances
    ? "Il porte " + m.seances + (m.seances > 1 ? " séances" : " séance") +
      " : les ranger ailleurs avant de le supprimer." : "";
  erreur("err-md", "");
  $("md-titre").focus();
}

function fermerModule(){
  var f = $("f-md");
  if (f) f.hidden = true;
}

function enregistrerModule(){
  var f = $("f-md");
  var b = $("b-md-ok");
  var v = {};
  CHAMPS.forEach(function(k){ v[k] = $("md-" + k.replace("_", "-")).value; });
  b.disabled = true;
  sb.rpc("enregistrer_module", {
    p_module_id: f.dataset.id ? Number(f.dataset.id) : null,
    p_classe_id: Number(f.dataset.classe),
    p_code: v.code, p_titre: v.titre, p_description: v.description, p_icone: v.icone,
    p_depot: v.depot, p_depot_enseignant: v.depot_enseignant, p_site: v.site,
    p_ordre: $("md-ordre").value === "" ? null : Number($("md-ordre").value)
  }).then(function(r){
    b.disabled = false;
    if (r.error || !r.data || !r.data.ok) {
      erreur("err-md", (r.data && r.data.detail) ||
        (r.data && r.data.motif === "refus" ? "Réservé à l'enseignant." :
         "Le module n'a pas été enregistré."));
      return;
    }
    var cree = r.data.cree;
    relire(cree ? "Module créé." : "Module enregistré.");
  });
}

function supprimer(){
  var f = $("f-md");
  var b = $("b-md-suppr");
  b.disabled = true;
  sb.rpc("supprimer_module", { p_module_id: Number(f.dataset.id) }).then(function(r){
    b.disabled = false;
    if (r.error || !r.data || !r.data.ok) {
      erreur("err-md", (r.data && r.data.detail) || "Le module n'a pas été supprimé.");
      return;
    }
    relire("Module supprimé.");
  });
}

function relire(message){
  lireModules(true).then(function(liste){
    if (liste) rendreModules(liste);
    erreur("err-md-liste", message, true);
    apres();
  });
}

function brancherFormulaire(){
  var f = $("f-md");
  if (!f || f.dataset.branche) return;
  f.dataset.branche = "oui";
  f.addEventListener("submit", function(e){ e.preventDefault(); enregistrerModule(); });
  $("b-md-annuler").addEventListener("click", fermerModule);
  $("b-md-suppr").addEventListener("click", supprimer);
}
brancherFormulaire();

export { lireModules, modulesDe, chargerModulesEtu, rendreModulesEtu,
         chargerModules, rendreModules, liensDe };
