#!/usr/bin/env node
// ── Le lot « indicateurs » du 02/10/2026 ───────────────────────────────────
//
//     node outils/t_indicateurs.mjs
//
// Ce que ce contrôle vérifie, et pourquoi chaque point existe :
//
//   · LE TEMPS DE LECTURE — la formule de la page rend ce que rend la base
//     (temps_lecture() : 6 s pour l'exemple de la migration, 4 s au plancher,
//     25 au plafond) : deux formules qui divergent, et la base compterait
//     « trop vite » des réponses que la page a pourtant fait attendre ;
//   · LES ALERTES — rien au premier affichage (les cas déjà là sont la ligne
//     de base), une vibration et un « (n) » dans le titre quand un cas urgent
//     APPARAÎT, rien de plus tant qu'il reste le même, plus rien une fois
//     coupées ;
//   · « À ALLER VOIR » — la ligne de la classe : humeur, réponses sans lire,
//     médiane des missions sur un projet ;
//   · LA COURBE — la phrase dit la chute d'activité quand il y en a une, deux
//     traits et des barres, un tableau, et le SVG ne s'étire pas au-delà de
//     40 rem (son texte grandirait avec lui) ;
//   · CETTE SEMAINE — à 360, 390 et 768 px : aucun débordement, aucune cible
//     sous 44 px, les « attention » avant les « à surveiller », « nouveau »
//     marqué, une ligne ouvre la fiche, « Copier » rend un texte complet ;
//   · LES ÉQUIPES — l'appréciation en trois boutons de 44 px qui appellent
//     apprecier(), un jalon qui appelle poser_jalon() ; côté étudiant, le
//     journal part avec son artefact, « Envoyer » ne s'allume qu'à 100 points,
//     et la carte ne laisse rien voir de l'appréciation de l'enseignant.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const rates = [];
const nav = await chromium.launch();

// ── Données ─────────────────────────────────────────────────────────────
const VIGILANCE = (mains) => ({
  ok: true, seance_id: 18, numero: 11, nature: 'projet', code: 'BTS2-SLAM-2026', minutes: 32,
  duree_min: 110, nb_actes: 0, attendu_acte: 0, quiz_sur: 0, jalons: 5, mediane_missions: 3.5,
  trop_vite: 6, humeurs: { A: 5, B: 4, C: 2, D: 1 }, inscrits: 13,
  seuils: { silence_min: 20, grace_min: 3, bloque_min: 25 }, actes: [],
  eleves: [
    { eleve_id: 3, numero: '03', raisons: [{ cle: 'perdu', gravite: 'urgent', texte: 'A répondu « perdu » en arrivant' }] },
    { eleve_id: 5, numero: '05', raisons: [{ cle: 'bloque', gravite: 'attention', texte: 'Aucune mission validée depuis 31 min' }] },
  ].concat(mains.map((m) => ({ eleve_id: m.e, numero: m.n, main: { id: m.id, vue: false, depuis: 0 },
    raisons: [{ cle: 'main', gravite: 'urgent', texte: 'Main levée, à l\'instant' }] }))),
});

const COURBE = (() => {
  const points = [];
  for (let m = 0; m <= 45; m++) {
    points.push({ m, avance: Math.min(100, Math.round(m * 1.4)), attendu: Math.min(100, Math.round(m * 1.8)),
                  actifs: m < 28 ? Math.min(12, 4 + Math.floor(m / 2)) : 4 });
  }
  return { ok: true, seance_id: 18, nature: 'cours', duree_min: 55, ouverte: true, unites: 14, presents: 13, points };
})();

