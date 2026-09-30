#!/usr/bin/env node
// ── Les deux écrans qu'on pilote au téléphone ─────────────────────────────
//
//     npx playwright install chromium
//     node outils/t_pilotage.mjs        # depuis la racine du dépôt
//
// « Ce qui bloque » et l'onglet Préparer ont la même contrainte : on les
// touche debout, entre deux heures, sur un téléphone. Deux exigences donc, et
// elles se mesurent :
//
//   · un geste nommé doit être FAISABLE depuis la carte. Jusqu'au 16/09, « Le
//     geste : Clore la séance » était du texte : il fallait ensuite changer
//     d'onglet, choisir la classe, choisir la séance, trouver le bouton.
//     Quatre gestes pour exécuter celui qui était écrit. Une carte qui nomme
//     le geste sans le rendre possible informe ; elle ne débloque pas.
//
//   · l'onglet Préparer tenait sur 2 778 px à 390 px pour trois
//     questionnaires — sept écrans — parce que chaque modèle affichait TOUTES
//     les classes, y compris celles où il n'est pas donné. Les lignes des
//     classes non concernées coûtaient plus cher que les autres.
//
// Il n'appelle pas la base : le portail est SERVI par outils/serveur.mjs et la
// fausse couche Supabase est substituée au passage sur le réseau — voir
// outils/portail.mjs. Ce qu'on vérifie est le gabarit et le câblage des
// boutons, pas les données, mais le portail vérifié est celui du dépôt.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const PLAFOND_390 = 2100;   // arbitraire ; ce qui compte est qu'il ne remonte pas

// Une séance oubliée ouverte (réglable d'un clic) et une classe sans projet
// (qui ne se règle pas d'un clic : il faut saisir un lien).
const AFAIRE = { ok: true, bloquants: 0, attentions: 2, agissables: 1, taches: [
  // Celle-ci ne demande rien : elle se règle d'elle-même. Elle ne doit donc
  // pas occuper une ligne de tâche — sinon elle dilue les deux qui suivent.
  { classe: 'BTS SIO 1 - Bloc 1 DEV', code: 'BTS1-DEV-2026', classe_id: 1,
    gravite: 'info', quoi: 'Question du jour pas encore créée',
    detail: 'Elle se crée d’elle-même à la première connexion d’un étudiant.',
    geste: '', action: null, seance_id: null, aller: null },
  { classe: 'BTS SIO 1 - Bloc 1 DEV', code: 'BTS1-DEV-2026', classe_id: 1,
    gravite: 'attention', quoi: 'Séance 2 encore ouverte',
    detail: 'Démarrée il y a 11 h, bien au-delà de sa durée.',
    geste: 'Clore la séance', action: 'clore', seance_id: 11, aller: null },
  { classe: 'BTS SIO 2 - SLAM', code: 'BTS2-SLAM-2026', classe_id: 2,
    gravite: 'attention', quoi: 'Aucun projet associé',
    detail: 'Les étudiants s’identifient, puis ne trouvent aucun support.',
    geste: 'Ajouter au moins un lien de projet', action: null, seance_id: null,
    aller: 'ensemble' },
]};

const aff = (id, classe_id, code, nom, numero, ouvert, inscrits, commences, termines) =>
  ({ seance_id: id, classe_id, code, nom, numero, ouvert, inscrits, commences,
     termines, rattachee_a: null });

const BIB = { ok: true,
  modeles: [
    { id: 1, cle: 'connaissance', titre: 'Faisons connaissance', intro: '',
      mode: 'sequentiel', questions: 12,
      affectations: [aff(31, 1, 'BTS1-DEV-2026', 'BTS SIO 1 - Bloc 1 DEV', 98, true, 31, 19, 14)] },
    { id: 2, cle: 'stage', titre: 'Recherche de stage', intro: '',
      mode: 'revisable', questions: 6,
      affectations: [aff(32, 2, 'BTS2-SLAM-2026', 'BTS SIO 2 - SLAM', 97, true, 13, 9, 6)] },
    { id: 3, cle: 'revision-poo-tp1', titre: "Réviser l'interro — Console & POO",
      intro: '', mode: 'revision', questions: 12,
      affectations: [aff(34, 2, 'BTS2-SLAM-2026', 'BTS SIO 2 - SLAM', 90, true, 13, 3, 1)] },
  ],
  classes: [
    { classe_id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV', poses: [],
      seances: [{ seance_id: 11, numero: 2, titre: 'Séance 2', en_cours: true }] },
    { classe_id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM', poses: [],
      seances: [{ seance_id: 3, numero: 2, titre: 'TP2', en_cours: false }] },
  ]};

