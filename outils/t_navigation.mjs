#!/usr/bin/env node
// ── Se retrouver dans le portail ──────────────────────────────────────────
//
//     node outils/t_navigation.mjs        # depuis la racine du dépôt
//
// Chantier B de REFONTE.md. Quatre exigences, et la première est celle qui se
// paie vingt fois par heure :
//
//   · L'ADRESSE DIT OÙ L'ON EST. `location` n'apparaissait qu'une fois dans
//     tout le portail, pour un `reload()`. Un rafraîchissement ramenait donc
//     toujours sur « Appel du jour », Précédent quittait l'application, et
//     trois onglets ouverts étaient indiscernables dans la barre du
//     navigateur. En cours, on reprend sa page vingt fois par heure.
//
//   · UN SEUL MOTIF D'ONGLETS. Celui de l'espace enseignant suivait les ARIA
//     Authoring Practices ; celui de l'écran de connexion — le premier que
//     voit un étudiant — n'en suivait rien. Deux implémentations à maintenir,
//     dont une fausse.
//
//   · LES MESSAGES SONT ANNONCÉS (WCAG 4.1.3). Zéro `aria-live` pour
//     73 appels à erreur(). Une erreur apparaissait sans que rien ne la
//     signale à qui n'a pas les yeux sur la bonne zone.
//
//   · ON PEUT SAUTER L'EN-TÊTE (WCAG 2.4.1). Au clavier, on la retraversait
//     à chaque fois, et la carte épinglée avec.

import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
import { ouvrir } from './portail.mjs';
import { servir } from './serveur.mjs';

const RACINE = process.argv[2] || process.cwd();
const rates = [];
const nav = await chromium.launch();
const { page: p, erreurs, url, fermer } = await ouvrir(nav, RACINE, { largeur: 1280 });

// ── 1. L'adresse suit l'onglet, et l'onglet suit l'adresse ───────────────
const ouvrirEns = () => p.evaluate(() => {
  ['chargement', 'connexion', 'espace-etu'].forEach((i) => { document.getElementById(i).hidden = true; });
  document.getElementById('espace-ens').hidden = false;
});
await ouvrirEns();

const parcours = [];
for (const [id, cle] of [['ong-quest', 'quest'], ['ong-ensemble', 'ensemble'], ['ong-appel', 'appel']]) {
  await p.click('#' + id);
  parcours.push({ clic: cle, hash: new URL(p.url()).hash, titre: await p.title(),
                  // Le texte du bouton lui-même, tel qu'il est écrit dans la page.
                  bouton: (await p.textContent('#' + id)).trim() });
}
console.log('\n── l\'adresse suit l\'onglet');
for (const x of parcours) {
  console.log(`   clic « ${x.clic} » -> ${x.hash || '(aucune)'} · bouton « ${x.bouton} » · titre « ${x.titre} »`);
  if (x.hash !== '#' + x.clic) rates.push(`le clic sur « ${x.clic} » laisse l'adresse à « ${x.hash || 'rien'} »`);
  // Le titre de la page COMMENCE par le libellé du bouton. Les deux vivent
  // dans deux fichiers — index.html et js/navigation.js — et B6 a renommé les
  // quatre onglets d'un coup : renommer le bouton sans toucher TITRES laissait
  // un historique de navigateur qui parle d'onglets qui n'existent plus, et
  // rien ne l'aurait dit. Le libellé est la seule source ; le titre la suit.
  if (!x.titre.startsWith(x.bouton)) {
    rates.push(`l'onglet s'appelle « ${x.bouton} » et le titre de la page dit ` +
               `« ${x.titre} » — index.html et js/navigation.js ont divergé`);
  }
}
const titres = new Set(parcours.map((x) => x.titre));
if (titres.size !== parcours.length) {
  rates.push(`le titre de la page ne distingue pas les onglets (${[...titres].join(' / ')})`);
}

// Si l'adresse ne s'écrit pas, tout ce qui suit s'effondre : `goBack()`
// quitterait la page, et le contrôle mourrait sur une erreur obscure au lieu
// de nommer le défaut. On s'arrête ici, en le disant.
if (rates.length) {
  console.log();
  rates.forEach((x) => console.log('  ✗ ' + x));
  console.log("  (arrêt : sans adresse, les épreuves suivantes n'ont plus de sens)");
  await fermer(); await nav.close();
  process.exit(1);
}

