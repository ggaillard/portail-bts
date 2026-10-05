// ── Ouvrir, fermer, montrer une séance — un seul chemin, trois écrans ────
//
// Depuis le 05/10. Relevé ce jour-là sur le portail en service : les séances
// IA 1 et IA 2 du BTS2, créées « fermées et non publiées » par leur
// migration, ne pouvaient pas être ouvertes depuis En cours. Le pré-vol
// disait « Séance fermée — les étudiants ne peuvent plus rien valider », mais
//   · ses boutons sont masqués (`#prevol > .pick`, depuis le lot « le direct »),
//   · l'action de l'en-tête était cachée pour TOUT projet (« un projet reste
//     ouvert ») — y compris pour celui qu'on n'avait jamais ouvert,
//   · et la zone des chiffres renvoyait à l'éditeur SQL de Supabase.
// Le seul chemin passait par Préparer → la classe → Modifier → deux cases →
// Enregistrer : six gestes, et rien sur l'écran du direct pour le dire.
//
// Ce module porte les trois gestes, et une lecture, pour les trois écrans qui
// en ont besoin (le pré-vol, l'en-tête de la séance, la liste de Préparer) :
//
//   · OUVRIR — publier ET ouvrir, sans toucher au chrono. Pas
//     demarrer_seance() : elle horodate `demarree_le`, et une séance « ouverte
//     et démarrée » est ce qu'En cours prend pour l'heure en train de se jouer
//     — un projet ouvert pour cinq semaines le deviendrait pour cinq semaines.
//     On relit la ligne en base, puis enregistrer_seance() la réécrit à
//     l'identique, publiee et ouverte exceptées. Relire juste avant d'écrire,
//     plutôt que réutiliser une liste chargée plus tôt : une échéance corrigée
//     entre-temps dans Préparer serait sinon remise à l'ancienne valeur.
//     Aucune migration : les trois fonctions existent déjà en base.
//   · FERMER — clore_seance(), la même que pour un cours : elle garde
//     `demarree_le` et refuse la séance d'appel (99).
//   · VISIBLE / CACHÉE — publier_seance(). Visible : les étudiants voient la
//     séance (ses missions, sa trace). Ouverte : ils peuvent y répondre ou
//     cocher. Deux colonnes, deux gestes — voir « Publiée, ouverte » dans
//     CLAUDE.md.
//
// La lecture : une séance de cours OUBLIÉE OUVERTE — démarrée il y a plus
// que sa durée plus deux heures, et jamais close. C'est la règle même
// d'a_faire() (« Séance N encore ouverte ») : l'en-tête et « Ce qui bloque »
// doivent dire la même chose de la même séance. Le 05/10, la séance 3 du BTS1
// l'était depuis 121 h, et l'en-tête affichait « En cours · 7294 / 55 min ».

import { sb } from './socle.js';
import { texteRefus, estRefus } from './refus.js';

var MARGE_OUBLI_MIN = 120;

// `s` est une ligne de `seances` (numero) ou un pré-vol (seance) : les deux
// noms désignent le numéro.
function seanceOubliee(s, maintenant){
  if (!s || (s.nature || "cours") !== "cours" || !s.ouverte || !s.demarree_le) return false;
  var numero = Number(s.numero !== undefined && s.numero !== null ? s.numero : s.seance);
  if (numero >= 90) return false;            // questionnaires et appel : ouverts par nature
  var ecoule = ((maintenant || Date.now()) - Date.parse(s.demarree_le)) / 60000;
  return ecoule > (Number(s.duree_min) || 55) + MARGE_OUBLI_MIN;
}

// 12 min · 5 h · 5 j — « 7294 min » ne se lit pas.
function dureeLisible(min){
  min = Math.max(0, Math.round(Number(min) || 0));
  if (min < 90) return min + " min";
  if (min < 36 * 60) return Math.round(min / 60) + " h";
  return Math.round(min / 1440) + " j";
}

function depuisLe(iso, maintenant){
  return dureeLisible(((maintenant || Date.now()) - Date.parse(iso)) / 60000);
}

function reponseGeste(r){
  if (estRefus(r)) return { ok: false, detail: texteRefus(r) };
  return r.data;
}

function ouvrirSeance(id){
  return sb.from("seances")
    .select("id,classe_id,numero,titre,nature,jalons,echeance,duree_min,publiee,ouverte")
    .eq("id", Number(id))
    .then(function(r){
      var s = r && !r.error && r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
      if (!s) return { ok: false, detail: "Séance introuvable en base : rechargez la page." };
      if (Number(s.numero) >= 90) return reponseGeste({ data: { ok: false, motif: "numero" } });
      return sb.rpc("enregistrer_seance", {
        p_seance_id: Number(s.id),
        p_classe_id: Number(s.classe_id),
        p_numero:    Number(s.numero),
        p_titre:     s.titre,
        p_nature:    s.nature || "cours",
        p_jalons:    s.jalons ? Number(s.jalons) : 0,
        p_echeance:  s.echeance ? String(s.echeance).slice(0, 10) : null,
        p_duree_min: s.duree_min === null || s.duree_min === undefined ? null : Number(s.duree_min),
        p_publiee:   true,
        p_ouverte:   true
      }).then(reponseGeste);
    }, function(){ return { ok: false, detail: "La base ne répond pas. Réessayez dans un instant." }; });
}

function fermerSeance(id){
  return sb.rpc("clore_seance", { p_seance_id: Number(id) }).then(reponseGeste);
}

function montrerSeance(id, visible){
  return sb.rpc("publier_seance", { p_seance_id: Number(id), p_publiee: !!visible }).then(reponseGeste);
}

export { seanceOubliee, dureeLisible, depuisLe, ouvrirSeance, fermerSeance, montrerSeance };
