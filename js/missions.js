// ── Les missions d'une séance de projet, des deux côtés de l'écran ────────
//
// Une séance de projet se suit en jalons. Jusqu'au 27/09 ils ne remontaient
// que d'un endroit : le tableau de bord PlaylistApp, qui écrit `tpN-…` = 'true'.
// Une séance sans tableau de bord à elle — la séance IA 1 du BTS2 — ne
// remontait rien, et le suivi annonçait toute la classe « jamais commencé ».
//
// Ici, l'étudiant coche ses missions dans le portail, et la case s'écrit
// EXACTEMENT comme celle de PlaylistApp : clé `tpN-mK`, réponse 'true'. Le
// tableau de bord, `suivi_projet()` et le parcours de l'heure la comptent donc
// sans qu'on y touche, et 'true' n'étant ni 'ok' ni 'ko', aucune mission
// n'entre dans un taux de réussite (voir estEvaluee() dans seance.js).
//
// Trois règles de ce fichier :
//
//   · LA CARTE ÉTUDIANTE N'EST PAS UNE ÉTAPE DE LA FILE. La file compte ce qui
//     se fait AVANT la séance (appel, humeur, contrôle) ; les missions SONT la
//     séance. Marquée étape, elle se replierait une fois tout coché — et on ne
//     pourrait plus décocher une case cochée par erreur.
//
//   · LA GRILLE VAUT AUSSI POUR LES TP PLAYLISTAPP. Sans missions déclarées,
//     ses colonnes sont les clés réellement cochées : rien à saisir pour lire
//     qui a fait quoi sur le TP2.
//
//   · RETIRER UNE MISSION DÉJÀ COCHÉE EST REFUSÉ PAR LA BASE, et le message le
//     dit. La case disparaîtrait de l'écran de l'étudiant, et son avancement
//     avec elle, sans qu'il ait rien défait.

import { $, sb, suivi, erreur, typo, texteEnvoi, signalerSessionPerimee,
         codeClasseCourante, nomDe, prenomSeul } from './socle.js';

const NIVEAUX = { guide: "🟢", semi: "🟡", autonome: "🔴" };
const JOURS_ARRET = 7;

