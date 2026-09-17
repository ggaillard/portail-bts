#!/usr/bin/env node
// ── L'espace de l'étudiant, sur son téléphone ─────────────────────────────
//
//     node outils/t_etudiant.mjs        # depuis la racine du dépôt
//
// Huit contrôles regardaient l'écran de l'enseignant. Aucun ne regardait celui
// que TRENTE personnes ouvrent en même temps, sur trente téléphones, au début
// de chaque séance — et qui est le seul écran du portail dont une panne se
// paie en minutes de cours perdues.
//
// Ce contrôle est né d'une erreur de méthode qu'il faut dire : §3.8 de
// REFONTE.md affirmait que l'espace étudiant n'avait « ni repères d'avancement
// ni retour en arrière ». C'était écrit en LISANT le balisage, pas en mesurant
// le rendu. Mesuré, c'est faux : le bandeau de file compte ce qui reste, chaque
// carte porte son rang, et une carte finie se replie au lieu de disparaître.
// L'audit s'est donc trompé là où il n'avait pas mesuré — et la réponse n'est
// pas de corriger la phrase, c'est de mettre cet écran sous mesure.
//
// Quatre exigences :
//
//   · ON ATTEINT TOUT AVEC LE POUCE. Aucune cible tapable sous 44 px de haut,
//     et pas un pixel de défilement horizontal, à 360 comme à 390 px.
//
//   · LA FILE DIT LA VÉRITÉ. Le compteur du bandeau vaut exactement le nombre
//     de cartes visibles qui ne sont ni faites ni hors file. Un « 2 » quand il
//     reste trois choses, et l'étudiant croit avoir fini.
//
//   · UNE CARTE FINIE SE REPLIE, ELLE NE DISPARAÎT PAS. « Il était là tout à
//     l'heure » se lit comme une panne. Elle reste, réduite à son titre et à
//     son accusé — moins de la moitié d'une carte active.
//
//   · CHAQUE CARTE PORTE SON RANG. Le rang est recalculé à chaque rendu : selon
//     la classe et le jour il y a deux cartes ou quatre, et un numéro figé
//     mentirait une fois sur deux.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const PLAFOND_PAGE = 1800;   // l'espace étudiant déplié, à 390 px
// Une carte finie ne se mesure pas en pixels absolus — son accusé fait deux
// lignes à 360 px et une seule à 768 px — mais PAR RAPPORT à une carte active :
// elle doit avoir visiblement cédé la place. Mesuré le 17/09 : 146 px contre
// 434 px à 360 px, soit un tiers.
const PART_PLIEE = 0.5;

// Un questionnaire répondu (les douze réponses sont là) et un questionnaire
// de révision intact : les deux états qui cohabitent vraiment en séance.
const q = (n, rep) => ({
  question: 'revision-poo-tp1-' + String(n).padStart(2, '0'),
  intitule: 'Question ' + n + ' sur la POO ?',
  options: ['Une classe', 'Un objet', 'Une méthode', 'Un champ'],
  ma_reponse: rep, bonne: null, explication: null, juste: null,
});

const LISTE = [
  { seance_id: 31, numero: 98, titre: 'Faisons connaissance',
    intro: 'Quelques questions posées une seule fois dans l’année.',
    mode: 'sequentiel', corrige: false, total: 12, faites: 12, justes: 0,
    questions: Array.from({ length: 12 }, (_, i) => q(i + 1, 'Une classe')) },
  { seance_id: 34, numero: 90, titre: "Réviser l'interro — Console & POO",
    intro: 'Douze questions, à refaire autant de fois qu’on veut.',
    mode: 'revision', corrige: true, total: 12, faites: 0, justes: 0,
    questions: Array.from({ length: 12 }, (_, i) => q(i + 1, null)) },
];

const rates = [];
const nav = await chromium.launch();

