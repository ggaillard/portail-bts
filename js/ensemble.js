// ── La vue d'ensemble : le semestre et les projets ────────────────────────
//
// Sixième module sorti de app.js (étape A6bis de REFONTE.md). Deux choses qui
// répondent à la même question — « où en est-on ? » — à deux échelles :
//
//   · LE SEMESTRE : les séances une par une, avec leur état (à produire,
//     prête, en cours, jouée) et le bouton Visible / Cachée. Les quatre états
//     sont calculés par semestre() en base, pas ici : le portail les affiche,
//     il ne les décide pas.
//
//   · LES PROJETS : les dépôts, groupés sous leur classe. Un projet appartient
//     à une classe (projets.classe_id), et c'est ce qui décide de ce qu'un
//     étudiant trouve après s'être identifié. Une classe sans projet le dit à
//     sa place — ses étudiants s'identifieraient pour ne rien trouver.
//
// « Publiée » et « ouverte » sont deux choses différentes, et la confusion
// coûte cher : ouverte = la séance accepte des réponses, publiée = les
// étudiants ont le droit de la LIRE. Clore une séance ne la dépublie pas. Tout
// est dans CLAUDE.md, et le bouton d'ici ne touche que `publiee`.

import { $, sb, suivi, erreur, typo, pastilles, classesReelles } from './socle.js';

// Le portail savait tout dire d'UNE séance et rien de l'ensemble. Savoir si la
// séance 7 avait son corrigé se lisait dans un tableau tenu à la main, donc
// faux au bout de trois semaines. Ici l'état est calculé, il ne se décide pas.
var SEM_ETAT = {
  a_produire: "à produire",
  prete:      "prête",
  en_cours:   "en cours",
  jouee:      "jouée"
};

function carte(p){
  var a = document.createElement("a");
  a.className = "projet";
  a.href = p.url;
  a.innerHTML = '<span class="projet-ico"></span><span><span class="projet-t"></span>' +
                '<span class="projet-d"></span></span>';
  a.querySelector(".projet-ico").textContent = p.icone || "•";
  a.querySelector(".projet-t").textContent   = p.titre;
  a.querySelector(".projet-d").textContent   = p.description || "";
  return a;
}

function afficherProjets(conteneur, liste){
  var c = $(conteneur);
  c.innerHTML = "";
  if (!liste || !liste.length) {
    c.innerHTML = '<p class="hint">Aucun projet n\'est encore associé à cette classe.</p>';
    return;
  }
  liste.forEach(function(p){ c.appendChild(carte(p)); });
}

function chargerSemestre(){
  var carte = $("carte-semestre");
  carte.hidden = true;
  sb.rpc("semestre").then(function(r){
    // Fonction pas déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) return;
    // semestre() ne connaît pas la distinction : le tri se fait ici, comme
    // partout ailleurs dans l'espace enseignant.
    rendreSemestre(classesReelles(r.data.classes || []));
    carte.hidden = false;
  });
}

function rendreSemestre(classes){
  var z = $("sem-classes");
  z.innerHTML = "";
  if (!classes.length) {
    z.innerHTML = '<p class="hint" style="margin:0">Aucune séance à afficher.</p>';
    return;
  }

  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "sem-c";

    var h = document.createElement("h3");
    h.textContent = c.nom || c.code;
    bloc.appendChild(h);

    var seances = c.seances || [];
    var compte = { a_produire: 0, prete: 0, en_cours: 0, jouee: 0 };
    seances.forEach(function(x){ compte[x.etat] = (compte[x.etat] || 0) + 1; });

    // Le bilan d'abord : c'est lui qu'on lit en diagonale.
    var bilan = document.createElement("p");
    bilan.className = "sem-bilan";
    var bouts = [];
    if (compte.jouee)      bouts.push("<b>" + compte.jouee + "</b> jouée" + (compte.jouee > 1 ? "s" : ""));
    if (compte.en_cours)   bouts.push("<b>" + compte.en_cours + "</b> en cours");
    if (compte.prete)      bouts.push("<b>" + compte.prete + "</b> prête" + (compte.prete > 1 ? "s" : ""));
    if (compte.a_produire) bouts.push("<b>" + compte.a_produire + "</b> à produire");
    bilan.innerHTML = bouts.join(" · ") + " — " + seances.length + " séances, " +
                      (c.inscrits || 0) + " étudiants";
    bloc.appendChild(bilan);

    seances.forEach(function(x){ bloc.appendChild(ligneSemestre(x)); });
    z.appendChild(bloc);
  });
}

