#!/usr/bin/env node
// ── Les missions d'une séance de projet, et la carte « Les séances » ──────
//
//     node outils/t_missions.mjs        # depuis la racine du dépôt
//
// Ajouté le 27/09 avec js/missions.js et js/gestion.js. Ce qu'on exige, et
// pourquoi :
//
//   · CÔTÉ ÉTUDIANT, UNE CASE SE COCHE ET SE DÉCOCHE. Cocher appelle
//     valider_mission(…, true), décocher (…, false), et le compte du titre
//     suit. La carte n'est PAS une étape de la file : marquée étape, elle se
//     replierait une fois tout coché et on ne pourrait plus défaire une erreur.
//     Chaque case fait au moins 44 px, et rien ne déborde à 360 px.
//
//   · SÉANCE FERMÉE, LES CASES SONT INACTIVES ET LA CARTE DIT POURQUOI.
//     Une case qu'on clique sans effet se lit comme une panne.
//
//   · CÔTÉ ENSEIGNANT, LA GRILLE NE SE MONTRE QUE SUR UN PROJET, une colonne
//     par mission, et nomme l'étudiant arrêté (partiel, rien depuis 7 jours)
//     autant que celui qui a fini. Un refus de la base (mission déjà cochée)
//     s'affiche avec SON message, pas un « échec » générique.
//
//   · LA CARTE « LES SÉANCES » PRÉREMPLIT CE QU'ELLE MODIFIE, verrouille les
//     jalons quand des missions les fixent et le numéro quand des réponses
//     existent, et envoie l'échéance saisie.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const rates = [];
const nav = await chromium.launch();
const pause = (p, ms = 80) => p.waitForTimeout(ms);

const MISSIONS = [
  ['Règles de gestion et questions au tuteur', 'guide', 'Concevoir'],
  ['Six scénarios Gherkin, dont deux refus', 'guide', 'Concevoir'],
  ["SPEC.md et AGENTS.md committés avant l'agent", 'semi', 'Concevoir'],
  ["Agent lancé, livraison relue dans la grille d'écart", 'semi', 'Piloter'],
  ['Tous les scénarios verts en corrigeant la spécification', 'autonome', 'Mesurer'],
].map(([libelle, niveau, verbe], i) => ({
  cle: 'tp11-m' + (i + 1), ordre: i + 1, libelle, niveau, verbe,
  fait: i < 2, le: i < 2 ? '2026-10-16T08:10:00Z' : null,
}));

