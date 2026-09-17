// ── L'heure telle qu'on la lit : le parcours, puis le débriefing ──────────
//
// Douzième module sorti de app.js. Deux lectures d'une même heure, aux deux
// bouts, et toutes deux se projettent au tableau.
//
// LE PARCOURS, pendant. Quatre étapes — appel, humeur, contrôle d'entrée, quiz
// ou TP — et, pour chaque étudiant, la PREMIÈRE non faite. C'est elle qu'on lit
// en séance parce qu'elle nomme le geste, et la liste est triée par l'étape où
// l'on bute, pas par numéro : c'est l'ordre dans lequel on va les voir.
//
// La quatrième étape se compte différemment selon la nature de la séance — un
// TP se mesure en jalons franchis, un cours en questions répondues — et le nom
// de l'étape change avec. **Le portail lit ce nom dans la réponse, il ne le
// réécrit pas** : deux noms pour la même chose à deux endroits de l'écran est
// ce qui fait douter de ce qu'on lit.
//
// LE DÉBRIEFING, à la fin. Les concepts de l'heure, chacun avec la mesure de ce
// que la classe vient d'en montrer. Un concept « à revoir » désigne un point du
// cours, jamais quelqu'un — c'est la différence de nature avec le classement, et
// la raison pour laquelle cet écran est volontairement calme. Et la boucle :
// les concepts d'une séance sont exactement ce que testera le contrôle
// d'entrée de la suivante.
//
// Une étape NON POSÉE n'est pas une étape à zéro. « 0 / 13 » se lirait
// « personne ne l'a fait », alors que la bonne phrase est « pas posé ». Même
// choix que le débriefing, qui préfère un blanc à un zéro : mieux vaut ne rien
// dire que dire faux.

import { $, sb, suivi, erreur, typo, nomDe, prenomSeul } from './socle.js';
import { motItems } from './controle.js';

// Chaque heure commence par la même suite, et jusqu'ici elle n'était lisible
// nulle part d'un seul tenant : l'appel dans son onglet, l'humeur sous la
// classe, le contrôle d'entrée derrière deux sélecteurs, le quiz dans les
// tuiles. Quatre écrans pour une question qu'on se pose debout, une fois par
// heure : qui n'a pas démarré ?
//
// Deux lectures, dans cet ordre, parce qu'elles ne servent pas au même
// moment : l'entonnoir dit où ça coince pour le groupe, la liste repliée dit
// chez qui. On ouvre la seconde quand la première a montré qu'il y avait une
// raison de l'ouvrir.
function chargerParcours(apres){
  var bloc = $("bloc-parcours");
  bloc.hidden = true;
  if (!suivi.seanceId) return;
  // L'appel et les questionnaires n'ont pas de parcours : ils SONT des étapes
  // du parcours d'une séance de cours.
  if (suivi.prevol && Number(suivi.prevol.seance) >= 90) return;

  sb.rpc("parcours_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    var d = r && !r.error && r.data;
    // La RPC peut manquer si la migration n'est pas déployée : on masque la
    // carte plutôt que d'afficher une erreur en séance, comme partout ailleurs.
    if (!d || !d.ok) { suivi.parcours = null; if (apres) apres(); return; }
    suivi.parcours = d;
    bloc.hidden = false;
    rendreParcours(d);
    if (apres) apres();
  });
}

// Le nom vient de la base, pas d'une table écrite ici : la quatrième étape
// s'appelle « Le quiz de la séance » au BTS1 et « Le TP » au BTS2, et deux
// noms différents pour la même chose dans deux endroits de l'écran est
// exactement ce qui fait douter de ce qu'on lit. Le repli ne sert qu'au cas
// où la RPC ne serait pas déployée.
function nomEtape(cle, d){
  var e = ((d || suivi.parcours || {}).etapes || []).filter(function(x){
    return x.cle === cle;
  });
  if (e.length && e[0].nom) return e[0].nom;
  return { appel: "Appel", humeur: "Comment ça va",
           controle: "Contrôle d'entrée", quiz: "Le quiz" }[cle] || cle;
}

// L'ordre du parcours, et donc l'ordre de l'urgence : quelqu'un qui n'a pas
// pointé est plus loin en arrière que quelqu'un qui n'a pas fini le quiz.
// C'est cet ordre qui trie la liste et la phrase de synthèse.
var ETAPES_ORDRE = ["appel", "humeur", "controle", "quiz"];

function rangEtape(cle){
  var i = ETAPES_ORDRE.indexOf(cle);
  return i < 0 ? ETAPES_ORDRE.length : i;
}

