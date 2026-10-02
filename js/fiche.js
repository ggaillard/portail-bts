// ── La fiche d'un élève ───────────────────────────────────────────────────
//
// Le panneau latéral des applications de suivi : on clique sur une ligne, la
// fiche s'ouvre par-dessus sans perdre la liste, Échap ou le fond la ferment.
// Elle répond aux trois questions qu'on se pose sur UN élève :
//
//   · vient-il ? — sa présence aux appels posés depuis la rentrée ;
//   · où en est-il ? — séance par séance, ce qu'il a fait et réussi ;
//   · et aujourd'hui ? — la séance suivie, mise en avant.
//
// Tout est calculé ici à partir des tables que l'enseignant lit déjà
// (eleves, seances, reponses, corriges) : aucune fonction nouvelle en base.
// Les mêmes règles de tri que partout ailleurs : le contrôle d'entrée
// (`pre-`) ne compte ni dans l'avancement ni dans la réussite, un jalon est
// une clé `tp…` à 'true', une humeur n'est jamais « juste ».
//
// Le prénom vient de la table locale (localStorage) : il n'entre jamais en
// base, et la fiche ne l'envoie nulle part.

import { $, sb, suivi, nomDe, prenomSeul } from './socle.js';

var ouverte = false, dernierFocus = null;

function compteDansReussite(r){
  if (/^humeur-|^appel-|^pre-/.test(r.question || "")) return false;
  return r.correct === true || r.correct === false || r.reponse === "ok" || r.reponse === "ko";
}
function estBonne(r){ return r.correct === true || r.reponse === "ok"; }
function estJalonFranchi(r){ return /^tp/.test(r.question || "") && (r.reponse === "true" || r.reponse === "ok"); }

function codeDe(classeId){
  var c = (suivi.classesConnues || []).filter(function(x){ return String(x.id) === String(classeId); })[0];
  return c ? c.code : "";
}

function ouvrirFiche(e){
  var f = $("fiche-eleve");
  if (!f) return Promise.resolve();
  dernierFocus = document.activeElement;
  var nom = nomDe(codeDe(e.classeId), e.numero);
  $("fe-titre").textContent = "Élève " + e.numero + (nom ? " — " + prenomSeul(nom) : "");
  $("fe-corps").innerHTML = '<div class="squelette"></div><div class="squelette"></div><div class="squelette court"></div>';
  f.hidden = false;
  document.body.classList.add("fiche-ouverte");
  ouverte = true;
  $("fe-fermer").focus();

  return Promise.all([
    sb.from("eleves").select("id,numero,avatar,vu_le,auth_id").eq("id", e.id),
    sb.from("seances").select("id,numero,titre,nature,jalons,module_id,demarree_le,publiee")
      .eq("classe_id", e.classeId).order("numero"),
    sb.from("reponses").select("seance_id,question,reponse,correct,updated_at").eq("eleve_id", e.id)
  ]).then(function(rr){
    var el = (rr[0].data || [])[0] || { numero: e.numero };
    var seances = rr[1].data || [];
    var reps = rr[2].data || [];
    var appel = seances.filter(function(s){ return s.numero === 99; })[0];
    // Les appels POSÉS : les questions « appel-AAAA-MM-JJ » de la séance 99.
    var q = appel ? sb.from("corriges").select("question").eq("seance_id", appel.id).like("question", "appel-%")
                  : Promise.resolve({ data: [] });
    return q.then(function(rc){
      if (!ouverte) return;
      rendreFiche(e, el, seances, reps, (rc.data || []).map(function(x){ return x.question; }));
    });
  });
}

