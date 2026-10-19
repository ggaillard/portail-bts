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
//   · depuis le 19/10, « Où en est chacun » (ordre, bouchon, absents à part,
//     case longue, rien qui déborde) et l'analyse après l'heure (points,
//     filtre « À revoir », concepts à reprendre, retours individuels).
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

// ── « Où en est chacun » (19/10) : la carte du parcours ───────────────────
//  Quinze étapes comme la séance 5. Trois présents sur la Q6 (rang 7) — c'est
//  le bouchon —, dont un depuis 9 min ; un sur la Q1 ; un a fini ; un absent.
const ORDRE = ['q1','q2','acte-1','q3','q4','acte-2','q5','q6','q7','acte-3','q8','q9','acte-4','q10','acte-5'];
const lib = (c) => c.startsWith('acte-') ? 'Acte ' + ['','I','II','III','IV','V'][+c.slice(5)] : 'Q' + c.slice(1);
const CARTE = {
  ok: true, seance_id: 18, numero: 5, code: 'BTS1-DEV-2026', ouverte: true, minutes: 30,
  inscrits: 6, presents: 5, finis: 1,
  etapes: ORDRE.map((c, i) => ({ rang: i + 1, cle: c, libelle: lib(c), type: c.startsWith('acte') ? 'passage' : 'question',
    passes: i < 7 ? 4 : 1, justes: 3, faux: 1, ici: i === 7 ? 3 : (i === 0 ? 1 : 0), ici_5min: i === 7 ? 1 : 0, sorties: 0 })),
  eleves: [
    { eleve_id: 4, numero: '04', present: true, ici: 1, ici_cle: 'q1', faites: 0, depuis: 3, sorties: 0, cases: '.'.repeat(15) },
    { eleve_id: 9, numero: '09', present: true, ici: 8, ici_cle: 'q6', faites: 7, depuis: 9, sorties: 1, main: true, cases: 'JJJFJJJ........' },
    { eleve_id: 11, numero: '11', present: true, ici: 8, ici_cle: 'q6', faites: 7, depuis: 2, sorties: 0, cases: 'JFJJJJJ........' },
    { eleve_id: 12, numero: '12', present: true, ici: 8, ici_cle: 'q6', faites: 7, depuis: 1, sorties: 0, cases: 'JJJJFJJ........' },
    { eleve_id: 2, numero: '02', present: true, ici: null, faites: 15, depuis: null, sorties: 0, cases: 'JJJJJJJJJJJJJJX' },
    { eleve_id: 6, numero: '06', present: false, ici: 1, faites: 0, depuis: null, sorties: 0, cases: '.'.repeat(15) },
  ],
  bouchon: { rang: 8, cle: 'q6', libelle: 'Q6', acte: null, ici: 3, ici_5min: 1 },
};

