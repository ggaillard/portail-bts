// ── Le planning : quand a lieu une séance, et l'emploi du temps ───────────
//
// Lot 2 des propositions du 05/10 (06/10). Le portail ne connaissait pas
// l'emploi du temps : « la séance du jour » était devinée (js/encours.js), et
// les migrations écrivaient « à ouvrir le matin même ». Deux choses ici :
//
//   · DANS LA FICHE D'UNE SÉANCE (Préparer → Infos), un bloc « Quand » : jour,
//     début, fin, et deux options — ouvrir à l'heure, clore quinze minutes
//     après la fin. « Prochain créneau libre » remplit les trois champs avec
//     le premier créneau de l'emploi du temps où la classe n'a pas déjà une
//     séance ; un second clic passe au suivant (une semaine de vacances se
//     saute ainsi d'un geste). Enregistrer appelle planifier_seance() APRÈS
//     enregistrer_seance(), et seulement si le bloc a changé — le même choix
//     que ranger_seance() pour le module ;
//   · LA CARTE « L'EMPLOI DU TEMPS » (Préparer, repliée) : un créneau par
//     ligne, « lundi 15:00-17:00 », réécrit d'un coup par definir_creneaux(),
//     qui refuse tout si une ligne est illisible. Elle dit aussi si
//     l'automate tourne sur la base, et propose de l'activer.
//
// Les heures sont celles du navigateur, c'est-à-dire de la salle : un champ
// « 15:00 » devient un instant par `new Date("2026-10-12T15:00")`, et la base
// range des instants. Rien n'est posé si la migration du 06/10 manque : le
// bloc et la carte restent cachés, comme avant qu'ils existent.

import { $, sb, erreur, typo } from './socle.js';
import { texteRefus } from './refus.js';
import { ouvrirOnglet } from './navigation.js';

var JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
var edt = null;          // la réponse d'emploi_du_temps(), ou null (pas déployée)
var fiche = { classe: null, autres: [], avant: "" };

// ── L'emploi du temps ────────────────────────────────────────────────────
function lireEmploiDuTemps(){
  return sb.rpc("emploi_du_temps").then(function(r){
    edt = r && !r.error && r.data && r.data.ok && Array.isArray(r.data.classes) ? r.data : null;
    return edt;
  }, function(){ edt = null; return null; });
}

function creneauxDe(classeId){
  var c = edt && edt.classes.filter(function(x){ return String(x.id) === String(classeId); })[0];
  return c ? c.creneaux || [] : [];
}

function texteCreneaux(l){
  return l.map(function(c){ return JOURS[c.jour] + " " + c.debut + "-" + c.fin; }).join("\n");
}

function chargerEmploiDuTemps(classes){
  var carte = $("carte-edt");
  if (!carte) return Promise.resolve();
  var sel = $("edt-classe");
  if (!sel.options.length) {
    (classes || []).forEach(function(c){
      var o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.nom;
      sel.appendChild(o);
    });
    sel.addEventListener("change", remplirEdt);
    $("b-edt-ok").addEventListener("click", enregistrerEdt);
    $("b-edt-auto").addEventListener("click", activerAutomate);
  }
  return lireEmploiDuTemps().then(function(){
    carte.hidden = !edt;
    if (edt) remplirEdt();
  });
}

function remplirEdt(){
  var l = creneauxDe($("edt-classe").value);
  $("edt-texte").value = texteCreneaux(l);
  var n = edt ? edt.classes.reduce(function(a, c){ return a + (c.creneaux || []).length; }, 0) : 0;
  $("edt-resume").textContent = n ? n + (n > 1 ? " créneaux" : " créneau") : "à poser";
  majAutomate();
}

function majAutomate(){
  var z = $("edt-auto"), b = $("b-edt-auto");
  if (!edt) return;
  z.textContent = edt.automatique
    ? "En marche : la base ouvre et clôt à l'heure les séances où l'option est cochée."
    : (edt.pg_cron
       ? "À l'arrêt : l'extension est là, mais la tâche n'est pas planifiée."
       : "À l'arrêt : l'extension pg_cron n'est pas activée sur la base (Supabase → Database → Extensions).");
  b.hidden = !!edt.automatique;
}

function enregistrerEdt(){
  var b = $("b-edt-ok"), classe = $("edt-classe").value;
  b.disabled = true;
  erreur("err-edt", "");
  return sb.rpc("definir_creneaux", { p_classe_id: Number(classe), p_texte: $("edt-texte").value })
    .then(function(r){
      b.disabled = false;
      if (!r || r.error || !r.data || !r.data.ok) {
        erreur("err-edt", "L'emploi du temps n'a pas été enregistré. " + texteRefus(r));
        return;
      }
      var n = r.data.creneaux;
      return lireEmploiDuTemps().then(function(){
        remplirEdt();
        erreur("err-edt", n ? n + (n > 1 ? " créneaux enregistrés." : " créneau enregistré.")
                            : "Emploi du temps vidé pour cette classe.", true);
      });
    });
}

