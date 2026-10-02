// ── Les équipes d'un module ───────────────────────────────────────────────
//
// Né le 02/10/2026 pour le module BTS2 « Du besoin à la mise en place »
// (méthode CPMS) : des équipes de 2 à 4, quatre jalons, seize artefacts. G
// veut suivre l'avancement des équipes, noter l'équipe, ET voir la part de
// chacun — valoriser ceux qui portent le travail, repérer ceux qui ne
// fournissent rien. Trois lectures, choisies par G :
//
//   · le JOURNAL de fin de séance, écrit par chaque étudiant (une ligne, et
//     l'artefact sur lequel il a travaillé) ;
//   · l'APPRÉCIATION de l'enseignant, posée du téléphone pendant la séance :
//     ✓ moteur · ~ présent · ✗ rien fourni ;
//   · les PAIRS : à chaque jalon posé, chacun répartit 100 points entre les
//     membres de son équipe, lui compris.
//
// Côté enseignant, une carte de Bilan : composer les équipes (un bloc de
// texte, comme les missions), poser les jalons, apprécier, lire les raisons.
// Elle se lit aussi pendant la séance : les trois boutons d'appréciation font
// 44 px, sous le pouce. Côté étudiant, la carte « Votre équipe ».
//
// Des RAISONS, jamais une note de contribution : l'équipe se note sur ses
// livrables ; ces lectures disent à qui parler. Un étudiant ne voit jamais
// l'appréciation de l'enseignant ni les points que les autres lui donnent —
// c'est la base qui le garantit (mon_equipe()), pas cette page.

import { $, sb, erreur, typo, nomDe, prenomSeul, texteEnvoi,
         signalerSessionPerimee } from './socle.js';
import { toast } from './toast.js';

var NIVEAUX = [["moteur", "✓", "moteur"], ["present", "~", "présent"], ["rien", "✗", "rien fourni"]];
var ETAT_JALON = { valide: "validé", a_reprendre: "à reprendre" };
var modules = [], moduleId = null, donnees = null;

function eqEl(tag, classe, texte){
  var n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texte !== undefined && texte !== null) n.textContent = texte;
  return n;
}

// ═══ Côté enseignant ═══════════════════════════════════════════════════════
function chargerEquipes(){
  var carte = $("carte-equipes");
  if (!carte) return Promise.resolve();
  return sb.rpc("modules_equipes").then(function(r){
    var d = r && !r.error && r.data;
    if (!d || !d.ok || !(d.modules || []).length) { carte.hidden = true; return; }
    carte.hidden = false;
    modules = d.modules;
    var sel = $("eq-module");
    if (!sel._branche) {
      sel._branche = true;
      sel.addEventListener("change", function(){ lireModule(sel.value); });
      $("b-eq-composer").addEventListener("click", composer);
    }
    sel.innerHTML = "";
    modules.forEach(function(m){
      var o = eqEl("option", "", (m.icone ? m.icone + " " : "") + m.titre + " — " + m.classe +
        (m.equipes ? " (" + m.equipes + " équipes)" : ""));
      o.value = m.id;
      sel.appendChild(o);
    });
    // D'office : le premier module qui a des équipes, sinon le CPMS.
    var choisi = modules.filter(function(m){ return m.equipes; })[0] ||
                 modules.filter(function(m){ return m.code === "besoins-cpms"; })[0] || modules[0];
    sel.value = String(moduleId || choisi.id);
    return lireModule(sel.value);
  });
}

function lireModule(id){
  moduleId = id;
  return sb.rpc("equipes_module", { p_module_id: Number(id) }).then(function(r){
    var d = r && !r.error && r.data;
    if (!d || !d.ok) { erreur("err-equipes", "Les équipes de ce module n'ont pas pu être lues."); return; }
    erreur("err-equipes", "");
    donnees = d;
    rendreEquipes(d);
  });
}

function quiEq(numero){
  var nom = donnees && nomDe(donnees.module.code, numero);
  return numero + (nom ? " " + prenomSeul(nom) : "");
}

function rendreEquipes(d){
  donnees = d;
  $("eq-texte").value = d.texte || "";
  $("eq-composer").open = !(d.equipes || []).length;
  var z = $("eq-liste");
  z.innerHTML = "";
  var actives = (d.equipes || []).filter(function(q){ return !q.ancienne; });
  $("eq-resume").textContent = actives.length
    ? actives.length + " équipe" + (actives.length > 1 ? "s" : "") +
      ((d.sans_equipe || []).length ? " · sans équipe : " + d.sans_equipe.map(quiEq).join(", ") : " · tout le monde est placé")
    : "Aucune équipe. Composez-les ci-dessous : une équipe par ligne.";
  actives.forEach(function(q){ z.appendChild(carteEquipe(d, q)); });
}

