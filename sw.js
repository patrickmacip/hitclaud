// hitclaud — service worker: cache-first del shell
const CACHE = 'hitclaud-shell-v34';
const SHELL = [
  '.',
  'index.html',
  'css/tokens.css',
  'css/main.css',
  'js/util.js',
  'js/main.js',
  'js/fisica.js',
  'js/puntuacion.js',
  'js/render.js',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  // CACHE HONESTO: cachea con cache:'reload' → cada asset se pide a la red
  // SALTÁNDOSE el HTTP-cache del navegador. Sin esto, addAll puede guardar
  // copias viejas y el código nuevo se ve viejo aunque el SW diga versión nueva.
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