const SEMAINE = {
  ok: true, code: 'BTS1-DEV-2026', du: '2026-09-28', au: '2026-10-04', en_cours: true,
  classe: { effectif: 31, appels: 2, presence: 87, reussite: 64, evaluees: 210, gestes: 400, hors: 57,
            actifs_hors: 9, jalons: 0, trop_vite: 12, humeurs: 52, perdus: 2 },
  precedente: { effectif: 31, appels: 2, presence: 82, reussite: 71, evaluees: 190, gestes: 350, hors: 40,
                actifs_hors: 7, jalons: 0, trop_vite: 20, humeurs: 50, perdus: 1 },
  seances: [{ id: 18, numero: 4, titre: 'Ça marche sur mon poste', nature: 'cours', jour: '2026-09-30',
              actifs: 27, reussite: 61, avancement: 88 }],
  concepts: [{ seance: 4, rang: 2, intitule: 'Un commit est un instantané, pas une différence', taux: 38, reponses: 40, etat: 'a_revoir' },
             { seance: 4, rang: 3, intitule: 'Une branche est une étiquette mobile', taux: 58, reponses: 40, etat: 'fragile' }],
  eleves: [
    { eleve_id: 1, numero: '01', appels: 2, presents: 2, humeurs: 'AB', hors: 14, jours_hors: 3, presents_: 2,
      raisons: [], nouveau: false, progres: ['S\'entraîne hors séance : 14 réponses sur 3 jours'] },
    { eleve_id: 9, numero: '09', appels: 2, presents: 2, humeurs: 'CD', hors: 0, jours_hors: 0,
      raisons: [{ cle: 'lecture', gravite: 'a_suivre', texte: '5 réponses sans le temps de lire' },
                { cle: 'fatigue', gravite: 'a_suivre', texte: 'Fatigué à 2 appels' }], nouveau: false, progres: [] },
    { eleve_id: 14, numero: '14', appels: 2, presents: 0, humeurs: null, hors: 0, jours_hors: 0,
      raisons: [{ cle: 'absent', gravite: 'attention', texte: 'Absent aux 2 appels de la semaine' }], nouveau: true, progres: [] },
    { eleve_id: 22, numero: '22', appels: 2, presents: 2, humeurs: 'BB', hors: 2, jours_hors: 1,
      raisons: [{ cle: 'reussite', gravite: 'attention', texte: '31 % de réussite (5 sur 16)' },
                { cle: 'baisse', gravite: 'attention', texte: 'Réussite en baisse : 70 % → 31 %' }], nouveau: false, progres: [] },
  ],
  trajectoires: [{ module_id: 3, titre: 'PlaylistApp — C# et .NET 10', icone: '🎵', total: 29,
    echeance: '2027-03-15', debut: '2026-09-01', attendu: 4.6,
    compte: { a_jour: 6, juste: 3, retard: 2, decroche: 2 },
    eleves: [{ eleve_id: 4, numero: '04', faits: 0, statut: 'decroche' }, { eleve_id: 7, numero: '07', faits: 2, statut: 'retard' }] }],
  meteo: [{ jour: '2026-09-28', seances: [], A: 8, B: 15, C: 4, D: 1 },
          { jour: '2026-09-30', seances: [4], A: 10, B: 12, C: 3, D: 1 }],
};

const EQUIPES = {
  ok: true, aujourdhui: '2026-10-02',
  module: { id: 4, titre: 'Du besoin à la mise en place — CPMS', icone: '🤝', classe_id: 2, code: 'BTS2-SLAM-2026' },
  reperes: { jalons: [{ cle: 'J1', libelle: 'Besoin validé' }, { cle: 'J2', libelle: 'Go / No-go' },
                      { cle: 'J3', libelle: 'Plan validé' }, { cle: 'J4', libelle: 'Bilan' }], artefacts: [] },
  texte: 'Refuge | SPA : 01 02 03', sans_equipe: ['12'],
  equipes: [{ id: 7, nom: 'Refuge', sujet: 'SPA Forez-Pilat', ancienne: false, jours: 2, journaux_jour: 2,
    jalons: { J1: { etat: 'valide' } }, pairs: { jalon: 'J1', repondus: 3 },
    recent: [{ numero: '01', jour: '2026-10-01', artefact: 'C1', texte: 'Carte des parties prenantes' }],
    membres: [
      { eleve_id: 1, numero: '01', avatar: '🦊', journaux: 2, sans_journal: 0, journal_jour: true, niveau_jour: 'moteur',
        moteur: 2, present: 0, rien: 0, pairs: 48, soi: 45, part_egale: 33, raisons: [], forces: ['Moteur de l\'équipe 2 fois'] },
      { eleve_id: 2, numero: '02', avatar: '🐢', journaux: 2, sans_journal: 0, journal_jour: true, niveau_jour: null,
        moteur: 0, present: 2, rien: 0, pairs: 40, soi: 35, part_egale: 33, raisons: [], forces: [] },
      { eleve_id: 3, numero: '03', avatar: '🦉', journaux: 0, sans_journal: 2, journal_jour: false, niveau_jour: null,
        moteur: 0, present: 0, rien: 2, pairs: 12, soi: 30, part_egale: 33,
        raisons: [{ cle: 'rien', gravite: 'attention', texte: 'Marqué « rien fourni » 2 fois' },
                  { cle: 'ecart', gravite: 'a_suivre', texte: 'Se donne 30 %, ses pairs 12 %' }], forces: [] }] }],
};

