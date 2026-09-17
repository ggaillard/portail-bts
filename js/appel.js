// ── Le début d'heure : l'appel, l'humeur, et les deux questionnaires fixes ─
//
// Septième module sorti de app.js (étape A6bis de REFONTE.md). Tout ce qui se
// passe dans les cinq premières minutes, des deux côtés de l'écran.
//
// L'appel n'est pas un mécanisme à part : c'est une SÉANCE NUMÉRO 99 par
// classe, ouverte en permanence, à laquelle on ajoute chaque jour une question
// `appel-AAAA-MM-JJ`. Y répondre, c'est être présent ; l'absence est l'absence
// de réponse. Le détail, et les raisons de chaque choix, sont dans CLAUDE.md.
//
// Deux règles de ce fichier ne se devinent pas et se perdraient au premier
// nettoyage :
//
//   · LES NOMS NE SORTENT PAS D'ICI. `eleves` n'a ni nom ni prénom, et le
//     dépôt est public. La correspondance numéro -> nom vit dans le
//     localStorage de CE navigateur (lireNoms / enregistrerNoms / nomDe), et
//     chaque appareil a donc besoin de sa copie. Ne jamais proposer de la
//     mettre en base ni dans config.js.
//
//   · LA LIGNE DES NUMÉROS ABSENTS EST CELLE QU'ON LIT À VOIX HAUTE. Rien ne
//     doit passer devant, et son bouton « Copier » reste petit à l'écran avec
//     44 px de zone tactile sous le doigt. outils/t_appel.mjs le vérifie.
//
// « Faisons connaissance » (séance 98) et « Recherche de stage » (97) sont ici
// parce qu'ils partagent tout avec l'appel : la même carte de classe, les
// mêmes pastilles, le même dépouillement par numéro.

import { $, sb, suivi, erreur, typo, estDemo, classesReelles, nomDe, prenomSeul,
         lireNoms, enregistrerNoms,
         pastilles, pastilleAppel, copierTexte, majFile, marquerEtape,
         texteEnvoi, signalerSessionPerimee } from './socle.js';

function proposerAppel(){
  var bloc = $("bloc-appel");
  bloc.hidden = true;
  erreur("err-appel", "");

  sb.rpc("appel_du_jour").then(function(r){
    // Fonction pas encore déployée, ou pas d'appel aujourd'hui : on n'affiche
    // rien. L'espace étudiant reste utilisable, c'est le comportement d'avant.
    if (!r || r.error || !r.data) { $("bloc-humeur").hidden = true; majFile(); return; }
    var a = r.data;

    bloc.hidden = false;
    $("appel-titre").textContent = typo(a.intitule || "Question du jour");
    marquerEtape("bloc-appel", false);
    proposerHumeur(a.humeur, a.seance_id);

    if (a.repondu) { appelRepondu(a.ma_reponse, null); return; }

    var choix = $("appel-choix");
    choix.innerHTML = "";
    ["A","B","C","D"].forEach(function(lettre, i){
      // Sans libellés en base, on s'en tient aux lettres : la question est
      // alors projetée au tableau, et l'écran ne sert qu'à répondre.
      var opt = (a.options && a.options[i]) ? lettre + ". " + a.options[i] : lettre;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-sec appel-opt";
      b.textContent = opt;
      b.addEventListener("click", function(){ repondreAppel(a, lettre); });
      choix.appendChild(b);
    });
  });
}

function repondreAppel(a, lettre){
  var boutons = $("appel-choix").querySelectorAll("button");
  Array.prototype.forEach.call(boutons, function(b){ b.disabled = true; });
  erreur("err-appel", "");

  sb.rpc("repondre", {
    p_seance_id: a.seance_id,
    p_question:  a.question,
    p_reponse:   lettre
  }).then(function(r){
    if (r.error) {
      // Une séance fermée refuse les réponses. Réessayer n'y changera rien :
      // il faut le dire, sinon l'étudiant s'acharne et l'enseignant ne sait pas.
      erreur("err-appel", texteEnvoi(r.error, "appel"));
      signalerSessionPerimee(r.error);
      Array.prototype.forEach.call(boutons, function(b){ b.disabled = false; });
      return;
    }
    appelRepondu(lettre, r.data);
  });
}

function appelRepondu(lettre, retour){
  $("appel-choix").innerHTML = "";
  marquerEtape("bloc-appel", true);
  var texte = "Présence enregistrée" + (lettre ? " — vous avez répondu " + lettre + "." : ".");
  if (retour && typeof retour.correct === "boolean") {
    texte += retour.correct
      ? " ✅ Bonne réponse."
      : " ❌ La bonne réponse était " + retour.bonne_reponse + ".";
  }
  erreur("err-appel", texte, true);
}

