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
      ouEditeur: dansVolet('ct-texte'),
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
  if (r.ouCtrl !== r.ouEditeur) {
    rates.push(`l'inventaire des contrôles est dans « ${r.ouCtrl} » et leur éditeur dans « ${r.ouEditeur} » : ` +
               `on ne sait plus lequel fait autorité (B2)`);
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

// ── Ouvrir, fermer, montrer (05/10) ───────────────────────────────────────
// Le 05/10, la séance IA 1 du BTS2 — un projet créé fermé et caché — ne
// pouvait pas être ouverte depuis En cours : le pré-vol disait « Séance
// fermée » sans bouton (ceux du pré-vol sont masqués), l'en-tête cachait son
// action pour tout projet, et la zone des chiffres donnait une requête SQL.
// On vérifie ici que chaque état a son geste, et que le geste part vers la
// bonne fonction : ouvrir un projet publie ET ouvre SANS démarrer le chrono.
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const LIGNE = { id: 25, classe_id: 2, numero: 11, titre: "IA 1 - Développer à partir d'une spécification, avec un agent",
                  nature: 'projet', jalons: 5, echeance: '2026-10-16', duree_min: 180, publiee: false, ouverte: false };
  const etat = (pv, publiee) => p.evaluate(({ pv, publiee, LIGNE }) => {
    let e = document.getElementById('carte-suivi');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    const pc = document.getElementById('pk-classe'), ps = document.getElementById('pk-seance');
    pc.innerHTML = '<option value="2">BTS SIO 2 - SLAM</option>';
    ps.innerHTML = '<option value="">Choisir…</option><option value="25" data-titre="11 — IA 1" data-nature="' +
                   pv.nature + '">11 — IA 1 · fermée</option>';
    ps.value = '25';
    const s = window.__e.suivi;
    s.classeId = 2; s.seanceId = '25'; s.nature = pv.nature;
    // La fausse couche rend toujours une liste vide pour .from() : on lui
    // fait rendre la ligne de la séance, que pré-vol et ouverture relisent.
    const sb = window.__e.sb;
    sb.from = function(){
      const ch = { then: (ok, ko) => Promise.resolve({ data: [Object.assign({}, LIGNE, { publiee: publiee, ouverte: pv.ouverte })],
                                                      error: null }).then(ok, ko) };
      ['select', 'eq', 'order', 'neq', 'in', 'limit'].forEach((m) => { ch[m] = () => ch; });
      return ch;
    };
    window.__reponses = Object.assign(window.__reponses || {}, { preflight_seance: Object.assign({ ok: true, jalons: 5,
      echeance: '2026-10-16', duree_min: 180, questions: 0, appel_du_jour: true, eleves: 13, avec_pin: 13,
      deja_connectes: 12, seance: 11 }, pv), enregistrer_seance: { ok: true, id: 25, cree: false } });
    window.__appels.length = 0;
    return window.__e.chargerPrevol().then(() => ({
      badge: document.getElementById('sv-badge').textContent,
      action: document.getElementById('b-sv-action').hidden ? '' : document.getElementById('b-sv-action').textContent,
      chrono: document.getElementById('sv-chrono').textContent,
      lignes: [...document.querySelectorAll('#prevol-liste li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
      gestes: [...document.querySelectorAll('#prevol-liste .pv-geste')].map((b) => b.textContent),
      pastille: document.getElementById('prevol-etat').textContent,
    }));
  }, { pv, publiee, LIGNE });
  const appels = () => p.evaluate(() => window.__appels.map((a) => a.nom + ' ' + JSON.stringify(a.args || {})));

  // 1. Projet fermé et caché : l'en-tête ET la ligne offrent « Ouvrir le projet ».
  const f = await etat({ nature: 'projet', ouverte: false, demarree_le: null }, false);
  if (f.action !== 'Ouvrir le projet') rates.push(`projet fermé : action de l'en-tête « ${f.action} », attendu « Ouvrir le projet »`);
  if (!f.gestes.includes('Ouvrir le projet')) rates.push(`projet fermé : la ligne du pré-vol n'offre pas « Ouvrir le projet » (${f.gestes.join(', ')})`);
  if (!f.lignes.some((l) => /Projet fermé — les étudiants ne le voient pas/.test(l))) rates.push(`projet fermé : ${f.lignes.join(' | ')}`);
  // L'en-tête s'il a son bouton, sinon la ligne : un défaut ne doit pas en
  // masquer un autre derrière un clic impossible.
  if (f.action === 'Ouvrir le projet') await p.click('#b-sv-action');
  else if (f.gestes.includes('Ouvrir le projet')) await p.click('#prevol-liste .pv-geste:text("Ouvrir le projet")');
  await p.waitForTimeout(250);
  const a1 = await appels();
  const enr = a1.filter((x) => x.startsWith('enregistrer_seance'));
  if (enr.length !== 1) rates.push(`projet fermé : « Ouvrir le projet » → ${enr.length} appel(s) à enregistrer_seance (${a1.join(' | ')})`);
  else {
    const g = JSON.parse(enr[0].slice('enregistrer_seance '.length));
    if (g.p_publiee !== true || g.p_ouverte !== true) rates.push(`projet fermé : ouvrir n'envoie pas publiee ET ouverte — ${enr[0]}`);
    if (g.p_echeance !== '2026-10-16' || g.p_jalons !== 5 || g.p_numero !== 11 || g.p_duree_min !== 180) {
      rates.push(`projet fermé : ouvrir réécrit autre chose que l'état — ${enr[0]}`);
    }
  }
  if (a1.some((x) => x.startsWith('demarrer_seance'))) rates.push('projet fermé : ouvrir passe par demarrer_seance — le chrono ferait du projet « la séance du jour »');
  const toast1 = await p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  if (!/Projet ouvert/.test(toast1)) rates.push(`projet fermé : pas de confirmation après ouverture (« ${toast1} »)`);

  // 2. Projet ouvert mais caché : « Le rendre visible » → publier_seance(25, true).
  const c = await etat({ nature: 'projet', ouverte: true, demarree_le: null }, false);
  if (c.badge !== 'Ouvert, caché') rates.push(`projet caché : badge « ${c.badge} »`);
  if (!c.gestes.includes('Rendre visible')) rates.push(`projet caché : pas de « Rendre visible » (${c.gestes.join(', ')})`);
  if (c.gestes.includes('Rendre visible')) await p.click('#prevol-liste .pv-geste:text("Rendre visible")');
  await p.waitForTimeout(200);
  const a2 = await appels();
  if (!a2.includes('publier_seance {"p_seance_id":25,"p_publiee":true}')) rates.push(`projet caché : ${a2.join(' | ')}`);

  // 3. Projet ouvert et visible : pas d'action d'en-tête ; « Clore le projet » est différé.
  const o = await etat({ nature: 'projet', ouverte: true, demarree_le: null }, true);
  if (o.action) rates.push(`projet ouvert : l'en-tête propose « ${o.action} » — un projet ouvert le reste, sans bouton sous le pouce`);
  if (o.pastille !== 'Tout est prêt') rates.push(`projet ouvert : pastille « ${o.pastille} »`);
  await p.click('#prevol .prevol-tete');            // replié quand tout est prêt : on le déplie
  await p.click('#prevol-liste .pv-geste:text("Clore le projet")');
  await p.waitForTimeout(200);
  const avant = (await appels()).filter((x) => x.startsWith('clore_seance')).length;
  await p.waitForTimeout(5500);
  const apres = (await appels()).filter((x) => x.startsWith('clore_seance'));
  if (avant !== 0 || apres.length !== 1 || !/"p_seance_id":25/.test(apres[0])) {
    rates.push(`projet ouvert : « Clore le projet » → ${avant} appel(s) immédiat(s), ${apres.length} après 5 s (attendu 0 puis 1)`);
  }

  // 4. Cours oublié ouvert (la séance 3 du BTS1, 121 h le 05/10).
  const v = await etat({ nature: 'cours', ouverte: true, questions: 10, seance: 3, duree_min: 55,
    demarree_le: new Date(Date.now() - 7294 * 60000).toISOString() }, true);
  if (v.badge !== 'Oubliée ouverte') rates.push(`cours oublié : badge « ${v.badge} »`);
  if (v.chrono !== 'ouverte depuis 5 j') rates.push(`cours oublié : chrono « ${v.chrono} »`);
  if (v.action !== 'Clore la séance') rates.push(`cours oublié : action « ${v.action} »`);
  if (!v.gestes.includes('Clore la séance')) rates.push(`cours oublié : le pré-vol n'offre pas « Clore la séance » (${v.gestes.join(', ')})`);

  // 5. Cours joué puis clos : plus un « point à régler ».
  const t = await etat({ nature: 'cours', ouverte: false, questions: 10, seance: 2, duree_min: 55,
    demarree_le: '2026-09-23T08:19:00Z' }, true);
  if (t.pastille !== 'Séance terminée') rates.push(`cours terminé : pastille « ${t.pastille} » — une séance finie ne crie pas « à régler »`);
  if (t.badge !== 'Terminée') rates.push(`cours terminé : badge « ${t.badge} »`);

  if (erreurs.length) rates.push(`ouvrir / fermer : ${erreurs.join(' | ')}`);
  console.log(`── ouvrir / fermer : fermé « ${f.action} » · caché « ${c.badge} » · ouvert « ${o.pastille} » · ` +
              `oublié « ${v.badge} · ${v.chrono} » · terminé « ${t.pastille} »`);
  await fermer();
}

// ── Aller à une séance, et les raccourcis (05/10, lot 1) ─────────────────
// Le sélecteur était deux listes natives, dix-sept entrées sans recherche ni
// module. On vérifie le motif Combobox (rôle, état déplié, option active), le
// filtre, les groupes, le choix au clavier, la mémoire des récentes ; puis
// que les raccourcis agissent, se coupent (WCAG 2.1.4), et ne se déclenchent
// jamais en tapant dans un champ.
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 1280 });
  const S = [
    { id: 3, classe_id: 1, numero: 3, titre: 'Séance 3 - où vit la donnée', ouverte: true, publiee: true, nature: 'cours',
      module_id: 4, duree_min: 55, demarree_le: new Date(Date.now() - 7294 * 60000).toISOString() },
    { id: 4, classe_id: 1, numero: 4, titre: 'Séance 4 - versionner', ouverte: false, publiee: false, nature: 'cours', module_id: 4 },
    { id: 29, classe_id: 1, numero: 99, titre: 'Appel - question du jour', ouverte: true, publiee: true, nature: 'cours' },
    { id: 25, classe_id: 2, numero: 11, titre: "IA 1 - Développer à partir d'une spécification", ouverte: false, publiee: false,
      nature: 'projet', module_id: 3 },
    { id: 26, classe_id: 2, numero: 12, titre: 'IA 2 - Prompts et évaluation', ouverte: true, publiee: true, nature: 'projet', module_id: 3 },
  ];
  const prep = await p.evaluate((S) => {
    try { localStorage.removeItem('tdc-seances-recentes'); localStorage.removeItem('tdc-raccourcis'); } catch (e) {}
    ['chargement', 'connexion', 'espace-etu'].forEach((i) => { document.getElementById(i).hidden = true; });
    document.getElementById('espace-ens').hidden = false;
    const pc = document.getElementById('pk-classe');
    pc.innerHTML = '<option value="1">BTS SIO 1 - Bloc 1 DEV</option><option value="2">BTS SIO 2 - SLAM</option>';
    const sb = window.__e.sb;
    sb.from = function (t) {
      const filtres = {};
      const ch = { then: (ok, ko) => Promise.resolve({ data: t === 'seances'
        ? S.filter((s) => Object.keys(filtres).every((k) => String(s[k]) === String(filtres[k]))) : [], error: null }).then(ok, ko) };
      ['select', 'order', 'neq', 'in', 'limit'].forEach((m) => { ch[m] = () => ch; });
      ch.eq = (col, v) => { filtres[col] = v; return ch; };
      return ch;
    };
    window.__reponses = { modules_enseignant: { ok: true, classes: [
      { classe_id: 1, modules: [{ id: 4, titre: 'Bloc 1 DEV', icone: '🧭', ordre: 1 }] },
      { classe_id: 2, modules: [{ id: 3, titre: 'IA Méca Forez — concevoir', icone: '🏭', ordre: 2 }] }] },
      preflight_seance: { ok: true, nature: 'projet', seance: 11, ouverte: false, jalons: 5, echeance: '2026-10-16',
        appel_du_jour: true, eleves: 13, avec_pin: 13, deja_connectes: 12 } };
    return true;
  }, S);
  // 1. « Changer ▾ » ouvre le panneau, le focus va au champ, la liste se déplie.
  await p.click('#sv-fil');
  await p.waitForTimeout(300);
  const ouvert = await p.evaluate(() => {
    const i = document.getElementById('cs-saisie');
    return { focus: document.activeElement === i, role: i.getAttribute('role'), deplie: i.getAttribute('aria-expanded'),
      groupes: [...document.querySelectorAll('#cs-liste .cs-g')].map((g) => g.textContent),
      options: [...document.querySelectorAll('#cs-liste [role="option"]')].map((o) => o.textContent),
      active: i.getAttribute('aria-activedescendant') };
  });
  if (!ouvert.focus || ouvert.role !== 'combobox' || ouvert.deplie !== 'true') rates.push(`sélecteur : focus ${ouvert.focus}, rôle ${ouvert.role}, aria-expanded ${ouvert.deplie}`);
  if (ouvert.groupes.join(' | ') !== 'BTS SIO 1 - Bloc 1 DEV › 🧭 Bloc 1 DEV | BTS SIO 2 - SLAM › 🏭 IA Méca Forez | Questionnaires et appel') {
    rates.push(`sélecteur : groupes « ${ouvert.groupes.join(' | ')} »`);
  }
  if (!ouvert.options.some((o) => /oubliée ouverte/.test(o)) || !ouvert.options.some((o) => /99 — Appel.*BTS SIO 1/.test(o))) {
    rates.push(`sélecteur : les états ou l'appel à part manquent — ${ouvert.options.join(' | ')}`);
  }
  // 2. On tape, sans accents ni majuscules ; ↓ puis Entrée choisit.
  await p.fill('#cs-saisie', 'ia specif');
  await p.waitForTimeout(100);
  const filtre = await p.evaluate(() => [...document.querySelectorAll('#cs-liste [role="option"]')].map((o) => o.textContent));
  if (filtre.length !== 1 || !/IA 1/.test(filtre[0])) rates.push(`sélecteur : « ia specif » trouve ${filtre.length} séance(s) — ${filtre.join(' | ')}`);
  await p.fill('#cs-saisie', 'ia');
  await p.waitForTimeout(100);
  await p.keyboard.press('ArrowDown');
  const act = await p.evaluate(() => { const i = document.getElementById('cs-saisie');
    const o = document.getElementById(i.getAttribute('aria-activedescendant')); return o ? o.textContent : ''; });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  const choisi = await p.evaluate(() => ({ classe: document.getElementById('pk-classe').value,
    seance: document.getElementById('pk-seance').value, panneau: document.getElementById('sv-choix').hidden,
    fil: document.getElementById('sv-fil-seance').textContent,
    recentes: JSON.parse(localStorage.getItem('tdc-seances-recentes') || '[]') }));
  if (!/IA 2/.test(act) || choisi.classe !== '2' || choisi.seance !== '26' || !choisi.panneau) {
    rates.push(`sélecteur : ↓ + Entrée sur « ${act} » → classe ${choisi.classe}, séance ${choisi.seance}, panneau fermé ${choisi.panneau}`);
  }
  if (choisi.recentes[0] !== '26') rates.push(`sélecteur : la séance choisie n'est pas notée en récente (${JSON.stringify(choisi.recentes)})`);
  // 3. Rouvert sans texte : « Récentes » en tête.
  await p.click('#sv-fil');
  await p.waitForTimeout(300);
  const g1 = await p.evaluate(() => (document.querySelector('#cs-liste .cs-g') || {}).textContent);
  if (g1 !== 'Récentes') rates.push(`sélecteur : le premier groupe est « ${g1} », attendu « Récentes »`);
  await p.keyboard.press('Escape');
  const ferme = await p.evaluate(() => document.getElementById('cs-saisie').getAttribute('aria-expanded'));
  if (ferme !== 'false') rates.push(`sélecteur : Échap laisse la liste dépliée (${ferme})`);

  // 4. Les raccourcis. En tapant dans le champ, rien ne part.
  await p.keyboard.type('2');
  const pasDansChamp = await p.evaluate(() => document.getElementById('sv-eleves').hidden);
  if (!pasDansChamp) rates.push('raccourcis : « 2 » tapé dans un champ a changé de vue');
  await p.evaluate(() => { document.getElementById('cs-saisie').value = ''; document.getElementById('cs-saisie').blur();
    document.getElementById('sv-choix').hidden = true; document.body.focus(); });
  await p.keyboard.press('2');
  const vue2 = await p.evaluate(() => !document.getElementById('sv-eleves').hidden);
  await p.keyboard.press('/');
  const cherche = await p.evaluate(() => document.activeElement && document.activeElement.id);
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('1');
  await p.keyboard.press('Shift+?');
  await p.waitForTimeout(100);
  const aide = await p.evaluate(() => ({ ouvert: document.getElementById('rc-aide').open,
    inter: !!document.querySelector('#rc-inter [role="switch"]') }));
  await p.keyboard.press('Escape');
  const aideFermee = await p.evaluate(() => !document.getElementById('rc-aide').open);
  if (!vue2) rates.push('raccourcis : « 2 » n\'ouvre pas la vue Élèves');
  if (cherche !== 'sv-recherche') rates.push(`raccourcis : « / » met le focus sur « ${cherche} », attendu la recherche d'élève`);
  if (!aide.ouvert || !aide.inter || !aideFermee) rates.push(`raccourcis : « ? » → aide ouverte ${aide.ouvert}, interrupteur ${aide.inter}, refermée par Échap ${aideFermee}`);
  // « D » ouvre le projet affiché (l'action d'en-tête), comme un clic.
  await p.evaluate(() => { window.__appels.length = 0; });
  await p.keyboard.press('d');
  await p.waitForTimeout(250);
  const ouvreParD = await p.evaluate(() => window.__appels.filter((a) => a.nom === 'enregistrer_seance').length);
  if (ouvreParD !== 1) rates.push(`raccourcis : « D » sur un projet fermé → ${ouvreParD} appel(s) à enregistrer_seance, attendu 1`);
  // Coupés (WCAG 2.1.4) : plus rien à une touche ; Ctrl+K reste.
  await p.evaluate(() => { localStorage.setItem('tdc-raccourcis', 'non'); });
  await p.keyboard.press('2');
  const coupe = await p.evaluate(() => document.getElementById('sv-eleves').hidden);
  await p.keyboard.press('Control+k');
  await p.waitForTimeout(250);
  const ctrlK = await p.evaluate(() => ({ panneau: !document.getElementById('sv-choix').hidden,
    focus: document.activeElement && document.activeElement.id }));
  if (!coupe) rates.push('raccourcis : coupés, « 2 » change encore de vue (WCAG 2.1.4)');
  if (!ctrlK.panneau || ctrlK.focus !== 'cs-saisie') rates.push(`raccourcis : Ctrl+K → panneau ${ctrlK.panneau}, focus ${ctrlK.focus}`);
  if (erreurs.length) rates.push('sélecteur / raccourcis : erreur JS — ' + erreurs[0]);
  console.log(`── sélecteur : ${ouvert.options.length} séances, ${ouvert.groupes.length} groupes · « ia » ↓ Entrée → ${choisi.fil}` +
              ` · raccourcis 2 / ? D Ctrl+K : ${vue2} ${cherche === 'sv-recherche'} ${aide.ouvert} ${ouvreParD === 1} ${ctrlK.panneau}`);
  await fermer();
}

