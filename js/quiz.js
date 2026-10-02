// ── Répondre à un questionnaire, côté étudiant ────────────────────────────
//
// Les trois modes de rendu, et rien d'autre :
//
//   sequentiel  une question à la fois, sans retour en arrière ;
//   revisable   tout à l'écran, chaque réponse remplaçable ;
//   revision    une à la fois, LA CORRECTION APRÈS CHAQUE RÉPONSE, et on
//               recommence autant qu'on veut.
//
// Le troisième est le seul écran du portail qui dise « faux » à un étudiant,
// et il a ses propres règles, toutes dans CLAUDE.md. Deux tiennent au code
// d'ici : la page ne devine jamais la bonne réponse — après chaque envoi elle
// redemande mes_questionnaires(), parce que calculer le verdict sur place
// voudrait dire lui avoir envoyé la grille ; et la carte NE SE REPLIE PAS
// quand tout est répondu, contrairement aux deux autres, parce qu'un
// questionnaire de révision se refait.

import { $, sb, suivi, erreur, typo, majFile, marquerEtape,
         texteEnvoi, signalerSessionPerimee } from './socle.js';
import { lireAvantDeRepondre } from './lecture.js';

function chargerQuestionnairesEtu(){
  $("questionnaires-etu").innerHTML = "";
  sb.rpc("mes_questionnaires").then(function(r){
    if (r && !r.error && r.data && r.data.ok) {
      rendreQuestionnairesEtu(r.data.liste || []);
      return;
    }
    // Repli : la migration de la bibliothèque n'est pas encore déployée. On
    // rappelle les deux anciennes fonctions et on les met dans la même forme.
    // Ce repli disparaîtra — il n'existe que pour qu'un déploiement en retard
    // ne vide pas l'écran d'une classe en séance.
    var liste = [];
    var fini = 0;
    var poser = function(){ if (++fini === 2) rendreQuestionnairesEtu(liste); };
    sb.rpc("connaissance").then(function(rc){
      var d = rc && !rc.error && rc.data;
      if (d && d.questions && d.questions.length) {
        liste.push({ seance_id: d.seance_id, numero: 98, titre: "Faisons connaissance",
          intro: "Quelques questions posées une seule fois dans l'année. Il n'y a pas " +
                 "de bonne réponse : elles me servent à adapter les cours à ce que vous êtes.",
          mode: "sequentiel", total: d.total, faites: d.faites, questions: d.questions });
      }
      poser();
    });
    sb.rpc("stage").then(function(rs){
      var d = rs && !rs.error && rs.data;
      if (d && d.questions && d.questions.length) {
        liste.push({ seance_id: d.seance_id, numero: 97, titre: "Votre recherche de stage",
          intro: "Un point d'étape, à remettre à jour dès que quelque chose bouge : " +
                 "vous pouvez changer vos réponses autant de fois que nécessaire.",
          mode: "revisable", total: d.total, faites: d.faites, questions: d.questions });
      }
      poser();
    });
  });
}

function rendreQuestionnairesEtu(liste){
  var z = $("questionnaires-etu");
  z.innerHTML = "";
  (liste || []).forEach(function(d){
    if (!d.questions || !d.questions.length) return;
    z.appendChild(carteQuestionnaire(d));
    (d.mode === "revision" ? rendreRevision
      : d.mode === "revisable" ? rendreRevisable : rendreSequentiel)(d);
  });
  majFile();
}

function carteQuestionnaire(d){
  var c = document.createElement("div");
  c.className = "card etape";
  c.id = "qn-" + d.seance_id;
  c.setAttribute("data-etape", d.titre);
  c.innerHTML = '<h2></h2><p class="hint"></p><div id="err-qn-' + d.seance_id + '"></div>' +
                '<p class="cn-int"></p><div class="appel-choix"></div>';
  c.querySelector("h2").textContent = d.titre;
  var h = c.querySelector(".hint");
  h.textContent = (d.intro || "") + " ";
  var av = document.createElement("b");
  av.className = "qn-av";
  h.appendChild(av);
  return c;
}

function zoneQ(d, sel){ return $("qn-" + d.seance_id).querySelector(sel); }