function jourCourt(iso){
  if (!iso) return "";
  var d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function jourChiffres(iso){
  var d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/* ══════════════ Côté étudiant ══════════════ */

function chargerMissionsEtu(){
  var z = $("missions-etu");
  if (!z) return;
  z.innerHTML = "";
  sb.rpc("mes_missions").then(function(r){
    // Fonction pas déployée : rien ne s'affiche, comme avant qu'elle existe.
    if (!r || r.error || !r.data || !r.data.ok) return;
    (r.data.liste || []).forEach(function(d){
      if (d.missions && d.missions.length) z.appendChild(carteMissions(d));
    });
  });
}

function carteMissions(d){
  var c = document.createElement("div");
  c.className = "card mi-carte";
  c.id = "mi-" + d.seance_id;
  c.innerHTML = '<h2></h2><p class="hint"></p><div class="mi-liste"></div>' +
                '<div aria-live="polite" id="err-mi-' + d.seance_id + '"></div>';
  c.querySelector("h2").textContent = "Vos missions — séance " + d.numero;
  var h = c.querySelector(".hint");
  h.textContent = typo(d.titre) + ". Cochez une mission quand son critère « Validé quand » " +
    "du guide est atteint — pas avant : c'est ce que je lis pour savoir où vous en êtes.";
  if (d.echeance) {
    var e = document.createElement("b");
    e.textContent = " Échéance : " + new Date(d.echeance).toLocaleDateString("fr-FR",
      { weekday: "long", day: "numeric", month: "long" }) + ".";
    h.appendChild(e);
  }
  var liste = c.querySelector(".mi-liste");
  d.missions.forEach(function(m){ liste.appendChild(caseMission(d, m)); });
  majCompte(c, d);
  // La carte n'est pas encore dans la page : erreur() la chercherait par son
  // id et ne la trouverait pas. Le message s'écrit donc dans la carte même.
  if (!d.ouverte) {
    var m = document.createElement("div");
    m.className = "msg";
    m.textContent = "La séance n'est pas encore ouverte : les cases s'activeront quand elle le sera.";
    c.querySelector("#err-mi-" + d.seance_id).appendChild(m);
  }
  return c;
}

function caseMission(d, m){
  var b = document.createElement("button");
  b.type = "button";
  b.className = "mi-case" + (m.fait ? " on" : "");
  b.setAttribute("aria-pressed", m.fait ? "true" : "false");
  b.disabled = !d.ouverte;
  b.innerHTML = '<span class="mi-coche" aria-hidden="true"></span>' +
                '<span class="mi-txt"><span class="mi-lib"></span><span class="mi-meta"></span></span>';
  b.querySelector(".mi-lib").textContent = (NIVEAUX[m.niveau] ? NIVEAUX[m.niveau] + " " : "") +
                                           m.ordre + ". " + typo(m.libelle);
  metaMission(b, m);
  b.addEventListener("click", function(){
    var voulu = !m.fait;
    b.disabled = true;
    sb.rpc("valider_mission", { p_seance_id: d.seance_id, p_cle: m.cle, p_fait: voulu })
      .then(function(r){
        b.disabled = false;
        if (r.error || !r.data || !r.data.ok) {
          var motif = r.data && r.data.motif;
          erreur("err-mi-" + d.seance_id, motif === "fermee"
            ? "Cette séance est fermée : la case n'a pas été enregistrée."
            : texteEnvoi(r.error, "mission"));
          signalerSessionPerimee(r.error);
          return;
        }
        erreur("err-mi-" + d.seance_id, "");
        m.fait = voulu;
        m.le = voulu ? new Date().toISOString() : null;
        b.classList.toggle("on", voulu);
        b.setAttribute("aria-pressed", voulu ? "true" : "false");
        metaMission(b, m);
        majCompte($("mi-" + d.seance_id), d);
      });
  });
  return b;
}

function metaMission(b, m){
  var bouts = [];
  if (m.verbe) bouts.push(m.verbe);
  if (m.fait && m.le) bouts.push("validée le " + jourCourt(m.le));
  b.querySelector(".mi-meta").textContent = bouts.join(" · ");
}

function majCompte(c, d){
  var faites = d.missions.filter(function(m){ return m.fait; }).length;
  var h = c.querySelector("h2");
  h.setAttribute("data-compte", faites + "/" + d.missions.length);
}

/* ══════════════ Côté enseignant ══════════════ */

// Appelée à chaque choix de séance et à chaque tour de la boucle de suivi :
// une case cochée doit apparaître pendant qu'on regarde, pas au prochain
// rechargement. Le bloc ne se montre que sur une séance de projet.
function chargerMissions(){
  var bloc = $("bloc-missions");
  if (!bloc) return Promise.resolve();
  if (!suivi.seanceId || suivi.nature !== "projet") { bloc.hidden = true; return Promise.resolve(); }
  var id = suivi.seanceId;
  return sb.rpc("grille_missions", { p_seance_id: Number(id) }).then(function(r){
    if (String(id) !== String(suivi.seanceId)) return;   // on a changé de séance entre-temps
    if (!r || r.error || !r.data || !r.data.ok) { bloc.hidden = true; return; }
    bloc.hidden = false;
    rendreGrille(r.data);
  });
}

function rendreGrille(g){
  var cols = g.missions || [];
  var eleves = g.eleves || [];
  var code = codeClasseCourante();

  $("mi-resume").textContent = !cols.length
    ? "Aucune mission déclarée, et aucune case cochée pour l'instant sur cette séance."
    : resume(cols, eleves, g);

  // ── Une barre par mission : où la classe s'arrête ──
  var barres = $("mi-barres");
  barres.innerHTML = "";
  var n = Math.max(eleves.length, 1);
  cols.forEach(function(m, i){
    var faits = eleves.filter(function(e){ return e.cases && e.cases[m.cle]; }).length;
    var l = document.createElement("div");
    l.className = "pa-e";
    l.innerHTML = '<span class="pa-e-n"></span><span class="pa-e-j"><span></span></span>' +
                  '<span class="pa-e-c"></span>';
    l.querySelector(".pa-e-n").textContent = "M" + (i + 1) + " " + (m.verbe || "");
    l.querySelector(".pa-e-n").title = m.libelle;
    l.querySelector(".pa-e-j > span").style.width = Math.round(faits / n * 100) + "%";
    l.querySelector(".pa-e-c").textContent = faits + "/" + eleves.length;
    barres.appendChild(l);
  });

  // ── La grille : une ligne par étudiant, une colonne par mission ──
  var t = $("mi-grille");
  t.innerHTML = "";
  if (!cols.length) return;
  var tete = document.createElement("tr");
  var th0 = document.createElement("th");
  th0.textContent = "N°";
  tete.appendChild(th0);
  cols.forEach(function(m, i){
    var th = document.createElement("th");
    th.textContent = "M" + (i + 1);
    th.title = (NIVEAUX[m.niveau] || "") + " " + m.libelle;
    th.scope = "col";
    tete.appendChild(th);
  });
  var thd = document.createElement("th");
  thd.textContent = "Dern.";
  thd.title = "Dernière mission validée";
  tete.appendChild(thd);
  var thead = document.createElement("thead");
  thead.appendChild(tete);
  t.appendChild(thead);

  var corps = document.createElement("tbody");
  var maintenant = Date.now();
  eleves.forEach(function(e){
    var tr = document.createElement("tr");
    var faits = cols.filter(function(m){ return e.cases && e.cases[m.cle]; }).length;
    var arret = faits > 0 && faits < cols.length && e.dernier &&
                (maintenant - new Date(e.dernier)) / 86400000 >= JOURS_ARRET;
    if (faits === cols.length) tr.className = "mi-fini";
    else if (arret) tr.className = "mi-arret";
    else if (!faits) tr.className = "mi-rien";

    var td0 = document.createElement("th");
    td0.scope = "row";
    var nom = prenomSeul(nomDe(code, e.numero) || "");
    td0.textContent = e.numero + " " + (e.avatar || "") + (nom ? " " + nom : "");
    tr.appendChild(td0);
    cols.forEach(function(m){
      var td = document.createElement("td");
      var le = e.cases && e.cases[m.cle];
      td.className = le ? "mi-ok" : "mi-non";
      td.textContent = le ? "✓" : "·";
      td.title = le ? m.libelle + " — le " + jourCourt(le) : m.libelle + " — pas encore";
      tr.appendChild(td);
    });
    var tdd = document.createElement("td");
    tdd.className = "mi-date";
    // La date en chiffres : la colonne doit tenir à 390 px sans défilement.
    tdd.textContent = e.dernier ? jourChiffres(e.dernier) + (arret ? " · arrêt" : "") : "—";
    tr.appendChild(tdd);
    corps.appendChild(tr);
  });
  t.appendChild(corps);

  // ── La légende : le nom complet de chaque colonne ──
  var lg = $("mi-legende");
  lg.innerHTML = "";
  cols.forEach(function(m, i){
    var li = document.createElement("li");
    li.textContent = "M" + (i + 1) + " — " + (NIVEAUX[m.niveau] ? NIVEAUX[m.niveau] + " " : "") +
                     m.libelle + (m.verbe ? " [" + m.verbe + "]" : "");
    lg.appendChild(li);
  });

  // L'éditeur ne vit plus ici : il est dans la fiche de la séance, sous
  // Préparer (28/09), qui se préremplit avec lignesMissions().
}

// Les missions déclarées, dans la syntaxe de l'éditeur — jamais les clés
// PlaylistApp, qui ne sont pas des missions à réécrire.
function lignesMissions(cols){
  return (cols || []).map(function(m){
    return (NIVEAUX[m.niveau] ? NIVEAUX[m.niveau] + " " : "") + m.libelle +
           (m.verbe ? " [" + m.verbe + "]" : "");
  });
}

// Une phrase, dans l'ordre où l'on agit : qui a fini, qui est arrêté, qui n'a
// rien commencé.
function resume(cols, eleves, g){
  var fini = 0, rien = 0, arretes = 0, maintenant = Date.now();
  eleves.forEach(function(e){
    var f = cols.filter(function(m){ return e.cases && e.cases[m.cle]; }).length;
    if (f === cols.length) fini++;
    else if (!f) rien++;
    else if (e.dernier && (maintenant - new Date(e.dernier)) / 86400000 >= JOURS_ARRET) arretes++;
  });
  var s = cols.length + " mission" + (cols.length > 1 ? "s" : "") +
          (g.declarees ? "" : " (clés cochées sur le tableau de bord du TP)") + " · " +
          fini + " fini" + (fini > 1 ? "s" : "") + " · " +
          rien + " sans aucune case";
  if (arretes) s += " · " + arretes + " arrêté" + (arretes > 1 ? "s" : "") +
                    " depuis " + JOURS_ARRET + " jours ou plus";
  return s + ".";
}

function enregistrerMissions(){
  var ta = $("mi-texte");
  var b = $("b-mi-creer");
  // La séance PRÉPARÉE (fiche de Préparer), à défaut la séance suivie.
  var cible = suivi.prep || suivi.seanceId;
  if (!cible) return;
  b.disabled = true;
  sb.rpc("definir_missions", { p_seance_id: Number(cible), p_texte: ta.value })
    .then(function(r){
      b.disabled = false;
      if (r.error || !r.data || !r.data.ok) {
        erreur("err-mi-neuf", (r.data && r.data.detail) ||
          (r.data && r.data.motif === "refus" ? "Réservé à l'enseignant." :
           "Les missions n'ont pas été enregistrées."));
        return;
      }
      delete ta.dataset.touche;
      erreur("err-mi-neuf", r.data.missions + " mission" + (r.data.missions > 1 ? "s" : "") +
             " enregistrée" + (r.data.missions > 1 ? "s" : "") +
             " — les jalons de la séance suivent.", true);
      if (String(cible) === String(suivi.seanceId)) suivi.jalons = r.data.missions || suivi.jalons;
      chargerMissions();
    });
}

function brancherMissions(){
  var b = $("b-mi-creer");
  if (b) b.addEventListener("click", enregistrerMissions);
}

export { chargerMissionsEtu, chargerMissions, rendreGrille, brancherMissions, resume, lignesMissions };
