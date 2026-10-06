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
    let e = document.getElementById('carte-suivi');
    while (e) { e.hidden = false; e = e.parentElement; }
    // La grille vit dans la vue « Élèves » de la séance (28/09).
    window.__e.ouvrirVue('eleves');
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
  if (r.barres !== 5) rates.push(`${w} px : ${r.barres} barres, attendu 5`);
  if (r.debord > 0) rates.push(`${w} px : la grille fait déborder la page de ${r.debord} px`);

  // L'éditeur des missions n'est plus ici (28/09) : il vit dans la fiche de
  // la séance, sous Préparer — section 7. Le direct ne garde qu'un lien.
  const lien = await p.evaluate(() => !!document.querySelector('#bloc-missions .vers-prep[data-onglet="missions"]'));
  if (!lien) rates.push(`${w} px : la grille n'offre pas le chemin vers l'éditeur des missions (Préparer)`);

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
    let e = document.getElementById('volet-quest');
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
  if (!liste.meta[1] || !/5 missions/.test(liste.meta[1]) || !/cachée/.test(liste.meta[1])) {
    rates.push(`séances : la ligne de la séance 11 dit « ${liste.meta[1]} »`);
  }

  // Le geste d'état sur la ligne (05/10) : un projet fermé s'ouvre d'ici,
  // sans formulaire ; un projet ouvert se ferme, différé.
  const gestesLigne = await p.evaluate(() => [...document.querySelectorAll('#gs-liste .gs-l')]
    .map((l) => [...l.querySelectorAll('.gs-actes button')].map((b) => b.textContent).join('|')));
  if (gestesLigne[0] !== 'Clore|Suivre ›|Modifier') rates.push(`séances : gestes du TP0 ouvert « ${gestesLigne[0]} »`);
  if (gestesLigne[1] !== 'Ouvrir|Suivre ›|Modifier') rates.push(`séances : gestes de l'IA 1 fermée « ${gestesLigne[1]} »`);
  await p.evaluate(() => {
    const sb = window.__e.sb, avant = sb.from;
    window.__fromAvant = avant;
    sb.from = function(){
      const ch = { then: (ok, ko) => Promise.resolve({ data: [{ id: 25, classe_id: 2, numero: 11, titre: 'IA 1',
        nature: 'projet', jalons: 5, echeance: '2026-10-16', duree_min: 180, publiee: false, ouverte: false }],
        error: null }).then(ok, ko) };
      ['select', 'eq', 'order'].forEach((m) => { ch[m] = () => ch; });
      return ch;
    };
    window.__appels.length = 0;
  });
  if (/^Ouvrir\|/.test(gestesLigne[1] || '')) {
    await p.click('#gs-liste .gs-l:nth-child(2) .gs-a:text("Ouvrir")');
    await pause(p, 200);
  }
  const ouvre = await p.evaluate(() => {
    window.__e.sb.from = window.__fromAvant;
    return window.__appels.filter((a) => a.nom === 'enregistrer_seance').map((a) => a.args);
  });
  if (ouvre.length !== 1 || ouvre[0].p_ouverte !== true || ouvre[0].p_publiee !== true || ouvre[0].p_seance_id !== 25) {
    rates.push(`séances : « Ouvrir » sur la ligne → ${JSON.stringify(ouvre)}`);
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
    let e = document.getElementById('volet-quest');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    // Repliée depuis le 28/09 (on la règle rarement) : on la déplie comme on le ferait.
    document.getElementById('carte-modules').open = true;
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
    let e = document.getElementById('volet-quest');
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

  // Modifier la séance 11 sans changer son module : aucun rangement. Après un
  // enregistrement, la fiche reste ouverte sur la séance (28/09) : sur un
  // téléphone, on revient d'abord à la liste.
  if (await p.isVisible('#b-gs-retour')) await p.click('#b-gs-retour');
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

// ─── 7. Préparer : la fiche d'une séance ───────────────────────────────────
// Liste + détail : Modifier ouvre la fiche, ses onglets suivent la nature,
// « Prête à démarrer ? » dit ce qui manque, les éditeurs se préremplissent
// avec la base et écrivent sur la séance PRÉPARÉE — jamais sur celle qu'on
// suit en direct.
for (const w of [390, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  await p.evaluate(({ m }) => {
    window.__reponses = {
      seances_de_classe: { ok: true, liste: [
        { id: 25, numero: 11, titre: 'IA 1', nature: 'projet', jalons: 5, module_id: 3, echeance: null,
          ouverte: false, publiee: false, missions: 5, corriges: 0, reponses: 3 },
        { id: 26, numero: 3, titre: 'Séance 3', nature: 'cours', jalons: null, module_id: null,
          ouverte: false, publiee: false, missions: 0, corriges: 10, reponses: 0 },
      ] },
      preflight_seance: { ok: true, nature: 'projet', jalons: 5, echeance: null, questions: 0 },
      controle_seance: { ok: true, notions: 2, ouvert: false, termines: 0, inscrits: 13, lignes: [
        { cle: 'pre-02', intitule: 'Deux ?', options: ['a', 'b', 'c'], bonne: 'C' },
        { cle: 'pre-01', intitule: 'Un ?', options: ['x', 'y'], bonne: 'A' } ] },
      grille_missions: { ok: true, declarees: true, missions: m.map((x) => ({ cle: x.cle, libelle: x.libelle, niveau: x.niveau, verbe: x.verbe })) },
      debriefing: { ok: true, concepts: [{ intitule: 'Client', detail: 'il demande', questions: [1, 2] }] },
      definir_missions: { ok: true, missions: 2 },
      ouvrir_controle: { ok: true },
    };
    let e = document.getElementById('volet-quest');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    window.__e.suivi.seanceId = 999;   // la séance suivie en direct : elle ne doit pas bouger
    window.__e.chargerGestion([{ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }]);
  }, { m: MISSIONS });
  await pause(p, 200);
  await p.click('#gs-liste .gs-l:nth-of-type(1) .gs-b');
  await pause(p, 250);
  const f = await p.evaluate(() => ({
    ouverte: !document.getElementById('gs-fiche').hidden,
    listeCachee: getComputedStyle(document.querySelector('.gs-colonne')).display === 'none',
    onglets: ['infos', 'controle', 'concepts', 'missions'].map((k) => document.getElementById('gsb-' + k).hidden ? 0 : 1).join(''),
    pret: document.getElementById('gs-pret').textContent,
    mi: document.getElementById('mi-texte').value.split('\n'),
    ct: document.getElementById('ct-texte').value.split('\n'),
    prep: window.__e.suivi.prep,
    debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  if (!f.ouverte) rates.push(`${w} px (préparer) : la fiche ne s'ouvre pas`);
  if (w === 390 && !f.listeCachee) rates.push('390 px (préparer) : sur un téléphone, la fiche ne prend pas la place de la liste');
  if (w === 1280 && f.listeCachee) rates.push('1280 px (préparer) : au bureau, la liste disparaît quand la fiche s\'ouvre');
  if (f.onglets !== '1101') rates.push(`${w} px (préparer) : onglets d'un projet ${f.onglets}, attendu Infos, Contrôle, Missions`);
  if (!/Prête à démarrer/.test(f.pret) || !/Pas d'échéance/.test(f.pret) || !/pas encore proposé/.test(f.pret)) {
    rates.push(`${w} px (préparer) : « Prête à démarrer ? » dit « ${f.pret} »`);
  }
  if (f.mi.length !== 5 || !f.mi[0].startsWith('🟢') || !f.mi[4].includes('[Mesurer]')) rates.push(`${w} px (préparer) : missions préremplies ${f.mi.length} ligne(s)`);
  if (f.ct[0] !== 'Un ? · *x · y' || f.ct[1] !== 'Deux ? · a · b · *c') rates.push(`${w} px (préparer) : contrôle prérempli « ${f.ct.join(' / ')} »`);
  if (String(f.prep) !== '25') rates.push(`${w} px (préparer) : suivi.prep = ${f.prep}`);
  if (f.debord > 0) rates.push(`${w} px (préparer) : la page déborde de ${f.debord} px`);

  // Enregistrer les missions : sur la séance préparée (25), pas sur la suivie (999).
  await p.click('#gsb-missions');
  await p.fill('#mi-texte', '🟢 Une [Concevoir]\n🔴 Deux');
  await p.click('#b-mi-creer');
  await pause(p, 150);
  const env = await p.evaluate(() => {
    const a = window.__appels.filter((x) => x.nom === 'definir_missions').pop();
    return { id: a && a.args.p_seance_id, texte: a && a.args.p_texte, msg: document.getElementById('err-mi-neuf').textContent,
             suivie: window.__e.suivi.seanceId };
  });
  if (env.id !== 25 || env.texte !== '🟢 Une [Concevoir]\n🔴 Deux') rates.push(`${w} px (préparer) : definir_missions(${env.id}, « ${env.texte} »)`);
  if (!/2 missions enregistrées/.test(env.msg)) rates.push(`${w} px (préparer) : confirmation « ${env.msg} »`);
  if (env.suivie !== 999) rates.push(`${w} px (préparer) : la séance suivie a changé (${env.suivie})`);
  await p.evaluate(() => { window.__reponses.definir_missions = { ok: false, motif: 'cochee',
    detail: 'Mission(s) déjà cochée(s), impossibles à retirer : tp11-m5' }; });
  await p.click('#b-mi-creer');
  await pause(p, 150);
  const refus = await p.evaluate(() => document.getElementById('err-mi-neuf').textContent);
  if (!/tp11-m5/.test(refus)) rates.push(`${w} px (préparer) : le refus ne dit pas quelle mission (« ${refus} »)`);

  // Proposer le contrôle depuis la fiche.
  await p.click('#gsb-controle');
  await p.click('#b-pr-ctl');
  await pause(p, 150);
  const ctl = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'ouvrir_controle').map((x) => x.args).pop());
  if (!ctl || ctl.p_seance_id !== 25 || ctl.p_ouvert !== true) rates.push(`${w} px (préparer) : ouvrir_controle ${JSON.stringify(ctl)}`);

  // Retour à la liste.
  if (w === 390) {
    await p.click('#b-gs-retour');
    const retour = await p.evaluate(() => ({ fiche: document.getElementById('gs-fiche').hidden, prep: window.__e.suivi.prep }));
    if (!retour.fiche || retour.prep) rates.push(`390 px (préparer) : « ‹ Les séances » laisse la fiche ${JSON.stringify(retour)}`);
  }
  if (erreurs.length) rates.push(`${w} px (préparer) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · préparer : onglets ${f.onglets} · missions ${f.mi.length} · contrôle ${f.ct.length} notions`);
  await fermer();
}

// ─── 8. Le planning (06/10, lot 2) ─────────────────────────────────────────
// Le bloc « Quand » de la fiche : prérempli à l'heure de la salle, envoyé à
// planifier_seance() SEULEMENT s'il a changé, refusé avant tout envoi s'il
// est à moitié rempli, absent sur une séance d'avant la migration. Le
// prochain créneau libre saute les créneaux déjà pris, et un second clic
// passe au suivant. La carte « L'emploi du temps » réécrit d'un coup et
// propose de mettre l'automate en marche quand il est à l'arrêt.
for (const w of [390, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  await p.evaluate(() => {
    // Les deux prochains créneaux (lundi et mardi, 15:00) sont déjà pris.
    const prochain = (iso) => { const d = new Date(); d.setHours(15, 0, 0, 0);
      while (((d.getDay() + 6) % 7 + 1) !== iso || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d; };
    const plus = (d, h) => new Date(d.getTime() + h * 3600000).toISOString();
    const lun = prochain(1), mar = prochain(2);
    window.__pris = [lun.toISOString(), mar.toISOString()];
    const L = (o) => Object.assign({ nature: 'projet', jalons: 4, echeance: '2026-10-16', duree_min: 120, ouverte: false,
      publiee: false, missions: 4, corriges: 0, reponses: 0, module_id: null, demarree_le: null, prevue_le: null,
      fin_prevue: null, auto_ouvrir: false, auto_clore: false, manque: [] }, o);
    window.__reponses = {
      seances_de_classe: { ok: true, liste: [
        L({ id: 25, numero: 21, titre: 'Projet IA (1/2)', etat: 'programmee', prevue_le: lun.toISOString(), fin_prevue: plus(lun, 2),
            auto_ouvrir: true, auto_clore: true }),
        L({ id: 26, numero: 22, titre: 'Projet IA (2/2)', etat: 'prete' }),
        L({ id: 27, numero: 23, titre: 'Projet IA (3/2)', etat: 'programmee', prevue_le: mar.toISOString(), fin_prevue: plus(mar, 2) })] },
      emploi_du_temps: { ok: true, automatique: false, pg_cron: true, classes: [
        { id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM',
          creneaux: [{ jour: 1, debut: '15:00', fin: '17:00' }, { jour: 2, debut: '15:00', fin: '17:00' }] }] },
      enregistrer_seance: { ok: true, id: 25, cree: false },
      planifier_seance: { ok: true, etat: 'programmee' },
      definir_creneaux: { ok: true, creneaux: 1 },
      activer_planification: { ok: true, automatique: true } };
    let e = document.getElementById('volet-quest');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    const cl = [{ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }];
    window.__e.chargerGestion(cl);
    return window.__e.chargerEmploiDuTemps(cl);
  });
  await pause(p, 200);
  const liste = await p.evaluate(() => [...document.querySelectorAll('#gs-liste .gs-l')].map((l) =>
    ((l.querySelector('.gs-etat') || {}).textContent || '') + ' | ' + l.querySelector('.gs-meta').textContent));
  if (!/^Programmée \| .*15:00–17:00 \(ouverture et clôture auto\)/.test(liste[0] || '') || !/^Prête \| /.test(liste[1] || '')) {
    rates.push(`${w} px (planning) : lignes « ${liste.slice(0, 2).join(' / ')} »`);
  }

  // La fiche d'une séance programmée : préremplie, et rien ne part si rien ne change.
  await p.click('#gs-liste .gs-l:nth-child(1) .gs-b');
  await pause(p, 200);
  const f1 = await p.evaluate(() => ({ visible: !document.getElementById('gs-quand').hidden,
    jour: document.getElementById('gs-jour').value, debut: document.getElementById('gs-debut').value,
    fin: document.getElementById('gs-fin').value, ao: document.getElementById('gs-auto-ouvrir').checked,
    note: document.getElementById('gs-auto-note').textContent,
    attendu: (() => { const d = new Date(window.__pris[0]); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })() }));
  if (!f1.visible || f1.jour !== f1.attendu || f1.debut !== '15:00' || f1.fin !== '17:00' || !f1.ao) {
    rates.push(`${w} px (planning) : fiche préremplie ${JSON.stringify(f1)}`);
  }
  if (!/à l'arrêt/.test(f1.note)) rates.push(`${w} px (planning) : option cochée, automate à l'arrêt, et rien ne le dit (« ${f1.note} »)`);
  await p.evaluate(() => { window.__appels.length = 0; });
  await p.click('#b-gs-ok');
  await pause(p, 200);
  let ap = await p.evaluate(() => window.__appels.map((x) => x.nom));
  if (ap.includes('planifier_seance') || !ap.includes('enregistrer_seance')) rates.push(`${w} px (planning) : sans changement → ${ap.join(', ')}`);

  // L'heure change : planifier_seance() part, avec l'instant de la salle. La
  // fiche est restée ouverte sur la séance (sur un téléphone, à la place de la liste).
  await pause(p, 150);
  await p.fill('#gs-debut', '15:30');
  await p.evaluate(() => { document.getElementById('gs-debut').dispatchEvent(new Event('change')); window.__appels.length = 0; });
  await p.click('#b-gs-ok');
  await pause(p, 250);
  const pl = await p.evaluate(() => ({ a: window.__appels.filter((x) => x.nom === 'planifier_seance').map((x) => x.args)[0],
    attendu: new Date(new Date(window.__pris[0]).getTime() + 30 * 60000).toISOString() }));
  if (!pl.a || pl.a.p_seance_id !== 25 || pl.a.p_prevue_le !== pl.attendu || pl.a.p_auto_ouvrir !== true || pl.a.p_auto_clore !== true) {
    rates.push(`${w} px (planning) : planifier_seance ${JSON.stringify(pl.a)}, attendu début ${pl.attendu}`);
  }

  // Une séance sans date : le prochain créneau libre saute les deux pris ; un second clic avance.
  await p.evaluate(() => document.querySelector('#gs-liste .gs-l:nth-child(2) .gs-b').click());
  await pause(p, 150);
  const lire = () => p.evaluate(() => ({ jour: document.getElementById('gs-jour').value, debut: document.getElementById('gs-debut').value,
    fin: document.getElementById('gs-fin').value, inactif: document.getElementById('gs-auto-ouvrir').disabled }));
  const vide = await lire();
  await p.click('#b-gs-creneau');
  const c1 = await lire();
  await p.click('#b-gs-creneau');
  const c2 = await lire();
  const verdict = await p.evaluate(({ c1, c2 }) => {
    const t = (c) => new Date(c.jour + 'T' + c.debut).getTime();
    const pris = window.__pris.map((x) => Date.parse(x));
    const jourIso = (c) => (new Date(c.jour + 'T12:00').getDay() + 6) % 7 + 1;
    return { libre1: !pris.includes(t(c1)), libre2: !pris.includes(t(c2)), avance: t(c2) > t(c1),
             jours: [jourIso(c1), jourIso(c2)], apres: t(c1) > Math.max(...pris) };
  }, { c1, c2 });
  if (vide.jour || !vide.inactif) rates.push(`${w} px (planning) : séance sans date ${JSON.stringify(vide)} (options actives sans créneau ?)`);
  if (c1.debut !== '15:00' || c1.fin !== '17:00' || !verdict.libre1 || !verdict.libre2 || !verdict.avance || !verdict.apres ||
      verdict.jours.some((j) => j !== 1 && j !== 2) || c1.inactif) {
    rates.push(`${w} px (planning) : prochain créneau ${JSON.stringify(c1)} puis ${JSON.stringify(c2)} — ${JSON.stringify(verdict)}`);
  }
  // À moitié rempli : refusé avant d'écrire quoi que ce soit.
  await p.fill('#gs-debut', '');
  await p.evaluate(() => { window.__appels.length = 0; });
  await p.click('#b-gs-ok');
  await pause(p, 120);
  const moitie = await p.evaluate(() => ({ a: window.__appels.map((x) => x.nom), msg: document.getElementById('err-gs').textContent }));
  if (moitie.a.length || !/jour ET l'heure de début/.test(moitie.msg)) rates.push(`${w} px (planning) : jour sans heure → ${JSON.stringify(moitie)}`);
  // Une séance lue sans `etat` (migration absente) : pas de bloc.
  const ancien = await p.evaluate(() => window.__e.remplirPlanning({ id: 9, numero: 1, titre: 'x' }, 2, [])
    .then(() => document.getElementById('gs-quand').hidden));
  if (!ancien) rates.push(`${w} px (planning) : le bloc « Quand » s'affiche pour une séance que la base ne sait pas programmer`);

  // L'emploi du temps.
  const edt = await p.evaluate(() => ({ visible: !document.getElementById('carte-edt').hidden,
    texte: document.getElementById('edt-texte').value, resume: document.getElementById('edt-resume').textContent,
    auto: !document.getElementById('b-edt-auto').hidden }));
  if (!edt.visible || edt.texte !== 'lundi 15:00-17:00\nmardi 15:00-17:00' || edt.resume !== '2 créneaux' || !edt.auto) {
    rates.push(`${w} px (planning) : emploi du temps ${JSON.stringify(edt)}`);
  }
  await p.evaluate(() => { const d = document.getElementById('carte-edt'); d.open = true; window.__appels.length = 0; });
  await p.fill('#edt-texte', 'lundi 15h-17h');
  await p.click('#b-edt-ok');
  await pause(p, 150);
  await p.click('#b-edt-auto');
  await pause(p, 150);
  const ec = await p.evaluate(() => window.__appels.map((x) => x.nom + ' ' + JSON.stringify(x.args || {})));
  if (!ec.some((x) => x === 'definir_creneaux {"p_classe_id":2,"p_texte":"lundi 15h-17h"}') || !ec.some((x) => /^activer_planification/.test(x))) {
    rates.push(`${w} px (planning) : emploi du temps → ${ec.join(' | ')}`);
  }
  const cibles = await p.evaluate(() => [...document.querySelectorAll('#gs-quand button, #gs-quand input, #carte-edt button')]
    .filter((x) => x.offsetParent && x.type !== 'checkbox').filter((x) => x.getBoundingClientRect().height < 44).map((x) => x.id || x.textContent));
  if (cibles.length) rates.push(`${w} px (planning) : cibles sous 44 px — ${cibles.join(', ')}`);
  const debord = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (debord > 0) rates.push(`${w} px (planning) : la page déborde de ${debord} px`);
  if (erreurs.length) rates.push(`${w} px (planning) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · planning : ${liste[0]} · prochain ${c1.jour} ${c1.debut} puis ${c2.jour} · emploi du temps ${edt.resume}`);
  await fermer();
}

// ─── 9. La mise en place (06/10, lot 3) ────────────────────────────────────
// La semaine à préparer : une ligne par créneau, l'état et ce qui manque,
// chaque manque menant à l'onglet de la page qui le règle ; un créneau vide
// reçoit une séance d'un choix (planifier_seance sur CE créneau). Les actions
// groupées : la barre n'apparaît qu'avec une case cochée, grise ce qui ne
// s'applique à aucune, « Programmer à la suite » envoie les séances choisies
// dans l'ordre et dit celles qui n'ont pas été programmées ; « Clore » part
// après cinq secondes, sauf « Annuler ». L'assistant lit le mkdocs.yml du
// dépôt, écrit à chaque étape (module, puis séances d'un seul appel), et mène
// à la page de chaque séance. La reconduction n'écrit qu'au second geste,
// pour les valeurs de l'aperçu.
const MKDOCS = 'site_name: Cours d\'essai\nsite_url: https://ggaillard.github.io/essai/\nnav:\n' +
  '  - Accueil: index.md\n  - Séances:\n      - "1 — « Premier »": seances/seance-01.md\n' +
  '      - "2 — Second": seances/seance-02.md\n      - TP: tp/tp3.md\n  - Progression: progression.md\n';
for (const w of [390, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  await p.route('https://raw.githubusercontent.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: MKDOCS }));
  await p.evaluate(() => {
    const iso = (j, h) => { const d = new Date(); d.setDate(d.getDate() + j); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    window.__tables = { classes: [{ id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV' },
                                  { id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }] };
    const L = (o) => Object.assign({ nature: 'cours', jalons: null, echeance: null, duree_min: 55, ouverte: false,
      publiee: false, missions: 0, corriges: 10, reponses: 0, module_id: 4, etat: 'prete', manque: [], demarree_le: null,
      prevue_le: null, fin_prevue: null, auto_ouvrir: false, auto_clore: false }, o);
    window.__iso = iso;
    window.__reponses = {
      seances_de_classe: { ok: true, liste: [L({ id: 31, numero: 5, titre: 'Séance 5' }),
        L({ id: 32, numero: 6, titre: 'Séance 6', ouverte: true, publiee: true, etat: 'ouverte' }),
        L({ id: 33, numero: 7, titre: 'Séance 7', etat: 'brouillon', manque: ['concepts'], prevue_le: iso(1, 10), fin_prevue: iso(1, 12) })] },
      modules_enseignant: { ok: true, classes: [{ classe_id: 1, modules: [
        { id: 4, titre: 'Bloc 1 DEV', icone: '💻', depot: 'https://github.com/a/b' },
        { id: 5, titre: 'Autre', icone: '📦', depot: 'https://github.com/a/c' }] }] },
      agenda: { ok: true, debut: new Date().toISOString().slice(0, 10), jours: 7, emploi_du_temps: true,
        creneaux: [{ classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', jour: iso(1, 12).slice(0, 10), debut_le: iso(1, 10), fin_le: iso(1, 12) },
                   { classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', jour: iso(3, 12).slice(0, 10), debut_le: iso(3, 10), fin_le: iso(3, 12) }],
        seances: [Object.assign(L({ id: 33, numero: 7, titre: 'Séance 7', etat: 'brouillon', manque: ['concepts', 'module'] }),
          { classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', prevue_le: iso(1, 10), fin_prevue: iso(1, 12) })],
        a_placer: [{ id: 31, classe_id: 1, numero: 5, titre: 'Séance 5', etat: 'prete' },
                   { id: 50, classe_id: 2, numero: 9, titre: 'Autre classe', etat: 'prete' }] },
      programmer_seances: { ok: true, programmees: [{ id: 31, numero: 5, prevue_le: iso(1, 10), fin_prevue: iso(1, 12) }],
        ecartees: [{ id: 32, numero: 6, detail: 'déjà ouverte ou jouée : son créneau ne bouge pas' }] },
      planifier_seance: { ok: true }, publier_seance: { ok: true }, ranger_seance: { ok: true }, clore_seance: { ok: true },
      emploi_du_temps: { ok: true, classes: [{ id: 1, creneaux: [{ jour: 2, debut: '10:00', fin: '12:00' }] }] },
      enregistrer_module: { ok: true, id: 9, cree: true },
      creer_seances: { ok: true, creees: 3, liste: [{ id: 41, numero: 1, titre: '« Premier »' },
        { id: 42, numero: 2, titre: 'Second' }, { id: 43, numero: 3, titre: 'TP' }] },
      reconduire_classe: { ok: true, essai: true, code: 'BTS1-DEV-2027', nom: 'BTS SIO 1 - Bloc 1 DEV', annee: '2027-2028',
        compte: { modules: 1, seances: 14, corriges: 140, concepts: 60, missions: 0, passages: 5, projets: 2 } },
    };
    return window.__e.ouvrirEspaceEnseignant();
  });
  await pause(p, 900);
  await p.click('#ong-quest');
  await pause(p, 400);

  // La semaine à préparer.
  const av = await p.evaluate(() => ({
    visible: !document.getElementById('carte-avenir').hidden,
    resume: document.getElementById('av-resume').textContent,
    jours: document.querySelectorAll('#av-liste .av-jour').length,
    liens: [...document.querySelectorAll('#av-liste a')].map((a) => a.getAttribute('href')),
    choix: [...document.querySelectorAll('#av-liste select option')].map((o) => o.value).join(','),
  }));
  if (!av.visible || av.jours !== 2 || !/2 créneaux · 0 séance prête · 1 à régler · 1 créneau vide/.test(av.resume)) {
    rates.push(`${w} px (semaine) : ${JSON.stringify(av)}`);
  }
  if (av.liens.join(' ') !== '#s/33/preparer #s/33/preparer/concepts #s/33/preparer/infos') {
    rates.push(`${w} px (semaine) : liens ${av.liens.join(' ')} — attendu la page, puis l'onglet de chaque manque`);
  }
  if (av.choix !== ',31') rates.push(`${w} px (semaine) : le créneau du BTS1 propose « ${av.choix} » (une séance d'une autre classe ?)`);
  await p.selectOption('#av-liste select', '31');
  await pause(p, 250);
  const pl = await p.evaluate(() => ({ a: window.__appels.filter((x) => x.nom === 'planifier_seance').map((x) => x.args),
    attendu: window.__reponses.agenda.creneaux[1].debut_le }));
  if (pl.a.length !== 1 || pl.a[0].p_seance_id !== 31 || pl.a[0].p_prevue_le !== pl.attendu) {
    rates.push(`${w} px (semaine) : placer → ${JSON.stringify(pl.a)} (créneau ${pl.attendu})`);
  }

  // Les actions groupées.
  const sansChoix = await p.evaluate(() => document.getElementById('gs-lot').hidden);
  if (!sansChoix) rates.push(`${w} px (lot) : la barre est visible sans aucune séance choisie`);
  await p.evaluate(() => { const c = document.querySelectorAll('#gs-liste .gs-choix'); c[0].click(); c[1].click(); });
  await pause(p, 80);
  const barre = await p.evaluate(() => ({ visible: !document.getElementById('gs-lot').hidden,
    n: document.getElementById('gs-lot-n').textContent,
    gestes: [...document.querySelectorAll('#gs-lot [data-lot]')].map((b) => b.dataset.lot + (b.disabled ? '×' : '')).join(' '),
    module: document.querySelectorAll('#gs-liste .lot-mod').length }));
  if (!barre.visible || barre.n !== '2 séances choisies (5, 6)' ||
      barre.gestes !== 'programmer deprogrammer× montrer ouvrir× clore' || barre.module < 1) {
    rates.push(`${w} px (lot) : barre ${JSON.stringify(barre)}`);
  }
  await p.click('#gs-lot [data-lot="programmer"]');
  await pause(p, 350);
  const prog = await p.evaluate(() => ({ a: window.__appels.filter((x) => x.nom === 'programmer_seances').map((x) => x.args),
    msg: document.getElementById('err-gs-liste').textContent }));
  if (JSON.stringify(prog.a) !== '[{"p_ids":[31,32],"p_depuis":null}]' || !/Programmées à la suite : 5 /.test(prog.msg) ||
      !/Pas programmée : 6 — déjà ouverte/.test(prog.msg)) {
    rates.push(`${w} px (lot) : programmer → ${JSON.stringify(prog)}`);
  }
  // Clore, différé : avec « Annuler », rien ; sans, la séance ouverte seulement.
  await p.evaluate(() => { const c = document.querySelectorAll('#gs-liste .gs-choix'); c[0].click(); c[1].click(); });
  await pause(p, 60);
  await p.click('#gs-lot [data-lot="clore"]');
  await pause(p, 150);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#toasts button')].filter((x) => /Annuler/.test(x.textContent))[0]; if (b) b.click(); });
  await p.waitForTimeout(5600);
  const annule = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'clore_seance').length);
  if (annule) rates.push(`${w} px (lot) : « Annuler » n'a pas empêché la clôture (${annule} appel)`);
  await p.evaluate(() => { const c = document.querySelectorAll('#gs-liste .gs-choix'); if (!c[0].checked) c[0].click(); if (!c[1].checked) c[1].click(); });
  await pause(p, 60);
  await p.click('#gs-lot [data-lot="clore"]');
  await p.waitForTimeout(5800);
  const clos = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'clore_seance').map((x) => x.args.p_seance_id));
  if (JSON.stringify(clos) !== '[32]') rates.push(`${w} px (lot) : clore → ${JSON.stringify(clos)}, attendu la seule séance ouverte (32)`);

  // L'assistant « Nouveau module ».
  await p.click('#b-gs-module');
  await pause(p, 150);
  await p.fill('#as-depot', 'https://github.com/ggaillard/essai');
  await p.click('#b-as-lire');
  await pause(p, 400);
  const a1 = await p.evaluate(() => ({ ouvert: document.getElementById('as-dialog').open,
    titre: document.getElementById('as-titre-m').value, code: document.getElementById('as-code').value,
    site: document.getElementById('as-site').value, texte: document.getElementById('as-texte').value,
    etape: document.querySelector('#as-etapes [aria-current="step"]') && document.querySelector('#as-etapes [aria-current="step"]').textContent }));
  if (!a1.ouvert || a1.titre !== "Cours d'essai" || a1.code !== 'essai' || a1.site !== 'https://ggaillard.github.io/essai/' ||
      a1.texte !== '1 — « Premier »\n2 — Second\n3 — TP' || !/Le dépôt/.test(a1.etape || '')) {
    rates.push(`${w} px (assistant) : lecture du dépôt ${JSON.stringify(a1)}`);
  }
  await p.click('#b-as-suiv');
  await pause(p, 250);
  await p.click('#b-as-suiv');
  await pause(p, 300);
  const a2 = await p.evaluate(() => ({ pas: [1, 2, 3, 4].map((k) => document.getElementById('as-pas-' + k).hidden ? 0 : 1).join(''),
    mod: window.__appels.filter((x) => x.nom === 'enregistrer_module').map((x) => x.args),
    sea: window.__appels.filter((x) => x.nom === 'creer_seances').map((x) => x.args) }));
  if (a2.pas !== '0010' || a2.mod.length !== 1 || a2.mod[0].p_depot !== 'https://github.com/ggaillard/essai' || a2.mod[0].p_module_id !== null ||
      a2.sea.length !== 1 || a2.sea[0].p_module_id !== 9 || a2.sea[0].p_classe_id !== 1 || !/^1 — « Premier »\n2 — Second/.test(a2.sea[0].p_texte)) {
    rates.push(`${w} px (assistant) : étapes 1-2 ${JSON.stringify(a2)}`);
  }
  // Revenir en arrière ne recrée rien.
  await p.click('#b-as-prec');
  await pause(p, 80);
  await p.click('#b-as-suiv');
  await pause(p, 200);
  const deux = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'creer_seances').length);
  if (deux !== 1) rates.push(`${w} px (assistant) : revenir puis repartir a recréé les séances (${deux} appels)`);
  await p.click('#b-as-programmer');
  await pause(p, 250);
  const pg = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'programmer_seances').pop().args);
  if (JSON.stringify(pg.p_ids) !== '[41,42,43]' || pg.p_depuis !== new Date().toISOString().slice(0, 10)) {
    rates.push(`${w} px (assistant) : programmer ${JSON.stringify(pg)}`);
  }
  await p.click('#b-as-suiv');
  await pause(p, 150);
  const c4 = await p.evaluate(() => [...document.querySelectorAll('#as-contenus button')].map((b) => b.textContent).join('|'));
  if (c4 !== 'Concepts ›|Contrôle ›|Concepts ›|Contrôle ›|Concepts ›|Contrôle ›') rates.push(`${w} px (assistant) : contenus « ${c4} »`);
  await p.click('#as-contenus button');
  await pause(p, 300);
  const vers = await p.evaluate(() => ({ hash: location.hash, ouvert: document.getElementById('as-dialog').open }));
  if (vers.hash !== '#s/41/preparer/concepts' || vers.ouvert) rates.push(`${w} px (assistant) : « Concepts › » mène à ${JSON.stringify(vers)}`);

  // Reconduire : l'aperçu, puis l'écriture, pour les mêmes valeurs.
  await p.click('#ong-quest');
  await pause(p, 250);
  await p.evaluate(() => { document.getElementById('carte-modules').open = true; document.getElementById('rn-bloc').open = true; });
  await pause(p, 150);
  const rn0 = await p.evaluate(() => ({ code: document.getElementById('rn-code').value, ok: document.getElementById('b-rn-ok').hidden }));
  if (rn0.code !== 'BTS1-DEV-2027' || !rn0.ok) rates.push(`${w} px (reconduire) : ${JSON.stringify(rn0)}`);
  await p.click('#b-rn-voir');
  await pause(p, 200);
  await p.fill('#rn-code', 'BTS1-DEV-2028');
  const cache = await p.evaluate(() => document.getElementById('b-rn-ok').hidden);
  if (!cache) rates.push(`${w} px (reconduire) : changer le code laisse le bouton qui écrit`);
  await p.click('#b-rn-voir');
  await pause(p, 200);
  await p.click('#b-rn-ok');
  await pause(p, 200);
  const rn = await p.evaluate(() => window.__appels.filter((x) => x.nom === 'reconduire_classe').map((x) => x.args.p_ecrire + ':' + x.args.p_code));
  if (rn.join(' ') !== 'false:BTS1-DEV-2027 false:BTS1-DEV-2028 true:BTS1-DEV-2028') rates.push(`${w} px (reconduire) : ${rn.join(' ')}`);

  const debord = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (debord > 0) rates.push(`${w} px (mise en place) : la page déborde de ${debord} px`);
  if (erreurs.length) rates.push(`${w} px (mise en place) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · mise en place : ${av.resume} · lot ${barre.gestes} · assistant ${a2.pas} · reconduire ${rn.length} appels`);
  await fermer();
}

// lireMkdocs(), seul : les pages qui ne sont pas des séances sont écartées.
{
  const { page: p, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const m = await p.evaluate((t) => window.__e.lireMkdocs(t), MKDOCS + 'extra:\n  - "9 — pas dans nav": x.md\n');
  if (m.titre !== "Cours d'essai" || m.seances.map((s) => s.numero + ':' + s.titre).join('|') !== '1:« Premier »|2:Second|3:TP') {
    rates.push(`lireMkdocs : ${JSON.stringify(m)}`);
  }
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
            '  rangement d\'une séance seulement quand son module change ;\n' +
            '  préparer : fiche liste + détail, éditeurs préremplis sur la séance préparée ;\n' +
            '  mise en place : semaine à préparer, actions groupées, assistant, reconduction.');