function rendreParcours(d){
  var z = $("pa-entonnoir");
  z.innerHTML = "";

  (d.etapes || []).forEach(function(e){
    var l = document.createElement("div");
    l.className = "pa-e" + (e.pose ? "" : " pas-pose");

    var n = document.createElement("span");
    n.className = "pa-e-n";
    n.textContent = e.nom;
    l.appendChild(n);

    var j = document.createElement("span");
    j.className = "pa-e-j";
    var f = document.createElement("span");
    f.style.width = (e.pose && e.total ? Math.round(e.fait / e.total * 100) : 0) + "%";
    j.appendChild(f);
    l.appendChild(j);

    var c = document.createElement("span");
    c.className = "pa-e-c";
    // Une étape non posée n'est pas une étape à zéro. « 0 / 13 » se lirait
    // « personne ne l'a fait » au lieu de « il n'existe pas » — même choix
    // que le débriefing, qui préfère un blanc à un zéro.
    c.textContent = e.pose ? (e.fait + " / " + e.total) : "pas posé";
    l.appendChild(c);
    z.appendChild(l);

    // Ceux qui sont dedans sans être au bout : sans cette ligne, « 0 / 31 »
    // sur le quiz laisse croire que personne n'a commencé.
    if (e.pose && e.entames && e.entames > e.fait) {
      var p = document.createElement("p");
      p.className = "pa-e-p";
      var n = e.entames - e.fait;
      // « 4 sans aller au bout (sur 4) » se lisait « 4 sur 4 », c'est-à-dire
      // tout le monde. Le second chiffre n'est pas un effectif, c'est le
      // nombre d'items de l'étape : on le nomme.
      p.textContent = n + (n > 1 ? " sont dedans" : " est dedans") +
        (e.sur > 1 ? " sans avoir fini les " + e.sur + " " + motItems(e) : " sans avoir fini") + ".";
      z.appendChild(p);
    }
  });

  // La phrase qui nomme le geste. Sans elle, l'entonnoir informe sans rien
  // demander — et c'est exactement ce qu'on reprochait à « Réussite par
  // question ».
  var eleves = d.eleves || [];
  var bloques = eleves.filter(function(x){ return x.bloque; });
  var par = {};
  bloques.forEach(function(x){ par[x.bloque] = (par[x.bloque] || 0) + 1; });
  // Dans l'ordre du parcours, pas dans celui où les clés sont tombées : on
  // annonce d'abord ceux qui sont le plus en arrière, parce que ce sont eux
  // qu'on va voir en premier.
  var bouts = ETAPES_ORDRE.filter(function(k){ return par[k]; }).map(function(k){
    return par[k] + " à « " + nomEtape(k, d) + " »";
  });
  $("pa-bloques").textContent = bloques.length
    ? bloques.length + " étudiant" + (bloques.length > 1 ? "s n'ont" : " n'a") +
      " pas fini : " + bouts.join(", ") + "."
    : "Tout le monde est allé au bout de ce qui est posé.";

  var zl = $("pa-lignes");
  zl.innerHTML = "";
  // Les plus en arrière d'abord, pas les bloqués en vrac : celui qui n'a pas
  // pointé passe avant celui qui n'a pas fini le quiz. Trier par numéro
  // mettrait le 02 qui a tout fini au-dessus du 30 qui n'est pas là ; trier
  // par « bloqué ou non » remontait ceux qu'on cherche le moins.
  eleves.slice().sort(function(a, b){
    var ra = a.bloque ? rangEtape(a.bloque) : 99;
    var rb = b.bloque ? rangEtape(b.bloque) : 99;
    if (ra !== rb) return ra - rb;
    return a.numero < b.numero ? -1 : 1;
  }).forEach(function(x){ zl.appendChild(ligneParcours(d, x)); });
}

function ligneParcours(d, x){
  var l = document.createElement("div");
  l.className = "pa-l" + (x.bloque ? "" : " fini");

  var n = document.createElement("span");
  n.className = "pa-num";
  n.textContent = x.numero;
  l.appendChild(n);

  var pts = document.createElement("span");
  pts.className = "pa-pts";
  // Quatre pastilles dans l'ordre des étapes, toujours les quatre : on lit une
  // colonne pour voir qui manque à l'appel, une ligne pour voir où quelqu'un
  // s'est arrêté. En sauter une décalerait les colonnes d'une ligne à l'autre.
  [["appel", x.appel ? 1 : 0, 1],
   ["humeur", x.humeur ? 1 : 0, 1],
   ["controle", x.controle, d.controle_sur],
   ["quiz", x.quiz, d.quiz_sur]].forEach(function(e){
    var p = document.createElement("span");
    var fait = e[1], sur = e[2];
    p.className = "pa-pt " + (!sur ? "absent" : fait >= sur ? "fait" : fait > 0 ? "entame" : "");
    p.textContent = !sur ? "·" : sur === 1 ? (fait ? "✓" : "") : String(fait);
    p.title = nomEtape(e[0], d) + (sur > 1 ? " — " + fait + " sur " + sur
                                        : !sur ? " — pas posé" : fait ? " — fait" : " — pas fait");
    pts.appendChild(p);
  });
  l.appendChild(pts);

  var ou = document.createElement("span");
  ou.className = "pa-ou";
  var nom = nomDe(d.code, x.numero);
  ou.textContent = (nom ? prenomSeul(nom) + " — " : "") +
    (x.bloque ? nomEtape(x.bloque, d) : "au bout");
  l.appendChild(ou);
  return l;
}

