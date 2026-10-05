// ── Un refus qui dit quoi faire ───────────────────────────────────────────
//
// Lot 1 des propositions du 05/10, item 1.5. Relevé ce jour-là : « Action
// refusée. Vérifiez que vous êtes bien connecté en enseignant. » quatorze
// fois, dans huit modules, pour TOUTES les causes — réseau coupé, session
// expirée, fonction pas encore déployée, refus motivé de la base. La base
// envoie pourtant presque toujours une raison (`detail`, `motif`) : l'écran
// la jetait. Critère « gestion des erreurs » de Bastien & Scapin : un message
// dit ce qui s'est passé ET ce qu'on peut faire.
//
// Même principe que `texteEnvoi()` côté étudiant (socle.js), qui a mis fin en
// septembre à deux séances passées à chercher une panne réglable en un clic.
// Les modules gardent leurs messages propres pour les motifs qu'eux seuls
// connaissent (« vide », « plein », « reponses »…) et passent le reste ici.

var MOTIFS = {
  refus:    "La base ne vous reconnaît pas comme enseignant — la session a sans doute expiré. " +
            "Se déconnecter, puis se reconnecter.",
  inconnue: "Cette séance n'existe plus en base. Rechargez la page.",
  appel:    "La séance d'appel reste ouverte toute l'année : la clore couperait le pointage de la classe.",
  numero:   "Les numéros 90 à 99 se règlent depuis leur propre carte (questionnaires, appel)."
};

function texteRefus(r){
  if (!r) return "La base n'a pas répondu. Vérifiez la connexion, puis réessayez.";
  if (r.error) {
    var m = String(r.error.message || r.error.details || r.error.hint || "");
    var code = String(r.error.code || "");
    if (/jwt|token|401/i.test(m + code)) return MOTIFS.refus;
    if (/failed to fetch|network|load failed|timeout/i.test(m)) {
      return "La base ne répond pas (réseau). Réessayez dans un instant.";
    }
    if (code === "PGRST202" || /could not find the function|does not exist/i.test(m)) {
      return "La base ne connaît pas encore cette fonction : la migration qui la crée n'est pas " +
             "appliquée (voir JOURNAL.md).";
    }
    return "La base a refusé : " + (m || code || "raison non précisée") + ".";
  }
  var d = r.data;
  if (!d) return "La base n'a rien renvoyé. Rechargez la page.";
  if (d.detail) return String(d.detail);
  if (d.motif && MOTIFS[d.motif]) return MOTIFS[d.motif];
  if (d.motif) return "Refusé par la base (motif « " + d.motif + " »).";
  return "La base a refusé sans dire pourquoi. Rechargez la page, puis réessayez.";
}

function estRefus(r){
  return !r || !!r.error || !r.data || !r.data.ok;
}

export { texteRefus, estRefus };
