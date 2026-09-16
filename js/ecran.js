// ── Le mode classe : ce qui s'affiche au tableau ──────────────────────────
//
// Deuxième module sorti de app.js (étape A5 de REFONTE.md). Treize fonctions,
// 591 lignes : la progression, le classement, la répartition des réponses, le
// parcours de l'heure, le débriefing, le minuteur, le plein écran, le son et
// les confettis.
//
// C'est ce groupe que CLAUDE.md désignait pour interdire tout découpage — « les
// animations, le minuteur et le mode classe y sont imbriqués ». Mesuré avant
// d'y toucher : quatre portes d'entrée seulement (modeEcran, rendreEcran,
// rotationAuto, fermerEcran), et six appels sortants, tous vers le socle. Ce
// n'était pas un enchevêtrement, c'était un module qui s'ignorait.
//
// Les deux seules dépendances qui ne descendent pas vers le socle sont
// `chargerDebrief` et `chargerParcours`, qui vivent du côté du suivi de
// séance. Les importer d'app.js créerait un cycle — app.js importe l'écran,
// l'écran importe app.js. On les reçoit donc par `brancherEcran()`, appelée
// une fois au démarrage : la dépendance est écrite noir sur blanc au lieu
// d'être devinée par le chargeur de modules.
//
// Ce module possède aussi ses propres boutons : les brancher ailleurs
// reviendrait à pouvoir déplacer l'un sans l'autre.

import { $, suivi, typo, anime, entree, pousse, son, SONS, NOMS_CLE } from './socle.js';

// Branchés par brancherEcran(). Tant qu'elle n'a pas été appelée, ces deux-là
// ne font rien plutôt que d'exploser : l'écran peut s'ouvrir avant que le
// suivi d'une séance ait été chargé.
let chargerDebrief = function(){};
let chargerParcours = function(){};

// Confettis : une gerbe courte, sans librairie.
function confettis(){
  var cv = $("ce-confettis"), ec = $("classe-ecran");
  if (!cv || !ec || ec.hidden) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var L = cv.width = ec.clientWidth, H = cv.height = ec.clientHeight;
  var ctx = cv.getContext("2d");
  var teintes = ["#4FB3AD", "#4FD1A5", "#E3B872", "#7FB2E5", "#EAF2F8"];
  var p = [];
  for (var i = 0; i < 140; i++) {
    p.push({ x: L / 2 + (Math.random() - .5) * L * .55, y: H * .5,
             vx: (Math.random() - .5) * 6.5, vy: -4.5 - Math.random() * 6.5,
             r: 4 + Math.random() * 6, a: Math.random() * 6.3,
             c: teintes[(Math.random() * teintes.length) | 0] });
  }
  var DUREE = 6000, t0 = performance.now();
  (function pas(t){
    var age = t - t0;
    ctx.clearRect(0, 0, L, H);
    p.forEach(function(o){
      // Gravité douce et frottement : la retombée dure, on a le temps de voir.
      o.vy += .13; o.vx *= .994; o.x += o.vx; o.y += o.vy; o.a += .05;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a);
      ctx.globalAlpha = age < DUREE * .7 ? 1 : Math.max(0, 1 - (age - DUREE * .7) / (DUREE * .3));
      ctx.fillStyle = o.c;
      ctx.fillRect(-o.r, -o.r * .5, o.r * 2, o.r);
      ctx.restore();
    });
    if (age < DUREE) requestAnimationFrame(pas); else ctx.clearRect(0, 0, L, H);
  })(t0);
}

