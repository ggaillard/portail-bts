#!/usr/bin/env node
// ── La carte de révision est-elle utilisable ? ────────────────────────────
//
//     npx playwright install chromium
//     node outils/t_revision.mjs        # depuis la racine du dépôt
//
// Le 16/09, la carte du questionnaire de révision s'affichait chez les
// étudiants… pliée sur son titre. 71 px de haut, aucune option cliquable, et
// aucun moyen de répondre. La cause : rendreRevision() marquait la carte
// « faite » (marquerEtape(id, true)) pour la tenir hors de la file d'attente
// — or `data-fait="oui"` déclenche la règle CSS qui masque l'intitulé et la
// zone des options. Deux intentions confondues en un seul attribut.
//
// Une carte peut être visible ET hors file. C'est `data-hors-file` qui le dit
// maintenant, et ce contrôle vérifie les deux à la fois : la carte est
// utilisable, et le bandeau ne réclame rien.
//
// Il n'appelle pas la base : le portail est SERVI par outils/serveur.mjs, comme
// GitHub Pages le sert, et la fausse couche Supabase est substituée au passage
// sur le réseau — voir outils/portail.mjs. Le portail testé est celui du dépôt,
// pas une version réécrite par expression régulière.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';
const RACINE = process.argv[2] || process.cwd();

const q = (n, rep, juste) => ({
  question:'revision-poo-tp1-'+String(n).padStart(2,'0'),
  intitule:'Question '+n+' ?', options:['A','B','C','D'],
  ma_reponse:rep, bonne:rep?'B':null, explication:rep?'Parce que.':null, juste:rep?juste:null });

const liste = [{
  seance_id:34, numero:90, titre:"Réviser l'interro — Console & POO",
  intro:'Douze questions pour préparer l’interro écrite sur le TP1.',
  mode:'revision', corrige:true, total:12, faites:0, justes:0,
  questions: Array.from({length:12},(_,i)=>q(i+1,null,null)),
}];

const rates = [];
const nav = await chromium.launch();
for (const w of [390, 1280]) {
  const { page: p, erreurs: err, police, fermer } = await ouvrir(nav, RACINE, { largeur: w });
  const r = await p.evaluate((liste) => {
    let e = document.getElementById('espace-etu');
    while (e) { e.hidden = false; e = e.parentElement; }
    window.__e.rendreQuestionnairesEtu(liste);
    const c = document.getElementById('qn-34');
    if (!c) return { carte: 'ABSENTE' };
    const st = (sel) => { const x = c.querySelector(sel); return x ? getComputedStyle(x).display : 'pas de noeud'; };
    return {
      fait: c.getAttribute('data-fait'),
      horsFile: c.getAttribute('data-hors-file'),
      hauteur: Math.round(c.getBoundingClientRect().height),
      intitule: st('.cn-int'),
      choix: st('.appel-choix'),
      texteIntitule: (c.querySelector('.cn-int')||{}).textContent,
      boutonsVisibles: [...c.querySelectorAll('.rv-opt')].filter(b=>b.offsetParent!==null).length,
      file: (document.getElementById('file-reste')||{}).textContent + ' / ' +
            (document.getElementById('file-txt')||{}).textContent,
    };
  }, liste);
  console.log(`\n══ ${w} px`);
  console.log('   data-fait        :', r.fait, '· hors-file :', r.horsFile);
  console.log('   hauteur de carte :', r.hauteur, 'px');
  console.log('   intitulé         :', r.intitule, '·', (r.texteIntitule||'').slice(0,30));
  console.log('   zone des options :', r.choix, '· boutons cliquables :', r.boutonsVisibles);
  console.log('   bandeau de file  :', r.file);
  console.log('   erreurs          :', err.length?err:'aucune');
  if (!police) {
    rates.push(`${w} px : IBM Plex n'a pas été chargée — toutes les hauteurs mesurées ici sont fausses, ` +
               `et les plafonds ne veulent plus rien dire. Vérifiez l'accès à fonts.googleapis.com.`);
  }
  if (r.carte === 'ABSENTE') rates.push(`${w} px : la carte de révision ne s'affiche pas du tout`);
  else {
    if (r.fait === 'oui') rates.push(`${w} px : la carte est marquée « faite » — elle se replie et devient inutilisable`);
    if (r.choix === 'none' || r.boutonsVisibles === 0)
      rates.push(`${w} px : aucune option cliquable (zone des choix : ${r.choix})`);
    if (r.hauteur < 200) rates.push(`${w} px : carte de ${r.hauteur} px — repliée sur son titre`);
    if (/chose/.test(r.file)) rates.push(`${w} px : la file d'attente réclame la révision, qui n'a pas de fin — ${r.file}`);
    if (err.length) rates.push(`${w} px : erreur JS — ${err[0]}`);
  }
  await fermer();
}