function ligneSemestre(x){
  var l = document.createElement("div");
  l.className = "sem-l";

  var n = document.createElement("span");
  n.className = "sem-n";
  n.textContent = ("0" + x.numero).slice(-2);
  l.appendChild(n);

  var t = document.createElement("span");
  t.className = "sem-t";
  t.textContent = x.titre || ("Séance " + x.numero);
  t.title = x.titre || "";
  l.appendChild(t);

  if (x.notee) {
    var no = document.createElement("span");
    no.className = "sem-notee";
    no.textContent = "notée";
    l.appendChild(no);
  }

  var e = document.createElement("span");
  e.className = "sem-e " + (x.etat || "");
  e.textContent = SEM_ETAT[x.etat] || x.etat || "";
  l.appendChild(e);

  // Les chiffres, seulement quand ils veulent dire quelque chose. Un « 0/31 ·
  // — % » sur une séance pas encore écrite n'apprend rien et fait du bruit.
  var bouts = [];
  if (x.etat === "a_produire") {
    bouts.push("aucun corrigé");
  } else {
    if (x.repondants) bouts.push(x.repondants + "/" + (x.inscrits || "?"));
    if (x.avancement !== null && x.avancement !== undefined) bouts.push(x.avancement + " % fait");
    else if (x.reussite !== null && x.reussite !== undefined) bouts.push(x.reussite + " % juste");
    if (x.dernier) bouts.push(x.dernier);
  }
  var v = document.createElement("span");
  v.className = "sem-x";
  v.textContent = bouts.join(" · ");
  l.appendChild(v);

  // Publier, c'est décider si les étudiants ont le droit de LIRE la séance sur
  // le site du cours — ce n'est pas « ouverte », qui décide s'ils peuvent y
  // répondre. Le 09/09, la séance 2 était lisible le jour de la séance 1 :
  // rien ne l'empêchait, le sommaire du site liste tout ce qui est écrit.
  //
  // « Démarrer la séance » publie déjà : ce bouton-ci sert aux exceptions —
  // ouvrir en avance à un absent, refermer un brouillon parti trop tôt.
  if (x.seance_id && x.numero < 90) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "sem-pub" + (x.publiee ? " on" : "");
    b.textContent = x.publiee ? "Visible" : "Cachée";
    b.title = x.publiee
      ? "Les étudiants peuvent lire cette séance. Cliquer pour la cacher."
      : "Les étudiants ne voient pas cette séance. Cliquer pour la rendre visible.";
    b.setAttribute("aria-pressed", x.publiee ? "true" : "false");
    b.setAttribute("aria-label", (x.publiee ? "Cacher" : "Rendre visible") +
                   " la séance " + x.numero + " — " + (x.titre || ""));
    b.addEventListener("click", function(){
      var vise = !b.classList.contains("on");
      b.disabled = true;
      sb.rpc("publier_seance", { p_seance_id: Number(x.seance_id),
                                 p_publiee: vise }).then(function(r){
        b.disabled = false;
        if (!r || r.error || !r.data || !r.data.ok) {
          erreur("err-semestre", "Action refusée. Vérifiez que vous êtes bien " +
                                 "connecté en enseignant.");
          return;
        }
        x.publiee = vise;
        b.classList.toggle("on", vise);
        b.textContent = vise ? "Visible" : "Cachée";
        b.setAttribute("aria-pressed", vise ? "true" : "false");
        erreur("err-semestre", "Séance " + x.numero + " — " +
               (vise ? "visible par les étudiants." : "cachée aux étudiants."), true);
      });
    });
    l.appendChild(b);
  }
  return l;
}