function carteEquipe(d, q){
  var c = eqEl("section", "eq-equipe");
  var t = eqEl("h3", "eq-nom", q.nom);
  if (q.sujet) t.appendChild(eqEl("span", "eq-sujet", " · " + q.sujet));
  c.appendChild(t);
  c.appendChild(eqEl("p", "sous-hint", q.jours + " jour" + (q.jours > 1 ? "s" : "") + " de travail · " +
    q.journaux_jour + "/" + q.membres.length + " journaux aujourd'hui" +
    (q.pairs ? " · points du " + q.pairs.jalon + " : " + q.pairs.repondus + "/" + q.membres.length + " ont réparti" : "")));

  // Les jalons : un bouton par jalon, qui fait défiler pas posé → validé →
  // à reprendre → pas posé. Poser un jalon ouvre la répartition des points.
  var j = eqEl("div", "eq-jalons");
  (d.reperes.jalons || []).forEach(function(r){
    var etat = q.jalons[r.cle] && q.jalons[r.cle].etat;
    var b = eqEl("button", "eq-jalon " + (etat || "vide"));
    b.type = "button";
    b.textContent = r.cle + " · " + (etat ? ETAT_JALON[etat] : r.libelle);
    b.title = r.libelle + (etat ? " — " + ETAT_JALON[etat] : " — pas encore posé") + ". Toucher pour changer.";
    b.addEventListener("click", function(){
      var suivant = !etat ? "valide" : (etat === "valide" ? "a_reprendre" : null);
      b.disabled = true;
      sb.rpc("poser_jalon", { p_equipe_id: q.id, p_jalon: r.cle, p_etat: suivant, p_note: null })
        .then(function(rr){
          b.disabled = false;
          if (!rr || rr.error || !rr.data || !rr.data.ok) { erreur("err-equipes", "Le jalon n'a pas pu être posé."); return; }
          if (suivant === "valide") toast(q.nom + " : " + r.cle + " validé. Les membres peuvent répartir leurs points.");
          lireModule(moduleId);
        });
    });
    j.appendChild(b);
  });
  c.appendChild(j);

  q.membres.forEach(function(m){ c.appendChild(ligneMembre(q, m)); });

  if ((q.recent || []).length) {
    var det = eqEl("details", "plie-in eq-recent");
    det.appendChild(eqEl("summary", "", "Le journal de l'équipe"));
    q.recent.forEach(function(x){
      var p = eqEl("p", "eq-j");
      p.appendChild(eqEl("b", "", quiEq(x.numero) + " · " + new Date(x.jour + "T12:00:00")
        .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "numeric" }) +
        (x.artefact ? " · " + x.artefact : "")));
      p.appendChild(eqEl("span", "", " — " + typo(x.texte)));
      det.appendChild(p);
    });
    c.appendChild(det);
  }
  return c;
}

