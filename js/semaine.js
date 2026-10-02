// ── Cette semaine ─────────────────────────────────────────────────────────
//
// Demandé par G le 02/10/2026 : « en fin de semaine », depuis le téléphone,
// savoir qui a décroché, qui progresse, ce qu'il faut reprendre lundi, où en
// est chacun face à l'échéance d'un projet, qui travaille entre deux cours,
// et comment va la classe.
//
// Le compte rendu porte sur UNE séance, le carnet sur TOUT le semestre (un
// tableau large, pénible au téléphone), « Sur le semestre » sur les trois
// dernières séances. Cette carte est la seule à répondre « et cette
// semaine ? », et elle est faite pour un écran de 390 px : des listes, pas
// des tableaux.
//
// Dans l'ordre où l'on agit :
//
//   1. les chiffres de la classe, chacun avec son écart à la semaine d'avant ;
//   2. À REVOIR LUNDI — des raisons en phrases, jamais un score ; « nouveau »
//      quand l'étudiant n'avait rien la semaine d'avant ;
//   3. EN PROGRÈS — ce qu'on dit à voix haute, et qu'on oublie de dire ;
//   4. les notions à reprendre (mêmes seuils que le débriefing) ;
//   5. les projets face à leur échéance ;
//   6. le travail hors séance ;
//   7. la météo de l'humeur, jour par jour, puis élève par élève ;
//   8. les séances jouées.
//
// Tout vient de `semaine_classe()` (20261002070000), calculé en base. « Copier »
// en fait un texte pour le cahier de textes ou un message à l'équipe — avec
// les prénoms locaux s'ils sont chargés, qui ne quittent pas l'appareil.

import { $, sb, typo, nomDe, prenomSeul, classesReelles, copierTexte } from './socle.js';
import { ouvrirFiche } from './fiche.js';

var donnees = null, classe = null, jour = null, longue = null;
var METEO = { A: "☀️", B: "🌤", C: "🌧", D: "⛈" };
var NOM_METEO = { A: "en forme", B: "ça va", C: "fatigué", D: "perdu" };
var STATUT = { a_jour: "à jour", juste: "juste", retard: "en retard", decroche: "décroché",
               sans_repere: "pas encore de repère" };

function chargerSemaine(classes){
  var carte = $("carte-semaine");
  if (!carte) return Promise.resolve();
  var sel = $("sm-classe");
  if (!sel.options.length) {
    classesReelles(classes || []).forEach(function(c){
      var o = document.createElement("option");
      o.value = c.id; o.textContent = c.nom; o.dataset.code = c.code;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function(){ longue = null; lireSemaine(sel.value, jour); });
    $("b-sm-prec").addEventListener("click", function(){ decaler(-7); });
    $("b-sm-suiv").addEventListener("click", function(){ decaler(7); });
    $("b-sm-copier").addEventListener("click", function(){
      if (donnees) copierTexte(texteSemaine(donnees), $("b-sm-copier"));
    });
  }
  if (!sel.value) return Promise.resolve();
  return lireSemaine(sel.value, null);
}

function decaler(n){
  if (!donnees) return;
  var d = new Date(donnees.du + "T12:00:00");
  d.setDate(d.getDate() + n);
  lireSemaine(classe, d.toISOString().slice(0, 10));
}

function lireSemaine(classeId, j){
  classe = classeId; jour = j;
  var carte = $("carte-semaine");
  $("sm-corps").innerHTML = '<div class="squelette"></div><div class="squelette court"></div>';
  return sb.rpc("semaine_classe", { p_classe_id: Number(classeId), p_jour: j }).then(function(r){
    // Fonction pas encore déployée : la carte reste absente, comme les autres.
    if (!r || r.error || !r.data || !r.data.ok) { carte.hidden = true; return; }
    carte.hidden = false;
    donnees = r.data;
    rendreSemaine(donnees);
  });
}

function codeClasseSm(){
  var o = $("sm-classe").selectedOptions && $("sm-classe").selectedOptions[0];
  return (o && o.dataset.code) || (donnees && donnees.code) || "";
}

function dateFr(iso, long){
  var d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("fr-FR", long ? { weekday: "long", day: "numeric", month: "long" }
                                            : { weekday: "short", day: "numeric", month: "numeric" });
}

function quiSm(x){
  var nom = nomDe(codeClasseSm(), x.numero);
  return x.numero + (nom ? " " + prenomSeul(nom) : "");
}

function smEl(tag, classe, texte){
  var n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texte !== undefined && texte !== null) n.textContent = texte;
  return n;
}