// ── Le tour thème par thème, avec la certitude (29/09) ─────────────────────
// Trois choses qu'on casserait sans le voir :
//   · avec la certitude, choisir une option N'ENVOIE RIEN : on dit d'abord à
//     quel point on était sûr, puis la réponse part, puis la certitude — dans
//     cet ordre, sous la clé <question>-c ;
//   · le bilan d'un tour complet s'affiche thème par thème, et nomme les
//     réponses fausses données avec assurance ;
//   · « Tout recommencer » rend les questions de nouveau cliquables — sans
//     lui, « vous pouvez tout refaire » était une promesse vide.
{
  const qt = (n, theme, rep, juste, cert) => ({
    question:'rv-'+String(n).padStart(2,'0'), intitule:'Question '+n+' ?',
    options:['Un','Deux','Trois','Quatre'], theme,
    ma_reponse:rep, ma_certitude:cert||null, bonne:rep?'B':null,
    explication:rep?'Parce que.':null, juste:rep?juste:null });
  const vierge = { seance_id:41, numero:91, titre:'Réviser PlaylistApp', intro:'',
    mode:'revision', corrige:true, certitude:true, total:3, faites:0, justes:0,
    questions:[qt(1,'TP1',null), qt(2,'TP2',null), qt(3,'TP2',null)],
    bilan:[{theme:'TP1',questions:1,repondues:0,justes:0,surs_faux:0},
           {theme:'TP2',questions:2,repondues:0,justes:0,surs_faux:0}] };
  const fini = { ...vierge, faites:3, justes:1,
    questions:[qt(1,'TP1','B',true,'S'), qt(2,'TP2','A',false,'S'), qt(3,'TP2','C',false,'X')],
    bilan:[{theme:'TP1',questions:1,repondues:1,justes:1,surs_faux:0},
           {theme:'TP2',questions:2,repondues:2,justes:0,surs_faux:1}] };

  for (const w of [360, 1280]) {
    const { page: p, erreurs: err, fermer } = await ouvrir(nav, RACINE, { largeur: w });
    // Lire avant de répondre (02/10) : les options restent grisées le temps
    // de lire. L'horloge de la page est prise en main pour sauter ce temps
    // au lieu de l'attendre — et pour vérifier qu'il existe.
    await p.clock.install();
    const lu = await p.evaluate(({ vierge }) => {
      let e = document.getElementById('espace-etu');
      while (e) { e.hidden = false; e = e.parentElement; }
      window.__reponses = { mes_questionnaires: { ok:true, liste:[vierge] } };
      window.__e.rendreQuestionnairesEtu([JSON.parse(JSON.stringify(vierge))]);
      const c = document.getElementById('qn-41');
      const grises = [...c.querySelectorAll('.rv-opt')].filter(b => b.disabled).length;
      const decompte = (c.querySelector('.lecture-zone') || {}).textContent || '';
      window.__appels.length = 0;
      c.querySelectorAll('.rv-opt')[1].click();      // trop tôt : ne doit rien faire
      return { grises, decompte };
    }, { vierge });
    const tropTot = await p.evaluate(() => window.__appels.filter(a => a.nom === 'repondre').length);
    await p.clock.fastForward(30000);
    const r = await p.evaluate(async ({ fini }) => {
      const attendre = (ms) => new Promise(ok => setTimeout(ok, ms));
      const c = document.getElementById('qn-41');
      const av = c.querySelector('.qn-av').textContent;
      const libres = [...c.querySelectorAll('.rv-opt')].filter(b => !b.disabled).length;
      window.__appels.length = 0;
      c.querySelectorAll('.rv-opt')[1].click();
      await attendre(50);
      const apresChoix = window.__appels.filter(a => a.nom === 'repondre').length;
      const certs = [...c.querySelectorAll('.rv-cert button')].map(b => b.textContent);
      // La base, désormais, a les trois réponses.
      window.__reponses.mes_questionnaires = { ok:true, liste:[fini] };
      const cb = c.querySelector('.rv-cert button'); if (cb) cb.click();
      await attendre(300);
      const envois = window.__appels.filter(a => a.nom === 'repondre')
        .map(a => a.args.p_question + '=' + a.args.p_reponse);
      const themes = [...c.querySelectorAll('.rv-themes li')].map(li => li.textContent);
      const surs = (c.querySelector('.rv-bilan .rv-expl') || {}).textContent || '';
      const larg = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const recom = [...c.querySelectorAll('button')].find(b => b.textContent === 'Tout recommencer');
      if (recom) recom.click();
      await attendre(50);
      return { av, libres, apresChoix, certs, envois, themes, surs, larg, recom: !!recom };
    }, { fini });
    // Un second tour se relit aussi : grisé, puis libre.
    const grisesBis = await p.evaluate(() =>
      [...document.querySelectorAll('#qn-41 .rv-opt')].filter(b => b.disabled).length);
    await p.clock.fastForward(30000);
    r.cliquables = await p.evaluate(() =>
      [...document.querySelectorAll('#qn-41 .rv-opt')].filter(b => !b.disabled).length);
    console.log(`\n══ lire avant de répondre, ${w} px`);
    console.log('   grisées        :', lu.grises, '· décompte :', lu.decompte, '· clic trop tôt :', tropTot,
                '· libres après :', r.libres, '· second tour grisé :', grisesBis);
    if (lu.grises !== 4) rates.push(`${w} px : ${lu.grises} option(s) grisée(s) à l'affichage, attendu 4`);
    if (!/Prenez le temps de lire… \d+ s/.test(lu.decompte)) rates.push(`${w} px : pas de décompte de lecture`);
    if (tropTot !== 0) rates.push(`${w} px : un clic pendant la lecture a envoyé une réponse`);
    if (r.libres !== 4) rates.push(`${w} px : ${r.libres} option(s) libre(s) après la lecture, attendu 4`);
    if (grisesBis !== 4) rates.push(`${w} px : le second tour ne laisse pas le temps de relire`);
    console.log(`\n══ thèmes et certitude, ${w} px`);
    console.log('   avancée        :', r.av);
    console.log('   envois au choix:', r.apresChoix, '· certitude :', r.certs.join(' / '));
    console.log('   envois         :', r.envois.join(', '));
    console.log('   bilan          :', r.themes.join(' | '));
    console.log('   sûr et faux    :', r.surs);
    console.log('   recommencer    :', r.recom, '· options cliquables ensuite :', r.cliquables);
    if (!/TP1/.test(r.av)) rates.push(`${w} px : le thème de la question n'est pas annoncé`);
    if (r.apresChoix !== 0) rates.push(`${w} px : choisir une option envoie la réponse avant la certitude`);
    if (r.certs.length !== 3) rates.push(`${w} px : ${r.certs.length} boutons de certitude, attendu 3`);
    if (r.envois.join(',') !== 'rv-01=B,rv-01-c=S')
      rates.push(`${w} px : envois « ${r.envois.join(',')} », attendu la réponse puis la certitude`);
    if (r.themes.length !== 2 || !/TP2.*0 \/ 2.*à revoir/.test(r.themes[1]))
      rates.push(`${w} px : bilan par thème absent ou faux — ${r.themes.join(' | ')}`);
    if (!/1 réponse fausse/.test(r.surs)) rates.push(`${w} px : la réponse fausse donnée avec assurance n'est pas signalée`);
    if (!r.recom || r.cliquables !== 4) rates.push(`${w} px : « Tout recommencer » ne rend pas les options cliquables`);
    if (r.larg > 0) rates.push(`${w} px : débordement horizontal de ${r.larg} px`);
    if (err.length) rates.push(`${w} px : erreur JS — ${err[0]}`);
    await fermer();
  }
}