// ── 2. Précédent revient à l'onglet précédent ────────────────────────────
await p.goBack();
await ouvrirEns();
const apresRetour = await p.evaluate(() => ({
  hash: location.hash,
  actif: (document.querySelector('.onglet.actif') || {}).id,
  volet: [...document.querySelectorAll('.volet')].filter((v) => !v.hidden).map((v) => v.id),
}));
console.log('\n── Précédent');
console.log('   adresse :', apresRetour.hash, '· onglet actif :', apresRetour.actif,
            '· volet ouvert :', apresRetour.volet.join(', '));
if (apresRetour.hash !== '#ensemble') rates.push(`Précédent mène à « ${apresRetour.hash} », attendu « #ensemble »`);
if (apresRetour.actif !== 'ong-ensemble') rates.push(`Précédent laisse « ${apresRetour.actif} » actif — l'adresse et l'écran ne disent pas la même chose`);
if (apresRetour.volet.join() !== 'volet-ensemble') rates.push(`Précédent montre ${apresRetour.volet.join(', ')}`);

// ── 3. Un rafraîchissement garde l'onglet ────────────────────────────────
//
// Vrai rechargement, pas un simple changement de dièse : `goto` vers la même
// page avec un autre fragment ne recharge rien et déclenche « hashchange »,
// ce qui emprunterait un tout autre chemin. On passe donc par le vrai
// ouvrirEspaceEnseignant(), celui qui lit l'adresse au démarrage — sinon ce
// contrôle se croirait vert en vérifiant le mauvais mécanisme.
await p.goto(url + '#quest', { waitUntil: 'load' });
await p.reload({ waitUntil: 'load' });
const apresF5 = await p.evaluate(() => {
  window.__e.ouvrirEspaceEnseignant();
  return {
    actif: (document.querySelector('.onglet.actif') || {}).id,
    volet: [...document.querySelectorAll('.volet')].filter((v) => !v.hidden).map((v) => v.id).join(),
    entrees: history.length,
  };
});
console.log('\n── rechargement sur #quest :', apresF5.actif, '·', apresF5.volet);
if (apresF5.actif !== 'ong-quest' || apresF5.volet !== 'volet-quest') {
  rates.push(`ouvrir « #quest » n'ouvre pas l'onglet « Préparer » (${apresF5.actif} / ${apresF5.volet})`);
}

// ── 3bis. Un ancien favori « #seance » ouvre En cours ─────────────────────
// L'onglet « La séance » a disparu le 28/09 : son suivi vit dans En cours.
// Un favori qui tomberait sur un écran vide se lirait comme une panne.
await p.goto(url + '#seance', { waitUntil: 'load' });
await p.reload({ waitUntil: 'load' });
const alias = await p.evaluate(() => {
  window.__e.ouvrirEspaceEnseignant();
  return { actif: (document.querySelector('.onglet.actif') || {}).id, hash: location.hash,
    volet: [...document.querySelectorAll('.volet')].filter((v) => !v.hidden).map((v) => v.id).join() };
});
console.log('── ancien favori #seance :', alias.actif, '·', alias.hash);
if (alias.actif !== 'ong-appel' || alias.volet !== 'volet-appel' || alias.hash !== '#appel') {
  rates.push(`« #seance » n'ouvre pas En cours (${alias.actif} / ${alias.volet} / ${alias.hash})`);
}

// ── 3ter. La séance dans l'adresse (28/09) ────────────────────────────────
// « #appel/s/123 » : En cours s'ouvre, l'adresse GARDE la séance (la
// normalisation d'ouverture ne doit pas la couper), et Précédent y revient.
await p.goto(url + '#appel/s/14', { waitUntil: 'load' });
await p.reload({ waitUntil: 'load' });
const lien = await p.evaluate(() => {
  window.__e.ouvrirEspaceEnseignant();
  return { actif: (document.querySelector('.onglet.actif') || {}).id, hash: location.hash };
});
await p.click('#ong-quest');
await p.goBack();
const retour = await p.evaluate(() => ({ actif: (document.querySelector('.onglet.actif') || {}).id, hash: location.hash }));
console.log('── lien vers une séance :', lien.hash, '· après Préparer puis Précédent :', retour.hash);
if (lien.actif !== 'ong-appel' || lien.hash !== '#appel/s/14') rates.push(`« #appel/s/14 » ouvre ${lien.actif} et devient « ${lien.hash} »`);
if (retour.actif !== 'ong-appel' || retour.hash !== '#appel/s/14') rates.push(`Précédent depuis Préparer mène à ${retour.actif} « ${retour.hash} »`);

