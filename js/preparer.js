// ── Préparer une séance : la fiche liste + détail ─────────────────────────
//
// Depuis le 28/09. Une séance se RÈGLE ici, et plus dans l'écran du direct :
// ses informations (le formulaire de gestion.js), son contrôle d'entrée, ses
// concepts, ses missions. Le motif est celui des applications courantes —
// une liste à gauche, la fiche de l'élément choisi à droite, et sur un
// téléphone la fiche à la place de la liste, avec un retour.
//
// Deux choses qui ne se devinent pas :
//
//   · LA SÉANCE PRÉPARÉE N'EST PAS LA SÉANCE SUIVIE. `suivi.prep` porte la
//     première, `suivi.seanceId` la seconde. Préparer la séance 12 pendant
//     qu'on fait cours sur la 11 ne doit rien changer à l'écran du direct.
//     Les trois éditeurs (contrôle, concepts, missions) écrivent donc sur
//     `suivi.prep || suivi.seanceId`.
//   · LES ÉDITEURS SE PRÉREMPLISSENT AVEC CE QUI EST EN BASE, dans la syntaxe
//     même qu'ils attendent : on corrige une ligne au lieu de tout retaper.
//     Un contrôle déjà répondu ne se réécrit plus (la base le refuse) : la
//     fiche le dit avant qu'on essaie.
//
// En tête de la fiche, « Prête à démarrer ? » : la liste de ce qui manque,
// calculée depuis la base (preflight, contrôle, concepts, module).

import { $, sb, suivi, erreur, typo } from './socle.js';
import { lignesMissions } from './missions.js';
import { chargerQuestionnaires, texteRattachement } from './bibliotheque.js';

var ONGLETS_P = ["infos", "controle", "concepts", "missions"];
var courante = null;       // la ligne de seances_de_classe ouverte, ou null (nouvelle)

function ouvrirFichePrep(s, onglet){
  var f = $("gs-fiche");
  if (!f) return Promise.resolve();
  courante = s || null;
  suivi.prep = s ? s.id : null;
  f.hidden = false;
  $("gs-cadre").classList.add("fiche-ouverte");
  $("gs-fiche-titre").textContent = s ? "Séance " + s.numero + " — " + typo(s.titre) : "Nouvelle séance";

  // Une séance pas encore créée n'a que ses informations. Un cours n'a pas
  // de missions, un projet n'a pas de concepts (pas de quiz à débriefer).
  var projet = s && s.nature === "projet";
  $("gsb-controle").hidden = !s;
  $("gsb-concepts").hidden = !s || projet;
  $("gsb-missions").hidden = !s || !projet;
  if (!s || $("gsb-" + onglet) && $("gsb-" + onglet).hidden) onglet = "infos";
  choisirOnglet(onglet || "infos");

  ["ct-texte", "db-texte", "mi-texte"].forEach(function(id){
    var t = $(id); if (t) { t.value = ""; delete t.dataset.touche; }
  });
  ["err-ct-neuf", "err-db-neuf", "err-mi-neuf", "err-pr-ctl"].forEach(function(id){ erreur(id, ""); });
  $("gs-pret").innerHTML = "";
  $("gs-qn").hidden = true;
  if (!s) return Promise.resolve();
  lireQuestionnairesPrep(s);
  return lireEtat(s);
}

function fermerFichePrep(){
  var f = $("gs-fiche");
  if (!f) return;
  f.hidden = true;
  $("gs-cadre").classList.remove("fiche-ouverte");
  suivi.prep = null;
  courante = null;
}

function choisirOnglet(o, focus){
  ONGLETS_P.forEach(function(k){
    var b = $("gsb-" + k), p = $("gso-" + k), actif = k === o;
    b.classList.toggle("actif", actif);
    b.setAttribute("aria-selected", actif ? "true" : "false");
    b.tabIndex = actif ? 0 : -1;
    p.hidden = !actif;
  });
  if (focus) $("gsb-" + o).focus();
}

