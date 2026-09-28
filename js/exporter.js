// ── Exporter : un CSV qu'un tableur ouvre sans question ───────────────────
//
// Point-virgule (le séparateur qu'attend un Excel français), BOM UTF-8 (sans
// lui, « Méca Forez » s'ouvre en « MÃ©ca Forez »), guillemets doublés. Le
// fichier est fabriqué dans la page et ne part nulle part : les prénoms
// locaux qu'il peut contenir restent sur cet appareil, comme partout.

function cellule(v){
  if (v === null || v === undefined) return "";
  var t = String(v), q = String.fromCharCode(34);
  // Le guillemet s'écrit par son code : écrit en toutes lettres dans une
  // expression régulière, il égare le contrôle du workflow qui retire les
  // chaînes avant de chercher les fonctions appelées.
  var special = t.indexOf(q) >= 0 || t.indexOf(";") >= 0 || t.indexOf("\n") >= 0 || t.indexOf("\r") >= 0;
  return special ? q + t.split(q).join(q + q) + q : t;
}

function versCsv(lignes){
  return "﻿" + lignes.map(function(l){ return l.map(cellule).join(";"); }).join("\r\n");
}

function telechargerCsv(nom, lignes){
  // Une adresse data: plutôt qu'un Blob : rien à libérer ensuite, et un
  // CSV de classe (quelques ko) y tient sans peine.
  var a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(versCsv(lignes));
  a.download = nom.replace(/[^\w.\-]+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export { versCsv, telechargerCsv };
