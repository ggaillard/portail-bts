// ── Le portail — tout le script, en un module ─────────────────────────────
//
// Sorti de index.html le 16/09/2026 (étape A3 de REFONTE.md). Le contenu n'a
// pas changé d'une ligne : c'est le point de l'étape. Ce qui change est la
// façon dont le navigateur le charge, et cette étape-là se publie et se
// vérifie en production AVANT qu'une seule fonction ne soit déplacée.
//
// Trois choses à savoir, toutes vérifiées avant d'écrire ce fichier :
//
//   · un module est différé : il s'exécute après l'analyse du document, donc
//     après config.js et après le client Supabase, qui sont des scripts
//     classiques. `window.TDC_CONFIG` et `window.supabase` sont là quand ces
//     lignes s'exécutent, exactement comme avant ;
//
//   · un module a sa propre portée : plus rien ne fuit vers `window`. La
//     fermeture (function(){ … })() ci-dessous fait donc double emploi, et
//     elle reste quand même — elle est l'ancre que outils/portail.mjs utilise
//     pour exposer les fonctions internes aux contrôles, et la retirer
//     rendrait les trois contrôles muets sans les faire échouer ;
//
//   · un module ne se charge PAS depuis file://. Ouvrir index.html par
//     double-clic ne marche plus : « Access to script … has been blocked by
//     CORS policy ». En local, `node outils/serveur.mjs` puis
//     http://127.0.0.1:8080, ou l'extension Live Server de VS Code. C'est le
//     seul coût de ce découpage, et il était mesuré avant d'être accepté.
//
// La suite du chantier sortira d'ici un module par sujet. Tant que ce fichier
// est seul, il dépasse le plafond de 400 lignes du §6.1 de REFONTE.md, et
// outils/mesurer.mjs le dit : c'est voulu, c'est la marche du milieu.

import { CFG, $, sb, probleme, suivi, erreur, montrer, typo, anime, entree,
         pousse, son, SONS, NOMS_CLE, estDemo, classesReelles,
         etapes, majFile, marquerEtape, motifEnvoi, texteEnvoi,
         signalerSessionPerimee, pastilles, pastilleAppel, copierTexte,
         dateCourte, lireNoms, enregistrerNoms, nomDe, prenomSeul } from './socle.js';
import { brancherEcran, modeEcran, rendreEcran, rotationAuto,
         fermerEcran, minuteur } from './ecran.js';
import { ONGLETS, ouvrirOnglet, ongletDeLAdresse } from './navigation.js';
import { brancherBibliotheque, BIB, chargerQuestionnaires,
         chargerQuestionsSeance, rendreBibliotheque } from './bibliotheque.js';
import { chargerQuestionnairesEtu, rendreQuestionnairesEtu,
         rendreRevision } from './quiz.js';
import { carte, afficherProjets, rendreProjet, rendreProjetsParClasse,
         chargerSemestre, rendreSemestre } from './ensemble.js';
import { chargerAppelToutesClasses, proposerAppel, proposerHumeur,
         ligneAbsents, numerosAbsents, copierAbsents } from './appel.js';
import { chargerConnaissance, chargerStage,
         remplirConnaissanceClasse } from './enquetes.js';

