#!/usr/bin/env node
// ── Le tableau de bord d'une séance, lu debout ────────────────────────────
//
//     node outils/t_suivi.mjs        # depuis la racine du dépôt
//
// L'onglet « Suivi d'une séance » n'était vérifié par rien. C'est pourtant le
// seul qu'on consulte EN MARCHANT : entre deux rangs, pour savoir qui n'a pas
// démarré. Trois exigences, et la première est celle qui a révélé le défaut :
//
//   · LES QUATRE CHIFFRES SE LISENT D'UN COUP D'ŒIL. Leur mise en forme
//     « téléphone » — chiffres plus gros — était écrite depuis toujours dans un
//     bloc @media qui n'a JAMAIS pris effet : les règles ordinaires, écrites
//     plus bas dans la feuille et de même spécificité, l'écrasaient. Sur un
//     téléphone, on lisait donc la taille du bureau. Rétablie le 17/09, et
//     mesurée.
//
//   · LA VALEUR NE PASSE PAS À LA LIGNE. « 12 / 31 » avec ses espaces se coupe
//     à 360 px et la tuile gagne 30 px pour rien. « 12/31 » tient, et c'est
//     aussi comme cela qu'on écrit un score.
//
//   · UNE VALEUR TROP LONGUE NE CASSE PAS LA GRILLE. « 1fr » vaut
//     minmax(auto, 1fr) : une colonne ne descend jamais sous la largeur
//     INSÉCABLE de son contenu, et « 12/31 » n'a plus d'espace où se couper.
//     Avec les valeurs réelles cela ne change rien — mesuré — mais les quatre
//     chiffres viennent de la base, et une grille ne doit pas pouvoir être
//     cassée par la longueur d'une valeur. Vérifié plus bas avec une valeur
//     volontairement absurde, ce qui est le seul moyen de vérifier un garde-fou.
//
//   · L'INVENTAIRE DES CONTRÔLES EST DANS CET ONGLET (B2). Il y a vécu à
//     cheval sur deux onglets jusqu'au 17/09, avec deux libellés : on ne savait
//     pas lequel faisait autorité, donc on regardait les deux.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();
const PLAFOND_GRILLE = 200;   // les quatre tuiles, à 360 px

const rates = [];
const nav = await chromium.launch();

