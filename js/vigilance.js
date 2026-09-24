// ── « À aller voir » : qui aider, maintenant, et pourquoi ─────────────────
//
// Quatorzième module. Né le 24/09/2026 d'un constat simple : le quiz est à la
// fin de la trace, et pendant les actes — de la 10e à la 50e minute — le
// portail ne recevait RIEN. Un étudiant qui décrochait à l'acte I n'était
// visible qu'à la 50e minute, quand il n'y avait plus rien à rattraper.
//
// Trois sources nouvelles, toutes lues par `vigilance_seance()` :
//
//   · les POINTS DE PASSAGE — une question à la fin de chaque acte, qui dit
//     où en est chacun pendant l'heure, et non plus seulement à la fin ;
//   · la MAIN LEVÉE — « Je bloque ici », le seul signal que l'étudiant
//     choisit d'envoyer, et le seul qui passe avant tous les autres ;
//   · les RÈGLES — silence, retard d'acte, erreurs en série, réponses trop
//     rapides, sûr et faux, humeur « perdu ».
//
// DES RAISONS, JAMAIS UN SCORE. Un « indice de difficulté à 0,73 » ne dit pas
// quoi faire en arrivant à côté de quelqu'un. « Plus rien depuis 12 min »,
// si. Chaque ligne porte donc des phrases, écrites par la base — le portail
// ne les réécrit pas, pour qu'un seuil ne vive qu'à un seul endroit.
//
// NOMINATIF, DONC JAMAIS PROJETÉ. Cette carte est un écran d'enseignant ;
// l'écran projeté ne la lit pas.
//
// Et une seconde lecture, plus lente : « Sur le semestre », qui repère ce
// qu'une séance ne voit pas — la répétition. Deux absences sur trois, deux
// séances muettes, une réussite qui reste sous 40 %.

import { $, sb, suivi, erreur, nomDe, prenomSeul } from './socle.js';

// L'ordre dans lequel on se déplace. C'est aussi l'ordre d'affichage.
var GRAVITES = ["urgent", "attention", "a_suivre", "info"];
var NOM_GRAVITE = { urgent: "tout de suite", attention: "à aller voir",
                    a_suivre: "à surveiller", info: "à noter" };

var ROMAINS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function chargerVigilance(apres){
  var bloc = $("bloc-vigilance");
  if (!suivi.seanceId) { bloc.hidden = true; suivi.vigilance = null; return Promise.resolve(); }
  return sb.rpc("vigilance_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    var d = r && !r.error && r.data;
    // Fonction absente (migration pas encore appliquée), appel ou
    // questionnaire : on masque, sans message d'erreur en pleine séance.
    if (!d || !d.ok) { bloc.hidden = true; suivi.vigilance = null; if (apres) apres(); return; }
    suivi.vigilance = d;
    bloc.hidden = false;
    rendreVigilance(d);
    if (apres) apres();
  });
}

function rangDe(x){
  var r = (x.raisons || []).map(function(g){ return GRAVITES.indexOf(g.gravite); });
  return r.length ? Math.min.apply(null, r) : 99;
}

function rendreVigilance(d){
  var eleves = (d.eleves || []).filter(function(x){ return (x.raisons || []).length; });
  // D'abord la gravité la plus haute, puis le nombre de raisons, puis le
  // numéro : l'ordre dans lequel on va les voir.
  eleves.sort(function(a, b){
    return (rangDe(a) - rangDe(b)) ||
           ((b.raisons.length) - (a.raisons.length)) ||
           (a.numero < b.numero ? -1 : 1);
  });

  var urgents = eleves.filter(function(x){ return rangDe(x) === 0; }).length;
  var compte = $("vg-compte");
  compte.textContent = eleves.length ? String(eleves.length) : "";
  compte.className = "vg-compte" + (urgents ? " urgent" : "");

  var z = $("vg-liste");
  z.innerHTML = "";
  eleves.forEach(function(x){ z.appendChild(ligneVigilance(d, x)); });

  $("vg-vide").textContent = eleves.length ? "" :
    (d.minutes === null || d.minutes === undefined
      ? "Rien à signaler. Les règles de temps (silence, retard d'acte) ne " +
        "s'allument qu'une fois la séance démarrée."
      : "Personne à aller voir pour l'instant.");
  $("vg-vide").hidden = !!eleves.length;

  rendreActes(d);

  var s = d.seuils || {};
  $("vg-seuils").textContent =
    "Silence : " + (s.silence_min || 8) + " min sans rien · retard : " +
    (s.grace_min || 3) + " min après la fin prévue d'un acte · trop rapide : moins de " +
    (s.rapide_s || 5) + " s entre deux réponses.";
}

