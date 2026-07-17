// hitclaud — service worker: cache-first del shell
const CACHE = 'hitclaud-shell-v3';
const SHELL = [
  '.',
  'index.html',
  'css/tokens.css',
  'css/main.css',
  'js/main.js',
  'js/fisica.js',
  'js/puntuacion.js',
  'js/render.js',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
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