function rendreEcran(s){
  $("ce-titre").textContent = suivi.titre;
  $("ce-k1").innerHTML = s.actifs + " / " + s.inscrits + "<small>en activité</small>";
  anime("ce-k2", s.reponses, "", "réponses");
  if (s.reussite === null) $("ce-k3").innerHTML = "—<small>de réussite</small>";
  else anime("ce-k3", s.reussite, " %", "de réussite");

  // ── Objectif collectif : un but commun plutôt qu'un duel ──
  var vise = s.inscrits * s.total;
  var pctClasse = vise ? Math.min(100, Math.round(s.reponses / vise * 100)) : 0;
  $("ce-obj-f").style.width = pctClasse + "%";
  $("ce-obj-n").textContent = s.reponses + " / " + vise + "  ·  " + pctClasse + " %";

  // Objectif franchi : on le fête une seule fois.
  if (pctClasse >= 100 && !suivi.feteFaite) {
    suivi.feteFaite = true;
    confettis();
    son(SONS.fini);
  }
  if (pctClasse < 100) suivi.feteFaite = false;

  // ── Le défi du moment ──
  var defi = $("ce-defi");
  var dure = s.questions.length ? s.questions[0] : null;
  if (pctClasse >= 100) {
    defi.hidden = false;
    defi.innerHTML = "<b>Objectif atteint.</b> Toute la classe est allée au bout de la séance.";
  } else if (dure && dure.pct < 60) {
    defi.hidden = false;
    defi.innerHTML = "La question qui résiste : <b>" + dure.nom + "</b> — " +
      dure.ok + " réussite" + (dure.ok > 1 ? "s" : "") + " sur " + dure.n + " tentatives.";
  } else {
    defi.hidden = true;
  }

  var actifs = s.lignes.filter(function(l){ return l.n > 0; });
  $("ce-vide").hidden = actifs.length > 0;

  // ── Qui vient de répondre, depuis le dernier rafraîchissement ──
  var avant = suivi.precedent || {};
  var nouveaux = {};
  actifs.forEach(function(l){
    if (avant[l.id] !== undefined && l.n > avant[l.id]) nouveaux[l.id] = l.n - avant[l.id];
  });

  // ── Événements à annoncer : une nouvelle série, un élève qui termine ──
  var premier = !suivi.series;
  var serieAvant = suivi.series || {};
  var meilleure = null, finis = {}, demarrent = [];
  actifs.forEach(function(l){
    if (!premier && l.serie >= 3 && l.serie > (serieAvant[l.id] || 0)) {
      if (!meilleure || l.serie > meilleure.serie) meilleure = l;
    }
    if (l.n >= s.total && avant[l.id] !== undefined && avant[l.id] < s.total) finis[l.id] = true;
    if (avant[l.id] === 0 && l.n > 0) demarrent.push(l);
  });
  suivi.series = {};
  s.lignes.forEach(function(l){ suivi.series[l.id] = l.serie; });

  // Un seul événement annoncé à la fois, du plus marquant au plus discret.
  var quiFinit = actifs.filter(function(l){ return finis[l.id]; });
  if (meilleure) {
    banniere("🔥 <b>" + meilleure.avatar + "</b> enchaîne " + meilleure.serie + " bonnes réponses !");
    son(SONS.serie);
  } else if (quiFinit.length === 1) {
    banniere("🎉 <b>" + quiFinit[0].avatar + "</b> a terminé la séance !");
    son(SONS.fini);
  } else if (quiFinit.length > 1) {
    banniere("🎉 <b>" + quiFinit.length + " élèves</b> viennent de terminer !");
    son(SONS.fini);
  } else if (demarrent.length === 1) {
    banniere("👋 <b>" + demarrent[0].avatar + "</b> se lance.");
  } else if (demarrent.length > 1) {
    banniere("👋 <b>" + demarrent.length + " élèves</b> viennent de se lancer.");
  }

  // Les vues qui remplacent la grille se rendent chacune dans sa zone, puis
  // sortent : « trans » leur dit s'il s'agit d'un changement de vue (à animer)
  // ou du simple rafraîchissement périodique (à ne pas animer, sans quoi
  // l'écran clignote toutes les cinq secondes devant la classe).
  var trans = !!suivi.transition;
  suivi.transition = false;

  // ── Vue « Débriefing » : ce qu'on projette pour conclure ──
  var zoneDeb = $("ce-deb");
  if (suivi.vue === "deb") {
    $("ce-grille").hidden = true;
    $("ce-podium").hidden = true;
    $("ce-rep").hidden = true;
    // Le mobilier de l'heure en cours n'a plus rien à dire une fois l'heure
    // finie : « personne n'a encore répondu » sous un débriefing se lit comme
    // une contradiction, et le défi du moment n'a plus de moment.
    $("ce-vide").hidden = true;
    $("ce-defi").hidden = true;
    zoneDeb.hidden = false;
    rendreDebriefEcran(zoneDeb, trans);
    if (trans) entree(zoneDeb);
    majPied(s, actifs, nouveaux);
    return;
  }
  zoneDeb.hidden = true;

  // ── Vue « Parcours » : où en est la classe dans les quatre étapes ? ──
  // Elle se projette pendant l'heure, contrairement au débriefing qui la
  // conclut — mais elle ne montre aucun numéro : voir <rendreParcoursEcran>.
  var zonePar = $("ce-par");
  if (suivi.vue === "par") {
    $("ce-grille").hidden = true;
    $("ce-podium").hidden = true;
    $("ce-rep").hidden = true;
    $("ce-vide").hidden = true;
    zonePar.hidden = false;
    rendreParcoursEcran(zonePar, trans);
    if (trans) entree(zonePar);
    majPied(s, actifs, nouveaux);
    return;
  }
  zonePar.hidden = true;

  // ── Vue « Répartition » : quel choix a fait la classe ? ──
  var zoneRep = $("ce-rep");
  if (suivi.vue === "rep") {
    $("ce-grille").hidden = true;
    $("ce-podium").hidden = true;
    zoneRep.hidden = false;
    rendreRepartition(s, zoneRep, trans);
    if (trans) entree(zoneRep);
    majPied(s, actifs, nouveaux);
    return;
  }
  zoneRep.hidden = true;
  $("ce-grille").hidden = false;

  // ── Podium, seulement en mode classement ──
  var pod = $("ce-podium");
  var lignes, retires = 0, lignesPodium = [];

  if (suivi.vue === "clas") {
    lignes = actifs.slice().sort(function(a, b){
      return (b.ok - a.ok) || (b.n - a.n) || (a.numero < b.numero ? -1 : 1);
    });
    var trois = lignes.slice(0, 3);
    if (trois.length >= 2) {
      pod.hidden = false;
      pod.innerHTML = "";
      var med = ["🥇", "🥈", "🥉"];
      var ordre = trois.length >= 3 ? [1, 0, 2] : [1, 0];   // 2e, 1er, 3e
      ordre.forEach(function(i){
        var l = trois[i];
        if (!l) return;
        var d = document.createElement("div");
        d.className = "ce-pod" + (i === 0 ? " or" : "") + (trans ? " entre" : "");
        d.innerHTML = '<span class="ce-pod-m"></span><span class="ce-pod-av"></span>' +
                      '<span class="ce-pod-n"></span>' +
                      (l.serie >= 3 ? '<span class="ce-serie"></span>' : "");
        d.querySelector(".ce-pod-m").textContent = med[i];
        d.querySelector(".ce-pod-av").textContent = l.avatar;
        d.querySelector(".ce-pod-n").textContent = l.ok + (l.ok > 1 ? " bonnes" : " bonne");
        if (l.serie >= 3) d.querySelector(".ce-serie").textContent = "🔥 " + l.serie + " d'affilée";
        pod.appendChild(d);
      });
      retires = trois.length;
      lignesPodium = trois;
      lignes = lignes.slice(retires);
    } else {
      pod.hidden = true;
    }
  } else {
    pod.hidden = true;
    lignes = actifs.slice().sort(function(a, b){ return a.numero < b.numero ? -1 : 1; });
  }

  // ── La grille, dimensionnée selon l'effectif pour tenir sans déborder ──
  var clas = suivi.vue === "clas";
  var rangAvant = suivi.rangs || {};
  var rangMain = {};

  var g = $("ce-grille");
  var large = lignes.length <= 12 ? "8.5rem" : (lignes.length <= 24 ? "6.5rem" : "5rem");
  g.style.gridTemplateColumns = "repeat(auto-fill,minmax(min(" + large + ",27vw),1fr))";

  // On relève la position de chaque carte avant de reconstruire la grille.
  var avantPos = {};
  if (!trans) {
    Array.prototype.forEach.call(g.children, function(el){
      if (el.dataset.eleve) avantPos[el.dataset.eleve] = el.getBoundingClientRect();
    });
  }
  g.innerHTML = "";
  lignes.forEach(function(l, i){
    var rang = i + retires + 1;
    rangMain[l.id] = rang;
    var d = document.createElement("div");
    d.className = "ce-el" + (nouveaux[l.id] ? " pulse" : "") +
                  (finis[l.id] ? " fini" : "") + (trans ? " entre" : "");
    d.dataset.eleve = l.id;
    if (trans) d.style.animationDelay = (i * 0.045) + "s";   // cascade
    d.innerHTML =
      (clas ? '<span class="ce-rang"></span>' : "") +
      '<span class="ce-av"></span>' +
      '<span class="ce-b"><span class="ce-f"></span></span>' +
      '<span class="ce-n"></span>' +
      (l.serie >= 3 ? '<span class="ce-serie"></span>' : "") +
      (clas && rangAvant[l.id] && rangAvant[l.id] !== rang ? '<span class="ce-fleche"></span>' : "");
    pousse(d.querySelector(".ce-f"), l.pct + "%", trans);
    if (clas) d.querySelector(".ce-rang").textContent = "#" + rang;
    d.querySelector(".ce-av").textContent = l.avatar;
    d.querySelector(".ce-n").textContent =
      clas && l.ev ? l.ok + (l.ok > 1 ? " bonnes" : " bonne") : l.n + "/" + s.total;
    if (l.serie >= 3) d.querySelector(".ce-serie").textContent = "🔥 " + l.serie + " d'affilée";

    var fl = d.querySelector(".ce-fleche");
    if (fl) {
      var ecart = rangAvant[l.id] - rang;
      fl.className = "ce-fleche " + (ecart > 0 ? "monte" : "descend");
      fl.textContent = (ecart > 0 ? "▲ +" : "▼ ") + Math.abs(ecart);
    }
    g.appendChild(d);
  });

  // Chaque carte glisse visiblement de son ancienne place à la nouvelle.
  if (!trans) {
    Array.prototype.forEach.call(g.children, function(el){
      var p = avantPos[el.dataset.eleve];
      if (!p) return;
      var n = el.getBoundingClientRect();
      var dx = p.left - n.left, dy = p.top - n.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = "translate(" + dx + "px," + dy + "px)";
      requestAnimationFrame(function(){
        el.style.transition = "transform 1.2s cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
      });
    });
  }

  if (clas) {
    // Le podium occupe les premières places : on les mémorise aussi.
    (retires ? lignesPodium : []).forEach(function(l, i){ rangMain[l.id] = i + 1; });
    suivi.rangs = rangMain;
  }

  majPied(s, actifs, nouveaux);
}

