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
//   · L'INVENTAIRE DES CONTRÔLES EST DANS LE MÊME ONGLET QUE LE SUIVI (B2) —
//     « En cours » depuis la refonte du 28/09. Il a vécu à cheval sur deux
//     onglets jusqu'au 17/09, avec deux libellés : on ne savait pas lequel
//     faisait autorité, donc on regardait les deux.

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
    let e = document.getElementById('carte-suivi');
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
  if (r.ouCtrl !== 'volet-appel') {
    rates.push(`l'inventaire des contrôles est dans « ${r.ouCtrl} » et non à côté du suivi de la séance, dans En cours (B2)`);
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
    let e = document.getElementById('carte-suivi');
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

// ── L'écran de la séance comme une application (28/09) ────────────────────
// En-tête collant (fil d'Ariane, état, chiffres, action), quatre vues, liste
// filtrable, fiche élève, « Clore » différé avec « Annuler », Pause.
const JOUR_MS = 86400000;
for (const w of [390, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((JOUR_MS) => {
    let e = document.getElementById('carte-suivi');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    const pc = document.getElementById('pk-classe'), ps = document.getElementById('pk-seance');
    pc.innerHTML = '<option value="2">BTS SIO 2 - SLAM</option>';
    ps.innerHTML = '<option value="">Choisir…</option><option value="14" data-titre="2 — TP2 EF Core" data-nature="cours">2 — TP2</option>';
    ps.value = '14';
    const s = window.__e.suivi;
    s.classeId = 2; s.seanceId = 14; s.nature = 'cours';
    s.classesConnues = [{ id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM' }];
    s.prevol = { ok: true, nature: 'cours', ouverte: true, seance: 2, duree_min: 55,
                 demarree_le: new Date(Date.now() - 20 * 60000).toISOString(), questions: 10 };
    const il = (min) => new Date(Date.now() - min * 60000).toISOString();
    window.__e.rendreSuivi({ total: 10, inscrits: 4, actifs: 3, reponses: 17, reussite: 70, avancement: 42,
      questions: [{ nom: 'q1', n: 3, ok: 2, pct: 67, choix: {} }],
      lignes: [
        { id: 1, numero: '01', avatar: '🦊', n: 10, ev: 10, ok: 9, maj: il(1), pct: 100, reussite: 90 },
        { id: 2, numero: '02', avatar: '🐢', n: 4, ev: 4, ok: 1, maj: il(15), pct: 40, reussite: 25 },
        { id: 3, numero: '03', avatar: '🦉', n: 3, ev: 3, ok: 3, maj: il(2), pct: 30, reussite: 100 },
        { id: 4, numero: '04', avatar: '🐙', n: 0, ev: 0, ok: 0, maj: null, pct: 0, reussite: null },
      ] });
    const tete = document.getElementById('sv-tete');
    return {
      sticky: getComputedStyle(tete).position,
      fil: document.getElementById('sv-fil').textContent.replace(/\s+/g, ' ').trim(),
      badge: document.getElementById('sv-badge').textContent,
      kpi: document.getElementById('sv-kpi').textContent,
      chrono: document.getElementById('sv-chrono').textContent,
      action: document.getElementById('b-sv-action').hidden ? '' : document.getElementById('b-sv-action').textContent,
      vues: ['maintenant', 'eleves', 'questions', 'fin'].map((v) => document.getElementById('sv-' + v).hidden ? 0 : 1).join(''),
      nEleves: document.getElementById('svn-eleves').textContent,
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, JOUR_MS);
  if (r.sticky !== 'sticky') rates.push(`${w} px : l'en-tête de la séance n'est pas collant (${r.sticky})`);
  if (!/BTS SIO 2 - SLAM/.test(r.fil) || !/TP2 EF Core/.test(r.fil)) rates.push(`${w} px : fil d'Ariane « ${r.fil} »`);
  if (r.badge !== 'En cours') rates.push(`${w} px : badge « ${r.badge} », attendu En cours`);
  if (!/^3\/4 actifs · 70 % juste$/.test(r.kpi)) rates.push(`${w} px : chiffres de l'en-tête « ${r.kpi} »`);
  if (!/^2\d \/ 55 min$/.test(r.chrono)) rates.push(`${w} px : chrono « ${r.chrono} »`);
  if (r.action !== 'Clore la séance') rates.push(`${w} px : action principale « ${r.action} »`);
  if (r.vues !== '1000') rates.push(`${w} px : vues visibles ${r.vues}, attendu Maintenant seule`);
  if (r.nEleves !== '4') rates.push(`${w} px : pastille Élèves « ${r.nEleves} »`);
  if (r.debord > 0) rates.push(`${w} px : l'écran de la séance déborde de ${r.debord} px`);

  // Les vues : clic, puis flèche droite.
  await p.click('#svb-eleves');
  const v1 = await p.evaluate(() => ['maintenant', 'eleves', 'questions', 'fin'].map((v) => document.getElementById('sv-' + v).hidden ? 0 : 1).join(''));
  await p.press('#svb-eleves', 'ArrowRight');
  const v2 = await p.evaluate(() => ({ vues: ['maintenant', 'eleves', 'questions', 'fin'].map((v) => document.getElementById('sv-' + v).hidden ? 0 : 1).join(''),
    focus: document.activeElement.id }));
  if (v1 !== '0100') rates.push(`${w} px : après un clic sur Élèves, vues ${v1}`);
  if (v2.vues !== '0010' || v2.focus !== 'svb-questions') rates.push(`${w} px : la flèche droite mène à ${v2.vues} / ${v2.focus}`);
  await p.click('#svb-eleves');

  // Les filtres et la recherche.
  const vis = () => p.evaluate(() => [...document.querySelectorAll('#liste-eleves .el')]
    .filter((d) => d.offsetParent).map((d) => d.dataset.num).join(','));
  await p.click('.filtre[data-f="rien"]');   const fRien = await vis();
  await p.click('.filtre[data-f="faible"]'); const fFaible = await vis();
  await p.click('.filtre[data-f="inactif"]'); const fInactif = await vis();
  await p.click('.filtre[data-f="tous"]');
  await p.fill('#sv-recherche', '03');       const fCherche = await vis();
  const compte = await p.evaluate(() => document.getElementById('sv-compte-el').textContent);
  await p.fill('#sv-recherche', '');
  if (fRien !== '04') rates.push(`${w} px : filtre Pas commencé → ${fRien}`);
  if (fFaible !== '02') rates.push(`${w} px : filtre En difficulté → ${fFaible}`);
  if (fInactif !== '02,04') rates.push(`${w} px : filtre Inactif 8 min → ${fInactif}`);
  if (fCherche !== '03' || compte !== '1 sur 4 élèves') rates.push(`${w} px : recherche « 03 » → ${fCherche} (${compte})`);

  // La fiche élève : un clic l'ouvre, Échap la ferme et rend le focus.
  await p.click('#liste-eleves .el[data-num="02"]');
  await p.waitForTimeout(150);
  const fiche = await p.evaluate(() => ({ ouverte: !document.getElementById('fiche-eleve').hidden,
    titre: document.getElementById('fe-titre').textContent,
    largeur: Math.round(document.querySelector('.fiche-panneau').getBoundingClientRect().width) }));
  await p.keyboard.press('Escape');
  const ferme = await p.evaluate(() => ({ cache: document.getElementById('fiche-eleve').hidden,
    focus: document.activeElement && document.activeElement.dataset.num }));
  if (!fiche.ouverte || fiche.titre !== 'Élève 02') rates.push(`${w} px : fiche « ${fiche.titre} » ouverte=${fiche.ouverte}`);
  if (fiche.largeur > w) rates.push(`${w} px : la fiche fait ${fiche.largeur} px`);
  if (!ferme.cache || ferme.focus !== '02') rates.push(`${w} px : Échap ferme=${ferme.cache}, focus rendu à ${ferme.focus}`);

  // Pause.
  await p.click('#b-sv-pause');
  const pause = await p.evaluate(() => ({ p: window.__e.suivi.pause, t: document.getElementById('sv-maj').textContent }));
  await p.click('#b-sv-pause');
  if (!pause.p || pause.t !== 'en pause') rates.push(`${w} px : Pause → ${JSON.stringify(pause)}`);

  // Clore : différé, et « Annuler » l'empêche de partir.
  if (w === 390) {
    await p.click('#b-sv-action');
    await p.waitForTimeout(200);
    const t1 = await p.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '',
      appels: window.__appels.filter((a) => a.nom === 'clore_seance').length }));
    await p.click('.toast-b');
    await p.waitForTimeout(5500);
    const t2 = await p.evaluate(() => window.__appels.filter((a) => a.nom === 'clore_seance').length);
    if (!/va être close/.test(t1.toast) || t1.appels !== 0) rates.push(`clore : message « ${t1.toast} », ${t1.appels} appel(s) immédiat(s)`);
    if (t2 !== 0) rates.push(`clore : « Annuler » n'a pas empêché la clôture (${t2} appel)`);
    await p.click('#b-sv-action');
    await p.waitForTimeout(5600);
    const t3 = await p.evaluate(() => window.__appels.filter((a) => a.nom === 'clore_seance').length);
    if (t3 !== 1) rates.push(`clore : sans « Annuler », ${t3} appel(s) à clore_seance après 5 s, attendu 1`);
  }

  if (erreurs.length) rates.push(`${w} px (écran de séance) : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · séance : « ${r.badge} » · ${r.kpi} · filtres ${fRien}/${fFaible}/${fInactif}`);
  await fermer();
}

await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ Les quatre chiffres sont gros sur un téléphone, tiennent sur une');
console.log('    ligne, ne cassent pas leur grille, et les contrôles d\'entrée');
console.log('    sont dans le bon onglet ; l\'écran de la séance a son en-tête collant,');
console.log('    ses quatre vues, ses filtres, sa fiche élève, et « Clore » s\'annule.');
