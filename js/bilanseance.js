// ── Le bilan d'une séance : l'onglet Bilan de sa page ─────────────────────
//
// Lot 3 des propositions du 05/10 (06/10). Ce qu'une séance a été, relu
// après coup, d'un seul tenant : le prévu et le fait (le lot 2 a donné un
// créneau à chaque séance — on peut enfin comparer), l'appel du jour, qui a
// participé, le contrôle d'entrée, le résultat (réussite d'un cours,
// missions d'un projet), les concepts, ce qu'il faut reprendre, et ce que
// l'automate a fait de lui-même.
//
// Deux lectures, en parallèle : `bilan_seance()` (migration 20261006120000)
// et `debriefing()`, la même que la vue « Fin d'heure » — les seuils des
// concepts (75 / 45) restent à un seul endroit. Le compte rendu à copier
// reste sous « Fin d'heure » : un lien y mène.
//
// Mêmes règles que partout : des phrases, pas un score ; « — » plutôt que
// zéro quand rien n'a été mesuré ; aucun nom, des numéros (les prénoms
// restent dans le navigateur de l'enseignant).

import { sb, typo } from './socle.js';
import { quandLisible, heureDe, jourDe } from './etat.js';
import { texteRefus } from './refus.js';

var VERDICT = { acquis: ["ok", "acquis"], fragile: ["att", "fragile"], a_revoir: ["ko", "à revoir"],
                sans_mesure: ["neutre", "sans mesure"] };

function luBilan(r){ return r && !r.error && r.data && r.data.ok ? r.data : null; }