// ─── 1. Côté étudiant ──────────────────────────────────────────────────────
for (const w of [360, 390, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  await p.evaluate((m) => {
    window.__reponses = {
      mes_missions: { ok: true, liste: [{ seance_id: 25, numero: 11, ouverte: true,
        titre: "IA 1 - Développer à partir d'une spécification, avec un agent",
        echeance: '2026-10-16', missions: m }] },
      valider_mission: { ok: true },
    };
    document.getElementById('chargement').hidden = true;
    document.getElementById('espace-etu').hidden = false;
    window.__e.chargerMissionsEtu();
  }, MISSIONS);
  await pause(p);

  const avant = await p.evaluate(() => {
    const c = document.getElementById('mi-25');
    const cases = [...document.querySelectorAll('#mi-25 .mi-case')];
    return {
      existe: !!c, etape: c && c.classList.contains('etape'),
      n: cases.length, on: cases.filter((b) => b.classList.contains('on')).length,
      compte: c && c.querySelector('h2').getAttribute('data-compte'),
      petite: cases.map((b) => Math.round(b.getBoundingClientRect().height)).filter((h) => h < 44),
      pressed: cases.map((b) => b.getAttribute('aria-pressed')).join(','),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (!avant.existe) { rates.push(`${w} px : la carte des missions n'est pas rendue`); await fermer(); continue; }
  if (avant.etape) rates.push(`${w} px : la carte des missions est une étape de la file — elle se replierait`);
  if (avant.n !== 5 || avant.on !== 2) rates.push(`${w} px : ${avant.n} cases dont ${avant.on} cochées, attendu 5 dont 2`);
  if (avant.compte !== '2/5') rates.push(`${w} px : le titre compte « ${avant.compte} », attendu 2/5`);
  if (avant.petite.length) rates.push(`${w} px : cases sous 44 px (${avant.petite.join(', ')})`);
  if (avant.pressed !== 'true,true,false,false,false') rates.push(`${w} px : aria-pressed = ${avant.pressed}`);
  if (avant.debord > 0) rates.push(`${w} px : la page déborde de ${avant.debord} px`);

  // Cocher la troisième, puis décocher la première.
  await p.click('#mi-25 .mi-case:nth-child(3)');
  await pause(p);
  await p.click('#mi-25 .mi-case:nth-child(1)');
  await pause(p);
  const apres = await p.evaluate(() => {
    const appels = window.__appels.filter((a) => a.nom === 'valider_mission');
    const cases = [...document.querySelectorAll('#mi-25 .mi-case')];
    return {
      appels: appels.map((a) => a.args.p_cle + '=' + a.args.p_fait).join(' '),
      on: cases.map((b) => b.classList.contains('on') ? 1 : 0).join(''),
      compte: document.querySelector('#mi-25 h2').getAttribute('data-compte'),
      meta: cases[2].querySelector('.mi-meta').textContent,
    };
  });
  if (apres.appels !== 'tp11-m3=true tp11-m1=false') rates.push(`${w} px : appels envoyés « ${apres.appels} »`);
  if (apres.on !== '01100') rates.push(`${w} px : état des cases ${apres.on}, attendu 01100`);
  if (apres.compte !== '2/5') rates.push(`${w} px : après cocher/décocher, le titre compte ${apres.compte}`);
  if (!/validée le/.test(apres.meta)) rates.push(`${w} px : la case cochée ne dit pas quand (« ${apres.meta} »)`);

  // Séance fermée.
  await p.evaluate((m) => {
    window.__reponses.mes_missions.liste[0].ouverte = false;
    window.__e.chargerMissionsEtu();
  }, MISSIONS);
  await pause(p);
  const fermee = await p.evaluate(() => ({
    actives: [...document.querySelectorAll('#mi-25 .mi-case')].filter((b) => !b.disabled).length,
    msg: document.getElementById('err-mi-25').textContent,
  }));
  if (fermee.actives) rates.push(`${w} px : séance fermée, ${fermee.actives} case(s) restent actives`);
  if (!/pas encore ouverte/.test(fermee.msg)) rates.push(`${w} px : séance fermée sans explication`);

  if (erreurs.length) rates.push(`${w} px (étudiant) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · étudiant : ${avant.n} cases, ${apres.appels}`);
  await fermer();
}

// ─── 2. Côté enseignant : la grille ────────────────────────────────────────
const JOUR = 86400000;
for (const w of [360, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate(({ m, JOUR }) => {
    const il = (j) => new Date(Date.now() - j * JOUR).toISOString();
    const cases = (n, j) => Object.fromEntries(m.slice(0, n).map((x) => [x.cle, il(j)]));
    window.__reponses = {
      grille_missions: { ok: true, declarees: true, jalons: 5,
        missions: m.map((x) => ({ cle: x.cle, libelle: x.libelle, niveau: x.niveau, verbe: x.verbe })),
        eleves: [
          { numero: '01', avatar: '🦊', cases: cases(5, 1), dernier: il(1) },
          { numero: '02', avatar: '🐢', cases: cases(2, 10), dernier: il(10) },
          { numero: '03', avatar: '🐙', cases: {}, dernier: null },
        ] },
    };
    let e = document.getElementById('volet-seance');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    const s = window.__e.suivi;
    s.seanceId = 25; s.nature = 'cours';
    return window.__e.chargerMissions().then(() => {
      const cache = document.getElementById('bloc-missions').hidden;
      s.nature = 'projet';
      return window.__e.chargerMissions().then(() => ({
        cacheSurCours: cache,
        visible: !document.getElementById('bloc-missions').hidden,
        entetes: [...document.querySelectorAll('#mi-grille thead th')].map((x) => x.textContent).join(' '),
        lignes: [...document.querySelectorAll('#mi-grille tbody tr')].map((x) => x.className).join(','),
        coches: [...document.querySelectorAll('#mi-grille tbody tr:nth-child(2) td.mi-ok')].length,
        resume: document.getElementById('mi-resume').textContent,
        texte: document.getElementById('mi-texte').value.split('\n'),
        barres: document.querySelectorAll('#mi-barres .pa-e').length,
        debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
    });
  }, { m: MISSIONS, JOUR });

  if (!r.cacheSurCours) rates.push(`${w} px : la grille des missions s'affiche sur une séance de cours`);
  if (!r.visible) rates.push(`${w} px : la grille ne s'affiche pas sur une séance de projet`);
  if (r.entetes !== 'N° M1 M2 M3 M4 M5 Dern.') rates.push(`${w} px : en-têtes « ${r.entetes} »`);
  if (r.lignes !== 'mi-fini,mi-arret,mi-rien') rates.push(`${w} px : états des lignes « ${r.lignes} »`);
  if (r.coches !== 2) rates.push(`${w} px : l'étudiant 02 a ${r.coches} coches, attendu 2`);
  if (!/1 fini/.test(r.resume) || !/1 sans aucune case/.test(r.resume) || !/1 arrêté/.test(r.resume)) {
    rates.push(`${w} px : résumé « ${r.resume} »`);
  }
  if (r.texte.length !== 5 || !r.texte[0].startsWith('🟢') || !r.texte[4].includes('[Mesurer]')) {
    rates.push(`${w} px : l'éditeur n'est pas prérempli avec les missions (${r.texte.length} lignes)`);
  }
  if (r.barres !== 5) rates.push(`${w} px : ${r.barres} barres, attendu 5`);
  if (r.debord > 0) rates.push(`${w} px : la grille fait déborder la page de ${r.debord} px`);

  // Enregistrer, puis un refus de la base.
  await p.evaluate(() => {
    window.__reponses.definir_missions = { ok: true, missions: 2 };
    document.getElementById('mi-neuf').open = true;
    const ta = document.getElementById('mi-texte');
    ta.value = '🟢 Une [Concevoir]\n🔴 Deux';
    ta.dispatchEvent(new Event('input'));
  });
  await p.click('#b-mi-creer');
  await pause(p);
  const envoi = await p.evaluate(() => {
    const a = window.__appels.filter((x) => x.nom === 'definir_missions').pop();
    return { texte: a && a.args.p_texte, msg: document.getElementById('err-mi-neuf').textContent };
  });
  if (envoi.texte !== '🟢 Une [Concevoir]\n🔴 Deux') rates.push(`${w} px : texte envoyé « ${envoi.texte} »`);
  if (!/2 missions enregistrées/.test(envoi.msg)) rates.push(`${w} px : confirmation « ${envoi.msg} »`);
  await p.evaluate(() => {
    window.__reponses.definir_missions = { ok: false, motif: 'cochee',
      detail: 'Mission(s) déjà cochée(s), impossibles à retirer : tp11-m5' };
  });
  await p.click('#b-mi-creer');
  await pause(p);
  const refus = await p.evaluate(() => document.getElementById('err-mi-neuf').textContent);
  if (!/tp11-m5/.test(refus)) rates.push(`${w} px : le refus ne dit pas quelle mission (« ${refus} »)`);

  if (erreurs.length) rates.push(`${w} px (grille) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · grille : ${r.lignes}`);
  await fermer();
}

// ─── 3. La carte « Les séances » ───────────────────────────────────────────
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  await p.evaluate(() => {
    window.__reponses = { seances_de_classe: { ok: true, liste: [
      { id: 1, numero: 0, titre: 'TP0', nature: 'projet', jalons: 3, echeance: '2027-03-15',
        duree_min: 55, ouverte: true, publiee: true, missions: 0, corriges: 8, reponses: 40 },
      { id: 25, numero: 11, titre: "IA 1 - Développer à partir d'une spécification, avec un agent",
        nature: 'projet', jalons: 5, echeance: '2026-10-16', duree_min: 180,
        ouverte: false, publiee: false, missions: 5, corriges: 0, reponses: 3 },
    ] }, enregistrer_seance: { ok: true, id: 25, cree: false } };
    let e = document.getElementById('volet-ensemble');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    window.__e.chargerGestion([{ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }]);
  });
  await pause(p, 150);
  const liste = await p.evaluate(() => ({
    visible: !document.getElementById('carte-seances').hidden,
    lignes: document.querySelectorAll('#gs-liste .gs-l').length,
    meta: [...document.querySelectorAll('#gs-liste .gs-meta')].map((x) => x.textContent),
  }));
  if (!liste.visible) rates.push('séances : la carte ne s\'affiche pas');
  if (liste.lignes !== 2) rates.push(`séances : ${liste.lignes} lignes, attendu 2`);
  if (!liste.meta[1] || !/5 missions/.test(liste.meta[1]) || !/non publiée/.test(liste.meta[1])) {
    rates.push(`séances : la ligne de la séance 11 dit « ${liste.meta[1]} »`);
  }

  await p.click('#gs-liste .gs-l:nth-child(2) .gs-b');
  await pause(p);
  const form = await p.evaluate(() => ({
    visible: !document.getElementById('f-gs').hidden,
    echeance: document.getElementById('gs-echeance').value,
    jalonsVerrou: document.getElementById('gs-jalons').disabled,
    numeroVerrou: document.getElementById('gs-numero').disabled,
    titre: document.getElementById('gs-titre').value,
  }));
  if (!form.visible) rates.push('séances : le formulaire ne s\'ouvre pas');
  if (form.echeance !== '2026-10-16') rates.push(`séances : échéance préremplie « ${form.echeance} »`);
  if (!form.jalonsVerrou) rates.push('séances : les jalons restent saisissables alors que 5 missions les fixent');
  if (!form.numeroVerrou) rates.push('séances : le numéro reste modifiable sur une séance qui a des réponses');
  if (!/IA 1/.test(form.titre)) rates.push(`séances : titre prérempli « ${form.titre} »`);

  await p.fill('#gs-echeance', '2026-10-20');
  await p.check('#gs-publiee');
  await p.click('#b-gs-ok');
  await pause(p, 150);
  const envoi = await p.evaluate(() => {
    const a = window.__appels.filter((x) => x.nom === 'enregistrer_seance').pop();
    return a ? a.args : null;
  });
  if (!envoi) rates.push('séances : enregistrer_seance n\'a pas été appelée');
  else {
    if (envoi.p_seance_id !== 25) rates.push(`séances : p_seance_id = ${envoi.p_seance_id}`);
    if (envoi.p_echeance !== '2026-10-20') rates.push(`séances : p_echeance = ${envoi.p_echeance}`);
    if (envoi.p_publiee !== true) rates.push('séances : la case Publiée n\'est pas transmise');
    if (envoi.p_numero !== 11) rates.push(`séances : p_numero = ${envoi.p_numero}`);
  }

  // Nouvelle séance : le numéro proposé suit la dernière, et un refus s'affiche.
  await p.click('#b-gs-neuve');
  await pause(p);
  const neuve = await p.evaluate(() => ({
    numero: document.getElementById('gs-numero').value,
    verrou: document.getElementById('gs-numero').disabled,
  }));
  if (neuve.numero !== '12' || neuve.verrou) rates.push(`séances : nouvelle séance n° « ${neuve.numero} » (verrou ${neuve.verrou})`);
  await p.evaluate(() => {
    window.__reponses.enregistrer_seance = { ok: false, motif: 'pris',
      detail: 'La séance 12 existe déjà dans cette classe.' };
  });
  await p.fill('#gs-titre', 'IA 2 - Prompts et évaluation');
  await p.click('#b-gs-ok');
  await pause(p);
  const refus = await p.evaluate(() => document.getElementById('err-gs').textContent);
  if (!/existe déjà/.test(refus)) rates.push(`séances : refus affiché « ${refus} »`);

  if (erreurs.length) rates.push(`séances : ${erreurs.join(' | ')}`);
  console.log(`── séances : ${liste.lignes} lignes, échéance envoyée ${envoi && envoi.p_echeance}`);
  await fermer();
}

await nav.close();
if (rates.length) {
  console.log('\n✗ ' + rates.length + ' défaut(s) :');
  rates.forEach((r) => console.log('  · ' + r));
  process.exit(1);
}
console.log('\n✓ Missions : cocher, décocher, séance fermée, grille par élève, éditeur ;\n' +
            '  séances : liste, formulaire prérempli, verrous, échéance envoyée.');
