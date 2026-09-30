// ── Les questionnaires de la séance, sur l'écran du direct (30/09) ────────
//
// Besoin : « sur mon tableau de bord, je ne vois pas qu'un questionnaire est
// associé ; je dois pouvoir le voir et choisir le questionnaire à associer ».
// Le rattachement existait (seances.rattachee_a, 16/09) et se réglait depuis
// Préparer — mais l'écran qu'on a sous les yeux pendant l'heure n'en disait
// rien. Un questionnaire qui s'allume tout seul au démarrage, sans qu'on le
// voie, se découvre quand un étudiant en parle.
//
// Ce bloc, dans la vue « Maintenant », dit trois choses et offre trois gestes :
//
//   · ce qui accompagne la séance, et si les étudiants le voient (badge) ;
//   · Proposer / Éteindre — ouvrir_questionnaire(), le geste de toujours ;
//   · Détacher, et « Associer un questionnaire… » — rattacher_questionnaire().
//
// Même base que la carte des questionnaires et que la fiche de Préparer
// (`bibliotheque()`), même phrase (`texteRattachement()`) : trois endroits
// qui liraient trois choses différentes feraient douter des trois.
//
// `bibliotheque()` n'est relue que quand la séance CHANGE ou après un geste :
// `majPilote()` tourne toutes les cinq secondes pendant une séance ouverte.

import { $, sb, erreur, typo } from './socle.js';
import { chargerQuestionnaires, texteRattachement } from './bibliotheque.js';

var lue = "";            // « classe/séance » de la dernière lecture
var enCours = false;

function majQuestionnairesSeance(seanceId, classeId, numero, force){
  var z = $("bloc-qseance");
  if (!z) return;
  var cle = classeId + "/" + seanceId;
  if (!seanceId || !classeId || Number(numero) >= 90) { z.hidden = true; lue = ""; return; }
  if (!force && (cle === lue || enCours)) return;
  lue = cle;
  enCours = true;
  sb.rpc("bibliotheque").then(function(r){
    enCours = false;
    if (lue !== cle) return;                            // on a changé de séance entre-temps
    if (!r || r.error || !r.data || !r.data.ok) { z.hidden = true; return; }
    var ici = [], autres = [];
    (r.data.modeles || []).forEach(function(m){
      (m.affectations || []).forEach(function(a){
        if (String(a.classe_id) !== String(classeId)) return;
        (String(a.rattachee_a) === String(seanceId) ? ici : autres).push({ m: m, a: a });
      });
    });
    qsRendre(seanceId, classeId, ici, autres);
  });
}

function qsRendre(seanceId, classeId, ici, autres){
  var z = $("bloc-qseance"), liste = $("qs-liste"), sel = $("qs-ajout");
  z.hidden = false;
  $("qs-compte").textContent = ici.length ? String(ici.length) : "";
  liste.innerHTML = "";
  if (!ici.length) {
    var v = document.createElement("p");
    v.className = "sous-hint";
    v.textContent = "Aucun questionnaire n'accompagne cette séance.";
    liste.appendChild(v);
  }
  ici.forEach(function(x){ liste.appendChild(qsLigne(seanceId, classeId, x)); });

  sel.innerHTML = "";
  var o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = autres.length ? "Associer un questionnaire…"
                                 : "Aucun autre questionnaire donné à cette classe";
  sel.appendChild(o0);
  sel.disabled = !autres.length;
  autres.forEach(function(x, i){
    var o = document.createElement("option");
    o.value = String(i);
    o.textContent = x.m.titre +
      (x.a.rattachee_a ? " · suit la séance " + x.a.rattachee_numero : "") +
      (x.a.ouvert ? " · proposé" : "");
    sel.appendChild(o);
  });
  sel.onchange = function(){
    if (sel.value === "") return;
    var x = autres[Number(sel.value)];
    sel.disabled = true;
    qsGeste("rattacher_questionnaire",
      { p_seance_id: Number(x.a.seance_id), p_cible: Number(seanceId) },
      function(d){
        return "« " + typo(x.m.titre) + " » accompagne maintenant cette séance" +
          (d.allume_maintenant ? " — elle est en cours : il vient d'être proposé aux étudiants."
                               : " — il sera proposé au démarrage.");
      }, seanceId, classeId);
  };
}

function qsLigne(seanceId, classeId, x){
  var l = document.createElement("div");
  l.className = "qs-l";
  var t = document.createElement("span");
  t.className = "qs-t";
  var b = document.createElement("b");
  b.textContent = typo(x.m.titre);
  var badge = document.createElement("span");
  badge.className = "badge " + (x.a.ouvert ? "ok" : "neutre");
  badge.textContent = x.a.ouvert ? "Proposé" : "Éteint";
  b.appendChild(document.createTextNode(" "));
  b.appendChild(badge);
  var d = document.createElement("span");
  d.className = "sous-hint";
  d.textContent = texteRattachement(x.a) + " · " + (x.a.termines || 0) + " / " +
                  (x.a.inscrits || 0) + " terminé(s)" +
                  (x.m.mode === "revision" ? " · révision, correction affichée" : "");
  t.appendChild(b); t.appendChild(d);

  var actes = document.createElement("span");
  actes.className = "qs-actes";
  var sw = document.createElement("button");
  sw.type = "button";
  sw.className = "btn" + (x.a.ouvert ? " btn-sec" : "");
  sw.textContent = x.a.ouvert ? "Éteindre" : "Proposer";
  sw.setAttribute("aria-label", (x.a.ouvert ? "Éteindre" : "Proposer") + " « " + x.m.titre + " »");
  sw.addEventListener("click", function(){
    sw.disabled = true;
    var vise = !x.a.ouvert;
    qsGeste("ouvrir_questionnaire",
      { p_classe_id: Number(classeId), p_numero: Number(x.a.numero), p_ouvert: vise },
      function(){
        return vise ? "« " + typo(x.m.titre) + " » est proposé aux étudiants."
                    : "« " + typo(x.m.titre) + " » est éteint. Les réponses sont gardées.";
      }, seanceId, classeId);
  });
  var de = document.createElement("button");
  de.type = "button";
  de.className = "btn btn-sec";
  de.textContent = "Détacher";
  de.setAttribute("aria-label", "Détacher « " + x.m.titre + " » de cette séance");
  de.addEventListener("click", function(){
    de.disabled = true;
    qsGeste("rattacher_questionnaire", { p_seance_id: Number(x.a.seance_id), p_cible: null },
      function(){
        return "« " + typo(x.m.titre) + " » ne suit plus cette séance. Son état n'a pas changé : " +
               "c'est « Proposer / Éteindre » qui décide de ce que voient les étudiants.";
      }, seanceId, classeId);
  });
  actes.appendChild(sw); actes.appendChild(de);
  l.appendChild(t); l.appendChild(actes);
  return l;
}

function qsGeste(rpc, args, texte, seanceId, classeId){
  erreur("err-qseance", "");
  sb.rpc(rpc, args).then(function(r){
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      erreur("err-qseance", "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
    } else {
      erreur("err-qseance", texte(d), true);
    }
    majQuestionnairesSeance(seanceId, classeId, 0, true);
    chargerQuestionnaires(true);
  });
}

export { majQuestionnairesSeance };
