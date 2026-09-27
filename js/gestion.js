// ── Les séances d'une classe : les créer et les régler depuis le portail ──
//
// Jusqu'au 27/09, créer une séance, corriger son échéance ou déclarer ses
// jalons passait par une migration. La séance IA 1 du BTS2 portait ainsi une
// date « À MODIFIER » qu'il fallait aller réécrire dans un fichier SQL. La
// carte vit dans l'onglet Le semestre : on règle une séance en la préparant,
// pas pendant l'heure.
//
// Ce que la carte ne fait PAS, volontairement :
//
//   · elle ne touche pas à la bande 90-99 (questionnaires, stage, connaissance,
//     appel) — la base refuse, et la liste ne la montre pas ;
//   · elle ne renumérote pas une séance qui a des réponses — les clés de
//     mission `tpN-mK` portent son numéro ; la base le refuse et le dit ;
//   · elle n'écrit ni corrigé, ni contrôle, ni mission : chacun s'écrit en
//     regardant la séance qu'il prépare, dans l'onglet La séance. Deux endroits
//     pour le même geste finissent toujours par diverger.
//
// Après chaque enregistrement, les sélecteurs du suivi et « À faire » sont
// relus : une échéance posée ici doit éteindre la ligne « Projet sans
// échéance » sans qu'on recharge la page.

import { $, sb, suivi, erreur, typo } from './socle.js';
import { chargerSeancesDe, activerSeance } from './seance.js';

let apres = function(){};
export function brancherGestion(liens){ apres = liens.apres || apres; }

let classeGestion = null;
let seances = [];

