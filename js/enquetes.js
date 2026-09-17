// ── Les deux enquêtes de l'année ──────────────────────────────────────────
//
// « Faisons connaissance » (séance 98) et « Recherche de stage » (97). Elles ne
// sont pas dans la bibliothèque parce qu'elles n'y étaient pas quand la
// bibliothèque a été écrite, et elles y viendront peut-être ; en attendant,
// elles ont ceci de commun qui justifie un module : `bonne_reponse = 'Z'`,
// aucune réponse n'est juste, et ce qu'on en lit est une RÉPARTITION avec les
// numéros en face — savoir que trois étudiants n'ont pas d'ordinateur ne sert
// à rien si on ignore lesquels.
//
// Elles diffèrent sur un point, et c'est le plus intéressant : la connaissance
// se répond UNE FOIS dans l'année, le stage SE RÉVISE. La bonne réponse d'hier
// y est fausse demain, et c'est l'évolution qu'on veut lire — d'où la date de
// dernière mise à jour à côté de chaque numéro. Une promotion « à jour » depuis
// six semaines ne dit plus rien de vrai.
//
// L'ordre des options du stage va toujours DU MOINS AU PLUS AVANCÉ : c'est ce
// qui permet de lire la première colonne comme « ceux qu'il faut aider ». Ne
// pas réordonner sans réordonner la lecture qui en dépend.
//
// SIGNAUX est la table qui transforme une réponse en décision pédagogique :
// une ligne { q, lettres, quoi } par réponse qui appelle un geste. Ajouter une
// ligne suffit à faire remonter un signal.

import { $, sb, erreur, typo, dateCourte, nomDe } from './socle.js';
// `ligneNumeros` et `numerosAbsents` viennent de l'appel : une enquête se
// dépouille avec la même rangée de numéros qu'une présence, et la dupliquer
// ferait deux façons d'afficher la même chose.
import { ligneNumeros, numerosAbsents } from './appel.js';

// Une répartition par question, et sous chaque option les numéros de ceux qui
// l'ont choisie : c'est ce qui distingue un camembert d'une information. Savoir
// que trois étudiants n'ont pas d'ordinateur ne sert à rien si on ignore
// lesquels.
function chargerConnaissance(classes){
  var carte = $("carte-connaissance"), z = $("conn-classes");
  z.innerHTML = "";
  carte.hidden = true;
  if (!classes || !classes.length) return;

  var restant = classes.length, affiches = 0;
  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "appel-classe";
    bloc.hidden = true;
    z.appendChild(bloc);

    sb.rpc("connaissance_classe", { p_classe_id: Number(c.id) }).then(function(r){
      restant--;
      var d = (r && !r.error && r.data && r.data.ok) ? r.data : null;
      if (d) { remplirConnaissanceClasse(bloc, c, d); bloc.hidden = false; affiches++; }
      if (restant === 0) carte.hidden = affiches === 0;
    });
  });
}

// Les réponses qui demandent une décision pédagogique, pas seulement une
// statistique. Ajouter une ligne ici suffit à faire remonter un signal.
var SIGNAUX = [
  { q: "conn-04", lettres: ["C","D"], quoi: "pas d'ordinateur à la maison" },
  { q: "conn-05", lettres: ["C","D"], quoi: "connexion faible ou absente" },
  { q: "conn-02", lettres: ["A"],     quoi: "n'a jamais écrit de code" },
  { q: "conn-06", lettres: ["A"],     quoi: "moins d'une heure de travail perso par semaine" },
  { q: "conn-11", lettres: ["D"],     quoi: "s'arrête et attend quand il bloque" },
  { q: "conn-07", lettres: ["D"],     quoi: "orientation par défaut" }
];

function remplirConnaissanceClasse(bloc, c, d){
  bloc.innerHTML = "";
  var h = document.createElement("h3");
  h.textContent = c.nom || c.code;
  bloc.appendChild(h);

  var nq = Number(d.total_questions) || 0;
  var compte = document.createElement("p");
  compte.className = "ac-compte";
  compte.innerHTML = "<b></b> · <span class=\"hint\"></span>";
  compte.querySelector("b").textContent =
    (d.termines || 0) + " / " + (d.inscrits || 0) + " ont terminé";
  compte.querySelector("span").textContent = nq + " questions";
  bloc.appendChild(compte);

  // Ceux qui n'ont pas fini : les numéros d'abord, comme pour l'appel.
  var pas = (d.eleves || []).filter(function(e){ return (Number(e.faites) || 0) < nq; });
  bloc.appendChild(ligneNumeros(c, pas.map(function(e){ return { numero: e.numero }; }),
                                "À relancer", "Tout le monde a répondu."));

  (d.questions || []).forEach(function(q){
    bloc.appendChild(rendreQuestionConnaissance(c, q));
  });

  var sig = rendreSignaux(c, d);
  if (sig) bloc.appendChild(sig);
}