// ── 3quinquies. La page d'une séance dans l'adresse (06/10, lot 3) ─────────
// « #s/25/bilan » rouvre la PAGE, sur son onglet Bilan, et allume le moment
// Bilan ; la normalisation d'ouverture ne réécrit pas l'adresse en #appel.
await p.goto(url + '#s/25/bilan', { waitUntil: 'load' });
await p.reload({ waitUntil: 'load' });
const pageLien = await p.evaluate(() => {
  window.__e.ouvrirEspaceEnseignant();
  return { actif: (document.querySelector('.onglet.actif') || {}).id, hash: location.hash,
    page: !document.getElementById('volet-seance').hidden,
    volets: [...document.querySelectorAll('.volet')].filter((v) => !v.hidden).map((v) => v.id).join() };
});
console.log('── page d\'une séance :', pageLien.hash, '·', pageLien.actif, '·', pageLien.volets);
if (pageLien.hash !== '#s/25/bilan' || pageLien.actif !== 'ong-ensemble' || pageLien.volets !== 'volet-seance') {
  rates.push(`« #s/25/bilan » ouvre ${JSON.stringify(pageLien)} — attendu la page seule, moment Bilan allumé`);
}

// ── 3quater. Installable, et la barre sous le pouce sur un téléphone ──────
const manifeste = await p.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()).then((m) =>
  ({ nom: m.short_name, icones: m.icons.length, affichage: m.display })).catch((e) => ({ err: String(e) })));
if (manifeste.err || manifeste.icones < 2 || manifeste.affichage !== 'standalone') rates.push(`manifeste : ${JSON.stringify(manifeste)}`);
{
  const { page: t, fermer: fermerT } = await ouvrir(nav, RACINE, { largeur: 390, hauteur: 800 });
  const barre = await t.evaluate(() => {
    ['chargement', 'connexion', 'espace-etu'].forEach((i) => { document.getElementById(i).hidden = true; });
    document.getElementById('espace-ens').hidden = false;
    const r = document.getElementById('onglets-ens').getBoundingClientRect();
    return { pos: getComputedStyle(document.getElementById('onglets-ens')).position,
             bas: Math.round(r.bottom), haut: Math.round(r.height), vh: innerHeight,
             cibles: [...document.querySelectorAll('#onglets-ens .onglet')].map((b) => Math.round(b.getBoundingClientRect().height)) };
  });
  console.log('── téléphone : barre', barre.pos, 'bas', barre.bas, '/', barre.vh, '· cibles', barre.cibles.join('/'));
  if (barre.pos !== 'fixed' || Math.abs(barre.bas - barre.vh) > 1) rates.push(`téléphone : la barre d'onglets n'est pas en bas (${JSON.stringify(barre)})`);
  if (barre.cibles.some((h) => h < 44)) rates.push(`téléphone : onglet sous 44 px (${barre.cibles.join('/')})`);
  await fermerT();
}

// ── 4. Les deux barres d'onglets suivent le même motif ───────────────────
const motif = await p.evaluate(() => {
  const lire = (ids) => ids.map((id) => {
    const b = document.getElementById(id);
    return { id, type: b.getAttribute('type'), tabindex: b.tabIndex,
             sel: b.getAttribute('aria-selected') };
  });
  return { connexion: lire(['t-etu', 't-ens']),
           enseignant: lire(['ong-appel', 'ong-quest', 'ong-ensemble']) };
});
console.log('\n── le motif « Tabs », des deux côtés');
for (const [ou, liste] of Object.entries(motif)) {
  const dansTab = liste.filter((b) => b.tabindex === 0).length;
  console.log(`   ${ou.padEnd(11)}: ${liste.length} onglets · ${dansTab} tabulable(s) · ` +
              `type=button : ${liste.every((b) => b.type === 'button')}`);
  if (dansTab !== 1) rates.push(`${ou} : ${dansTab} onglets dans l'ordre de tabulation, il en faut exactement 1`);
  if (!liste.every((b) => b.type === 'button')) rates.push(`${ou} : un onglet sans type="button" — un Entrée enverrait le formulaire`);
  if (!liste.every((b) => b.sel === 'true' || b.sel === 'false')) {
    rates.push(`${ou} : aria-selected n'est pas la chaîne « true » ou « false »`);
  }
}

