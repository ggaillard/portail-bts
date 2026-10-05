// ── Aller à une séance : une liste qu'on cherche ──────────────────────────
//
// Lot 1 des propositions du 05/10, item 1.6. Relevé ce jour-là : choisir une
// séance, c'était « Changer ▾ », puis une liste native de classes, puis une
// liste native de séances — dix-sept entrées pour le BTS1, sans recherche,
// sans module, où les séances 1 à 14 côtoyaient les questionnaires (90-98)
// et l'appel (99). Quatre gestes quand En cours montrait une autre séance.
//
// Désormais un seul champ, motif *Combobox* des ARIA Authoring Practices
// (liste groupée, `aria-activedescendant`) :
//
//   · on tape « 11 », « IA », « BTS2 », « où vit » — numéro, titre, classe ou
//     module, sans se soucier des accents ;
//   · la liste est rangée classe › module, chaque ligne avec son ÉTAT (en
//     cours, ouverte, oubliée ouverte, terminée, fermée, cachée) ;
//   · les RÉCENTES d'abord — les cinq dernières choisies, gardées dans ce
//     navigateur — et les questionnaires et l'appel À PART, en fin de liste ;
//   · ↑ ↓ pour circuler, Entrée pour choisir, Échap pour fermer ; Ctrl+K y
//     mène de partout (js/raccourcis.js).
//
// Les deux listes natives restent, repliées sous « Par classe, puis séance » :
// tout le reste du portail lit encore `pk-classe` et `pk-seance`, et ce
// module passe par elles (`chargerSeancesDe`) plutôt que de les contourner.

import { $, sb, suivi, typo } from './socle.js';
import { lireModules } from './modules.js';
import { chargerSeancesDe } from './seance.js';
import { seanceOubliee } from './ouverture.js';

var CLE_RECENTES = "tdc-seances-recentes";
var MAX_OPTIONS = 80;
var donnees = null;         // { seances, classes, modules } — relues à chaque ouverture
var visibles = [];          // les options affichées, dans l'ordre
var active = -1;

