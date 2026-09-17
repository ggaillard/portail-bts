// ── Le suivi d'une séance : avant, pendant, après ─────────────────────────
//
// Onzième module sorti de app.js. Tout ce qui regarde UNE séance choisie, dans
// l'ordre où l'heure se déroule :
//
//   · LE PRÉ-VOL, avant d'ouvrir. Combien d'étudiants, combien de questions
//     corrigées, la séance est-elle publiée. C'est la seule chose qui évite
//     d'ouvrir une séance dont les corrigés manquent.
//   · LE PARCOURS DE L'HEURE, pendant. Quatre étapes — appel, humeur, contrôle
//     d'entrée, quiz ou TP — et pour chaque étudiant la PREMIÈRE non faite.
//     C'est elle qu'on lit en séance, parce qu'elle nomme le geste. La liste
//     est triée par l'étape où l'on bute, pas par numéro : c'est l'ordre dans
//     lequel on va les voir.
//   · LES CHIFFRES, pendant et après. Progression, réussite par question,
//     élève par élève. `estEvaluee()` y distingue les deux natures de réponse
//     du système : une question de quiz (correct vrai ou faux) et une mission
//     de TP cochée (ok / ko), qui n'entre pas dans le taux de réussite. Ne pas
//     réécrire cette distinction : une mission cochée n'est pas une bonne
//     réponse.
//   · LE DÉBRIEFING, à la fin. Les concepts de l'heure, avec la mesure de ce
//     que la classe vient d'en montrer — et les concepts d'une séance sont
//     exactement ce que testera le contrôle d'entrée de la suivante.
//
// Une étape NON POSÉE n'est pas une étape à zéro : « 0 / 13 » se lirait
// « personne ne l'a fait ». Et une étape non posée ne bloque personne — le
// portail ne doit jamais envoyer voir quelqu'un pour un contrôle qui n'existe
// pas.
//
// Il reçoit `chargerAFaire` par brancherSeance() : démarrer ou clore une
// séance change ce que « Ce qui bloque » a à dire, et cette carte vit dans
// app.js.

import { $, sb, suivi, erreur, typo, montrer, estDemo, classesReelles,
         codeClasseCourante, nomDe, prenomSeul, dateCourte, pastilles,
         anime } from './socle.js';
import { chargerControle, chargerControles } from './controle.js';
import { chargerParcours, chargerDebrief } from './heure.js';
import { rendreProjet } from './ensemble.js';
import { ouvrirOnglet } from './navigation.js';
import { chargerQuestionsSeance } from './bibliotheque.js';
// rafraichir() rafraîchit TOUT ce qui dépend de la séance en cours : l'écran
// projeté s'il est ouvert, la carte d'appel, le semestre. C'est le seul endroit
// du portail qui traverse autant de modules, et c'est normal — « rafraîchir »
// est par nature transversal.
import { rendreEcran } from './ecran.js';
import { chargerAppelToutesClasses } from './appel.js';
import { chargerSemestre } from './ensemble.js';

let chargerAFaire = function(){};
export function brancherSeance(liens){ chargerAFaire = liens.chargerAFaire; }

// Une réponse « évaluée » est celle qui a un corrigé : on ne calcule le taux
// de réussite que sur celles-là. Une mission cochée n'est pas une bonne réponse.
function estEvaluee(r){
  // L'humeur se répond, elle ne se réussit pas : elle n'entre dans aucun taux.
  if (r.question && r.question.indexOf("humeur-") === 0) return false;
  return r.correct === true || r.correct === false || r.reponse === "ok" || r.reponse === "ko";
}

function estJuste(r){
  return r.correct === true || r.reponse === "ok";
}