// ── Ce qui est en base : l'état, et le préremplissage ────────────────────
function lireEtat(s){
  var id = Number(s.id);
  return Promise.all([
    sb.rpc("preflight_seance", { p_seance_id: id }),
    sb.rpc("controle_seance", { p_seance_id: id }),
    s.nature === "projet" ? sb.rpc("grille_missions", { p_seance_id: id }) : sb.rpc("debriefing", { p_seance_id: id })
  ]).then(function(rr){
    if (!courante || String(courante.id) !== String(s.id)) return;   // on a changé de fiche entre-temps
    var p = ok(rr[0]), c = ok(rr[1]), d = ok(rr[2]);
    rendrePret(s, p, c, d);
    rendreControlePrep(c);
    prerempliControle(c);
    if (s.nature === "projet") prerempliMissions(d); else prerempliConcepts(d);
  });
}

function ok(r){ return r && !r.error && r.data && r.data.ok ? r.data : null; }

function rendrePret(s, p, c, d){
  var l = [];
  var projet = s.nature === "projet";
  if (projet) {
    var n = d && d.missions ? d.missions.length : 0;
    l.push(n || (p && p.jalons) ? [true, (n ? n + (n > 1 ? " missions déclarées" : " mission déclarée") : p.jalons + " jalons déclarés")]
                                : [false, "Aucune mission ni jalon", "missions"]);
    l.push(p && p.echeance ? [true, "Échéance posée"] : [false, "Pas d'échéance", "infos"]);
  } else {
    l.push(p && p.questions ? [true, p.questions + " questions corrigées"]
                            : [false, "Aucun corrigé", null]);
    var nc = d && d.concepts ? d.concepts.length : 0;
    l.push(nc ? [true, nc + " concepts pour le débriefing"] : [false, "Aucun concept pour le débriefing", "concepts"]);
  }
  if (c && c.notions) {
    l.push(c.ouvert ? [true, "Contrôle d'entrée proposé (" + c.notions + " notions)"]
                    : [null, "Contrôle d'entrée écrit, pas encore proposé", "controle"]);
  } else {
    l.push([null, "Pas de contrôle d'entrée", "controle"]);
  }
  l.push(s.module_id ? [true, "Rangée dans un module"] : [false, "Rangée dans aucun module", "infos"]);

  var manque = l.filter(function(x){ return x[0] === false; }).length;
  var z = $("gs-pret");
  z.innerHTML = "";
  var t = document.createElement("div");
  t.className = "gs-pret-tete";
  t.innerHTML = '<b>Prête à démarrer ?</b> <span class="badge"></span>';
  var bd = t.querySelector(".badge");
  bd.className = "badge " + (manque ? "att" : "ok");
  bd.textContent = manque ? manque + (manque > 1 ? " points à régler" : " point à régler") : "Prête";
  z.appendChild(t);
  var ul = document.createElement("ul");
  ul.className = "gs-pret-liste";
  l.forEach(function(x){
    var li = document.createElement("li");
    li.className = x[0] === true ? "ok" : (x[0] === false ? "ko" : "info");
    var i = document.createElement("span");
    i.className = "gs-pret-i";
    i.textContent = x[0] === true ? "✓" : (x[0] === false ? "!" : "·");
    li.appendChild(i);
    if (x[0] !== true && x[2]) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gs-pret-lien";
      b.textContent = x[1];
      b.addEventListener("click", function(){ choisirOnglet(x[2], true); });
      li.appendChild(b);
    } else {
      li.appendChild(document.createTextNode(x[1]));
    }
    ul.appendChild(li);
  });
  z.appendChild(ul);
}