function proposerHumeur(h, seanceId){
  var bloc = $("bloc-humeur");
  if (!h) { bloc.hidden = true; majFile(); return; }
  bloc.hidden = false;
  erreur("err-humeur", "");
  $("humeur-titre").textContent = typo(h.intitule || "Et aujourd'hui, comment ça va ?");
  marquerEtape("bloc-humeur", false);

  if (h.repondu) return humeurRepondue(h.ma_reponse, h.options);

  var choix = $("humeur-choix");
  choix.innerHTML = "";
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!h.options || !h.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt";
    b.textContent = h.options[i];
    b.addEventListener("click", function(){
      var boutons = choix.querySelectorAll("button");
      Array.prototype.forEach.call(boutons, function(x){ x.disabled = true; });
      sb.rpc("repondre", { p_seance_id: seanceId, p_question: h.question, p_reponse: lettre })
        .then(function(r){
          if (r.error) {
            erreur("err-humeur", texteEnvoi(r.error, "appel"));
            signalerSessionPerimee(r.error);
            Array.prototype.forEach.call(boutons, function(x){ x.disabled = false; });
            return;
          }
          humeurRepondue(lettre, h.options);
        });
    });
    choix.appendChild(b);
  });
}

function humeurRepondue(lettre, options){
  $("humeur-choix").innerHTML = "";
  marquerEtape("bloc-humeur", true);
  var i = ["A","B","C","D"].indexOf(lettre);
  var dit = (options && i >= 0 && options[i]) ? " — " + options[i] : "";
  erreur("err-humeur", "C'est noté, merci" + dit + ".", true);
}


// L'appel répond à « qui est là ? », le tableau de bord à « où en sont-ils ? ».
// Deux questions différentes : deux blocs, pour qu'on ne lise pas l'une en
// croyant lire l'autre. Et toutes les classes ensemble : l'appel ne dépend pas
// de la séance qu'on est en train de regarder plus bas.
function chargerAppelToutesClasses(classes){
  var carte = $("carte-appel"), z = $("appel-classes");
  z.innerHTML = "";
  carte.hidden = true;
  if (!classes || !classes.length) return;

  var restant = classes.length, affiches = 0, absentsTotal = 0;
  pastilleAppel(null);

  // Les blocs sont créés dans l'ordre des classes puis remplis à l'arrivée
  // des réponses : l'ordre à l'écran ne dépend pas de la vitesse du réseau.
  classes.forEach(function(c){
    var bloc = document.createElement("div");
    bloc.className = "appel-classe";
    bloc.hidden = true;
    z.appendChild(bloc);

    sb.rpc("appel_classe", { p_classe_id: Number(c.id) }).then(function(r){
      restant--;
      var a = (r && !r.error && r.data && r.data.ok) ? r.data : null;
      // Une classe sans séance d'appel — les classes de démonstration — est
      // simplement absente de la carte plutôt que d'y occuper une ligne vide.
      if (a) {
        remplirAppelClasse(bloc, c, a); bloc.hidden = false; affiches++;
        absentsTotal += (a.absents || []).length;
      }
      if (restant === 0) {
        carte.hidden = affiches === 0;
        hisserQuestion();
        signalerNomsAbsents(classes);
        // Le nombre d'absents s'affiche sur l'onglet : c'est le seul chiffre
        // qu'on veut connaître sans avoir à ouvrir quoi que ce soit.
        pastilleAppel(affiches === 0 ? null : absentsTotal);
      }
    });
  });
}

// Les prénoms vivent dans le navigateur, jamais en base. Conséquence directe :
// chaque appareil doit les recevoir une fois — le poste de la salle, puis le
// téléphone. Sans eux, l'appel se fait au numéro et rien ne l'expliquait : on
// croyait à une carte cassée plutôt qu'à une liste jamais collée.
function signalerNomsAbsents(classes){
  var z = $("ac-sans-noms");
  if (!z) return;
  var noms = lireNoms();
  var sans = (classes || []).filter(function(c){
    var m = noms[c.code];
    return !m || !Object.keys(m).length;
  });
  z.innerHTML = "";
  z.hidden = !sans.length;
  if (!sans.length) return;

  var d = document.createElement("div");
  d.className = "msg";
  d.textContent = (sans.length === 1
    ? "Aucun nom chargé pour " + (sans[0].nom || sans[0].code) + " : "
    : "Aucun nom chargé pour " + sans.length + " classes : ") +
    "l'appel s'affiche au numéro seul. Les noms restent dans ce navigateur, " +
    "donc chaque appareil a besoin de sa copie — le poste de la salle, puis le téléphone.";
  var b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-sec";
  b.style.marginTop = ".5rem";
  b.textContent = "Coller les noms maintenant";
  b.addEventListener("click", function(){
    var det = $("bloc-noms");
    det.hidden = false;
    det.open = true;
    det.scrollIntoView({ block: "center" });
    $("noms-saisie").focus();
  });
  d.appendChild(document.createElement("br"));
  d.appendChild(b);
  z.appendChild(d);
}