// ── Après la séance (28/09) : le compte rendu, le carnet, l'export ────────
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const cr = await p.evaluate(() => {
    let e = document.getElementById('carte-suivi');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    document.getElementById('pk-seance').innerHTML = '<option value="14" data-titre="3 — Où vit la donnée" selected>3</option>';
    const s = window.__e.suivi;
    s.seanceId = 14; s.classeId = 1;
    s.prevol = { ok: true, nature: 'cours', ouverte: false, seance: 3, demarree_le: '2026-09-30T08:00:00Z', duree_min: 55 };
    s.parcours = { eleves: [{ numero: '01', appel: true }, { numero: '02', appel: true }, { numero: '03', appel: false }] };
    s.debrief = { concepts: [{ rang: 1, intitule: 'Client et serveur', taux: 90, verdict: 'acquis' },
                             { rang: 2, intitule: 'Les codes', taux: 30, verdict: 'a_revoir' }] };
    window.__e.rendreSuivi({ total: 10, inscrits: 3, actifs: 2, reponses: 14, reussite: 64, avancement: 47, questions: [],
      lignes: [{ id: 1, numero: '01', avatar: '•', n: 10, ev: 10, ok: 9, maj: null, pct: 100, reussite: 90 },
               { id: 2, numero: '02', avatar: '•', n: 4, ev: 4, ok: 1, maj: null, pct: 40, reussite: 25 },
               { id: 3, numero: '03', avatar: '•', n: 0, ev: 0, ok: 0, maj: null, pct: 0, reussite: null }] });
    window.__e.ouvrirVue('fin');
    return { visible: !document.getElementById('bloc-cr').hidden, texte: document.getElementById('cr-corps').textContent };
  });
  if (!cr.visible) rates.push('compte rendu : absent de la vue Fin d\'heure');
  for (const attendu of ['Présents : 2/3 — absents : 03', 'Réussite : 64 %', 'Acquis : 1. Client et serveur (90 %)',
                         'À reprendre : 2. Les codes (30 %)', 'À revoir : 02 (25 % de réussite)']) {
    if (!cr.texte.includes(attendu)) rates.push(`compte rendu : « ${attendu} » manque (${cr.texte.replace(/\n/g, ' | ')})`);
  }
  if (/03 \(rien fait\)/.test(cr.texte)) rates.push('compte rendu : un absent est compté « à revoir » au lieu d\'absent');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#b-cr-csv')]);
  const csv = String(await (await import('fs')).promises.readFile(await dl.path(), 'utf8'));
  if (!csv.startsWith('\ufeffNuméro;Prénom (local);Présent')) rates.push(`compte rendu : en-tête CSV « ${csv.slice(0, 40)} »`);
  if (!/\r\n03;;non;0;0;;absent/.test(csv)) rates.push(`compte rendu : ligne CSV de l'absent introuvable`);
  if (erreurs.length) rates.push(`compte rendu : ${erreurs.join(' | ')}`);
  console.log('── compte rendu :', cr.texte.split('\n').length, 'lignes · CSV', csv.split('\r\n').length, 'lignes');
  await fermer();
}
for (const w of [390, 1280]) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate(() => {
    window.__reponses = { carnet_classe: { ok: true, appels: 4,
      seances: [{ id: 10, numero: 1, titre: 'Panorama', nature: 'cours', questions: 10, module_id: 1 },
                { id: 11, numero: 2, titre: 'Web', nature: 'cours', questions: 10, module_id: 1 },
                { id: 12, numero: 11, titre: 'IA 1', nature: 'projet', jalons: 5, module_id: 3 }],
      eleves: [
        { id: 1, numero: '01', presents: 4, cases: { 10: { n: 10, ev: 10, ok: 9, jal: 0 }, 11: { n: 8, ev: 8, ok: 4, jal: 0 }, 12: { n: 5, ev: 0, ok: 0, jal: 5 } } },
        { id: 2, numero: '02', presents: 2, cases: { 10: { n: 3, ev: 3, ok: 1, jal: 0 } } },
      ] } };
    let e = document.getElementById('carte-carnet');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    return window.__e.chargerCarnet([{ id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1' }]).then(() => {
      const lignes = [...document.querySelectorAll('#cn-table tbody tr')];
      const cells = (tr) => [...tr.querySelectorAll('.cn-c')].map((c) => c.textContent + ':' + c.className.split(' ')[1]).join(' ');
      return { l1: cells(lignes[0]), l2: cells(lignes[1]), dec: !!lignes[1].querySelector('.cn-dec'), dec1: !!lignes[0].querySelector('.cn-dec'),
               pres: lignes[1].querySelector('.cn-pres').className, resume: document.getElementById('cn-resume').textContent,
               debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
  });
  if (r.l1 !== '100:ok 80:ok 100:ok') rates.push(`${w} px carnet : ligne 01 « ${r.l1} »`);
  if (r.l2 !== '30:ko —:rien —:rien') rates.push(`${w} px carnet : ligne 02 « ${r.l2} »`);
  if (!r.dec || r.dec1) rates.push(`${w} px carnet : « décroche » mal posé (02=${r.dec}, 01=${r.dec1})`);
  if (!/att/.test(r.pres)) rates.push(`${w} px carnet : 2 appels manqués sans alerte de présence`);
  if (!/1 élève décroche/.test(r.resume)) rates.push(`${w} px carnet : résumé « ${r.resume} »`);
  if (r.debord > 0) rates.push(`${w} px carnet : la page déborde de ${r.debord} px (le tableau doit défiler seul)`);
  await p.click('#cn-mode .filtre[data-mode="reussite"]');
  const reu = await p.evaluate(() => [...document.querySelectorAll('#cn-table tbody tr:first-child .cn-c')].map((c) => c.textContent).join(' '));
  if (reu !== '90 50 100') rates.push(`${w} px carnet : en réussite, ligne 01 « ${reu} » (un projet reste en jalons)`);
  await p.click('#cn-table tbody tr:nth-child(2) .cn-el');
  await p.waitForTimeout(150);
  const fiche = await p.evaluate(() => ({ o: !document.getElementById('fiche-eleve').hidden, t: document.getElementById('fe-titre').textContent }));
  if (!fiche.o || fiche.t !== 'Élève 02') rates.push(`${w} px carnet : le clic n'ouvre pas la fiche (${JSON.stringify(fiche)})`);
  await p.keyboard.press('Escape');
  if (w === 1280) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#b-cn-csv')]);
    const csv = String(await (await import('fs')).promises.readFile(await dl.path(), 'utf8'));
    const l = csv.replace(/^\ufeff/, '').split('\r\n');
    if (!/^Numéro;Prénom \(local\);Présence;S1 Panorama \(réussite %\);S2 Web \(réussite %\);S11 IA 1 \(jalons %\)$/.test(l[0]) || l[2] !== '02;;2/4;33;;') {
      rates.push(`carnet CSV : « ${l[0]} » / « ${l[2]} »`);
    }
  }
  if (erreurs.length) rates.push(`${w} px carnet : ${erreurs.join(' | ')}`);
  console.log(`── ${w} px · carnet : ${r.l1} | ${r.l2}`);
  await fermer();
}

// ── Lot 2 (06/10) : l'état d'une séance, ses étapes, l'agenda du jour ─────
// L'état vient de la base (etat_seance) ; l'en-tête doit le dire tel quel,
// sauf quand le temps a passé depuis la lecture (une séance en cours devenue
// oubliée), et retomber sur la lecture d'avant si la migration manque — y
// compris quand la base refuse les colonnes nouvelles. L'agenda croise
// créneaux et séances, une ligne par créneau, UN geste par ligne, et chaque
// geste part vers la fonction qui le fait déjà ailleurs.
{
  const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const dans = (min) => new Date(Date.now() + min * 60000).toISOString();
  const tete = (ligne, pv, refuse) => p.evaluate(({ ligne, pv, refuse }) => {
    let e = document.getElementById('carte-suivi');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    const ps = document.getElementById('pk-seance');
    document.getElementById('pk-classe').innerHTML = '<option value="2">BTS SIO 2 - SLAM</option>';
    ps.innerHTML = '<option value="">Choisir…</option><option value="25" data-titre="21 — Projet IA">21</option>';
    ps.value = '25';
    const s = window.__e.suivi;
    s.classeId = 2; s.seanceId = '25';
    window.__colonnes = [];
    window.__e.sb.from = function(){
      let cols = '';
      const ch = { then: (ok, ko) => Promise.resolve(refuse && /etat_seance/.test(cols)
        ? { data: null, error: { message: 'column seances.prevue_le does not exist' } }
        : { data: [ligne], error: null }).then(ok, ko) };
      ch.select = (c) => { cols = c || ''; window.__colonnes.push(cols); return ch; };
      ['eq', 'order', 'neq', 'in', 'limit'].forEach((m) => { ch[m] = () => ch; });
      return ch;
    };
    window.__reponses = { preflight_seance: Object.assign({ ok: true, seance: 21, jalons: 4, echeance: '2026-10-16',
      duree_min: 120, questions: 0, appel_du_jour: true, eleves: 12, avec_pin: 12, deja_connectes: 12 }, pv) };
    return window.__e.chargerPrevol().then(() => {
      const l = document.getElementById('sv-cycle-l');
      return {
        badge: document.getElementById('sv-badge').textContent,
        chrono: document.getElementById('sv-chrono').textContent,
        etapes: l.hidden ? null : [...document.querySelectorAll('#sv-etapes li')].map((li) =>
          li.className.replace('cycle-e', '').trim() + (li.getAttribute('aria-current') ? '@' : '') + ':' + li.textContent),
        note: document.getElementById('sv-cycle-note').textContent,
        prep: !!document.querySelector('#sv-cycle-note .vers-prep'),
        colonnes: window.__colonnes.join(' | '),
      };
    });
  }, { ligne, pv, refuse });

  const prog = await tete({ id: 25, publiee: false, etat: 'programmee', prevue_le: dans(120), fin_prevue: dans(240),
                            auto_ouvrir: true, auto_clore: true },
                          { nature: 'projet', ouverte: false, demarree_le: null });
  if (prog.badge !== 'Programmée') rates.push(`état : badge « ${prog.badge} » pour une séance programmée`);
  if (!/\d\d:\d\d–\d\d:\d\d/.test(prog.chrono)) rates.push(`état : une séance programmée ne dit pas quand (« ${prog.chrono} »)`);
  if (!prog.etapes || prog.etapes.length !== 4 || !/^faite:/.test(prog.etapes[0]) || !/^faite ici@:✓Programmé/.test(prog.etapes[1])) {
    rates.push(`étapes : programmée → ${JSON.stringify(prog.etapes)}`);
  }
  if (!/ouverture automatique à \d\d:\d\d/.test(prog.note)) rates.push(`étapes : l'ouverture automatique n'est pas dite (« ${prog.note} »)`);
  if (!/etat:etat_seance/.test(prog.colonnes)) rates.push(`état : la ligne de la séance n'est pas lue avec son état (${prog.colonnes})`);

  const brou = await tete({ id: 25, publiee: false, etat: 'brouillon' }, { nature: 'projet', ouverte: false, demarree_le: null });
  if (brou.badge !== 'Brouillon' || !brou.prep || !brou.etapes || !/^ici@:/.test(brou.etapes[0])) {
    rates.push(`étapes : brouillon → badge « ${brou.badge} », lien vers Préparer ${brou.prep}, ${JSON.stringify(brou.etapes)}`);
  }
  // Lue « en cours » il y a six heures : l'écran dit « oubliée », comme la base le dirait maintenant.
  const oub = await tete({ id: 25, publiee: true, etat: 'en_cours' },
                         { nature: 'cours', ouverte: true, demarree_le: dans(-360), duree_min: 55 });
  if (oub.badge !== 'Oubliée ouverte') rates.push(`état : « en_cours » lu il y a 6 h affiché « ${oub.badge} »`);
  if (!oub.etapes || !/^sautee:/.test(oub.etapes[1])) rates.push(`étapes : une séance démarrée sans programmation ne saute pas « Programmée » — ${JSON.stringify(oub.etapes)}`);
  // Sans la migration : la lecture d'avant, et pas d'étapes — y compris quand la base refuse les colonnes.
  const sans = await tete({ id: 25, publiee: false }, { nature: 'projet', ouverte: false, demarree_le: null });
  if (sans.badge !== 'Projet fermé' || sans.etapes) rates.push(`repli : badge « ${sans.badge} », étapes ${JSON.stringify(sans.etapes)}`);
  const refus = await tete({ id: 25, publiee: false }, { nature: 'projet', ouverte: true, demarree_le: null }, true);
  if (refus.badge !== 'Ouvert, caché') rates.push(`repli : colonnes refusées → badge « ${refus.badge} » (publiee perdue ?) — ${refus.colonnes}`);
  console.log(`── état : « ${prog.badge} · ${prog.chrono} » · brouillon « ${brou.badge} » · oubliée « ${oub.badge} » · repli « ${sans.badge} » / « ${refus.badge} »`);
  console.log('   étapes :', (prog.etapes || []).join(' › '), '·', prog.note);

  // L'agenda du jour.
  const a = (h) => { const d = new Date(); const [hh, mm] = h.split(':'); d.setHours(+hh, +mm, 0, 0); return d.toISOString(); };
  const T = [{ id: 25, classe_id: 2, numero: 21, titre: 'Projet IA (1/2)', nature: 'projet', jalons: 4, echeance: '2026-10-16',
               duree_min: 120, publiee: false, ouverte: false, module_id: 3 },
             { id: 4, classe_id: 1, numero: 4, titre: 'Séance 4 - versionner', nature: 'cours', duree_min: 55,
               publiee: true, ouverte: false, module_id: 4 },
             { id: 3, classe_id: 1, numero: 3, titre: 'Séance 3', nature: 'cours', duree_min: 55, publiee: true, ouverte: true,
               demarree_le: dans(-5 * 1440), module_id: 4 }];
  const JOUR = { ok: true, jour: new Date().toISOString().slice(0, 10), maintenant: new Date().toISOString(),
    automatique: true, emploi_du_temps: true,
    creneaux: [{ classe_id: 1, nom: 'BTS SIO 1', debut: '08:00', fin: '09:00', debut_le: a('08:00'), fin_le: a('09:00') },
               { classe_id: 1, nom: 'BTS SIO 1', debut: '10:00', fin: '11:00', debut_le: a('10:00'), fin_le: a('11:00') },
               { classe_id: 2, nom: 'BTS SIO 2', debut: '15:00', fin: '17:00', debut_le: a('15:00'), fin_le: a('17:00') }],
    seances: [
      { id: 3, classe_id: 1, nom: 'BTS SIO 1', numero: 3, titre: 'Séance 3', nature: 'cours', etat: 'oubliee', manque: [],
        ouverte: true, publiee: true, demarree_le: dans(-5 * 1440), duree_min: 55, journal: [] },
      { id: 4, classe_id: 1, nom: 'BTS SIO 1', numero: 4, titre: 'Séance 4 - versionner', nature: 'cours', etat: 'programmee',
        manque: [], ouverte: false, publiee: true, demarree_le: null, duree_min: 55,
        prevue_le: a('10:05'), fin_prevue: a('11:00'), auto_ouvrir: false, auto_clore: true, journal: [] },
      { id: 25, classe_id: 2, nom: 'BTS SIO 2', numero: 21, titre: 'Projet IA (1/2)', nature: 'projet', etat: 'programmee',
        manque: [], ouverte: false, publiee: false, demarree_le: null, duree_min: 120,
        prevue_le: a('15:00'), fin_prevue: a('17:00'), auto_ouvrir: true, auto_clore: true,
        journal: [] }] };
  const jour = await p.evaluate(({ T, JOUR }) => {
    let e = document.getElementById('carte-jour');
    while (e) { e.hidden = false; e = e.parentElement; }
    document.getElementById('espace-ens').hidden = false;
    document.getElementById('pk-classe').innerHTML = '<option value="1">BTS SIO 1</option><option value="2">BTS SIO 2</option>';
    window.__e.sb.from = function (t) {
      const f = {};
      const ch = { then: (ok, ko) => Promise.resolve({ data: t === 'seances'
        ? T.filter((s) => Object.keys(f).every((k) => String(s[k]) === String(f[k]))) : [], error: null }).then(ok, ko) };
      ['select', 'order', 'neq', 'in', 'limit'].forEach((m) => { ch[m] = () => ch; });
      ch.eq = (c, v) => { f[c] = v; return ch; };
      return ch;
    };
    window.__reponses = { aujourdhui: JOUR, enregistrer_seance: { ok: true, id: 25, cree: false },
      preflight_seance: { ok: true, nature: 'cours', seance: 4, ouverte: false, duree_min: 55, questions: 10 } };
    window.__appels.length = 0;
    return window.__e.chargerJour().then(() => ({
      visible: !document.getElementById('carte-jour').hidden,
      lignes: [...document.querySelectorAll('#jour-liste .jour-l')].map((li) => ({
        h: li.querySelector('.jour-h').textContent, geste: li.querySelector('.jour-a').dataset.geste,
        badge: (li.querySelector('.badge') || {}).textContent || '', m: (li.querySelector('.jour-m') || {}).textContent || '',
        maintenant: li.classList.contains('maintenant') })),
      cibles: Math.min(...[...document.querySelectorAll('#jour-liste button')].map((b) => b.getBoundingClientRect().height)),
    }));
  }, { T, JOUR });
  const gestes = jour.lignes.map((l) => l.geste).join(' ');
  if (!jour.visible || gestes !== 'clore programmer demarrer ouvrir') {
    rates.push(`aujourd'hui : gestes « ${gestes} », attendu « clore programmer demarrer ouvrir » (l'oubli d'abord, puis l'ordre des heures)`);
  }
  if (!/^depuis 5 j/.test(jour.lignes[0] && jour.lignes[0].h)) rates.push(`aujourd'hui : un oubli d'un autre jour affiche « ${jour.lignes[0] && jour.lignes[0].h} »`);
  // Programmée à 10:05 : elle va sur le créneau de 10:00, pas sur une ligne à elle.
  if (!jour.lignes[2] || jour.lignes[2].h !== '10:00–11:00' || jour.lignes.length !== 4) {
    rates.push(`aujourd'hui : la séance 4 n'est pas sur son créneau (${JSON.stringify(jour.lignes)})`);
  }
  if (!/ouverture automatique à 15:00/.test(jour.lignes[3] && jour.lignes[3].m)) {
    rates.push(`aujourd'hui : l'ouverture automatique prévue n'est pas dite (« ${jour.lignes[3] && jour.lignes[3].m} »)`);
  }
  // Le journal : un geste fait se dit ; « déjà ouverte » (l'enseignant avant
  // l'automate) ne se dit pas comme un geste de l'automate, et n'annonce plus
  // d'ouverture — l'automate ne rouvrira pas.
  const notes = await p.evaluate((h) => [
    window.__e.noteDuJour({ auto_ouvrir: true, prevue_le: h, ouverte: false, journal: [{ geste: 'ouvrir', note: 'deja', fait_le: h }] }),
    window.__e.noteDuJour({ auto_ouvrir: true, prevue_le: h, ouverte: true, journal: [{ geste: 'ouvrir', note: null, fait_le: h }] })], a('15:00'));
  if (notes[0] !== '' || !/^ouverte automatiquement à 15:00$/.test(notes[1])) rates.push(`aujourd'hui : journal → ${JSON.stringify(notes)}`);
  if (jour.cibles < 44) rates.push(`aujourd'hui : une cible de ${Math.round(jour.cibles)} px`);

  // Ouvrir le projet depuis l'agenda : enregistrer_seance (publie ET ouvre), jamais demarrer_seance.
  await p.click('#jour-liste .jour-a[data-geste="ouvrir"]');
  await p.waitForTimeout(400);
  let ap = await p.evaluate(() => window.__appels.map((x) => x.nom + ' ' + JSON.stringify(x.args || {})));
  const ouvre = ap.filter((x) => /^enregistrer_seance/.test(x))[0] || '';
  if (!/"p_publiee":true/.test(ouvre) || !/"p_ouverte":true/.test(ouvre) || ap.some((x) => /^demarrer_seance/.test(x))) {
    rates.push(`aujourd'hui : « Ouvrir » → ${ap.join(' | ')}`);
  }
  // Démarrer un cours depuis l'agenda : la séance est chargée dans le direct, puis demarrer_seance part sur ELLE.
  await p.evaluate(() => { window.__appels.length = 0; });
  await p.click('#jour-liste .jour-a[data-geste="demarrer"]');
  await p.waitForTimeout(500);
  ap = await p.evaluate(() => ({ appels: window.__appels.map((x) => x.nom + ' ' + JSON.stringify(x.args || {})),
                                 suivie: window.__e.suivi.seanceId }));
  if (String(ap.suivie) !== '4' || !ap.appels.some((x) => x === 'demarrer_seance {"p_seance_id":4}')) {
    rates.push(`aujourd'hui : « Démarrer » → séance suivie ${ap.suivie}, ${ap.appels.join(' | ')}`);
  }
  // Clore un oubli : différé — rien ne part tout de suite.
  await p.evaluate(() => { window.__appels.length = 0; });
  await p.click('#jour-liste .jour-a[data-geste="clore"]');
  await p.waitForTimeout(200);
  const cl = await p.evaluate(() => ({ appels: window.__appels.map((x) => x.nom),
    toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ') }));
  if (cl.appels.includes('clore_seance') || !/va être close/.test(cl.toast) || !/Annuler/.test(cl.toast)) {
    rates.push(`aujourd'hui : « Clore » n'est pas différé avec « Annuler » (${cl.appels.join(', ')} · ${cl.toast})`);
  }
  // Refusée (migration absente) : la carte se cache. Vide : elle le dit, et propose l'emploi du temps.
  const vide = await p.evaluate(() => {
    window.__reponses.aujourdhui = { ok: true, jour: '2026-10-10', maintenant: new Date().toISOString(),
      creneaux: [], seances: [], emploi_du_temps: false, automatique: false };
    return window.__e.chargerJour().then(() => {
      const v = { texte: document.getElementById('jour-liste').textContent };
      window.__reponses.aujourdhui = { ok: false, motif: 'refus' };
      return window.__e.chargerJour().then(() => Object.assign(v, { cachee: document.getElementById('carte-jour').hidden }));
    });
  });
  if (!/Pas de cours prévu aujourd'hui/.test(vide.texte) || !/emploi du temps/.test(vide.texte)) rates.push(`aujourd'hui : vide → « ${vide.texte} »`);
  if (!vide.cachee) rates.push('aujourd\'hui : la carte reste affichée quand aujourdhui() est refusée');

  // Les deux lectures pures : croiser, et choisir la séance du jour.
  const pur = await p.evaluate(() => {
    const t0 = Date.parse('2026-10-12T15:10:00+02:00');
    const L = [
      { id: 1, classe_id: 1, numero: 3, nature: 'cours', ouverte: false, demarree_le: null, publiee: true },
      { id: 2, classe_id: 2, numero: 21, nature: 'projet', ouverte: false, publiee: false,
        prevue_le: '2026-10-12T15:00:00+02:00', fin_prevue: '2026-10-12T17:00:00+02:00' },
      { id: 3, classe_id: 1, numero: 5, nature: 'cours', ouverte: false, publiee: false,
        prevue_le: '2026-10-13T10:00:00+02:00', fin_prevue: '2026-10-13T11:00:00+02:00' }];
    return {
      creneau: (window.__e.seanceDuJour(L, ['1', '2'], t0) || {}).id,
      programmee: (window.__e.seanceDuJour(L, ['1', '2'], Date.parse('2026-10-12T18:00:00+02:00')) || {}).id,
      sansPlanning: (window.__e.seanceDuJour(L.map((s) => Object.assign({}, s, { prevue_le: null, fin_prevue: null })),
        ['1', '2'], t0) || {}).id,
      gestes: ['brouillon', 'prete', 'programmee', 'ouverte', 'en_cours', 'oubliee', 'terminee', 'cache', 'ouvert', 'clos']
        .map((e) => e + '=' + window.__e.gesteDuJour({ etat: e, nature: ['cache', 'ouvert', 'clos'].includes(e) ? 'projet' : 'cours',
          numero: 3, ouverte: ['ouverte', 'en_cours', 'cache', 'ouvert'].includes(e) }).cle).join(' '),
    };
  });
  if (pur.creneau !== 2) rates.push(`séance du jour : à 15:10, ${pur.creneau} plutôt que la séance du créneau (2)`);
  if (pur.programmee !== 3) rates.push(`séance du jour : à 18:00, ${pur.programmee} plutôt que la prochaine programmée (3)`);
  if (pur.sansPlanning !== 1) rates.push(`séance du jour : sans planning, ${pur.sansPlanning} — la règle d'avant a changé`);
  if (pur.gestes !== 'brouillon=preparer prete=demarrer programmee=demarrer ouverte=demarrer en_cours=suivre oubliee=clore terminee=bilan cache=montrer ouvert=suivre clos=bilan') {
    rates.push(`aujourd'hui : un état sans son geste — ${pur.gestes}`);
  }
  if (erreurs.length) rates.push(`lot 2 : ${erreurs.join(' | ')}`);
  console.log(`── aujourd'hui : ${jour.lignes.map((l) => l.h + ' ' + l.geste + (l.badge ? ' [' + l.badge + ']' : '')).join(' · ')}`);
  console.log(`   séance du jour : créneau → ${pur.creneau}, après → ${pur.programmee}, sans planning → ${pur.sansPlanning}`);
  await fermer();
}

await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ L\'état d\'une séance vient de la base et se lit en quatre étapes ;');
console.log('    « Aujourd\'hui » croise créneaux et séances, un geste par ligne ;');
console.log('  ✓ Les quatre chiffres sont gros sur un téléphone, tiennent sur une');
console.log('    ligne, ne cassent pas leur grille, et les contrôles d\'entrée');
console.log('    sont dans le bon onglet ; l\'écran de la séance a son en-tête collant,');
console.log('    ses quatre vues, ses filtres, sa fiche élève, et « Clore » s\'annule ;');
console.log('    le compte rendu et le carnet de la classe disent juste, et s\'exportent ;');
console.log('    une séance se cherche au clavier, et les raccourcis se coupent.');