function chargerStats(){
  if (!suivi.classeId || !suivi.seanceId) return Promise.resolve(null);
  return Promise.all([
    sb.from("eleves").select("id,numero,avatar,auth_id").eq("classe_id", suivi.classeId)
      .neq("numero", "99").order("numero"),
    sb.from("reponses").select("eleve_id,question,correct,reponse,updated_at")
      .eq("seance_id", suivi.seanceId),
    // La colonne « intitule » est facultative : si elle n'existe pas, on relit sans.
    sb.from("corriges").select("question,bonne_reponse,intitule,options,explication").eq("seance_id", suivi.seanceId)
      .then(function(r){
        return r.error
          ? sb.from("corriges").select("question,bonne_reponse").eq("seance_id", suivi.seanceId)
          : r;
      })
  ]).then(function(res){
    var eleves = res[0].data || [];
    // Le contrôle d'entrée vit sur la même séance, sous des clés « pre- ».
    // L'inclure ferait compter deux fois : une progression de 20/10, et un
    // taux de réussite qui mélange ce qu'ils savaient avant et ce qu'ils ont
    // appris pendant. Les fonctions SQL font le même tri de leur côté.
    var horsControle = function(x){ return !/^pre-/.test(x.question || ""); };
    var reps = (res[1].data || []).filter(horsControle);
    var cor  = (res[2].data || []).filter(horsControle);

    var par = {};
    reps.forEach(function(r){
      var e = par[r.eleve_id] ||
              (par[r.eleve_id] = { n: 0, ev: 0, ok: 0, ok_mission: 0, maj: null, serie: 0, liste: [] });
      e.n++;
      // Un jalon franchi, c'est une case cochée sur le tableau de bord
      // PlaylistApp : une clé qui commence par « tp », dont la réponse vaut
      // « true ». Le quiz, lui, s'enregistre en « ok » / « ko » sous une clé
      // « q-… » — il compte dans le taux de réussite, pas dans l'avancement.
      // Ne pas restreindre aux clés « -m » : les 29 items du parcours
      // comprennent aussi tp0-1 à tp0-3, les fiches concept « -c0 » et les
      // mises en route « -s1 » / « -s2 ».
      if (/^tp/.test(r.question || "") && (r.reponse === "true" || r.reponse === "ok")) {
        e.ok_mission = (e.ok_mission || 0) + 1;
      }
      if (estEvaluee(r)) { e.ev++; if (estJuste(r)) e.ok++; }
      if (!e.maj || r.updated_at > e.maj) e.maj = r.updated_at;
      e.liste.push(r);
    });

    // Série en cours : bonnes réponses consécutives en fin de parcours.
    Object.keys(par).forEach(function(k){
      var l = par[k].liste.filter(estEvaluee).sort(function(a, b){
        return a.updated_at < b.updated_at ? -1 : 1;
      });
      var s = 0;
      for (var i = l.length - 1; i >= 0; i--) {
        if (estJuste(l[i])) s++; else break;
      }
      par[k].serie = s;
    });

    // Sur une séance de projet, l'avancement se mesure en MISSIONS VALIDÉES
    // sur le nombre de jalons déclarés — pas en nombre de lignes reçues. Sans
    // cela le BTS2 comptait aussi les questions de jalon et les missions en
    // échec, et le pourcentage n'avait plus de sens.
    var projet = suivi.nature === "projet";
    if (projet) {
      Object.keys(par).forEach(function(k){ par[k].n = par[k].ok_mission || 0; });
    }
    var maxN = 0;
    Object.keys(par).forEach(function(k){ if (par[k].n > maxN) maxN = par[k].n; });
    var total = projet ? Math.max(Number(suivi.jalons) || maxN, 1)
                       : Math.max(cor.length, maxN, 1);

    var lignes = eleves.map(function(el){
      var p = par[el.id] || { n: 0, ev: 0, ok: 0, ok_mission: 0, maj: null, serie: 0 };
      return {
        id: el.id, numero: el.numero, avatar: el.avatar || "•",
        connecte: !!el.auth_id, n: p.n, ev: p.ev, ok: p.ok, maj: p.maj, serie: p.serie,
        pct: Math.round(p.n / total * 100),
        reussite: p.ev ? Math.round(p.ok / p.ev * 100) : null
      };
    });

    // Réussite question par question : dit à l'enseignant quoi reprendre.
    var bonneDe = {}, texteDe = {};
    cor.forEach(function(c){
      bonneDe[c.question] = c.bonne_reponse;
      if (c.intitule) texteDe[c.question] = c.intitule;
    });

    var parQ = {};
    reps.forEach(function(r){
      if (!estEvaluee(r)) return;
      var q = parQ[r.question] ||
              (parQ[r.question] = { nom: r.question, n: 0, ok: 0,
                                    bonne: bonneDe[r.question] || null,
                                    texte: texteDe[r.question] || null, choix: {} });
      q.n++;
      if (estJuste(r)) q.ok++;
      // Répartition des réponses données, pour l'écran « Répartition »
      var v = (r.reponse === null || r.reponse === undefined) ? "—" : String(r.reponse);
      q.choix[v] = (q.choix[v] || 0) + 1;
    });
    var questions = Object.keys(parQ).map(function(k){
      var q = parQ[k];
      q.pct = Math.round(q.ok / q.n * 100);
      return q;
    }).sort(function(a, b){
      return (a.pct - b.pct) || (a.nom < b.nom ? -1 : 1);
    });

    var actifs = lignes.filter(function(l){ return l.n > 0; });
    var totalEv = lignes.reduce(function(s, l){ return s + l.ev; }, 0);
    var totalOk = lignes.reduce(function(s, l){ return s + l.ok; }, 0);

    return {
      lignes: lignes, total: total, questions: questions,
      inscrits: lignes.length,
      actifs: actifs.length,
      reponses: lignes.reduce(function(s, l){ return s + l.n; }, 0),
      reussite: totalEv ? Math.round(totalOk / totalEv * 100) : null,
      avancement: lignes.length ? Math.round(
        lignes.reduce(function(s, l){ return s + l.pct; }, 0) / lignes.length) : 0
    };
  });
}