// ── « Ce que la séance apprend » (19/10) : l'analyse après l'heure ─────────
const ANALYSE = {
  ok: true, seance_id: 18, numero: 5, code: 'BTS1-DEV-2026', jouee: true, inscrits: 6, presents: 5, finis: 1,
  etapes: 15, duree_mediane_min: 41,
  points: [
    { gravite: 'attention', texte: "L'acte III a duré 18 min en médiane, pour 12 prévues : à alléger, ou à couper en deux." },
    { gravite: 'attention', texte: 'Question 6 : 33 % juste (1 sur 3) — 2 ont choisi « la ligne 5 » : une idée fausse partagée.' },
    { gravite: 'a_suivre', texte: 'Question 7 : 3 étudiants ont quitté la page pour y répondre.' },
  ],
  actes: [{ acte: 1, prevu_min: 14, passes: 5, mesures: 5, reel_min: 13.5 }, { acte: 3, prevu_min: 12, passes: 4, mesures: 5, reel_min: 18 }],
  questions: [{ cle: 'q6', numero: 6, acte: null, intitule: 'Quelle ligne ?', options: ['l1', 'l5', 'l6', 'l4'], bonne: 'D',
                repondants: 3, justes: 1, taux: 33, piege: 'B', piege_n: 2, mediane_s: 140, sans_lire: 0, sorties: 1 }],
  concepts: [{ rang: 1, intitule: "L'intégration continue", questions: [1, 10] },
             { rang: 4, intitule: 'Image et conteneur', questions: [5, 6, 7] }],
  eleves: [
    { eleve_id: 9, numero: '09', present: true, faites: 9, notees: 7, justes: 5, arret: 'acte-3', fausses: [6, 7],
      concepts_ko: [4], priorite: 'a_revoir', raisons: [
        { gravite: 'attention', texte: "S'est arrêté au point de passage de l'acte III (9 étapes sur 15)" },
        { gravite: 'attention', texte: 'A quitté la page pendant 2 questions (84 s)' }] },
    { eleve_id: 11, numero: '11', present: true, faites: 15, notees: 10, justes: 8, arret: null, fausses: [1],
      concepts_ko: [1], priorite: 'a_surveiller', raisons: [{ gravite: 'a_suivre', texte: '3 réponses sans le temps de lire' }] },
    { eleve_id: 2, numero: '02', present: true, faites: 15, notees: 10, justes: 10, arret: null, fausses: [],
      concepts_ko: [], priorite: 'ok', raisons: [] },
    { eleve_id: 6, numero: '06', present: false, faites: 0, notees: 0, justes: 0, arret: 'q1', fausses: [],
      concepts_ko: [], priorite: 'absent', raisons: [{ gravite: 'info', texte: 'Absent : la séance est à rattraper' }] },
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

    // L'affichage instantané : trois écoutes filtrées sur la séance, la mention
    // « En direct » seulement une fois le canal ouvert, et cinq changements
    // rapprochés regroupés en UN rafraîchissement.
    const direct = await p.evaluate(async () => {
      const e = window.__e;
      e.suivi.seanceId = 18;
      e.suivi.minuteur = setInterval(() => {}, 100000);
      e.brancherDirect(e.rafraichir);
      await new Promise((r) => setTimeout(r, 50));
      const c = (window.__canaux || []).slice(-1)[0];
      const avant = window.__appels.filter((a) => a.nom === 'vigilance_seance').length;
      for (let i = 0; i < 5; i++) c.ecoutes[i % 3].cb({});
      await new Promise((r) => setTimeout(r, 700));
      const apres = window.__appels.filter((a) => a.nom === 'vigilance_seance').length;
      const z = document.getElementById('suivi-mode');
      return { tables: c.ecoutes.map((x) => x.f.table + ':' + x.f.filter),
               texte: z.textContent, classe: z.className, rafraichis: apres - avant };
    });
    console.log(`   direct : ${direct.tables.join(' · ')} · ${direct.rafraichis} rafraîchissement(s) pour 5 changements`);
    if (direct.tables.join() !== 'reponses:seance_id=eq.18,passages:seance_id=eq.18,mains:seance_id=eq.18') {
      rates.push(`écoutes temps réel inattendues : ${direct.tables.join(' · ')}`);
    }
    if (!/En direct/.test(direct.texte) || !/direct/.test(direct.classe)) rates.push(`« En direct » non affiché : « ${direct.texte} »`);
    if (direct.rafraichis !== 1) rates.push(`${direct.rafraichis} rafraîchissements pour cinq changements rapprochés, attendu 1`);
    const tombe = await p.evaluate(async () => {
      window.__etatDirect = 'CHANNEL_ERROR';
      window.__e.brancherDirect(window.__e.rafraichir);
      await new Promise((r) => setTimeout(r, 50));
      return document.getElementById('suivi-mode').textContent;
    });
    if (/En direct/.test(tombe)) rates.push(`canal en erreur, et le portail dit encore « En direct »`);

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
  // ── La carte du parcours ──
  const ca = await p.evaluate((d) => {
    let e = document.getElementById('bloc-carte');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__e.rendreCarte(d);
    const lignes = [...document.querySelectorAll('#ca-grille tbody tr')];
    const ici = [...document.querySelectorAll('#ca-grille td.ca-ici')];
    const nums = [...document.querySelectorAll('#ca-grille .ca-num')];
    const th = [...document.querySelectorAll('#ca-grille thead th')];
    return {
      lignes: lignes.map((l) => l.querySelector('.ca-num').textContent.trim().split(' ')[0]),
      bouchon: document.getElementById('ca-bouchon').hidden ? null : document.getElementById('ca-bouchon').textContent,
      absents: document.getElementById('ca-absents').textContent,
      long: ici.filter((x) => x.classList.contains('long')).map((x) => x.textContent),
      colBouchon: th.findIndex((x) => x.querySelector('.ca-ici-n.bouchon')),
      cellules: lignes[1] ? lignes[1].querySelectorAll('td').length : 0,
      hNum: Math.min(...nums.map((b) => b.getBoundingClientRect().height)),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      compte: document.getElementById('ca-compte').textContent,
    };
  }, CARTE);
  if (ca.lignes.join() !== '04,09,11,12,02') rates.push(`${w} px : carte, lignes ${ca.lignes.join(' ')} — attendu l'ordre de la base, sans l'absent`);
  if (!ca.bouchon || !/3 étudiants sont sur la question 6 — 1 depuis plus de 5 min/.test(ca.bouchon)) rates.push(`${w} px : carte, bouchon « ${ca.bouchon} »`);
  if (!/Pas encore là : 06/.test(ca.absents)) rates.push(`${w} px : carte, absents « ${ca.absents} »`);
  if (ca.long.join() !== '9′') rates.push(`${w} px : carte, case en cours « longue » : ${ca.long.join()} — attendu 9′ seul`);
  if (ca.colBouchon !== 8) rates.push(`${w} px : carte, le bouchon marqué colonne ${ca.colBouchon}, attendu 8 (Q6)`);
  if (ca.cellules !== 15) rates.push(`${w} px : carte, ${ca.cellules} cases par ligne, attendu 15`);
  if (ca.hNum < 24) rates.push(`${w} px : carte, numéro cliquable de ${ca.hNum} px, sous 24 (WCAG 2.5.8)`);
  if (ca.debord > 0) rates.push(`${w} px : la carte fait déborder la page de ${ca.debord} px`);
  if (ca.compte !== '1/5 finis') rates.push(`${w} px : carte, compte « ${ca.compte} »`);
  if (w === 390) {
    // Projet, ou séance sans étapes : la carte se masque.
    const masque = await p.evaluate(async () => {
      window.__reponses = Object.assign(window.__reponses || {}, { carte_parcours: { ok: false, motif: 'pas_un_cours' } });
      window.__e.suivi.seanceId = 18;
      await window.__e.chargerCarte();
      return document.getElementById('bloc-carte').hidden;
    });
    if (!masque) rates.push('carte : reste affichée quand la base répond « pas un cours »');

    // ── L'analyse après l'heure ──
    const an = await p.evaluate(async (a) => {
      window.__reponses = Object.assign(window.__reponses || {}, { analyse_seance: a });
      const z = document.createElement('div');
      document.getElementById('espace-ens').appendChild(z);
      await window.__e.rendreAnalyse({ id: 18 }, z);
      const visibles = () => [...z.querySelectorAll('.an-el')].map((x) => x.querySelector('strong').textContent);
      const avant = visibles();
      [...z.querySelectorAll('.an-filtres button')].find((b) => /^Tous/.test(b.textContent)).click();
      return {
        points: z.querySelectorAll('.an-points li').length,
        avant, tous: visibles(),
        ko: z.querySelector('.an-ko') ? z.querySelector('.an-ko').textContent : '',
        r09: window.__e.retourDe(a, a.eleves[0]),
        r06: window.__e.retourDe(a, a.eleves[3]),
        r02: window.__e.retourDe(a, a.eleves[2]),
        long: z.querySelectorAll('.an-table tr.long').length,
      };
    }, ANALYSE);
    if (an.points !== 3) rates.push(`analyse : ${an.points} point(s) à améliorer affichés, attendu 3`);
    if (an.avant.join() !== 'N° 09') rates.push(`analyse : « À revoir » montre ${an.avant.join(' ')} — attendu le 09 seul`);
    if (an.tous.length !== 4) rates.push(`analyse : « Tous » montre ${an.tous.length} étudiants, attendu 4`);
    if (!/À reprendre : « Image et conteneur » \(questions 6, 7\)/.test(an.ko)) rates.push(`analyse : concepts à reprendre « ${an.ko} »`);
    if (!/« Image et conteneur »/.test(an.r09 || '') || !/arrêté au point de passage de l'acte III/.test(an.r09 || ''))
      rates.push(`analyse : le retour du 09 ne dit pas quoi reprendre ni où il s'est arrêté — « ${an.r09} »`);
    if (!/vous étiez absent/.test(an.r06 || '')) rates.push(`analyse : le retour de l'absent — « ${an.r06} »`);
    if (an.r02 !== null) rates.push(`analyse : un retour pour le 02, qui n'a rien à reprendre — « ${an.r02} »`);
    if (an.long !== 2) rates.push(`analyse : ${an.long} ligne(s) en orange (acte III et Q6 attendus)`);
  }

  if (erreurs.length) rates.push(`${w} px : erreur JS — ${erreurs[0]}`);
  await fermer();
}
await nav.close();

// L'écran projeté ne lit jamais la carte nominative.
const ecran = fs.readFileSync(path.join(RACINE, 'js', 'ecran.js'), 'utf8');
if (/vigilance|vg-liste/.test(ecran)) rates.push("js/ecran.js lit la vigilance : elle est nominative, elle ne se projette pas");
if (/carte_parcours|ca-grille|analyse_seance/.test(ecran)) rates.push("js/ecran.js lit la carte du parcours ou l'analyse : elles sont nominatives, elles ne se projettent pas");

if (rates.length) {
  console.log('\n✗ ' + rates.length + ' point(s) :');
  rates.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}
console.log('\n✓ « À aller voir » : ordre, « Vu », actes, rythme, distracteur et semestre tiennent ;');
console.log('  la carte du parcours et l\'analyse après l\'heure disent ce qu\'il faut, à qui il faut.');