(function(){
"use strict";

// Le socle a déjà lu la configuration et ouvert le client. S'il n'a pas pu,
// il le dit, et le portail s'arrête là plutôt que d'afficher une coquille.
if (probleme) {
  $("chargement").textContent = probleme;
  return;
}


// ── Rendu des cartes projet ────────────────────────────────────────────────


// ── Appel — la question du jour ────────────────────────────────────────────
// L'appel n'est pas un mécanisme à part : c'est la séance numéro 0 de la
// classe, avec une question par date. Y répondre, c'est être présent, et la
// réponse suit le même chemin que toutes les autres — donc le tableau de bord
// enseignant la voit sans rien connaître de l'appel.
// ── Typographie française ─────────────────────────────────────────────────


// ── La file d'attente de l'étudiant ───────────────────────────────────────


// ── Répondre à l'appel et à l'humeur ─────────────────────────────────────


// ── Le contrôle d'acquis, avant la séance ─────────────────────────────────
// Deux questions par notion, dans cet ordre : ce qu'ils savent, puis ce qu'ils
// croient savoir. La seconde n'a de valeur que posée APRÈS la première — la
// poser avant reviendrait à demander une note de confiance dans le vide.
//
// Il passe en tête de la file parce qu'il se fait avant la séance : le mettre
// sous les questionnaires reviendrait à le proposer une fois qu'il est trop
// tard.
function chargerControlesEtu(){
  $("controles-etu").innerHTML = "";
  sb.rpc("mes_controles").then(function(r){
    // Fonction pas déployée : rien ne s'affiche, comme avant qu'elle existe.
    if (!r || r.error || !r.data || !r.data.ok) { majFile(); return; }
    rendreControlesEtu(r.data.liste || []);
  });
}

function rendreControlesEtu(liste){
  var z = $("controles-etu");
  z.innerHTML = "";
  (liste || []).forEach(function(d){
    if (!d.questions || !d.questions.length) return;
    z.appendChild(carteControle(d));
    rendreControle(d);
  });
  majFile();
}

function carteControle(d){
  var c = document.createElement("div");
  c.className = "card etape ct-carte";
  c.id = "ct-" + d.seance_id;
  c.setAttribute("data-etape", "Avant la séance " + d.numero);
  c.innerHTML = '<h2></h2><p class="hint"></p><div id="err-ct-' + d.seance_id + '"></div>' +
                '<p class="cn-int"></p><div class="appel-choix"></div>';
  c.querySelector("h2").textContent = "Avant de commencer — séance " + d.numero;
  var h = c.querySelector(".hint");
  h.textContent = "Quelques notions déjà vues, à retrouver avant la séance. " +
    "Répondez, puis dites si vous vous sentiez sûr : c'est l'écart entre les " +
    "deux qui m'indique par où reprendre. ";
  var av = document.createElement("b");
  av.className = "ct-av";
  h.appendChild(av);
  return c;
}

function zoneCt(d, sel){ return $("ct-" + d.seance_id).querySelector(sel); }

function rendreControle(d){
  var errId = "err-ct-" + d.seance_id;
  var reste = d.questions.filter(function(q){ return !q.ma_reponse; });
  marquerEtape("ct-" + d.seance_id, !reste.length);

  if (!reste.length) {
    zoneCt(d, ".ct-av").textContent = "";
    zoneCt(d, ".cn-int").textContent = "";
    zoneCt(d, ".appel-choix").innerHTML = "";
    erreur(errId, "C'est fait, merci. Rien de tout cela ne compte dans vos " +
                  "résultats : c'est un point de départ, pas une note.", true);
    return;
  }
  erreur(errId, "");

  // Les questions arrivent dans l'ordre des clés : pre-01, pre-01-c, pre-02…
  // La certitude suit donc toujours sa notion, sans qu'on ait à les apparier.
  var q = reste[0];
  var faites = d.questions.length - reste.length;
  var notions = Math.round(d.questions.length / 2);
  var rang = Math.floor(faites / 2) + 1;
  var certitude = /-c$/.test(q.question || "");
  zoneCt(d, ".ct-av").textContent = "Notion " + Math.min(rang, notions) + " sur " + notions +
                                    (certitude ? " — votre ressenti." : ".");
  zoneCt(d, ".cn-int").textContent = typo(q.intitule || q.question);

  var choix = zoneCt(d, ".appel-choix");
  choix.innerHTML = "";
  ["A","B","C","D"].forEach(function(lettre, i){
    if (!q.options || !q.options[i]) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec appel-opt" + (certitude ? " ct-sur" : "");
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
        // Aucune correction affichée, volontairement : dire « faux » avant la
        // séance transforme un point de départ en sanction, et fausse la
        // question de certitude qui suit.
        q.ma_reponse = lettre;
        rendreControle(d);
      });
    });
    choix.appendChild(b);
  });
}

// ── Les questionnaires de l'étudiant ──────────────────────────────────────


// ── Mode séquentiel — une question à la fois ─────────────────────────────


// ── Mode révisable — tout à l'écran, modifiable ──────────────────────────


// ── Mode révision — une question à la fois, et la correction après ───────


// ── Choix de l'avatar ──────────────────────────────────────────────────────
var AVATARS = ["🦊","🐢","🦉","🐙","🦁","🐺","🦄","🐝","🐬","🦋",
               "🐧","🦔","🐳","🦅","🐨","🦝","🐸","🦖","🦩","🐍",
               "🦎","🐊","🦦","🐼","🦒","🐯","🦓","🐘","🦥","🐐",
               "🦡","🐇","🦭","🦈","🐴","🦌","🐡","🐖","🦃","🦚"];

function proposerAvatar(moi){
  $("bloc-avatar").hidden = false;
  var grille = $("grille-avatars");

  sb.rpc("avatars_pris", { p_classe_code: moi.classe_code }).then(function(r){
    var pris = {};
    (r.data || []).forEach(function(x){ pris[x.avatar || x] = true; });
    grille.innerHTML = "";

    AVATARS.forEach(function(a){
      var b = document.createElement("button");
      b.className = "av";
      b.type = "button";
      b.textContent = a;
      b.setAttribute("aria-label", "Choisir l'avatar " + a);
      if (pris[a]) { b.disabled = true; }
      else {
        b.addEventListener("click", function(){
          erreur("err-avatar", "");
          sb.rpc("choisir_avatar", { p_avatar: a }).then(function(rc){
            if (rc.error) { erreur("err-avatar", rc.error.message); return; }
            $("bloc-avatar").hidden = true;
            $("mon-avatar").textContent = a;
          });
        });
      }
      grille.appendChild(b);
    });
  });
}