function tuile(valeur, libelle){
  return '<div class="tuile"><div class="tuile-v">' + valeur +
         '</div><div class="tuile-l">' + libelle + '</div></div>';
}

function rendreSuivi(s){
  suivi.stats = s;
  $("stats-attente").hidden = true;
  $("stats-zone").hidden = false;

  // Une séance vide n'est pas une panne : on dit pourquoi, et quoi faire.
  var guide = $("stats-guide");
  if (s.reponses === 0) {
    guide.hidden = false;
    guide.classList.toggle("ok", !!suivi.ouverte);
    guide.innerHTML = suivi.ouverte
      ? "Aucune réponse pour l'instant, et c'est normal : la séance est " +
        "<b>ouverte</b> mais personne n'a encore commencé. Les compteurs se " +
        "rempliront dès les premières réponses de vos élèves."
      : "Aucune réponse, et cette séance est <b>fermée</b> : personne ne peut " +
        "y répondre. Pour l'ouvrir, exécutez dans l'éditeur SQL de Supabase :<br>" +
        "<code>update public.seances set ouverte = true where id = " +
        suivi.seanceId + ";</code>";
  } else {
    guide.hidden = true;
  }

  $("tuiles").innerHTML =
    // « 12/31 » et non « 12 / 31 » : avec les espaces, la valeur passe sur
    // deux lignes à 360 px et la tuile gagne 30 px pour rien. C'est aussi
    // comme cela qu'on écrit un score.
    tuile(s.actifs + "/" + s.inscrits, "en activité") +
    tuile(s.reponses, "réponses") +
    tuile(s.avancement + " %", "avancement moyen") +
    tuile(s.reussite === null ? "—" : s.reussite + " %", "de réussite");

  rendreRythme(s);

  // ── Réussite par question ──
  var q = $("liste-questions");
  q.innerHTML = "";
  if (!s.questions.length) {
    q.innerHTML = '<p class="sous-hint">Aucune question corrigée pour l\'instant. ' +
                  'Ce panneau se remplit dès les premières réponses évaluées.</p>';
  }
  s.questions.forEach(function(qu){
    var t = qu.pct >= 70 ? " bien" : (qu.pct < 40 ? " faible" : "");
    var d = document.createElement("div");
    d.className = "q";
    d.innerHTML =
      '<span class="q-nom"></span>' +
      '<span class="q-barre"><span class="q-fill' + t + '" style="width:' + qu.pct + '%"></span></span>' +
      '<span class="q-pct"></span>';
    d.querySelector(".q-nom").textContent = qu.nom;
    d.querySelector(".q-pct").textContent = qu.ok + "/" + qu.n + " · " + qu.pct + " %";
    q.appendChild(d);
  });

  // ── Élève par élève ──
  var tri = $("pk-tri").value;
  var lignes = s.lignes.slice().sort(function(a, b){
    if (tri === "avancement") return (a.pct - b.pct) || (a.numero < b.numero ? -1 : 1);
    if (tri === "reussite") {
      var ra = a.reussite === null ? 999 : a.reussite;
      var rb = b.reussite === null ? 999 : b.reussite;
      return (ra - rb) || (a.numero < b.numero ? -1 : 1);
    }
    return a.numero < b.numero ? -1 : 1;
  });

  var c = $("liste-eleves");
  c.innerHTML = "";
  lignes.forEach(function(l){
    var d = document.createElement("div");
    d.className = "el" + (l.n === 0 ? " absent" : "");
    var teinte = l.reussite === null ? "" :
                 (l.reussite >= 70 ? " bien" : (l.reussite < 40 ? " faible" : ""));
    var etat = l.n === 0 ? ["chip-rien", "pas commencé"]
             : (l.n >= s.total ? ["chip-fini", "terminé"] : ["chip-cours", "en cours"]);
    d.innerHTML =
      '<span class="el-av"></span>' +
      '<span class="el-num"></span>' +
      '<span class="el-barre"><span class="el-fill' + teinte + '" style="width:' + l.pct + '%"></span></span>' +
      '<span class="el-chiffres"></span>' +
      '<span class="chip ' + etat[0] + '"></span>' +
      '<span class="el-maj"></span>';
    d.querySelector(".el-av").textContent = l.avatar;
    d.querySelector(".el-num").textContent = l.numero;
    d.querySelector(".el-chiffres").textContent =
      l.n + "/" + s.total + (l.reussite === null ? "" : " · " + l.reussite + " %");
    d.querySelector(".chip").textContent = etat[1];
    d.querySelector(".el-maj").textContent = l.maj
      ? new Date(l.maj).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "";
    c.appendChild(d);
  });

  if (suivi.ecran) rendreEcran(s);
}