function basculerSon(){
  suivi.son = !suivi.son;
  $("ce-son").classList.toggle("on", suivi.son);
  if (suivi.son) son(SONS.vue);
}

function minuteur(){
  var cycles = [0, 5, 10, 15];
  suivi.minutes = cycles[(cycles.indexOf(suivi.minutes || 0) + 1) % cycles.length];
  if (suivi.chrono) { clearInterval(suivi.chrono); suivi.chrono = null; }

  var el = $("ce-chrono");
  $("ce-min").classList.toggle("on", suivi.minutes > 0);
  $("ce-min").textContent = suivi.minutes ? "Minuteur " + suivi.minutes + " min" : "Minuteur";
  if (!suivi.minutes) { el.hidden = true; return; }

  suivi.fin = Date.now() + suivi.minutes * 60000;
  el.hidden = false;
  var tic = function(){
    var reste = Math.max(0, Math.round((suivi.fin - Date.now()) / 1000));
    el.innerHTML = Math.floor(reste / 60) + ":" +
                   String(reste % 60).padStart(2, "0") + "<small>restant</small>";
    el.className = "ce-chrono" + (reste === 0 ? " fini" : (reste <= 60 ? " presse" : ""));
    if (reste === 0) {
      clearInterval(suivi.chrono); suivi.chrono = null;
      banniere("⏱️ <b>Temps écoulé.</b>");
      son(SONS.temps);
    }
  };
  tic();
  suivi.chrono = setInterval(tic, 1000);
}