function activerAutomate(){
  var b = $("b-edt-auto");
  b.disabled = true;
  erreur("err-edt-auto", "");
  return sb.rpc("activer_planification").then(function(r){
    b.disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) { erreur("err-edt-auto", texteRefus(r)); return; }
    return lireEmploiDuTemps().then(function(){
      majAutomate();
      erreur("err-edt-auto", "L'automate est en marche : il passe chaque minute.", true);
    });
  });
}

// Ouvrir la carte depuis ailleurs (la fiche, « Aujourd'hui ») : l'onglet, la
// classe, la carte dépliée, le focus dans le texte.
function allerEmploiDuTemps(classeId){
  ouvrirOnglet("quest");
  var carte = $("carte-edt");
  if (!carte || carte.hidden) return;
  carte.open = true;
  if (classeId && $("edt-classe")) { $("edt-classe").value = String(classeId); remplirEdt(); }
  if (carte.scrollIntoView) carte.scrollIntoView({ block: "start" });
  $("edt-texte").focus();
}

// ── Le bloc « Quand » de la fiche ────────────────────────────────────────
function deuxChiffres(n){ return (n < 10 ? "0" : "") + n; }
function jourLocal(d){ return d.getFullYear() + "-" + deuxChiffres(d.getMonth() + 1) + "-" + deuxChiffres(d.getDate()); }
function heureLocale(d){ return deuxChiffres(d.getHours()) + ":" + deuxChiffres(d.getMinutes()); }
function instant(jour, heure){ return jour && heure ? new Date(jour + "T" + heure) : null; }

// `s` : la ligne de seances_de_classe(), ou null pour une séance à créer ;
// `autres` : les séances de la classe, pour savoir quels créneaux sont pris.
function remplirPlanning(s, classeId, autres){
  var bloc = $("gs-quand");
  if (!bloc) return Promise.resolve();
  fiche.classe = classeId;
  fiche.autres = (autres || []).filter(function(x){ return !s || String(x.id) !== String(s.id); });
  var d = s && s.prevue_le ? new Date(s.prevue_le) : null;
  var f = s && s.fin_prevue ? new Date(s.fin_prevue) : null;
  $("gs-jour").value  = d ? jourLocal(d) : "";
  $("gs-debut").value = d ? heureLocale(d) : "";
  $("gs-fin").value   = f ? heureLocale(f) : "";
  $("gs-auto-ouvrir").checked = !!(s && s.auto_ouvrir);
  $("gs-auto-clore").checked  = !!(s && s.auto_clore);
  fiche.avant = JSON.stringify(lirePlanning());
  $("gs-creneau-note").textContent = "";
  // Une séance d'avant la migration (sans `etat`) : la base ne connaît pas
  // encore le planning, le bloc se tait.
  var pret = edt ? Promise.resolve(edt) : lireEmploiDuTemps();
  return pret.then(function(){
    bloc.hidden = !edt || !!(s && s.etat === undefined);
    majQuand();
  });
}

function lirePlanning(){
  var debut = instant($("gs-jour").value, $("gs-debut").value);
  var fin = instant($("gs-jour").value, $("gs-fin").value);
  return {
    prevue_le: debut ? debut.toISOString() : null,
    fin_prevue: debut && fin ? fin.toISOString() : null,
    auto_ouvrir: !!debut && $("gs-auto-ouvrir").checked,
    auto_clore: !!debut && $("gs-auto-clore").checked
  };
}

// Les options n'ont de sens qu'avec un créneau ; et elles ne font rien si
// l'automate est à l'arrêt — autant le dire en les cochant.
function majQuand(){
  var date = !!($("gs-jour").value && $("gs-debut").value);
  ["gs-auto-ouvrir", "gs-auto-clore"].forEach(function(id){ $(id).disabled = !date; });
  var n = $("gs-auto-note"), coche = $("gs-auto-ouvrir").checked || $("gs-auto-clore").checked;
  n.textContent = !date ? "Les deux options demandent un jour et une heure de début."
    : (coche && edt && !edt.automatique
       ? "L'automate est à l'arrêt sur la base : les options sont gardées, mais rien ne s'ouvrira seul (Préparer → L'emploi du temps)."
       : "");
  var l = creneauxDe(fiche.classe);
  $("b-gs-creneau").disabled = !l.length;
  if (!l.length && !$("gs-creneau-note").textContent) {
    $("gs-creneau-note").textContent = "Pas d'emploi du temps pour cette classe : il se pose dans « L'emploi du temps », plus bas.";
  }
}