function rendreBilan(s, z, liens){
  if (!z) return Promise.resolve();
  z.innerHTML = '<span class="vh">Chargement…</span><span class="squelette"></span><span class="squelette court"></span>';
  var id = Number(s.id);
  return Promise.all([
    sb.rpc("bilan_seance", { p_seance_id: id }),
    sb.rpc("debriefing", { p_seance_id: id })
  ]).then(function(rr){
    var b = luBilan(rr[0]), d = luBilan(rr[1]);
    z.innerHTML = "";
    var h = document.createElement("h3");
    h.className = "sous-titre";
    h.textContent = "Bilan de la séance";
    z.appendChild(h);
    if (!b || !b.seance) {
      z.appendChild(phrase("Le bilan ne se lit pas encore : " + texteRefus(rr[0])));
      return;
    }
    var x = b.seance;
    var jouee = !!(x.demarree_le || b.reponses || x.ouverte);
    var dl = document.createElement("dl");
    dl.className = "sp-bilan-l";
    ligneBilan(dl, "Prévu", x.prevue_le ? quandLisible(x.prevue_le, x.fin_prevue) : "pas de créneau posé");
    ligneBilan(dl, "Fait", fait(x));
    if (!jouee) {
      z.appendChild(dl);
      z.appendChild(phrase("Rien à relire : la séance n'a pas encore été jouée. Le bilan se remplit après l'heure."));
      return;
    }
    if (b.appel) {
      ligneBilan(dl, "Appel", b.appel.pose
        ? b.appel.presents + " / " + b.inscrits + " présents" + (b.appel.absents.length
          ? " · absents : " + b.appel.absents.join(", ") : " · personne d'absent")
        : "pas d'appel posé ce jour-là (" + jourDe(b.appel.jour + "T12:00") + ")");
    }
    ligneBilan(dl, "Participation", b.participants + " / " + b.inscrits + " ont répondu ou coché" +
      (b.reponses ? " · " + b.reponses + " réponses en tout" : ""));
    if (b.controle && b.controle.notions) {
      ligneBilan(dl, "Contrôle d'entrée", b.controle.repondants + " / " + b.inscrits + " l'ont fait" +
        (b.controle.reussite === null ? "" : " · " + b.controle.reussite + " % juste"));
    }
    if (x.nature === "projet") {
      var m = b.missions || {};
      ligneBilan(dl, "Missions", m.declarees
        ? "médiane " + arrondi(m.mediane) + " / " + m.declarees + " · " + m.finis + (m.finis > 1 ? " ont" : " a") + " tout fini"
        : (d && d.jalons_franchis ? d.jalons_franchis + " jalons franchis" : "aucune mission déclarée"));
    } else if (d) {
      ligneBilan(dl, "Quiz", d.reussite === null || d.reussite === undefined ? "— (personne n'a répondu au quiz)"
        : d.reussite + " % juste · " + d.repondants + " ont répondu · " + d.questions + " questions");
    }
    if (b.journal && b.journal.length) {
      ligneBilan(dl, "L'automate", b.journal.map(function(j){
        if (j.note === "deja") return (j.geste === "ouvrir" ? "déjà ouverte" : "déjà close") + " à " + heureDe(j.fait_le) + " — rien fait";
        return (j.geste === "ouvrir" ? "ouverte" : "close") + " automatiquement " + quandLisible(j.fait_le);
      }).join(" · "));
    }
    z.appendChild(dl);

    if (d && d.concepts && d.concepts.length) {
      var h4 = document.createElement("h4");
      h4.className = "sp-bilan-t";
      h4.textContent = "Les concepts";
      z.appendChild(h4);
      var ul = document.createElement("ul");
      ul.className = "sp-concepts";
      d.concepts.forEach(function(c){
        var li = document.createElement("li");
        var v = VERDICT[c.verdict] || VERDICT.sans_mesure;
        var bd = document.createElement("span");
        bd.className = "badge " + v[0];
        bd.textContent = v[1] + (c.taux === null || c.taux === undefined ? "" : " · " + c.taux + " %");
        li.appendChild(bd);
        li.appendChild(document.createTextNode(" " + typo(c.intitule)));
        ul.appendChild(li);
      });
      z.appendChild(ul);
    }
    if (d && d.plus_ratees && d.plus_ratees.length) {
      var h5 = document.createElement("h4");
      h5.className = "sp-bilan-t";
      h5.textContent = "À reprendre en premier";
      z.appendChild(h5);
      var ol = document.createElement("ol");
      ol.className = "sp-reprendre";
      d.plus_ratees.forEach(function(q){
        var li = document.createElement("li");
        li.textContent = typo("Question " + q.numero + (q.intitule ? " — " + q.intitule : "") +
          " : " + q.taux + " % juste (" + q.justes + " / " + q.repondants + ")");
        ol.appendChild(li);
      });
      z.appendChild(ol);
    }

    var p = document.createElement("div");
    p.className = "pick";
    [["Le compte rendu à copier ›", liens && liens.compteRendu], ["Le carnet de la classe ›", liens && liens.carnet]]
      .forEach(function(x){
        if (!x[1]) return;
        var bt = document.createElement("button");
        bt.type = "button";
        bt.className = "btn btn-sec";
        bt.textContent = x[0];
        bt.addEventListener("click", x[1]);
        p.appendChild(bt);
      });
    z.appendChild(p);
  });
}

function fait(x){
  if (!x.demarree_le) {
    if (x.nature === "projet") return x.ouverte ? "ouvert" + (x.publiee ? "" : ", caché") : "fermé";
    return x.ouverte ? "ouverte sans avoir été démarrée" : "pas démarrée";
  }
  var t = "démarrée " + quandLisible(x.demarree_le);
  if (x.ecart_min !== null && x.ecart_min !== undefined) {
    var e = Number(x.ecart_min);
    t += Math.abs(e) < 3 ? ", à l'heure" : (e > 0 ? ", " + e + " min après l'heure prévue" : ", " + (-e) + " min avant l'heure prévue");
  }
  return t + (x.ouverte ? " · encore ouverte" : " · close");
}

function arrondi(n){
  if (n === null || n === undefined) return "—";
  return String(Math.round(Number(n) * 10) / 10).replace(".", ",");
}

function ligneBilan(dl, cle, valeur){
  var dt = document.createElement("dt");
  dt.textContent = cle;
  var dd = document.createElement("dd");
  dd.textContent = valeur;     // pas de typo() : elle couperait « 10:53 » en « 10 :53 »
  dl.appendChild(dt);
  dl.appendChild(dd);
}

function phrase(texte){
  var p = document.createElement("p");
  p.className = "sous-hint";
  p.textContent = texte;
  return p;
}

export { rendreBilan, fait };