// Les quatre formes de réponse : triangle, losange, rond, carré.
var FORMES = {
  A: { c: '#E21B3C', clip: 'polygon(50% 6%, 96% 94%, 4% 94%)',           cls: ' tri' },
  B: { c: '#1368CE', clip: 'polygon(50% 3%, 97% 50%, 50% 97%, 3% 50%)',  cls: '' },
  C: { c: '#D89E00', clip: 'circle(47% at 50% 50%)',                     cls: '' },
  D: { c: '#26890C', clip: 'inset(5% round 14%)',                        cls: '' }
};

// Bandeau plein écran, pour un événement qui mérite qu'on lève les yeux.
function banniere(html){
  var b = $("ce-banniere");
  $("ce-ban-txt").innerHTML = html;
  b.classList.add("on");
  if (suivi.banTimer) clearTimeout(suivi.banTimer);
  suivi.banTimer = setTimeout(function(){ b.classList.remove("on"); }, 5000);
}

// C'est l'écran des cinq dernières minutes. Il ne montre ni avatar ni nom :
// un concept « à revoir » désigne un point du cours, jamais quelqu'un. On le
// projette, et on reprend à voix haute les lignes rouges.
function rendreDebriefEcran(zone, trans){
  var d = suivi.debrief;

  if (!d) {
    zone.innerHTML = '<p class="ce-vide">Débriefing en cours de chargement…</p>';
    chargerDebrief(function(){ if (suivi.vue === "deb") rendreDebriefEcran(zone, false); });
    return;
  }
  if (!(d.concepts || []).length) {
    zone.innerHTML = '<p class="ce-vide">Aucun concept écrit pour cette séance. ' +
      'Recopiez la section « Concepts à connaître » de la trace écrite depuis ' +
      'le suivi de la séance.</p>';
    return;
  }

  zone.innerHTML = "";

  var repere = document.createElement("p");
  repere.className = "ce-deb-r";
  repere.textContent = "Ce qu'on emporte de la séance " + d.numero +
    (d.reussite === null ? "" : "  ·  " + d.reussite + " % de réussite au quiz") +
    "  ·  " + d.repondants + " / " + d.inscrits + " ont répondu";
  zone.appendChild(repere);

  var MOTS = { acquis: "acquis", fragile: "fragile",
               a_revoir: "à revoir", sans_mesure: "—" };

  d.concepts.forEach(function(c){
    var l = document.createElement("div");
    l.className = "ce-deb-l " + c.verdict;
    l.innerHTML = '<span class="ce-deb-k"></span>' +
                  '<span class="ce-deb-i"><b></b><small></small></span>' +
                  '<span class="ce-deb-b"><span class="ce-deb-f"></span></span>' +
                  '<span class="ce-deb-n"></span>';
    l.querySelector(".ce-deb-k").textContent = c.rang;
    l.querySelector(".ce-deb-i b").textContent = typo(c.intitule);
    l.querySelector(".ce-deb-i small").textContent = typo(c.detail || "");
    l.querySelector(".ce-deb-n").textContent =
      c.taux === null ? MOTS.sans_mesure : c.taux + " %";
    zone.appendChild(l);
    // Sans mesure, la barre reste vide : mieux vaut un blanc qu'un zéro, qui
    // se lirait « personne n'a réussi » au lieu de « on n'a pas mesuré ».
    var f = l.querySelector(".ce-deb-f");
    if (c.taux === null) f.style.width = "0%";
    else pousse(f, c.taux + "%", trans);
  });

  // La phrase de conclusion : elle nomme ce par quoi on recommence la
  // prochaine fois. Sans elle, l'écran ne dit rien à faire.
  var faibles = d.concepts.filter(function(c){ return c.verdict === "a_revoir"; });
  var moyens  = d.concepts.filter(function(c){ return c.verdict === "fragile"; });
  var p = document.createElement("p");
  p.className = "ce-deb-p";
  if (faibles.length) {
    p.innerHTML = "On reprend la prochaine fois par <b>" +
      faibles.map(function(c){ return "le " + c.rang; }).join(" et ") + "</b>.";
  } else if (moyens.length) {
    p.innerHTML = "Rien de perdu, mais <b>" +
      moyens.map(function(c){ return "le " + c.rang; }).join(" et ") +
      "</b> mérite" + (moyens.length > 1 ? "nt" : "") + " une relecture.";
  } else {
    p.innerHTML = "<b>Tout est acquis.</b> On passe à la suite.";
  }
  zone.appendChild(p);
}