function ligneVigilance(d, x){
  var l = document.createElement("div");
  l.className = "vg-l g-" + GRAVITES[rangDe(x)];

  var n = document.createElement("span");
  n.className = "pa-num";
  n.textContent = x.numero;
  l.appendChild(n);

  var corps = document.createElement("div");
  corps.className = "vg-corps";
  var nom = nomDe(d.code, x.numero);
  if (nom) {
    var p = document.createElement("span");
    p.className = "vg-nom";
    p.textContent = prenomSeul(nom);
    corps.appendChild(p);
  }
  (x.raisons || []).forEach(function(g){
    var r = document.createElement("span");
    r.className = "vg-r g-" + g.gravite;
    r.title = NOM_GRAVITE[g.gravite] || "";
    r.textContent = g.texte;
    corps.appendChild(r);
  });
  l.appendChild(corps);

  // La main levée se ferme d'ici : « vu » dit à l'étudiant que quelqu'un
  // arrive, et retire la ligne de l'urgence sans effacer la trace.
  if (x.main && !x.main.vue) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec vg-vu";
    b.textContent = "Vu";
    b.setAttribute("aria-label", "Main levée du " + x.numero + " : vue");
    b.addEventListener("click", function(){
      b.disabled = true;
      sb.rpc("main_vue", { p_main_id: Number(x.main.id) }).then(function(r){
        if (r && r.error) { b.disabled = false; erreur("err-vigilance", "La main n'a pas pu être marquée vue : " + r.error.message); return; }
        chargerVigilance();
      });
    });
    l.appendChild(b);
  }
  return l;
}

// L'entonnoir des actes : combien ont passé chaque point, et lequel on
// attend. C'est ce qui manquait pendant les trois quarts de l'heure.
function rendreActes(d){
  var z = $("vg-actes");
  z.innerHTML = "";
  var actes = d.actes || [];
  z.hidden = !actes.length;
  if (!actes.length) return;

  var t = document.createElement("p");
  t.className = "vg-t";
  t.textContent = "Les points de passage";
  z.appendChild(t);

  var total = d.inscrits || 0;
  actes.forEach(function(a){
    var l = document.createElement("div");
    l.className = "pa-e" + (a.acte === d.attendu_acte ? " vg-attendu" : "");
    var n = document.createElement("span");
    n.className = "pa-e-n";
    n.textContent = "Acte " + (ROMAINS[a.acte] || a.acte) + " · " + a.fin_min + "′";
    n.title = a.titre;
    l.appendChild(n);
    var j = document.createElement("span");
    j.className = "pa-e-j";
    var f = document.createElement("span");
    f.style.width = (total ? Math.round(a.faits / total * 100) : 0) + "%";
    j.appendChild(f);
    l.appendChild(j);
    var c = document.createElement("span");
    c.className = "pa-e-c";
    c.textContent = a.faits + " / " + total +
      (a.question && a.faits ? " · " + a.justes + " juste" + (a.justes > 1 ? "s" : "") : "");
    l.appendChild(c);
    z.appendChild(l);
  });
}

// ── Sur le semestre ────────────────────────────────────────────────────────
function chargerASuivre(classeId){
  var bloc = $("bloc-asuivre");
  if (!classeId) { bloc.hidden = true; return Promise.resolve(); }
  return sb.rpc("eleves_a_suivre", { p_classe_id: Number(classeId) }).then(function(r){
    var d = r && !r.error && r.data;
    if (!d || !d.ok) { bloc.hidden = true; return; }
    bloc.hidden = false;
    rendreASuivre(d);
  });
}

function rendreASuivre(d){
  var eleves = d.eleves || [];
  $("as-titre").textContent = "Sur le semestre : " +
    (eleves.length ? eleves.length + " étudiant" + (eleves.length > 1 ? "s" : "") + " à suivre"
                   : "personne à signaler");
  var z = $("as-liste");
  z.innerHTML = "";
  var h = document.createElement("p");
  h.className = "sous-hint";
  h.textContent = "Sur les " + (d.appels || 0) + " derniers appels et les " +
    (d.seances || 0) + " dernières séances jouées. Un étudiant en avance n'est " +
    "jamais signalé pour cela.";
  z.appendChild(h);
  var code = d.code;
  eleves.forEach(function(x){
    var l = document.createElement("div");
    l.className = "vg-l g-attention";
    var n = document.createElement("span");
    n.className = "pa-num";
    n.textContent = x.numero;
    l.appendChild(n);
    var c = document.createElement("div");
    c.className = "vg-corps";
    var nom = nomDe(code, x.numero);
    if (nom) {
      var p = document.createElement("span");
      p.className = "vg-nom";
      p.textContent = prenomSeul(nom);
      c.appendChild(p);
    }
    (x.raisons || []).forEach(function(t){
      var r = document.createElement("span");
      r.className = "vg-r g-attention";
      r.textContent = t;
      c.appendChild(r);
    });
    l.appendChild(c);
    z.appendChild(l);
  });
}

export { chargerVigilance, rendreVigilance, rendreActes, chargerASuivre, rendreASuivre };
