#!/usr/bin/env node
// ── La vérification d'identité à une séance (14/11/2026) ──────────────────
//
//     node outils/t_identite.mjs
//
// Ce qu'on vérifie, en cassant chaque fois ce qu'on prétend voir :
//   · ÉTUDIANT — quand la séance l'exige, la carte « Vérification d'identité »
//     passe avant tout le reste, qui est caché ; une saisie d'un seul mot est
//     refusée sur place ; une saisie valide part au serveur, la carte s'en va
//     et le reste revient.
//   · ÉTUDIANT — si rien n'est exigé, ou si le serveur ne répond pas, on passe
//     tout de suite : une vérification ne doit jamais enfermer la classe dehors.
//   · ENSEIGNANT — la carte d'appel compte les conformes, les écarts et les
//     non déclarés, en comparant à la liste des noms du navigateur.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const rates = [];
const verifie = (cond, msg) => { if (!cond) rates.push(msg); };
const nav = await chromium.launch();
// Filet : selon la version de Playwright, le motif « **supabase-js** » de
// portail.mjs ne capte plus l'adresse du CDN, et le VRAI client se charge
// (constaté le 14/11 avec Playwright 1.49). On pose la même fausse couche au
// niveau du contexte, et on coupe le service worker, qui court-circuite les
// routes. Sans effet là où portail.mjs capte déjà : la route de page gagne.
const MOCK = fs.readFileSync(path.join(RACINE, 'outils', 'portail.mjs'), 'utf8')
  .split('const SUPABASE = `')[1].split('`;')[0];
const nouveauContexte = nav.newContext.bind(nav);
nav.newContext = async (o) => {
  const c = await nouveauContexte({ ...o, serviceWorkers: 'block' });
  await c.route(/supabase-js/, (r) => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
  return c;
};
const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });

// 1. Exigée, pas encore faite.
const r1 = await p.evaluate(async () => {
  window.__reponses = { identite_requise: { requise: true, faite: false, seance_id: 5 } };
  let e = document.getElementById('espace-etu');
  while (e) { e.hidden = false; e = e.parentElement; }
  ['chargement', 'connexion', 'espace-ens'].forEach((i) => { document.getElementById(i).hidden = true; });
  document.getElementById('bloc-appel').hidden = false;
  let suite = 0;
  window.__e.verifierIdentiteEtu(() => { suite++; });
  await new Promise((r) => setTimeout(r, 50));
  const carte = document.getElementById('bloc-identite');
  const avant = { carte: !!carte, appelCache: document.getElementById('bloc-appel').hidden, suite };
  document.getElementById('id-saisie').value = 'Dupont';
  carte.requestSubmit();
  await new Promise((r) => setTimeout(r, 50));
  const unMot = { suite, err: document.getElementById('err-identite').textContent,
                  envoye: window.__appels.some((a) => a.nom === 'declarer_identite') };
  window.__reponses.declarer_identite = { ok: true };
  document.getElementById('id-saisie').value = '  DUPONT   Camille ';
  carte.requestSubmit();
  await new Promise((r) => setTimeout(r, 50));
  const envoi = window.__appels.find((a) => a.nom === 'declarer_identite');
  return { avant, unMot, apres: { suite, carte: !!document.getElementById('bloc-identite'),
           appelCache: document.getElementById('bloc-appel').hidden, saisie: envoi && envoi.args.p_saisie } };
});
verifie(r1.avant.carte, "la carte d'identité ne s'affiche pas quand la séance l'exige");
verifie(r1.avant.appelCache, "le reste de l'espace étudiant reste visible avant la déclaration");
verifie(r1.avant.suite === 0, "la suite part avant la déclaration");
verifie(!r1.unMot.envoye && r1.unMot.suite === 0 && /nom ET votre prénom/.test(r1.unMot.err), "une saisie d'un seul mot n'est pas refusée sur place");
verifie(r1.apres.suite === 1 && !r1.apres.carte && !r1.apres.appelCache, "après une saisie valide, la carte ne s'en va pas ou le reste ne revient pas");
verifie(r1.apres.saisie === 'DUPONT Camille', "la saisie envoyée n'est pas nettoyée : " + r1.apres.saisie);

// 2. Pas exigée, puis serveur en panne : on passe.
const r2 = await p.evaluate(async () => {
  let n = 0;
  window.__reponses = { identite_requise: { requise: false } };
  window.__e.verifierIdentiteEtu(() => { n++; });
  await new Promise((r) => setTimeout(r, 30));
  window.__reponses = { identite_requise: null };
  window.__e.verifierIdentiteEtu(() => { n++; });
  await new Promise((r) => setTimeout(r, 30));
  return { n, carte: !!document.getElementById('bloc-identite') };
});
verifie(r2.n === 2 && !r2.carte, "sans exigence ou sans réponse du serveur, l'étudiant reste bloqué");

// 3. Enseignant.
const r3 = await p.evaluate(async () => {
  localStorage.setItem('tdc-noms', JSON.stringify({ 'BTS1-DEV-2026':
    { '01': 'DUPONT Camille', '02': 'MARTIN Léa', '03': 'DURAND Noé', '04': 'PETIT Inès' } }));
  window.__reponses = { identites_classe: { ok: true, seance: { id: 5, numero: 5, titre: 'S5' }, liste: [
    { numero: '01', saisie: 'camille dupont', saisies: 1, heure: '12:01' },
    { numero: '02', saisie: 'MARTIN Lea', saisies: 1, heure: '12:02' },
    { numero: '03', saisie: 'BERNARD Hugo', saisies: 1, heure: '12:03' },
    { numero: '04', saisie: null, saisies: null, heure: null } ] } };
  const b = document.createElement('div'); document.body.appendChild(b);
  window.__e.blocIdentitesClasse(b, { id: 1, code: 'BTS1-DEV-2026', nom: 'BTS1' });
  await new Promise((r) => setTimeout(r, 50));
  return { som: (b.querySelector('summary') || {}).textContent || '',
           ecarts: [...b.querySelectorAll('.ac-ecart')].map((x) => x.textContent),
           ouvert: (b.querySelector('details') || {}).open };
});
verifie(/2 conformes, 1 à vérifier, 1 non déclarées/.test(r3.som), "décompte enseignant faux : " + r3.som);
verifie(r3.ecarts.length === 1 && /03/.test(r3.ecarts[0]) && /NE CORRESPOND PAS/.test(r3.ecarts[0]), "l'écart du 03 n'est pas signalé");
verifie(r3.ouvert === true, "le bloc ne s'ouvre pas tout seul quand il y a un écart");
verifie(erreurs.length === 0, 'erreurs JS : ' + erreurs.join(' | '));

await fermer(); await nav.close();
if (rates.length) { console.log('ROUGE — ' + rates.length + ' :\n  · ' + rates.join('\n  · ')); process.exit(1); }
console.log('VERT — identité : carte étudiante, refus d\'un mot, passage sans exigence ni serveur, décompte enseignant.');
