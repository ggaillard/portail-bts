// ── Les questions au fil de l'heure, côté enseignant (03/11) ──────────────
//
// Besoin : « des questions tout le long de la séance, pour le suivi, pour
// voir l'évaluation et pour faire de l'auto-évaluation ». Les questions vivent
// dans la trace (blocs `!!! fil`, clés fNN) ; chacune est suivie d'une
// certitude (fNN-c). fil_seance() croise les deux comme controle_seance() le
// fait pour le contrôle d'entrée : cette carte réutilise donc SA ligne
// (ligneControle) — mêmes jauges, même alerte « se trompe en étant sûr ».
//
// En plus, la seule chose qui compte pendant l'heure : où en est chacun. Les
// numéros sont rangés par nombre de questions faites, le prénom collé quand
// le navigateur le connaît (jamais en base).
//
// Elle suit la boucle de huit secondes du direct (rafraichir) : une question
// au fil se répond toutes les cinq minutes, il faut la voir arriver.

import { $, sb, suivi, typo, codeClasseCourante, nomDe, prenomSeul } from './socle.js';
import { ligneControle } from './controle.js';

var enCours = false;

function chargerFil(){
  var bloc = $("bloc-fil");
  if (!bloc) return;
  if (!suivi.seanceId || (suivi.prevol && Number(suivi.prevol.seance) >= 90)) { bloc.hidden = true; return; }
  if (enCours) return;
  enCours = true;
  var vise = String(suivi.seanceId);
  sb.rpc("fil_seance", { p_seance_id: Number(suivi.seanceId) }).then(function(r){
    enCours = false;
    if (String(suivi.seanceId) !== vise) return;
    // Fonction pas déployée, ou séance sans question au fil : rien.
    if (!r || r.error || !r.data || !r.data.ok || !r.data.questions) { bloc.hidden = true; return; }
    rendreFil(r.data);
    bloc.hidden = false;
  }, function(){ enCours = false; });
}

function rendreFil(d){
  var total = Number(d.questions) || 0;
  var eleves = d.eleves || [];
  var finis = eleves.filter(function(e){ return Number(e.faites) >= total; }).length;
  var partis = eleves.filter(function(e){ return Number(e.faites) > 0; }).length;
  $("fil-resume").textContent = total + " questions dans la trace · " + partis + " / " +
    (d.inscrits || eleves.length) + " ont commencé · " + finis + " les ont toutes faites";

  // L'avancement : un groupe par nombre de questions faites, du plus en
  // retard au plus avancé. Ceux qui n'ont rien fait d'abord.
  var z = $("fil-avance");
  z.innerHTML = "";
  var code = codeClasseCourante();
  for (var n = 0; n <= total; n++) {
    var ici = eleves.filter(function(e){ return Number(e.faites) === n; });
    if (!ici.length) continue;
    var p = document.createElement("p");
    p.className = "fil-groupe" + (n === 0 ? " fil-zero" : (n >= total ? " fil-fini" : ""));
    var t = document.createElement("b");
    t.textContent = (n >= total ? "Toutes" : n + " / " + total) + " · ";
    p.appendChild(t);
    p.appendChild(document.createTextNode(ici.map(function(e){
      var nom = nomDe(code, e.numero);
      return e.numero + (nom ? " " + prenomSeul(nom) : "");
    }).join("   ")));
    z.appendChild(p);
  }

  var l = $("fil-lignes");
  l.innerHTML = "";
  (d.lignes || []).forEach(function(x){
    var ligne = ligneControle(x);
    var i = ligne.querySelector(".ct-i");
    if (i) i.textContent = x.cle.replace(/^f0?/, "Q") + " · " + typo(x.intitule || x.cle);
    l.appendChild(ligne);
  });
}

export { chargerFil };
