#!/usr/bin/env node
// ── Recompter ce que REFONTE.md affirme ───────────────────────────────────
//
//     node outils/mesurer.mjs          # depuis la racine du dépôt
//     node outils/mesurer.mjs --libre  # affiche sans comparer
//
// Un audit vieillit. Celui-ci a été écrit le 16/09/2026 sur un index.html de
// 5 847 lignes ; si on ne fait rien, ses chiffres seront faux dans un mois et
// personne ne le saura — un document qui se trompe avec assurance est pire
// qu'un document absent. Ce fichier recompte chaque mesure citée et échoue
// quand elle a bougé, avec l'ancienne et la nouvelle valeur. Ce n'est pas un
// garde-fou contre le changement : les chiffres DOIVENT bouger, c'est le but
// du plan. C'est un rappel de mettre le document à jour en même temps.
//
// Il vérifie aussi les règles du §6 qui se mesurent : la taille des modules,
// et l'absence de seuil de rupture écrit en dur.

import fs from 'fs';
import path from 'path';

const RACINE = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : process.cwd();
const LIBRE = process.argv.includes('--libre');

const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');
const existe = (p) => fs.existsSync(path.join(RACINE, p));

// ── Où vit le code ────────────────────────────────────────────────────────
// Avant l'étape A2, tout était dans index.html, entre <style> et <script>.
// Après, dans styles/ et js/. Ce contrôle doit continuer à mesurer LA MÊME
// CHOSE des deux côtés du découpage, sinon ses chiffres ne se comparent plus
// à rien — et il se tairait en beauté le jour où il ne trouverait plus le
// script.
const brut = lire('index.html');
const src = brut.split('\n');
const nbLignes = (t) => t.split('\n').length;

const feuillesDe = (dossier, ext) => existe(dossier)
  ? fs.readdirSync(path.join(RACINE, dossier)).filter((f) => f.endsWith(ext)).sort()
      .map((f) => ({ nom: `${dossier}/${f}`, t: lire(path.join(dossier, f)) }))
  : [];

const FCSS = feuillesDe('styles', '.css');
const FJS  = feuillesDe('js', '.js');

const morceau = (ouvrant, fermant) => {
  const a = brut.indexOf(ouvrant), b = brut.indexOf(fermant);
  return a < 0 || b < 0 ? '' : brut.slice(a, b);
};

const css = { texte: FCSS.length ? FCSS.map((f) => f.t).join('\n') : morceau('<style', '</style>') };
const js  = { texte: FJS.length  ? FJS.map((f) => f.t).join('\n')  : morceau('\n<script>', '</script>') };
if (!js.texte.trim()) {
  console.error("  ✗ mesurer.mjs ne trouve plus le script du portail : ni js/*.js, ni bloc <script>.");
  process.exit(1);
}
css.lignes = css.texte ? nbLignes(css.texte) : 0;
js.lignes = nbLignes(js.texte);

// ── Les mesures ───────────────────────────────────────────────────────────
const tousLes = (re, s) => (s.match(re) || []).length;

// Un commentaire CSS peut citer une media query ou une var() pour expliquer ce
// qu'on a corrigé — la table des seuils le fait, et elle donne l'exemple de ce
// qui ne marche pas. Compter ces citations comme du code ferait échouer le
// contrôle sur sa propre documentation. On mesure donc le CSS sans ses
// commentaires, et on ne lit la table « @seuil » que dans le texte brut.
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const cssNet = sansCommentaires(css.texte);

const fonctions = [...js.texte.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)];
const longueurs = fonctions.map((m, i) => {
  const fin = i + 1 < fonctions.length ? fonctions[i + 1].index : js.texte.length;
  return { nom: m[1], lignes: js.texte.slice(m.index, fin).split('\n').length - 1 };
}).sort((x, y) => y.lignes - x.lignes);
const mediane = [...longueurs].sort((a, b) => a.lignes - b.lignes)[longueurs.length >> 1].lignes;

