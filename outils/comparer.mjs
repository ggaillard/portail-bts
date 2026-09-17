#!/usr/bin/env node
// ── Deux versions du portail, côte à côte, au pixel ───────────────────────
//
//     node outils/comparer.mjs <racine-avant> [<racine-après>]
//     node outils/comparer.mjs /tmp/avant .
//
// Le chantier A déplace du code sans vouloir déplacer un seul pixel : sortir
// le CSS dans des fichiers, passer le script en module, renommer des seuils.
// « Ça a l'air pareil » ne suffit pas à le dire — un padding perdu dans une
// feuille qu'on a mal découpée ne se voit pas, il se remarque trois jours plus
// tard en séance.
//
// Plutôt que de comparer des images, ce contrôle compare la GÉOMÉTRIE : pour
// chaque élément visible, sa boîte et une poignée de styles calculés. Un écart
// est alors nommé — « .tuile-v : font-size 1.7rem -> 1.45rem à 390 px » — au
// lieu d'être un rectangle rouge sur une capture. Et il voit des choses qu'une
// image ne montre pas : une couleur identique obtenue autrement, un élément
// déplacé de zéro pixel mais qui a changé de parent.
//
// Il ne remplace pas t_appel / t_revision / t_pilotage, qui vérifient des
// intentions (« le geste est faisable », « la carte tient sous 1 150 px »).
// Lui ne vérifie qu'une chose, et c'est exactement celle qu'on veut ici :
// rien n'a bougé.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const AVANT = process.argv[2];
const APRES = process.argv[3] || process.cwd();
if (!AVANT) { console.error('usage : node outils/comparer.mjs <racine-avant> [<racine-après>]'); process.exit(2); }

const LARGEURS = [360, 390, 480, 620, 640, 768, 1280];

// Les styles qu'on surveille : ceux qui font qu'une page « a bougé ».
const STYLES = ['display', 'font-size', 'font-weight', 'color', 'background-color',
  'padding', 'margin', 'border-width', 'border-radius', 'flex-direction',
  'grid-template-columns', 'text-align', 'gap', 'opacity', 'position', 'overflow-x'];

// ── Des données identiques des deux côtés ─────────────────────────────────
const aff = (id, classe_id, code, nom, numero, ouvert, inscrits, commences, termines) =>
  ({ seance_id: id, classe_id, code, nom, numero, ouvert, inscrits, commences, termines, rattachee_a: null });