// 620 px est le cas serré : quatre colonnes dans une carte de 530 px. C'est là
// qu'une colonne qui refuse de rétrécir se voit, et nulle part ailleurs.
for (const w of [360, 390, 620, 1280]) {
  const { page: p, erreurs, police, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate(() => {
    let e = document.getElementById('volet-seance');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    document.getElementById('stats-zone').hidden = false;
    document.getElementById('carte-controles').hidden = false;

    // Les quatre tuiles telles que rendreSuivi() les écrit, valeurs comprises.
    document.getElementById('tuiles').innerHTML =
      [['12/31', 'en activité'], ['143', 'réponses'],
       ['64 %', 'avancement moyen'], ['71 %', 'de réussite']]
      .map(([v, l]) => '<div class="tuile"><div class="tuile-v">' + v +
                       '</div><div class="tuile-l">' + l + '</div></div>').join('');

    const v = document.querySelector('.tuile-v');
    const dansVolet = (id) => {
      let n = document.getElementById(id);
      while (n && !n.classList.contains('volet')) n = n.parentElement;
      return n ? n.id : '(hors volet)';
    };
    const g = document.getElementById('tuiles');
    const colonnes = getComputedStyle(g).gridTemplateColumns.split(' ').map(parseFloat);
    return {
      police: getComputedStyle(v).fontSize,
      largeurs: colonnes.map((x) => Math.round(x)),
      inegalite: Math.round(Math.max(...colonnes) - Math.min(...colonnes)),
      debordGrille: g.scrollWidth - g.clientWidth,
      hauteurs: [...document.querySelectorAll('.tuile')].map((t) => Math.round(t.getBoundingClientRect().height)),
      grille: Math.round(document.getElementById('tuiles').getBoundingClientRect().height),
      coupee: v.scrollWidth > v.clientWidth,
      colonnes: getComputedStyle(document.getElementById('tuiles')).gridTemplateColumns.split(' ').length,
      ouCtrl: dansVolet('carte-controles'),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  const ecart = Math.max(...r.hauteurs) - Math.min(...r.hauteurs);
  console.log(`\n── ${w} px · tuiles ${r.hauteurs.join('/')} px · grille ${r.grille} px · ` +
              `${r.colonnes} colonne(s) · chiffre ${r.police}`);
  console.log(`   colonnes ${r.largeurs.join('/')} px · inventaire des contrôles : ${r.ouCtrl}`);

  if (r.inegalite > 1) {
    rates.push(`${w} px : les colonnes de tuiles font ${r.largeurs.join('/')} px, ` +
               `elles devraient être égales`);
  }
  if (r.debordGrille > 0) {
    rates.push(`${w} px : la grille des tuiles déborde de sa carte de ${r.debordGrille} px`);
  }

  if (!police) rates.push(`${w} px : IBM Plex n'a pas été chargée — les hauteurs sont fausses`);
  const attendu = w >= 544 ? '23.2px' : '27.2px';
  if (r.police !== attendu) {
    rates.push(`${w} px : le chiffre fait ${r.police}, attendu ${attendu} — ` +
               (w >= 544 ? 'au bureau on lit assis' : "c'est l'écran qu'on lit debout"));
  }
  if (r.coupee) rates.push(`${w} px : la valeur d'une tuile est coupée`);
  if (ecart > 24) {
    rates.push(`${w} px : ${ecart} px d'écart entre la plus haute et la plus basse tuile — ` +
               `une valeur passe à la ligne (hauteurs ${r.hauteurs.join('/')})`);
  }
  if (w === 360 && r.grille > PLAFOND_GRILLE) {
    rates.push(`360 px : les quatre tuiles font ${r.grille} px, plafond ${PLAFOND_GRILLE}`);
  }
  if (r.colonnes !== (w >= 544 ? 4 : 2)) {
    rates.push(`${w} px : ${r.colonnes} colonnes de tuiles, attendu ${w >= 544 ? 4 : 2}`);
  }
  if (r.ouCtrl !== 'volet-seance') {
    rates.push(`l'inventaire des contrôles est dans « ${r.ouCtrl} » et non dans le suivi d'une séance (B2)`);
  }
  if (r.debord > 0) rates.push(`${w} px : la page déborde de ${r.debord} px`);
  if (erreurs.length) rates.push(`${w} px : erreur JS — ${erreurs[0]}`);
  await fermer();
}

// ── Le garde-fou : une valeur que la base ne devrait jamais renvoyer ───────
// On ne mesure pas ici un cas plausible. On vérifie qu'une valeur insécable
// trop longue rétrécit et se coupe DANS sa colonne, au lieu de l'élargir et de
// pousser les trois autres dehors. C'est ce que minmax(0,1fr) garantit et que
// 1fr ne garantit pas — un contrôle qui n'utilise que des valeurs raisonnables
// ne verrait jamais la différence.
const ABSURDE = '1234567/7654321';
for (const w of [360, 620]) {
  const { page: p, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((val) => {
    let e = document.getElementById('volet-seance');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    document.getElementById('stats-zone').hidden = false;
    document.getElementById('tuiles').innerHTML =
      [[val, 'en activité'], ['143', 'réponses'],
       ['64 %', 'avancement moyen'], ['71 %', 'de réussite']]
      .map(([v, l]) => '<div class="tuile"><div class="tuile-v">' + v +
                       '</div><div class="tuile-l">' + l + '</div></div>').join('');
    const g = document.getElementById('tuiles');
    const col = getComputedStyle(g).gridTemplateColumns.split(' ').map(parseFloat);
    return { largeurs: col.map((x) => Math.round(x)),
             inegalite: Math.round(Math.max(...col) - Math.min(...col)),
             debordGrille: g.scrollWidth - g.clientWidth,
             debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, ABSURDE);

  console.log(`\n── ${w} px · « ${ABSURDE} » dans la première tuile · ` +
              `colonnes ${r.largeurs.join('/')} px`);
  if (r.inegalite > 1) {
    rates.push(`${w} px : avec une valeur trop longue, les colonnes font ` +
               `${r.largeurs.join('/')} px — il faut minmax(0,1fr) et non 1fr`);
  }
  if (r.debordGrille > 0 || r.debord > 0) {
    rates.push(`${w} px : une valeur trop longue pousse la grille (${r.debordGrille} px) ` +
               `ou la page (${r.debord} px) hors de leur cadre`);
  }
  await fermer();
}
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ Les quatre chiffres sont gros sur un téléphone, tiennent sur une');
console.log('    ligne, ne cassent pas leur grille, et les contrôles d\'entrée');
console.log('    sont dans le bon onglet.');