// ── Espace étudiant ────────────────────────────────────────────────────────
function ouvrirEspaceEtudiant(moi){
  $("mon-numero").textContent   = moi.numero;
  $("mon-numero-2").textContent = moi.numero;
  $("ma-classe").textContent    = moi.classe_nom || moi.classe_code;
  $("mon-avatar").textContent   = moi.avatar || "";
  montrer("espace-etu");

  if (!moi.avatar) proposerAvatar(moi);
  proposerAppel();
  chargerControlesEtu();
  chargerQuestionnairesEtu();

  sb.from("projets").select("titre,description,url,icone,ordre")
    .eq("classe_id", moi.classe_id).order("ordre")
    .then(function(r){ afficherProjets("mes-projets", r.data); });
}

/* ══════════════════════════════════════════════════════════════════════════
   SUIVI D'UNE SÉANCE — vue téléphone et projection au tableau
   ══════════════════════════════════════════════════════════════════════════ */


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
    tuile(s.actifs + " / " + s.inscrits, "en activité") +
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

// ── Projection au tableau ──────────────────────────────────────────────────


// ── Son : quelques notes de synthèse, aucun fichier. Coupé par défaut. ──


// ── Minuteur de séance : le bouton fait défiler arrêt, 5, 10, 15 minutes ──


// ── Vue « Débriefing » : les concepts de l'heure, et ce qu'ils ont donné ────


// ── Vue « Répartition » : ce que la classe a répondu, question par question ──


// ── Pied d'écran : fil d'activité et horodatage ──


function ouvrirEcran(){
  if (!suivi.stats) return;
  suivi.ecran = true;
  // Repartir à blanc : sinon tout le monde clignote au premier affichage.
  suivi.precedent = null;
  suivi.series = null;          // pas d'annonce de série au premier affichage
  suivi.fil = "";
  suivi.transition = true;
  $("classe-ecran").hidden = false;
  rendreEcran(suivi.stats);
}


// ── Les noms, dans CE navigateur et nulle part ailleurs ───────────────────
// La base ne contient que des numéros, et c'est une règle qu'on ne casse pas.
// Mais devant la classe il faut des noms. On les garde donc côté enseignant,
// dans le stockage local du navigateur : rien ne part vers Supabase.


// ── L'appel du jour — présents et absents, à part du reste ────────────────


// ── Le questionnaire de rentrée, côté enseignant ───────────────────────────


// ── « Le semestre » — la question à laquelle aucune carte ne répondait ─────


// ── « À faire » — la seule liste qui ne peut pas mentir ────────────────────
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

// Après un geste, la carte concernée doit se remettre à jour elle aussi —
// sinon on referme « Ce qui bloque » sur une carte de séance qui montre encore
// l'état d'avant, et on doute de ce qu'on vient de faire.
function rafraichirApresActe(t){
  if (String(t.seance_id) === String(suivi.seanceId)) chargerPrevol();
  if (t.action === "ouvrir_controle") chargerControles();
  chargerAppelToutesClasses(suivi.classesConnues || []);
}

// ── La recherche de stage, côté enseignant ─────────────────────────────────


// ── Séance de projet — une autre lecture ──────────────────────────────────
// Sur un projet, personne n'est « en retard sur l'horloge » : chacun avance à
// sa vitesse. Ce qui alerte, c'est l'ARRÊT et l'écart à l'échéance.
function chargerProjet(){
  return sb.rpc("suivi_projet", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    suivi.projet = (r && !r.error && r.data && r.data.ok) ? r.data : null;
    if (suivi.stats) rendreRythme(suivi.stats);
  });
}


// ── Avant de commencer — le contrôle d'avant-séance ────────────────────────


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

// ── Le parcours de l'heure ────────────────────────────────────────────────
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

// Le second chiffre d'une étape n'est pas un nombre d'étudiants : ce sont ses
// items. Les nommer évite de lire « 4 sur 4 » comme « tout le monde ».
function motItems(e){
  if (e.cle === "controle") return "notions";
  return e.jalons ? "étapes" : "questions";
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


// Le code de la classe sélectionnée : c'est lui qui sert de clé aux prénoms
// rangés dans ce navigateur.
function codeClasseCourante(){
  var l = (suivi.classesConnues || []).filter(function(c){
    return String(c.id) === String(suivi.classeId);
  });
  return l.length ? l[0].code : "";
}

// ── Le contrôle d'entrée, côté enseignant ─────────────────────────────────
// Il répond à une question que le pré-vol ne pose pas : « qu'est-ce qu'ils
// ont gardé de la dernière fois ? ». On le lit avant de commencer, pas après.
function chargerControle(){
  var bloc = $("bloc-controle");
  bloc.hidden = true;
  if (!suivi.seanceId) return;
  // Les questionnaires et l'appel n'ont pas de notions à réviser avant.
  if (suivi.prevol && Number(suivi.prevol.seance) >= 90) return;

  sb.rpc("controle_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    // Fonction pas déployée : le bloc reste absent, comme les autres cartes.
    if (!r || r.error || !r.data || !r.data.ok) return;
    suivi.controle = r.data;
    rendreControleEns(r.data);
    bloc.hidden = false;
  });
}

