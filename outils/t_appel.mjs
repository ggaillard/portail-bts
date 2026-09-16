#!/usr/bin/env node
// ── La carte « Appel du jour », mesurée ────────────────────────────────────
//
//     npm i -g playwright && npx playwright install chromium
//     node outils/t_appel.mjs            # depuis la racine du dépôt
//
// L'appel est le geste de trente secondes du début d'heure. Sa carte a donc une
// contrainte qu'aucune autre n'a : ce qu'on vient y chercher — le compte et les
// numéros absents — doit tenir haut, et le reste ne doit pas le pousser vers le
// bas. Cela ne se juge pas à l'œil, cela se mesure : le 16/09 la carte faisait
// 1 399 px sur un téléphone pour deux classes, dont 266 px d'humeur et 92 px de
// question de repli répétée mot pour mot sous chaque classe.
//
// Ce contrôle mesure et refuse quatre choses :
//   · un débordement horizontal — la page ne défile jamais latéralement ;
//   · une cible tactile sous 44 px, **zone étendue comprise** : « Copier » fait
//     22 px à l'écran et 44 px sous le doigt grâce à un pseudo-élément, et un
//     contrôle qui ne regarderait que la boîte le déclarerait faux à tort ;
//   · une carte qui dépasse un plafond de hauteur à 390 px ;
//   · la question de repli répétée quand elle est identique partout.
//
// Il n'appelle pas la base : le portail est ouvert avec une fausse couche
// Supabase et les blocs sont remplis à la main. Ce qu'on vérifie ici est le
// gabarit, pas les données.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';
import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2] || process.cwd();
const PAGE = path.join(RACINE, 'index.html');

// Le plafond : deux classes, six et trois absents, sur un téléphone. Il est
// arbitraire — ce qui compte est qu'il ne remonte pas sans qu'on le décide.
const PLAFOND_390 = 1150;

const REPLI = 'Vous êtes là ? Choisissez « Présent » pour signaler votre arrivée.';

const jeu = (inscrits, absents, presents, intitule) => ({
  pose: true, intitule, inscrits, appels_poses: 6,
  absents: absents.map((n, i) => ({ numero: n, manquees: i < 2 ? 3 : 1, sur: 6, depuis: i === 0 ? 7 : 2 })),
  presents: Array.from({ length: presents }, (_, i) => ({
    numero: String(i + 1).padStart(2, '0'), avatar: '🦊',
    heure: '08:' + String(10 + i).padStart(2, '0'),
  })),
  humeur_options: ['😀 En forme', '🙂 Ça va', '😐 Fatigué', '😴 Difficile'],
  humeur: { A: 5, B: 9, C: 6, D: 2 },
});

const LARGEURS = [[360, 'petit téléphone'], [390, 'téléphone'],
                  [768, 'tablette'], [1280, 'bureau']];

const nav = await chromium.launch();
const rates = [];