function chargerGestion(classes){
  var carte = $("carte-seances");
  if (!carte) return;
  var sel = $("gs-classe");
  if (!sel.options.length) {
    (classes || []).forEach(function(c){
      var o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.nom;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function(){ lireSeances(sel.value); });
    $("b-gs-neuve").addEventListener("click", function(){ ouvrirFormulaire(null); });
    $("b-gs-annuler").addEventListener("click", fermerFormulaire);
    $("f-gs").addEventListener("submit", function(e){ e.preventDefault(); enregistrer(); });
  }
  if (!sel.value) return;
  lireSeances(sel.value);
}

function lireSeances(classeId){
  classeGestion = classeId;
  fermerFormulaire();
  return sb.rpc("seances_de_classe", { p_classe_id: Number(classeId) }).then(function(r){
    var carte = $("carte-seances");
    // Fonction pas déployée : la carte reste cachée, comme avant qu'elle existe.
    if (!r || r.error || !r.data || !r.data.ok) { carte.hidden = true; return; }
    carte.hidden = false;
    seances = r.data.liste || [];
    rendreListe();
  });
}

function etat(s){
  var bouts = [];
  bouts.push(s.publiee ? "publiée" : "non publiée");
  bouts.push(s.ouverte ? "ouverte" : "fermée");
  return bouts.join(" · ");
}

function suivre(s){
  if (s.nature !== "projet") {
    return s.corriges ? s.corriges + " questions" : "aucun corrigé";
  }
  var j = s.missions ? s.missions + " missions" : (s.jalons ? s.jalons + " jalons" : "aucun jalon");
  return j + (s.echeance ? " · échéance " + new Date(s.echeance).toLocaleDateString("fr-FR",
    { day: "numeric", month: "short", year: "numeric" }) : " · sans échéance");
}

function rendreListe(){
  var t = $("gs-liste");
  t.innerHTML = "";
  if (!seances.length) {
    var p = document.createElement("p");
    p.className = "sous-hint";
    p.textContent = "Aucune séance dans cette classe.";
    t.appendChild(p);
    return;
  }
  seances.forEach(function(s){
    var l = document.createElement("div");
    l.className = "gs-l" + (s.nature === "projet" ? " gs-projet" : "");
    l.innerHTML = '<span class="gs-num"></span><span class="gs-txt"><span class="gs-titre"></span>' +
                  '<span class="gs-meta"></span></span><button class="qa-b gs-b" type="button">Modifier</button>';
    l.querySelector(".gs-num").textContent = s.numero;
    l.querySelector(".gs-titre").textContent = typo(s.titre);
    l.querySelector(".gs-meta").textContent = (s.nature === "projet" ? "Projet" : "Cours") +
      " · " + suivre(s) + " · " + etat(s) + (s.reponses ? " · " + s.reponses + " réponses" : "");
    l.querySelector(".gs-b").setAttribute("aria-label", "Modifier la séance " + s.numero);
    l.querySelector(".gs-b").addEventListener("click", function(){ ouvrirFormulaire(s); });
    t.appendChild(l);
  });
}

// Le numéro qui suit la dernière séance ; s'il dépasse la bande autorisée,
// le premier trou.
function prochainNumero(){
  var pris = seances.map(function(s){ return s.numero; });
  var suivant = pris.length ? Math.max.apply(null, pris) + 1 : 0;
  if (suivant < 90) return suivant;
  for (var n = 0; n < 90; n++) if (pris.indexOf(n) < 0) return n;
  return "";
}

function ouvrirFormulaire(s){
  var f = $("f-gs");
  f.hidden = false;
  f.dataset.id = s ? s.id : "";
  $("gs-f-titre").textContent = s ? "Modifier la séance " + s.numero : "Nouvelle séance";
  $("gs-numero").value   = s ? s.numero : prochainNumero();
  $("gs-titre").value    = s ? s.titre : "";
  $("gs-nature").value   = s ? (s.nature || "cours") : "projet";
  $("gs-jalons").value   = s && s.jalons ? s.jalons : "";
  $("gs-echeance").value = s && s.echeance ? String(s.echeance).slice(0, 10) : "";
  $("gs-duree").value    = s ? (s.duree_min || 55) : 180;
  $("gs-publiee").checked = s ? !!s.publiee : false;
  $("gs-ouverte").checked = s ? !!s.ouverte : true;
  // Des missions déclarées décident des jalons : on ne laisse pas saisir un
  // second nombre qui les contredirait.
  $("gs-jalons").disabled = !!(s && s.missions);
  $("gs-jalons-note").textContent = s && s.missions
    ? "Fixé par les " + s.missions + " missions de la séance." : "";
  // Une séance qui a des réponses garde son numéro : autant le dire avant.
  $("gs-numero").disabled = !!(s && s.reponses);
  erreur("err-gs", "");
  $("gs-titre").focus();
}

function fermerFormulaire(){
  var f = $("f-gs");
  if (f) f.hidden = true;
}

function enregistrer(){
  var f = $("f-gs");
  var b = $("b-gs-ok");
  var id = f.dataset.id ? Number(f.dataset.id) : null;
  var jalons = $("gs-jalons").value === "" ? 0 : Number($("gs-jalons").value);
  b.disabled = true;
  sb.rpc("enregistrer_seance", {
    p_seance_id: id,
    p_classe_id: Number(classeGestion),
    p_numero:    Number($("gs-numero").value),
    p_titre:     $("gs-titre").value,
    p_nature:    $("gs-nature").value,
    p_jalons:    jalons,
    p_echeance:  $("gs-echeance").value || null,
    p_duree_min: $("gs-duree").value === "" ? null : Number($("gs-duree").value),
    p_publiee:   $("gs-publiee").checked,
    p_ouverte:   $("gs-ouverte").checked
  }).then(function(r){
    b.disabled = false;
    if (r.error || !r.data || !r.data.ok) {
      erreur("err-gs", (r.data && r.data.detail) ||
        (r.data && r.data.motif === "refus" ? "Réservé à l'enseignant." :
         "La séance n'a pas été enregistrée."));
      return;
    }
    var cree = r.data.cree;
    lireSeances(classeGestion).then(function(){
      erreur("err-gs-liste", cree ? "Séance créée." : "Séance enregistrée.", true);
    });
    // Les sélecteurs du suivi et « À faire » lisent les mêmes lignes.
    // On garde la séance qu'on suivait : recharger le sélecteur ne doit pas
    // faire basculer l'onglet La séance sur une autre.
    if (String(suivi.classeId) === String(classeGestion)) {
      var suivie = suivi.seanceId;
      chargerSeancesDe(classeGestion).then(function(){
        var ss = $("pk-seance");
        if (!suivie || String(ss.value) === String(suivie)) return;
        for (var i = 0; i < ss.options.length; i++) {
          if (String(ss.options[i].value) === String(suivie)) { ss.selectedIndex = i; activerSeance(); break; }
        }
      });
    }
    apres();
  });
}

export { chargerGestion, lireSeances, prochainNumero, suivre };
