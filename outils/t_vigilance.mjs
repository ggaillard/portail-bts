#!/usr/bin/env node
// ── « À aller voir », les points de passage, le distracteur dominant ──────
//
// Ce que ce contrôle vérifie, et pourquoi chaque point existe :
//
//   · l'ORDRE — la main levée passe avant tout, puis la gravité, puis le
//     nombre de raisons. Trier par numéro remettrait le 02 qui va bien
//     au-dessus du 27 qui a levé la main ;
//   · le bouton « Vu » n'existe que sur une main levée et non vue, fait au
//     moins 44 px, et appelle bien main_vue() avec le bon identifiant ;
//   · l'entonnoir des actes : un point par acte, l'acte attendu désigné ;
//   · la ligne de rythme PENDANT les actes parle d'actes, pas de questions —
//     c'était le défaut d'origine : « attendu question 4 » à la 22e minute ;
//   · le distracteur dominant : dit à 50 %, tu à 30 %, jamais sous 5 réponses ;
//   · aucune largeur ne fait déborder la page, aucune erreur JS.
//
// Et une règle qui ne se voit pas à l'écran mais qu'il faut tenir : l'écran
// projeté ne lit JAMAIS cette carte, elle est nominative.

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const rates = [];

const DONNEES = {
  ok: true, seance_id: 18, numero: 4, code: 'BTS1-DEV-2026', minutes: 35, duree_min: 55,
  nb_actes: 4, attendu_acte: 2, quiz_sur: 10, inscrits: 31,
  seuils: { silence_min: 8, grace_min: 3, rapide_s: 5 },
  actes: [
    { acte: 1, titre: 'Trois façons de mener un projet', fin_min: 20, question: true, faits: 24, justes: 19 },
    { acte: 2, titre: 'Le mur entre deux équipes', fin_min: 32, question: true, faits: 12, justes: 11 },
    { acte: 3, titre: 'Git, la mémoire du code', fin_min: 52, question: true, faits: 0, justes: 0 },
    { acte: 4, titre: 'Ouvrez le capot', fin_min: 55, question: false, faits: 0, justes: 0 },
  ],
  eleves: [
    { eleve_id: 2, numero: '02', appel: true, passes: 2, raisons: [] },
    { eleve_id: 6, numero: '06', appel: true, passes: 1, raisons: [
      { cle: 'rapide', gravite: 'a_suivre', texte: '3 réponses du quiz à moins de 5 s d\'écart — lues ?' }] },
    { eleve_id: 9, numero: '09', appel: true, passes: 0, raisons: [
      { cle: 'silence', gravite: 'attention', texte: 'Plus rien depuis 27 min' },
      { cle: 'retard', gravite: 'attention', texte: 'Acte 2 attendu, aucun acte passé' }] },
    { eleve_id: 27, numero: '27', appel: true, passes: 1,
      main: { id: 41, acte: 2, mot: 'le mur ?', depuis: 2, vue: false }, raisons: [
      { cle: 'main', gravite: 'urgent', texte: 'Main levée à l\'acte 2, il y a 2 min — « le mur ? »' }] },
    { eleve_id: 30, numero: '30', appel: true, passes: 1,
      main: { id: 42, acte: 1, mot: '', depuis: 9, vue: true }, raisons: [
      { cle: 'info', gravite: 'info', texte: 'Actif sans avoir répondu à l\'appel' }] },
  ],
};

