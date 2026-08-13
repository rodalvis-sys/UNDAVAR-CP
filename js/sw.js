// ============================================================
//  UNDAVAR — Service Worker (modo 100% offline)
// ============================================================
const CACHE_NAME = "undavar-cache-v1";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/rules.js",
  "./js/db.js",
  "./js/oraculo.js",
  "./js/app.js",
  "./icons/icon.svg"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estrategia: cache primero, red como respaldo, y actualiza el cache en segundo plano.
self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET") return;
  ev.respondWith(
    caches.match(ev.request).then((cacheada) => {
      const redFetch = fetch(ev.request).then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(ev.request, copia));
        }
        return respuesta;
      }).catch(() => cacheada);
      return cacheada || redFetch;
    })
  );
});