function section(titre, compte){
  var s = smEl("section", "sm-sec");
  var h = smEl("h3", "sm-h", titre);
  if (compte !== undefined) h.appendChild(smEl("span", "vg-compte", compte ? String(compte) : ""));
  s.appendChild(h);
  return s;
}

// ── 1. Les chiffres ──
function ecart(v, avant, unite){
  if (v === null || v === undefined || avant === null || avant === undefined) return null;
  var d = Math.round(v - avant);
  if (!d) return { t: "= " + (unite ? "" : "semaine d'avant"), ton: "neutre" };
  return { t: (d > 0 ? "▲ +" : "▼ ") + d + (unite || ""), ton: d > 0 ? "haut" : "bas" };
}

function tuileSm(valeur, libelle, e, inverse){
  var t = smEl("div", "sm-tuile");
  t.appendChild(smEl("span", "sm-v", valeur));
  t.appendChild(smEl("span", "sm-l", libelle));
  if (e) {
    var ton = e.ton === "neutre" ? "neutre" : ((e.ton === "haut") !== !!inverse ? "bien" : "mal");
    t.appendChild(smEl("span", "sm-e " + ton, e.t));
  }
  return t;
}

function rendreChiffres(d){
  var c = d.classe || {}, p = d.precedente || {};
  var g = smEl("div", "sm-tuiles");
  g.appendChild(tuileSm(c.presence === null || c.presence === undefined ? "—" : c.presence + " %",
    "présence · " + (c.appels || 0) + " appel" + (c.appels > 1 ? "s" : ""), ecart(c.presence, p.presence, " pts")));
  g.appendChild(tuileSm(c.reussite === null || c.reussite === undefined ? "—" : c.reussite + " %",
    "réussite · " + (c.evaluees || 0) + " rép.", ecart(c.reussite, p.reussite, " pts")));
  g.appendChild(tuileSm(String(c.hors || 0), "réponses hors séance · " + (c.actifs_hors || 0) + " étud.",
    ecart(c.hors, p.hors)));
  var perdus = c.perdus || 0;
  g.appendChild(tuileSm(perdus ? "⛈ " + perdus : (c.humeurs ? "☀️" : "—"),
    perdus ? "« perdu » à l'appel" : (c.humeurs ? "personne « perdu »" : "humeur non répondue"),
    ecart(perdus, p.perdus), true));
  return g;
}

// ── 2 et 3. Les étudiants ──
function ligneEleve(x, raisons, ton, nouveau){
  var l = smEl("div", "vg-l sm-el g-" + ton);
  l.tabIndex = 0;
  l.setAttribute("role", "button");
  l.setAttribute("aria-label", "Ouvrir la fiche de l'élève " + x.numero);
  l.appendChild(smEl("span", "pa-num", x.numero));
  var c = smEl("div", "vg-corps");
  var nom = nomDe(codeClasseSm(), x.numero);
  if (nom || nouveau) {
    var t = smEl("span", "vg-nom", nom ? prenomSeul(nom) : "");
    if (nouveau) t.appendChild(smEl("span", "badge att sm-nouveau", "nouveau"));
    c.appendChild(t);
  }
  raisons.forEach(function(r){
    c.appendChild(smEl("span", "vg-r g-" + (r.gravite || ton), typo(r.texte || r)));
  });
  if (x.humeurs) c.appendChild(smEl("span", "sm-meteo-el", x.humeurs.split("").map(function(h){ return METEO[h] || "·"; }).join(" ")));
  l.appendChild(c);
  var ouvrir = function(ev){
    if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    ouvrirFiche({ id: x.eleve_id, numero: x.numero, classeId: classe });
  };
  l.addEventListener("click", ouvrir);
  l.addEventListener("keydown", ouvrir);
  return l;
}

function rang(x){
  var g = (x.raisons || []).map(function(r){ return r.gravite === "attention" ? 0 : 1; });
  return g.length ? Math.min.apply(null, g) : 9;
}