const MON_EQUIPE = {
  ok: true, reperes: EQUIPES.reperes,
  equipes: [{ id: 7, nom: 'Refuge', sujet: 'SPA Forez-Pilat', module: { titre: 'CPMS', icone: '🤝' },
    membres: [{ eleve_id: 1, numero: '01', avatar: '🦊', moi: true }, { eleve_id: 2, numero: '02', avatar: '🐢', moi: false },
              { eleve_id: 3, numero: '03', avatar: '🦉', moi: false }],
    jalons: { J1: 'valide' }, journal: null, pairs: { jalon: 'J1', mes_points: null } }],
};
MON_EQUIPE.reperes = { ...EQUIPES.reperes, artefacts: [{ cle: 'C1', libelle: 'Parties prenantes' }, { cle: 'C2', libelle: 'Guide d\'entretien' }] };

// Mesures communes : débordement, cibles sous 44 px dans une zone.
const MESURER = (sel) => {
  const z = document.querySelector(sel);
  const petits = [...z.querySelectorAll('button, select, input, textarea, [role="button"]')]
    .filter((b) => b.offsetParent !== null)
    .map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30),
                   h: Math.round(b.getBoundingClientRect().height) }))
    .filter((x) => x.h < 44);
  return { debord: document.documentElement.scrollWidth - document.documentElement.clientWidth, petits };
};

// ── 1. Le temps de lecture ──────────────────────────────────────────────
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const r = await p.evaluate(() => {
    const t = window.__e.tempsLecture;
    return [t('Dans une API REST, quel verbe HTTP lit une ressource sans la modifier ?', ['GET', 'POST', 'PUT', 'DELETE']),
            t('Oui ?'), t(Array(200).fill('mot').join(' ')), t(''), t(Array(30).fill('mot').join(' '))];
  });
  console.log(`── lecture : ${r.join(' · ')} s`);
  if (r.join() !== '6,4,25,0,9') rates.push(`tempsLecture() rend ${r.join(', ')} — la base rend 6, 4, 25, rien et 9 : les deux formules ont divergé`);
  if (erreurs.length) rates.push(`lecture : erreur JS — ${erreurs[0]}`);
  await fermer();
}

// ── 2. Les alertes, et la ligne de la classe ────────────────────────────
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const r = await p.evaluate(({ v1, v2 }) => {
    let e = document.getElementById('bloc-vigilance');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__vibre = 0;
    navigator.vibrate = () => { window.__vibre++; return true; };
    try { localStorage.removeItem('tdc-alertes'); } catch (x) {}
    window.__e.brancherAlertes();
    const s = window.__e.signaler;
    const a = s(v1); const vibA = window.__vibre;
    const b = s(v2); const vibB = window.__vibre; const titre = document.title;
    const c = s(v2); const vibC = window.__vibre;
    window.__e.rendreVigilance(v2);
    const resume = document.getElementById('vg-resume').textContent;
    document.getElementById('b-sv-alerte').click();
    const coupe = localStorage.getItem('tdc-alertes');
    s({ ...v2, eleves: v2.eleves.concat([{ eleve_id: 30, numero: '30', main: { id: 99, vue: false },
        raisons: [{ cle: 'main', gravite: 'urgent', texte: 'Main levée' }] }]) });
    return { vibA, vibB, vibC, nouveauxB: b.nouveaux.length, titre, resume, coupe,
             apresCoupure: window.__vibre, titreFin: document.title,
             toast: [...document.querySelectorAll('.toast.urgent')].map((t) => t.textContent) };
  }, { v1: VIGILANCE([]), v2: VIGILANCE([{ e: 27, n: '27', id: 41 }]) });
  console.log(`── alertes : vibrations ${r.vibA}/${r.vibB}/${r.vibC} · titre « ${r.titre} » · toast ${r.toast.length}`);
  console.log(`   « À aller voir » : ${r.resume}`);
  if (r.vibA !== 0) rates.push('alertes : vibration au premier affichage — les cas déjà là sont la ligne de base');
  if (r.vibB !== 1 || r.nouveauxB !== 1) rates.push(`alertes : la main levée nouvelle n'a pas fait vibrer (vibrations ${r.vibB}, nouveaux ${r.nouveauxB})`);
  if (r.vibC !== 1) rates.push('alertes : la même main a fait vibrer deux fois');
  if (!/^\(2\) /.test(r.titre)) rates.push(`alertes : titre « ${r.titre} », attendu « (2) … » (deux cas urgents)`);
  if (!r.toast.length || !/27/.test(r.toast[0])) rates.push('alertes : pas de toast nommant le 27');
  if (r.coupe !== 'non' || r.apresCoupure !== 1 || /^\(\d+\)/.test(r.titreFin)) rates.push('alertes : couper ne coupe pas (vibration ou titre)');
  if (!/☀️ 5/.test(r.resume) || !/médiane 3,5 sur 5/.test(r.resume) || !/6 réponses sans le temps de lire/.test(r.resume)) {
    rates.push(`« À aller voir » : ligne de la classe incomplète — « ${r.resume} »`);
  }
  if (erreurs.length) rates.push(`alertes : erreur JS — ${erreurs[0]}`);
  await fermer();
}