function rafraichir(){
  return chargerStats().then(function(s){ if (s) rendreSuivi(s); });
}

function lancerBoucle(){
  arreterBoucle();
  suivi.minuteur = setInterval(rafraichir, 8000);
}

function arreterBoucle(){
  if (suivi.minuteur) { clearInterval(suivi.minuteur); suivi.minuteur = null; }
}

// Après un geste, la carte concernée doit se remettre à jour elle aussi —
// sinon on referme « Ce qui bloque » sur une carte de séance qui montre encore
// l'état d'avant, et on doute de ce qu'on vient de faire.
function rafraichirApresActe(t){
  if (String(t.seance_id) === String(suivi.seanceId)) chargerPrevol();
  if (t.action === "ouvrir_controle") chargerControles();
  chargerAppelToutesClasses(suivi.classesConnues || []);
}

// Sur un projet, personne n'est « en retard sur l'horloge » : chacun avance à
// sa vitesse. Ce qui alerte, c'est l'ARRÊT et l'écart à l'échéance.
function chargerProjet(){
  return sb.rpc("suivi_projet", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    suivi.projet = (r && !r.error && r.data && r.data.ok) ? r.data : null;
    if (suivi.stats) rendreRythme(suivi.stats);
  });
}

function chargerPrevol(){
  var bloc = $("prevol");
  if (!suivi.seanceId) { bloc.hidden = true; suivi.prevol = null; return Promise.resolve(); }
  return sb.rpc("preflight_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    if (!r || r.error || !r.data || !r.data.ok) { bloc.hidden = true; suivi.prevol = null; return; }
    suivi.prevol = r.data;
    rendrePrevol(r.data);
    suivi.projet = null;
    if (r.data.nature === "projet") chargerProjet();
    chargerControle();
    suivi.debrief = null;
    chargerDebrief();
    suivi.parcours = null;
    chargerParcours();
  });
}