function rendreEleves(d, z){
  var arevoir = (d.eleves || []).filter(function(x){ return (x.raisons || []).length; });
  arevoir.sort(function(a, b){
    return rang(a) - rang(b) || (b.nouveau ? 1 : 0) - (a.nouveau ? 1 : 0) ||
           b.raisons.length - a.raisons.length || (a.numero < b.numero ? -1 : 1);
  });
  var s = section("À revoir lundi", arevoir.length);
  if (!arevoir.length) s.appendChild(smEl("p", "sous-hint", "Personne à signaler cette semaine."));
  else s.appendChild(smEl("p", "sous-hint", "Des raisons, pas une note. « nouveau » : rien à redire la semaine d'avant. Toucher une ligne ouvre la fiche."));
  arevoir.forEach(function(x){ s.appendChild(ligneEleve(x, x.raisons, rang(x) === 0 ? "attention" : "a_suivre", x.nouveau)); });
  z.appendChild(s);

  var bien = (d.eleves || []).filter(function(x){ return (x.progres || []).length; });
  var s2 = section("En progrès", bien.length);
  if (!bien.length) s2.appendChild(smEl("p", "sous-hint", "Rien de marquant cette semaine."));
  else s2.appendChild(smEl("p", "sous-hint", "À dire à voix haute : c'est ce qu'on oublie de faire."));
  bien.forEach(function(x){
    s2.appendChild(ligneEleve(x, x.progres.map(function(t){ return { texte: t, gravite: "bien" }; }), "bien", false));
  });
  z.appendChild(s2);
}

// ── 4. Les notions ──
function rendreConcepts(d, z){
  var l = d.concepts || [];
  if (!l.length) return;
  var s = section("Notions à reprendre", l.length);
  s.appendChild(smEl("p", "sous-hint", "Les concepts des séances de la semaine sous 75 % (débriefing : acquis ≥ 75 %, fragile 45-74 %, à revoir < 45 %)."));
  l.forEach(function(c){
    var r = smEl("div", "sm-concept " + (c.etat === "a_revoir" ? "ko" : "att"));
    r.appendChild(smEl("span", "sm-c-t", typo(c.intitule)));
    r.appendChild(smEl("span", "sm-c-m", "séance " + c.seance + " · " + c.taux + " % · " +
      (c.etat === "a_revoir" ? "à revoir" : "fragile")));
    s.appendChild(r);
  });
  z.appendChild(s);
}

// ── 5. Les projets ──
function rendreTrajectoires(d, z){
  var mods = (d.trajectoires || []).filter(function(m){ return m.total; });
  if (!mods.length) return;
  var s = section("Projets : vers l'échéance");
  mods.forEach(function(m){
    var b = smEl("div", "sm-traj");
    var t = smEl("p", "sm-traj-t");
    t.appendChild(smEl("b", "", (m.icone ? m.icone + " " : "") + m.titre));
    t.appendChild(smEl("span", "", " · " + m.total + " jalons, échéance le " + dateFr(m.echeance, true) +
      " · une progression régulière en serait à " + String(Math.round(m.attendu)) + "."));
    b.appendChild(t);
    var compte = m.compte || {};
    var total = (m.eleves || []).length || 1;
    var barre = smEl("div", "sm-barre");
    barre.setAttribute("role", "img");
    var lib = [];
    ["a_jour", "juste", "retard", "decroche", "sans_repere"].forEach(function(k){
      if (!compte[k]) return;
      var part = smEl("span", "sm-part " + k);
      part.style.width = (compte[k] / total * 100) + "%";
      barre.appendChild(part);
      lib.push(compte[k] + " " + STATUT[k]);
    });
    barre.setAttribute("aria-label", lib.join(", "));
    b.appendChild(barre);
    b.appendChild(smEl("p", "sm-traj-l", lib.join(" · ")));
    var tard = (m.eleves || []).filter(function(x){ return x.statut === "decroche" || x.statut === "retard"; });
    if (tard.length) {
      b.appendChild(smEl("p", "sm-traj-n", "En retard : " + tard.map(function(x){
        return quiSm(x) + " (" + x.faits + ")"; }).join(", ")));
    }
    s.appendChild(b);
  });
  z.appendChild(s);
}