function rendreRepartition(s, zone, trans){
  if (!s.questions.length) {
    zone.innerHTML = '<p class="ce-vide">Aucune question corrigée pour l\'instant.</p>';
    return;
  }
  var q = s.questions[suivi.repIndex % s.questions.length];
  var cles = Object.keys(q.choix).sort();
  var maxi = cles.reduce(function(m, k){ return Math.max(m, q.choix[k]); }, 1);

  zone.innerHTML = "";
  var num = parseInt(String(q.nom).replace(/\D/g, ""), 10);

  var repere = document.createElement("p");
  repere.className = "ce-rep-r";
  repere.textContent = (num ? "Question " + num + " sur " + s.total : String(q.nom)) +
                       "  ·  " + q.ok + " sur " + q.n + " l'ont trouvée";
  zone.appendChild(repere);

  // L'intitulé réel s'affiche dès que la colonne est renseignée.
  var titre = document.createElement("p");
  titre.className = "ce-rep-q";
  titre.textContent = q.texte || "";
  if (!q.texte) titre.style.display = "none";
  zone.appendChild(titre);

  var rangees = [];
  cles.forEach(function(k){
    var n = q.choix[k];
    var juste = q.bonne !== null && k.toLowerCase() === String(q.bonne).toLowerCase();
    var f = FORMES[String(k).toUpperCase()];
    var marque = f
      ? '<span class="ce-forme' + f.cls + '"><span class="ce-forme-f" style="background:' +
        f.c + ';clip-path:' + f.clip + '"></span><span class="ce-forme-l"></span></span>'
      : '<span class="ce-rep-k"></span>';
    var d = document.createElement("div");
    d.className = "ce-rep-l";
    d.innerHTML = marque +
                  '<span class="ce-rep-b"><span class="ce-rep-f"></span></span>' +
                  '<span class="ce-rep-n"></span><span class="ce-rep-ok">✓</span>';
    (d.querySelector(".ce-forme-l") || d.querySelector(".ce-rep-k")).textContent = k;
    d.querySelector(".ce-rep-n").textContent = n;
    pousse(d.querySelector(".ce-rep-f"), Math.round(n / maxi * 100) + "%", trans);
    zone.appendChild(d);
    rangees.push({ el: d, juste: juste });
  });

  // Les barres poussent d'abord en neutre, puis la bonne réponse s'illumine
  // et les autres s'effacent. C'est le temps de suspense.
  var reveler = function(){
    rangees.forEach(function(o){
      o.el.classList.toggle("juste", o.juste);
      o.el.classList.toggle("estompe", !o.juste);
    });
    if (trans) son(SONS.revele);
  };
  if (suivi.revelation) clearTimeout(suivi.revelation);
  if (trans) suivi.revelation = setTimeout(reveler, 2400);
  else reveler();
}