function rendreControleEns(d){
  var b = $("b-controle");
  b.classList.toggle("on", !!d.ouvert);
  b.querySelector(".et").textContent = d.ouvert ? "Proposé" : "Éteint";
  b.setAttribute("aria-pressed", d.ouvert ? "true" : "false");
  b.disabled = !d.notions;
  b.title = d.notions ? "" : "Écrivez d'abord les notions à contrôler.";

  var r = $("ct-resume");
  if (!d.notions) {
    r.textContent = "Aucune notion pour cette séance. Écrivez-les ci-dessous : " +
      "les étudiants y répondront avant de venir.";
    $("ct-lignes").innerHTML = "";
    $("ct-neuf").open = true;
    return;
  }
  var bouts = [d.notions + (d.notions > 1 ? " notions" : " notion"),
               d.termines + " / " + d.inscrits + " ont répondu"];
  r.textContent = bouts.join(" · ");
  $("ct-neuf").open = false;

  var z = $("ct-lignes");
  z.innerHTML = "";
  (d.lignes || []).forEach(function(l){ z.appendChild(ligneControle(l)); });

  // Ceux qui ne l'ont pas fait : les numéros, comme pour l'appel. Rien ne les
  // bloque, mais on ne peut pas s'appuyer sur un contrôle que le tiers de la
  // classe n'a pas rempli.
  var manquants = (d.a_relancer || []).map(function(n){ return { numero: n }; });
  if (manquants.length) {
    z.appendChild(ligneAbsents({ code: codeClasseCourante() },
      manquants, "Pas encore fait", "Tout le monde l'a fait."));
  }
}

// ── Le débriefing, côté enseignant ────────────────────────────────────────
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

// Une notion : ce qu'ils ont répondu, et ce qu'ils disaient savoir. Les moins
// réussies d'abord — la fonction les rend déjà dans cet ordre.
function ligneControle(l){
  var d = document.createElement("div");
  d.className = "ct-l";
  var i = document.createElement("div");
  i.className = "ct-i";
  i.textContent = typo(l.intitule || l.cle);
  d.appendChild(i);

  var rep = Number(l.repondants) || 0, justes = Number(l.justes) || 0;
  var pct = rep ? Math.round(justes * 100 / rep) : null;

  var b = document.createElement("div");
  b.className = "ct-b";
  var j = document.createElement("span");
  j.className = "ct-jauge";
  if (rep) {
    var ok = document.createElement("i");
    ok.className = "ok";
    ok.style.width = (justes * 100 / rep) + "%";
    j.appendChild(ok);
    var ko = document.createElement("i");
    ko.className = "ko";
    ko.style.width = ((rep - justes) * 100 / rep) + "%";
    j.appendChild(ko);
  }
  b.appendChild(j);
  var c = document.createElement("span");
  c.className = "ct-c";
  c.textContent = rep ? (justes + "/" + rep + " · " + pct + " %") : "aucune réponse";
  b.appendChild(c);
  d.appendChild(b);

  // L'écart entre savoir et croire savoir. C'est lui qui dit par quoi
  // commencer : se tromper en étant sûr n'appelle pas le même geste que
  // douter en ayant juste.
  var sf = Number(l.surs_et_faux) || 0, jd = Number(l.justes_mais_doutent) || 0;
  if (sf || jd) {
    var a = document.createElement("span");
    a.className = "ct-alerte";
    var bouts = [];
    if (sf) {
      var qui = (l.numeros_surs_et_faux || []).join(" ");
      bouts.push("⚠️ " + sf + (sf > 1 ? " se trompent" : " se trompe") +
                 " en étant sûr" + (sf > 1 ? "s" : "") + (qui ? " — " + qui : ""));
    }
    if (jd) bouts.push(jd + (jd > 1 ? " ont juste mais doutent" : " a juste mais doute"));
    a.textContent = bouts.join(" · ");
    d.appendChild(a);
  }
  return d;
}