// ── 6. Hors séance ──
function rendreHors(d, z){
  var el2 = d.eleves || [];
  var actifs = el2.filter(function(x){ return x.hors > 0; })
    .sort(function(a, b){ return b.hors - a.hors || (a.numero < b.numero ? -1 : 1); });
  var rien = el2.filter(function(x){ return !x.hors && x.presents > 0; });
  var s = section("Travail hors séance", actifs.length);
  s.appendChild(smEl("p", "sous-hint", "Une réponse est « hors séance » quand elle est donnée un jour sans appel, " +
    "ou plus de quatre heures après l'appel du jour : révisions, missions finies chez soi, séances d'avance."));
  if (actifs.length) {
    var l = smEl("div", "sm-hors");
    actifs.forEach(function(x){
      var p = smEl("span", "sm-pastille", quiSm(x) + " · " + x.hors + " rép. · " + x.jours_hors + " j");
      l.appendChild(p);
    });
    s.appendChild(l);
  } else {
    s.appendChild(smEl("p", "sous-hint", "Personne n'a travaillé en dehors des cours cette semaine."));
  }
  if (rien.length) {
    s.appendChild(smEl("p", "sm-rien", "Rien entre deux cours (présents en classe) : " +
      rien.map(quiSm).join(", ")));
  }
  z.appendChild(s);
}

// ── 7. La météo ──
function barreMeteo(j){
  var total = (j.A || 0) + (j.B || 0) + (j.C || 0) + (j.D || 0);
  var b = smEl("div", "sm-barre sm-barre-meteo");
  b.setAttribute("role", "img");
  var lib = [];
  ["A", "B", "C", "D"].forEach(function(k){
    if (!j[k]) return;
    var part = smEl("span", "sm-part m" + k);
    part.style.width = (j[k] / (total || 1) * 100) + "%";
    b.appendChild(part);
    lib.push(j[k] + " " + NOM_METEO[k]);
  });
  b.setAttribute("aria-label", total ? lib.join(", ") : "personne n'a répondu");
  return { barre: b, lib: total ? ["A", "B", "C", "D"].filter(function(k){ return j[k]; })
    .map(function(k){ return METEO[k] + " " + j[k]; }).join("  ") : "pas de réponse" };
}

function ligneJour(j){
  var r = smEl("div", "sm-jour");
  r.appendChild(smEl("span", "sm-jour-d", dateFr(j.jour) +
    ((j.seances || []).length ? " · s. " + j.seances.join(", ") : "")));
  var m = barreMeteo(j);
  r.appendChild(m.barre);
  r.appendChild(smEl("span", "sm-jour-n", m.lib));
  return r;
}

function rendreMeteo(d, z){
  var s = section("Météo de la classe");
  s.appendChild(smEl("p", "sous-hint", "L'humeur répondue à l'appel : ☀️ en forme · 🌤 ça va · 🌧 fatigué · ⛈ perdu."));
  var jours = d.meteo || [];
  if (!jours.length) s.appendChild(smEl("p", "sous-hint", "Aucun appel cette semaine."));
  jours.forEach(function(j){ s.appendChild(ligneJour(j)); });

  // Depuis la rentrée : la classe jour par jour, et chaque étudiant appel
  // par appel. Lu à la demande — c'est la lecture lente.
  var det = smEl("details", "plie-in sm-longue");
  det.appendChild(smEl("summary", "", "Depuis la rentrée, et élève par élève"));
  var corps = smEl("div", "");
  det.appendChild(corps);
  det.addEventListener("toggle", function(){
    if (!det.open || corps.childNodes.length) return;
    corps.appendChild(smEl("p", "sous-hint", "Chargement…"));
    sb.rpc("meteo_classe", { p_classe_id: Number(classe) }).then(function(r){
      corps.innerHTML = "";
      var m = r && !r.error && r.data;
      if (!m || !m.ok) { corps.appendChild(smEl("p", "sous-hint", "Indisponible.")); return; }
      longue = m;
      rendreMeteoLongue(m, corps);
    });
  });
  s.appendChild(det);
  z.appendChild(s);
}

function rendreMeteoLongue(m, corps){
  (m.jours || []).slice().reverse().forEach(function(j){ corps.appendChild(ligneJour(j)); });
  var jours = (m.jours || []).map(function(j){ return j.jour; });
  if (!jours.length) return;
  var g = smEl("div", "sm-grille-meteo");
  (m.eleves || []).forEach(function(x){
    var h = x.humeurs || {};
    var l = smEl("div", "sm-gm-l");
    l.appendChild(smEl("span", "pa-num", x.numero));
    // Les douze derniers jours d'appel, du plus ancien au plus récent :
    // une tendance se lit de gauche à droite.
    l.appendChild(smEl("span", "sm-gm-h", jours.slice(-12).map(function(j){
      return METEO[h[j]] || "·"; }).join(" ")));
    var n = jours.filter(function(j){ return h[j] === "C" || h[j] === "D"; }).length;
    if (n >= 2) l.appendChild(smEl("span", "vg-r g-a_suivre", n + " fois fatigué ou perdu"));
    g.appendChild(l);
  });
  corps.appendChild(smEl("p", "sous-hint", "Élève par élève, les douze derniers appels (· : pas de réponse)."));
  corps.appendChild(g);
}

