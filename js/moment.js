// ── L'espace étudiant : « En ce moment », et le reste replié (03/11) ──────
//
// L'espace étudiant devenait trop long : chaque séance publiée y posait sa
// carte de missions, puis « Vos projets » listait tous les modules de la
// classe — huit au BTS2 — et la séance du jour se cherchait au milieu.
//
// Cette page range donc en trois étages, et rien d'autre :
//
//   1. EN CE MOMENT, en clair : la séance ouverte, ou prévue aujourd'hui
//      (plusieurs s'il le faut), avec les liens de son module. À défaut, la
//      prochaine séance prévue, annoncée comme telle.
//   2. LES SITUATIONS PROFESSIONNELLES, dans la même partie : chaque module
//      dont le titre commence par « SP » garde ses liens en vue, et ses
//      séances en dessous, repliées. Aucune classe n'est nommée ici : le
//      BTS1 n'a pas de SP, le bloc ne s'y affiche simplement pas.
//   3. TOUT LE RESTE, replié dans une seule carte : les autres modules, et
//      sous chacun ses séances passées ou à venir.
//
// Les cartes de missions sont fabriquées par missions.js et les blocs de
// module par modules.js ; cette page ne fait que les PLACER. Les deux
// lectures arrivent dans un ordre quelconque : chacune pose sa moitié, puis
// tout se replace. Une carte déplacée garde son état (cases, messages).
//
// Tant que la migration du 03/11 n'est pas passée, mes_missions() ne rend ni
// module_id ni prevue_le : « du moment » se réduit alors à « ouverte », et
// les autres séances se rangent ensemble sous « Les autres séances ».

import { $, typo } from './socle.js';

let seances = null;      // [{ d, carte }] — d tel que mes_missions() le rend
let modules = null;      // [{ m, bloc }]  — null tant que mes_modules() n'a rien dit
let modulesAPlacer = false;

function estSP(m){
  return /^\s*SP\b/i.test(m.titre || "") || /^sp-/i.test(m.code || "");
}