$("b-controle").addEventListener("click", function(){
  var b = $("b-controle");
  var vise = !b.classList.contains("on");
  b.disabled = true;
  erreur("err-controle", "");
  sb.rpc("ouvrir_controle", { p_seance_id: Number(suivi.seanceId),
                              p_ouvert: vise }).then(function(r){
    b.disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      erreur("err-controle", (r && r.data && r.data.motif === "vide")
        ? "Écrivez d'abord les notions à contrôler."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-controle", vise
      ? "Le contrôle est proposé aux étudiants. Il apparaît en tête de leur écran."
      : "Le contrôle n'est plus proposé. Les réponses déjà données sont conservées.", true);
    chargerControle();
    chargerControles();
  });
});

$("b-db-creer").addEventListener("click", enregistrerConcepts);
$("b-pa-ecran").addEventListener("click", function(){
  ouvrirEcran();
  modeEcran("par");
});

$("b-db-ecran").addEventListener("click", function(){
  // Projeter depuis la carte : on ouvre l'écran ET on l'amène directement
  // sur le débriefing, sans passer par la vue de progression.
  ouvrirEcran();
  modeEcran("deb");
});

$("b-ct-creer").addEventListener("click", function(){
  var texte = $("ct-texte").value;
  erreur("err-ct-neuf", "");
  if (!texte.trim()) { erreur("err-ct-neuf", "Collez au moins une notion."); return; }
  var b = $("b-ct-creer");
  b.disabled = true;
  sb.rpc("creer_controle", { p_seance_id: Number(suivi.seanceId),
                             p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      // Comme pour les questionnaires : une ligne mal formée fait échouer tout,
      // et la base dit laquelle. Un contrôle dont une notion n'a pas de bonne
      // réponse compterait tout le monde faux sans que personne ne le voie.
      erreur("err-ct-neuf",
        (d && d.motif === "ligne") ? "Ligne " + d.rang + " : " + d.detail +
                                     " — « " + d.texte + " »"
      : (d && d.motif === "reponses") ? d.nombre + " réponse" +
          (d.nombre > 1 ? "s ont" : " a") + " déjà été enregistrée" +
          (d.nombre > 1 ? "s" : "") + " : le contrôle ne peut plus être réécrit. " +
          "Éteignez-le si vous ne voulez plus le proposer."
      : (d && d.motif === "vide") ? "Aucune notion lisible dans ce texte."
      : "Enregistrement refusé. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-ct-neuf", d.notions + (d.notions > 1 ? " notions enregistrées" :
           " notion enregistrée") + ". Allumez le contrôle pour le proposer.", true);
    $("ct-texte").value = "";
    chargerControle();
  });
});

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

// ── Le rythme — la classe suit-elle la cadence ? ───────────────────────────
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

// ── Sélecteurs classe et séance ────────────────────────────────────────────
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

// ── L'inventaire des contrôles d'entrée ───────────────────────────────────
// Depuis le 17/09 il vit dans l'onglet « Suivi d'une séance », avec
// l'éditeur : un contrôle appartient à la vie d'une séance, pas à la
// bibliothèque de questionnaires. Cette carte reste l'INVENTAIRE et ne sait
// toujours pas écrire un contrôle — deux endroits pour le même geste, c'est
// la garantie que l'un des deux divergera.
// Un contrôle vit sur la séance qu'il précède, derrière deux sélecteurs. Le
// 15/09, huit notions posées sur le TP2 du BTS2 ont été cherchées ici, où
// elles n'étaient pas. Le modèle reste le bon — c'est la lecture qui manquait.
//
// Cette carte ne sait pas écrire un contrôle, et c'est volontaire : un
// contrôle s'écrit en regardant la séance qu'il prépare. Elle répond à trois
// questions et pas une de plus : qu'est-ce qui existe, pour quelle classe,
// et les étudiants le voient-ils ?
function chargerControles(){
  var carte = $("carte-controles");
  carte.hidden = true;
  sb.rpc("controles").then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) return;
    rendreControles(r.data.liste || []);
    carte.hidden = false;
  });
}

function rendreControles(liste){
  var z = $("ctl-liste");
  z.innerHTML = "";
  if (!liste.length) {
    // Le vide se dit avec le chemin pour en sortir, sinon il se lit comme une
    // panne — c'est ce qui s'est passé le 15/09, dans l'autre sens.
    z.innerHTML = '<p class="hint" style="margin:0">Aucun contrôle écrit pour ' +
      "l'instant. Ils s'écrivent dans <b>Suivi d'une séance</b> : choisissez la " +
      'classe et la séance, puis « Écrire le contrôle de cette séance ».</p>';
    return;
  }
  liste.forEach(function(c){ z.appendChild(ligneControleGlobal(c)); });
}

