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
  // Le client réel s'enchaîne — .from().select().order().eq()… — et se
  // termine en promesse. Une fausse couche qui ne rend qu'un .select()
  // oblige chaque contrôle à éviter les chemins qui enchaînent, c'est-à-dire
  // à éviter précisément ce qui casse. Celle-ci s'enchaîne autant qu'on veut
  // et se résout toujours sur une liste vide.
  from: function(){
    var vide = { data: [], error: null };
    var chaine = {
      then: function(ok, ko){ return Promise.resolve(vide).then(ok, ko); },
      catch: function(f){ return Promise.resolve(vide).catch(f); }
    };
    ['select','order','eq','neq','in','gte','lte','limit','single','maybeSingle',
     'insert','update','upsert','delete','filter','or','not','range']
      .forEach(function(m){ chaine[m] = function(){ return chaine; }; });
    return chaine;
  },
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
  'modeEcran', 'ouvrirEcran', 'ouvrirEspaceEnseignant', 'suivi', 'BIB',
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

  // Les fonctions vivent maintenant dans plusieurs modules. Celles d'app.js
  // sont dans la portée de la fermeture, et on les nomme une à une ; celles des
  // autres modules arrivent par leurs exports, importés ici en bloc. Un import
  // au bas d'un module est hissé comme les autres : il n'y a pas d'ordre à
  // respecter, et app.js n'a pas à porter d'import dont il ne se sert pas.
  const autres = fs.readdirSync(path.join(racine, 'js'))
    .filter((f) => f.endsWith('.js') && f !== 'app.js').sort();
  const imports = autres.map((f, i) => `import * as __m${i} from './${f}';`).join('\n');
  const fusion = autres.map((f, i) => `__m${i}`).join(', ');
  // Les noms d'EXPOSEES qu'app.js ne connaît plus valent `undefined` — et un
  // `undefined` posé APRÈS la fusion écrasait la vraie fonction venue du
  // module. C'est arrivé le 17/09 en sortant appel.js : la clé existait, sa
  // valeur ne valait rien, et le contrôle échouait sur « n'est pas une
  // fonction » sans que rien ne désigne la cause. On retire donc les `undefined`
  // avant de fusionner.
  const ajout = '\nwindow.__e = (function(){ var l = { ' +
    EXPOSEES.map((n) => `${n}: typeof ${n} === "undefined" ? undefined : ${n}`).join(', ') +
    ' }; for (var k in l) if (l[k] === undefined) delete l[k];' +
    ' return Object.assign({}' + (fusion ? ', ' + fusion : '') + ', l); })();' +
    ANCRE + '\n' + imports + '\n';
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