const JEU = {
  afaire: { ok: true, bloquants: 1, attentions: 2, agissables: 1, taches: [
    { classe: 'BTS SIO 1 - Bloc 1 DEV', code: 'BTS1-DEV-2026', classe_id: 1, gravite: 'bloquant',
      quoi: 'Aucun code de classe', detail: 'Les étudiants ne peuvent pas s’identifier.',
      geste: 'Leur attribuer un code', action: null, seance_id: null, aller: null },
    { classe: 'BTS SIO 1 - Bloc 1 DEV', code: 'BTS1-DEV-2026', classe_id: 1, gravite: 'attention',
      quoi: 'Séance 2 encore ouverte', detail: 'Démarrée il y a 11 h, bien au-delà de sa durée.',
      geste: 'Clore la séance', action: 'clore', seance_id: 11, aller: null },
    { classe: 'BTS SIO 2 - SLAM', code: 'BTS2-SLAM-2026', classe_id: 2, gravite: 'info',
      quoi: 'Question du jour pas encore créée', detail: 'Elle se crée d’elle-même.',
      geste: '', action: null, seance_id: null, aller: null },
  ]},
  bib: [
    { id: 1, cle: 'connaissance', titre: 'Faisons connaissance', intro: '', mode: 'sequentiel', questions: 12,
      affectations: [aff(31, 1, 'BTS1-DEV-2026', 'BTS SIO 1 - Bloc 1 DEV', 98, true, 31, 19, 14)] },
    { id: 3, cle: 'revision-poo-tp1', titre: "Réviser l'interro — Console & POO", intro: '',
      mode: 'revision', questions: 12,
      affectations: [aff(34, 2, 'BTS2-SLAM-2026', 'BTS SIO 2 - SLAM', 90, true, 13, 3, 1)] },
  ],
  classes: [
    { classe_id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV', poses: [],
      seances: [{ seance_id: 11, numero: 2, titre: 'Séance 2', en_cours: true }] },
    { classe_id: 2, code: 'BTS2-SLAM-2026', nom: 'BTS SIO 2 - SLAM', poses: [],
      seances: [{ seance_id: 3, numero: 2, titre: 'TP2', en_cours: false }] },
  ],
  ctrl: [{ seance_id: 3, classe_id: 2, code: 'BTS2-SLAM-2026', classe: 'BTS SIO 2 - SLAM',
    numero: 2, titre: 'TP2', nature: 'projet', notions: 8, ouvert: false,
    repondu: 0, inscrits: 13, demarree: false }],
  // La ligne du semestre porte le seul seuil qui a changé de valeur en A1 :
  // 620 px et 640 px disaient la même chose (« l'écran est étroit »), ils sont
  // devenus un seul. Sans elle dans le jeu d'essai, la fusion ne serait
  // vérifiée par rien.
  semestre: [{ classe_id: 1, code: 'BTS1-DEV-2026', nom: 'BTS SIO 1 - Bloc 1 DEV', inscrits: 31,
    seances: [
      { seance_id: 1, numero: 1, titre: 'Prise en main de l’environnement', etat: 'jouee',
        notee: true, repondants: 28, inscrits: 31, reussite: 71, avancement: null,
        dernier: 'il y a 6 j', publiee: true },
      { seance_id: 11, numero: 2, titre: 'Culture DevOps, cycle de vie & versioning Git',
        etat: 'en_cours', notee: false, repondants: 19, inscrits: 31, reussite: 64,
        avancement: null, dernier: 'il y a 11 h', publiee: true },
      { seance_id: 12, numero: 3, titre: 'Séance 3', etat: 'prete', notee: false,
        repondants: 0, inscrits: 31, reussite: null, avancement: null, dernier: null, publiee: false },
      { seance_id: 13, numero: 4, titre: 'Séance 4', etat: 'a_produire', notee: false,
        repondants: 0, inscrits: 31, reussite: null, avancement: null, dernier: null, publiee: false },
    ]}],
  suivi: { ok: true, inscrits: 13, commences: 9, termines: 4, questions: 10,
    moyenne: 6.4, taux: 64, eleves: [
      { numero: '01', avatar: '🦊', faites: 10, justes: 8, present: true, maj: '09:41' },
      { numero: '02', avatar: '🦉', faites: 4, justes: 1, present: true, maj: '09:52' },
      { numero: '07', avatar: '🐢', faites: 0, justes: 0, present: false, maj: null },
    ], questions_detail: [] },
};

