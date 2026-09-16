#!/usr/bin/env node
// ── La carte de révision est-elle utilisable ? ────────────────────────────
//
//     npx playwright install chromium
//     node outils/t_revision.mjs        # depuis la racine du dépôt
//
// Le 16/09, la carte du questionnaire de révision s'affichait chez les
// étudiants… pliée sur son titre. 71 px de haut, aucune option cliquable, et
// aucun moyen de répondre. La cause : rendreRevision() marquait la carte
// « faite » (marquerEtape(id, true)) pour la tenir hors de la file d'attente
// — or `data-fait="oui"` déclenche la règle CSS qui masque l'intitulé et la
// zone des options. Deux intentions confondues en un seul attribut.
//
// Une carte peut être visible ET hors file. C'est `data-hors-file` qui le dit
// maintenant, et ce contrôle vérifie les deux à la fois : la carte est
// utilisable, et le bandeau ne réclame rien.
//
// Il n'appelle pas la base : le portail est SERVI par outils/serveur.mjs, comme
// GitHub Pages le sert, et la fausse couche Supabase est substituée au passage
// sur le réseau — voir outils/portail.mjs. Le portail testé est celui du dépôt,
// pas une version réécrite par expression régulière.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';
const RACINE = process.argv[2] || process.cwd();

const q = (n, rep, juste) => ({
  question:'revision-poo-tp1-'+String(n).padStart(2,'0'),
  intitule:'Question '+n+' ?', options:['A','B','C','D'],
  ma_reponse:rep, bonne:rep?'B':null, explication:rep?'Parce que.':null, juste:rep?juste:null });

const liste = [{
  seance_id:34, numero:90, titre:"Réviser l'interro — Console & POO",
  intro:'Douze questions pour préparer l’interro écrite sur le TP1.',
  mode:'revision', corrige:true, total:12, faites:0, justes:0,
  questions: Array.from({length:12},(_,i)=>q(i+1,null,null)),
}];

const rates = [];
const nav = await chromium.launch();
for (const w of [390, 1280]) {
  const { page: p, erreurs: err, police, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((liste) => {
    let e = document.getElementById('espace-etu');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__e.rendreQuestionnairesEtu(liste);
    const c = document.getElementById('qn-34');
    if (!c) return { carte: 'ABSENTE' };
    const st = (sel) => { const x = c.querySelector(sel); return x ? getComputedStyle(x).display : 'pas de noeud'; };
    return {
      fait: c.getAttribute('data-fait'),
      horsFile: c.getAttribute('data-hors-file'),
      hauteur: Math.round(c.getBoundingClientRect().height),
      intitule: st('.cn-int'),
      choix: st('.appel-choix'),
      texteIntitule: (c.querySelector('.cn-int')||{}).textContent,
      boutonsVisibles: [...c.querySelectorAll('.rv-opt')].filter(b=>b.offsetParent!==null).length,
      file: (document.getElementById('file-reste')||{}).textContent + ' / ' +
            (document.getElementById('file-txt')||{}).textContent,
    };
  }, liste);
  console.log(`\n══ ${w} px`);
  console.log('   data-fait        :', r.fait, '· hors-file :', r.horsFile);
  console.log('   hauteur de carte :', r.hauteur, 'px');
  console.log('   intitulé         :', r.intitule, '·', (r.texteIntitule||'').slice(0,30));
  console.log('   zone des options :', r.choix, '· boutons cliquables :', r.boutonsVisibles);
  console.log('   bandeau de file  :', r.file);
  console.log('   erreurs          :', err.length?err:'aucune');
  if (!police) {
    rates.push(`${w} px : IBM Plex n'a pas été chargée — toutes les hauteurs mesurées ici sont fausses, ` +
               `et les plafonds ne veulent plus rien dire. Vérifiez l'accès à fonts.googleapis.com.`);
  }
  if (r.carte === 'ABSENTE') rates.push(`${w} px : la carte de révision ne s'affiche pas du tout`);
  else {
    if (r.fait === 'oui') rates.push(`${w} px : la carte est marquée « faite » — elle se replie et devient inutilisable`);
    if (r.choix === 'none' || r.boutonsVisibles === 0)
      rates.push(`${w} px : aucune option cliquable (zone des choix : ${r.choix})`);
    if (r.hauteur < 200) rates.push(`${w} px : carte de ${r.hauteur} px — repliée sur son titre`);
    if (/chose/.test(r.file)) rates.push(`${w} px : la file d'attente réclame la révision, qui n'a pas de fin — ${r.file}`);
    if (err.length) rates.push(`${w} px : erreur JS — ${err[0]}`);
  }
  await fermer();
}
await nav.close();

console.log();
if (rates.length) { rates.forEach(x => console.log('  ✗ ' + x)); process.exit(1); }
console.log("  ✓ La carte de révision est ouverte, ses options sont cliquables,");
console.log('    et la file d\'attente ne la réclame pas.');