const seuils = [...cssNet.matchAll(/@media[^{]+/g)].map((m) => m[0].trim());
const classes = new Set([...cssNet.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const varsDef = new Set([...cssNet.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const varsUse = new Set([...cssNet.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
const rpcs = new Set([...js.texte.matchAll(/rpc\(\s*["']([\w_]+)["']/g)].map((m) => m[1]));

const m = {
  'lignes de index.html':        src.length - (src[src.length - 1] === '' ? 1 : 0),
  'feuilles de style':           FCSS.length,
  'modules':                     FJS.length,
  'lignes de CSS':               css.lignes,
  'lignes de JavaScript':        js.lignes,
  'règles CSS':                  tousLes(/^[^@\s][^{]*\{/gm, cssNet),
  'classes CSS':                 classes.size,
  'variables CSS définies':      varsDef.size,
  'variables CSS inutilisées':   [...varsDef].filter((v) => !varsUse.has(v)).length,
  'var() jamais déclarées':      [...varsUse].filter((v) => !varsDef.has(v)).length,
  'media queries':               seuils.length,
  'seuils distincts':            new Set(seuils.map((s) => s.replace(/\s+/g, ''))).size,
  'fonctions de premier niveau': fonctions.length,
  'médiane des fonctions':       mediane,
  'plus longue fonction':        longueurs[0].lignes,
  'fonctions RPC appelées':      rpcs.size,
  'innerHTML =':                 tousLes(/\.innerHTML\s*=/g, js.texte),
  'textContent =':               tousLes(/\.textContent\s*=/g, js.texte),
  'createElement':               tousLes(/createElement\(/g, js.texte),
  'onclick= en chaîne':          tousLes(/onclick=/g, brut),
  'aria-live':                   tousLes(/aria-live/g, brut),
};

// ── L'état attendu aujourd'hui, celui que REFONTE.md décrit ───────────────
// Quand une valeur bouge parce que le plan avance, on met à jour les DEUX :
// cette table et le document. C'est le point : ils ne peuvent plus diverger
// en silence.
// Reprise automatiquement depuis « --libre » à chaque étape franchie : ce
// n'est pas une table à tenir à la main, c'est la photo du dépôt le jour où
// l'on a mis REFONTE.md d'accord avec lui.
const ATTENDU = {
  'lignes de index.html': 521,
  'feuilles de style': 10,
  'modules': 13,
  'lignes de CSS': 1088,
  'lignes de JavaScript': 5135,
  'règles CSS': 473,
  'classes CSS': 299,
  'variables CSS définies': 17,
  'variables CSS inutilisées': 0,
  'var() jamais déclarées': 0,
  'media queries': 12,
  'seuils distincts': 8,
  'fonctions de premier niveau': 147,
  'médiane des fonctions': 22,
  'plus longue fonction': 246,
  'fonctions RPC appelées': 35,
  'innerHTML =': 113,
  'textContent =': 216,
  'createElement': 162,
  'onclick= en chaîne': 0,
  'aria-live': 19,
};

const large = Math.max(...Object.keys(m).map((k) => k.length));
const ecarts = [];
for (const [k, v] of Object.entries(m)) {
  const a = ATTENDU[k];
  const drift = !LIBRE && a !== undefined && a !== v;
  console.log('  ' + k.padEnd(large) + '  ' + String(v).padStart(5) +
              (drift ? `   (REFONTE.md dit ${a})` : ''));
  if (drift) ecarts.push(`${k} : ${a} -> ${v}`);
}

// ── Les règles du §6 qui se mesurent ──────────────────────────────────────
const fautes = [];

// 0. Une var() sans déclaration ne casse pas la page : sa valeur de repli
//    s'applique en silence, dans les deux thèmes, et le texte devient
//    illisible à un endroit sans que rien ne le signale. C'est ainsi que
//    --surface-2 a traversé le portail (§3.7). Tant que le CSS est dans
//    index.html on regarde là ; après A2, dans styles/.
{
  const feuilles = existe('styles')
    ? fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))
        .map((f) => ({ ou: `styles/${f}`, t: sansCommentaires(lire(path.join('styles', f))) }))
    : [{ ou: 'index.html', t: cssNet }];
  const tout = feuilles.map((f) => f.t).join('\n');
  const dec = new Set([...tout.matchAll(/(--[\w-]+)\s*:/g)].map((x) => x[1]));
  for (const f of feuilles) {
    for (const x of f.t.matchAll(/var\((--[\w-]+)/g)) {
      if (!dec.has(x[1])) fautes.push(`${f.ou} : var(${x[1]}) n'est déclarée nulle part — la valeur de repli s'applique dans les deux thèmes (§3.7)`);
    }
  }
}

// 1. Un module, un sujet, un plafond (§6.1).
//
//    Le plafond était 400 lignes dans la première écriture du plan. Chiffre
//    posé au jugé, avant d'avoir sorti le moindre module : le premier, le mode
//    classe, en fait 646 d'un seul tenant, et il est parfaitement cohérent —
//    treize fonctions, quatre portes d'entrée, un seul sujet. Le découper pour
//    satisfaire un nombre que personne n'avait mesuré aurait produit deux
//    fichiers qu'il faut ouvrir ensemble, ce qui est exactement le défaut
//    qu'on corrige. Le plafond est donc 700, et il ne sert pas à viser : il
//    sert à ce qu'aucun module ne redevienne un app.js sans qu'on le voie.
//
//    Pendant le découpage, app.js reste au-dessus par construction. Il est
//    déclaré dans REFONTE.md avec sa taille du jour : il a le droit d'être
//    gros, il n'a pas le droit de GROSSIR. La dette est écrite, datée, et elle
//    ne peut que diminuer.
const PLAFOND = 700;
if (FJS.length) {
  const chantier = new Map(
    [...lire('REFONTE.md').matchAll(/@chantier\s+(\S+)\s+(\d+)/g)].map((x) => [x[1], Number(x[2])]));
  console.log('\n  modules :');
  for (const f of FJS) {
    const n = nbLignes(f.t);
    const plafondDit = chantier.has(f.nom) ? `en découpage, ≤ ${chantier.get(f.nom)}` : `≤ ${PLAFOND}`;
    console.log('    ' + f.nom.replace('js/', '').padEnd(large - 2) + '  ' +
                String(n).padStart(5) + '   (' + plafondDit + ')');
    if (chantier.has(f.nom)) {
      if (n > chantier.get(f.nom)) {
        fautes.push(`${f.nom} passe de ${chantier.get(f.nom)} à ${n} lignes : un module en cours ` +
                    `de découpage ne grossit pas. Sortez-en quelque chose, ou corrigez la ligne ` +
                    `« @chantier » de REFONTE.md si la hausse est voulue et expliquée.`);
      }
    } else if (n > PLAFOND) {
      fautes.push(`${f.nom} fait ${n} lignes, plafond ${PLAFOND} (§6.1) — à découper, ` +
                  `ou à déclarer « @chantier » dans REFONTE.md avec la raison`);
    }
  }
}

// 1bis. Chaque module définit ou importe tout ce qu'il appelle.
//
//    Le contrôle « toute fonction appelée est-elle définie » du workflow
//    travaille sur la CONCATÉNATION des modules : un import oublié y est
//    parfaitement invisible, puisque la fonction existe — ailleurs. Le 17/09,
//    ensemble.js appelait classesReelles() sans l'importer ; la page se
//    chargeait, le module s'exécutait, et la panne n'arrivait qu'au moment
//    d'afficher le semestre. Seul t_navigation l'a vue, par hasard.
//
//    Ici on lit chaque fichier SÉPARÉMENT, comme le navigateur le fait.
if (FJS.length) {
  const lexique = new Map();
  const NATIFS = new Set(('Array Object String Number Boolean Date Math JSON RegExp Error Promise ' +
    'Set Map parseInt parseFloat isNaN encodeURIComponent decodeURIComponent setTimeout ' +
    'clearTimeout setInterval clearInterval requestAnimationFrame fetch console document window ' +
    'localStorage sessionStorage navigator location history AudioContext webkitAudioContext Event ' +
    'CustomEvent KeyboardEvent MouseEvent URL URLSearchParams Intl AbortController performance ' +
    'structuredClone queueMicrotask if for while switch catch typeof return function new delete ' +
    'void in of do else try finally throw case break continue instanceof await async yield').split(' '));
  // Commentaires et chaînes retirés : un nom de RPC entre guillemets ou un mot
  // français suivi d'une parenthèse passerait pour un appel.
  const net = (t) => {
    let o = '', i = 0;
    while (i < t.length) {
      const c = t[i];
      if (c === '/' && t[i + 1] === '/') { const j = t.indexOf('\n', i); i = j < 0 ? t.length : j; }
      else if (c === '/' && t[i + 1] === '*') { i = t.indexOf('*/', i) + 2; }
      else if (c === '"' || c === "'" || c === '`') {
        const q = c; i++;
        while (i < t.length && t[i] !== q) { if (t[i] === '\\') i++; i++; }
        i++; o += ' ';
      } else { o += c; i++; }
    }
    return o;
  };
  for (const f of FJS) {
    const t = net(f.t);
    const connus = new Set();
    const ajoute = (re, g) => { for (const x of t.matchAll(re)) {
      for (const n of (x[g] || '').match(/[A-Za-z_$][\w$]*/g) || []) connus.add(n); } };
    ajoute(/\bfunction\s+([A-Za-z_$][\w$]*)/g, 1);
    ajoute(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g, 1);
    ajoute(/\b(?:var|let|const)\s*\{([^}]*)\}/g, 1);
    ajoute(/function[^(]*\(([^)]*)\)/g, 1);
    ajoute(/import\s*\{([^}]*)\}/g, 1);
    ajoute(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g, 1);
    ajoute(/\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/g, 1);
    for (const x of t.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!connus.has(x[1]) && !NATIFS.has(x[1])) {
        fautes.push(`${f.nom} appelle ${x[1]}() sans la définir ni l'importer — ` +
                    `la page se chargera, et la panne arrivera à l'usage`);
      }
    }
    lexique.set(f.nom, { t, connus });
  }

  // Et le cas qui a mordu trois fois en une heure le 17/09 : un nom employé
  // comme VALEUR, pas comme appel — addEventListener("click", copierAbsents),
  // SEM_ETAT[x.etat], suivi.seanceId. La recherche de « nom( » ne le voit pas.
  //
  // Chercher tous les identifiants inconnus produirait surtout du bruit (une
  // variable de boucle, une clé d'objet, un paramètre déstructuré). On ne
  // retient donc que ceux qui sont EXPORTÉS PAR UN AUTRE MODULE : c'est
  // exactement la faute « ça a déménagé et personne ne l'a suivi », et elle ne
  // ressemble à rien d'autre.
  const exportes = new Map();
  for (const f of FJS) {
    for (const x of f.t.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const n of (x[1].replace(/\/\/[^\n]*/g, '').match(/[A-Za-z_$][\w$]*/g) || [])) {
        if (!exportes.has(n)) exportes.set(n, f.nom);
      }
    }
    for (const x of f.t.matchAll(/(?:^|\n)export\s+(?:function|var|let|const)\s+([A-Za-z_$][\w$]*)/g)) {
      if (!exportes.has(x[1])) exportes.set(x[1], f.nom);
    }
  }
  for (const [nom, { t, connus }] of lexique) {
    const vus = new Set();
    // `suivi.minuteur` n'emploie pas `minuteur` : c'est une propriété. Sans ce
    // retrait, le contrôle réclamait d'importer dans socle.js une fonction de
    // l'écran qui n'y est pour rien.
    const sansProp = t.replace(/\.\s*[A-Za-z_$][\w$]*/g, '.')
                      .replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g, '$1 :');
    for (const x of sansProp.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)/g)) {
      const n = x[1];
      if (connus.has(n) || vus.has(n)) continue;
      const ou = exportes.get(n);
      if (ou && ou !== nom) {
        vus.add(n);
        fautes.push(`${nom} emploie ${n}, que ${ou} exporte, sans l'importer — ` +
                    `la page se chargera, et la panne arrivera à l'usage`);
      }
    }
  }
}

// 2. Un seul jeu de seuils de rupture, celui que déclare la table « @seuil ».
//
//    Le plan annonçait des variables CSS. Essayé, et faux : « @media
//    (max-width: var(--x)) » ne s'applique jamais — mesuré, une page où seule
//    la version littérale prend effet. Les custom properties ne sont pas
//    évaluées dans une media query, et @custom-media n'est implémenté nulle
//    part. Ce qui reste possible sans outil de compilation, c'est de déclarer
//    la liste une fois et de refuser tout ce qui n'y figure pas. Le contrôle
//    ne remplace donc rien : il empêche d'ajouter un onzième seuil sans s'en
//    apercevoir, ce qui était exactement le défaut.
{
  const brut = existe('styles')
    ? fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))
        .map((f) => lire(path.join('styles', f))).join('\n')
    : css.texte;
  const feuilles = existe('styles')
    ? fs.readdirSync(path.join(RACINE, 'styles')).filter((x) => x.endsWith('.css'))
        .map((f) => ({ ou: `styles/${f}`, t: sansCommentaires(lire(path.join('styles', f))) }))
    : [{ ou: 'index.html', t: cssNet }];

  const table = [...brut.matchAll(/@seuil\s+(\S+)\s+\(([^)]+)\)/g)]
    .map((x) => ({ nom: x[1], q: x[2].replace(/\s+/g, ' ').trim() }));
  if (!table.length) {
    fautes.push('aucune table « @seuil » trouvée : la liste des seuils doit être déclarée en commentaire, une fois (§6.2)');
  } else {
    console.log('\n  seuils déclarés :', table.map((x) => `${x.nom} ${x.q}`).join(' · '));
    const permis = new Set(table.map((x) => x.q));
    for (const f of feuilles) {
      for (const m of f.t.matchAll(/@media\s*\(([^)]+)\)/g)) {
        const q = m[1].replace(/\s+/g, ' ').trim();
        // Les requêtes de préférence ne sont pas des seuils de largeur.
        if (/prefers-/.test(q)) continue;
        if (!permis.has(q)) {
          fautes.push(`${f.ou} : seuil « ${q} » absent de la table @seuil — ` +
                      `ajoutez-le là-bas, avec ce qu'il gouverne, ou utilisez-en un existant (§6.2)`);
        }
      }
    }
  }
}

// 5. Le workflow DÉPLOYÉ est celui du dépôt (§6.7).
//
//    GitHub ne lit les workflows que dans .github/workflows/, dossier protégé
//    en écriture à distance — à raison : un fichier qui déclenche une
//    exécution ne doit pas pouvoir changer sans que personne ne regarde. Toute
//    correction faite depuis une session Claude restait donc dans un dossier à
//    part, hors du dépôt, et il fallait PENSER à la recopier.
//
//    Le 17/09 on a mesuré ce que « penser à » vaut : le workflow déployé datait
//    d'avant le découpage en modules, sa première étape cherchait le script
//    dans un bloc <script> disparu, elle échouait, et les deux étapes suivantes
//    — dont « toute fonction appelée est-elle définie », celle qui avait
//    rattrapé sept fonctions perdues — ne s'exécutaient plus. Deux jours de
//    poussées non vérifiées, et rien ne le disait : un contrôle qui ne tourne
//    pas ressemble exactement à un contrôle qui passe.
//
//    Les workflows sont donc écrits dans outils/ci/, versionnés et poussés
//    comme le reste, et cette règle refuse que les deux copies divergent.
{
  const MIROIR = 'outils/ci';
  const CIBLE = '.github/workflows';
  if (existe(MIROIR)) {
    const ymls = fs.readdirSync(path.join(RACINE, MIROIR)).filter((f) => f.endsWith('.yml'));
    const ecarts = [];
    for (const f of ymls) {
      const a = path.join(CIBLE, f);
      if (!existe(a)) { ecarts.push(`${f} (absent de ${CIBLE})`); continue; }
      if (lire(a) !== lire(path.join(MIROIR, f))) ecarts.push(f);
    }
    console.log(`\n  workflows : ${ymls.length} dans ${MIROIR} · ` +
                (ecarts.length ? `${ecarts.length} à recopier` : 'identiques à ' + CIBLE));
    if (ecarts.length) {
      fautes.push(`${ecarts.join(', ')} : ${MIROIR}/ et ${CIBLE}/ ont divergé — ` +
                  `c'est le second qui tourne sur GitHub, et lui seul. ` +
                  `Copiez : « Copy-Item outils\\ci\\*.yml .github\\workflows\\ -Force » (§6.7)`);
    }
  }
}

// 4. Un contrôle cité existe, et un contrôle qui existe tourne (§6.6).
//
//    Le 17/09, CLAUDE.md annonçait deux vérifications — « Vérifié par
//    t_ens_mob.mjs », « vérifiées par t_mobile.mjs » — par des fichiers qui
//    n'ont JAMAIS existé dans ce dépôt. Deux écrans entiers, l'espace étudiant
//    compris, se croyaient couverts et ne l'étaient par rien. Une promesse de
//    contrôle est pire que pas de contrôle : on cesse de regarder.
//
//    L'inverse compte autant. Un contrôle écrit, rangé dans outils/ et jamais
//    appelé par le workflow ne protège que le jour où quelqu'un pense à le
//    lancer à la main — c'est-à-dire jamais, passé trois semaines.
{
  const DOCS = ['CLAUDE.md', 'REFONTE.md', 'README.md', 'JOURNAL.md'].filter((d) => existe(d));
  const outils = existe('outils')
    ? new Set(fs.readdirSync(path.join(RACINE, 'outils'))
        .filter((x) => /\.(mjs|py)$/.test(x)))
    : new Set();

  // Un nom peut être cité PRÉCISÉMENT pour dire qu'il ne vérifie rien — c'est
  // le cas des deux ci-dessus, dont CLAUDE.md garde la trace pour que la panne
  // reste lisible. Cet aveu se déclare, comme « @chantier » et « @seuil » :
  //
  //     @fantome t_mobile.mjs — cité ici pour dire qu'il n'a jamais existé
  //
  // Déclarer coûte une ligne ; c'est ce qui distingue « j'assume ce nom mort »
  // de « j'ai oublié que ce contrôle n'existe plus ».
  const avoues = new Map(
    DOCS.flatMap((d) => [...lire(d).matchAll(/@fantome\s+([\w-]+\.(?:mjs|py))/g)]
      .map((x) => [x[1], d])));
  if (avoues.size) {
    console.log('  contrôles cités comme inexistants (@fantome) :',
                [...avoues.keys()].join(' · '));
  }
  for (const [f, d] of avoues) {
    if (outils.has(f)) {
      fautes.push(`${d} déclare « @fantome ${f} » alors que outils/${f} existe — ` +
                  `l'aveu a survécu au contrôle : retirez la déclaration, et dites ` +
                  `ce qu'il vérifie (§6.6)`);
    }
  }

  // Cité dans un document, absent du dossier.
  const fantomes = new Map();
  for (const d of DOCS) {
    for (const m of lire(d).matchAll(/\b(?:outils\/)?(t_[\w-]+\.mjs|[\w-]+\.mjs|[\w-]+\.py)\b/g)) {
      const f = m[1];
      // Les fichiers du dépôt étudiant et les noms de modules js/ ne sont pas
      // des outils : on ne réclame que ce qui se présente comme tel.
      if (outils.has(f) || avoues.has(f)) continue;
      if (existe(path.join('js', f)) || existe(f)) continue;
      if (!fantomes.has(f)) fantomes.set(f, d);
    }
  }
  for (const [f, d] of fantomes) {
    fautes.push(`${d} cite « ${f} », qui n'existe pas dans outils/ — ` +
                `soit le contrôle a disparu, soit il n'a jamais été écrit : ` +
                `dans les deux cas le document promet une vérification qui n'a pas lieu (§6.6)`);
  }

  // Présent dans outils/, jamais appelé par le workflow.
  const WF = '.github/workflows/verifier-portail.yml';
  if (existe(WF)) {
    const wf = lire(WF);
    const lances = [...wf.matchAll(/outils\/([\w-]+\.(?:mjs|py))/g)].map((x) => x[1]);
    const jamais = [...outils].filter((f) => f.startsWith('t_') && !lances.includes(f));
    console.log('\n  contrôles de navigateur :',
                [...outils].filter((f) => f.startsWith('t_')).length,
                '· lancés par le workflow :', new Set(lances.filter((f) => f.startsWith('t_'))).size);
    for (const f of jamais) {
      fautes.push(`outils/${f} existe mais ${WF} ne le lance pas — ` +
                  `un contrôle qu'il faut penser à exécuter n'est pas un contrôle (§6.6)`);
    }
    // Et l'inverse : une étape qui appelle un outil disparu.
    for (const f of new Set(lances)) {
      if (!outils.has(f)) {
        fautes.push(`${WF} lance outils/${f}, qui n'existe pas — le travail échouera à la poussée`);
      }
    }
  }
}

console.log();
if (ecarts.length) {
  console.log('  ✗ REFONTE.md ne décrit plus le dépôt :');
  ecarts.forEach((x) => console.log('      ' + x));
  console.log('    Mettez à jour le document ET la table ATTENDU de ce fichier.');
}
fautes.forEach((x) => console.log('  ✗ ' + x));
if (ecarts.length || fautes.length) process.exit(1);
console.log('  ✓ Les chiffres de REFONTE.md sont ceux du dépôt, et les règles');
console.log('    mesurables du §6 sont tenues.');
