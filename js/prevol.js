// ── « Avant de commencer » : chaque point à régler porte son geste ────────
//
// Sorti de seance.js le 05/10 (il y était depuis le 07/09), pour deux
// raisons. seance.js touchait son plafond de 700 lignes (§6.1 de REFONTE.md).
// Et surtout, le pré-vol NOMMAIT des gestes qu'il ne permettait pas : depuis
// le lot « le direct » (28/09), ses boutons sont masqués — l'en-tête porte
// Démarrer et Clore —, mais l'en-tête cachait son action pour tout projet. Une
// séance de projet fermée affichait donc « Séance fermée — les étudiants ne
// peuvent plus rien valider » et AUCUN bouton, nulle part sur l'écran. C'est
// ainsi que les séances IA 1 et IA 2 du BTS2 sont restées inactivables depuis
// En cours.
//
// La règle est celle de « Ce qui bloque » (afaire.js) : UN GESTE NOMMÉ DOIT
// ÊTRE FAISABLE DEPUIS LA CARTE. Chaque ligne ⚠️ porte donc son bouton :
//
//   · Projet fermé            → « Ouvrir le projet » (publie ET ouvre, sans chrono)
//   · Projet ouvert mais caché → « Rendre visible »
//   · Projet ouvert et visible → « Clore le projet », discret, différé avec
//     « Annuler » (« Clore », comme un cours : un seul verbe depuis le lot 1)
//   · Cours fermé, pas joué    → « Démarrer la séance »
//   · Cours oublié ouvert      → « Clore la séance », différé avec « Annuler »
//   · Pas de jalon, pas d'échéance → « Écrire les missions › », « Poser
//     l'échéance › » : ils demandent une saisie, on emmène à la fiche de
//     Préparer (le lien `.vers-prep` que gestion.js sait suivre).
//
// Une séance de cours JOUÉE puis close n'est plus un « point à régler » : elle
// est terminée. Avant le 05/10, chaque séance passée criait « 1 point à
// régler » — un pré-vol qui crie au loup sur toutes les séances finies ne se
// lit plus sur celle du jour.
//
// Les gestes passent par ouverture.js. Après chacun, `relire()` — fournie par
// seance.js via brancherPrevol(), pour ne pas importer seance.js qui nous
// importe — relit le pré-vol, les chiffres, « Ce qui bloque » et le semestre.

import { $, suivi, erreur, dateCourte } from './socle.js';
import { majPilote } from './pilote.js';
import { toast } from './toast.js';
import { seanceOubliee, depuisLe, ouvrirSeance, fermerSeance, montrerSeance } from './ouverture.js';

let relire = function(){ return Promise.resolve(); };
export function brancherPrevol(liens){ relire = liens.relire || relire; }