function rendreSequentiel(d){
  var reste = d.questions.filter(function(q){ return !q.ma_reponse; });
  var errId = "err-qn-" + d.seance_id;
  marquerEtape("qn-" + d.seance_id, !reste.length);

  if (!reste.length) {
    // La carte reste, repliée. La faire disparaître se lit comme un bogue :
    // « il était là tout à l'heure ».
    zoneQ(d, ".qn-av").textContent = "";
    zoneQ(d, ".cn-int").textContent = "";
    zoneQ(d, ".appel-choix").innerHTML = "";
    erreur(errId, "C'est fait, merci — les " + d.questions.length +
                  " questions sont répondues.", true);
    return;
  }
  erreur(errId, "");

  var q = reste[0], faites = d.questions.length - reste.length;
  zoneQ(d, ".qn-av").textContent = "Question " + (faites + 1) + " sur " + d.questions.length + ".";
  zoneQ(d, ".cn-int").textContent = typo(q.intitule || q.question);

  var choix = zoneQ(d, ".appel-choix");
  choix.innerHTML = "";
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!q.options || !q.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt";
    b.textContent = q.options[i];
    b.addEventListener("click", function(){
      var boutons = choix.querySelectorAll("button");
      Array.prototype.forEach.call(boutons, function(x){ x.disabled = true; });
      sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                           p_reponse: lettre }).then(function(rr){
        if (rr.error) {
          erreur(errId, texteEnvoi(rr.error));
          signalerSessionPerimee(rr.error);
          Array.prototype.forEach.call(boutons, function(x){ x.disabled = false; });
          return;
        }
        // On avance sur l'objet local : pas d'aller-retour entre deux questions.
        q.ma_reponse = lettre;
        rendreSequentiel(d);
      });
    });
    choix.appendChild(b);
  });
}

function rendreRevisable(d){
  var errId = "err-qn-" + d.seance_id;
  erreur(errId, "");
  marquerEtape("qn-" + d.seance_id, (d.faites || 0) >= d.total);
  var av = zoneQ(d, ".qn-av");
  var compter = function(){
    av.textContent = d.faites
      ? "Vous avez répondu à " + d.faites + " question" + (d.faites > 1 ? "s" : "") +
        " sur " + d.total + "."
      : "";
  };
  compter();

  var z = zoneQ(d, ".appel-choix");
  z.className = "";                       // pas la grille de l'appel : des blocs
  z.innerHTML = "";
  d.questions.forEach(function(q){
    var bloc = document.createElement("div");
    bloc.className = "st-q";
    var t = document.createElement("span");
    t.className = "cn-int";
    t.textContent = typo(q.intitule || q.question);
    bloc.appendChild(t);

    var opts = document.createElement("div");
    opts.className = "st-opts";
    ["A","B","C","D"].forEach(function(lettre, i){
      if (!q.options || !q.options[i]) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "st-opt" + (q.ma_reponse === lettre ? " pris" : "");
      b.textContent = q.options[i];
      b.addEventListener("click", function(){
        if (q.ma_reponse === lettre) return;      // déjà dit : rien à réécrire
        var tous = opts.querySelectorAll("button");
        Array.prototype.forEach.call(tous, function(x){ x.disabled = true; });
        sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                             p_reponse: lettre }).then(function(rr){
          Array.prototype.forEach.call(tous, function(x){ x.disabled = false; });
          if (rr.error) {
            erreur(errId, texteEnvoi(rr.error));
            signalerSessionPerimee(rr.error);
            return;
          }
          var neuf = !q.ma_reponse;
          q.ma_reponse = lettre;
          if (neuf) d.faites = (d.faites || 0) + 1;
          Array.prototype.forEach.call(tous, function(x){ x.className = "st-opt"; });
          b.className = "st-opt pris";
          compter();
          marquerEtape("qn-" + d.seance_id, (d.faites || 0) >= d.total);
          erreur(errId, d.faites >= d.total
            ? "C'est à jour. Revenez le modifier dès que la situation change."
            : "Enregistré.", true);
        });
      });
      opts.appendChild(b);
    });
    bloc.appendChild(opts);
    z.appendChild(bloc);
  });
}