function ligneMembre(q, m){
  var l = eqEl("div", "vg-l eq-membre g-" + ((m.raisons || []).some(function(r){ return r.gravite === "attention"; })
    ? "attention" : ((m.forces || []).length ? "bien" : "info")));
  l.appendChild(eqEl("span", "pa-num", m.numero));
  var c = eqEl("div", "vg-corps");
  var nom = nomDe(donnees.module.code, m.numero);
  c.appendChild(eqEl("span", "vg-nom", (m.avatar ? m.avatar + " " : "") + (nom ? prenomSeul(nom) : "")));
  var faits = [];
  faits.push(m.journal_jour ? "journal écrit aujourd'hui" : "pas de journal aujourd'hui");
  faits.push(m.journaux + (m.journaux > 1 ? " journaux" : " journal") + " en tout");
  if (m.moteur || m.present || m.rien) faits.push("✓" + m.moteur + " ~" + m.present + " ✗" + m.rien);
  if (m.pairs !== null && m.pairs !== undefined) faits.push("pairs " + m.pairs + " % (égal " + m.part_egale + " %)");
  c.appendChild(eqEl("span", "vg-r", faits.join(" · ")));
  (m.raisons || []).forEach(function(r){ c.appendChild(eqEl("span", "vg-r g-" + r.gravite, r.texte)); });
  (m.forces || []).forEach(function(t){ c.appendChild(eqEl("span", "vg-r g-bien", t)); });
  if (m.dernier) {
    c.appendChild(eqEl("span", "eq-dernier", "« " + typo(m.dernier.texte) + " »" +
      (m.dernier.artefact ? " — " + m.dernier.artefact : "")));
  }
  l.appendChild(c);

  // L'appréciation du jour : trois boutons, un seul allumé. Re-toucher
  // l'allumé l'efface (une erreur de pouce se rattrape).
  var a = eqEl("div", "eq-apprecier");
  a.setAttribute("role", "group");
  a.setAttribute("aria-label", "Appréciation du jour pour le " + m.numero);
  NIVEAUX.forEach(function(n){
    var b = eqEl("button", "eq-niv " + n[0] + (m.niveau_jour === n[0] ? " on" : ""), n[1]);
    b.type = "button";
    b.title = n[2];
    b.setAttribute("aria-label", n[2]);
    b.setAttribute("aria-pressed", m.niveau_jour === n[0] ? "true" : "false");
    b.addEventListener("click", function(){
      var voulu = m.niveau_jour === n[0] ? null : n[0];
      a.querySelectorAll("button").forEach(function(x){ x.disabled = true; });
      sb.rpc("apprecier", { p_equipe_id: q.id, p_eleve_id: m.eleve_id, p_niveau: voulu }).then(function(r){
        a.querySelectorAll("button").forEach(function(x){ x.disabled = false; });
        if (!r || r.error || !r.data || !r.data.ok) { erreur("err-equipes", "L'appréciation n'a pas été enregistrée."); return; }
        m.niveau_jour = voulu;
        a.querySelectorAll("button").forEach(function(x, i){
          var on = NIVEAUX[i][0] === voulu;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
    });
    a.appendChild(b);
  });
  l.appendChild(a);
  return l;
}

function composer(){
  var b = $("b-eq-composer");
  var texte = $("eq-texte").value;
  if (!texte.trim()) { erreur("err-eq-composer", "Écrivez au moins une équipe : « Nom : 03 07 11 »."); return; }
  b.disabled = true;
  sb.rpc("definir_equipes", { p_module_id: Number(moduleId), p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      erreur("err-eq-composer", (d && d.motif === "ligne") ? "Ligne " + d.rang + " : " + d.detail + " — « " + d.texte + " »"
        : (d && d.motif === "vide") ? "Aucune équipe lisible dans ce texte."
        : "Enregistrement refusé. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-eq-composer", d.equipes + " équipe" + (d.equipes > 1 ? "s" : "") + ", " + d.membres +
      " étudiants placés." + (d.gardees ? " " + d.gardees + " ancienne(s) équipe(s) gardée(s) : elles ont un historique." : ""), true);
    chargerEquipes();
  });
}

// ═══ Côté étudiant ═════════════════════════════════════════════════════════
function chargerEquipeEtu(){
  var z = $("equipe-etu");
  if (!z) return;
  sb.rpc("mon_equipe").then(function(r){
    z.innerHTML = "";
    // Fonction pas déployée, ou pas d'équipe : rien ne s'affiche.
    if (!r || r.error || !r.data || !r.data.ok) return;
    (r.data.equipes || []).forEach(function(q){ z.appendChild(carteEtu(r.data.reperes, q)); });
  });
}

function carteEtu(rep, q){
  var c = eqEl("div", "card eq-etu");
  c.id = "eq-etu-" + q.id;
  c.appendChild(eqEl("h2", "", "Votre équipe — " + q.nom));
  c.appendChild(eqEl("p", "hint", (q.module.icone ? q.module.icone + " " : "") + q.module.titre +
    (q.sujet ? " · " + q.sujet : "") + " · " +
    q.membres.map(function(m){ return (m.avatar || "") + " " + m.numero + (m.moi ? " (vous)" : ""); }).join(", ")));

  var j = eqEl("p", "eq-jalons-etu");
  (rep.jalons || []).forEach(function(x){
    var e = q.jalons[x.cle];
    j.appendChild(eqEl("span", "eq-jalon " + (e || "vide"), x.cle + " " + (e ? ETAT_JALON[e] : x.libelle)));
  });
  c.appendChild(j);

  // Le journal du jour.
  var f = eqEl("form", "eq-journal");
  f.appendChild(eqEl("p", "eq-q", "En fin de séance : qu'avez-vous fait aujourd'hui pour l'équipe ?"));
  var sel = eqEl("select", "");
  sel.setAttribute("aria-label", "Artefact travaillé");
  sel.appendChild(eqEl("option", "", "Artefact (facultatif)"));
  sel.options[0].value = "";
  (rep.artefacts || []).forEach(function(a){
    var o = eqEl("option", "", a.cle + " — " + a.libelle);
    o.value = a.cle;
    sel.appendChild(o);
  });
  var ta = eqEl("textarea", "");
  ta.rows = 2; ta.maxLength = 400;
  ta.placeholder = "Une ligne : ce que vous avez produit, relu, décidé…";
  ta.setAttribute("aria-label", "Ce que vous avez fait aujourd'hui");
  if (q.journal) { ta.value = q.journal.texte; sel.value = q.journal.artefact || ""; }
  var b = eqEl("button", "btn", q.journal ? "Mettre à jour mon journal" : "Écrire mon journal");
  b.type = "submit";
  var err = eqEl("div", "");
  err.id = "err-eq-j-" + q.id;
  err.setAttribute("aria-live", "polite");
  f.appendChild(sel); f.appendChild(ta); f.appendChild(b); f.appendChild(err);
  f.addEventListener("submit", function(ev){
    ev.preventDefault();
    b.disabled = true;
    sb.rpc("ecrire_journal", { p_equipe_id: q.id, p_artefact: sel.value || null, p_texte: ta.value })
      .then(function(r){
        b.disabled = false;
        var d = r && r.data;
        if (!r || r.error || !d || !d.ok) {
          erreur(err.id, (d && d.motif === "court") ? "Une phrase au moins : qu'avez-vous fait ?"
            : (d && d.motif === "long") ? "400 caractères au plus."
            : texteEnvoi(r && r.error, "journal"));
          signalerSessionPerimee(r && r.error);
          return;
        }
        b.textContent = "Mettre à jour mon journal";
        erreur(err.id, "C'est noté pour aujourd'hui. Vous pouvez le compléter jusqu'à ce soir.", true);
      });
  });
  c.appendChild(f);

  if (q.pairs) c.appendChild(blocPairs(q));
  return c;
}

// Répartir 100 points : un curseur par membre, le total affiché en direct,
// « Envoyer » allumé seulement à 100. Partir de la part égale : c'est l'écart
// qu'on demande, pas une note à inventer de zéro.
function blocPairs(q){
  var z = eqEl("div", "eq-pairs");
  z.appendChild(eqEl("p", "eq-q", "Jalon " + q.pairs.jalon + " posé : répartissez 100 points entre les membres, " +
    "vous compris, selon la part de travail de chacun. Personne d'autre que l'enseignant ne voit vos points."));
  var mes = q.pairs.mes_points || {};
  var egal = Math.floor(100 / q.membres.length);
  var champs = [];
  var total = eqEl("p", "eq-total");
  var b = eqEl("button", "btn", Object.keys(mes).length ? "Modifier ma répartition" : "Envoyer ma répartition");
  b.type = "button";
  var err = eqEl("div", "");
  err.id = "err-eq-p-" + q.id;
  err.setAttribute("aria-live", "polite");
  var maj = function(){
    var s = champs.reduce(function(a, c){ return a + (parseInt(c.input.value, 10) || 0); }, 0);
    total.textContent = "Total : " + s + " / 100";
    total.className = "eq-total " + (s === 100 ? "ok" : "att");
    b.disabled = s !== 100;
  };
  q.membres.forEach(function(m, i){
    var l = eqEl("label", "eq-p-l");
    l.appendChild(eqEl("span", "eq-p-n", (m.avatar || "") + " " + m.numero + (m.moi ? " (vous)" : "")));
    var inp = eqEl("input", "");
    inp.type = "number"; inp.min = 0; inp.max = 100; inp.inputMode = "numeric";
    inp.value = mes[m.eleve_id] !== undefined ? mes[m.eleve_id]
              : (i === 0 ? 100 - egal * (q.membres.length - 1) : egal);
    inp.addEventListener("input", maj);
    l.appendChild(inp);
    z.appendChild(l);
    champs.push({ m: m, input: inp });
  });
  z.appendChild(total);
  z.appendChild(b);
  z.appendChild(err);
  maj();
  b.addEventListener("click", function(){
    var pts = {};
    champs.forEach(function(c){ pts[c.m.eleve_id] = parseInt(c.input.value, 10) || 0; });
    b.disabled = true;
    sb.rpc("repartir_points", { p_equipe_id: q.id, p_points: pts }).then(function(r){
      maj();
      var d = r && r.data;
      if (!r || r.error || !d || !d.ok) {
        erreur(err.id, (d && d.motif === "total") ? "Le total doit faire 100."
          : (d && d.motif === "membres") ? "Donnez des points à chaque membre, vous compris."
          : texteEnvoi(r && r.error, "points"));
        return;
      }
      b.textContent = "Modifier ma répartition";
      erreur(err.id, "Répartition enregistrée pour le " + d.jalon + ".", true);
    });
  });
  return z;
}

export { chargerEquipes, rendreEquipes, chargerEquipeEtu };
