#!/usr/bin/env node
// ── Le mode classe répond-il encore à ses boutons ? ───────────────────────
//
//     node outils/t_ecran.mjs        # depuis la racine du dépôt
//
// Ce contrôle est né avec l'étape A5. Sortir les 591 lignes du mode classe
// dans js/ecran.js déplace aussi le branchement de ses neuf boutons : ils
// étaient câblés au premier niveau du script, ils le sont désormais dans
// brancherEcran(), appelée une fois au démarrage. Si cet appel disparaissait,
// ou arrivait trop tôt, l'écran s'afficherait parfaitement et ne répondrait à
// rien — et outils/comparer.mjs, qui ne fait que mesurer des boîtes, le
// trouverait identique au pixel près.
//
// C'est le trou exact qu'ouvre un découpage : le gabarit tient, le câblage
// est parti. On clique donc, et on regarde où va la vue.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();

// La forme que rendreEcran() attend — celle que chargerStats() lui passe.
// Les noms viennent de la fonction elle-même, pas d'une supposition : `lignes`
// est la liste des élèves (id, avatar, n, ok, pct, ev, serie), `questions`
// celle des questions triées par difficulté.
const AVA = ['🦊', '🐢', '🦉', '🐙', '🦁', '🐺', '🦄', '🐝'];
const STATS = {
  inscrits: 31, actifs: 19, reponses: 143, reussite: 64, total: 10,
  lignes: AVA.map((a, i) => ({
    id: i + 1, avatar: a, n: 10 - i, ok: 8 - i,
    pct: Math.round((8 - i) / Math.max(1, 10 - i) * 100), ev: true, serie: i % 3 })),
  questions: Array.from({ length: 10 }, (_, i) => ({
    nom: 'Question ' + (i + 1), n: 20 - i, ok: 6 + i, texte: 'Énoncé ' + (i + 1),
    pct: Math.round((6 + i) / (20 - i) * 100),
    // La vue « Répartition » lit q.choix : sans lui elle échoue sur
    // Object.keys(undefined). Vérifié avant et après le découpage — le manque
    // était dans le jeu d'essai, pas dans le portail.
    choix: { A: 3 + i, B: 6 + i, C: 2, D: 1, juste: 'B' } })),
};

const rates = [];
const nav = await chromium.launch();
const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 1280 });

const r = await p.evaluate((STATS) => {
  const e = window.__e;
  if (typeof e.modeEcran !== 'function') return { manque: 'modeEcran' };

  // L'écran se pilote par des boutons : on les cherche dans la page, on
  // clique, et on lit ce que la vue est devenue. Aucun appel direct.
  const ecran = document.getElementById('classe-ecran');
  ecran.hidden = false;
  e.suivi.ecran = true;
  e.suivi.stats = STATS;
  // Deux dictionnaires que chargerStats() initialise en vrai : sans eux, c'est
  // le jeu d'essai qui est incomplet, pas le portail qui est cassé.
  e.suivi.series = {};
  e.suivi.precedent = {};
  e.suivi.classeId = 1;
  e.suivi.titre = 'Séance 2';
  e.modeEcran('prog');

  const vues = [];
  for (const [id, attendu] of [['ce-clas', 'clas'], ['ce-rep-b', 'rep'],
                               ['ce-par-b', 'par'], ['ce-deb-b', 'deb'],
                               ['ce-prog', 'prog']]) {
    const b = document.getElementById(id);
    if (!b) { vues.push([id, 'BOUTON ABSENT']); continue; }
    b.click();
    vues.push([id, e.suivi.vue, attendu]);
  }

  // Le son et le minuteur ont leur propre bouton, et leur propre état.
  const avantSon = !!e.suivi.son;
  const bs = document.getElementById('ce-son');
  if (bs) bs.click();
  const apresSon = !!e.suivi.son;

  // Échap ferme l'écran : c'est un écouteur de document, pas un bouton, et
  // c'est le plus facile à oublier en déplaçant du code.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  return {
    vues, avantSon, apresSon,
    ferme: document.getElementById('classe-ecran').hidden === true || e.suivi.ecran === false,
    visibles: [...document.querySelectorAll('#classe-ecran .ce-btn')].length,
  };
}, STATS);

if (r.manque) {
  rates.push(`${r.manque} n'est pas accessible : le module de l'écran n'a pas été importé`);
} else {
  console.log('\n   boutons de vue      :', r.visibles);
  for (const [id, obtenu, attendu] of r.vues) {
    console.log(`   clic sur ${id.padEnd(10)}: suivi.vue = ${JSON.stringify(obtenu)}` +
                (attendu ? ` (attendu ${JSON.stringify(attendu)})` : ''));
    if (obtenu !== attendu) {
      rates.push(`le bouton ${id} ne change pas la vue — obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
    }
  }
  console.log('   bouton du son       :', r.avantSon, '->', r.apresSon);
  console.log('   Échap ferme l\'écran :', r.ferme ? 'oui' : 'NON');
  if (r.avantSon === r.apresSon) rates.push('le bouton « Son » ne bascule rien — son écouteur n\'est pas branché');
  if (!r.ferme) rates.push('Échap ne ferme plus l\'écran projeté — l\'écouteur de document n\'est pas branché');
  if (r.visibles < 6) rates.push(`${r.visibles} boutons dans l'écran projeté, attendu au moins 6`);
}
if (erreurs.length) rates.push('erreur JS — ' + erreurs[0]);

await fermer();
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ Le mode classe change de vue, bascule le son et se ferme');
console.log('    à Échap : son câblage a suivi son code.');