function ligneControleGlobal(c){
  var d = document.createElement("div");
  d.className = "qn-m";
  d.innerHTML = '<div class="qn-tete"><span class="qn-tt"></span>' +
                '<span class="qn-meta"></span></div>' +
                '<div class="ctl-bas"><span class="ctl-ou"></span></div>';

  // La classe d'abord, et en toutes lettres : la question posée est « est-ce
  // bien affecté au BTS2 ? ». Un code de classe seul n'y répond pas.
  d.querySelector(".qn-tt").textContent = c.classe;
  d.querySelector(".qn-meta").textContent =
    c.notions + (c.notions > 1 ? " notions" : " notion") +
    (c.inscrits ? " · " + c.repondu + " / " + c.inscrits + " y ont répondu" : "");

  var ou = d.querySelector(".ctl-ou");
  ou.textContent = "Séance " + c.numero + " — " + c.titre +
    (c.demarree ? " · déjà démarrée" : "");

  var bas = d.querySelector(".ctl-bas");

  var b = document.createElement("button");
  b.type = "button";
  b.className = "qa-b" + (c.ouvert ? " on" : "");
  b.innerHTML = '<span class="pt"></span><span class="et"></span>';
  b.querySelector(".et").textContent = c.ouvert ? "Proposé" : "Éteint";
  b.setAttribute("aria-pressed", c.ouvert ? "true" : "false");
  b.setAttribute("aria-label", (c.ouvert ? "Éteindre" : "Proposer") +
    " le contrôle de la séance " + c.numero + " pour " + c.classe);
  b.addEventListener("click", function(){ basculerControle(c, b); });
  bas.appendChild(b);

  var v = document.createElement("button");
  v.type = "button";
  v.className = "btn btn-sec ctl-voir";
  v.textContent = "Voir le détail";
  v.setAttribute("aria-label", "Ouvrir la séance " + c.numero + " de " +
    c.classe + " dans le suivi");
  v.addEventListener("click", function(){ allerAuControle(c); });
  bas.appendChild(v);

  return d;
}

