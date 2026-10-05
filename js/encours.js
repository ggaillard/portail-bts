// ── En cours : ouvrir sur la séance du jour ───────────────────────────────
//
// Jusqu'au 28/09, le suivi s'ouvrait sur la PREMIÈRE séance de la PREMIÈRE
// classe — la séance 1 du BTS1, fermée depuis trois semaines. On refaisait
// deux choix à chaque ouverture pour trouver celle qu'on était en train de
// faire. L'onglet s'appelle maintenant « En cours » : il doit l'être.
//
// L'ordre de préférence, parmi les séances de cours et de projet (< 90) des
// classes réelles :
//   1. une séance OUVERTE ET DÉMARRÉE — l'heure en train de se jouer ;
//   2. une séance démarrée AUJOURD'HUI (déjà close : on la relit) ;
//   3. la PROCHAINE SÉANCE DE COURS à jouer : publiée ou contrôle proposé, pas
//      encore démarrée — la plus petite par classe, celle de la classe qui a
//      joué le plus récemment ;
//   4. sinon la dernière DÉMARRÉE ;
//   5. sinon la première classe, comme avant.
// Le 30/09, « ouverte » seule suffisait : or un PROJET reste ouvert toute
// l'année (les TP du BTS2 le sont tous, sans jamais avoir été démarrés).
// En cours s'ouvrait donc sur un TP du BTS2 le matin de la séance 3 du BTS1,
// et le questionnaire qu'on cherchait n'était pas sur cet écran-là.
// Le 05/10, même défaut par l'autre bout : la séance 3 du BTS1, démarrée le
// 30/09 et jamais close, restait « ouverte et démarrée » — En cours s'ouvrait
// dessus cinq jours de suite, chrono à 7 294 minutes. La règle 1 ne retient
// donc qu'une séance de COURS qui n'est pas OUBLIÉE OUVERTE (durée + 2 h,
// la règle d'a_faire()) ; l'oubliée reste signalée par « Ce qui bloque ».
// Avant tout cela, l'ADRESSE : « #appel/s/123 » (un favori, un raccourci)
// désigne la séance à ouvrir, si elle existe dans une classe réelle.
// Le choix se refait à chaque ouverture de l'espace ; les sélecteurs restent
// là pour regarder une autre séance.

import { $, sb } from './socle.js';
import { chargerSeancesDe } from './seance.js';
import { seanceDeLAdresse } from './navigation.js';
import { seanceOubliee } from './ouverture.js';

function seanceDuJour(liste, idsReels, maintenant){
  var l = (liste || []).filter(function(s){
    return s.numero < 90 && idsReels.indexOf(String(s.classe_id)) >= 0;
  });
  var date = function(s){ return s.demarree_le ? Date.parse(s.demarree_le) : 0; };
  var recent = function(a, b){ return date(b) - date(a); };
  var jour = new Date(maintenant || Date.now()).toDateString();

  var enCours = l.filter(function(s){
    return (s.nature || "cours") === "cours" && s.ouverte && s.demarree_le &&
           !seanceOubliee(s, maintenant);
  }).sort(recent);
  if (enCours.length) return enCours[0];

  var duJour = l.filter(function(s){
    return s.demarree_le && new Date(s.demarree_le).toDateString() === jour; }).sort(recent);
  if (duJour.length) return duJour[0];

  var jouees = l.filter(function(s){ return s.demarree_le; }).sort(recent);

  // La prochaine séance de cours : prête à être jouée, pas encore jouée.
  var prochaines = l.filter(function(s){
    return (s.nature || "cours") === "cours" && !s.demarree_le && (s.publiee || s.controle_ouvert);
  });
  if (prochaines.length) {
    var derniereClasse = jouees.length ? String(jouees[0].classe_id) : null;
    prochaines.sort(function(a, b){
      var da = String(a.classe_id) === derniereClasse ? 0 : 1;
      var db = String(b.classe_id) === derniereClasse ? 0 : 1;
      return da - db || a.numero - b.numero;
    });
    return prochaines[0];
  }
  return jouees[0] || null;
}

function choisirSeanceDuJour(classes){
  if (!classes || !classes.length) return Promise.resolve(null);
  var ids = classes.map(function(c){ return String(c.id); });
  return sb.from("seances").select("id,classe_id,numero,ouverte,demarree_le,duree_min,nature,publiee,controle_ouvert")
    .then(function(r){
      var voulue = seanceDeLAdresse();
      var s = (voulue && (r && r.data || []).filter(function(x){
        return String(x.id) === voulue && ids.indexOf(String(x.classe_id)) >= 0; })[0]) ||
        seanceDuJour(r && r.data, ids);
      var classe = s ? s.classe_id : classes[0].id;
      var sel = $("pk-classe");
      if (sel) sel.value = String(classe);
      return chargerSeancesDe(classe, s ? s.id : null).then(function(){ return s; });
    }, function(){ return chargerSeancesDe(classes[0].id); });
}

export { choisirSeanceDuJour, seanceDuJour };