function rendreQuestionConnaissance(c, q){
  var z = document.createElement("div");
  z.className = "cn-q";
  var t = document.createElement("span");
  t.className = "cn-int";
  t.textContent = typo(q.intitule || q.question);
  z.appendChild(t);

  var lettres = ["A","B","C","D"], compte = q.compte || {}, qui = q.qui || {};
  var total = lettres.reduce(function(s, l){ return s + (Number(compte[l]) || 0); }, 0);
  if (!total) {
    var v = document.createElement("p");
    v.className = "hint";
    v.style.margin = "0";
    v.textContent = "Aucune réponse pour l'instant.";
    z.appendChild(v);
    return z;
  }

  (q.options || []).forEach(function(libelle, i){
    var l = lettres[i], n = Number(compte[l]) || 0;
    var ligne = document.createElement("div");
    ligne.className = "jalon";
    ligne.innerHTML = '<span class="jalon-n"></span><span class="jalon-b"></span><span></span>';
    ligne.querySelector(".jalon-n").textContent = l + " · " + n;
    ligne.querySelector(".jalon-b").style.width = Math.round(n / total * 45) + "%";
    ligne.querySelector("span:last-child").textContent = libelle;
    z.appendChild(ligne);

    var nums = qui[l] || [];
    if (nums.length) {
      var d2 = document.createElement("div");
      d2.className = "cn-nums";
      d2.textContent = nums.join(" ");
      z.appendChild(d2);
    }
  });
  return z;
}

function rendreSignaux(c, d){
  var parCle = {};
  (d.questions || []).forEach(function(q){ parCle[q.question] = q; });

  var lignes = [];
  SIGNAUX.forEach(function(sg){
    var q = parCle[sg.q];
    if (!q) return;
    var nums = [];
    sg.lettres.forEach(function(l){ nums = nums.concat((q.qui || {})[l] || []); });
    nums = numerosAbsents(nums.map(function(n){ return { numero: n }; }));
    if (nums.length) lignes.push({ quoi: sg.quoi, nums: nums });
  });
  if (!lignes.length) return null;

  var z = document.createElement("div");
  z.className = "cn-sig";
  var h = document.createElement("h4");
  h.textContent = "À prendre en compte";
  z.appendChild(h);
  var ul = document.createElement("ul");
  lignes.forEach(function(x){
    var li = document.createElement("li");
    var b = document.createElement("b");
    b.textContent = x.nums.map(function(n){
      var nom = nomDe(c.code, n);
      return nom ? n + " " + nom : "n° " + n;
    }).join(", ");
    li.appendChild(b);
    li.appendChild(document.createTextNode(" — " + x.quoi));
    ul.appendChild(li);
  });
  z.appendChild(ul);
  return z;
}

// La première chose à voir n'est pas une statistique mais une liste de
// numéros par étape, du moins avancé au plus avancé : ceux qui n'ont pas
// commencé sont en haut, en rouge, parce que ce sont eux qu'il faut appeler.
function chargerStage(classes){
  var carte = $("carte-stage"), z = $("stage-classes");
  z.innerHTML = "";
  carte.hidden = true;
  if (!classes || !classes.length) return;

  var restant = classes.length, affiches = 0;
  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "appel-classe";
    bloc.hidden = true;
    z.appendChild(bloc);

    sb.rpc("stage_classe", { p_classe_id: Number(c.id) }).then(function(r){
      restant--;
      var d = (r && !r.error && r.data && r.data.ok) ? r.data : null;
      if (d) { remplirStageClasse(bloc, c, d); bloc.hidden = false; affiches++; }
      if (restant === 0) carte.hidden = affiches === 0;
    });
  });
}

function remplirStageClasse(bloc, c, d){
  bloc.innerHTML = "";
  var h = document.createElement("h3");
  h.textContent = c.nom || c.code;
  bloc.appendChild(h);

  var compte = document.createElement("p");
  compte.className = "ac-compte";
  compte.innerHTML = "<b></b> · <span class=\"hint\"></span>";
  compte.querySelector("b").textContent =
    (d.repondu || 0) + " / " + (d.inscrits || 0) + " ont fait leur point";
  compte.querySelector("span").textContent = d.maj
    ? "dernière mise à jour le " + dateCourte(d.maj) : "aucune réponse pour l'instant";
  bloc.appendChild(compte);

  // Les quatre étapes, plus ceux qui n'ont rien dit — qui comptent double,
  // puisqu'on ne sait même pas s'ils cherchent.
  var etapes = d.etapes || ["Pas commencé", "En préparation", "Candidatures envoyées", "Trouvé"];
  var lettres = ["A","B","C","D"], etats = d.etats || [];
  lettres.forEach(function(l, i){
    var gens = etats.filter(function(e){ return e.ou === l; });
    bloc.appendChild(ligneEtape(c, "et-" + i, etapes[i] || l, gens));
  });
  var muets = etats.filter(function(e){ return !e.ou; });
  bloc.appendChild(ligneEtape(c, "et-x", "N'a rien déclaré", muets));

  (d.questions || []).forEach(function(q){
    if (q.question === "stage-01") return;   // déjà lue en haut, autrement
    bloc.appendChild(rendreQuestionConnaissance(c, q));
  });
}

function ligneEtape(c, classe, libelle, gens){
  var z = document.createElement("div");
  z.className = "et-etape " + classe;
  var t = document.createElement("div");
  t.className = "et-tete";
  var b = document.createElement("b");
  b.textContent = gens.length + " · " + libelle;
  t.appendChild(b);
  z.appendChild(t);
  if (!gens.length) return z;

  var nums = document.createElement("div");
  nums.className = "et-nums";
  // Le numéro d'abord, le nom s'il est connu, la fraîcheur ensuite : on lit
  // « 07 — 12/09 » comme « ce point date d'il y a trois semaines ».
  nums.textContent = gens.map(function(e){
    var nom = nomDe(c.code, e.numero);
    return e.numero + (nom ? " " + nom : "") + (e.maj ? " (" + e.maj + ")" : "");
  }).join("   ");
  z.appendChild(nums);
  return z;
}

export { chargerConnaissance, chargerStage, remplirConnaissanceClasse };