for (const [w, nom] of LARGEURS) {
  // Le portail est servi et ouvert par son adresse, pas injecté : voir
  // outils/portail.mjs. C'est ce qui permet aux feuilles de styles/ et au
  // module de js/ de se résoudre, et ce qui fait que le portail mesuré ici est
  // exactement celui que GitHub Pages publiera.
  const { page: p, erreurs, police, fermer } = await ouvrir(nav, RACINE, { largeur: w });

  const r = await p.evaluate(({ j1, j2, j3 }) => {
    let e = document.getElementById('carte-appel');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.querySelectorAll('.volet').forEach((v) => { v.hidden = true; });
    document.getElementById('volet-appel').hidden = false;

    const z = document.getElementById('appel-classes');
    const mk = (c, a) => {
      const d = document.createElement('div');
      d.className = 'appel-classe';
      z.appendChild(d);
      window.__e.remplirAppelClasse(d, c, a);
    };
    const poser = (a, b) => {
      z.innerHTML = '';
      mk({ id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV' }, a);
      if (b) mk({ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }, b);
      window.__e.hisserQuestion();
    };
    const etat = () => ({
      hissee: !document.getElementById('ac-question').hidden,
      parClasse: [...z.querySelectorAll('.ac-q')].filter((q) => !q.hidden).length,
    });

    poser(j1, j2);           const memeQuestion = etat();
    poser(j1, j3);           const differentes  = etat();
    poser(j2, null);         const uneSeule     = etat();
    poser(j1, j2);           // on repose le cas courant pour les mesures

    // La zone tactile réelle : le bouton, ou son pseudo-élément quand il en
    // étend un. On mesure ce que le doigt atteint, pas ce que l'œil voit.
    const petits = [];
    document.querySelectorAll('#carte-appel button, #carte-appel summary').forEach((b) => {
      const q = b.getBoundingClientRect();
      if (!q.width) return;
      const st = getComputedStyle(b, '::after');
      let haut = q.height;
      if (st.content && st.content !== 'none' && st.position === 'absolute') {
        haut = q.height - (parseFloat(st.top) || 0) - (parseFloat(st.bottom) || 0);
      }
      if (haut < 44) petits.push(b.textContent.trim().slice(0, 32) + ' (' + Math.round(haut) + ' px)');
    });

    return {
      carte: Math.round(document.getElementById('carte-appel').getBoundingClientRect().height),
      colonnes: getComputedStyle(z).gridTemplateColumns.split(' ').length,
      memeQuestion, differentes, uneSeule, petits,
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, {
    j1: jeu(31, ['02', '07', '14', '19', '23', '28'], 25, REPLI),
    j2: jeu(13, ['03', '08', '11'], 10, REPLI),
    j3: jeu(13, ['03', '08', '11'], 10, 'Quel composant du SI avons-nous vu la dernière fois ?'),
  });

  console.log(`\n── ${nom} (${w} px) : ${r.colonnes} colonne(s), carte ${r.carte} px`);

  if (!police) {
    rates.push(`${nom} : IBM Plex n'a pas été chargée — toutes les hauteurs mesurées ici sont fausses, ` +
               `et les plafonds ne veulent plus rien dire. Vérifiez l'accès à fonts.googleapis.com.`);
  }
  if (r.debord > 0) rates.push(`${nom} : la page déborde de ${r.debord} px sur la droite`);
  if (r.petits.length) rates.push(`${nom} : cible(s) tactile(s) sous 44 px — ${r.petits.join(', ')}`);
  if (erreurs.length) rates.push(`${nom} : erreur JS — ${erreurs[0]}`);
  if (w === 390 && r.carte > PLAFOND_390) {
    rates.push(`téléphone : la carte fait ${r.carte} px pour deux classes, plafond ${PLAFOND_390}. `
      + `Ce qu'on vient y chercher — le compte et les numéros absents — se retrouve poussé vers le bas.`);
  }

  // La question de repli est la même pour toutes les classes : répétée sous
  // chaque titre, elle coûte deux lignes par classe pour dire deux fois la
  // même chose. Elle monte en tête — mais seulement quand elle est identique
  // partout : dès que deux classes diffèrent, la différence est l'information.
  if (!r.memeQuestion.hissee || r.memeQuestion.parClasse !== 0) {
    rates.push(`${nom} : deux classes avec la même question — elle devrait être hissée `
      + `en tête et masquée sous chaque classe (hissée : ${r.memeQuestion.hissee}, `
      + `visibles par classe : ${r.memeQuestion.parClasse})`);
  }
  if (r.differentes.hissee || r.differentes.parClasse !== 2) {
    rates.push(`${nom} : deux questions différentes — chaque classe doit garder la sienne`);
  }
  if (r.uneSeule.hissee || r.uneSeule.parClasse !== 1) {
    rates.push(`${nom} : une seule classe — il n'y a rien à mutualiser`);
  }

  await fermer();
}
await nav.close();

console.log();
if (rates.length) {
  rates.forEach((x) => console.log('  ✗ ' + x));
  process.exit(1);
}
console.log('  ✓ Carte d\'appel : sous le plafond, sans débordement, sans cible trop petite,');
console.log('    et la question de repli n\'est écrite qu\'une fois.');