function rendreRevision(d){
  var errId = "err-qn-" + d.seance_id;
  erreur(errId, "");

  // Un « tour » : après « Tout recommencer », les réponses déjà en base
  // restent (elles seront remplacées une à une), mais l'écran les tient pour
  // non répondues tant qu'on ne les a pas refaites dans ce tour. Sans cela,
  // « vous pouvez tout refaire » était une promesse : une question répondue
  // restait figée sur sa correction.
  var faiteIci = function(q){ return d._tour ? !!d._tour[q.question] : !!q.ma_reponse; };

  // On reprend là où l'étudiant s'est arrêté, pas au début : revenir sur ce
  // qu'il a déjà fait pour atteindre la suite est ce qui fait abandonner.
  if (d._i === undefined) {
    var i = 0;
    while (i < d.questions.length && faiteIci(d.questions[i])) i++;
    d._i = i < d.questions.length ? i : 0;
  }
  if (d._i >= d.questions.length) d._i = 0;

  var q = d.questions[d._i];
  var faites = d.questions.filter(faiteIci).length;
  var justes = d.questions.filter(function(x){ return faiteIci(x) && x.juste === true; }).length;

  var av = zoneQ(d, ".qn-av");
  av.textContent = "Question " + (d._i + 1) + " sur " + d.questions.length +
    (q.theme ? " · " + q.theme : "") +
    (faites ? " — " + justes + " juste" + (justes > 1 ? "s" : "") +
              " sur " + faites + " répondue" + (faites > 1 ? "s" : "") + "." : ".");

  zoneQ(d, ".cn-int").textContent = typo(q.intitule || q.question);

  var choix = zoneQ(d, ".appel-choix");
  choix.className = "appel-choix";
  choix.innerHTML = "";

  var repondu = faiteIci(q);
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!q.options || !q.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt rv-opt" + (d._choix === lettre && !repondu ? " pris" : "");
    b.textContent = q.options[i];
    if (repondu) {
      b.disabled = true;
      if (q.bonne === lettre) b.className += " juste";
      else if (q.ma_reponse === lettre) b.className += " rate";
    } else {
      b.addEventListener("click", function(){
        // Avec la certitude, choisir ne suffit pas : on dit d'abord à quel
        // point on était sûr, PUIS on voit la correction. Dans l'autre ordre
        // la réponse ne vaudrait plus rien.
        if (d.certitude) { d._choix = lettre; rendreRevision(d); return; }
        envoyerRevision(d, q, lettre, null, choix);
      });
    }
    choix.appendChild(b);
  });
  // Lire avant de répondre (02/10) : les options restent grisées le temps de
  // lire la question. Un second tour (« Tout recommencer ») relit aussi.
  if (!repondu) lireAvantDeRepondre("rv-" + d.seance_id + "-" + q.question + (d._tour ? "-bis" : ""),
                                    q.intitule, q.options, choix);

  // Un seul bloc après les options, vidé à chaque rendu. Insérer verdict,
  // explication et boutons directement dans la carte les y empilerait : douze
  // questions plus tard, la carte porterait douze corrections.
  var apres = $("qn-" + d.seance_id).querySelector(".rv-apres");
  if (!apres) {
    apres = document.createElement("div");
    apres.className = "rv-apres";
    choix.parentNode.appendChild(apres);
  }
  apres.innerHTML = "";

  if (!repondu && d.certitude && d._choix) {
    var qc = document.createElement("p");
    qc.className = "rv-cert-q";
    qc.textContent = "Avant de voir la correction : vous étiez…";
    apres.appendChild(qc);
    var cz = document.createElement("div");
    cz.className = "rv-suite rv-cert";
    [["S", "Sûr·e"], ["H", "J'hésitais"], ["X", "Au hasard"]].forEach(function(c){
      var bc = document.createElement("button");
      bc.type = "button";
      bc.className = "btn btn-sec";
      bc.textContent = c[1];
      bc.addEventListener("click", function(){ envoyerRevision(d, q, d._choix, c[0], cz); });
      cz.appendChild(bc);
    });
    apres.appendChild(cz);
  }

  var suite = document.createElement("div");
  suite.className = "rv-suite";

  if (repondu) {
    var v = document.createElement("p");
    v.className = "rv-verdict " + (q.juste ? "juste" : "rate");
    v.textContent = q.juste ? "Juste." : "Ce n'était pas ça.";
    if (!q.juste && q.ma_certitude === "S") {
      v.textContent += " Vous étiez sûr·e : c'est le point à relire en premier.";
    }
    apres.appendChild(v);
    if (q.explication) {
      var e = document.createElement("p");
      e.className = "rv-expl";
      e.textContent = typo(q.explication);
      apres.appendChild(e);
    }

    var dernier = d._i >= d.questions.length - 1;
    var b1 = document.createElement("button");
    b1.type = "button";
    b1.className = "btn";
    b1.textContent = dernier ? "Revenir à la première" : "Question suivante";
    b1.addEventListener("click", function(){
      d._i = dernier ? 0 : d._i + 1;
      rendreRevision(d);
    });
    suite.appendChild(b1);
  }
  apres.appendChild(suite);

  if (faites >= d.questions.length) apres.appendChild(bilanRevision(d, justes));

  // La file d'attente ne compte pas la révision : elle n'a pas de fin, et un
  // bandeau qui réclame indéfiniment une carte qu'on peut refaire à volonté se
  // lirait comme un reproche. Mais on ne la marque SURTOUT PAS « faite » :
  // `data-fait="oui"` masque l'intitulé et les options (voir la règle CSS
  // `.etape[data-fait="oui"] > .appel-choix`), et la carte se réduirait à son
  // titre — visible, et impossible à utiliser. C'est le défaut du 16/09.
  var carte = $("qn-" + d.seance_id);
  if (carte) {
    carte.setAttribute("data-hors-file", "oui");
    carte.setAttribute("data-fait", "non");
  }
  majFile();
}