function memeJour(iso, ref){
  if (!iso) return false;
  var d = new Date(iso);
  return !isNaN(d) && d.getFullYear() === ref.getFullYear() &&
         d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function duMoment(d, maintenant){
  return !!d.ouverte || memeJour(d.prevue_le, maintenant);
}

// La séance du moment et, faute de mieux, la prochaine prévue.
function trier(maintenant){
  var moment = [], prochaine = null;
  (seances || []).forEach(function(s){
    if (duMoment(s.d, maintenant)) { moment.push(s); return; }
    var t = s.d.prevue_le ? new Date(s.d.prevue_le) : null;
    if (t && !isNaN(t) && t > maintenant &&
        (!prochaine || t < new Date(prochaine.d.prevue_le))) prochaine = s;
  });
  return { moment: moment, prochaine: moment.length ? null : prochaine };
}

function moduleDe(d){
  if (!modules || d.module_id == null) return null;
  for (var i = 0; i < modules.length; i++) {
    if (String(modules[i].m.id) === String(d.module_id)) return modules[i];
  }
  return null;
}

// Les liens du module, en ligne, sous la carte de la séance du moment : on
// ouvre le cours ou le dépôt sans aller les chercher plus bas.
function liensCourts(m){
  var p = document.createElement("p");
  p.className = "mo-liens";
  var nom = document.createElement("span");
  nom.className = "mo-mod";
  nom.textContent = (m.icone ? m.icone + " " : "") + typo(m.titre);
  p.appendChild(nom);
  if (m.site) p.appendChild(lien(m.site, "Le cours en ligne"));
  if (m.depot) p.appendChild(lien(m.depot, "Le dépôt GitHub"));
  return p;
}

function lien(url, texte){
  var a = document.createElement("a");
  a.className = "btn btn-sec mo-lien";
  a.href = url;
  a.textContent = texte;
  return a;
}

function pli(texte, n){
  var det = document.createElement("details");
  det.className = "plie-in mo-seances";
  var s = document.createElement("summary");
  s.textContent = texte + " (" + n + ")";
  det.appendChild(s);
  return det;
}

function jourLong(iso){
  var d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// Le bouton « Ouvrir la séance » d'une carte de cours : la page de la séance
// sur le site du module, seulement quand la séance est ouverte.
function brancherOuvrir(s, mod){
  var b = s.carte.querySelector(".mo-ouvrir");
  if (!b) return;
  var ok = !!(s.d.ouverte && mod && mod.m.site);
  b.hidden = !ok;
  if (ok) {
    var n = String(s.d.numero);
    b.href = mod.m.site.replace(/\/?$/, "/") + "seances/seance-" + (n.length < 2 ? "0" + n : n) + "/";
  }
}

function placerEspace(){
  var zm = $("missions-etu"), zsp = $("sp-etu"), zr = $("mes-projets"),
      zau = $("seances-autres"), reste = $("reste-etu");
  if (!zm) return;
  var maintenant = new Date();
  var t = trier(maintenant);

  // 1. En ce moment.
  zm.innerHTML = "";
  t.moment.forEach(function(s){
    zm.appendChild(s.carte);
    var mod = moduleDe(s.d);
    brancherOuvrir(s, mod);
    if (mod && !estSP(mod.m)) zm.appendChild(liensCourts(mod.m));
  });
  if (t.prochaine) {
    var p = document.createElement("p");
    p.className = "hint mo-vide";
    p.textContent = "Aucune séance ouverte pour l'instant. Prochaine séance : " +
                    jourLong(t.prochaine.d.prevue_le) + ".";
    zm.appendChild(p);
    zm.appendChild(t.prochaine.carte);
    var modP = moduleDe(t.prochaine.d);
    if (modP && !estSP(modP.m)) zm.appendChild(liensCourts(modP.m));
  } else if (!t.moment.length && seances) {
    var v = document.createElement("p");
    v.className = "hint mo-vide";
    v.textContent = "Aucune séance ouverte pour l'instant. Vos modules et les autres " +
                    "séances sont rangés plus bas.";
    zm.appendChild(v);
  }
  var enVue = t.moment.concat(t.prochaine ? [t.prochaine] : []);
  var ailleurs = (seances || []).filter(function(s){ return enVue.indexOf(s) < 0; });

  // 2 et 3. Les modules, et sous chacun ses séances repliées.
  var sansModule = [];
  var parModule = {};
  ailleurs.forEach(function(s){
    var mod = moduleDe(s.d);
    if (!mod) { sansModule.push(s); return; }
    (parModule[mod.m.id] = parModule[mod.m.id] || []).push(s);
  });

  if (zsp) zsp.innerHTML = "";
  var nbSP = 0, nbAutres = 0;
  if (modules && modulesAPlacer) {
    zr.innerHTML = "";
    zr.classList.add("md-etu");
    modules.forEach(function(x){
      var b = x.bloc;
      var ancien = b.querySelector(":scope > .mo-seances");
      if (ancien) b.removeChild(ancien);
      var liste = parModule[x.m.id] || [];
      if (liste.length) {
        var det = pli(estSP(x.m) ? "Les séances de la situation" : "Les séances du module", liste.length);
        liste.forEach(function(s){ det.appendChild(s.carte); });
        b.appendChild(det);
      }
      if (estSP(x.m) && zsp) { zsp.appendChild(b); nbSP++; }
      else { zr.appendChild(b); nbAutres++; }
    });
  }
  if (zsp) {
    if (nbSP) {
      var h = document.createElement("h3");
      h.className = "mo-sp-titre";
      h.textContent = nbSP > 1 ? "Vos situations professionnelles" : "Votre situation professionnelle";
      zsp.insertBefore(h, zsp.firstChild);
    }
    zsp.hidden = !nbSP;
  }

  if (zau) {
    zau.innerHTML = "";
    if (sansModule.length) {
      var hs = document.createElement("h3");
      hs.className = "md-titre";
      hs.textContent = "Les autres séances";
      zau.appendChild(hs);
      sansModule.forEach(function(s){ zau.appendChild(s.carte); });
    }
  }

  // Le repli dit ce qu'il cache : sans cela, une carte fermée se lit comme
  // une carte vide.
  if (reste) {
    var nbSeances = ailleurs.length - (modules ? ailleurs.filter(function(s){
      var mod = moduleDe(s.d); return mod && estSP(mod.m); }).length : 0);
    var bouts = [];
    if (nbAutres) bouts.push(nbAutres + (nbAutres > 1 ? " modules" : " module"));
    if (nbSeances) bouts.push(nbSeances + (nbSeances > 1 ? " séances" : " séance"));
    var c = $("reste-compte");
    if (c) c.textContent = bouts.length ? bouts.join(" · ") : "";
  }
}

// Appelée par missions.js : `cartes` est la liste [{ d, carte }].
function poserSeances(cartes){
  seances = cartes || [];
  placerEspace();
}

// Appelée par modules.js : `blocs` est la liste [{ m, bloc }], ou null quand
// mes_modules() n'a rien rendu et que « Vos projets » s'est replié sur la
// table `projets` — la zone appartient alors à ce repli, on n'y touche pas.
function poserModules(blocs){
  modules = blocs || [];
  modulesAPlacer = !!blocs;
  placerEspace();
}

export { poserSeances, poserModules, estSP, duMoment };
