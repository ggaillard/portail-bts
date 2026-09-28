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
//
// Depuis le 28/09, les séances se lisent MODULE PAR MODULE (js/modules.js),
// et c'est ici qu'on range une séance : un sélecteur « Module » dans le
// formulaire, qui appelle ranger_seance() après enregistrer_seance(). Deux
// appels plutôt qu'un paramètre de plus : changer la signature de
// enregistrer_seance() obligeait à la réécrire en entier. Tant que
// modules_enseignant() n'est pas déployée, la liste reste à plat, comme avant.

import { $, sb, suivi, erreur, typo } from './socle.js';
import { chargerSeancesDe, activerSeance } from './seance.js';
import { lireModules, modulesDe } from './modules.js';
import { ouvrirFichePrep, fermerFichePrep } from './preparer.js';
import { ouvrirOnglet } from './navigation.js';

let apres = function(){};
export function brancherGestion(liens){ apres = liens.apres || apres; }

let classeGestion = null;
let seances = [];
let modules = null;   // null = pas de modules en base : liste à plat

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
    // Depuis l'écran du direct : « Écrire ou modifier … — Préparer ›».
    document.addEventListener("click", function(e){
      var b = e.target.closest && e.target.closest(".vers-prep");
      if (b && suivi.classeId && suivi.seanceId) preparerSeance(suivi.classeId, suivi.seanceId, b.dataset.onglet);
    });
  }
  if (!sel.value) return;
  lireSeances(sel.value);
}

function lireSeances(classeId){
  classeGestion = classeId;
  fermerFormulaire();
  return Promise.all([
    sb.rpc("seances_de_classe", { p_classe_id: Number(classeId) }),
    lireModules()
  ]).then(function(rr){
    var r = rr[0];
    var carte = $("carte-seances");
    // Fonction pas déployée : la carte reste cachée, comme avant qu'elle existe.
    if (!r || r.error || !r.data || !r.data.ok) { carte.hidden = true; return; }
    carte.hidden = false;
    seances = r.data.liste || [];
    var m = modulesDe(rr[1], classeId);
    modules = m && m.length ? m : null;
    rendreListe();
  });
}

// Relire la classe affichée — après qu'un module a été créé ou renommé.
function relireGestion(){
  if (classeGestion) return lireModules().then(function(){ return lireSeances(classeGestion); });
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
    p.textContent = "Aucune séance dans cette classe. ";
    // L'état vide propose le geste qui en sort.
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec";
    b.textContent = "Créer la première séance";
    b.addEventListener("click", function(){ ouvrirFormulaire(null); });
    p.appendChild(b);
    t.appendChild(p);
    return;
  }
  if (!modules) { seances.forEach(function(s){ t.appendChild(ligne(s)); }); return; }

  // Un groupe par module, dans l'ordre des modules ; puis celles qui ne sont
  // rangées nulle part, nommées comme telles — c'est ce qu'il reste à faire.
  var groupes = modules.map(function(m){
    return { titre: (m.icone ? m.icone + " " : "") + m.titre, liste: seances.filter(function(s){
      return String(s.module_id) === String(m.id); }) };
  });
  var connus = modules.map(function(m){ return String(m.id); });
  groupes.push({ titre: "Sans module", sans: true, liste: seances.filter(function(s){
    return connus.indexOf(String(s.module_id)) < 0; }) });
  groupes.forEach(function(g){
    if (!g.liste.length && g.sans) return;
    var h = document.createElement("h3");
    h.className = "sous-titre gs-module" + (g.sans ? " gs-sans" : "");
    h.textContent = typo(g.titre) + " — " + (g.liste.length
      ? g.liste.length + (g.liste.length > 1 ? " séances" : " séance") : "aucune séance");
    t.appendChild(h);
    g.liste.forEach(function(s){ t.appendChild(ligne(s)); });
  });
}

