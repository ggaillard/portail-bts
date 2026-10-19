// ── Ce que la séance apprend, et ce que chacun doit reprendre ─────────────
//
// 19/10/2026. L'onglet Bilan d'une séance disait ce qui s'était passé :
// présents, réussite, concepts. Il ne disait ni ce qu'il fallait CHANGER
// dans la séance pour la prochaine fois, ni ce que chaque étudiant devait
// REPRENDRE — deux questions qu'on se pose le soir même, et auxquelles on
// répondait en relisant trois écrans.
//
// `analyse_seance()` (20261019090000) répond aux deux, en base :
//   · `points` — des phrases sur la séance elle-même : un acte nettement plus
//     long que prévu, une question ratée et son distracteur partagé, une
//     question qu'on va chercher hors de la page, une question répondue sans
//     lire, l'endroit où ceux qui n'ont pas fini se sont arrêtés, les mains
//     levées concentrées sur un acte ;
//   · `actes` et `questions` — les chiffres derrière ces phrases ;
//   · `eleves` — pour chacun, une priorité (à revoir, à surveiller, ok,
//     absent), ses raisons, les questions fausses et les CONCEPTS à reprendre.
//
// Deux sorties, toutes deux sur l'appareil seulement : « Copier les retours »
// (un paragraphe par étudiant, au vouvoiement, prêt à coller dans un e-mail)
// et le CSV. Les prénoms viennent de la table locale, jamais de la base.
//
// Mêmes règles que partout : des phrases, pas un score ; « — » quand rien
// n'a été mesuré ; jamais projeté.

import { sb, typo, nomDe, prenomSeul, copierTexte } from './socle.js';
import { telechargerCsv } from './exporter.js';

var PRIORITE = {
  a_revoir: ["att", "à revoir"],
  a_surveiller: ["neutre", "à surveiller"],
  ok: ["ok", "ça va"],
  absent: ["neutre", "absent"]
};
var GRAVITE = { attention: ["att", "à changer"], a_suivre: ["neutre", "à regarder"], info: ["ok", "à noter"] };
var ROMAINS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function rendreAnalyse(s, z){
  if (!z) return Promise.resolve();
  return sb.rpc("analyse_seance", { p_seance_id: Number(s.id) }).then(function(r){
    var a = r && !r.error && r.data;
    z.innerHTML = "";
    // Fonction absente, projet, séance sans étapes : rien, sans message —
    // le bilan au-dessus suffit.
    if (!a || !a.ok || !a.jouee) return;
    anTitre(z, "h3", "Ce que la séance apprend");
    anRendrePoints(z, a);
    anRendreActes(z, a);
    anRendreQuestions(z, a);
    anRendreEleves(z, a);
  }, function(){ z.innerHTML = ""; });
}

function anRendrePoints(z, a){
  var p = document.createElement("p");
  p.className = "sous-hint";
  p.textContent = a.presents + " présent" + (a.presents > 1 ? "s" : "") + " sur " + a.inscrits +
    " · " + a.finis + " ont fini les " + a.etapes + " étapes" +
    (a.duree_mediane_min ? " · " + a.duree_mediane_min + " min en médiane pour ceux qui ont fini" : "");
  z.appendChild(p);
  if (!a.points.length) {
    z.appendChild(anPhrase("Rien à changer de flagrant : aucun acte n'a débordé, aucune question n'est sous 50 %."));
    return;
  }
  var ul = document.createElement("ul");
  ul.className = "an-points";
  a.points.forEach(function(x){
    var g = GRAVITE[x.gravite] || GRAVITE.info;
    var li = document.createElement("li");
    li.appendChild(anBadge(g[0], g[1]));
    var t = document.createElement("span");
    t.textContent = typo(x.texte);
    li.appendChild(t);
    ul.appendChild(li);
  });
  z.appendChild(ul);
}