function sansAccents(t){
  return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function lireRecentes(){
  try { return JSON.parse(localStorage.getItem(CLE_RECENTES) || "[]").map(String); } catch (e) { return []; }
}
function noterRecente(id){
  var l = lireRecentes().filter(function(x){ return x !== String(id); });
  l.unshift(String(id));
  try { localStorage.setItem(CLE_RECENTES, JSON.stringify(l.slice(0, 5))); } catch (e) {}
}

// L'état en un mot — la même lecture que l'en-tête de la séance.
function etatCourt(s){
  if (Number(s.numero) >= 90) return s.ouverte ? "proposé" : "éteint";
  if (s.nature === "projet") return s.ouverte ? (s.publiee === false ? "ouvert, caché" : "ouvert") : "fermé";
  if (seanceOubliee(s)) return "oubliée ouverte";
  if (s.ouverte && s.demarree_le) return "en cours";
  if (s.ouverte) return "ouverte";
  if (s.demarree_le) return "terminée le " + new Date(s.demarree_le).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return s.publiee ? "fermée" : "fermée, cachée";
}

// Les classes : celles du sélecteur natif, qui sait déjà ranger les démos.
function classesDuSelecteur(){
  var sel = $("pk-classe"), l = [];
  if (!sel) return l;
  [].forEach.call(sel.options, function(o){
    if (o.value) l.push({ id: String(o.value), nom: o.textContent, demo: !!(o.parentNode && o.parentNode.tagName === "OPTGROUP") });
  });
  return l;
}

function charger(){
  return Promise.all([
    sb.from("seances").select("id,classe_id,numero,titre,ouverte,publiee,demarree_le,duree_min,nature,module_id")
      .order("numero"),
    lireModules()
  ]).then(function(rr){
    var mods = {};
    (rr[1] || []).forEach(function(c){ (c.modules || []).forEach(function(m){
      mods[String(m.id)] = { titre: (m.icone ? m.icone + " " : "") + m.titre.split(" — ")[0], ordre: m.ordre || 0 };
    }); });
    donnees = { seances: (rr[0] && rr[0].data) || [], classes: classesDuSelecteur(), modules: mods };
    return donnees;
  });
}

// Les groupes, dans l'ordre où on les lit : récentes, puis chaque classe
// module par module, puis ce qui n'est pas une séance (90-99), à part.
function groupesDeSeances(q){
  var d = donnees || { seances: [], classes: [], modules: {} };
  var nomClasse = {};
  d.classes.forEach(function(c){ nomClasse[c.id] = c.nom; });
  var cle = function(s){
    var m = d.modules[String(s.module_id)];
    return sansAccents([s.numero, s.titre, nomClasse[String(s.classe_id)] || "", m ? m.titre : ""].join(" "));
  };
  var mots = sansAccents(q).split(/\s+/).filter(Boolean);
  var garde = function(s){
    if (!nomClasse[String(s.classe_id)]) return false;
    var k = cle(s);
    return mots.every(function(m){ return k.indexOf(m) >= 0; });
  };
  var sel = d.seances.filter(garde);
  var out = [];

  var rec = lireRecentes().map(function(id){ return sel.filter(function(s){ return String(s.id) === id; })[0]; })
    .filter(Boolean);
  if (!mots.length && rec.length) out.push({ titre: "Récentes", liste: rec, avecClasse: true });

  d.classes.forEach(function(c){
    var ici = sel.filter(function(s){ return String(s.classe_id) === c.id && Number(s.numero) < 90; });
    var parModule = {};
    ici.forEach(function(s){ (parModule[String(s.module_id || "")] = parModule[String(s.module_id || "")] || []).push(s); });
    Object.keys(parModule).sort(function(a, b){
      var ma = d.modules[a], mb = d.modules[b];
      return (ma ? ma.ordre : 999) - (mb ? mb.ordre : 999);
    }).forEach(function(k){
      var m = d.modules[k];
      out.push({ titre: c.nom + " › " + (m ? m.titre : "Sans module"), liste: parModule[k] });
    });
  });
  var autres = sel.filter(function(s){ return Number(s.numero) >= 90; });
  if (autres.length) out.push({ titre: "Questionnaires et appel", liste: autres, avecClasse: true });
  return { groupes: out, nomClasse: nomClasse };
}

function rendre(){
  var z = $("cs-liste"), q = $("cs-saisie").value;
  var g = groupesDeSeances(q);
  z.innerHTML = "";
  visibles = [];
  var n = 0;
  g.groupes.forEach(function(gr, i){
    if (n >= MAX_OPTIONS) return;
    var ul = document.createElement("ul");
    ul.setAttribute("role", "group");
    var t = document.createElement("li");
    t.setAttribute("role", "presentation");
    t.className = "cs-g";
    t.id = "cs-g" + i;
    t.textContent = typo(gr.titre);
    ul.setAttribute("aria-labelledby", t.id);
    ul.appendChild(t);
    gr.liste.forEach(function(s){
      if (n >= MAX_OPTIONS) return;
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.id = "cs-o" + n;
      li.className = "cs-o";
      li.setAttribute("aria-selected", "false");
      var a = document.createElement("span");
      a.className = "cs-t";
      a.textContent = typo(s.numero + " — " + s.titre) +
        (gr.avecClasse ? " · " + (g.nomClasse[String(s.classe_id)] || "") : "");
      var e = document.createElement("span");
      e.className = "cs-e";
      e.textContent = etatCourt(s);
      li.appendChild(a); li.appendChild(e);
      if (String(s.id) === String(suivi.seanceId)) li.classList.add("cs-courante");
      li.addEventListener("mousedown", function(ev){ ev.preventDefault(); });   // garder le focus dans le champ
      li.addEventListener("click", function(){ choisir(s); });
      ul.appendChild(li);
      visibles.push({ s: s, li: li });
      n++;
    });
    z.appendChild(ul);
  });
  if (!visibles.length) {
    var v = document.createElement("p");
    v.className = "sous-hint cs-vide";
    v.textContent = donnees ? "Aucune séance ne correspond à « " + q + " »." : "Chargement…";
    z.appendChild(v);
  }
  $("cs-nb").textContent = visibles.length
    ? visibles.length + (visibles.length > 1 ? " séances" : " séance") + (visibles.length >= MAX_OPTIONS ? " (affinez la recherche)" : "")
    : "aucune séance";
  activer(visibles.length ? 0 : -1);
}

function activer(i){
  if (active >= 0 && visibles[active]) visibles[active].li.setAttribute("aria-selected", "false");
  active = i;
  var inp = $("cs-saisie");
  if (i < 0 || !visibles[i]) { inp.removeAttribute("aria-activedescendant"); return; }
  visibles[i].li.setAttribute("aria-selected", "true");
  inp.setAttribute("aria-activedescendant", visibles[i].li.id);
  if (visibles[i].li.scrollIntoView) visibles[i].li.scrollIntoView({ block: "nearest" });
}

function ouvrirChoixSeance(){
  var inp = $("cs-saisie");
  $("cs-liste").hidden = false;
  inp.setAttribute("aria-expanded", "true");
  rendre();
  return charger().then(rendre);
}

function fermerListe(){
  $("cs-liste").hidden = true;
  $("cs-saisie").setAttribute("aria-expanded", "false");
  $("cs-saisie").removeAttribute("aria-activedescendant");
}

function choisir(s){
  noterRecente(s.id);
  fermerListe();
  $("cs-saisie").value = "";
  var choix = $("sv-choix");
  if (choix) { choix.hidden = true; $("sv-fil").setAttribute("aria-expanded", "false"); }
  var sel = $("pk-classe");
  if (sel) sel.value = String(s.classe_id);
  return chargerSeancesDe(s.classe_id, s.id).then(function(){
    var f = $("sv-fil");
    if (f) f.focus();
  });
}

function brancherChoixSeance(){
  var inp = $("cs-saisie");
  if (!inp || inp.dataset.branche) return;
  inp.dataset.branche = "oui";
  inp.addEventListener("focus", function(){ if ($("cs-liste").hidden) ouvrirChoixSeance(); });
  // Quitter le champ ferme la liste ; un clic sur une option ne le quitte pas
  // (mousedown retenu plus haut), donc il choisit avant.
  inp.addEventListener("blur", function(){ setTimeout(fermerListe, 0); });
  inp.addEventListener("input", function(){ $("cs-liste").hidden = false; inp.setAttribute("aria-expanded", "true"); rendre(); });
  inp.addEventListener("keydown", function(e){
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if ($("cs-liste").hidden) { ouvrirChoixSeance(); return; }
      if (!visibles.length) return;
      var d = e.key === "ArrowDown" ? 1 : -1;
      activer((active + d + visibles.length) % visibles.length);
    } else if (e.key === "Home" && !$("cs-liste").hidden && visibles.length && !inp.value) {
      e.preventDefault(); activer(0);
    } else if (e.key === "End" && !$("cs-liste").hidden && visibles.length && !inp.value) {
      e.preventDefault(); activer(visibles.length - 1);
    } else if (e.key === "Enter") {
      if (active >= 0 && visibles[active]) { e.preventDefault(); choisir(visibles[active].s); }
    } else if (e.key === "Escape") {
      if (!$("cs-liste").hidden) { e.preventDefault(); e.stopPropagation(); fermerListe(); }
      else if (inp.value) { e.preventDefault(); inp.value = ""; }
    }
  });
}
brancherChoixSeance();

export { ouvrirChoixSeance, etatCourt, groupesDeSeances };