// La question du jour est la même pour toutes les classes la plupart du temps :
// c'est la question de repli, « Vous êtes là ? … », que appel_du_jour() fabrique
// quand aucune question de la banque n'a été posée. Répétée sous chaque titre de
// classe, elle coûtait deux lignes par classe — 46 px sur un téléphone, deux
// fois — pour dire deux fois la même chose, et elle poussait vers le bas le seul
// bloc qu'on vient chercher : les numéros absents.
//
// Elle monte donc en tête de carte, une seule fois, QUAND ELLE EST IDENTIQUE
// partout. Dès que deux classes n'ont pas la même — une question de la banque
// posée sur l'une seulement — chacune reprend la sienne : à ce moment-là, la
// différence est précisément l'information.
function hisserQuestion(){
  var z = $("ac-question");
  if (!z) return;
  var blocs = $("appel-classes").querySelectorAll(".appel-classe:not([hidden]) .ac-q");
  var textes = Array.prototype.map.call(blocs, function(p){ return p.textContent; });
  var toutes = textes.length > 1 && textes.every(function(t){
    return t && t === textes[0];
  });
  z.hidden = !toutes;
  z.textContent = toutes ? typo(textes[0]) : "";
  Array.prototype.forEach.call(blocs, function(p){ p.hidden = toutes; });
}

function remplirAppelClasse(bloc, c, a){
  bloc.innerHTML = "";
  bloc.dataset.code = c.code || "";
  bloc.dataset.nom  = c.nom || c.code || "";
  bloc.__absents = a.pose ? (a.absents || []) : null;
  var h = document.createElement("h3");
  h.textContent = c.nom || c.code;
  bloc.appendChild(h);

  var q = document.createElement("p");
  q.className = "ac-q";
  bloc.appendChild(q);

  if (!a.pose) {
    q.textContent = "Aucune question posée aujourd'hui — le premier étudiant qui " +
                    "se connectera déclenchera la question de présence.";
    return;
  }
  q.textContent = a.intitule || "";

  var pre = a.presents || [], abs = a.absents || [];

  // « 24 / 31 » se lit sans réfléchir ; « 24 présents » ne dit pas s'il en
  // manque un ou douze.
  var compte = document.createElement("p");
  compte.className = "ac-compte";
  compte.innerHTML = "<b></b> · <span></span>";
  compte.querySelector("b").textContent = a.inscrits
    ? pre.length + " / " + a.inscrits + " présents"
    : pre.length + (pre.length > 1 ? " présents" : " présent");
  compte.querySelector("span").textContent =
    abs.length ? (abs.length + (abs.length > 1 ? " absents" : " absent")) : "personne ne manque";
  bloc.appendChild(compte);

  // Les numéros en gros, avec le prénom collé à chacun quand il est connu.
  // C'est la ligne qu'on lit à voix haute : elle doit se suffire.
  bloc.appendChild(ligneAbsents(c, abs));

  // Ceux dont l'absence se répète. Une absence isolée et une quatrième
  // d'affilée demandent deux gestes différents ; la carte les distinguait
  // pas du tout.
  var suivis = abs.filter(function(x){ return (Number(x.manquees) || 0) >= 2; });
  if (suivis.length) bloc.appendChild(blocAssiduite(c, suivis, a));

  // Les arrivées : une grille de six colonnes sur un écran large, une colonne
  // de vingt-quatre lignes sur un téléphone. Repliées là, dépliées ici — ce
  // qu'on cherche en séance, c'est qui manque, pas qui est venu.
  var det = document.createElement("details");
  det.className = "ac-pre";
  det.open = window.matchMedia("(min-width: 40rem)").matches;
  var som = document.createElement("summary");
  som.textContent = pre.length + (pre.length > 1 ? " arrivées" : " arrivée") +
                    (pre.length ? " — de " + pre[0].heure + " à " + pre[pre.length - 1].heure : "");
  det.appendChild(som);
  var zp = document.createElement("div");
  zp.className = "pastilles";
  det.appendChild(zp);
  bloc.appendChild(det);
  pastilles(zp, pre, "pre", function(x){
    var n = nomDe(c.code, x.numero);
    return x.numero + " " + (x.avatar || "") + " " + x.heure + (n ? " · " + n : "");
  });

  // La rangée de pastilles d'absents a disparu : elle répétait mot pour mot
  // la ligne rouge du dessus, prénoms compris.

  var zh = document.createElement("div");
  bloc.appendChild(zh);
  rendreHumeurClasse(zh, a);
}

