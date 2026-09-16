#!/usr/bin/env node
// ── Recompter ce que REFONTE.md affirme ───────────────────────────────────
//
//     node outils/mesurer.mjs          # depuis la racine du dépôt
//     node outils/mesurer.mjs --libre  # affiche sans comparer
//
// Un audit vieillit. Celui-ci a été écrit le 16/09/2026 sur un index.html de
// 5 847 lignes ; si on ne fait rien, ses chiffres seront faux dans un mois et
// personne ne le saura — un document qui se trompe avec assurance est pire
// qu'un document absent. Ce fichier recompte chaque mesure citée et échoue
// quand elle a bougé, avec l'ancienne et la nouvelle valeur. Ce n'est pas un
// garde-fou contre le changement : les chiffres DOIVENT bouger, c'est le but
// du plan. C'est un rappel de mettre le document à jour en même temps.
//
// Il vérifie aussi les règles du §6 qui se mesurent : la taille des modules,
// et l'absence de seuil de rupture écrit en dur.

import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : process.cwd();
const LIBRE = process.argv.includes('--libre');

const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');
const existe = (p) => fs.existsSync(path.join(RACINE, p));

// ── Découper index.html en ses trois parties ──────────────────────────────
const brut = lire('index.html');
const src = brut.split('\n');
const ligneDe = (i) => brut.slice(0, i).split('\n').length;

const css = (() => {
  const a = brut.indexOf('<style'), b = brut.indexOf('</style>');
  return { debut: ligneDe(a), fin: ligneDe(b), texte: brut.slice(a, b) };
})();
const js = (() => {
  const a = brut.indexOf('\n<script>'), b = brut.lastIndexOf('</script>');
  return { debut: ligneDe(a) + 1, fin: ligneDe(b), texte: brut.slice(a, b) };
})();

// ── Les mesures ───────────────────────────────────────────────────────────
const tousLes = (re, s) => (s.match(re) || []).length;

const fonctions = [...js.texte.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)];
const longueurs = fonctions.map((m, i) => {
  const fin = i + 1 < fonctions.length ? fonctions[i + 1].index : js.texte.length;
  return { nom: m[1], lignes: js.texte.slice(m.index, fin).split('\n').length - 1 };
}).sort((x, y) => y.lignes - x.lignes);
const mediane = [...longueurs].sort((a, b) => a.lignes - b.lignes)[longueurs.length >> 1].lignes;