function anRendreActes(z, a){
  var actes = (a.actes || []).filter(function(x){ return x.prevu_min; });
  if (!actes.length) return;
  var d = anDetails(z, "Les actes : prévu et réel");
  var t = anTable(d, ["Acte", "Prévu", "Réel (médiane)", "Passé par"]);
  actes.forEach(function(x){
    var tr = document.createElement("tr");
    var long = x.reel_min !== null && x.reel_min !== undefined && x.reel_min > x.prevu_min * 1.3 + 2;
    if (long) tr.className = "long";
    anCellules(tr, [ROMAINS[x.acte] || x.acte, x.prevu_min + " min",
      x.reel_min === null || x.reel_min === undefined ? "— (moins de 5 mesures)" : anVirgule(x.reel_min) + " min",
      x.passes]);
    t.appendChild(tr);
  });
  d.appendChild(anPhrase("Le réel va du passage de l'acte précédent au passage de celui-ci ; le premier part du démarrage. " +
                       "En orange : plus d'un tiers au-delà du prévu."));
}

function anRendreQuestions(z, a){
  var qs = a.questions || [];
  if (!qs.length) return;
  var d = anDetails(z, "Les questions, dans l'ordre de la page");
  var t = anTable(d, ["Q", "Juste", "Piège le plus choisi", "Temps", "Sans lire", "Quitté la page"]);
  qs.forEach(function(q){
    var tr = document.createElement("tr");
    if (q.taux !== null && q.taux !== undefined && q.taux < 50) tr.className = "long";
    var piege = q.piege && q.piege_n
      ? q.piege + " — « " + (q.options && q.options["ABCD".indexOf(q.piege)] || "") + " » (" + q.piege_n + ")" : "—";
    anCellules(tr, [q.numero,
      q.taux === null || q.taux === undefined ? "—" : q.taux + " % (" + q.justes + "/" + q.repondants + ")",
      piege,
      q.mediane_s ? anDuree(q.mediane_s) : "—",
      q.sans_lire || "—", q.sorties || "—"], [1, 3, 4, 5]);
    tr.title = q.intitule || "";
    t.appendChild(tr);
  });
  d.appendChild(anPhrase("Le temps d'une question : de l'étape d'avant à sa réponse — la lecture du passage qui y mène comprise."));
}