// « 04 Marwan   05 Sofia   07 Achille » — le numéro reste en gros, le prénom
// se glisse à côté, plus petit. Sans noms chargés dans ce navigateur, on
// retombe sur les numéros seuls et on dit comment y remédier.
function ligneAbsents(c, abs, libelle, vide){
  var nums = numerosAbsents(abs);
  var d = document.createElement("div");
  d.className = "ac-nums" + (nums.length ? "" : " vide");

  var lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = nums.length ? (libelle || "Absents") : (libelle || "Appel");
  d.appendChild(lbl);

  var v = document.createElement("span");
  v.className = "nums";
  if (!nums.length) {
    v.textContent = vide || "Personne ne manque.";
  } else {
    nums.forEach(function(n){
      var u = document.createElement("span");
      u.className = "ac-u";
      var num = document.createElement("b");
      num.textContent = n;
      u.appendChild(num);
      var nom = nomDe(c.code, n);
      if (nom) {
        var pn = document.createElement("i");
        pn.className = "ac-pn";
        pn.textContent = prenomSeul(nom);
        u.appendChild(pn);
      }
      v.appendChild(u);
    });
  }
  d.appendChild(v);

  if (nums.length) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-mini";
    b.textContent = "Copier";
    b.addEventListener("click", function(){ copierTexte(nums.join(", "), b); });
    d.appendChild(b);
  }
  return d;
}


// « 04 Marwan — 3 absences sur 4, pas vu depuis 7 jours ». La phrase dit le
// geste : trois absences sur quatre, ce n'est plus un oubli.
function blocAssiduite(c, liste, a){
  var d = document.createElement("div");
  d.className = "ac-suivi";
  var t = document.createElement("b");
  t.textContent = "Absences qui se répètent";
  d.appendChild(t);
  var ul = document.createElement("ul");
  liste.sort(function(x, y){ return (y.manquees || 0) - (x.manquees || 0); });
  liste.forEach(function(x){
    var li = document.createElement("li");
    var nom = nomDe(c.code, x.numero);
    var bouts = [x.manquees + "/" + (x.sur || a.appels_poses || x.manquees) + " absences"];
    if (x.jamais) bouts.push("jamais venu");
    else if (x.depuis !== null && x.depuis !== undefined) {
      bouts.push(x.depuis === 0 ? "vu aujourd'hui"
               : x.depuis === 1 ? "pas vu depuis hier"
               : "pas vu depuis " + x.depuis + " j");
    }
    li.innerHTML = "<b></b><span></span>";
    li.querySelector("b").textContent = x.numero + (nom ? " " + prenomSeul(nom) : "");
    // « 3/6 absences, pas vu depuis 7 j » plutôt que la phrase complète : sur
    // un téléphone, « 3 absences sur 6 » passait à la ligne et doublait la
    // hauteur du bloc. Le chiffre reste entier, c'est la formulation qui maigrit.
    li.querySelector("span").textContent = " — " + bouts.join(", ");
    ul.appendChild(li);
  });
  d.appendChild(ul);
  return d;
}

// Les numéros seuls, gros et espacés : à l'appel on lit des numéros, pas des
// noms. Les noms restent en dessous, sur les pastilles, pour lever un doute.
function numerosAbsents(abs){
  return (abs || []).map(function(x){ return String(x.numero || "").trim(); })
                    .filter(Boolean)
                    .sort(function(a, b){ return Number(a) - Number(b); });
}

function ligneNumeros(c, abs, libelle, vide){
  var nums = numerosAbsents(abs);
  var d = document.createElement("div");
  d.className = "ac-nums" + (nums.length ? "" : " vide");
  var lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = nums.length ? (libelle || "Absents") : (libelle || "Appel");
  var v = document.createElement("span");
  v.className = "nums";
  v.textContent = nums.length ? nums.join("  ") : (vide || "Personne ne manque.");
  d.appendChild(lbl);
  d.appendChild(v);
  if (nums.length) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-mini";
    b.textContent = "Copier";
    b.addEventListener("click", function(){
      copierTexte(nums.join(", "), b);
    });
    d.appendChild(b);
  }
  return d;
}


