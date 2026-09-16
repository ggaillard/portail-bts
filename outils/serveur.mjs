// ── Un serveur statique, le plus bête possible ────────────────────────────
//
//     node outils/serveur.mjs          # puis http://127.0.0.1:8080
//     node outils/serveur.mjs 3000 .
//
// Deux usages, et c'est le même besoin :
//
//   · les contrôles (t_appel, t_revision, t_pilotage, comparer) ouvrent
//     désormais le portail PAR SON ADRESSE, comme GitHub Pages le sert, au
//     lieu de lui injecter son propre HTML réécrit à coups d'expressions
//     régulières. Un feuille de style liée en relatif ou un module importé ne
//     se résolvent pas autrement ;
//
//   · vous, en local. Depuis que le style est dans styles/ — et bientôt le
//     script dans js/ — ouvrir index.html par double-clic ne suffit plus pour
//     les modules : le navigateur refuse un import depuis file://. C'est le
//     seul vrai coût du découpage, et c'est la commande qui l'annule.
//
// Aucune dépendance, aucun réglage, aucun cache : il sert le dossier et rien
// d'autre, et refuse tout chemin qui sortirait de la racine.

import http from 'http';
import fs from 'fs';
import path from 'path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * `sousChemin` sert le dossier sous un préfixe, comme GitHub Pages le fait :
 * le portail est publié sur ggaillard.github.io/portail-bts/ et non à la
 * racine du domaine. Un chemin absolu écrit quelque part dans la page ne se
 * verrait pas en local et casserait en production — servir à la racine, c'est
 * tester une situation qui n'existe pas.
 */
export function servir(racine = process.cwd(), port = 0, sousChemin = '/') {
  const base = path.resolve(racine);
  const prefixe = sousChemin.endsWith('/') ? sousChemin : sousChemin + '/';
  const srv = http.createServer((q, r) => {
    let chemin = decodeURIComponent((q.url || '/').split('?')[0]);
    if (prefixe !== '/') {
      if (!chemin.startsWith(prefixe)) { r.writeHead(404); return r.end('hors préfixe : ' + chemin); }
      chemin = chemin.slice(prefixe.length - 1);
    }
    if (chemin.endsWith('/')) chemin += 'index.html';
    const f = path.resolve(base, '.' + chemin);
    // Un chemin qui remonte hors de la racine n'est pas une requête à servir.
    if (f !== base && !f.startsWith(base + path.sep)) {
      r.writeHead(403); return r.end('hors racine');
    }
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) {
      r.writeHead(404); return r.end('introuvable : ' + chemin);
    }
    r.writeHead(200, {
      'content-type': TYPES[path.extname(f)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    r.end(fs.readFileSync(f));
  });
  return new Promise((ok) => {
    srv.listen(port, '127.0.0.1', () => {
      ok({ url: `http://127.0.0.1:${srv.address().port}${prefixe}`, fermer: () => srv.close() });
    });
  });
}

// Lancé directement : on reste en écoute et on annonce l'adresse.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2]) || 8080;
  const racine = process.argv[3] || process.cwd();
  const { url } = await servir(racine, port);
  console.log(`  ${path.resolve(racine)}`);
  console.log(`  servi sur ${url}`);
  console.log('  Ctrl+C pour arrêter.');
}