// Le premier créneau de l'emploi du temps, après `depuis`, où la classe n'a
// pas déjà une séance. Six mois au plus : au-delà, c'est l'emploi du temps
// qui est vide, pas le calendrier qui est plein.
function prochainCreneau(classeId, depuis, autres){
  var l = creneauxDe(classeId);
  if (!l.length) return null;
  var pris = (autres || []).filter(function(x){ return x.prevue_le; }).map(function(x){
    var d = Date.parse(x.prevue_le);
    return [d, x.fin_prevue ? Date.parse(x.fin_prevue) : d + 60000];
  });
  var j = new Date(depuis);
  j.setHours(0, 0, 0, 0);
  for (var n = 0; n < 186; n++) {
    var iso = (j.getDay() + 6) % 7 + 1;
    var jour = jourLocal(j);
    var duJour = l.filter(function(c){ return c.jour === iso; });
    for (var i = 0; i < duJour.length; i++) {
      var d = instant(jour, duJour[i].debut), f = instant(jour, duJour[i].fin);
      if (d.getTime() <= depuis) continue;
      var libre = !pris.some(function(p){ return p[0] < f.getTime() && d.getTime() < p[1]; });
      if (libre) return { jour: jour, debut: duJour[i].debut, fin: duJour[i].fin, date: d };
    }
    j.setDate(j.getDate() + 1);
  }
  return null;
}

function remplirProchain(){
  var dejaLa = instant($("gs-jour").value, $("gs-debut").value);
  // Un second clic passe au créneau suivant : on part de celui qu'on affiche.
  var depuis = Math.max(Date.now(), dejaLa ? dejaLa.getTime() : 0);
  var c = prochainCreneau(fiche.classe, depuis, fiche.autres);
  if (!c) { $("gs-creneau-note").textContent = "Aucun créneau libre dans les six prochains mois."; return; }
  $("gs-jour").value = c.jour;
  $("gs-debut").value = c.debut;
  $("gs-fin").value = c.fin;
  $("gs-creneau-note").textContent = typo(c.date.toLocaleDateString("fr-FR",
    { weekday: "long", day: "numeric", month: "long" }) + ", " + c.debut + "–" + c.fin +
    " : le prochain créneau libre. Un autre clic propose le suivant.");
  majQuand();
}

// Après enregistrer_seance() : rien si le bloc n'a pas bougé (ou n'est pas
// là) ; sinon la promesse de planifier_seance(). Une heure de début sans jour,
// ou l'inverse, est refusée ici, avant d'écrire quoi que ce soit.
function verifierPlanning(){
  var bloc = $("gs-quand");
  if (!bloc || bloc.hidden) return "";
  var j = $("gs-jour").value, h = $("gs-debut").value;
  if (!!j !== !!h) return "Pour programmer la séance, il faut le jour ET l'heure de début.";
  if (j && $("gs-fin").value && $("gs-fin").value <= h) return "La fin du créneau doit venir après son début.";
  return "";
}

function enregistrerPlanning(seanceId){
  var bloc = $("gs-quand");
  if (!bloc || bloc.hidden) return Promise.resolve(null);
  var p = lirePlanning();
  if (JSON.stringify(p) === fiche.avant) return Promise.resolve(null);
  return sb.rpc("planifier_seance", {
    p_seance_id: Number(seanceId),
    p_prevue_le: p.prevue_le,
    p_fin_prevue: p.fin_prevue,
    p_auto_ouvrir: p.auto_ouvrir,
    p_auto_clore: p.auto_clore
  });
}

function brancherPlanning(){
  if (!$("gs-quand") || $("gs-quand").dataset.branche) return;
  $("gs-quand").dataset.branche = "oui";
  $("b-gs-creneau").addEventListener("click", remplirProchain);
  $("b-gs-sans-date").addEventListener("click", function(){
    ["gs-jour", "gs-debut", "gs-fin"].forEach(function(id){ $(id).value = ""; });
    $("gs-auto-ouvrir").checked = false;
    $("gs-auto-clore").checked = false;
    $("gs-creneau-note").textContent = "Date retirée : la séance ne sera plus programmée une fois enregistrée.";
    majQuand();
  });
  ["gs-jour", "gs-debut", "gs-fin", "gs-auto-ouvrir", "gs-auto-clore"].forEach(function(id){
    $(id).addEventListener("change", majQuand);
  });
  // Une heure de début posée, la fin suit la durée de la séance si elle est vide.
  $("gs-debut").addEventListener("change", function(){
    if ($("gs-fin").value || !$("gs-debut").value || !$("gs-jour").value) return;
    var d = instant($("gs-jour").value, $("gs-debut").value);
    var duree = Number($("gs-duree").value) || 55;
    $("gs-fin").value = heureLocale(new Date(d.getTime() + duree * 60000));
  });
  if ($("b-gs-edt")) $("b-gs-edt").addEventListener("click", function(){ allerEmploiDuTemps(fiche.classe); });
}
brancherPlanning();

export { chargerEmploiDuTemps, lireEmploiDuTemps, remplirPlanning, enregistrerPlanning, verifierPlanning,
         prochainCreneau, allerEmploiDuTemps, creneauxDe, texteCreneaux };