// Combien de chaque humeur, dans l'ordre des options. Une barre par smiley :
// on lit l'état du groupe sans avoir à compter.
// L'humeur se replie, et son résumé porte déjà la réponse.
//
// Quatre barres par classe faisaient 133 px chacune — 266 px pour deux classes,
// soit plus que le compte et les numéros absents réunis. Or l'humeur ne se lit
// pas au même moment que l'appel : l'appel est le geste de trente secondes du
// début d'heure, l'humeur est ce qu'on regarde une fois assis. La pousser sous
// un repli ne la perd pas — le résumé dit combien ont répondu et ce qui domine,
// donc l'essentiel tient sur la ligne fermée.
//
// Un total à zéro n'affiche plus rien du tout : « personne n'a encore dit son
// humeur » occupait une ligne pour ne rien apprendre sur une carte dont le
// sujet est qui est là.
function rendreHumeurClasse(z, a){
  z.innerHTML = "";
  var opts = a.humeur_options, compte = a.humeur || {};
  if (!opts || !opts.length) return;

  var lettres = ["A","B","C","D"];
  var total = lettres.reduce(function(s, l){ return s + (compte[l] || 0); }, 0);
  if (!total) return;

  // Ce qui domine, nommé : « 9 · Ça va » en dit plus que « 22 réponses ».
  var fort = 0;
  lettres.forEach(function(l, i){ if ((compte[l] || 0) > (compte[lettres[fort]] || 0)) fort = i; });

  var det = document.createElement("details");
  det.className = "ac-hum";
  var som = document.createElement("summary");
  som.textContent = "Humeur — " + total + (total > 1 ? " réponses" : " réponse") +
    (opts[fort] ? ", surtout « " + opts[fort].replace(/^\S+\s*/, "") + " »" : "");
  det.appendChild(som);

  opts.forEach(function(libelle, i){
    var n = compte[lettres[i]] || 0;
    var l = document.createElement("div");
    l.className = "jalon";
    l.innerHTML = '<span class="jalon-n"></span><span class="jalon-b"></span><span></span>';
    l.querySelector(".jalon-n").textContent = libelle.slice(0, 2);
    l.querySelector(".jalon-b").style.width = Math.round(n / total * 55) + "%";
    l.querySelector("span:last-child").textContent =
      n + " · " + libelle.replace(/^\S+\s*/, "");
    det.appendChild(l);
  });
  z.appendChild(det);
}

// Le geste du matin : la liste des absents, nommée, prête à coller dans le
// cahier d'appel. Les numéros sans nom connu restent des numéros.
function copierAbsents(){
  var blocs = $("appel-classes").querySelectorAll(".appel-classe");
  var sortie = [];
  Array.prototype.forEach.call(blocs, function(b){
    if (!b.__absents) return;
    var nums = numerosAbsents(b.__absents);
    if (!nums.length) { sortie.push(b.dataset.nom + " — aucun absent"); return; }
    // Les numéros d'abord, en clair : c'est la ligne qu'on recopie sur le
    // cahier d'appel. Les noms suivent, entre parenthèses, pour vérifier.
    var noms = nums.map(function(n){
      var nom = nomDe(b.dataset.code, n);
      return nom ? n + " " + nom : n;
    });
    sortie.push(b.dataset.nom + " — absents : " + nums.join(", ") +
                "\n  " + noms.join(" · "));
  });
  var texte = sortie.join("\n");
  if (!texte) { erreur("err-noms", "Rien à copier : l'appel n'est pas encore chargé."); return; }

  copierTexte(texte).then(function(ok){
    erreur("err-noms", ok ? "Liste copiée." : "Copie refusée par le navigateur — la voici :\n" + texte, ok);
    $("bloc-noms").hidden = false;
    if (!ok) $("bloc-noms").open = true;
  });
}

export { chargerAppelToutesClasses, proposerAppel, proposerHumeur,
         ligneAbsents, ligneNumeros, numerosAbsents, copierAbsents,
         // Exportées pour les contrôles : outils/t_appel.mjs pousse ses propres
         // données dans la carte plutôt que d'attendre une base. Une fonction
         // de rendu exportée est une surface publique de plus, et c'est un prix
         // accepté — un contrôle qui ne peut pas atteindre l'écran qu'il mesure
         // finit par mesurer autre chose.
         remplirAppelClasse, hisserQuestion };