function heureCourte(iso){
  var d = new Date(iso);
  return isNaN(d) ? "?" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function jourEtHeure(iso){
  var d = new Date(iso);
  return isNaN(d) ? "?" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
                          " à " + heureCourte(iso);
}

// ── Les lignes : [état, titre, conséquence, geste] ───────────────────────
// état : true (fait) · false (à régler, compté) · null (information).
// geste : { libelle, faire, sec } ou { libelle, vers: onglet de Préparer }.
function lignesPrevol(p){
  var projet = p.nature === "projet";
  var l = [];

  if (projet) {
    l.push(p.jalons
      ? [true,  p.jalons + " jalons déclarés", ""]
      : [false, "Aucun jalon déclaré", "l'avancement se calculera sur l'étudiant le plus avancé, faute de repère",
         { libelle: "Écrire les missions ›", vers: "missions" }]);
    l.push(p.echeance
      ? [true,  "Échéance au " + dateCourte(p.echeance), ""]
      : [false, "Pas d'échéance", "impossible de dire qui n'ira pas au bout au rythme actuel",
         { libelle: "Poser l'échéance ›", vers: "infos" }]);
  } else {
    l.push(p.questions > 0
      ? [true,  p.questions + " questions corrigées", ""]
      : [false, "Aucun corrigé pour cette séance", "les réponses seront enregistrées mais jamais évaluées"]);
  }

  l.push(p.appel_du_jour
    ? [true, "Question d'appel posée pour aujourd'hui", ""]
    : [null, "Question d'appel pas encore créée", "elle se crée d'elle-même à la première connexion d'un étudiant, rien à faire"]);

  // L'état — c'est la ligne qui manquait d'un bouton.
  var appel = String(p.seance) === "99";
  if (projet) {
    if (!p.ouverte) {
      l.push([false, "Projet fermé", p.publiee === true
        ? "les étudiants voient ses missions mais ne peuvent pas les cocher"
        : "les étudiants ne le voient pas et ne peuvent rien cocher",
        { libelle: "Ouvrir le projet", faire: function(){ $("b-ouvrir").click(); } }]);
    } else if (p.publiee === false) {
      l.push([false, "Projet ouvert mais caché", "les étudiants ne voient pas ses missions",
        { libelle: "Rendre visible", faire: rendreVisibleIci }]);
    } else {
      l.push([true, "Projet ouvert et visible", "les étudiants cochent leurs missions à leur rythme",
        { libelle: "Clore le projet", sec: true, faire: fermerProjetIci }]);
    }
  } else if (seanceOubliee(p)) {
    l.push([false, "Ouverte depuis " + depuisLe(p.demarree_le),
      "démarrée le " + jourEtHeure(p.demarree_le) + " et jamais close : elle accepte toujours des réponses",
      { libelle: "Clore la séance", faire: cloreIci }]);
  } else if (p.ouverte) {
    l.push([true, "Séance ouverte" + (p.demarree_le ? ", démarrée à " + heureCourte(p.demarree_le) : ", pas encore démarrée"), ""]);
  } else if (p.demarree_le && !appel) {
    l.push([null, "Séance terminée", "jouée le " + jourEtHeure(p.demarree_le) + ", close : les réponses sont figées"]);
  } else {
    l.push([false, "Séance fermée", "personne ne peut répondre tant qu'elle n'est pas démarrée",
      { libelle: "Démarrer la séance", faire: demarrerIci }]);
  }

  var accesOk = p.eleves > 0 && p.avec_pin === p.eleves;
  l.push(accesOk
    ? [true,  p.eleves + " étudiants, tous avec un code PIN (" + p.deja_connectes + " déjà connectés)", ""]
    : [false, p.avec_pin + " codes PIN pour " + p.eleves + " étudiants", "les étudiants sans PIN ne pourront pas s'identifier"]);
  return l;
}

function rendrePrevol(p){
  var bloc = $("prevol");
  bloc.hidden = false;
  var lignes = lignesPrevol(p);

  var ul = $("prevol-liste");
  ul.innerHTML = "";
  lignes.forEach(function(l){
    var li = document.createElement("li");
    li.innerHTML = '<span class="pv-i"></span><span class="pv-t"><b></b><span class="pv-ko"></span></span>';
    li.querySelector(".pv-i").textContent = l[0] === true ? "✅" : (l[0] === null ? "ℹ️" : "⚠️");
    li.querySelector("b").textContent = l[1];
    li.querySelector(".pv-ko").textContent = l[2] ? " — " + l[2] : "";
    var g = l[3];
    if (g) {
      var b = document.createElement("button");
      b.type = "button";
      if (g.vers) {
        b.className = "qa-b vers-prep pv-geste";
        b.dataset.onglet = g.vers;
      } else {
        b.className = "btn pv-geste" + (g.sec ? " btn-sec" : "");
        b.addEventListener("click", function(){ g.faire(b); });
      }
      b.textContent = g.libelle;
      li.appendChild(b);
    }
    ul.appendChild(li);
  });

  // Seul un vrai blocage compte : une information n'est pas un point à régler.
  var manque = lignes.filter(function(l){ return l[0] === false; }).length;
  var termine = p.nature !== "projet" && !p.ouverte && !!p.demarree_le;
  var etat = $("prevol-etat");
  etat.textContent = manque ? (manque + (manque > 1 ? " points à régler" : " point à régler"))
                            : (termine ? "Séance terminée" : "Tout est prêt");
  etat.className = "prevol-etat " + (manque ? "ko" : "ok");

  // Les boutons du pré-vol restent masqués (styles/pilote.css) : l'en-tête et
  // les lignes ci-dessus les cliquent. La séance 99 est le registre d'appel.
  var projet = p.nature === "projet";
  $("b-demarrer").hidden = projet;
  $("b-clore").hidden = projet || String(p.seance) === "99";
  $("b-demarrer").textContent = p.demarree_le && p.ouverte ? "Redémarrer le chrono" : "Démarrer la séance";
  $("b-clore").disabled = !p.ouverte;
  $("b-ouvrir").hidden = !projet || !!p.ouverte;

  // Le sélecteur et `suivi.ouverte` disent l'état relu, pas celui du chargement.
  suivi.ouverte = !!p.ouverte;
  var opt = $("pk-seance") && [].filter.call($("pk-seance").options, function(o){
    return String(o.value) === String(suivi.seanceId); })[0];
  if (opt) {
    opt.dataset.ouverte = p.ouverte ? "1" : "";
    opt.textContent = opt.textContent.replace(/ · (ouverte|fermée)/, p.ouverte ? " · ouverte" : " · fermée");
  }
  majPilote();
}

// ── Les gestes ──────────────────────────────────────────────────────────
function apresGeste(d, bouton, message){
  if (bouton) bouton.disabled = false;
  if (!d.ok) { erreur("err-prevol", d.detail); return; }
  erreur("err-prevol", "");
  toast(message);
  return relire();
}

function ouvrirProjetIci(){
  var b = $("b-ouvrir"), id = suivi.seanceId;
  if (!id) return;
  b.disabled = true;
  erreur("err-prevol", "");
  return ouvrirSeance(id).then(function(d){
    return apresGeste(d, b, "Projet ouvert et visible : les étudiants voient leurs missions et peuvent les cocher.");
  });
}

function rendreVisibleIci(bouton){
  if (!suivi.seanceId) return;
  bouton.disabled = true;
  return montrerSeance(suivi.seanceId, true).then(function(d){
    return apresGeste(d, bouton, "Séance visible : les étudiants la voient dans leurs projets.");
  });
}

// Clore coupe les réponses de toute la classe : différé, avec « Annuler ».
function fermerProjetIci(bouton){
  var id = suivi.seanceId;
  if (!id) return;
  bouton.disabled = true;
  toast("Le projet va être clos : plus personne ne pourra cocher une mission.", {
    apres: function(){
      fermerSeance(id).then(function(d){ apresGeste(d, bouton, "Projet clos. Les missions déjà cochées restent."); });
    },
    annuler: function(){ bouton.disabled = false; toast("Clôture annulée. Le projet reste ouvert."); }
  });
}

function demarrerIci(){
  $("b-demarrer").click();
  toast("Séance démarrée : les réponses sont ouvertes, le chrono part.");
}

function cloreIci(bouton){
  bouton.disabled = true;
  toast("La séance va être close : plus aucune réponse ne sera acceptée.", {
    apres: function(){ bouton.disabled = false; $("b-clore").click(); },
    annuler: function(){ bouton.disabled = false; toast("Clôture annulée. La séance reste ouverte."); }
  });
}

function brancherOuverture(){
  var b = $("b-ouvrir");
  if (!b || b.dataset.branche) return;
  b.dataset.branche = "oui";
  b.addEventListener("click", ouvrirProjetIci);
}
brancherOuverture();

export { rendrePrevol, lignesPrevol };
