// ── Ouvrir le portail pour un contrôle, sans le réécrire ──────────────────
//
// Jusqu'au 16/09, les trois contrôles ouvraient le portail en découpant son
// HTML à coups d'expressions régulières :
//
//     .replace(/<script src=[^>]*><\/script>/g, '')
//     .replace('<script>', faux + '<script>')
//     .replace('\n})();', '\nwindow.__e = { … };\n})();')
//
// Trois substitutions, trois occasions de ne plus rien tester le jour où une
// balise change de forme — et sans échouer, ce qui est pire. Le découpage en
// feuilles puis en modules l'interdit de toute façon : une feuille liée en
// relatif ou un import ne se résolvent pas dans une page injectée.
//
// Ici, le portail est SERVI, exactement comme GitHub Pages le sert, et ouvert
// par son adresse. Ce qu'on remplace, on le remplace au passage sur le réseau :
//
//   · config.js          -> une configuration d'essai ;
//   · le client Supabase -> une fausse couche qui note les appels ;
//   · le script du portail -> lui-même, PLUS une ligne à la fin qui expose ses
//     fonctions internes. Une seule substitution, sur un ancrage qui est la
//     fermeture de la fermeture — si elle disparaissait, ouvrir() le dirait
//     au lieu de tester le vide.
//
// Rien d'autre n'est touché : le HTML, les feuilles de style et le reste du
// script sont ceux du dépôt.

import path from 'path';
import fs from 'fs';
import { servir } from './serveur.mjs';

const CONFIG = "window.TDC_CONFIG = { url: 'https://essai.invalid', cle: 'x' };";

const SUPABASE = `
window.__appels = [];
window.supabase = { createClient: function(){ return {
  rpc: function(nom, args){
    window.__appels.push({ nom: nom, args: args });
    var r = (window.__reponses && window.__reponses[nom]) || { ok: true };
    return Promise.resolve({ data: r, error: null });
  },
  from: function(){ return { select: function(){ return Promise.resolve({ data: [], error: null }); } }; },
  auth: {
    getSession: function(){ return Promise.resolve({ data: { session: null } }); },
    signInAnonymously: function(){ return Promise.resolve({ data: {}, error: null }); },
    onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; }
  }
}; } };`;

// Les fonctions internes qu'un contrôle a le droit d'appeler. La liste est ici,
// une fois, plutôt que recopiée dans chaque fichier d'essai.
const EXPOSEES = [
  'rendreAFaire', 'rendreBibliotheque', 'rendreControles', 'rendreSemestre',
  'rendreSuivi', 'rendreRevision', 'rendreQuestionnairesEtu', 'remplirAppelClasse',
  'rendreParcours', 'rendreEcran', 'majFile', 'hisserQuestion', 'erreur',
  'modeEcran', 'ouvrirEcran', 'suivi', 'BIB',
];

const ANCRE = '\n})();';

/**
 * Ouvre le portail servi depuis `racine` dans un onglet prêt à être mesuré.
 * Rend { page, fermer, erreurs } — `erreurs` se remplit toute seule avec les
 * exceptions non rattrapées, qu'un contrôle a toujours intérêt à regarder.
 */
export async function ouvrir(nav, racine, options = {}) {
  const { largeur = 390, hauteur = 900, sousChemin = '/' } = options;
  const site = await servir(racine, 0, sousChemin);

  // Le script vit dans js/app.js après l'étape A3, et dans index.html avant.
  // Le contrôle n'a pas à savoir où on en est du découpage.
  const enModule = fs.existsSync(path.join(racine, 'js', 'app.js'));
  const cible = enModule ? '**/js/app.js' : site.url;
  const reseau = [];

  const source = enModule
    ? fs.readFileSync(path.join(racine, 'js', 'app.js'), 'utf8')
    : fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  if (!source.includes(ANCRE)) {
    await site.fermer();
    throw new Error(
      `ouvrir() ne trouve pas l'ancre « ${ANCRE.trim()} » dans ` +
      (enModule ? 'js/app.js' : 'index.html') + ' : les contrôles ne pourraient ' +
      'appeler aucune fonction interne, et passeraient au vert sans rien vérifier. ' +
      'Corrigez EXPOSEES/ANCRE dans outils/portail.mjs plutôt que de contourner.');
  }

  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
  page.on('response', (rep) => reseau.push({
    url: rep.url(), statut: rep.status(), type: rep.headers()['content-type'] || '' }));
  page.on('requestfailed', (q) => reseau.push({
    url: q.url(), statut: 0, type: '', echec: q.failure() && q.failure().errorText }));

  await page.route('**/config.js', (r) =>
    r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: CONFIG }));
  await page.route('**supabase-js**', (r) =>
    r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: SUPABASE }));
  // La police n'est PAS remplacée, et c'est délibéré : les plafonds de hauteur
  // des contrôles (1 150 px pour la carte d'appel, 2 100 px pour l'onglet
  // Questionnaires) ont été mesurés avec IBM Plex, celle que le portail publié
  // utilise. La neutraliser fait gonfler l'onglet Questionnaires de 1 945 à
  // 2 105 px — mesuré — et le contrôle échouerait alors sur sa propre mise en
  // scène. En échange, une mesure faite sans la police est une mesure fausse :
  // `police` le dit, et les contrôles le signalent plutôt que de conclure.

  const ajout = '\nwindow.__e = { ' +
    EXPOSEES.map((n) => `${n}: typeof ${n} === "undefined" ? undefined : ${n}`).join(', ') +
    ' };' + ANCRE;
  await page.route(cible, async (r) => {
    const rep = await r.fetch();
    const t = (await rep.text()).replace(ANCRE, ajout);
    await r.fulfill({ response: rep, body: t });
  });

  await page.goto(site.url, { waitUntil: 'load' });
  try { await page.evaluate(() => document.fonts.ready); } catch (e) {}
  // document.fonts.check() répond « oui » même quand la famille est absente et
  // que le navigateur se rabattra sur autre chose : essayé, il ne voit rien.
  // On regarde donc la liste des fontes réellement chargées.
  const police = await page.evaluate(() => {
    try {
      return [...document.fonts].some((f) => /IBM Plex/.test(f.family) && f.status === 'loaded');
    } catch (e) { return false; }
  });

  return {
    page, erreurs, police, reseau, url: site.url,
    fermer: async () => { await ctx.close(); site.fermer(); },
  };
}