// Le bilan d'un tour complet : le score, puis une ligne par thème — c'est ce
// qui dit quoi relire. Les chiffres viennent de la base (`bilan`), qui seule
// connaît `correct`. Un seul thème « Sans thème » n'apprend rien : on s'en
// tient alors au score.
function bilanRevision(d, justes){
  var z = document.createElement("div");
  z.className = "rv-bilan";
  var t = document.createElement("p");
  t.className = "rv-score";
  t.textContent = justes + " sur " + d.questions.length +
    ". Vous pouvez tout refaire : rien n'est noté ici.";
  z.appendChild(t);

  var themes = (d.bilan || []).filter(function(b){ return b.theme !== "Sans thème"; });
  if (themes.length) {
    var h = document.createElement("h3");
    h.textContent = "Votre bilan, thème par thème";
    z.appendChild(h);
    var ul = document.createElement("ul");
    ul.className = "rv-themes";
    var surs = 0;
    themes.forEach(function(b){
      surs += b.surs_faux || 0;
      var li = document.createElement("li");
      var taux = b.repondues ? Math.round(100 * b.justes / b.repondues) : null;
      var n = document.createElement("span");
      n.className = "rv-th-n";
      n.textContent = b.theme;
      var c = document.createElement("span");
      c.className = "badge " + (taux === null ? "neutre" : (taux >= 75 ? "ok" : (taux >= 45 ? "att" : "ko")));
      c.textContent = b.justes + " / " + b.questions +
        (taux === null ? "" : (taux >= 75 ? " · acquis" : (taux >= 45 ? " · fragile" : " · à revoir")));
      li.appendChild(n); li.appendChild(c);
      ul.appendChild(li);
    });
    z.appendChild(ul);
    if (surs) {
      var s = document.createElement("p");
      s.className = "rv-expl";
      s.textContent = surs + (surs > 1 ? " réponses fausses" : " réponse fausse") +
        " alors que vous étiez sûr·e : ce sont les points à relire en premier.";
      z.appendChild(s);
    }
  }

  var r = document.createElement("button");
  r.type = "button";
  r.className = "btn btn-sec";
  r.textContent = "Tout recommencer";
  r.addEventListener("click", function(){
    d._tour = {}; d._i = 0; d._choix = null;
    rendreRevision(d);
  });
  z.appendChild(r);
  return z;
}

function envoyerRevision(d, q, lettre, certitude, zone){
  var errId = "err-qn-" + d.seance_id;
  var tous = zone.parentNode.querySelectorAll("button");
  Array.prototype.forEach.call(tous, function(x){ x.disabled = true; });
  sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question,
                       p_reponse: lettre }).then(function(rr){
    if (rr.error) {
      erreur(errId, texteEnvoi(rr.error));
      signalerSessionPerimee(rr.error);
      Array.prototype.forEach.call(tous, function(x){ x.disabled = false; });
      return;
    }
    if (d._tour) d._tour[q.question] = true;
    d._choix = null;
    // La certitude part après la réponse, jamais avant : si elle échoue, la
    // réponse est déjà là, et c'est elle qui compte.
    var ensuite = certitude
      ? sb.rpc("repondre", { p_seance_id: d.seance_id, p_question: q.question + "-c",
                             p_reponse: certitude }).then(function(){}, function(){})
      : Promise.resolve();
    // La correction ne s'invente pas ici : on redemande la liste, et la base
    // décide de ce qu'elle livre. Deviner la bonne réponse côté page voudrait
    // dire l'y avoir envoyée — donc l'avoir publiée.
    ensuite.then(function(){ rafraichirRevision(d); });
  });
}

function rafraichirRevision(d){
  sb.rpc("mes_questionnaires").then(function(r){
    var frais = null;
    if (r && !r.error && r.data && r.data.ok) {
      (r.data.liste || []).forEach(function(x){
        if (x.seance_id === d.seance_id) frais = x;
      });
    }
    if (!frais) { erreur("err-qn-" + d.seance_id, "Réessayez dans un instant."); return; }
    d.questions = frais.questions;
    d.faites = frais.faites;
    d.justes = frais.justes;
    d.bilan = frais.bilan;
    d.certitude = frais.certitude;
    rendreRevision(d);
  });
}

export { chargerQuestionnairesEtu, rendreQuestionnairesEtu, rendreRevision, bilanRevision };