const seuils = [...css.texte.matchAll(/@media[^{]+/g)].map((m) => m[0].trim());
const classes = new Set([...css.texte.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const varsDef = new Set([...css.texte.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const varsUse = new Set([...css.texte.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
const rpcs = new Set([...js.texte.matchAll(/rpc\(\s*["']([\w_]+)["']/g)].map((m) => m[1]));

const m = {
  'lignes de index.html':        src.length - (src[src.length - 1] === '' ? 1 : 0),
  'lignes de CSS':               css.fin - css.debut,
  'lignes de JavaScript':        js.fin - js.debut,
  'règles CSS':                  tousLes(/^[^@\s][^{]*\{/gm, css.texte),
  'classes CSS':                 classes.size,
  'variables CSS définies':      varsDef.size,
  'variables CSS inutilisées':   [...varsDef].filter((v) => !varsUse.has(v)).length,
  'var() jamais déclarées':      [...varsUse].filter((v) => !varsDef.has(v)).length,
  'media queries':               seuils.length,
  'seuils distincts':            new Set(seuils.map((s) => s.replace(/\s+/g, ''))).size,
  'fonctions de premier niveau': fonctions.length,
  'médiane des fonctions':       mediane,
  'plus longue fonction':        longueurs[0].lignes,
  'fonctions RPC appelées':      rpcs.size,
  'innerHTML =':                 tousLes(/\.innerHTML\s*=/g, js.texte),
  'textContent =':               tousLes(/\.textContent\s*=/g, js.texte),
  'createElement':               tousLes(/createElement\(/g, js.texte),
  'onclick= en chaîne':          tousLes(/onclick=/g, brut),
  'aria-live':                   tousLes(/aria-live/g, brut),
};

// ── Ce que REFONTE.md affirmait le 16/09/2026 ─────────────────────────────
// Quand une valeur bouge parce que le plan avance, on met à jour les DEUX :
// cette table et le document. C'est le point : ils ne peuvent plus diverger
// en silence.
const ATTENDU = {
  'lignes de index.html': 5847, 'lignes de CSS': 890, 'lignes de JavaScript': 4499,
  'règles CSS': 476, 'classes CSS': 299, 'variables CSS définies': 17,
  'variables CSS inutilisées': 0, 'var() jamais déclarées': 0, 'media queries': 13, 'seuils distincts': 10,
  'fonctions de premier niveau': 146, 'médiane des fonctions': 22,
  'plus longue fonction': 248, 'fonctions RPC appelées': 35,
  'innerHTML =': 114, 'textContent =': 215, 'createElement': 161,
  'onclick= en chaîne': 0, 'aria-live': 0,
};

const large = Math.max(...Object.keys(m).map((k) => k.length));
const ecarts = [];
for (const [k, v] of Object.entries(m)) {
  const a = ATTENDU[k];
  const drift = !LIBRE && a !== undefined && a !== v;
  console.log('  ' + k.padEnd(large) + '  ' + String(v).padStart(5) +
              (drift ? `   (REFONTE.md dit ${a})` : ''));
  if (drift) ecarts.push(`${k} : ${a} -> ${v}`);
}

// ── Les règles du §6 qui se mesurent ──────────────────────────────────────
const fautes = [];

// 0. Une var() sans déclaration ne casse pas la page : sa valeur de repli
//    s'applique en silence, dans les deux thèmes, et le texte devient
//    illisible à un endroit sans que rien ne le signale. C'est ainsi que
//    --surface-2 a traversé le portail (§3.7). Tant que le CSS est dans
//    index.html on regarde là ; après A2, dans styles/.
{
  const feuilles = existe('styles')
    ? fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))
        .map((f) => ({ ou: `styles/${f}`, t: lire(path.join('styles', f)) }))
    : [{ ou: 'index.html', t: css.texte }];
  const tout = feuilles.map((f) => f.t).join('\n');
  const dec = new Set([...tout.matchAll(/(--[\w-]+)\s*:/g)].map((x) => x[1]));
  for (const f of feuilles) {
    for (const x of f.t.matchAll(/var\((--[\w-]+)/g)) {
      if (!dec.has(x[1])) fautes.push(`${f.ou} : var(${x[1]}) n'est déclarée nulle part — la valeur de repli s'applique dans les deux thèmes (§3.7)`);
    }
  }
}

// 1. Un module, 400 lignes au plus. Tant que js/ n'existe pas, rien à dire :
//    la règle naît avec le découpage, elle ne condamne pas l'état actuel.
if (existe('js')) {
  console.log('\n  modules :');
  for (const f of fs.readdirSync(path.join(RACINE, 'js')).filter((x) => x.endsWith('.js'))) {
    const n = lire(path.join('js', f)).split('\n').length;
    console.log('    ' + f.padEnd(large - 2) + '  ' + String(n).padStart(5));
    if (n > 400) fautes.push(`js/${f} fait ${n} lignes, plafond 400 (§6.1) — à découper`);
  }
}

// 2. Aucun seuil de rupture en dur une fois styles/socle.css en place.
if (existe('styles/socle.css')) {
  const nommes = [...lire('styles/socle.css').matchAll(/(--seuil-[\w-]+)\s*:/g)].map((x) => x[1]);
  console.log('\n  seuils nommés :', nommes.join(', ') || 'aucun');
  for (const f of fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))) {
    for (const q of lire(path.join('styles', f)).match(/@media[^{]+/g) || []) {
      if (!/var\(--seuil-/.test(q)) fautes.push(`styles/${f} : seuil en dur — ${q.trim()} (§6.2)`);
    }
  }
}

console.log();
if (ecarts.length) {
  console.log('  ✗ REFONTE.md ne décrit plus le dépôt :');
  ecarts.forEach((x) => console.log('      ' + x));
  console.log('    Mettez à jour le document ET la table ATTENDU de ce fichier.');
}
fautes.forEach((x) => console.log('  ✗ ' + x));
if (ecarts.length || fautes.length) process.exit(1);
console.log('  ✓ Les chiffres de REFONTE.md sont ceux du dépôt, et les règles');
console.log('    mesurables du §6 sont tenues.');