function basculerControle(c, b){
  var vise = !b.classList.contains("on");
  b.disabled = true;
  erreur("err-controles", "");
  sb.rpc("ouvrir_controle", { p_seance_id: Number(c.seance_id),
                              p_ouvert: vise }).then(function(r){
    b.disabled = false;
    if (!r || r.error || !r.data || !r.data.ok) {
      erreur("err-controles", (r && r.data && r.data.motif === "vide")
        ? "Ce contrôle n'a aucune notion : rien à proposer."
        : "Action refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-controles", vise
      ? "Proposé à " + c.classe + ". Il apparaît en tête de l'écran des étudiants."
      : "Éteint pour " + c.classe + ". Les réponses déjà données sont conservées.", true);
    chargerControles();
    // La carte du suivi montre la même chose : si elle est ouverte sur cette
    // séance, elle mentirait jusqu'au prochain rafraîchissement.
    if (suivi && String(suivi.seanceId) === String(c.seance_id)) chargerControle();
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

// ── La bibliothèque de questionnaires ─────────────────────────────────────


// L'aide du mode révision n'apparaît que sur ce mode : l'étoile et la flèche
// n'ont aucun sens dans les deux autres, où elles sont d'ailleurs refusées.
$("qn-mode").addEventListener("change", function(){
  $("qn-aide-revision").hidden = $("qn-mode").value !== "revision";
  $("qn-texte").placeholder = $("qn-mode").value === "revision"
    ? "Un objet, c'est : · le modèle écrit une fois · *l'exemplaire fabriqué "
      + "· une méthode → La classe est le moule, l'objet le gâteau."
    : "Ce semestre, le rythme vous a paru : · Trop lent · Juste · Trop rapide · Intenable";
});

$("b-qn-creer").addEventListener("click", function(){
  var titre = $("qn-titre").value, texte = $("qn-texte").value;
  erreur("err-qn-neuf", "");
  if (!titre.trim())  { erreur("err-qn-neuf", "Donnez-lui un titre."); return; }
  if (!texte.trim())  { erreur("err-qn-neuf", "Collez au moins une question."); return; }

  var b = $("b-qn-creer");
  b.disabled = true;
  sb.rpc("creer_modele", { p_titre: titre, p_intro: $("qn-intro").value,
                           p_mode: $("qn-mode").value, p_texte: texte }).then(function(r){
    b.disabled = false;
    var d = r && r.data;
    if (!r || r.error || !d || !d.ok) {
      // La base refuse tout dès qu'une ligne est mal formée, et dit laquelle :
      // un questionnaire amputé d'une question sans qu'on le sache serait pire.
      // Les refus qui nomment une ligne se disent tous de la même façon : le
      // rang, la raison, et la ligne. C'est ce qui permet de corriger sans
      // relire les vingt autres.
      var parLigne = { ligne: 1, sans_etoile: 1, deux_etoiles: 1,
                       etoile_inutile: 1, explication_inutile: 1 };
      erreur("err-qn-neuf", (d && parLigne[d.motif])
        ? "Ligne " + d.rang + " : " + d.detail + " — « " + d.texte + " »"
        : (d && d.motif === "vide")
        ? "Aucune question lisible dans ce texte."
        : "Création refusée. Vérifiez que vous êtes bien connecté en enseignant.");
      return;
    }
    erreur("err-qn-neuf", "« " + titre + " » est créé, " + d.questions +
           " questions. Cochez les classes à qui le donner.", true);
    $("qn-titre").value = ""; $("qn-intro").value = ""; $("qn-texte").value = "";
    $("qn-neuf").open = false;
    chargerQuestionnaires();
  });
});


// Un sélecteur qui range les démos dans leur propre groupe : la liste du haut
// ne contient que ce dont on se sert en cours.
function remplirSelecteurClasses(sel, classes, valeur, texte){
  sel.innerHTML = "";
  var demos = [];
  (classes || []).forEach(function(c){
    var o = document.createElement("option");
    o.value = valeur(c); o.textContent = texte(c);
    if (estDemo(c)) demos.push(o); else sel.appendChild(o);
  });
  if (demos.length) {
    var g = document.createElement("optgroup");
    g.label = "Démonstration";
    demos.forEach(function(o){ g.appendChild(o); });
    sel.appendChild(g);
  }
  if (!sel.options.length) {
    sel.innerHTML = '<option value="">Aucune classe disponible</option>';
  }
}

// ── Espace enseignant ──────────────────────────────────────────────────────
function ouvrirEspaceEnseignant(){
  montrer("espace-ens");

  // L'onglet vient de l'adresse quand elle en porte un : c'est ce qui fait
  // qu'un rafraîchissement en pleine séance ne renvoie plus à l'appel.
  // « remplacer » : on normalise l'adresse sans ajouter d'entrée, sinon le
  // premier Précédent ne ferait que retirer le dièse.
  ouvrirOnglet(ongletDeLAdresse() || "appel", "remplacer");

  sb.from("classes").select("id,code,nom").order("code").then(function(rc){
    var toutes = rc.data || [];
    // Les démos restent joignables par le sélecteur, mais elles ne comptent
    // dans aucun chiffre et n'apparaissent dans aucune carte du jour.
    var classes = classesReelles(toutes);
    var corps = $("t-classes").querySelector("tbody");
    corps.innerHTML = "";

    // Sélecteur de classe du panneau de suivi
    remplirSelecteurClasses($("pk-classe"), toutes,
      function(c){ return c.id; }, function(c){ return c.nom; });

    suivi.classesConnues = classes;
    chargerAppelToutesClasses(classes);
    chargerConnaissance(classes);
    chargerStage(classes);
    chargerQuestionnaires();
    chargerControles();
    chargerAFaire();
    chargerSemestre();
    if (classes.length) chargerSeancesDe(classes[0].id);

    classes.forEach(function(c){
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + c.nom + "</td><td class='num'>" + c.code +
                     "</td><td class='num' data-e>…</td><td class='num' data-c>…</td>" +
                     "<td class='num' data-s>…</td>";
      corps.appendChild(tr);

      sb.from("eleves").select("auth_id").eq("classe_id", c.id).then(function(re){
        var l = re.data || [];
        tr.querySelector("[data-e]").textContent = l.length;
        tr.querySelector("[data-c]").textContent = l.filter(function(x){ return x.auth_id; }).length;
      });
      sb.from("seances").select("id").eq("classe_id", c.id).then(function(rs){
        tr.querySelector("[data-s]").textContent = (rs.data || []).length;
      });
    });

    // Un projet appartient à une classe : on l'affiche sous elle, et non dans
    // une liste à plat où le code de classe était collé devant la description.
    sb.from("projets").select("titre,description,url,icone,ordre,classe_id")
      .order("classe_id").order("ordre")
      .then(function(rp){
        rendreProjetsParClasse(classes, rp.data || []);
      });
  });
}


// ── Formulaire étudiant ────────────────────────────────────────────────────
$("f-etu").addEventListener("submit", function(e){
  e.preventDefault();
  erreur("err-etu", "");
  $("b-etu").disabled = true;
  $("b-etu").textContent = "Connexion…";

  sb.rpc("rejoindre", {
    p_classe_code: $("classe").value,
    p_numero:      $("numero").value.trim(),
    p_pin:         $("pin").value.trim() || null
  }).then(function(r){
    $("b-etu").disabled = false;
    $("b-etu").textContent = "Me connecter";
    if (r.error) { erreur("err-etu", r.error.message); return; }
    ouvrirEspaceEtudiant(r.data);
  });
});

// ── Formulaire enseignant ──────────────────────────────────────────────────
$("f-ens").addEventListener("submit", function(e){
  e.preventDefault();
  erreur("err-ens", "");
  $("b-ens").disabled = true;
  $("b-ens").textContent = "Connexion…";

  sb.auth.signInWithPassword({ email: $("email").value, password: $("mdp").value })
    .then(function(r){
      $("b-ens").disabled = false;
      $("b-ens").textContent = "Me connecter";
      if (r.error) { erreur("err-ens", "Identifiants refusés."); return; }
      return sb.rpc("est_enseignant").then(function(re){
        if (re.data) { ouvrirEspaceEnseignant(); }
        else {
          erreur("err-ens", "Ce compte n'est pas déclaré comme enseignant.");
          sb.auth.signOut();
        }
      });
    });
});

// ── Déconnexion ────────────────────────────────────────────────────────────
function sortir(){
  arreterBoucle();
  sb.auth.signOut().then(function(){ location.reload(); });
}
$("b-sortie-etu").addEventListener("click", sortir);
$("b-sortie-ens").addEventListener("click", sortir);

// ── Commandes du suivi de séance ───────────────────────────────────────────
$("pk-classe").addEventListener("change", function(){
  chargerSeancesDe(this.value);
});

$("pk-seance").addEventListener("change", activerSeance);
$("b-copier-abs").addEventListener("click", copierAbsents);
$("b-noms").addEventListener("click", function(){
  var d = $("bloc-noms");
  d.hidden = false; d.open = !d.open;
  if (d.open && !$("noms-saisie").value) {
    // On repart de ce qui est deja connu, pour completer plutot que resaisir.
    var map = lireNoms(), lignes = [];
    Object.keys(map).forEach(function(code){
      Object.keys(map[code]).sort().forEach(function(num){
        lignes.push(code + ";" + num + ";" + map[code][num]);
      });
    });
    $("noms-saisie").value = lignes.join("\n");
  }
});
$("b-noms-ok").addEventListener("click", function(){
  var r = enregistrerNoms($("noms-saisie").value);
  if (r.erreur) { erreur("err-noms", "Le navigateur refuse d'enregistrer (navigation privée ?)."); return; }
  erreur("err-noms", r.lus + " noms enregistrés dans ce navigateur" +
         (r.ignores ? ", " + r.ignores + " lignes ignorées (format attendu : CLASSE;numéro;nom)" : "") + ".", true);
  chargerAppelToutesClasses(suivi.classesConnues || []);
  chargerConnaissance(suivi.classesConnues || []);
  chargerStage(suivi.classesConnues || []);
  chargerAFaire();
  chargerSemestre();
});
$("b-noms-vider").addEventListener("click", function(){
  try { localStorage.removeItem(NOMS_CLE); } catch (e) {}
  $("noms-saisie").value = "";
  erreur("err-noms", "Noms effacés de ce navigateur.", true);
  chargerAppelToutesClasses(suivi.classesConnues || []);
  chargerConnaissance(suivi.classesConnues || []);
  chargerStage(suivi.classesConnues || []);
  chargerAFaire();
  chargerSemestre();
});

$("b-demarrer").addEventListener("click", function(){
  pilotage("demarrer_seance", "Séance démarrée. Le chrono part maintenant.");
});
$("b-clore").addEventListener("click", function(){
  pilotage("clore_seance", "Séance close. Les réponses sont figées.");
});

$("b-rafraichir").addEventListener("click", rafraichir);
$("pk-tri").addEventListener("change", function(){
  if (suivi.stats) rendreSuivi(suivi.stats);
});
$("b-ecran").addEventListener("click", ouvrirEcran);

// Le mode classe branche ses propres boutons, et reçoit ici les deux
// chargements qui vivent de ce côté-ci — sans quoi il faudrait qu'il importe
// app.js, qui l'importe déjà.
brancherEcran({ chargerDebrief: chargerDebrief, chargerParcours: chargerParcours });
brancherBibliotheque({ chargerAFaire: chargerAFaire,
                       chargerConnaissance: chargerConnaissance,
                       chargerStage: chargerStage,
                       remplirConnaissanceClasse: remplirConnaissanceClasse });


// ── Démarrage ──────────────────────────────────────────────────────────────
function chargerClasses(){
  return sb.from("classes").select("code,nom").order("code").then(function(r){
    remplirSelecteurClasses($("classe"), r.data || [],
      function(c){ return c.code; }, function(c){ return c.nom; });
  });
}

sb.auth.getSession().then(function(s){
  var session = s.data && s.data.session;
  if (session) {
    return sb.rpc("est_enseignant").then(function(re){
      if (re.data) { ouvrirEspaceEnseignant(); return; }
      return sb.rpc("qui_suis_je").then(function(rm){
        if (rm.data) { ouvrirEspaceEtudiant(rm.data); }
        else { return chargerClasses().then(function(){ montrer("connexion"); }); }
      });
    });
  }
  return sb.auth.signInAnonymously().then(function(){
    return chargerClasses().then(function(){ montrer("connexion"); });
  });
}).catch(function(){
  $("chargement").textContent =
    "Connexion au service impossible. Réessayez dans un instant, ou prévenez votre enseignant.";
});

})();
