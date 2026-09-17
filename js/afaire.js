// ── « Ce qui bloque » : la seule carte qu'on ne va jamais chercher ────────
//
// Treizième module sorti de app.js. Elle est épinglée au-dessus des onglets,
// visible depuis n'importe lequel, et elle est recalculée depuis la base à
// chaque affichage : rien n'y reste par oubli, et rien n'y manque. Si elle est
// verte, on peut fermer l'onglet.
//
// Deux choses s'y jouent, et elles ne se confondent pas :
//
//   · CE QUI EMPÊCHE DE FAIRE COURS est rouge. Le reste est une vigilance, et
//     une information qui ne demande AUCUN geste descend en pied de carte, en
//     petit. Le 16/09, « Question du jour pas encore créée » — qui se règle
//     d'elle-même à la première connexion d'un étudiant — occupait au téléphone
//     autant de place que « Séance 2 encore ouverte », qui laisse une séance
//     ouverte toute la nuit. Deux lignes identiques pour deux urgences
//     opposées : au bout d'une semaine, la carte ne se lit plus.
//
//   · UN GESTE NOMMÉ DOIT ÊTRE FAISABLE DEPUIS LA CARTE. Trois verbes
//     seulement sont exposés — demarrer, clore, ouvrir_controle — parce que
//     les autres règles réclament de saisir quelque chose que seul
//     l'enseignant sait ; celles-là emmènent au bon onglet, avec la classe et
//     la séance présélectionnées. On ne supprime pas la décision, seulement le
//     trajet.
//
// Une action inconnue arrive ici sans bouton plutôt qu'avec un bouton qui ne
// fait rien, et la migration vérifie de son côté que la base n'en renvoie pas
// d'autres.

import { $, sb, erreur, typo } from './socle.js';
import { ouvrirOnglet } from './navigation.js';
import { rafraichirApresActe } from './seance.js';

// Elle n'est stockée nulle part : a_faire() la recalcule depuis l'état réel de
// la base. On ne coche rien, on corrige, et la ligne disparaît d'elle-même.
// Une liste qu'on doit tenir à jour à la main finit toujours par être fausse,
// et une liste fausse est pire que pas de liste.
function chargerAFaire(){
  var carte = $("carte-afaire"), titre = document.querySelector(".epingle");
  carte.hidden = true;
  if (titre) titre.hidden = true;
  sb.rpc("a_faire").then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme avant.
    // Le titre suit la carte — un intertitre au-dessus de rien se lit comme
    // une panne, alors que c'est seulement une fonction non déployée.
    if (!r || r.error || !r.data || !r.data.ok) return;
    rendreAFaire(r.data);
    carte.hidden = false;
    if (titre) titre.hidden = false;
  });
}

var AF_ICONE = { bloquant: "⛔", attention: "⚠️", info: "ℹ️" };

function rendreAFaire(d){
  var b = Number(d.bloquants) || 0, a = Number(d.attentions) || 0;
  var etat = $("af-etat");
  if (b) {
    etat.className = "af-pastille bloc";
    etat.textContent = b + (b > 1 ? " points bloquants" : " point bloquant");
  } else if (a) {
    etat.className = "af-pastille att";
    etat.textContent = a + (a > 1 ? " points de vigilance" : " point de vigilance");
  } else {
    etat.className = "af-pastille rien";
    etat.textContent = "Rien à signaler";
  }

  var z = $("af-liste");
  z.innerHTML = "";
  var taches = d.taches || [];
  if (!taches.length) {
    z.innerHTML = '<p class="hint" style="margin:.3rem 0 0">Les séances sont ouvertes ' +
                  'quand il faut, les corrigés sont là, tout le monde a un code.</p>';
    return;
  }

  // Une information qui ne demande aucun geste n'est pas une tâche. Le 16/09,
  // « Question du jour pas encore créée » occupait, au téléphone, autant de
  // place que « Séance 2 encore ouverte » — alors que la première se règle
  // d'elle-même à la première connexion d'un étudiant et que la seconde
  // laisse une séance ouverte toute la nuit. Deux lignes identiques pour deux
  // urgences opposées : au bout d'une semaine on ne lit plus la carte. On les
  // sépare donc — ce qui réclame un geste en haut, le reste en pied de carte,
  // toujours écrit, mais à sa place. Rien n'est supprimé : une information qui
  // porte une action ou une destination remonte avec les tâches.
  var agir = [], infos = [];
  taches.forEach(function(t){
    if (t.gravite === "info" && !t.action && !t.aller) infos.push(t); else agir.push(t);
  });

  agir.forEach(function(t){
    var l = document.createElement("div");
    l.className = "af-l";
    l.innerHTML = '<span class="af-i"></span><div class="af-c">' +
                  '<p class="af-q"><span></span><span class="af-cl"></span></p>' +
                  '<p class="af-d"></p><p class="af-g" hidden>Le geste : <b></b></p>' +
                  '<div class="af-actes"></div><p class="af-msg" hidden></p></div>';
    l.querySelector(".af-i").textContent = AF_ICONE[t.gravite] || "•";
    l.querySelector(".af-q span:first-child").textContent = t.quoi || "";
    l.querySelector(".af-cl").textContent = t.classe || t.code || "";
    l.querySelector(".af-d").textContent = t.detail || "";
    garnirActes(l, t);
    z.appendChild(l);
  });

  // Si tout ce qui reste est informatif, la carte ne doit pas paraître vide :
  // la phrase de repos passe au-dessus du pied.
  if (!agir.length) {
    var r = document.createElement("p");
    r.className = "hint";
    r.style.margin = ".3rem 0 0";
    r.textContent = "Rien qui demande un geste.";
    z.appendChild(r);
  }

  infos.forEach(function(t){
    var p = document.createElement("p");
    p.className = "af-info";
    p.innerHTML = '<span aria-hidden="true">' + AF_ICONE.info + '</span> <b></b>' +
                  '<span class="af-cl"></span><span class="af-du"></span>';
    p.querySelector("b").textContent = t.quoi || "";
    p.querySelector(".af-cl").textContent = t.classe || t.code || "";
    p.querySelector(".af-du").textContent = t.detail ? " — " + t.detail : "";
    z.appendChild(p);
  });
}