function anRendreEleves(z, a){
  var eleves = a.eleves || [];
  if (!eleves.length) return;
  anTitre(z, "h4", "Étudiant par étudiant : ce qu'il faut reprendre");
  var n = { a_revoir: 0, a_surveiller: 0, ok: 0, absent: 0 };
  eleves.forEach(function(x){ n[x.priorite] = (n[x.priorite] || 0) + 1; });
  z.appendChild(anPhrase(n.a_revoir + " à revoir · " + n.a_surveiller + " à surveiller · " + n.ok +
    " sans rien à signaler · " + n.absent + " absent" + (n.absent > 1 ? "s" : "") + " (à rattraper)."));

  var filtres = document.createElement("div");
  filtres.className = "an-filtres";
  filtres.setAttribute("role", "group");
  filtres.setAttribute("aria-label", "Filtrer les étudiants");
  var liste = document.createElement("div");
  liste.className = "an-eleves";
  var choix = "a_revoir";
  [["a_revoir", "À revoir"], ["a_surveiller", "À surveiller"], ["absent", "Absents"], ["tous", "Tous"]].forEach(function(f){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "filtre" + (f[0] === choix ? " on" : "");
    b.setAttribute("aria-pressed", f[0] === choix ? "true" : "false");
    b.textContent = f[1] + (f[0] !== "tous" ? " (" + (n[f[0]] || 0) + ")" : "");
    b.addEventListener("click", function(){
      choix = f[0];
      Array.prototype.forEach.call(filtres.children, function(x){
        var on = x === b;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      anRemplir();
    });
    filtres.appendChild(b);
  });
  z.appendChild(filtres);
  z.appendChild(liste);

  function anRemplir(){
    liste.innerHTML = "";
    var vus = eleves.filter(function(x){ return choix === "tous" || x.priorite === choix; });
    if (!vus.length) { liste.appendChild(anPhrase("Personne dans ce groupe.")); return; }
    vus.forEach(function(x){ liste.appendChild(anCarteEleve(a, x)); });
  }
  anRemplir();

  var p = document.createElement("div");
  p.className = "pick";
  var copier = document.createElement("button");
  copier.type = "button";
  copier.className = "btn btn-sec";
  copier.textContent = "Copier les retours individuels";
  copier.addEventListener("click", function(){ copierTexte(anRetours(a), copier); });
  var csv = document.createElement("button");
  csv.type = "button";
  csv.className = "btn btn-sec";
  csv.textContent = "Télécharger (CSV)";
  csv.addEventListener("click", function(){
    telechargerCsv("analyse-" + a.code + "-seance-" + a.numero + ".csv", anLignesCsv(a));
  });
  p.appendChild(copier);
  p.appendChild(csv);
  z.appendChild(p);
  z.appendChild(anPhrase("Les retours sont au vouvoiement, un paragraphe par étudiant présent qui a quelque chose à reprendre. " +
                       "Les prénoms viennent de ce navigateur : rien ne part vers la base."));
}

function anCarteEleve(a, x){
  var d = document.createElement("div");
  d.className = "an-el";
  var t = document.createElement("div");
  t.className = "an-el-tete";
  var num = document.createElement("strong");
  num.textContent = anNommer(a.code, x.numero);
  t.appendChild(num);
  var p = PRIORITE[x.priorite] || PRIORITE.ok;
  t.appendChild(anBadge(p[0], p[1]));
  if (x.present) {
    var c = document.createElement("span");
    c.className = "sous-hint";
    c.textContent = x.faites + "/" + a.etapes + " étapes" +
      (x.notees ? " · " + x.justes + "/" + x.notees + " juste" + (x.justes > 1 ? "s" : "") : "");
    t.appendChild(c);
  }
  d.appendChild(t);
  var ko = anConceptsKo(a, x);
  if (ko.length) {
    var k = document.createElement("p");
    k.className = "an-ko";
    k.textContent = "À reprendre : " + ko.map(function(c){ return "« " + c.intitule + " »"; }).join(", ") +
      " (question" + (x.fausses.length > 1 ? "s " : " ") + x.fausses.join(", ") + ")";
    d.appendChild(k);
  }
  if ((x.raisons || []).length) {
    var ul = document.createElement("ul");
    x.raisons.forEach(function(r){
      var li = document.createElement("li");
      li.textContent = typo(r.texte);
      ul.appendChild(li);
    });
    d.appendChild(ul);
  }
  return d;
}

function anConceptsKo(a, x){
  var rangs = x.concepts_ko || [];
  return (a.concepts || []).filter(function(c){ return rangs.indexOf(c.rang) >= 0; });
}

// Le texte d'un retour, au vouvoiement, pour un e-mail ou le cahier de
// textes. Seuls les présents qui ont quelque chose à reprendre en reçoivent
// un ; un absent a un autre message — la séance entière à rattraper.
function retourDe(a, x){
  var nom = nomDe(a.code, x.numero);
  var tete = (nom ? prenomSeul(nom) + " (n° " + x.numero + ")" : "N° " + x.numero) + " — séance " + a.numero;
  if (!x.present) {
    return tete + " : vous étiez absent. La séance est à rattraper en entier sur le site du cours, " +
           "ouvert depuis le portail ; la révision de la séance vous dira où vous en êtes.";
  }
  var phrases = [], utile = false;
  if (x.notees) phrases.push(x.justes + " réponse" + (x.justes > 1 ? "s" : "") + " juste" + (x.justes > 1 ? "s" : "") +
                             " sur " + x.notees + ".");
  var ko = anConceptsKo(a, x);
  if (ko.length) utile = true;
  if (ko.length) phrases.push("À relire : " + ko.map(function(c){ return "« " + c.intitule + " »"; }).join(", ") +
                              " (question" + (x.fausses.length > 1 ? "s " : " ") + x.fausses.join(", ") + ").");
  if (x.arret) utile = true;
  if (x.arret) phrases.push("Vous vous êtes arrêté " + anLieuArret(x.arret) +
                            " : terminez la page en révision, elle reste ouverte.");
  (x.raisons || []).forEach(function(r){
    if (/quitté la page|sans le temps de lire/.test(r.texte)) utile = true;
    if (/quitté la page/.test(r.texte)) phrases.push("Vous avez quitté la page pendant des questions : vos réponses doivent venir de vous, se tromper ne coûte rien.");
    if (/sans le temps de lire/.test(r.texte)) phrases.push("Plusieurs réponses sont arrivées avant le temps de lire la question : prenez ce temps.");
  });
  // Rien à reprendre : pas de retour — « 10 sur 10 » se dit en classe.
  if (!utile) return null;
  return tete + " : " + phrases.join(" ");
}

function anLieuArret(cle){
  var m = /^acte-(\d+)\b/.exec(cle);
  return m ? "au point de passage de l'acte " + ROMAINS[Number(m[1])] : "à la question " + String(cle).replace(/^q/, "");
}

function anRetours(a){
  return (a.eleves || [])
    .filter(function(x){ return x.priorite !== "ok"; })
    .map(function(x){ return retourDe(a, x); })
    .filter(Boolean).join("\n\n");
}

function anLignesCsv(a){
  var l = [["Numéro", "Prénom (local)", "Présent", "Priorité", "Étapes faites", "Sur", "Justes", "Notées",
            "Arrêt", "Questions fausses", "Concepts à reprendre", "Raisons"]];
  (a.eleves || []).forEach(function(x){
    var nom = nomDe(a.code, x.numero);
    l.push([x.numero, nom ? prenomSeul(nom) : "", x.present ? "oui" : "non", (PRIORITE[x.priorite] || [])[1] || x.priorite,
            x.faites, a.etapes, x.justes, x.notees, x.arret || "", (x.fausses || []).join(" "),
            anConceptsKo(a, x).map(function(c){ return c.intitule; }).join(" | "),
            (x.raisons || []).map(function(r){ return r.texte; }).join(" | ")]);
  });
  return l;
}

// ── Petites briques ──
function anNommer(code, numero){
  var nom = nomDe(code, numero);
  return nom ? numero + " " + prenomSeul(nom) : "N° " + numero;
}
function anBadge(ton, texte){
  var b = document.createElement("span");
  b.className = "badge " + ton;
  b.textContent = texte;
  return b;
}
function anTitre(z, niveau, texte){
  var h = document.createElement(niveau);
  h.className = niveau === "h3" ? "sous-titre" : "sp-bilan-t";
  h.textContent = texte;
  z.appendChild(h);
}
function anDetails(z, resume){
  var d = document.createElement("details");
  d.className = "plie-in";
  var s = document.createElement("summary");
  s.textContent = resume;
  d.appendChild(s);
  z.appendChild(d);
  return d;
}
function anTable(parent, entetes){
  var w = document.createElement("div");
  w.className = "scroll";
  w.tabIndex = 0;
  w.setAttribute("role", "region");
  w.setAttribute("aria-label", entetes.join(", "));
  var t = document.createElement("table");
  t.className = "an-table";
  var tr = document.createElement("tr");
  entetes.forEach(function(e){ var th = document.createElement("th"); th.scope = "col"; th.textContent = e; tr.appendChild(th); });
  var thead = document.createElement("thead");
  thead.appendChild(tr);
  t.appendChild(thead);
  var tb = document.createElement("tbody");
  t.appendChild(tb);
  w.appendChild(t);
  parent.appendChild(w);
  return tb;
}
function anCellules(tr, valeurs, nums){
  valeurs.forEach(function(v, i){
    var td = document.createElement("td");
    if ((nums || []).indexOf(i) >= 0) td.className = "n";
    td.textContent = v === null || v === undefined ? "—" : String(v);
    tr.appendChild(td);
  });
}
function anPhrase(texte){
  var p = document.createElement("p");
  p.className = "sous-hint";
  p.textContent = texte;
  return p;
}
function anVirgule(n){ return String(Math.round(Number(n) * 10) / 10).replace(".", ","); }
function anDuree(s){
  s = Math.round(Number(s));
  return s < 90 ? s + " s" : Math.round(s / 60) + " min";
}

export { rendreAnalyse, retourDe };