function rendrePrevol(p){
  var bloc = $("prevol");
  bloc.hidden = false;

  var projet = p.nature === "projet";
  var lignes = [];

  if (projet) {
    // Sur un projet, ce ne sont pas dix questions qu'on attend, mais des
    // jalons déclarés et une échéance : sans eux, aucun avancement n'est lisible.
    lignes.push(p.jalons
      ? [true,  p.jalons + " jalons déclarés", ""]
      : [false, "Aucun jalon déclaré", "l'avancement se calculera sur l'étudiant le plus avancé, faute de repère"]);
    lignes.push(p.echeance
      ? [true,  "Échéance au " + dateCourte(p.echeance), ""]
      : [false, "Pas d'échéance", "impossible de dire qui n'ira pas au bout au rythme actuel"]);
  } else {
    // Le corrigé : sans lui, rien n'est évalué et la Répartition reste vide.
    lignes.push(p.questions > 0
      ? [true,  p.questions + " questions corrigées", ""]
      : [false, "Aucun corrigé pour cette séance", "les réponses seront enregistrées mais jamais évaluées"]);
  }
  // L'appel : sans lui, pas de trace de présence pour la journée.
  lignes.push(p.appel_du_jour
    ? [true,  "Question d'appel posée pour aujourd'hui", ""]
    : [null,  "Question d'appel pas encore créée", "elle se crée d'elle-même à la première connexion d'un étudiant, rien à faire"]);
  // L'état : une séance fermée refuse tout, en silence.
  if (projet) {
    lignes.push(p.ouverte
      ? [true,  "Séance ouverte en permanence", ""]
      : [false, "Séance fermée", "les étudiants ne peuvent plus rien valider sur ce projet"]);
  } else {
    lignes.push(p.ouverte
      ? [true,  "Séance ouverte" + (p.demarree_le ? ", démarrée à " + heureCourte(p.demarree_le) : ", pas encore démarrée"), ""]
      : [false, "Séance fermée", "personne ne peut répondre tant qu'elle n'est pas démarrée"]);
  }
  // Les accès : un étudiant sans PIN ne peut pas entrer.
  var accesOk = p.eleves > 0 && p.avec_pin === p.eleves;
  lignes.push(accesOk
    ? [true,  p.eleves + " étudiants, tous avec un code PIN (" + p.deja_connectes + " déjà connectés)", ""]
    : [false, p.avec_pin + " codes PIN pour " + p.eleves + " étudiants", "les étudiants sans PIN ne pourront pas s'identifier"]);

  var ul = $("prevol-liste");
  ul.innerHTML = "";
  lignes.forEach(function(l){
    var li = document.createElement("li");
    li.innerHTML = '<span class="pv-i"></span><span><b></b><span class="pv-ko"></span></span>';
    li.querySelector(".pv-i").textContent = l[0] === true ? "✅" : (l[0] === null ? "ℹ️" : "⚠️");
    li.querySelector("b").textContent = l[1];
    li.querySelector(".pv-ko").textContent = l[2] ? " — " + l[2] : "";
    ul.appendChild(li);
  });

  // Seul un vrai blocage compte : une ligne d'information (null) n'est pas
  // un point à régler, sinon le pré-vol crie au loup tous les matins.
  var manque = lignes.filter(function(l){ return l[0] === false; }).length;
  var etat = $("prevol-etat");
  etat.textContent = manque ? (manque + (manque > 1 ? " points à régler" : " point à régler")) : "Tout est prêt";
  etat.className = "prevol-etat " + (manque ? "ko" : "ok");

  // Un projet reste ouvert : ni chrono à lancer, ni séance à clore chaque semaine.
  // La séance 99 est le registre d'appel : la clore couperait le pointage et
  // l'humeur pour la classe entière. Le bouton disparaît, la base refuse aussi.
  var appel = String(p.seance) === "99";
  $("b-demarrer").hidden = projet;
  $("b-clore").hidden = projet || appel;
  $("b-demarrer").textContent = p.demarree_le && p.ouverte ? "Redémarrer le chrono" : "Démarrer la séance";
  $("b-clore").disabled = !p.ouverte;
}