// ── 3. La courbe ────────────────────────────────────────────────────────
for (const w of [360, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((d) => {
    let e = document.getElementById('bloc-courbe');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__e.rendreCourbe(d);
    const svg = document.getElementById('cb-svg');
    return { phrases: [...document.querySelectorAll('#cb-resume .cb-phrase')].map((x) => x.textContent),
             traits: svg.querySelectorAll('path').length, barres: svg.querySelectorAll('rect').length,
             lignes: document.querySelectorAll('#cb-table tbody tr').length,
             lu: document.getElementById('cb-lu').textContent,
             largeur: Math.round(svg.getBoundingClientRect().width),
             debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, COURBE);
  console.log(`── courbe ${w} px : ${r.phrases.join(' / ')} · ${r.traits} traits, ${r.barres} barres, ${r.lignes} lignes · SVG ${r.largeur} px`);
  if (!r.phrases.some((t) => /activité est tombée de 12 à 4/.test(t))) rates.push(`courbe ${w} px : la chute d'activité n'est pas dite`);
  if (r.traits !== 2) rates.push(`courbe ${w} px : ${r.traits} traits, attendu 2 (classe et attendu)`);
  if (r.barres < 40) rates.push(`courbe ${w} px : ${r.barres} barres d'actifs`);
  if (r.lignes !== 10) rates.push(`courbe ${w} px : ${r.lignes} lignes de tableau, attendu 10 (toutes les 5 min)`);
  if (!/45ᵉ min/.test(r.lu)) rates.push(`courbe ${w} px : la lecture ne part pas de la dernière minute — « ${r.lu} »`);
  if (r.largeur > 640) rates.push(`courbe ${w} px : le SVG s'étire à ${r.largeur} px`);
  if (r.debord > 0) rates.push(`courbe ${w} px : débordement de ${r.debord} px`);
  if (erreurs.length) rates.push(`courbe ${w} px : erreur JS — ${erreurs[0]}`);
  await fermer();
}

// ── 4. Cette semaine ────────────────────────────────────────────────────
for (const w of [360, 390, 768]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate(({ d, MESURER }) => {
    let e = document.getElementById('carte-semaine');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__e.rendreSemaine(d);
    const m = (new Function('return ' + MESURER))()('#carte-semaine');
    const secs = [...document.querySelectorAll('#sm-corps .sm-h')].map((h) => h.firstChild.textContent);
    const arevoir = [...document.querySelectorAll('#sm-corps .sm-sec')][0];
    return { ...m, secs,
             tuiles: document.querySelectorAll('.sm-tuile').length,
             ordre: [...arevoir.querySelectorAll('.pa-num')].map((x) => x.textContent),
             nouveau: [...arevoir.querySelectorAll('.sm-nouveau')].map((x) => x.closest('.vg-l').querySelector('.pa-num').textContent),
             ecarts: [...document.querySelectorAll('.sm-e')].map((x) => x.className.split(' ')[1]),
             texte: window.__e.texteSemaine(d),
             hauteur: Math.round(document.getElementById('carte-semaine').getBoundingClientRect().height) };
  }, { d: SEMAINE, MESURER: MESURER.toString() });
  console.log(`── semaine ${w} px : ${r.tuiles} tuiles · à revoir ${r.ordre.join(' ')} · nouveau ${r.nouveau.join(' ')} · carte ${r.hauteur} px`);
  console.log(`   sections : ${r.secs.join(' | ')}`);
  if (r.tuiles !== 4) rates.push(`semaine ${w} px : ${r.tuiles} tuiles, attendu 4`);
  if (r.ordre.join() !== '14,22,09') rates.push(`semaine ${w} px : ordre ${r.ordre.join(' ')}, attendu 14 22 09 (attention et nouveau d'abord)`);
  if (r.nouveau.join() !== '14') rates.push(`semaine ${w} px : « nouveau » sur ${r.nouveau.join(' ')}, attendu le 14`);
  // Présence +5 (bien), réussite −7 (mal), hors séance +17 (bien), « perdu » +1 (mal : moins, c'est mieux).
  if (r.ecarts.join() !== 'bien,mal,bien,mal') rates.push(`semaine ${w} px : écarts ${r.ecarts.join(',')}, attendu bien,mal,bien,mal`);
  for (const s of ['À revoir lundi', 'En progrès', 'Notions à reprendre', 'Projets : vers l\'échéance',
                   'Travail hors séance', 'Météo de la classe', 'Les séances jouées']) {
    if (!r.secs.includes(s)) rates.push(`semaine ${w} px : section « ${s} » absente`);
  }
  if (!/À revoir lundi \(3\)/.test(r.texte) || !/14 \[nouveau\]/.test(r.texte) || !/PlaylistApp/.test(r.texte)) {
    rates.push(`semaine : le texte à copier est incomplet`);
  }
  if (r.debord > 0) rates.push(`semaine ${w} px : débordement de ${r.debord} px`);
  if (r.petits.length) rates.push(`semaine ${w} px : cibles sous 44 px — ${JSON.stringify(r.petits.slice(0, 4))}`);
  if (erreurs.length) rates.push(`semaine ${w} px : erreur JS — ${erreurs[0]}`);

  if (w === 390) {
    await p.click('#sm-corps .sm-el');
    await p.waitForTimeout(150);
    const fiche = await p.evaluate(() => !document.getElementById('fiche-eleve').hidden &&
                                         document.getElementById('fe-titre').textContent);
    if (!fiche || !/14/.test(fiche)) rates.push(`semaine : toucher le 14 n'ouvre pas sa fiche (${fiche})`);
  }
  await fermer();
}

// ── 5. Les équipes, côté enseignant puis étudiant ───────────────────────
for (const w of [360, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate(async ({ d, MESURER }) => {
    let e = document.getElementById('carte-equipes');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__reponses = { apprecier: { ok: true }, poser_jalon: { ok: true }, equipes_module: d };
    window.__e.rendreEquipes(d);
    const m = (new Function('return ' + MESURER))()('#carte-equipes');
    const niv = document.querySelectorAll('.eq-membre')[2].querySelectorAll('.eq-niv');
    window.__appels.length = 0;
    niv[2].click();
    await new Promise((ok) => setTimeout(ok, 50));
    const app = window.__appels.filter((a) => a.nom === 'apprecier').map((a) => a.args);
    document.querySelectorAll('.eq-jalon')[1].click();
    await new Promise((ok) => setTimeout(ok, 50));
    const jal = window.__appels.filter((a) => a.nom === 'poser_jalon').map((a) => a.args);
    return { ...m, app, jal, allume: niv[2].classList.contains('on'),
             raisons: [...document.querySelectorAll('.eq-membre')[2].querySelectorAll('.vg-r')].map((x) => x.textContent) };
  }, { d: EQUIPES, MESURER: MESURER.toString() });
  console.log(`── équipes ${w} px : apprecier ${JSON.stringify(r.app)} · jalon ${JSON.stringify(r.jal)}`);
  if (!r.app.length || r.app[0].p_niveau !== 'rien' || Number(r.app[0].p_eleve_id) !== 3) rates.push(`équipes ${w} px : ✗ n'appelle pas apprecier(…, 3, 'rien')`);
  if (!r.allume) rates.push(`équipes ${w} px : le bouton ✗ ne s'allume pas`);
  if (!r.jal.length || r.jal[0].p_jalon !== 'J2' || r.jal[0].p_etat !== 'valide') rates.push(`équipes ${w} px : toucher J2 n'appelle pas poser_jalon('J2', 'valide')`);
  if (!r.raisons.some((t) => /rien fourni/.test(t))) rates.push(`équipes ${w} px : la raison du 03 n'est pas affichée`);
  if (r.debord > 0) rates.push(`équipes ${w} px : débordement de ${r.debord} px`);
  if (r.petits.length) rates.push(`équipes ${w} px : cibles sous 44 px — ${JSON.stringify(r.petits.slice(0, 4))}`);
  if (erreurs.length) rates.push(`équipes ${w} px : erreur JS — ${erreurs[0]}`);
  await fermer();
}
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 360 });
  const r = await p.evaluate(async ({ d, MESURER }) => {
    let e = document.getElementById('equipe-etu');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__reponses = { mon_equipe: d, ecrire_journal: { ok: true }, repartir_points: { ok: true, jalon: 'J1' } };
    window.__e.chargerEquipeEtu();
    await new Promise((ok) => setTimeout(ok, 80));
    const c = document.getElementById('eq-etu-7');
    const sel = c.querySelector('select'); sel.value = 'C2';
    c.querySelector('textarea').value = 'Guide d\'entretien relu avec le 02';
    c.querySelector('.eq-journal button').click();
    await new Promise((ok) => setTimeout(ok, 50));
    const journal = window.__appels.filter((a) => a.nom === 'ecrire_journal').map((a) => a.args)[0];
    const entrees = c.querySelectorAll('.eq-pairs input');
    const envoyer = c.querySelector('.eq-pairs .btn');
    const total0 = c.querySelector('.eq-total').textContent, actif0 = !envoyer.disabled;
    entrees[0].value = '30'; entrees[0].dispatchEvent(new Event('input'));
    const actif90 = !envoyer.disabled;
    entrees[0].value = '20'; entrees[1].value = '47';
    entrees[0].dispatchEvent(new Event('input'));
    envoyer.click();
    await new Promise((ok) => setTimeout(ok, 50));
    const points = window.__appels.filter((a) => a.nom === 'repartir_points').map((a) => a.args)[0];
    const m = (new Function('return ' + MESURER))()('#equipe-etu');
    return { ...m, journal, total0, actif0, actif90, points, texte: c.textContent };
  }, { d: MON_EQUIPE, MESURER: MESURER.toString() });
  console.log(`── équipe étudiant : journal ${JSON.stringify(r.journal)} · ${r.total0} · points ${JSON.stringify(r.points && r.points.p_points)}`);
  if (!r.journal || r.journal.p_artefact !== 'C2' || !/relu/.test(r.journal.p_texte)) rates.push('équipe étudiant : le journal ne part pas avec son artefact');
  if (r.total0 !== 'Total : 100 / 100' || !r.actif0) rates.push(`équipe étudiant : départ « ${r.total0} » — la part égale doit faire 100`);
  if (r.actif90) rates.push('équipe étudiant : « Envoyer » allumé à 96 points');
  if (!r.points || Object.values(r.points.p_points).reduce((a, b) => a + b, 0) !== 100) rates.push('équipe étudiant : la répartition envoyée ne fait pas 100');
  if (/moteur|rien fourni/.test(r.texte)) rates.push('équipe étudiant : la carte laisse voir une appréciation');
  if (r.debord > 0) rates.push(`équipe étudiant : débordement de ${r.debord} px`);
  if (r.petits.length) rates.push(`équipe étudiant : cibles sous 44 px — ${JSON.stringify(r.petits.slice(0, 4))}`);
  if (erreurs.length) rates.push(`équipe étudiant : erreur JS — ${erreurs[0]}`);
  await fermer();
}

await nav.close();
if (rates.length) {
  console.error('\n' + rates.map((x) => '  ✗ ' + x).join('\n'));
  process.exit(1);
}
console.log('\n  ✓ Lecture, alertes, courbe, semaine et équipes : ce qui est annoncé est à l\'écran.');
