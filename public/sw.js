/* service worker : met le carnet en cache pour un fonctionnement hors-ligne.
   Incrémenter CACHE_NAME force le renouvellement du cache au prochain déploiement. */
const CACHE_NAME = "carnet-cache-v23";
const SUPABASE_ORIGIN = "https://bmotbwubruvsrflaufis.supabase.co";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/main.js",
  "./js/dom.js",
  "./js/ui.js",
  "./js/recipes-data.js",
  "./js/recipes-store.js",
  "./js/cart.js",
  "./js/timer.js",
  "./js/grid.js",
  "./js/detail.js",
  "./js/add-form.js",
  "./js/photos.js",
  "./js/quantity.js",
  "./js/icons.js",
  "./js/utils.js",
  "./js/supabase-client.js",
  "./js/auth.js",
  "./js/profile.js",
  "./js/sync.js",
  "./js/write-queue.js",
  "./fonts/caveat.woff2",
  "./fonts/dm-sans.woff2",
  "./fonts/fraunces.woff2",
  "./fonts/fraunces-italic.woff2",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  /* Les appels à l'API Supabase (auth, données) ne doivent jamais être mis
     en cache : ce sont des réponses dynamiques, pas des fichiers statiques
     du site. Les laisser passer sans interception garde toujours les
     données à jour (ex. getUser() après une mise à jour de profil). */
  if (event.request.url.startsWith(SUPABASE_ORIGIN)) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
