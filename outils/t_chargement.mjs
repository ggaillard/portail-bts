#!/usr/bin/env node
// ── La page s'ouvre-t-elle, tout simplement ? ─────────────────────────────
//
//     node outils/t_chargement.mjs        # depuis la racine du dépôt
//
// Rien ne vérifiait cela. t_appel, t_revision et t_pilotage mesurent des
// écrans, mais ils poussent eux-mêmes les données dans la page : un portail
// qui ne charge ni son style ni son script les laisserait parfaitement verts.
//
// La question devient sérieuse depuis que le portail n'est plus un fichier :
// dix feuilles et un module à aller chercher, chacun par une adresse qui peut
// se tromper. Et surtout, GitHub Pages ne publie PAS à la racine d'un
// domaine — le portail vit sous ggaillard.github.io/portail-bts/. Un chemin
// écrit « /styles/socle.css » au lieu de « styles/socle.css » marcherait en
// local et rendrait la page nue en production. Ce contrôle sert donc le dépôt
// sous un préfixe, comme là-bas.
//
// Trois exigences :
//   · aucune requête en échec, et aucune erreur dans la console ;
//   · le module s'est bien EXÉCUTÉ — une feuille chargée ne prouve rien du
//     script, et un module muet est précisément ce qu'on risque ici ;
//   · les types MIME sont ceux d'un serveur normal : un .js servi en
//     text/plain est refusé par le navigateur pour un module, silencieusement
//     du point de vue de la page.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const SOUS = '/portail-bts/';

const rates = [];
const nav = await chromium.launch();
const { page, erreurs, reseau, fermer } = await ouvrir(nav, RACINE, { sousChemin: SOUS });

const r = await page.evaluate(() => ({
  feuilles: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href')),
  // Une feuille dont on peut lire les règles est une feuille qui est arrivée.
  regles: [...document.styleSheets].reduce((n, f) => {
    try { return n + f.cssRules.length; } catch (e) { return n; } }, 0),
  // Posé par outils/portail.mjs à la toute fin du script : s'il est là, le
  // module a été chargé, analysé ET exécuté jusqu'au bout.
  moduleExecute: typeof window.__e === 'object' && window.__e !== null,
  fonctions: Object.entries(window.__e || {}).filter(([, v]) => v !== undefined).length,
  // Une couleur de fond qui vient de socle.css : la preuve que le style
  // s'applique, pas seulement qu'il a été téléchargé.
  fond: getComputedStyle(document.body).backgroundColor,
  chemins: [...document.querySelectorAll('link[href], script[src]')]
    .map((e) => e.getAttribute('href') || e.getAttribute('src'))
    .filter((h) => h && h.startsWith('/')),
}));

const local = reseau.filter((x) => x.url.includes(SOUS));
const echecs = local.filter((x) => x.statut === 0 || x.statut >= 400);
const jsServis = local.filter((x) => x.url.endsWith('.js'));
const cssServis = local.filter((x) => x.url.endsWith('.css'));

console.log(`\n── servi sous ${SOUS}, comme GitHub Pages\n`);
console.log('   requêtes locales   :', local.length, '·', echecs.length, 'en échec');
console.log('   feuilles liées     :', r.feuilles.filter((h) => !h.startsWith('http')).length,
            '· règles lues :', r.regles);
console.log('   fond du corps      :', r.fond);
console.log('   module exécuté     :', r.moduleExecute ? 'oui' : 'NON', '·', r.fonctions, 'fonctions');
console.log('   types MIME         :', [...new Set([...jsServis, ...cssServis].map((x) => x.type))].join(' · '));
console.log('   erreurs            :', erreurs.length ? erreurs[0] : 'aucune');

for (const e of echecs) {
  rates.push(`${e.url.split(SOUS)[1] || e.url} : ${e.echec || 'statut ' + e.statut}`);
}
if (!r.moduleExecute) {
  rates.push("le module ne s'est pas exécuté — la page s'affiche, et rien ne répond. " +
             "C'est exactement la panne qu'un contrôle d'écran ne voit pas.");
}
if (r.regles < 400) rates.push(`seulement ${r.regles} règles CSS lisibles : une feuille manque à l'appel`);
if (r.fond === 'rgba(0, 0, 0, 0)') rates.push('le corps n\'a pas de fond : socle.css ne s\'applique pas');
if (r.chemins.length) {
  rates.push(`chemin(s) absolu(s) dans la page — ${r.chemins.join(', ')} — ils viseront la racine du ` +
             `domaine, pas ${SOUS}, et la page sera nue en production`);
}
for (const x of jsServis) {
  if (!/javascript|ecmascript/.test(x.type)) {
    rates.push(`${x.url.split(SOUS)[1]} servi en « ${x.type} » : un navigateur refuse d'exécuter un module ainsi`);
  }
}
for (const x of cssServis) {
  if (!/text\/css/.test(x.type)) rates.push(`${x.url.split(SOUS)[1]} servi en « ${x.type} »`);
}
if (erreurs.length) rates.push('erreur au chargement — ' + erreurs[0]);

await fermer();
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ Sous un préfixe comme en production : tout arrive, le style');
console.log('    s\'applique, et le module s\'exécute jusqu\'au bout.');
