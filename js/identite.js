// ═══════════════════════════════════════════════════════════════════════════
//  VÉRIFICATION D'IDENTITÉ À UNE SÉANCE — nom et prénom (14/11/2026)
//
//  Quand une séance l'exige (seances.identite_exigee), l'étudiant connecté
//  tape son nom et son prénom avant tout le reste. L'enseignant voit, dans la
//  carte d'appel, ce que chaque numéro a déclaré, comparé à SA liste
//  numéro → nom, qui reste dans son navigateur (lireNoms / nomDe).
//
//  Les saisies sont effacées en base à la clôture de la séance, et au plus
//  tard 24 h après (migration 20261114100000_identite_seance.sql).
//
//  Côté étudiant, tout échec technique LAISSE PASSER : une vérification qui
//  enferme la classe dehors ferait plus de dégâts que celle qu'elle évite.
//  Le numéro qui n'a rien déclaré apparaît alors « non déclaré » chez
//  l'enseignant, et la fiche papier reste là.
// ═══════════════════════════════════════════════════════════════════════════

import { $, sb, nomDe, copierTexte } from './socle.js';

// ── Côté étudiant ──────────────────────────────────────────────────────────
function verifierIdentiteEtu(apres){
  var fini = false;
  function suite(){ if (fini) return; fini = true; montrerLeReste(true); apres(); }

  sb.rpc("identite_requise").then(function(r){
    if (!r || r.error || !r.data || !r.data.requise || r.data.faite) { suite(); return; }
    afficherCarte(suite);
  }, suite);
}

function montrerLeReste(oui){
  var esp = $("espace-etu");
  Array.prototype.forEach.call(esp.children, function(x){
    if (x.classList.contains("ident") || x.id === "bloc-identite") return;
    if (oui) { if (x.dataset.cacheIdentite) { x.hidden = false; delete x.dataset.cacheIdentite; } }
    else if (!x.hidden) { x.hidden = true; x.dataset.cacheIdentite = "1"; }
  });
  var c = $("bloc-identite");
  if (oui && c) c.remove();
}

function afficherCarte(suite){
  montrerLeReste(false);
  var esp = $("espace-etu");
  var c = document.createElement("form");
  c.className = "card";
  c.id = "bloc-identite";
  c.innerHTML =
    '<h2>Vérification d\'identité</h2>' +
    '<p class="hint">Pour cette séance, votre enseignant vérifie que chaque compte est ' +
    'utilisé par son titulaire. Écrivez votre <b>NOM</b> puis votre <b>Prénom</b>, ' +
    'comme sur la liste de la classe. Ils seront effacés à la fin de la séance.</p>' +
    '<div class="field"><label for="id-saisie">Nom et prénom</label>' +
    '<input id="id-saisie" autocomplete="off" maxlength="80" placeholder="DUPONT Camille" required></div>' +
    '<div aria-live="polite" id="err-identite" class="err"></div>' +
    '<button class="btn" type="submit" id="b-identite">Valider</button>';
  var ident = esp.querySelector(".ident");
  esp.insertBefore(c, ident ? ident.nextSibling : esp.firstChild);

  c.addEventListener("submit", function(e){
    e.preventDefault();
    var b = $("b-identite"), z = $("err-identite");
    var v = $("id-saisie").value.trim().replace(/\s+/g, " ");
    if (v.length < 3 || v.indexOf(" ") < 0) {
      z.textContent = "Écrivez votre nom ET votre prénom, séparés par un espace."; return;
    }
    b.disabled = true; b.textContent = "Envoi…";
    sb.rpc("declarer_identite", { p_saisie: v }).then(function(r){
      b.disabled = false; b.textContent = "Valider";
      if (r && !r.error && r.data && r.data.ok) { suite(); return; }
      // Le serveur a refusé la saisie : on le dit et on reste sur la carte.
      if (r && r.data && r.data.motif) { z.textContent = r.data.motif; return; }
      // Panne technique : on laisse passer (voir l'en-tête).
      suite();
    }, function(){ suite(); });
  });
  var champ = $("id-saisie");
  if (champ) champ.focus();
}

// ── Côté enseignant ────────────────────────────────────────────────────────
// « Dupont  jean-PAUL » et « JEAN PAUL DUPONT » doivent se reconnaître : on
// compare des ensembles de mots, sans accents ni casse, et on accepte que la
// saisie contienne un mot de plus (un second prénom).
function mots(t){
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
}
function concorde(attendu, saisi){
  var a = mots(attendu), s = mots(saisi);
  if (!a.length || !s.length) return null;
  return a.every(function(m){ return s.indexOf(m) >= 0; });
}

function blocIdentitesClasse(bloc, c){
  sb.rpc("identites_classe", { p_classe_id: Number(c.id) }).then(function(r){
    var d = r && !r.error && r.data && r.data.ok ? r.data : null;
    if (!d || !d.seance) return;
    var liste = d.liste || [];
    var ecarts = [], absents = [], ok = 0, sansListe = 0;
    liste.forEach(function(x){
      var att = nomDe(c.code, x.numero);
      if (!x.saisie) { absents.push(x); return; }
      var v = concorde(att, x.saisie);
      if (v === null) sansListe++;
      if (v === true && (x.saisies || 1) === 1) ok++;
      else if (v !== null) ecarts.push({ x: x, att: att, v: v });
    });

    var det = document.createElement("details");
    det.className = "ac-identite";
    det.open = ecarts.length > 0;
    var som = document.createElement("summary");
    som.textContent = "Identités — séance " + d.seance.numero + " : " + ok + " conformes, " +
      ecarts.length + " à vérifier, " + absents.length + " non déclarées";
    det.appendChild(som);

    function ligne(txt, cls){
      var p = document.createElement("p"); p.className = cls || ""; p.textContent = txt;
      det.appendChild(p); return p;
    }
    if (sansListe) ligne("Liste des noms absente de ce navigateur : collez-la dans « Noms » pour comparer.", "ac-q");
    ecarts.forEach(function(e){
      var t = e.x.numero + " — déclaré : « " + e.x.saisie + " » · attendu : " + (e.att || "?") +
              " · " + e.x.heure + (e.v ? "" : " · NE CORRESPOND PAS") +
              ((e.x.saisies || 1) > 1 ? " · modifié " + (e.x.saisies - 1) + " fois" : "");
      ligne(t, "ac-ecart");
    });
    if (absents.length) {
      ligne("Non déclarés : " + absents.map(function(x){
        var n = nomDe(c.code, x.numero); return x.numero + (n ? " " + n : "");
      }).join(" · "), "ac-q");
    }
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-sec"; b.textContent = "Copier les écarts";
    b.addEventListener("click", function(){
      var txt = [c.nom || c.code, "Identités séance " + d.seance.numero]
        .concat(ecarts.map(function(e){ return e.x.numero + " déclaré « " + e.x.saisie + " », attendu " + (e.att || "?"); }))
        .concat(absents.length ? ["Non déclarés : " + absents.map(function(x){ return x.numero; }).join(", ")] : [])
        .join("\n");
      copierTexte(txt).then(function(okc){ b.textContent = okc ? "Copié" : "Copie refusée"; });
    });
    det.appendChild(b);
    ligne("Les saisies sont effacées à la clôture de la séance : copiez les écarts avant.", "hint");
    bloc.appendChild(det);
  });
}

export { verifierIdentiteEtu, blocIdentitesClasse, concorde };