function rendreFiche(e, el, seances, reps, appels){
  var z = $("fe-corps");
  z.innerHTML = "";
  var tete = document.createElement("div");
  tete.className = "fe-tete";
  tete.innerHTML = '<span class="fe-av"></span><span class="fe-meta"></span>';
  tete.querySelector(".fe-av").textContent = el.avatar || "•";
  tete.querySelector(".fe-meta").textContent = el.auth_id
    ? "Connecté" + (el.vu_le ? " — vu le " + new Date(el.vu_le).toLocaleDateString("fr-FR") : "")
    : "Ne s'est jamais connecté";
  z.appendChild(tete);

  // ── Présence ──
  var repondus = {};
  reps.forEach(function(r){ if (/^appel-/.test(r.question || "")) repondus[r.question] = true; });
  var poses = appels.slice().sort();
  var manques = poses.filter(function(a){ return !repondus[a]; });
  z.appendChild(bloc("Présence", poses.length
    ? (poses.length - manques.length) + " appel" + (poses.length - manques.length > 1 ? "s" : "") +
      " sur " + poses.length + (manques.length ? " · absent le " + manques.slice(-4).map(jour).join(", ") +
      (manques.length > 4 ? "…" : "") : " · toujours présent")
    : "Aucun appel posé pour l'instant.", !poses.length ? "" : (manques.length >= 2 ? "att" : (manques.length ? "" : "ok"))));

  // ── L'humeur, appel par appel (02/10) ──
  // La météo de l'élève : ce qu'il a répondu à « Comment ça va ? », du plus
  // ancien au plus récent — une tendance se lit de gauche à droite.
  var METEO = { A: "☀️", B: "🌤", C: "🌧", D: "⛈" };
  var humeurs = reps.filter(function(r){ return /^humeur-\d{4}-\d{2}-\d{2}$/.test(r.question || ""); })
    .sort(function(a, b){ return a.question < b.question ? -1 : 1; });
  if (humeurs.length) {
    var dur = humeurs.filter(function(r){ return /^[CD]/.test(r.reponse || ""); }).length;
    var bh = bloc("Humeur, appel par appel", (dur ? dur + " fois fatigué ou perdu sur " : "") +
      humeurs.length + " réponse" + (humeurs.length > 1 ? "s" : "") + " · ☀️ en forme · 🌤 ça va · 🌧 fatigué · ⛈ perdu",
      dur >= 2 ? "att" : "");
    var ligne = document.createElement("p");
    ligne.className = "fe-meteo";
    humeurs.slice(-14).forEach(function(r){
      var s = document.createElement("span");
      s.textContent = METEO[(r.reponse || "").charAt(0)] || "·";
      s.title = jour(r.question.slice(7));
      ligne.appendChild(s);
    });
    bh.appendChild(ligne);
    z.appendChild(bh);
  }

  // ── Séance par séance ──
  var par = {};
  reps.forEach(function(r){
    var p = par[r.seance_id] || (par[r.seance_id] = { n: 0, ev: 0, ok: 0, jal: 0, maj: null });
    if (/^appel-|^humeur-|^pre-/.test(r.question || "")) return;
    p.n++;
    if (estJalonFranchi(r)) p.jal++;
    if (compteDansReussite(r)) { p.ev++; if (estBonne(r)) p.ok++; }
    if (!p.maj || r.updated_at > p.maj) p.maj = r.updated_at;
  });
  var t = document.createElement("table");
  t.className = "fe-table";
  t.innerHTML = "<thead><tr><th>N°</th><th>Séance</th><th>Fait</th><th>Réussite</th></tr></thead><tbody></tbody>";
  var corps = t.querySelector("tbody");
  seances.filter(function(s){ return s.numero < 90 && (s.demarree_le || par[s.id]); })
    .forEach(function(s){
      var p = par[s.id] || { n: 0, ev: 0, ok: 0, jal: 0 };
      var tr = document.createElement("tr");
      if (String(s.id) === String(e.seanceId)) tr.className = "fe-courante";
      var fait = s.nature === "projet"
        ? p.jal + (s.jalons ? "/" + s.jalons : "") + " jalons"
        : (p.n ? p.n + " rép." : "—");
      var reu = p.ev ? Math.round(p.ok / p.ev * 100) : null;
      tr.innerHTML = "<td></td><td></td><td></td><td></td>";
      tr.children[0].textContent = s.numero;
      tr.children[1].textContent = s.titre;
      tr.children[2].textContent = fait;
      tr.children[3].textContent = reu === null ? "—" : reu + " %";
      if (!p.n) tr.classList.add("fe-rien");
      if (reu !== null) tr.children[3].className = reu >= 70 ? "ok" : (reu < 40 ? "ko" : "att");
      corps.appendChild(tr);
    });
  var b = bloc("Séance par séance", corps.children.length ? "" : "Aucune séance jouée pour l'instant.");
  if (corps.children.length) { var sc = document.createElement("div"); sc.className = "scroll"; sc.appendChild(t); b.appendChild(sc); }
  z.appendChild(b);
}

function jour(cle){
  var m = /(\d{4})-(\d{2})-(\d{2})/.exec(cle);
  return m ? m[3] + "/" + m[2] : cle;
}

function bloc(titre, texte, ton){
  var d = document.createElement("section");
  d.className = "fe-bloc";
  var h = document.createElement("h4");
  h.textContent = titre;
  d.appendChild(h);
  if (texte) {
    var p = document.createElement("p");
    p.className = "fe-txt" + (ton ? " " + ton : "");
    p.textContent = texte;
    d.appendChild(p);
  }
  return d;
}

function fermerFiche(){
  var f = $("fiche-eleve");
  if (!f || f.hidden) return;
  f.hidden = true;
  ouverte = false;
  document.body.classList.remove("fiche-ouverte");
  if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
}

function brancherFiche(){
  var f = $("fiche-eleve");
  if (!f || f.dataset.branche) return;
  f.dataset.branche = "oui";
  $("fe-fermer").addEventListener("click", fermerFiche);
  $("fe-fond").addEventListener("click", fermerFiche);
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && ouverte) fermerFiche(); });
}
brancherFiche();

export { ouvrirFiche, fermerFiche };