// Les trois verbes que le portail sait exécuter. Ils viennent de la base, qui
// ne renvoie qu'eux — une action inconnue arriverait ici sans bouton plutôt
// qu'avec un bouton qui ne fait rien, et la migration le vérifie de son côté.
var AF_ACTES = {
  demarrer:        { rpc: "demarrer_seance",  args: function(t){ return { p_seance_id: Number(t.seance_id) }; },
                     fini: "Séance démarrée." },
  clore:           { rpc: "clore_seance",     args: function(t){ return { p_seance_id: Number(t.seance_id) }; },
                     fini: "Séance close." },
  ouvrir_controle: { rpc: "ouvrir_controle",  args: function(t){ return { p_seance_id: Number(t.seance_id),
                                                                          p_ouvert: true }; },
                     fini: "Le contrôle est proposé aux étudiants." }
};

// Les quatre onglets où l'on peut être emmené, quand aucune action n'est
// possible. On ne supprime pas la décision — seulement le trajet.
var AF_ONGLETS = { seance: "ong-seance", ensemble: "ong-ensemble",
                   quest: "ong-quest", appel: "ong-appel" };

function garnirActes(ligne, t){
  var z = ligne.querySelector(".af-actes");
  var msg = ligne.querySelector(".af-msg");
  var acte = t.action && AF_ACTES[t.action];

  // Sans action ni destination, le geste reste écrit : il y a des cas où la
  // phrase est tout ce qu'on peut donner (« leur attribuer un code »).
  if (!acte && !t.aller) {
    if (t.geste) {
      ligne.querySelector(".af-g b").textContent = t.geste;
      ligne.querySelector(".af-g").hidden = false;
    }
    return;
  }

  if (acte) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = t.geste || "Faire";
    b.addEventListener("click", function(){
      b.disabled = true;
      erreurLigne(msg, "");
      sb.rpc(acte.rpc, acte.args(t)).then(function(r){
        var d = r && r.data;
        // Les RPC du portail répondent { ok: false, motif } plutôt que de
        // lever : un refus n'est pas une panne, et il porte sa raison.
        if (r.error || (d && d.ok === false)) {
          b.disabled = false;
          erreurLigne(msg, motifAFaire(d), true);
          return;
        }
        ligne.classList.add("fait");
        erreurLigne(msg, acte.fini);
        // La carte se recalcule depuis la base : c'est elle qui décide si la
        // ligne disparaît, pas nous. Un rafraîchissement après une seconde,
        // le temps de lire la confirmation.
        setTimeout(function(){ chargerAFaire(); rafraichirApresActe(t); }, 1100);
      });
    });
    z.appendChild(b);
  }

  if (t.aller && AF_ONGLETS[t.aller]) {
    var a = document.createElement("button");
    a.type = "button";
    a.className = "btn btn-sec";
    a.textContent = acte ? "Voir la séance" : (t.geste || "Y aller");
    a.addEventListener("click", function(){ allerDepuisAFaire(t); });
    z.appendChild(a);
  }
}

function erreurLigne(p, texte, rate){
  p.hidden = !texte;
  p.textContent = texte || "";
  p.className = "af-msg" + (rate ? " rate" : "");
}

// Un refus nommé plutôt qu'un « ça n'a pas marché » : c'est la différence
// entre réessayer bêtement et comprendre. `appel` est le seul motif que l'on
// rencontre vraiment ici — la séance 99 ne se ferme pas, et c'est verrouillé.
function motifAFaire(d){
  var m = d && d.motif;
  if (m === "appel")   return "L'appel ne se ferme pas : c'est le registre de présence.";
  if (m === "refus")   return "Votre session enseignante a expiré. Réidentifiez-vous.";
  if (m === "inconnue") return "Cette séance n'existe plus.";
  return "Le geste n'a pas abouti. Réessayez dans un instant.";
}

// Emmener au bon endroit AVEC la bonne classe et la bonne séance déjà
// choisies. Sans cela, « Y aller » ne ferait que déplacer le problème d'un
// onglet : c'est le trajet — changer d'onglet, choisir la classe, choisir la
// séance — qu'on cherche à supprimer.
function allerDepuisAFaire(t){
  var ong = $(AF_ONGLETS[t.aller]);
  if (!ong) return;
  ong.click();
  if (t.classe_id && $("pk-classe")) {
    $("pk-classe").value = String(t.classe_id);
    $("pk-classe").dispatchEvent(new Event("change"));
  }
  // La liste des séances se remplit après le changement de classe : on pose
  // la séance une fois qu'elle existe dans le sélecteur, pas avant.
  if (t.seance_id && $("pk-seance")) {
    setTimeout(function(){
      var s = $("pk-seance");
      if (!s) return;
      s.value = String(t.seance_id);
      s.dispatchEvent(new Event("change"));
      var bloc = $("prevol") || s;
      if (bloc && bloc.scrollIntoView) bloc.scrollIntoView({ block: "center" });
    }, 350);
  }
}

export { chargerAFaire, rendreAFaire };
