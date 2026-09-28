// ── Le portail installable — le service worker le plus simple qui tienne ──
//
// Il rend le portail installable sur un téléphone (écran d'accueil, plein
// écran) et affiche la dernière version connue quand le réseau manque.
//
// RÉSEAU D'ABORD, TOUJOURS : un portail de suivi qui montrerait une version
// en cache pendant une séance serait pire que pas de portail. Le cache ne sert
// qu'en secours, hors ligne. Et il ne touche QU'AUX fichiers du portail (même
// origine) : les appels à Supabase passent sans jamais être mis en cache —
// une réponse d'élève ou un tableau de bord périmés n'ont rien à faire là.

var CACHE = "portail-v1";

self.addEventListener("install", function(){ self.skipWaiting(); });

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(noms){
    return Promise.all(noms.filter(function(n){ return n !== CACHE; })
                           .map(function(n){ return caches.delete(n); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function(rep){
    if (rep && rep.ok) {
      var copie = rep.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copie); });
    }
    return rep;
  }).catch(function(){
    return caches.match(req).then(function(r){
      return r || (req.mode === "navigate" ? caches.match("./") : undefined) ||
        new Response("Hors ligne.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    });
  }));
});