function ligne(s){
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
    return l;
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

function ouvrirFormulaire(s, onglet){
  ouvrirFichePrep(s, onglet);
  var f = $("f-gs");
  f.hidden = false;
  f.dataset.id = s ? s.id : "";
  f.dataset.module = s && s.module_id ? String(s.module_id) : "";
  $("gs-f-titre").textContent = s ? "Modifier la séance " + s.numero : "Nouvelle séance";
  $("gs-numero").value   = s ? s.numero : prochainNumero();
  $("gs-titre").value    = s ? s.titre : "";
  remplirModules(s);
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
  if (!onglet || onglet === "infos") $("gs-titre").focus();
}

// Le sélecteur n'existe que s'il y a des modules. Une séance nouvelle dans
// une classe à un seul module y entre d'office (la base le ferait de toute
// façon) ; avec plusieurs, on ne devine pas : « Choisir… » est obligatoire.
function remplirModules(s){
  var l = $("gs-module-l"), sel = $("gs-module");
  l.hidden = !modules;
  sel.required = !!modules;
  sel.innerHTML = "";
  if (!modules) return;
  var vide = document.createElement("option");
  vide.value = "";
  vide.textContent = s ? "— sans module —" : "Choisir le module…";
  sel.appendChild(vide);
  modules.forEach(function(m){
    var o = document.createElement("option");
    o.value = m.id;
    o.textContent = (m.icone ? m.icone + " " : "") + m.titre;
    sel.appendChild(o);
  });
  sel.value = s ? (s.module_id || "") : (modules.length === 1 ? String(modules[0].id) : "");
  // Une séance existante peut rester sans module ; une nouvelle, non.
  sel.required = !s;
}

function fermerFormulaire(){
  var f = $("f-gs");
  if (f) f.hidden = true;
  fermerFichePrep();
}

// Ouvrir la fiche d'une séance dans Préparer, sur un onglet : c'est le chemin
// depuis l'écran du direct, où les éditeurs ne sont plus.
function preparerSeance(classeId, seanceId, onglet){
  ouvrirOnglet("quest");
  var sel = $("gs-classe");
  if (sel) sel.value = String(classeId);
  return lireSeances(classeId).then(function(){
    var s = seances.filter(function(x){ return String(x.id) === String(seanceId); })[0];
    if (!s) return;
    ouvrirFormulaire(s, onglet);
    var f = $("gs-fiche");
    if (f && f.scrollIntoView) f.scrollIntoView({ block: "start" });
  });
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
    if (r.error || !r.data || !r.data.ok) return r;
    // Ranger, seulement si le module a changé : un appel de moins, et aucun
    // risque d'écrire sur une séance qu'on n'a pas voulu déplacer.
    var avant = f.dataset.module || "";
    var voulu = modules ? $("gs-module").value : avant;
    if (voulu === avant) return r;
    return sb.rpc("ranger_seance", { p_seance_id: r.data.id,
                                     p_module_id: voulu === "" ? null : Number(voulu) })
      .then(function(rg){
        if (rg.error || !rg.data || !rg.data.ok) {
          return { recharger: true, data: { ok: false, detail: "Séance enregistrée, mais pas rangée : " +
            ((rg.data && rg.data.detail) || "le module a été refusé.") } };
        }
        return r;
      });
  }).then(function(r){
    b.disabled = false;
    if (r.error || !r.data || !r.data.ok) {
      erreur("err-gs", (r.data && r.data.detail) ||
        (r.data && r.data.motif === "refus" ? "Réservé à l'enseignant." :
         "La séance n'a pas été enregistrée."));
      // La séance, elle, est enregistrée : la liste doit le montrer, et le
      // message passe au-dessus d'elle, le formulaire se refermant.
      if (r.recharger) lireSeances(classeGestion).then(function(){ erreur("err-gs-liste", r.data.detail); });
      return;
    }
    var cree = r.data.cree, idv = r.data.id;
    lireSeances(classeGestion).then(function(){
      erreur("err-gs-liste", cree ? "Séance créée." : "Séance enregistrée.", true);
      // La fiche reste ouverte sur la séance qu'on vient d'enregistrer — ou
      // de créer : c'est là qu'on écrira ensuite son contrôle et ses concepts.
      var s = seances.filter(function(x){ return String(x.id) === String(idv); })[0];
      if (s) ouvrirFormulaire(s);
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

export { chargerGestion, lireSeances, relireGestion, prochainNumero, suivre, preparerSeance };