function majPied(s, actifs, nouveaux){
  var evts = actifs.filter(function(l){ return nouveaux[l.id]; })
                   .map(function(l){ return l.avatar + " +" + nouveaux[l.id]; });
  if (evts.length) {
    suivi.fil = (evts.join("   ") + "   " + (suivi.fil || "")).slice(0, 140);
  }
  $("ce-fil").textContent = suivi.fil || "";

  suivi.precedent = {};
  s.lignes.forEach(function(l){ suivi.precedent[l.id] = l.n; });

  $("ce-maj").textContent = "Mis à jour à " +
    new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fermerEcran(){
  suivi.ecran = false;
  if (suivi.auto) { clearInterval(suivi.auto); suivi.auto = null; $("ce-auto").classList.remove("on"); }
  if (suivi.chrono) { clearInterval(suivi.chrono); suivi.chrono = null; }
  $("classe-ecran").hidden = true;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(function(){});
  }
}

function pleinEcran(){
  var el = $("classe-ecran");
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(function(){});
  } else if (el.requestFullscreen) {
    el.requestFullscreen().catch(function(){});
  }
}

function modeEcran(v){
  suivi.vue = v;
  suivi.transition = true;
  $("ce-prog").classList.toggle("on", v === "prog");
  $("ce-clas").classList.toggle("on", v === "clas");
  $("ce-rep-b").classList.toggle("on", v === "rep");
  $("ce-par-b").classList.toggle("on", v === "par");
  $("ce-deb-b").classList.toggle("on", v === "deb");
  if (suivi.stats) rendreEcran(suivi.stats);
}

