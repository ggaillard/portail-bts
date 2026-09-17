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

// ── Où vit le code ────────────────────────────────────────────────────────
// Avant l'étape A2, tout était dans index.html, entre <style> et <script>.
// Après, dans styles/ et js/. Ce contrôle doit continuer à mesurer LA MÊME
// CHOSE des deux côtés du découpage, sinon ses chiffres ne se comparent plus
// à rien — et il se tairait en beauté le jour où il ne trouverait plus le
// script.
const brut = lire('index.html');
const src = brut.split('\n');
const nbLignes = (t) => t.split('\n').length;

const feuillesDe = (dossier, ext) => existe(dossier)
  ? fs.readdirSync(path.join(RACINE, dossier)).filter((f) => f.endsWith(ext)).sort()
      .map((f) => ({ nom: `${dossier}/${f}`, t: lire(path.join(dossier, f)) }))
  : [];

const FCSS = feuillesDe('styles', '.css');
const FJS  = feuillesDe('js', '.js');

const morceau = (ouvrant, fermant) => {
  const a = brut.indexOf(ouvrant), b = brut.indexOf(fermant);
  return a < 0 || b < 0 ? '' : brut.slice(a, b);
};

const css = { texte: FCSS.length ? FCSS.map((f) => f.t).join('\n') : morceau('<style', '</style>') };
const js  = { texte: FJS.length  ? FJS.map((f) => f.t).join('\n')  : morceau('\n<script>', '</script>') };
if (!js.texte.trim()) {
  console.error("  ✗ mesurer.mjs ne trouve plus le script du portail : ni js/*.js, ni bloc <script>.");
  process.exit(1);
}
css.lignes = css.texte ? nbLignes(css.texte) : 0;
js.lignes = nbLignes(js.texte);

// ── Les mesures ───────────────────────────────────────────────────────────
const tousLes = (re, s) => (s.match(re) || []).length;

// Un commentaire CSS peut citer une media query ou une var() pour expliquer ce
// qu'on a corrigé — la table des seuils le fait, et elle donne l'exemple de ce
// qui ne marche pas. Compter ces citations comme du code ferait échouer le
// contrôle sur sa propre documentation. On mesure donc le CSS sans ses
// commentaires, et on ne lit la table « @seuil » que dans le texte brut.
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const cssNet = sansCommentaires(css.texte);

const fonctions = [...js.texte.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)];
const longueurs = fonctions.map((m, i) => {
  const fin = i + 1 < fonctions.length ? fonctions[i + 1].index : js.texte.length;
  return { nom: m[1], lignes: js.texte.slice(m.index, fin).split('\n').length - 1 };
}).sort((x, y) => y.lignes - x.lignes);
const mediane = [...longueurs].sort((a, b) => a.lignes - b.lignes)[longueurs.length >> 1].lignes;