// ── 8. Les séances jouées ──
function rendreSeances(d, z){
  var l = d.seances || [];
  var s = section("Les séances jouées", l.length);
  if (!l.length) s.appendChild(smEl("p", "sous-hint", "Aucune séance démarrée cette semaine. " +
    "Les TP de projet ne se « démarrent » pas : ils se lisent dans Projets."));
  l.forEach(function(x){
    var r = smEl("div", "sm-seance");
    r.appendChild(smEl("span", "sm-s-t", dateFr(x.jour) + " · " + x.numero + " — " + typo(x.titre)));
    var mesure = [];
    mesure.push(x.actifs + " actif" + (x.actifs > 1 ? "s" : ""));
    if (x.avancement !== null && x.avancement !== undefined) mesure.push("avancement " + x.avancement + " %");
    if (x.reussite !== null && x.reussite !== undefined) mesure.push("réussite " + x.reussite + " %");
    r.appendChild(smEl("span", "sm-s-m", mesure.join(" · ")));
    s.appendChild(r);
  });
  z.appendChild(s);
}

function rendreSemaine(d){
  $("sm-periode").textContent = (d.en_cours ? "Cette semaine — " : "Semaine du ") +
    dateFr(d.du) + " → " + dateFr(d.au);
  $("b-sm-suiv").disabled = !!d.en_cours;
  var z = $("sm-corps");
  z.innerHTML = "";
  z.appendChild(rendreChiffres(d));
  rendreEleves(d, z);
  rendreConcepts(d, z);
  rendreTrajectoires(d, z);
  rendreHors(d, z);
  rendreMeteo(d, z);
  rendreSeances(d, z);
}

// ── Le texte à copier ──
function texteSemaine(d){
  var c = d.classe || {}, p = d.precedente || {};
  var L = [];
  L.push(codeClasseSm() + " — semaine du " + dateFr(d.du, true) + " au " + dateFr(d.au, true));
  L.push("Présence " + (c.presence !== null && c.presence !== undefined ? c.presence + " %" : "—") +
    (p.presence !== null && p.presence !== undefined ? " (semaine d'avant " + p.presence + " %)" : "") +
    " · réussite " + (c.reussite !== null && c.reussite !== undefined ? c.reussite + " %" : "—") +
    (p.reussite !== null && p.reussite !== undefined ? " (" + p.reussite + " %)" : "") +
    " · " + (c.hors || 0) + " réponses hors séance (" + (c.actifs_hors || 0) + " étudiants)");
  var ar = (d.eleves || []).filter(function(x){ return (x.raisons || []).length; });
  L.push("");
  L.push("À revoir lundi (" + ar.length + ")");
  ar.forEach(function(x){
    L.push("- " + quiSm(x) + (x.nouveau ? " [nouveau]" : "") + " : " +
      x.raisons.map(function(r){ return r.texte; }).join(" ; "));
  });
  var bien = (d.eleves || []).filter(function(x){ return (x.progres || []).length; });
  if (bien.length) {
    L.push("");
    L.push("En progrès (" + bien.length + ")");
    bien.forEach(function(x){ L.push("- " + quiSm(x) + " : " + x.progres.join(" ; ")); });
  }
  if ((d.concepts || []).length) {
    L.push("");
    L.push("Notions à reprendre");
    d.concepts.forEach(function(k){ L.push("- " + k.intitule + " (séance " + k.seance + ", " + k.taux + " %)"); });
  }
  (d.trajectoires || []).forEach(function(m){
    var tard = (m.eleves || []).filter(function(x){ return x.statut === "decroche" || x.statut === "retard"; });
    L.push("");
    L.push(m.titre + " — " + m.total + " jalons, attendu " + Math.round(m.attendu) + " à cette date" +
      (tard.length ? " ; en retard : " + tard.map(function(x){ return quiSm(x) + " (" + x.faits + ")"; }).join(", ") : ""));
  });
  return L.join("\n");
}

export { chargerSemaine, rendreSemaine, texteSemaine };
