// ── En cours : ouvrir sur la séance du jour ───────────────────────────────
//
// Jusqu'au 28/09, le suivi s'ouvrait sur la PREMIÈRE séance de la PREMIÈRE
// classe — la séance 1 du BTS1, fermée depuis trois semaines. On refaisait
// deux choix à chaque ouverture pour trouver celle qu'on était en train de
// faire. L'onglet s'appelle maintenant « En cours » : il doit l'être.
//
// L'ordre de préférence, parmi les séances de cours et de projet (< 90) des
// classes réelles :
//   1. une séance OUVERTE — la plus récemment démarrée s'il y en a plusieurs ;
//   2. sinon la dernière DÉMARRÉE — c'est celle qu'on relit en fin d'heure ;
//   3. sinon la première classe, comme avant.
// Avant tout cela, l'ADRESSE : « #appel/s/123 » (un favori, un raccourci)
// désigne la séance à ouvrir, si elle existe dans une classe réelle.
// Le choix se refait à chaque ouverture de l'espace ; les sélecteurs restent
// là pour regarder une autre séance.

import { $, sb } from './socle.js';
import { chargerSeancesDe } from './seance.js';
import { seanceDeLAdresse } from './navigation.js';

function seanceDuJour(liste, idsReels){
  var l = (liste || []).filter(function(s){
    return s.numero < 90 && idsReels.indexOf(String(s.classe_id)) >= 0;
  });
  var date = function(s){ return s.demarree_le ? Date.parse(s.demarree_le) : 0; };
  var recent = function(a, b){ return date(b) - date(a); };
  var ouvertes = l.filter(function(s){ return s.ouverte; }).sort(recent);
  if (ouvertes.length) return ouvertes[0];
  var jouees = l.filter(function(s){ return s.demarree_le; }).sort(recent);
  return jouees[0] || null;
}

function choisirSeanceDuJour(classes){
  if (!classes || !classes.length) return Promise.resolve(null);
  var ids = classes.map(function(c){ return String(c.id); });
  return sb.from("seances").select("id,classe_id,numero,ouverte,demarree_le")
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