// La même donnée que l'écran projeté, en version téléphone : on la lit pour
// savoir quoi dire, puis on projette.
function chargerDebrief(apres){
  var bloc = $("bloc-debrief");
  if (!suivi.seanceId) { bloc.hidden = true; suivi.debrief = null; return; }
  // Ni l'appel ni les questionnaires ne se débriefent : rien à y conclure.
  if (suivi.prevol && Number(suivi.prevol.seance) >= 90) { bloc.hidden = true; return; }

  sb.rpc("debriefing", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) { bloc.hidden = true; return; }
    suivi.debrief = r.data;
    rendreDebriefEns(r.data);
    bloc.hidden = false;
    if (typeof apres === "function") apres();
  });
}

function rendreDebriefEns(d){
  var liste = d.concepts || [];
  var r = $("db-resume");

  if (!liste.length) {
    r.textContent = "Aucun concept écrit pour cette séance. Recopiez ci-dessous la " +
      "section « Concepts à connaître » de la trace écrite : c'est elle qu'on projette " +
      "en fin d'heure.";
    $("db-lignes").innerHTML = "";
    $("db-neuf").open = true;
    $("b-db-ecran").disabled = true;
    return;
  }
  $("db-neuf").open = false;
  $("b-db-ecran").disabled = false;

  var faibles = liste.filter(function(c){ return c.verdict === "a_revoir"; });
  var bouts = [liste.length + (liste.length > 1 ? " concepts" : " concept"),
               d.repondants + " / " + d.inscrits + " ont répondu au quiz"];
  if (d.reussite !== null) bouts.push(d.reussite + " % de réussite");
  r.textContent = bouts.join(" · ") +
    (faibles.length ? " — on reprend par le " +
       faibles.map(function(c){ return c.rang; }).join(" et le ") + "." : "");

  var z = $("db-lignes");
  z.innerHTML = "";
  liste.forEach(function(c){ z.appendChild(ligneConcept(c)); });
}

// Un concept : son rang (c'est par ce numéro qu'on le désignera à l'oral),
// son intitulé, et le chiffre que la classe vient de lui donner.
function ligneConcept(c){
  var MOTS = { acquis: "acquis", fragile: "fragile",
               a_revoir: "à revoir", sans_mesure: "sans mesure" };
  var d = document.createElement("div");
  d.className = "db-l";
  d.innerHTML = '<span class="db-r"></span><span class="db-i"></span>' +
                '<span class="db-v"></span><span class="db-d"></span>';
  d.querySelector(".db-r").textContent = c.rang + ".";
  d.querySelector(".db-i").textContent = typo(c.intitule);

  var v = d.querySelector(".db-v");
  v.classList.add(c.verdict);
  v.textContent = (c.taux === null ? "" : c.taux + " % · ") + MOTS[c.verdict];

  var det = d.querySelector(".db-d");
  det.textContent = typo(c.detail || "");
  if ((c.questions || []).length) {
    var q = document.createElement("span");
    q.className = "db-q";
    q.textContent = "  mesuré sur " +
      (c.questions.length > 1 ? "les questions " : "la question ") +
      c.questions.join(", ");
    det.appendChild(q);
  }
  return d;
}

function enregistrerConcepts(){
  var texte = $("db-texte").value;
  erreur("err-db-neuf", "");
  if (!texte.trim()) { erreur("err-db-neuf", "Collez au moins un concept."); return; }
  var b = $("b-db-creer");
  b.disabled = true;
  sb.rpc("definir_concepts", { p_seance_id: Number(suivi.seanceId),
                               p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      // La base nomme la ligne fautive et le numéro en cause : on la répète
      // telle quelle plutôt que de dire « format invalide », ce qui obligerait
      // à tout relire pour trouver la ligne.
      erreur("err-db-neuf",
        (d && d.texte) ? d.texte
      : (d && d.motif === "numero")
          ? "L'appel et les questionnaires n'ont pas de concepts à débriefer."
      : "Enregistrement refusé. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-db-neuf", d.concepts + (d.concepts > 1 ? " concepts enregistrés."
                                                       : " concept enregistré."), true);
    $("db-texte").value = "";
    chargerDebrief();
  });
}

export { chargerParcours, rendreParcours, chargerDebrief,
         rendreDebriefEns, enregistrerConcepts };
