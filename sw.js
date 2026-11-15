// ============================================================
//  UNDAVAR — Service Worker (modo 100% offline)
// ============================================================
// [UNDAVAR-PARTE-3.6] El SW vive en la raíz para controlar toda la app
// [UNDAVAR-PARTE-8-MAPA] Se cachean también las imágenes del mapa y los iconos
// [UNDAVAR-PARTE-8B-GEO] Caché nueva con el mapa de 8192
const CACHE_NAME = "undavar-cache-v120";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/icons.js",
  "./js/rules.js",
  "./js/db.js",
  "./js/oraculo.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-64.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/mapa/mapa-preview.webp",
  "./assets/mapa/mapa-8192.webp"
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

// Estrategia: el HTML siempre va a la red (para no servir iframes viejos);
// los assets van a caché primero, con red como respaldo.
self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET") return;

  // [UNDAVAR-PARTE-3.8] Navegaciones: red primero, caché como respaldo offline
  if (ev.request.mode === "navigate") {
    ev.respondWith(
      fetch(ev.request).then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(ev.request, copia));
        }
        return respuesta;
      }).catch(() =>
        caches.match(ev.request).then((cacheada) => cacheada || caches.match("./index.html"))
      )
    );
    return;
  }

  // [UNDAVAR-PARTE-10.10-PALETA-COLUMNAS] El código va a red primero: los
  // cambios llegan con una sola recarga. La caché queda como respaldo offline.
  const url = new URL(ev.request.url);
  const esCodigo = /\.(?:js|css|json)$/i.test(url.pathname);
  if (esCodigo) {
    ev.respondWith(
      fetch(ev.request).then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(ev.request, copia));
        }
        return respuesta;
      }).catch(() => caches.match(ev.request).then((cacheada) => cacheada || Response.error()))
    );
    return;
  }

  // Assets: caché primero, red como respaldo, y actualiza la caché en segundo plano
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