// ── Le contrôle d'entrée : son état, et l'interrupteur ───────────────────
function rendreControlePrep(c){
  var bd = $("pr-ctl-badge"), r = $("pr-ctl-resume"), b = $("b-pr-ctl");
  if (!c || !c.notions) {
    bd.className = "badge neutre"; bd.textContent = "Pas écrit";
    r.textContent = "Écrivez les notions ci-dessous : les étudiants y répondent avant de venir.";
    b.hidden = true;
    return;
  }
  bd.className = "badge " + (c.ouvert ? "ok" : "att");
  bd.textContent = c.ouvert ? "Proposé" : "Éteint";
  var repondu = c.termines || 0;
  r.textContent = c.notions + " notions · " + repondu + " / " + c.inscrits + " ont répondu" +
    (repondu ? " — il ne peut plus être réécrit, seulement éteint." : "");
  b.hidden = false;
  b.textContent = c.ouvert ? "Éteindre" : "Le proposer aux étudiants";
  b.dataset.vise = c.ouvert ? "" : "1";
  $("b-ct-creer").disabled = repondu > 0;
  $("ct-texte").readOnly = repondu > 0;
}

// ── Les préremplissages, dans la syntaxe des éditeurs ────────────────────
function prerempliControle(c){
  var t = $("ct-texte");
  if (!t || t.dataset.touche || !c || !c.lignes || !c.lignes.length) return;
  // Les lignes arrivent triées par réussite ; on les remet dans l'ordre
  // d'écriture (pre-01, pre-02…).
  t.value = c.lignes.slice().sort(function(a, b){ return a.cle < b.cle ? -1 : 1; }).map(function(l){
    var opts = (l.options || []).map(function(o, i){
      return ("ABCD".charAt(i) === l.bonne ? "*" : "") + o;
    });
    return l.intitule + " · " + opts.join(" · ");
  }).join("\n");
}

function prerempliConcepts(d){
  var t = $("db-texte");
  if (!t || t.dataset.touche || !d || !d.concepts || !d.concepts.length) return;
  t.value = d.concepts.map(function(c){
    return c.intitule + (c.detail ? " — " + c.detail : "") +
           (c.questions && c.questions.length ? " [" + c.questions.join(" ") + "]" : "");
  }).join("\n");
}

function prerempliMissions(g){
  var t = $("mi-texte");
  if (!t || t.dataset.touche || !g || !g.declarees || !g.missions) return;
  t.value = lignesMissions(g.missions).join("\n");
}

// ── Les questionnaires qui accompagnent la séance (29/09) ────────────────
// L'autre moitié du rattachement : depuis la séance, on voit ce qui
// l'accompagne, on détache, on rattache un questionnaire de la classe. Même
// base (`bibliotheque()`), même phrase (`texteRattachement()`) que la carte
// des questionnaires — deux endroits qui liraient deux choses différentes
// feraient douter des deux.
function lireQuestionnairesPrep(s){
  var classeId = String(($("gs-classe") || {}).value || "");
  return sb.rpc("bibliotheque").then(function(r){
    if (!courante || String(courante.id) !== String(s.id)) return;
    if (!r || r.error || !r.data || !r.data.ok) return;     // pas déployée : rien
    var ici = [], autres = [];
    (r.data.modeles || []).forEach(function(m){
      (m.affectations || []).forEach(function(a){
        if (String(a.classe_id) !== classeId) return;
        (String(a.rattachee_a) === String(s.id) ? ici : autres).push({ m: m, a: a });
      });
    });
    rendreQuestionnairesPrep(s, ici, autres);
  });
}

function rendreQuestionnairesPrep(s, ici, autres){
  var z = $("gs-qn-liste"), sel = $("gs-qn-ajout");
  $("gs-qn").hidden = false;
  z.innerHTML = "";
  if (!ici.length) {
    var v = document.createElement("p");
    v.className = "sous-hint";
    v.textContent = "Aucun questionnaire ne suit cette séance.";
    z.appendChild(v);
  }
  ici.forEach(function(x){
    var l = document.createElement("div");
    l.className = "gs-qn-l";
    var t = document.createElement("span");
    t.className = "gs-qn-t";
    var b = document.createElement("b");
    b.textContent = typo(x.m.titre);
    var e = document.createElement("span");
    e.className = "sous-hint";
    e.textContent = texteRattachement(x.a);
    t.appendChild(b); t.appendChild(e);
    var d = document.createElement("button");
    d.type = "button";
    d.className = "btn btn-sec";
    d.textContent = "Détacher";
    d.setAttribute("aria-label", "Détacher « " + x.m.titre + " » de cette séance");
    d.addEventListener("click", function(){ d.disabled = true; rattacherPrep(s, x, null); });
    l.appendChild(t); l.appendChild(d);
    z.appendChild(l);
  });

  sel.innerHTML = "";
  var o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = autres.length ? "— un questionnaire de la classe —"
                                 : "— aucun autre questionnaire donné à cette classe —";
  sel.appendChild(o0);
  sel.disabled = !autres.length;
  autres.forEach(function(x, i){
    var o = document.createElement("option");
    o.value = String(i);
    o.textContent = x.m.titre + (x.a.rattachee_a ? "  ·  suit la séance " + x.a.rattachee_numero : "");
    sel.appendChild(o);
  });
  sel.onchange = function(){
    if (sel.value === "") return;
    sel.disabled = true;
    rattacherPrep(s, autres[Number(sel.value)], s.id);
  };
}

