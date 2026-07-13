/* service worker : met le carnet en cache pour un fonctionnement hors-ligne.
   Incrémenter CACHE_NAME force le renouvellement du cache au prochain déploiement. */
const CACHE_NAME = "carnet-cache-v3";
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
