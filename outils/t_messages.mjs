#!/usr/bin/env node
// ── Un message reste un message ───────────────────────────────────────────
//
//     node outils/t_messages.mjs        # depuis la racine du dépôt
//
// erreur() écrivait son argument dans innerHTML. Sur ses 73 appels, douze y
// versent une valeur venue de la base : un titre de questionnaire, un nom de
// classe, un message d'erreur de Supabase. Un titre contenant
// « <img src=x onerror=…> » exécutait donc du code, et le message affiché
// perdait au passage la moitié de sa phrase — les deux sans rien signaler.
//
// Aujourd'hui, seul l'enseignant écrit des titres, et c'est déjà le compte le
// plus puissant du portail : ce n'était pas une porte ouverte, c'était une
// porte sans serrure dans un couloir où personne d'autre ne passe. Mais le
// couloir change le jour où un texte saisi par un étudiant rejoint erreur() —
// une remarque libre, un nom de projet — et personne ne se souviendra de
// vérifier ce détail-là ce jour-là. D'où ce contrôle.
//
// Il vérifie deux choses, et la seconde compte autant que la première :
//   · rien ne s'exécute, et aucune balise n'est fabriquée ;
//   · le texte s'affiche EN ENTIER, tel qu'il a été écrit. Échapper en
//     mangeant la moitié du message serait un autre défaut, pas un correctif.

import { chromium } from 'playwright';
import { ouvrir } from './portail.mjs';

const RACINE = process.argv[2] || process.cwd();

// Des valeurs telles qu'elles reviennent de la base. La dernière est celle qui
// compte le plus : un titre parfaitement légitime, avec des chevrons dedans.
const CAS = [
  { quoi: 'un titre piégé',
    titre: '<img src=x onerror="window.__pan=true">',
    attendu: '« <img src=x onerror="window.__pan=true"> » a été supprimé.' },
  { quoi: 'une balise fermante',
    titre: '</div><script>window.__pan=true;<\/script>',
    attendu: '« </div><script>window.__pan=true;<\/script> » a été supprimé.' },
  { quoi: 'un titre honnête avec des chevrons',
    titre: 'Comparer <int> et <string>',
    attendu: '« Comparer <int> et <string> » a été supprimé.' },
];

const rates = [];
const nav = await chromium.launch();
const { page: p, erreurs, fermer } = await ouvrir(nav, RACINE, { largeur: 390 });

for (const c of CAS) {
  const r = await p.evaluate(async (c) => {
    window.__pan = false;
    const z = document.getElementById('err-qactifs');
    z.hidden = false;
    // Exactement l'appel du portail, avec le titre à la place de m.titre.
    window.__e.erreur('err-qactifs', '« ' + c.titre + ' » a été supprimé.', true);
    await new Promise((ok) => setTimeout(ok, 120));
    return {
      pan: window.__pan,
      noeuds: z.querySelectorAll('*').length,
      // « div div » attraperait le <div class="msg"> lui-même : il EST un div
      // dans un div. On cherche ce qui n'aurait aucune raison d'exister.
      balises: z.querySelectorAll('img, script, iframe, object, embed, svg, a, b, i, span').length,
      texte: z.textContent.trim(),
      classe: (z.firstElementChild || {}).className || '(aucun)',
    };
  }, c);

  console.log(`\n── ${c.quoi}`);
  console.log('   code exécuté   :', r.pan ? 'OUI' : 'non');
  console.log('   nœuds créés    :', r.noeuds, '· balises indues :', r.balises);
  console.log('   classe du msg  :', r.classe);
  console.log('   texte affiché  :', JSON.stringify(r.texte));

  if (r.pan) rates.push(`${c.quoi} : du code venu de la base s'est exécuté`);
  if (r.balises) rates.push(`${c.quoi} : ${r.balises} balise(s) fabriquée(s) à partir du texte`);
  if (r.noeuds !== 1) rates.push(`${c.quoi} : ${r.noeuds} nœuds au lieu du seul <div class="msg">`);
  if (r.texte !== c.attendu) {
    rates.push(`${c.quoi} : le texte affiché n'est pas celui qu'on a écrit\n` +
               `        écrit   : ${JSON.stringify(c.attendu)}\n` +
               `        affiché : ${JSON.stringify(r.texte)}`);
  }
  if (!/^msg( ok)?$/.test(r.classe)) {
    rates.push(`${c.quoi} : la classe du message est « ${r.classe} », attendu « msg ok »`);
  }
}

// Vider la zone doit la vider, pas y laisser le message précédent.
const reste = await p.evaluate(() => {
  window.__e.erreur('err-qactifs', '');
  return document.getElementById('err-qactifs').innerHTML;
});
console.log('\n── après erreur(zone, "") :', JSON.stringify(reste));
if (reste !== '') rates.push(`erreur(zone, "") laisse ${JSON.stringify(reste)} derrière elle`);
if (erreurs.length) rates.push('erreur JS — ' + erreurs[0]);

await fermer();
await nav.close();

console.log();
if (rates.length) { rates.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('  ✓ Un titre venu de la base s\'affiche en entier et n\'exécute rien.');