// Rotation automatique : l'écran ne se fige jamais pendant l'heure.
function rotationAuto(){
  if (suivi.auto) {
    clearInterval(suivi.auto);
    suivi.auto = null;
    $("ce-auto").classList.remove("on");
    return;
  }
  $("ce-auto").classList.add("on");
  // Le débriefing n'entre pas dans la rotation : il conclut l'heure, il ne
  // tourne pas pendant. On l'appelle à la main, quand on a décidé d'arrêter.
  // Le parcours entre dans la rotation, et il y entre EN PREMIER après la
  // progression : au début de l'heure, « il manque trois personnes à l'appel »
  // est plus utile que le classement, et il cesse de l'être tout seul dès que
  // les quatre barres sont pleines.
  var ordre = ["prog", "par", "clas", "rep"], i = 0;
  suivi.auto = setInterval(function(){
    i = (i + 1) % ordre.length;
    if (ordre[i] === "rep") suivi.repIndex = (suivi.repIndex || 0) + 1;
    modeEcran(ordre[i]);
  }, 22000);
}

// La vue projetée : les quatre barres, et AUCUN numéro. Projeter « il manque
// le 07 à l'appel » désigne quelqu'un devant la classe ; « il en manque
// trois » fait le même travail — chacun sait s'il a pointé — sans mettre
// personne au tableau. Le détail par étudiant reste sur l'écran de
// l'enseignant, qui est le seul à le regarder.
function rendreParcoursEcran(zone, trans){
  var d = suivi.parcours;
  if (!d) {
    zone.innerHTML = '<p class="ce-par-p">Le parcours de cette séance n\'est pas disponible.</p>';
    chargerParcours(function(){ if (suivi.vue === "par") rendreParcoursEcran(zone, false); });
    return;
  }
  zone.innerHTML = "";

  var r = document.createElement("div");
  r.className = "ce-par-r";
  r.textContent = "Où en est la classe";
  zone.appendChild(r);

  (d.etapes || []).forEach(function(e){
    var l = document.createElement("div");
    l.className = "ce-par-l" + (e.pose ? "" : " pas-pose");
    l.innerHTML = '<span class="ce-par-i"></span>' +
                  '<span class="ce-par-b"><span class="ce-par-e"></span>' +
                  '<span class="ce-par-f"></span></span>' +
                  '<span class="ce-par-n"></span>';
    l.querySelector(".ce-par-i").textContent = e.nom;
    var pct   = e.pose && e.total ? Math.round(e.fait / e.total * 100) : 0;
    var pctE  = e.pose && e.total ? Math.round((e.entames || e.fait) / e.total * 100) : 0;
    pousse(l.querySelector(".ce-par-e"), pctE + "%", trans);
    pousse(l.querySelector(".ce-par-f"), pct + "%", trans);
    l.querySelector(".ce-par-n").textContent =
      e.pose ? (e.fait + " / " + e.total) : "pas posé";
    zone.appendChild(l);
  });

  // Une phrase, et une seule : ce qui manque pour que l'heure démarre.
  var et = (d.etapes || []).filter(function(e){ return e.pose && e.fait < e.total; });
  var p = document.createElement("p");
  p.className = "ce-par-p";
  if (!et.length) {
    p.innerHTML = "<b>Tout le monde est au bout.</b> On peut avancer.";
  } else {
    var e = et[0];
    p.innerHTML = "Il manque <b>" + (e.total - e.fait) + "</b> " +
      (e.total - e.fait > 1 ? "personnes" : "personne") + " sur « " + e.nom + " ».";
  }
  zone.appendChild(p);
}