// ── Le même tour, lu par l'enseignant ──────────────────────────────────────
// Le taux par thème, les numéros fragiles, les sûrs-et-faux — et les prénoms
// de la table locale collés aux numéros quand elle en a.
{
  const { page: p, erreurs: err, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });
  const r = await p.evaluate(() => {
    try { localStorage.setItem('tdc-noms', JSON.stringify({ 'BTS2-SLAM-2026': { '05': 'DUPONT Léa' } })); } catch (e) {}
    const d = { themes: [
      { theme:'TP1', questions:6, reponses:40, justes:34, taux:85, fragiles:[], surs_faux:[] },
      { theme:'TP2', questions:6, reponses:36, justes:14, taux:39, fragiles:['05','11'], surs_faux:['05'] },
      { theme:'TP4', questions:6, reponses:0, justes:0, taux:null, fragiles:[], surs_faux:[] }] };
    const z = window.__e.lectureParTheme(d, 'BTS2-SLAM-2026');
    document.body.appendChild(z);
    return { badges: [...z.querySelectorAll('.badge')].map(b => b.className.replace('badge ', '') + ':' + b.textContent),
             lignes: [...z.querySelectorAll('.qn-th-l')].map(x => x.textContent) };
  });
  console.log('\n══ lecture enseignant par thème');
  console.log('   badges :', r.badges.join(' | '));
  console.log('   lignes :', r.lignes.join(' | '));
  if (r.badges.join('|') !== 'ok:85 % juste · 40 réponses|ko:39 % juste · 36 réponses|neutre:pas encore de réponse')
    rates.push('lecture par thème : badges inattendus — ' + r.badges.join(' | '));
  if (!r.lignes.some(l => /fragile|moitié/.test(l) && /05/.test(l) && /11/.test(l)))
    rates.push('lecture par thème : les fragiles ne sont pas nommés');
  if (!r.lignes.some(l => /Sûrs d'eux/.test(l) && /05/.test(l)))
    rates.push('lecture par thème : les sûrs-et-faux ne sont pas nommés');
  if (err.length) rates.push('lecture par thème : erreur JS — ' + err[0]);
  await fermer();
}
await nav.close();

console.log();
if (rates.length) { rates.forEach(x => console.log('  ✗ ' + x)); process.exit(1); }
console.log("  ✓ La carte de révision est ouverte, ses options sont cliquables,");
console.log('    et la file d\'attente ne la réclame pas.');
console.log('  ✓ La certitude passe avant la correction, le bilan se lit par thème,');
console.log('    et « Tout recommencer » rouvre les questions.');