// Les flèches, sur l'écran de connexion aussi.
const fleches = await p.evaluate(async () => {
  ['espace-ens'].forEach((i) => { document.getElementById(i).hidden = true; });
  document.getElementById('connexion').hidden = false;
  const t = document.getElementById('t-etu');
  t.focus();
  t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  return { actif: document.activeElement.id,
           ouvert: document.getElementById('p-ens').hidden === false };
});
console.log('   flèche droite sur « Étudiant » -> focus', fleches.actif,
            '· panneau enseignant ouvert :', fleches.ouvert);
if (fleches.actif !== 't-ens' || !fleches.ouvert) {
  rates.push("les flèches ne circulent pas entre les onglets de l'écran de connexion");
}

// ── 5. Les messages d'état sont annoncés, et l'en-tête se saute ──────────
const a11y = await p.evaluate(() => ({
  live: document.querySelectorAll('[aria-live]').length,
  zonesSansLive: [...document.querySelectorAll('[id^="err-"]')]
    .filter((z) => !z.hasAttribute('aria-live')).map((z) => z.id),
  evitement: !!document.querySelector('a.evitement[href="#contenu"]'),
  cible: !!document.getElementById('contenu'),
  premier: (document.body.querySelector('a, button, input, select') || {}).className,
}));
console.log('\n── annonces et évitement');
console.log('   zones aria-live :', a11y.live, '· zones err- sans annonce :', a11y.zonesSansLive.length);
console.log('   lien d\'évitement :', a11y.evitement, '· cible #contenu :', a11y.cible,
            '· premier élément focalisable :', JSON.stringify(a11y.premier));
if (a11y.zonesSansLive.length) rates.push(`zone(s) de message sans aria-live : ${a11y.zonesSansLive.join(', ')}`);
if (!a11y.evitement || !a11y.cible) rates.push("le lien d'évitement ou sa cible manque (WCAG 2.4.1)");
if (a11y.premier !== 'evitement') rates.push(`le premier élément focalisable est « ${a11y.premier} » : le lien d'évitement n'est pas en tête`);
if (erreurs.length) rates.push('erreur JS — ' + erreurs[0]);

await fermer();

// ── 6. Ce que mesure axe-core : WCAG 2.2 AA, en clair ET en sombre ────────
// Lot 1 des propositions du 05/10 (item 1.9). L'audit de ce jour-là avait
// trouvé, entre autres, TOUS les boutons principaux à 2,5 : 1 en thème sombre
// — « Me connecter » compris — et un tableau défilant inatteignable au
// clavier. Aucun des douze contrôles ne regardait le thème sombre. Celui-ci
// passe axe-core sur l'écran de connexion, les trois onglets enseignant (avec
// des données d'essai), et le guide des composants (styleguide.html), à 390
// et 1 280 px, dans les deux thèmes ; puis vérifie qu'à 320 px rien ne défile
// en largeur (WCAG 1.4.10, « redistribution »).
//
// axe-core vient de node_modules s'il y est (`npm i axe-core`), sinon du CDN
// à une version FIXE — jamais d'un « latest » qui ferait changer le verdict
// sans qu'on ait rien touché. Introuvable des deux côtés : le contrôle
// échoue, il ne passe pas au vert en n'ayant rien vérifié.
//
// axe ne voit qu'environ un tiers des critères. Le reste se vérifie à la main
// une fois par trimestre (liste dans CLAUDE.md, « Accessibilité »).
const AXE_VERSION = '4.14.0';
async function sourceAxe(){
  try { return fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) {}
  try {
    const r = await fetch(`https://cdn.jsdelivr.net/npm/axe-core@${AXE_VERSION}/axe.min.js`);
    if (r.ok) return await r.text();
  } catch (e) {}
  return null;
}
const AXE = await sourceAxe();
const REGLES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const fautesAxe = [];

