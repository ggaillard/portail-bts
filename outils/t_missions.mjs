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
//
//   · LES MODULES (28/09). L'étudiant lit « Vos projets » module par module,
//     sans jamais le dépôt enseignant, et retombe sur la table projets quand
//     mes_modules() ne rend rien. L'enseignant voit les modules sous leur
//     classe, sans les démos, avec ce qui reste à ranger ; le formulaire
//     s'ouvre SOUS le module qu'on modifie, prérempli, et refuse de supprimer
//     un module occupé. « Les séances » se groupe par module, et ranger une
//     séance appelle ranger_seance() — seulement quand le module change.

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

// ─── 4. Les modules, côté étudiant ─────────────────────────────────────────
const MOD_PL = { id: 2, code: 'playlistapp', titre: 'PlaylistApp — C# et .NET 10', icone: '🎵',
  description: 'Les 5 TP du projet.', depot: 'https://github.com/ggaillard/playlist-csharp',
  site: 'https://ggaillard.github.io/playlist-csharp/' };
const MOD_IA = { id: 3, code: 'ia-meca-forez', titre: 'IA Méca Forez — concevoir, piloter, mesurer, sécuriser',
  icone: '🏭', description: 'Six séances de stage.', depot: 'https://github.com/ggaillard/BTS2-IA-MecaForez',
  site: null };
