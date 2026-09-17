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
import { ouvrir } from './portail.mjs';

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
for (const [id, cle] of [['ong-quest', 'quest'], ['ong-seance', 'seance'], ['ong-ensemble', 'ensemble']]) {
  await p.click('#' + id);
  parcours.push({ clic: cle, hash: new URL(p.url()).hash, titre: await p.title() });
}
console.log('\n── l\'adresse suit l\'onglet');
for (const x of parcours) {
  console.log(`   clic « ${x.clic} » -> ${x.hash || '(aucune)'} · titre « ${x.titre} »`);
  if (x.hash !== '#' + x.clic) rates.push(`le clic sur « ${x.clic} » laisse l'adresse à « ${x.hash || 'rien'} »`);
  if (!x.titre.startsWith('Appel') && !/^[A-ZÀ-Ü]/.test(x.titre)) rates.push(`titre inattendu : ${x.titre}`);
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
if (apresRetour.hash !== '#seance') rates.push(`Précédent mène à « ${apresRetour.hash} », attendu « #seance »`);
if (apresRetour.actif !== 'ong-seance') rates.push(`Précédent laisse « ${apresRetour.actif} » actif — l'adresse et l'écran ne disent pas la même chose`);
if (apresRetour.volet.join() !== 'volet-seance') rates.push(`Précédent montre ${apresRetour.volet.join(', ')}`);

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
  rates.push(`ouvrir « #quest » n'ouvre pas l'onglet Questionnaires (${apresF5.actif} / ${apresF5.volet})`);
}

// ── 4. Les deux barres d'onglets suivent le même motif ───────────────────
const motif = await p.evaluate(() => {
  const lire = (ids) => ids.map((id) => {
    const b = document.getElementById(id);
    return { id, type: b.getAttribute('type'), tabindex: b.tabIndex,
             sel: b.getAttribute('aria-selected') };
  });
  return { connexion: lire(['t-etu', 't-ens']),
           enseignant: lire(['ong-appel', 'ong-ensemble', 'ong-quest', 'ong-seance']) };
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
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ L\'adresse dit où l\'on est, Précédent y ramène, les deux barres');
console.log('    d\'onglets suivent le même motif, et rien n\'est annoncé en silence.');