function heureCourte(iso){
  var d = new Date(iso);
  return isNaN(d) ? "?" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function pilotage(action, question){
  if (!suivi.seanceId) return;
  erreur("err-prevol", "");
  $("b-demarrer").disabled = true; $("b-clore").disabled = true;
  sb.rpc(action, { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    $("b-demarrer").disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      // « appel » n'est pas un refus de droits : c'est un refus de principe.
      erreur("err-prevol", (r && r.data && r.data.motif === "appel")
        ? "La séance d'appel reste ouverte toute l'année : la clore couperait le pointage de la classe."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      $("b-clore").disabled = false;
      return;
    }
    erreur("err-prevol", question, true);
    // On relit l'état plutôt que de le supposer : la source de vérité est la base.
    chargerPrevol().then(rafraichir);
    // Ouvrir ou clore une séance change ce qui reste à faire : la carte suit.
    chargerAFaire();
    chargerSemestre();
  });
}

// Cadence déduite : durée de la séance divisée par le nombre de questions.
// On ne compte que les étudiants actifs DEPUIS le démarrage : ceux qui ont une
// ou deux séances d'avance travaillent ailleurs, ils ne sont ni en retard ni
// à rattraper, et ils n'ont pas à tirer la moyenne.
function rendreRythme(s){
  var zone = $("rythme"), p = suivi.prevol;
  if (!p) { zone.hidden = true; return; }
  zone.hidden = false;

  // Deux natures, deux lectures. Le reste de cette fonction ne vaut que
  // pour une séance de cours, où la classe avance ensemble.
  if (p.nature === "projet") return rendreProjet(zone, p);

  if (!p.demarree_le || !p.ouverte) {
    zone.className = "rythme mort";
    zone.innerHTML = "Séance non démarrée : pas de repère de temps. " +
                     "Le chrono part au clic sur <b>Démarrer la séance</b>.";
    return zone.appendChild(noteAvance(p));
  }
  if (!p.questions) {
    zone.className = "rythme mort";
    zone.innerHTML = "Pas de corrigé : impossible de calculer une cadence.";
    return zone.appendChild(noteAvance(p));
  }

  var debut = new Date(p.demarree_le).getTime();
  var minutes = Math.max(0, (Date.now() - debut) / 60000);
  var cadence = p.duree_min / p.questions;
  // floor et non ceil : à la 22e minute avec une cadence de 5,5 min, quatre
  // questions devraient être finies — pas cinq, dont l'intervalle vient de commencer.
  var attendu = Math.min(p.questions, Math.floor(minutes / cadence));

  // Les actifs du jour : ceux dont la dernière réponse est postérieure au top départ.
  var actifs = (s.lignes || []).filter(function(l){
    return l.maj && new Date(l.maj).getTime() >= debut;
  });
  var moyenne = actifs.length
    ? actifs.reduce(function(a, l){ return a + l.n; }, 0) / actifs.length : 0;
  var ecart = moyenne - attendu;

  var etat = ecart >= 0.5 ? "avance" : (ecart >= -0.5 ? "ok" : "retard");
  var mot  = etat === "avance" ? "en avance"
           : (etat === "ok" ? "dans le rythme"
           : (ecart >= -1.5 ? "léger retard" : "en retard"));

  zone.className = "rythme " + etat;
  zone.innerHTML =
    "<b>" + Math.round(minutes) + " min</b> sur " + p.duree_min + " · " +
    "attendu <b>question " + attendu + "</b> sur " + p.questions + " · " +
    "classe à <b>" + moyenne.toFixed(1).replace(".", ",") + "</b> (" + actifs.length + " actifs) · " +
    "<b>" + mot + "</b>";
  zone.appendChild(noteAvance(p));
}

// Les étudiants qui travaillent au-delà de cette séance, comptés à part.
function noteAvance(p){
  var d = document.createElement("div");
  if (!p || !p.en_avance) { d.hidden = true; return d; }
  d.style.marginTop = ".35rem";
  d.style.opacity = ".85";
  d.textContent = p.en_avance + (p.en_avance > 1 ? " étudiants travaillent " : " étudiant travaille ") +
    "au-delà de cette séance (séance " + p.seances_en_avance + ") — hors du calcul du rythme.";
  return d;
}

function activerSeance(){
  var sel = $("pk-seance");
  var opt = sel.options[sel.selectedIndex];
  if (!sel.value) {
    suivi.seanceId = null;
    suivi.stats = null;
    suivi.prevol = null;
    arreterBoucle();
    $("prevol").hidden = true;
    $("bloc-corriges").hidden = true;
    $("stats-zone").hidden = true;
    $("stats-attente").hidden = false;
    return;
  }
  suivi.seanceId = sel.value;
  suivi.titre = opt.dataset.titre || opt.textContent;
  suivi.ouverte = !!opt.dataset.ouverte;
  suivi.nature  = opt.dataset.nature || "cours";
  suivi.jalons  = opt.dataset.jalons || null;
  $("stats-attente").textContent = "Chargement…";
  chargerPrevol();
  chargerQuestionsSeance();
  rafraichir().then(lancerBoucle);
}

function chargerSeancesDe(classeId){
  suivi.classeId = classeId;
  suivi.seanceId = null;
  suivi.stats = null;
  arreterBoucle();
  $("stats-zone").hidden = true;
  $("stats-attente").hidden = false;
  $("stats-attente").textContent = "Sélectionnez une séance pour voir le détail élève par élève.";

  return sb.from("seances").select("id,numero,titre,ouverte,notee,nature,jalons")
    .eq("classe_id", classeId).order("numero").then(function(r){
      var sel = $("pk-seance");
      sel.innerHTML = '<option value="">Choisir une séance…</option>';
      (r.data || []).forEach(function(s){
        var o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.numero + " — " + s.titre +
          (s.ouverte ? " · ouverte" : " · fermée") + (s.notee ? " · notée" : "");
        o.dataset.titre = s.numero + " — " + s.titre;
        o.dataset.ouverte = s.ouverte ? "1" : "";
        o.dataset.nature  = s.nature || "cours";
        if (s.jalons) o.dataset.jalons = s.jalons;
        sel.appendChild(o);
      });
      // Une séance est chargée d'office : le panneau n'est jamais vide à l'arrivée.
      if (sel.options.length > 1) {
        sel.selectedIndex = 1;
        activerSeance();
      }
    });
}

// « Voir le détail » : l'onglet du suivi, la bonne classe, la bonne séance.
// Sans cela, on lit « séance 2 du BTS2 » et on doit refaire soi-même deux
// sélections — c'est la moitié du problème qu'on vient de régler.
function allerAuControle(c){
  ouvrirOnglet("seance");
  var sc = $("pk-classe");
  if (String(sc.value) !== String(c.classe_id)) {
    sc.value = String(c.classe_id);
  }
  chargerSeancesDe(sc.value).then(function(){
    var ss = $("pk-seance");
    for (var i = 0; i < ss.options.length; i++) {
      if (String(ss.options[i].value) === String(c.seance_id)) {
        ss.selectedIndex = i;
        activerSeance();
        break;
      }
    }
    var b = $("bloc-controle");
    if (b) b.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export { chargerSeancesDe, activerSeance, rafraichir, arreterBoucle,
         rafraichirApresActe, chargerPrevol, chargerStats, rendreSuivi,
         allerAuControle, noteAvance, rendreRythme, pilotage };