function rendreProjet(zone, p){
  var pr = suivi.projet;
  if (!pr) {
    zone.className = "rythme mort";
    zone.textContent = "Séance de projet — lecture de l'avancement en cours…";
    return;
  }
  var alerte = (pr.arretes || []).length || (pr.en_risque || 0);
  zone.className = "rythme " + (alerte ? "retard" : "ok");

  var t = "<b>Séance de projet</b> — chacun à son rythme, pas de cadence horaire.";
  if (pr.echeance) {
    t += " Échéance dans <b>" + pr.jours_restants + " jours</b>";
    if (pr.en_risque) t += ", <b>" + pr.en_risque + " au rythme actuel n'iront pas au bout</b>";
    t += ".";
  }
  zone.innerHTML = t;

  // Répartition : où se masse la classe le long des jalons.
  var rep = pr.repartition || [];
  if (rep.length) {
    var maxE = rep.reduce(function(m, x){ return Math.max(m, x.eleves); }, 1);
    var d = document.createElement("div");
    d.style.marginTop = ".5rem";
    rep.forEach(function(x){
      var l = document.createElement("div");
      l.className = "jalon";
      l.innerHTML = '<span class="jalon-n"></span><span class="jalon-b"></span><span class="jalon-c"></span>';
      l.querySelector(".jalon-n").textContent = x.faits + "/" + pr.jalons;
      l.querySelector(".jalon-b").style.width = Math.round(x.eleves / maxE * 55) + "%";
      l.querySelector(".jalon-c").textContent = x.eleves + (x.eleves > 1 ? " étudiants" : " étudiant");
      d.appendChild(l);
    });
    zone.appendChild(d);
  }

  if (pr.jamais_commence) {
    var j = document.createElement("div");
    j.style.marginTop = ".4rem";
    j.textContent = pr.jamais_commence + (pr.jamais_commence > 1
      ? " étudiants n'ont rien rendu sur cette séance."
      : " étudiant n'a rien rendu sur cette séance.");
    zone.appendChild(j);
  }

  var arr = pr.arretes || [];
  if (arr.length) {
    var a = document.createElement("div");
    a.style.marginTop = ".5rem";
    a.innerHTML = "<b>À l'arrêt</b> — plus rien depuis une semaine ou plus :" +
                  '<div class="pastilles" id="pj-arr"></div>';
    zone.appendChild(a);
    pastilles("pj-arr", arr, "abs", function(x){
      return x.numero + " " + (x.avatar || "") + " · " + x.faits + "/" + pr.jalons + " · " + x.jours + " j";
    });
  }
}

// Une classe sans projet n'est pas une erreur d'affichage : ses étudiants
// s'identifient et ne trouvent rien à ouvrir. On le dit à sa place, sous son
// nom — a_faire() le signale par ailleurs comme un point à régler.
function rendreProjetsParClasse(classes, projets){
  var z = $("tous-projets");
  z.innerHTML = "";
  if (!classes.length) {
    z.innerHTML = '<p class="hint" style="margin:0">Aucune classe.</p>';
    return;
  }
  classes.forEach(function(c){
    var siens = projets.filter(function(p){ return p.classe_id === c.id; });
    var h = document.createElement("h3");
    h.className = "sous-titre";
    h.textContent = c.nom;
    z.appendChild(h);

    var code = document.createElement("p");
    code.className = "sous-hint";
    // « 0 dépôt » ferait doublon avec la phrase juste en dessous.
    code.textContent = siens.length
      ? c.code + " — " + siens.length + (siens.length > 1 ? " dépôts" : " dépôt")
      : c.code;
    z.appendChild(code);

    if (!siens.length) {
      var vide = document.createElement("p");
      vide.className = "hint";
      vide.textContent = "Aucun projet associé : ses étudiants s'identifient " +
        "puis ne trouvent aucun support à ouvrir.";
      z.appendChild(vide);
      return;
    }
    var grille = document.createElement("div");
    grille.className = "projets";
    siens.forEach(function(p){ grille.appendChild(carte(p)); });
    z.appendChild(grille);
  });
}

export { carte, afficherProjets, rendreProjet, rendreProjetsParClasse,
         chargerSemestre, rendreSemestre };