// ── Le branchement, appelé une fois par app.js au démarrage ───────────────
export function brancherEcran(liens){
  chargerDebrief = liens.chargerDebrief;
  chargerParcours = liens.chargerParcours;

  document.addEventListener("fullscreenchange", function(){
    $("ce-plein").textContent = document.fullscreenElement ? "Quitter le plein écran" : "Plein écran";
    $("ce-plein").classList.toggle("on", !!document.fullscreenElement);
  });

  $("ce-quit").addEventListener("click", fermerEcran);
  $("ce-plein").addEventListener("click", pleinEcran);
  $("ce-prog").addEventListener("click", function(){ modeEcran("prog"); });
  $("ce-clas").addEventListener("click", function(){ modeEcran("clas"); });
  $("ce-rep-b").addEventListener("click", function(){
    if (suivi.vue === "rep") suivi.repIndex++;   // reclic : question suivante
    modeEcran("rep");
  });
  // Le parcours reste dans la rotation, lui : il se regarde PENDANT l'heure, et
  // c'est même sa raison d'être — voir en passant qu'il manque trois personnes
  // au contrôle. Le débriefing, qui conclut, l'arrête.
  $("ce-par-b").addEventListener("click", function(){ modeEcran("par"); });
  $("ce-deb-b").addEventListener("click", function(){
    // Passer au débriefing arrête la rotation : on ne veut pas que l'écran
    // reparte sur le classement au milieu de la conclusion.
    if (suivi.auto) rotationAuto();
    modeEcran("deb");
  });
  $("ce-auto").addEventListener("click", rotationAuto);
  $("ce-min").addEventListener("click", minuteur);
  $("ce-son").addEventListener("click", basculerSon);
  
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && suivi.ecran) fermerEcran();
  });
}

export { modeEcran, rendreEcran, rotationAuto, fermerEcran,
         minuteur, pleinEcran, basculerSon };