async function auditer(page, ou){
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async (REGLES) => {
    // Les <details> s'ouvrent : ce qu'ils cachent est audité aussi.
    document.querySelectorAll('details').forEach((d) => { if (d.offsetParent !== null || d.closest('.volet:not([hidden])')) d.open = true; });
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: REGLES } });
    return r.violations.map((x) => x.id + ' (' + x.nodes.length + ') : ' +
      x.nodes.slice(0, 2).map((n) => n.target.join(' ') + (n.any[0] && n.any[0].message ? ' — ' + n.any[0].message.slice(0, 120) : '')).join(' | '));
  }, REGLES);
  v.forEach((x) => fautesAxe.push(ou + ' · ' + x));
  return v.length;
}

// Des données d'essai complètes : chaque carte enseignant a de quoi s'afficher.
function donneesEnseignant(){
  const T = {
    classes: [{ id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV' }, { id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }],
    seances: [{ id: 3, classe_id: 1, numero: 3, titre: 'Séance 3 - où vit la donnée', ouverte: true, notee: false,
                nature: 'cours', jalons: null, module_id: 4, publiee: true, duree_min: 55,
                demarree_le: new Date(Date.now() - 20 * 60000).toISOString() }],
    eleves: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, numero: String(i + 1).padStart(2, '0'), avatar: '🦊', auth_id: 'x' })),
  };
  const sb = window.__e.sb;
  sb.from = function (t) {
    const ch = { then: (ok, ko) => Promise.resolve({ data: (T[t] || []), error: null }).then(ok, ko) };
    ['select', 'eq', 'order', 'neq', 'in', 'limit', 'gte', 'lte', 'filter'].forEach((m) => { ch[m] = () => ch; });
    return ch;
  };
  window.__reponses = {
    a_faire: { ok: true, bloquants: 0, attentions: 1, taches: [{ classe: 'BTS SIO 1 - Bloc 1 DEV', code: 'BTS1-DEV-2026',
      classe_id: 1, gravite: 'attention', quoi: 'Séance 2 encore ouverte', detail: 'Démarrée il y a 11 h.',
      geste: 'Clore la séance', action: 'clore', seance_id: 11, aller: null }] },
    preflight_seance: { ok: true, nature: 'cours', seance: 3, questions: 10, ouverte: true, duree_min: 55,
      demarree_le: new Date(Date.now() - 20 * 60000).toISOString(), appel_du_jour: true, eleves: 6, avec_pin: 6, deja_connectes: 6 },
    seances_de_classe: { ok: true, liste: [
      { id: 25, numero: 11, titre: 'IA 1', nature: 'projet', jalons: 5, echeance: '2026-10-16', duree_min: 180,
        ouverte: false, publiee: false, missions: 5, corriges: 0, reponses: 0, module_id: 3,
        // Lot 2 (06/10) : l'état et le planning, pour que l'audit voie le badge,
        // le bloc « Quand » de la fiche et ses options.
        etat: 'programmee', manque: [], demarree_le: null, auto_ouvrir: true, auto_clore: false,
        prevue_le: new Date(Date.now() + 3 * 3600000).toISOString(), fin_prevue: new Date(Date.now() + 5 * 3600000).toISOString() }] },
    // L'agenda du jour et l'emploi du temps : une ligne de chaque sorte.
    aujourdhui: { ok: true, jour: new Date().toISOString().slice(0, 10), maintenant: new Date().toISOString(),
      automatique: false, emploi_du_temps: true,
      creneaux: [{ classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', debut: '08:00', fin: '09:00',
                   debut_le: new Date(Date.now() + 3600000).toISOString(), fin_le: new Date(Date.now() + 7200000).toISOString() }],
      seances: [{ id: 3, classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', numero: 3, titre: 'Séance 3 - où vit la donnée',
        nature: 'cours', etat: 'en_cours', manque: [], ouverte: true, publiee: true, duree_min: 55,
        demarree_le: new Date(Date.now() - 20 * 60000).toISOString(), auto_clore: true,
        prevue_le: new Date(Date.now() - 25 * 60000).toISOString(), fin_prevue: new Date(Date.now() + 30 * 60000).toISOString(), journal: [] }] },
    emploi_du_temps: { ok: true, automatique: false, pg_cron: false, classes: [
      { id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV', creneaux: [{ jour: 2, debut: '08:00', fin: '09:00' }] }] },
    // Lot 3 (06/10) : la semaine à préparer, et le bilan de la page d'une séance.
    agenda: { ok: true, debut: new Date().toISOString().slice(0, 10), jours: 7, emploi_du_temps: true,
      creneaux: [{ classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', jour: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                   debut_le: new Date(Date.now() + 86400000).toISOString(), fin_le: new Date(Date.now() + 90000000).toISOString() },
                 { classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', jour: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
                   debut_le: new Date(Date.now() + 2 * 86400000).toISOString(), fin_le: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString() }],
      seances: [{ id: 25, classe_id: 1, nom: 'BTS SIO 1 - Bloc 1 DEV', numero: 11, titre: 'IA 1', nature: 'projet', etat: 'brouillon',
                  manque: ['echeance'], prevue_le: new Date(Date.now() + 86400000).toISOString(), fin_prevue: new Date(Date.now() + 90000000).toISOString() }],
      a_placer: [{ id: 25, classe_id: 1, numero: 11, titre: 'IA 1', etat: 'prete' }] },
    bilan_seance: { ok: true, inscrits: 6, participants: 5, reponses: 30,
      seance: { id: 25, numero: 11, nature: 'projet', etat: 'clos', ouverte: false, publiee: true,
                demarree_le: new Date(Date.now() - 86400000).toISOString(), prevue_le: null, fin_prevue: null, ecart_min: null },
      appel: { jour: new Date().toISOString().slice(0, 10), pose: true, presents: 5, absents: ['04'] },
      controle: { notions: 0 }, missions: { declarees: 5, mediane: 3, finis: 2 }, journal: [] },
    debriefing: { ok: true, concepts: [{ intitule: 'Une spécification', verdict: 'fragile', taux: 60 }], plus_ratees: [] },
  };
  return window.__e.ouvrirEspaceEnseignant();
}

if (!AXE) {
  rates.push(`axe-core introuvable (ni node_modules, ni le CDN à la version ${AXE_VERSION}) : ` +
             'rien n\'a été vérifié. « npm i axe-core » puis relancer.');
} else {
  for (const theme of ['light', 'dark']) {
    for (const largeur of [390, 1280]) {
      // L'écran de connexion, tel qu'il s'ouvre.
      const c = await ouvrir(nav, RACINE, { largeur });
      await c.page.emulateMedia({ colorScheme: theme });
      await c.page.waitForTimeout(300);
      await auditer(c.page, `connexion ${theme} ${largeur}`);
      await c.fermer();
      // L'espace enseignant, onglet par onglet.
      const e = await ouvrir(nav, RACINE, { largeur });
      await e.page.emulateMedia({ colorScheme: theme });
      await e.page.evaluate(donneesEnseignant);
      await e.page.waitForTimeout(800);
      for (const v of ['appel', 'quest', 'ensemble']) {
        await e.page.evaluate((v) => document.getElementById('ong-' + v).click(), v);
        await e.page.waitForTimeout(300);
        await auditer(e.page, `${v} ${theme} ${largeur}`);
        // Préparer, une seconde fois : la fiche d'une séance (le bloc « Quand »)
        // et l'emploi du temps déplié — ce que l'onglet fermé ne montre pas.
        if (v === 'quest') {
          await e.page.evaluate(() => {
            const b = document.querySelector('#gs-liste .gs-b');
            if (b) b.click();
            const d = document.getElementById('carte-edt');
            if (d) d.open = true;
          });
          await e.page.waitForTimeout(400);
          const ouverte = await e.page.evaluate(() => !document.getElementById('gs-quand').hidden &&
            !document.getElementById('carte-edt').hidden && document.getElementById('carte-edt').open);
          if (!ouverte) rates.push(`audit ${theme} ${largeur} : la fiche ou l'emploi du temps ne s'ouvrent pas — rien vérifié là`);
          await auditer(e.page, `quest+fiche ${theme} ${largeur}`);
          // Lot 3 : la barre des actions groupées, la page d'une séance (Préparer,
          // puis Bilan), et l'assistant « Nouveau module » ouvert.
          await e.page.evaluate(() => { const c = document.querySelector('#gs-liste .gs-choix'); if (c) c.click(); });
          await e.page.waitForTimeout(150);
          const lot = await e.page.evaluate(() => !document.getElementById('gs-lot').hidden &&
            !document.getElementById('carte-avenir').hidden);
          if (!lot) rates.push(`audit ${theme} ${largeur} : la barre groupée ou la semaine ne s'affichent pas — rien vérifié là`);
          await auditer(e.page, `quest+lot ${theme} ${largeur}`);
          for (const onglet of ['preparer', 'bilan']) {
            await e.page.evaluate((o) => { location.hash = '#s/25/' + o; }, onglet);
            await e.page.waitForTimeout(600);
            const vue = await e.page.evaluate((o) => !document.getElementById('volet-seance').hidden &&
              !document.getElementById('sp-' + o).hidden, onglet);
            if (!vue) rates.push(`audit ${theme} ${largeur} : la page s'ouvre mal sur ${onglet} — rien vérifié là`);
            await auditer(e.page, `page ${onglet} ${theme} ${largeur}`);
          }
          await e.page.evaluate(() => { document.getElementById('ong-quest').click(); document.getElementById('b-gs-module').click(); });
          await e.page.waitForTimeout(250);
          if (!(await e.page.evaluate(() => document.getElementById('as-dialog').open))) {
            rates.push(`audit ${theme} ${largeur} : l'assistant ne s'ouvre pas — rien vérifié là`);
          }
          await auditer(e.page, `assistant ${theme} ${largeur}`);
          await e.page.evaluate(() => document.getElementById('as-dialog').close());
        }
      }
      if (e.erreurs.length) rates.push(`audit ${theme} ${largeur} : erreur JS — ${e.erreurs[0]}`);
      await e.fermer();
    }
    // Le guide des composants.
    const site = await servir(RACINE, 0, '/');
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    const g = await ctx.newPage();
    const errG = [];
    g.on('pageerror', (x) => errG.push(String(x)));
    await g.goto(site.url + 'styleguide.html', { waitUntil: 'load' });
    await g.waitForTimeout(300);
    await auditer(g, `styleguide ${theme}`);
    const ko = await g.evaluate(() => [...document.querySelectorAll('#sg-contrastes .sg-ko')].map((x) => x.textContent));
    if (ko.length) rates.push(`styleguide ${theme} : encres sous 4,5 : 1 — ${ko.join(' | ')}`);
    if (!(await g.evaluate(() => document.querySelectorAll('#sg-inters [role="switch"]').length))) {
      rates.push(`styleguide ${theme} : aucun interrupteur rendu — js/interrupteur.js ne s'est pas chargé`);
    }
    if (errG.length) rates.push(`styleguide ${theme} : erreur JS — ${errG[0]}`);
    await ctx.close();
    site.fermer();
  }

  // WCAG 1.4.10 : à 320 px, rien ne défile en largeur.
  const r320 = await ouvrir(nav, RACINE, { largeur: 320 });
  await r320.page.waitForTimeout(300);
  const debords = [];
  const largeurDe = () => r320.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (await largeurDe() > 0) debords.push('connexion +' + (await largeurDe()) + ' px');
  await r320.page.evaluate(donneesEnseignant);
  await r320.page.waitForTimeout(800);
  for (const v of ['appel', 'quest', 'ensemble']) {
    await r320.page.evaluate((v) => document.getElementById('ong-' + v).click(), v);
    await r320.page.waitForTimeout(250);
    const d = await largeurDe();
    if (d > 0) debords.push(v + ' +' + d + ' px');
  }
  for (const o of ['preparer', 'direct', 'bilan']) {
    await r320.page.evaluate((o) => { location.hash = '#s/25/' + o; }, o);
    await r320.page.waitForTimeout(500);
    const d = await largeurDe();
    if (d > 0) debords.push('page ' + o + ' +' + d + ' px');
  }
  await r320.fermer();

  console.log('\n── axe-core ' + AXE_VERSION + ' (WCAG 2.2 AA), clair et sombre, 390 et 1 280 px');
  console.log('   violations :', fautesAxe.length, '· débordements à 320 px :', debords.length ? debords.join(', ') : 'aucun');
  fautesAxe.slice(0, 12).forEach((x) => rates.push('axe — ' + x));
  if (fautesAxe.length > 12) rates.push(`… et ${fautesAxe.length - 12} autres violations axe`);
  if (debords.length) rates.push(`à 320 px, la page défile en largeur (WCAG 1.4.10) : ${debords.join(', ')}`);
}

await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ L\'adresse dit où l\'on est, Précédent y ramène, les deux barres');
console.log('    d\'onglets suivent le même motif, rien n\'est annoncé en silence,');
console.log('    et axe-core ne trouve rien en clair comme en sombre (WCAG 2.2 AA).');