const nav = await chromium.launch();
for (const w of [360, 390, 768, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((d) => {
    let e = document.getElementById('bloc-vigilance');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    window.__reponses = { main_vue: { ok: true }, vigilance_seance: d };
    window.__e.suivi.seanceId = 18;
    window.__e.rendreVigilance(d);
    const lignes = [...document.querySelectorAll('#vg-liste .vg-l')];
    const vus = [...document.querySelectorAll('#vg-liste .vg-vu')];
    return {
      ordre: lignes.map((l) => l.querySelector('.pa-num').textContent),
      compte: document.getElementById('vg-compte').textContent,
      compteUrgent: document.getElementById('vg-compte').classList.contains('urgent'),
      vus: vus.map((b) => ({ num: b.closest('.vg-l').querySelector('.pa-num').textContent,
                             h: Math.round(b.getBoundingClientRect().height) })),
      actes: document.querySelectorAll('#vg-actes .pa-e').length,
      attendu: [...document.querySelectorAll('#vg-actes .pa-e')].findIndex((x) => x.classList.contains('vg-attendu')),
      hauteur: Math.round(document.getElementById('bloc-vigilance').getBoundingClientRect().height),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, DONNEES);

  console.log(`\n── ${w} px · ordre ${r.ordre.join(' ')} · pastille « ${r.compte} »` +
              `${r.compteUrgent ? ' (urgente)' : ''} · carte ${r.hauteur} px`);
  const ordre = ['27', '09', '06', '30'];
  if (r.ordre.join() !== ordre.join()) rates.push(`${w} px : ordre ${r.ordre.join(' ')}, attendu ${ordre.join(' ')} — la main levée d'abord, puis la gravité`);
  if (r.ordre.includes('02')) rates.push(`${w} px : le 02, sans raison, est listé`);
  if (r.compte !== '4' || !r.compteUrgent) rates.push(`${w} px : pastille « ${r.compte} », urgente=${r.compteUrgent} — attendu « 4 », urgente`);
  if (r.vus.length !== 1 || r.vus[0].num !== '27') rates.push(`${w} px : bouton « Vu » sur ${JSON.stringify(r.vus)} — attendu sur le 27 seul (la main du 30 est déjà vue)`);
  if (r.vus.some((b) => b.h < 44)) rates.push(`${w} px : bouton « Vu » de ${r.vus[0].h} px, sous 44`);
  if (r.actes !== 4) rates.push(`${w} px : ${r.actes} ligne(s) d'actes, attendu 4`);
  if (r.attendu !== 1) rates.push(`${w} px : l'acte attendu désigné est la ligne ${r.attendu}, attendu la 2e`);
  if (r.debord > 0) rates.push(`${w} px : la page déborde de ${r.debord} px`);

  if (w === 390) {
    await p.click('#vg-liste .vg-vu');
    await p.waitForTimeout(100);
    const appels = await p.evaluate(() => window.__appels.filter((a) => a.nom === 'main_vue'));
    if (!appels.length || Number(appels[0].args.p_main_id) !== 41) {
      rates.push(`« Vu » n'appelle pas main_vue(41) : ${JSON.stringify(appels)}`);
    }

    const ry = await p.evaluate((d) => {
      const z = document.getElementById('rythme');
      z.hidden = false;
      const p = { duree_min: 55, questions: 10, ouverte: true,
                  demarree_le: new Date(Date.now() - 35 * 60000).toISOString() };
      window.__e.rendreRythmeActes(z, p, d, 35);
      return { texte: z.textContent, classe: z.className };
    }, DONNEES);
    console.log(`   rythme : ${ry.texte}`);
    if (/question/.test(ry.texte) || !/acte III/.test(ry.texte)) {
      rates.push(`la ligne de rythme, pendant les actes, dit « ${ry.texte} » — elle doit parler de l'acte en cours (III)`);
    }
    if (!/sur 5/.test(ry.texte)) rates.push(`la ligne de rythme ne rapporte pas le retard aux présents : « ${ry.texte} »`);

    const pieges = await p.evaluate(() => {
      const f = window.__e.distracteurDominant;
      const o = ['git commit', 'git merge', 'git revert', 'git push'];
      return [
        f({ n: 10, bonne: 'D', choix: { A: 5, D: 3, B: 2 }, options: o }),
        f({ n: 10, bonne: 'D', choix: { A: 3, D: 4, B: 3 }, options: o }),
        f({ n: 4,  bonne: 'D', choix: { A: 4 }, options: o }),
        f({ n: 10, bonne: 'D', choix: { D: 9, A: 1 }, options: o }),
      ];
    });
    console.log(`   distracteur : ${pieges[0]}`);
    if (!pieges[0] || !/5 sur 10 ont choisi A — « git commit »/.test(pieges[0])) rates.push(`distracteur à 50 % non signalé : ${pieges[0]}`);
    if (pieges[1]) rates.push(`distracteur à 30 % signalé à tort : ${pieges[1]}`);
    if (pieges[2]) rates.push(`distracteur signalé sur 4 réponses : ${pieges[2]}`);
    if (pieges[3]) rates.push(`bonne réponse majoritaire signalée comme piège : ${pieges[3]}`);

    await p.evaluate(() => {
      let e = document.getElementById('bloc-asuivre');
      while (e) { e.hidden = false; e = e.parentElement; }
      window.__e.rendreASuivre({ ok: true, code: 'BTS1-DEV-2026', appels: 3, seances: 3, eleves: [
        { numero: '12', raisons: ['Absent à 2 des 3 derniers appels', '31 % de réussite au quiz sur les dernières séances'] }] });
    });
    const as = await p.evaluate(() => ({ t: document.getElementById('as-titre').textContent,
      n: document.querySelectorAll('#as-liste .vg-l').length }));
    if (as.t !== 'Sur le semestre : 1 étudiant à suivre' || as.n !== 1) rates.push(`« Sur le semestre » : « ${as.t} », ${as.n} ligne(s)`);
  }
  if (erreurs.length) rates.push(`${w} px : erreur JS — ${erreurs[0]}`);
  await fermer();
}
await nav.close();

// L'écran projeté ne lit jamais la carte nominative.
const ecran = fs.readFileSync(path.join(RACINE, 'js', 'ecran.js'), 'utf8');
if (/vigilance|vg-liste/.test(ecran)) rates.push("js/ecran.js lit la vigilance : elle est nominative, elle ne se projette pas");

if (rates.length) {
  console.log('\n✗ ' + rates.length + ' point(s) :');
  rates.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}
console.log('\n✓ « À aller voir » : ordre, « Vu », actes, rythme, distracteur et semestre tiennent.');