const seuils = [...cssNet.matchAll(/@media[^{]+/g)].map((m) => m[0].trim());
const classes = new Set([...cssNet.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const varsDef = new Set([...cssNet.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const varsUse = new Set([...cssNet.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
const rpcs = new Set([...js.texte.matchAll(/rpc\(\s*["']([\w_]+)["']/g)].map((m) => m[1]));

const m = {
  'lignes de index.html':        src.length - (src[src.length - 1] === '' ? 1 : 0),
  'feuilles de style':           FCSS.length,
  'modules':                     FJS.length,
  'lignes de CSS':               css.lignes,
  'lignes de JavaScript':        js.lignes,
  'règles CSS':                  tousLes(/^[^@\s][^{]*\{/gm, cssNet),
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

// ── L'état attendu aujourd'hui, celui que REFONTE.md décrit ───────────────
// Quand une valeur bouge parce que le plan avance, on met à jour les DEUX :
// cette table et le document. C'est le point : ils ne peuvent plus diverger
// en silence.
// Reprise automatiquement depuis « --libre » à chaque étape franchie : ce
// n'est pas une table à tenir à la main, c'est la photo du dépôt le jour où
// l'on a mis REFONTE.md d'accord avec lui.
const ATTENDU = {
  'lignes de index.html': 509,
  'feuilles de style': 10,
  'modules': 6,
  'lignes de CSS': 1065,
  'lignes de JavaScript': 4790,
  'règles CSS': 473,
  'classes CSS': 299,
  'variables CSS définies': 17,
  'variables CSS inutilisées': 0,
  'var() jamais déclarées': 0,
  'media queries': 12,
  'seuils distincts': 8,
  'fonctions de premier niveau': 147,
  'médiane des fonctions': 22,
  'plus longue fonction': 246,
  'fonctions RPC appelées': 35,
  'innerHTML =': 113,
  'textContent =': 216,
  'createElement': 162,
  'onclick= en chaîne': 0,
  'aria-live': 19,
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
        .map((f) => ({ ou: `styles/${f}`, t: sansCommentaires(lire(path.join('styles', f))) }))
    : [{ ou: 'index.html', t: cssNet }];
  const tout = feuilles.map((f) => f.t).join('\n');
  const dec = new Set([...tout.matchAll(/(--[\w-]+)\s*:/g)].map((x) => x[1]));
  for (const f of feuilles) {
    for (const x of f.t.matchAll(/var\((--[\w-]+)/g)) {
      if (!dec.has(x[1])) fautes.push(`${f.ou} : var(${x[1]}) n'est déclarée nulle part — la valeur de repli s'applique dans les deux thèmes (§3.7)`);
    }
  }
}

// 1. Un module, un sujet, un plafond (§6.1).
//
//    Le plafond était 400 lignes dans la première écriture du plan. Chiffre
//    posé au jugé, avant d'avoir sorti le moindre module : le premier, le mode
//    classe, en fait 646 d'un seul tenant, et il est parfaitement cohérent —
//    treize fonctions, quatre portes d'entrée, un seul sujet. Le découper pour
//    satisfaire un nombre que personne n'avait mesuré aurait produit deux
//    fichiers qu'il faut ouvrir ensemble, ce qui est exactement le défaut
//    qu'on corrige. Le plafond est donc 700, et il ne sert pas à viser : il
//    sert à ce qu'aucun module ne redevienne un app.js sans qu'on le voie.
//
//    Pendant le découpage, app.js reste au-dessus par construction. Il est
//    déclaré dans REFONTE.md avec sa taille du jour : il a le droit d'être
//    gros, il n'a pas le droit de GROSSIR. La dette est écrite, datée, et elle
//    ne peut que diminuer.
const PLAFOND = 700;
if (FJS.length) {
  const chantier = new Map(
    [...lire('REFONTE.md').matchAll(/@chantier\s+(\S+)\s+(\d+)/g)].map((x) => [x[1], Number(x[2])]));
  console.log('\n  modules :');
  for (const f of FJS) {
    const n = nbLignes(f.t);
    const plafondDit = chantier.has(f.nom) ? `en découpage, ≤ ${chantier.get(f.nom)}` : `≤ ${PLAFOND}`;
    console.log('    ' + f.nom.replace('js/', '').padEnd(large - 2) + '  ' +
                String(n).padStart(5) + '   (' + plafondDit + ')');
    if (chantier.has(f.nom)) {
      if (n > chantier.get(f.nom)) {
        fautes.push(`${f.nom} passe de ${chantier.get(f.nom)} à ${n} lignes : un module en cours ` +
                    `de découpage ne grossit pas. Sortez-en quelque chose, ou corrigez la ligne ` +
                    `« @chantier » de REFONTE.md si la hausse est voulue et expliquée.`);
      }
    } else if (n > PLAFOND) {
      fautes.push(`${f.nom} fait ${n} lignes, plafond ${PLAFOND} (§6.1) — à découper, ` +
                  `ou à déclarer « @chantier » dans REFONTE.md avec la raison`);
    }
  }
}

// 2. Un seul jeu de seuils de rupture, celui que déclare la table « @seuil ».
//
//    Le plan annonçait des variables CSS. Essayé, et faux : « @media
//    (max-width: var(--x)) » ne s'applique jamais — mesuré, une page où seule
//    la version littérale prend effet. Les custom properties ne sont pas
//    évaluées dans une media query, et @custom-media n'est implémenté nulle
//    part. Ce qui reste possible sans outil de compilation, c'est de déclarer
//    la liste une fois et de refuser tout ce qui n'y figure pas. Le contrôle
//    ne remplace donc rien : il empêche d'ajouter un onzième seuil sans s'en
//    apercevoir, ce qui était exactement le défaut.
{
  const brut = existe('styles')
    ? fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))
        .map((f) => lire(path.join('styles', f))).join('\n')
    : css.texte;
  const feuilles = existe('styles')
    ? fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))
        .map((f) => ({ ou: `styles/${f}`, t: sansCommentaires(lire(path.join('styles', f))) }))
    : [{ ou: 'index.html', t: cssNet }];

  const table = [...brut.matchAll(/@seuil\s+(\S+)\s+\(([^)]+)\)/g)]
    .map((x) => ({ nom: x[1], q: x[2].replace(/\s+/g, ' ').trim() }));
  if (!table.length) {
    fautes.push('aucune table « @seuil » trouvée : la liste des seuils doit être déclarée en commentaire, une fois (§6.2)');
  } else {
    console.log('\n  seuils déclarés :', table.map((x) => `${x.nom} ${x.q}`).join(' · '));
    const permis = new Set(table.map((x) => x.q));
    for (const f of feuilles) {
      for (const m of f.t.matchAll(/@media\s*\(([^)]+)\)/g)) {
        const q = m[1].replace(/\s+/g, ' ').trim();
        // Les requêtes de préférence ne sont pas des seuils de largeur.
        if (/prefers-/.test(q)) continue;
        if (!permis.has(q)) {
          fautes.push(`${f.ou} : seuil « ${q} » absent de la table @seuil — ` +
                      `ajoutez-le là-bas, avec ce qu'il gouverne, ou utilisez-en un existant (§6.2)`);
        }
      }
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