async function releve(nav, racine, largeur) {
  const { page: p, erreurs, fermer } = await ouvrir(nav, racine, { largeur });

  const r = await p.evaluate(({ JEU, STYLES }) => {
    // Tout montrer : on compare des gabarits, pas un parcours.
    document.querySelectorAll('[hidden]').forEach((e) => { e.hidden = false; });
    document.querySelectorAll('.volet').forEach((v) => { v.hidden = false; });
    const e = window.__e;
    try { e.rendreAFaire(JEU.afaire); } catch (x) {}
    try { e.BIB.classes = JEU.classes; e.rendreBibliotheque(JEU.bib); } catch (x) {}
    try { e.rendreControles(JEU.ctrl); } catch (x) {}
    try { e.rendreSemestre(JEU.semestre); } catch (x) {}
    try { e.rendreSuivi(JEU.suivi); } catch (x) {}

    const sortie = [];
    const marche = (n, chemin) => {
      for (const enf of n.children) {
        const b = enf.getBoundingClientRect();
        const cl = (enf.className && enf.className.baseVal !== undefined
          ? enf.className.baseVal : String(enf.className || '')).trim();
        // La clé ne contient PAS le chemin complet. Elle l'a contenu jusqu'au
        // 17/09, et l'insertion d'un seul conteneur — la cible du lien
        // d'évitement — faisait alors « disparaître » puis « apparaître » les
        // 419 éléments de la page : 5 880 différences pour un div. Un contrôle
        // qui crie autant ne se lit plus, et on finit par le désactiver le jour
        // où il dit quelque chose. La clé est donc ce que l'élément EST ;
        // l'endroit où il se trouve est comparé à part, comme un attribut.
        const cle = enf.tagName.toLowerCase() +
                    (enf.id ? '#' + enf.id : '') + (cl ? '.' + cl.split(/\s+/).join('.') : '');
        if (b.width || b.height) {
          const st = getComputedStyle(enf);
          const styles = {};
          STYLES.forEach((k) => { styles[k] = st.getPropertyValue(k); });
          sortie.push({ cle, chemin: chemin + '>' + cle,
            boite: [Math.round(b.width), Math.round(b.height),
                    Math.round(b.left), Math.round(b.top)],
            styles });
        }
        marche(enf, cle);
      }
    };
    marche(document.body, '');
    return { elements: sortie,
             hauteur: Math.round(document.body.getBoundingClientRect().height),
             debord: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, { JEU, STYLES });

  await fermer();
  return { ...r, erreurs };
}

const nav = await chromium.launch();
let total = 0;

for (const w of LARGEURS) {
  const a = await releve(nav, AVANT, w);
  const b = await releve(nav, APRES, w);
  // Chaque élément est numéroté parmi ses semblables : le troisième .qn-c
  // reste le troisième .qn-c, où qu'on l'ait déplacé dans l'arbre.
  const numeroter = (liste) => {
    const vus = new Map();
    return new Map(liste.map((x) => {
      const n = (vus.get(x.cle) || 0) + 1;
      vus.set(x.cle, n);
      return [x.cle + '@@' + n, x];
    }));
  };
  const ia = numeroter(a.elements);
  const ib = numeroter(b.elements);
  const ecarts = [];
  let reparentes = 0;

  for (const [k, x] of ia) {
    const y = ib.get(k);
    if (!y) { ecarts.push(`disparu : ${k.replace(/@@[0-9]*$/, '')}`); continue; }
    if (x.boite.join() !== y.boite.join()) {
      ecarts.push(`${k.replace(/@@[0-9]*$/, '')} : boîte ${x.boite.join('×')} -> ${y.boite.join('×')}`);
    }
    for (const s of STYLES) {
      if (x.styles[s] !== y.styles[s]) {
        ecarts.push(`${k.replace(/@@[0-9]*$/, '')} : ${s} « ${x.styles[s]} » -> « ${y.styles[s]} »`);
      }
    }
    // Un élément qui n'a pas bougé d'un pixel mais a changé de parent : c'est
    // exactement ce qu'une comparaison d'images ne verrait pas, et c'est
    // rarement anodin. On le compte, on ne l'égrène pas.
    if (x.chemin !== y.chemin) reparentes++;
  }
  for (const k of ib.keys()) if (!ia.has(k)) ecarts.push(`apparu : ${k.replace(/@@[0-9]*$/, '')}`);

  const etat = ecarts.length ? `${ecarts.length} écart(s)` : 'identique';
  if (reparentes) console.log(`  ${String(w).padStart(4)} px : ${reparentes} élément(s) ont changé de place dans l'arbre sans changer de boîte`);
  console.log(`  ${String(w).padStart(4)} px : ${String(a.elements.length).padStart(4)} éléments · ` +
              `page ${a.hauteur} -> ${b.hauteur} px · ${etat}`);
  ecarts.slice(0, 12).forEach((x) => console.log('           ' + x));
  if (ecarts.length > 12) console.log(`           … et ${ecarts.length - 12} de plus`);
  if (b.erreurs.length) { console.log('           erreur JS : ' + b.erreurs[0]); total++; }
  // Un débordement se compare, il ne s'affirme pas : ce contrôle déplie TOUT
  // d'un coup, y compris l'écran projeté, ce qu'aucun utilisateur ne voit. Il
  // déborde donc des deux côtés. Ce qui compterait, c'est qu'il déborde PLUS
  // qu'avant. Le débordement réel, celui d'un écran qu'on parcourt vraiment,
  // est l'affaire de t_appel et t_pilotage.
  if (b.debord !== a.debord) {
    console.log(`           débordement ${a.debord} -> ${b.debord} px`);
    total++;
  }
  total += ecarts.length;
}

await nav.close();
console.log();
if (total) { console.log(`  ✗ ${total} différence(s) entre les deux versions.`); process.exit(1); }
console.log('  ✓ Les deux versions rendent exactement la même chose,');
console.log(`    à ${LARGEURS.length} largeurs, boîtes et styles calculés compris.`);