const CTRL = [{ seance_id: 3, classe_id: 2, code: 'BTS2-SLAM-2026',
  classe: 'BTS SIO 2 - SLAM', numero: 2, titre: 'TP2', nature: 'projet',
  notions: 8, ouvert: false, repondu: 0, inscrits: 13, demarree: false }];

const rates = [];
const nav = await chromium.launch();

for (const [w, nom] of [[390, 'téléphone'], [1280, 'bureau']]) {
  const { page: p, erreurs: err, police, fermer } = await ouvrir(nav, RACINE, { largeur: w });

  const r = await p.evaluate(({ AFAIRE, BIB, CTRL }) => {
    let e = document.getElementById('volet-quest');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.querySelectorAll('.volet').forEach((v) => { v.hidden = true; });
    document.getElementById('volet-quest').hidden = false;
    document.getElementById('carte-afaire').hidden = false;
    document.getElementById('carte-controles').hidden = false;
    document.getElementById('carte-qactifs').hidden = false;

    window.__e.rendreAFaire(AFAIRE);
    window.__e.BIB.classes = BIB.classes;
    window.__e.rendreControles(CTRL);
    window.__e.rendreBibliotheque(BIB.modeles);

    const h = (s) => { const x = document.querySelector(s); return x ? Math.round(x.getBoundingClientRect().height) : 0; };

    // ── « Ce qui bloque » : le geste est-il faisable ? ────────────────────
    const lignes = [...document.querySelectorAll('.af-l')];
    const boutons = lignes.map((l) => [...l.querySelectorAll('.af-actes .btn')].map((b) => b.textContent.trim()));
    window.__appels.length = 0;
    const clore = lignes[0] && lignes[0].querySelector('.af-actes .btn');
    if (clore) clore.click();

    // ── Questionnaires : ce qui reste dehors ─────────────────────────────
    const petits = [];
    document.querySelectorAll('#volet-quest button, #volet-quest summary, #volet-quest select, .af-actes .btn')
      .forEach((b) => {
        const q = b.getBoundingClientRect();
        if (!q.width) return;
        const st = getComputedStyle(b, '::after');
        let ht = q.height;
        if (st.content && st.content !== 'none' && st.position === 'absolute') {
          ht = q.height - (parseFloat(st.top) || 0) - (parseFloat(st.bottom) || 0);
        }
        if (ht < 44) petits.push((b.textContent || b.id).trim().slice(0, 28) + ' (' + Math.round(ht) + ' px)');
      });

    return {
      boutons,
      lignes: lignes.length,
      infos: [...document.querySelectorAll('#af-liste .af-info b')].map((x) => x.textContent.trim()),
      afaire: h('#carte-afaire'),
      appels: window.__appels.map((a) => a.nom + ' ' + JSON.stringify(a.args)),
      quest: h('#volet-quest'),
      lignesClasse: [...document.querySelectorAll('.qn-c')].map((x) => Math.round(x.getBoundingClientRect().height)),
      // Une ligne de classe ne doit apparaître que là où le questionnaire est
      // donné : trois modèles, une classe chacun, donc trois lignes.
      nbLignesClasse: document.querySelectorAll('.qn-c').length,
      tiroirs: document.querySelectorAll('.qn-reg').length,
      supprimerDehors: document.querySelectorAll('.qn-tete .qn-sup').length,
      petits,
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, { AFAIRE, BIB, CTRL });

  console.log(`\n── ${nom} (${w} px) : onglet Préparer ${r.quest} px`);
  console.log('   carte « Ce qui bloque »      :', r.afaire, 'px ·', r.lignes,
              'ligne(s) de tâche ·', r.infos.length, 'information(s) en pied');
  console.log('   boutons de « Ce qui bloque » :', JSON.stringify(r.boutons));
  console.log('   appel déclenché              :', r.appels.join(' | ') || 'aucun');
  console.log('   lignes de classe             :', r.nbLignesClasse, '·', r.lignesClasse.join('/'), 'px');
  console.log('   tiroirs de réglages          :', r.tiroirs);

  if (!police) {
    rates.push(`${nom} : IBM Plex n'a pas été chargée — toutes les hauteurs mesurées ici sont fausses, ` +
               `et les plafonds ne veulent plus rien dire. Vérifiez l'accès à fonts.googleapis.com.`);
  }
  if (r.lignes !== 2) {
    rates.push(`${nom} : ${r.lignes} ligne(s) de tâche pour 2 gestes — l'information « Question du jour » occupe-t-elle encore une ligne pleine ?`);
  }
  if (r.infos.length !== 1 || !/Question du jour/.test(r.infos[0] || '')) {
    rates.push(`${nom} : le pied d'information ne porte pas « Question du jour » (${JSON.stringify(r.infos)}) — une information ne doit pas disparaître, seulement descendre`);
  }
  if (!r.boutons[0] || !r.boutons[0].length) {
    rates.push(`${nom} : la tâche « Séance encore ouverte » n'offre aucun bouton — le geste reste à faire ailleurs`);
  }
  if (!r.appels.some((a) => a.startsWith('clore_seance'))) {
    rates.push(`${nom} : le bouton n'appelle pas clore_seance (appels : ${r.appels.join(', ') || 'aucun'})`);
  }
  if (!r.appels.some((a) => /"p_seance_id":11/.test(a))) {
    rates.push(`${nom} : l'appel ne vise pas la séance 11 — un bouton qui agit sur la mauvaise séance est pire que pas de bouton`);
  }
  if (!r.boutons[1] || !r.boutons[1].length) {
    rates.push(`${nom} : la tâche sans action n'offre pas de bouton « y aller »`);
  }
  if (r.nbLignesClasse !== 3) {
    rates.push(`${nom} : ${r.nbLignesClasse} lignes de classe pour 3 affectations — les classes non concernées sont-elles encore affichées ?`);
  }
  if (r.tiroirs !== 3) rates.push(`${nom} : ${r.tiroirs} tiroir(s) de réglages, attendu 3`);
  if (r.supprimerDehors) rates.push(`${nom} : « Supprimer » est de nouveau à côté du titre`);
  if (r.petits.length) rates.push(`${nom} : cible(s) sous 44 px — ${r.petits.join(', ')}`);
  if (r.debord > 0) rates.push(`${nom} : la page déborde de ${r.debord} px`);
  if (err.length) rates.push(`${nom} : erreur JS — ${err[0]}`);
  if (w === 390 && r.quest > PLAFOND_390) {
    rates.push(`téléphone : l'onglet Préparer fait ${r.quest} px, plafond ${PLAFOND_390}`);
  }

  await fermer();
}

// ── Rattacher, détacher — des deux côtés (29/09) ───────────────────────────
// Le geste était rangé dans un tiroir, et on ne le trouvait pas. Désormais :
//   · la ligne d'une classe porte « Détacher » (rattaché) ou « Rattacher… »
//     (qui ouvre le tiroir sur le bon sélecteur) ;
//   · le tiroir règle ce que fait le rattachement à la fin de la séance, et
//     une date de visibilité — regler_questionnaire(), en un appel ;
//   · la fiche de la séance, sous Préparer, dit ce qui l'accompagne et
//     permet de détacher ou de rattacher sans quitter la séance.
{
  const BIB2 = JSON.parse(JSON.stringify(BIB));
  BIB2.modeles[2].affectations[0] = { ...BIB2.modeles[2].affectations[0],
    rattachee_a: 3, rattachee_numero: 2, rattachee_titre: 'TP2', reste_ouvert: true,
    visible_jusqu_au: '2026-10-12' };
  const { page: p, erreurs: err, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const r = await p.evaluate(async ({ BIB2 }) => {
    const attendre = (ms) => new Promise(ok => setTimeout(ok, ms));
    let e = document.getElementById('volet-quest');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('carte-qactifs').hidden = false;
    // Chaque geste relit la bibliothèque : elle doit rendre la même chose.
    window.__reponses = { bibliotheque: BIB2 };
    window.__e.BIB.classes = BIB2.classes;
    window.__e.rendreBibliotheque(BIB2.modeles);
    const lignes = [...document.querySelectorAll('.qn-c')];
    if (lignes.length < 3) return { casse: 'lignes de classe : ' + lignes.length + ' — ' + document.getElementById('qa-liste').textContent.slice(0, 200) };
    const gestes = lignes.map(l => [...l.querySelectorAll('.qn-actes .btn')].map(b => b.textContent));
    const etat = (lignes[2].querySelector('.qn-cd') || {}).textContent || '';
    window.__appels.length = 0;
    const det = [...lignes[2].querySelectorAll('.btn')].find(b => b.textContent === 'Détacher');
    if (det) det.click();
    await attendre(30);
    const detache = window.__appels.map(a => a.nom + ' ' + JSON.stringify(a.args)).join(' | ');
    // « Rattacher… » ouvre le tiroir de SON questionnaire, sur son sélecteur.
    await attendre(100);
    window.__e.rendreBibliotheque(BIB2.modeles);
    const l0 = document.querySelectorAll('.qn-c')[0];
    const rat = [...l0.querySelectorAll('.btn')].find(b => b.textContent === 'Rattacher…');
    if (rat) rat.click();
    const tiroir = l0.closest('.qn-m').querySelector('.qn-reg');
    const ouvert = !!(tiroir && tiroir.open);
    const focus = document.activeElement && document.activeElement.dataset.seance;
    const selT = tiroir && tiroir.querySelector('select[data-seance]');
    const candidates = selT ? [...selT.options].filter(o => o.value).length : 0;
    const bloque = selT ? selT.disabled : true;
    // Le comportement se règle d'un changement, sans bouton à oublier.
    const t2 = document.querySelectorAll('.qn-m')[2].querySelector('.qn-comp');
    window.__appels.length = 0;
    const sel = t2 && t2.querySelector('select');
    if (sel) { sel.value = ''; sel.dispatchEvent(new Event('change')); }
    await attendre(30);
    const regle = window.__appels.map(a => a.nom + ' ' + JSON.stringify(a.args)).join(' | ');

    // La fiche de la séance TP2 (id 3) de la classe 2.
    const gs = document.getElementById('gs-classe');
    if (gs && !gs.options.length) { const o = document.createElement('option'); o.value = '2'; gs.appendChild(o); }
    if (gs) gs.value = '2';
    let v = document.getElementById('gs-fiche');
    while (v) { v.hidden = false; v = v.parentElement; }
    await window.__e.ouvrirFichePrep({ id: 3, numero: 2, titre: 'TP2', nature: 'projet', module_id: 1 }, 'infos');
    await attendre(80);
    const fiche = [...document.querySelectorAll('#gs-qn-liste .gs-qn-l')].map(x => x.textContent);
    const choix = [...document.querySelectorAll('#gs-qn-ajout option')].map(o => o.textContent);
    window.__appels.length = 0;
    const fd = document.querySelector('#gs-qn-liste .btn');
    if (fd) fd.click();
    await attendre(30);
    const ficheDet = window.__appels.filter(a => a.nom === 'rattacher_questionnaire')
      .map(a => JSON.stringify(a.args)).join(' | ');
    // « Réviser cette séance » (30/09) : caché sur un projet (pas de quiz),
    // visible sur un cours, et un clic part en UN appel qui fabrique ET propose.
    const revProjet = document.getElementById('gs-rev').hidden;
    await window.__e.ouvrirFichePrep({ id: 3, numero: 2, titre: 'TP2', nature: 'cours', module_id: 1 }, 'infos');
    await attendre(80);
    const revCours = !document.getElementById('gs-rev').hidden;
    const revTexte = document.getElementById('b-gs-rev').textContent;
    const revH = document.getElementById('b-gs-rev').getBoundingClientRect().height;
    window.__appels.length = 0;
    document.getElementById('b-gs-rev').click();
    await attendre(30);
    const revAppel = window.__appels.filter(a => a.nom === 'reviser_seance')
      .map(a => JSON.stringify(a.args)).join(' | ');
    return { gestes, etat, detache, ouvert, focus, candidates, bloque, regle, fiche, choix, ficheDet,
             revProjet, revCours, revTexte, revH, revAppel,
             debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, { BIB2 });
  if (r.casse) { rates.push('rattacher : ' + r.casse); await fermer(); await nav.close(); rates.forEach(x => console.log('  ✗ ' + x)); process.exit(1); }
  console.log('\n── rattacher / détacher (390 px)');
  console.log('   gestes par ligne :', JSON.stringify(r.gestes));
  console.log('   état affiché     :', r.etat);
  console.log('   « Détacher »     :', r.detache);
  console.log('   « Rattacher… »   : tiroir ouvert', r.ouvert, '· focus sur la séance', r.focus);
  console.log('   comportement     :', r.regle);
  console.log('   fiche de séance  :', r.fiche.join(' | '), '· à rattacher :', r.choix.length - 1);
  console.log('   détacher (fiche) :', r.ficheDet);
  if (!r.gestes[2].includes('Détacher')) rates.push('rattacher : un questionnaire rattaché n\'offre pas « Détacher » sur sa ligne');
  if (!r.gestes[0].includes('Rattacher…')) rates.push('rattacher : un questionnaire libre n\'offre pas « Rattacher… » sur sa ligne');
  if (!/reste ouvert/.test(r.etat) || !/12 octobre/.test(r.etat)) rates.push(`rattacher : la ligne ne dit pas ce que fait le rattachement — « ${r.etat} »`);
  if (!/rattacher_questionnaire \{"p_seance_id":34,"p_cible":null\}/.test(r.detache)) rates.push(`rattacher : « Détacher » n'appelle pas rattacher_questionnaire(34, null) — ${r.detache}`);
  if (r.bloque || r.candidates !== 1) rates.push(`rattacher : le sélecteur de séance du tiroir est ${r.bloque ? 'désactivé' : 'actif'} avec ${r.candidates} séance(s) — attendu actif, 1 séance`);
  if (!r.ouvert || r.focus !== '31') rates.push('rattacher : « Rattacher… » n\'ouvre pas le tiroir sur le sélecteur de sa séance');
  if (!/regler_questionnaire \{"p_seance_id":34,"p_reste_ouvert":false,"p_jusqu_au":"2026-10-12"\}/.test(r.regle)) rates.push(`rattacher : le comportement ne part pas en un appel complet — ${r.regle}`);
  if (r.fiche.length !== 1 || !/Réviser/.test(r.fiche[0])) rates.push(`fiche : la séance ne dit pas quel questionnaire l'accompagne — ${r.fiche.join(' | ')}`);
  if (r.choix.length - 1 !== 1) rates.push(`fiche : ${r.choix.length - 1} questionnaire(s) proposés au rattachement, attendu 1 (le stage du BTS2)`);
  console.log('   réviser (fiche)  : caché sur un projet', r.revProjet, '· visible sur un cours', r.revCours, '·', r.revTexte, '·', r.revAppel);
  if (!r.revProjet) rates.push('réviser : le bouton « Réviser cette séance » apparaît sur un projet, qui n\'a pas de quiz');
  if (!r.revCours || !/Proposer la révision/.test(r.revTexte)) rates.push(`réviser : le bouton manque sur un cours — « ${r.revTexte} »`);
  if (r.revH < 44) rates.push(`réviser : bouton de ${r.revH} px, sous les 44 px`);
  if (r.revAppel !== '{"p_seance_id":3,"p_ouvrir":true}') rates.push(`réviser : le clic n'appelle pas reviser_seance(3, vrai) — ${r.revAppel}`);
  if (!/"p_seance_id":34,"p_cible":null/.test(r.ficheDet)) rates.push(`fiche : « Détacher » n'appelle pas rattacher_questionnaire(34, null) — ${r.ficheDet}`);
  if (r.debord > 0) rates.push(`rattacher : la page déborde de ${r.debord} px`);
  if (err.length) rates.push('rattacher : erreur JS — ' + err[0]);
  await fermer();
}
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ Les gestes de « Ce qui bloque » s\'exécutent depuis la carte,');
console.log('    et l\'onglet Préparer ne montre que les classes concernées.');
console.log('  ✓ Rattacher et détacher se font depuis la ligne du questionnaire comme');
console.log('    depuis la fiche de la séance, et le comportement se règle d\'un geste.');