for (const w of [360, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate(({ a, b }) => {
    // Le dépôt enseignant ne doit pas sortir de mes_modules() — la base y
    // veille. On le glisse quand même ici : la page ne doit pas l'afficher
    // pour autant, c'est la seconde ceinture.
    window.__reponses = { mes_modules: { ok: true, liste: [a,
      Object.assign({}, b, { depot_enseignant: b.depot + '-Prof' })] } };
    document.getElementById('chargement').hidden = true;
    document.getElementById('espace-etu').hidden = false;
    return window.__e.chargerModulesEtu(2).then(() => {
      const blocs = [...document.querySelectorAll('#mes-projets .md-bloc')];
      const out = {
        blocs: blocs.map((x) => x.dataset.module).join(','),
        liens: blocs.map((x) => x.querySelectorAll('a.projet').length).join(','),
        hrefs: [...document.querySelectorAll('#mes-projets a.projet')].map((x) => x.href),
        titre: blocs[1] && blocs[1].querySelector('.md-nom').textContent,
        debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        petites: [...document.querySelectorAll('#mes-projets a.projet')]
          .map((x) => Math.round(x.getBoundingClientRect().height)).filter((h) => h < 44),
      };
      window.__reponses.mes_modules = { ok: true, liste: [] };
      return window.__e.chargerModulesEtu(2).then(() => {
        out.repli = document.getElementById('mes-projets').textContent;
        out.appelProjets = true;
        return out;
      });
    });
  }, { a: MOD_PL, b: MOD_IA });
  if (r.blocs !== 'playlistapp,ia-meca-forez') rates.push(`${w} px (modules étudiant) : blocs « ${r.blocs} »`);
  if (r.liens !== '2,1') rates.push(`${w} px (modules étudiant) : liens par module « ${r.liens} », attendu 2,1 (site + dépôt, puis dépôt seul)`);
  if (!r.hrefs.includes('https://github.com/ggaillard/BTS2-IA-MecaForez')) rates.push(`${w} px (modules étudiant) : le dépôt Méca Forez n'est pas proposé`);
  if (r.hrefs.some((h) => /Prof|prof/.test(h))) rates.push(`${w} px (modules étudiant) : un dépôt enseignant est proposé à l'étudiant`);
  if (!/Méca\u202f?\s?Forez|Méca Forez/.test(r.titre || '')) rates.push(`${w} px (modules étudiant) : titre « ${r.titre} »`);
  if (r.debord > 0) rates.push(`${w} px (modules étudiant) : la page déborde de ${r.debord} px`);
  if (r.petites.length) rates.push(`${w} px (modules étudiant) : liens sous 44 px (${r.petites.join(', ')})`);
  if (!/Aucun projet/.test(r.repli)) rates.push(`${w} px (modules étudiant) : sans module, pas de repli sur les projets (« ${r.repli.slice(0, 60)} »)`);
  if (erreurs.length) rates.push(`${w} px (modules étudiant) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · modules étudiant : ${r.blocs} (${r.liens})`);
  await fermer();
}

// ─── 5. Les modules, côté enseignant ───────────────────────────────────────
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const ens = (m, n) => Object.assign({}, m, { seances: n, ordre: 1,
    depot_enseignant: m.depot + '-Prof' });
  const CLASSES = [
    { classe_id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM', sans_module: 1,
      modules: [ens(MOD_PL, 5), ens(MOD_IA, 2)] },
    { classe_id: 9, code: 'DEMO-2026', nom: 'Démonstration', sans_module: 0, modules: [] },
  ];
  const r = await p.evaluate((classes) => {
    window.__reponses = { modules_enseignant: { ok: true, classes: classes },
                          enregistrer_module: { ok: true, id: 3, cree: false } };
    let e = document.getElementById('volet-ensemble');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    return window.__e.chargerModules([{ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }]).then(() => ({
      titre: document.getElementById('md-carte-titre').textContent,
      classes: [...document.querySelectorAll('#tous-projets > h3')].map((x) => x.textContent).join(','),
      blocs: document.querySelectorAll('#tous-projets .md-bloc').length,
      ens: [...document.querySelectorAll('#tous-projets a.projet')].filter((a) => /Prof$/.test(a.href)).length,
      reste: (document.querySelector('#tous-projets .md-reste') || {}).textContent || '',
      metas: [...document.querySelectorAll('#tous-projets .md-meta')].map((x) => x.textContent),
    }));
  }, CLASSES);
  if (r.titre !== 'Les modules, par classe') rates.push(`modules enseignant : titre de carte « ${r.titre} »`);
  if (r.classes !== 'BTS SIO 2 - SLAM') rates.push(`modules enseignant : classes affichées « ${r.classes} » (les démos doivent être écartées)`);
  if (r.blocs !== 2) rates.push(`modules enseignant : ${r.blocs} blocs, attendu 2`);
  if (r.ens !== 2) rates.push(`modules enseignant : ${r.ens} dépôt(s) enseignant affiché(s), attendu 2`);
  if (!/1 séance n'est rangée dans aucun module/.test(r.reste)) rates.push(`modules enseignant : reste à ranger « ${r.reste} »`);
  if (!/ia-meca-forez · 2 séances/.test(r.metas[1] || '')) rates.push(`modules enseignant : ligne du module IA « ${r.metas[1]} »`);

  // Modifier le module IA : le formulaire s'ouvre juste sous lui, prérempli.
  await p.click('#tous-projets .md-bloc:nth-of-type(2) .md-b');
  await pause(p);
  const f = await p.evaluate(() => {
    const form = document.getElementById('f-md');
    const prec = form.previousElementSibling;
    return { visible: !form.hidden, sous: prec && prec.dataset.module,
      depot: document.getElementById('md-depot').value,
      ens: document.getElementById('md-depot-enseignant').value,
      suppr: document.getElementById('b-md-suppr').disabled,
      note: document.getElementById('md-suppr-note').textContent };
  });
  if (!f.visible) rates.push('modules enseignant : le formulaire ne s\'ouvre pas');
  if (f.sous !== 'ia-meca-forez') rates.push(`modules enseignant : le formulaire s'ouvre sous « ${f.sous} », pas sous le module modifié`);
  if (f.depot !== MOD_IA.depot || !/Prof$/.test(f.ens)) rates.push(`modules enseignant : préremplissage « ${f.depot} » / « ${f.ens} »`);
  if (!f.suppr || !/2 séances/.test(f.note)) rates.push('modules enseignant : supprimer reste possible sur un module qui porte des séances');

  await p.fill('#md-site', 'https://ggaillard.github.io/BTS2-IA-MecaForez/');
  await p.click('#b-md-ok');
  await pause(p, 150);
  const envoi = await p.evaluate(() => {
    const a = window.__appels.filter((x) => x.nom === 'enregistrer_module').pop();
    return { a: a && a.args, msg: document.getElementById('err-md-liste').textContent,
             encore: !!document.getElementById('f-md') };
  });
  if (!envoi.a || envoi.a.p_module_id !== 3 || envoi.a.p_classe_id !== 2 ||
      envoi.a.p_site !== 'https://ggaillard.github.io/BTS2-IA-MecaForez/' || envoi.a.p_code !== 'ia-meca-forez') {
    rates.push(`modules enseignant : envoi ${JSON.stringify(envoi.a)}`);
  }
  if (!/Module enregistré/.test(envoi.msg)) rates.push(`modules enseignant : confirmation « ${envoi.msg} »`);
  if (!envoi.encore) rates.push('modules enseignant : le formulaire a disparu avec la liste redessinée');

  // Un refus de la base s'affiche avec SA phrase.
  await p.evaluate(() => { window.__reponses.enregistrer_module = { ok: false, motif: 'depot',
    detail: 'Chaque module a son dépôt GitHub : https://github.com/compte/depot.' }; });
  await p.click('#tous-projets .md-neuf');
  await pause(p);
  await p.fill('#md-titre', 'Essai');
  await p.fill('#md-code', 'essai');
  await p.fill('#md-depot', 'https://github.com/x/y');
  await p.click('#b-md-ok');
  await pause(p);
  const refus = await p.evaluate(() => document.getElementById('err-md').textContent);
  if (!/dépôt GitHub/.test(refus)) rates.push(`modules enseignant : refus affiché « ${refus} »`);

  if (erreurs.length) rates.push(`modules enseignant : ${erreurs.join(' | ')}`);
  console.log(`── modules enseignant : ${r.blocs} modules, ${r.reste}`);
  await fermer();
}

// ─── 6. « Les séances », groupées par module ───────────────────────────────
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  await p.evaluate(({ a, b }) => {
    window.__reponses = {
      modules_enseignant: { ok: true, classes: [{ classe_id: 2, code: 'BTS2-SLAM-2026',
        nom: 'BTS SIO 2 - SLAM', sans_module: 1, modules: [a, b] }] },
      seances_de_classe: { ok: true, liste: [
        { id: 1, numero: 0, titre: 'TP0', nature: 'projet', jalons: 3, module_id: 2,
          ouverte: true, publiee: true, missions: 0, corriges: 8, reponses: 40 },
        { id: 25, numero: 11, titre: 'IA 1', nature: 'projet', jalons: 5, module_id: 3,
          ouverte: false, publiee: false, missions: 5, corriges: 0, reponses: 3 },
        { id: 30, numero: 13, titre: 'IA 3 - RAG', nature: 'projet', jalons: 0, module_id: null,
          ouverte: false, publiee: false, missions: 0, corriges: 0, reponses: 0 },
      ] },
      enregistrer_seance: { ok: true, id: 30, cree: false },
      ranger_seance: { ok: true },
    };
    let e = document.getElementById('volet-ensemble');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    window.__e.chargerGestion([{ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }]);
  }, { a: MOD_PL, b: MOD_IA });
  await pause(p, 150);
  const g = await p.evaluate(() => ({
    titres: [...document.querySelectorAll('#gs-liste .gs-module')].map((x) => x.textContent),
    ordre: [...document.querySelectorAll('#gs-liste .gs-num')].map((x) => x.textContent).join(','),
  }));
  if (g.titres.length !== 3 || !/PlaylistApp.*1 séance/.test(g.titres[0]) ||
      !/Méca.*1 séance/.test(g.titres[1]) || !/^Sans module — 1 séance/.test(g.titres[2])) {
    rates.push(`séances par module : groupes « ${g.titres.join(' | ')} »`);
  }
  if (g.ordre !== '0,11,13') rates.push(`séances par module : ordre « ${g.ordre} »`);

  // Ranger la séance 13 dans Méca Forez.
  const lignes = await p.$$('#gs-liste .gs-l .gs-b');
  await lignes[2].click();
  await pause(p);
  const sel = await p.evaluate(() => ({
    visible: !document.getElementById('gs-module-l').hidden,
    valeur: document.getElementById('gs-module').value,
    options: document.getElementById('gs-module').options.length,
  }));
  if (!sel.visible || sel.valeur !== '' || sel.options !== 3) rates.push(`séances par module : sélecteur ${JSON.stringify(sel)}`);
  await p.selectOption('#gs-module', '3');
  await p.click('#b-gs-ok');
  await pause(p, 150);
  const rg = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'ranger_seance').map((x) => x.args));
  if (rg.length !== 1 || rg[0].p_seance_id !== 30 || rg[0].p_module_id !== 3) {
    rates.push(`séances par module : ranger_seance ${JSON.stringify(rg)}`);
  }

  // Modifier la séance 11 sans changer son module : aucun rangement.
  const l2 = await p.$$('#gs-liste .gs-l .gs-b');
  await l2[1].click();
  await pause(p);
  const v11 = await p.evaluate(() => document.getElementById('gs-module').value);
  if (v11 !== '3') rates.push(`séances par module : la séance 11 affiche le module « ${v11} », attendu 3`);
  await p.click('#b-gs-ok');
  await pause(p, 150);
  const rg2 = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'ranger_seance').length);
  if (rg2 !== 1) rates.push(`séances par module : ranger_seance appelée sans changement de module (${rg2} appels)`);

  // Nouvelle séance, deux modules : le choix est obligatoire.
  await p.click('#b-gs-neuve');
  await pause(p);
  const neuf = await p.evaluate(() => ({ req: document.getElementById('gs-module').required,
    v: document.getElementById('gs-module').value,
    t: document.getElementById('gs-module').options[0].textContent }));
  if (!neuf.req || neuf.v !== '' || !/Choisir/.test(neuf.t)) rates.push(`séances par module : nouvelle séance ${JSON.stringify(neuf)}`);

  if (erreurs.length) rates.push(`séances par module : ${erreurs.join(' | ')}`);
  console.log(`── séances par module : ${g.titres.join(' | ')}`);
  await fermer();
}

await nav.close();
if (rates.length) {
  console.log('\n✗ ' + rates.length + ' défaut(s) :');
  rates.forEach((r) => console.log('  · ' + r));
  process.exit(1);
}
console.log('\n✓ Missions : cocher, décocher, séance fermée, grille par élève, éditeur ;\n' +
            '  séances : liste, formulaire prérempli, verrous, échéance envoyée ;\n' +
            '  modules : par module des deux côtés, sans dépôt enseignant chez l\'étudiant,\n' +
            '  rangement d\'une séance seulement quand son module change.');