for (const w of [360, 390, 768]) {
  const { page: p, erreurs, police, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((LISTE) => {
    let e = document.getElementById('espace-etu');
    while (e) { e.hidden = false; e = e.parentElement; }
    ['chargement', 'connexion', 'espace-ens'].forEach((i) => { document.getElementById(i).hidden = true; });
    ['bloc-appel', 'bloc-humeur', 'file-etu'].forEach((i) => { document.getElementById(i).hidden = false; });

    // L'appel et l'humeur sont remplis par le serveur : ici, à la main, avec
    // le même balisage — ce sont des cartes d'étape comme les autres.
    const opts = (id, libelles) => {
      document.getElementById(id).innerHTML = libelles
        .map((t) => '<button class="btn btn-sec appel-opt">' + t + '</button>').join('');
    };
    opts('appel-choix', ['Présent', 'Présent, à distance', 'Présent, sur un autre poste', 'Absent']);
    opts('humeur-choix', ['😀 En forme', '🙂 Ça va', '😐 Fatigué', '😴 Difficile']);

    let ratage = null;
    try { window.__e.rendreQuestionnairesEtu(LISTE); } catch (x) { ratage = x.message; }

    const visible = (x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    const petits = [];
    document.querySelectorAll('#espace-etu button, #espace-etu summary, #espace-etu a').forEach((b) => {
      if (!visible(b)) return;
      const h = b.getBoundingClientRect().height;
      if (h < 44) petits.push((b.textContent || b.id).trim().slice(0, 24) + ' (' + Math.round(h) + ' px)');
    });

    const cartes = [...document.querySelectorAll('#espace-etu .etape')].filter((c) => !c.hidden);
    return {
      ratage,
      page: Math.round(document.getElementById('espace-etu').getBoundingClientRect().height),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      petits,
      reste: (document.getElementById('file-reste') || {}).textContent,
      texte: (document.getElementById('file-txt') || {}).textContent,
      cartes: cartes.map((c) => ({
        id: c.id,
        titre: (c.querySelector('h2') || {}).textContent || '',
        rang: (c.querySelector('h2') || { getAttribute: () => null }).getAttribute('data-n'),
        fait: c.getAttribute('data-fait'),
        horsFile: c.getAttribute('data-hors-file'),
        hauteur: Math.round(c.getBoundingClientRect().height),
        accuse: (c.querySelector('.msg') || {}).textContent || '',
        // Ce qui reste VISIBLE dans la carte. Une carte finie doit avoir perdu
        // son intro, son intitulé de question et ses options — mesurer sa
        // hauteur ne suffit pas à le dire : le code vide déjà les deux
        // dernières, et seule l'intro fait la différence en pixels.
        montre: ['.hint', '.cn-int', '.appel-choix']
          .filter((s) => { const x = c.querySelector(s); return x && visible(x); }),
      })),
    };
  }, LISTE);

  const duesAttendu = r.cartes.filter((c) => c.fait !== 'oui' && c.horsFile !== 'oui').length;

  console.log(`\n── ${w} px · espace étudiant ${r.page} px · débord ${r.debord} px`);
  r.cartes.forEach((c) => console.log(
    `   ${String(c.rang || '—').padStart(2)} · ${String(c.hauteur).padStart(4)} px  ` +
    `${c.titre.slice(0, 34).padEnd(34)} fait=${c.fait} hors-file=${c.horsFile}`));
  console.log(`   file : « ${r.reste} ${r.texte} » · dû d'après les cartes : ${duesAttendu}`);
  console.log(`   cibles < 44 px : ${r.petits.join(' · ') || 'aucune'}`);

  if (r.ratage) rates.push(`${w} px : rendreQuestionnairesEtu a échoué — ${r.ratage}`);
  if (!police) rates.push(`${w} px : IBM Plex n'a pas été chargée — les hauteurs sont fausses`);
  if (r.debord > 0) rates.push(`${w} px : la page déborde de ${r.debord} px sur le côté`);
  if (r.petits.length) {
    rates.push(`${w} px : ${r.petits.length} cible(s) sous 44 px — ${r.petits.join(' · ')}`);
  }
  if (w === 390 && r.page > PLAFOND_PAGE) {
    rates.push(`390 px : l'espace étudiant fait ${r.page} px, plafond ${PLAFOND_PAGE}`);
  }

  // La file : le compteur du bandeau contre ce que disent les cartes.
  const annonce = r.reste === '✓' ? 0 : Number(r.reste);
  if (annonce !== duesAttendu) {
    rates.push(`${w} px : le bandeau annonce « ${r.reste} » et les cartes en réclament ` +
               `${duesAttendu} — l'étudiant croirait avoir fini`);
  }

  // Le rang : présent, unique, et dans l'ordre d'affichage.
  const rangs = r.cartes.map((c) => c.rang);
  if (rangs.some((x) => x === null)) {
    rates.push(`${w} px : une carte ne porte pas son rang (${JSON.stringify(rangs)})`);
  } else if (rangs.join(',') !== r.cartes.map((_, i) => String(i + 1)).join(',')) {
    rates.push(`${w} px : les rangs sont ${rangs.join('/')} au lieu de 1..${r.cartes.length}`);
  }

  // La carte finie : toujours là, repliée, avec son accusé.
  const finie = r.cartes.find((c) => c.id === 'qn-31');
  if (!finie) {
    rates.push(`${w} px : le questionnaire répondu a disparu de l'écran — ` +
               `« il était là tout à l'heure » se lit comme une panne`);
  } else {
    if (finie.fait !== 'oui') rates.push(`${w} px : le questionnaire répondu n'est pas marqué fait`);
    const active = Math.max(...r.cartes.filter((c) => c.fait !== 'oui').map((c) => c.hauteur));
    if (finie.hauteur > active * PART_PLIEE) {
      rates.push(`${w} px : la carte finie fait ${finie.hauteur} px pour ${active} px ` +
                 `à une carte active — elle ne s'est pas repliée`);
    }
    if (finie.montre.length) {
      rates.push(`${w} px : la carte finie montre encore ${finie.montre.join(', ')} — ` +
                 `le repli tient à .etape[data-fait="oui"] dans styles/questionnaires.css`);
    }
    if (!/c'est fait/i.test(finie.accuse)) {
      rates.push(`${w} px : la carte finie ne dit pas qu'elle est faite (« ${finie.accuse} »)`);
    }
  }

  // Le questionnaire de révision : visible, jouable, et HORS file — il se refait
  // à volonté, le compteur ne doit pas le réclamer indéfiniment.
  const rev = r.cartes.find((c) => c.id === 'qn-34');
  if (!rev) rates.push(`${w} px : le questionnaire de révision ne s'affiche pas`);
  else if (rev.horsFile !== 'oui') {
    rates.push(`${w} px : le questionnaire de révision est dans la file — ` +
               `il n'a pas de fin, le compteur réclamerait « 1 chose à faire » indéfiniment`);
  }

  if (erreurs.length) rates.push(`${w} px : erreur JS — ${erreurs[0]}`);
  await fermer();
}
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ L\'espace étudiant s\'atteint au pouce, sa file dit la vérité,');
console.log('    ses cartes portent leur rang, et une carte finie se replie');
console.log('    au lieu de disparaître.');