function rattacherPrep(s, x, cible){
  erreur("err-gs-qn", "");
  sb.rpc("rattacher_questionnaire", { p_seance_id: Number(x.a.seance_id),
                                      p_cible: cible === null ? null : Number(cible) }).then(function(r){
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      erreur("err-gs-qn", "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
    } else if (cible === null) {
      erreur("err-gs-qn", "« " + x.m.titre + " » ne suit plus cette séance. Son état n'a pas " +
             "changé : c'est l'interrupteur qui décide de ce que voient les étudiants.", true);
    } else {
      erreur("err-gs-qn", "« " + x.m.titre + " » suit maintenant cette séance" +
             (d.allume_maintenant ? " — elle est en cours, il vient d'être proposé." : "."), true);
    }
    lireQuestionnairesPrep(s);
    chargerQuestionnaires(true);
  });
}

// ── Branchements ─────────────────────────────────────────────────────────
function brancherPreparer(){
  if (!$("gs-fiche") || $("gs-fiche").dataset.branche) return;
  $("gs-fiche").dataset.branche = "oui";
  ONGLETS_P.forEach(function(o, i){
    var b = $("gsb-" + o);
    b.addEventListener("click", function(){ choisirOnglet(o); });
    b.addEventListener("keydown", function(e){
      var d = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      var visibles = ONGLETS_P.filter(function(k){ return !$("gsb-" + k).hidden; });
      var j = visibles.indexOf(o);
      choisirOnglet(visibles[(j + d + visibles.length) % visibles.length], true);
    });
  });
  $("b-gs-retour").addEventListener("click", fermerFichePrep);
  // Une saisie en cours ne doit pas être écrasée par une relecture.
  ["ct-texte", "db-texte", "mi-texte"].forEach(function(id){
    var t = $(id);
    if (t) t.addEventListener("input", function(){ t.dataset.touche = "1"; });
  });
  // Après un enregistrement, la fiche relit ce qui est en base : le
  // préremplissage et « Prête à démarrer ? » disent le nouvel état.
  ["b-ct-creer", "b-db-creer", "b-mi-creer"].forEach(function(id){
    var b = $(id);
    if (b) b.addEventListener("click", function(){
      setTimeout(function(){
        if (!courante) return;
        ["ct-texte", "db-texte", "mi-texte"].forEach(function(x){ var t = $(x); if (t) delete t.dataset.touche; });
        lireEtat(courante);
      }, 900);
    });
  });
  $("b-pr-ctl").addEventListener("click", function(){
    if (!courante) return;
    var b = $("b-pr-ctl"), vise = !!b.dataset.vise;
    b.disabled = true;
    sb.rpc("ouvrir_controle", { p_seance_id: Number(courante.id), p_ouvert: vise }).then(function(r){
      b.disabled = false;
      if (!ok(r)) { erreur("err-pr-ctl", "Action refusée. Vérifiez que vous êtes bien connecté en enseignant."); return; }
      erreur("err-pr-ctl", vise ? "Contrôle proposé aux étudiants." : "Contrôle éteint.", true);
      lireEtat(courante);
    });
  });
}
brancherPreparer();

export { ouvrirFichePrep, fermerFichePrep, choisirOnglet, lireEtat };
