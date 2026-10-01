// Offline support: serve from cache first, refresh the cache in the background.
const CACHE = 'ddh-v8';
const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './fonts/Jersey10-latin.woff2',
  './js/version.js',
  './js/util.js',
  './js/data.js',
  './js/sprites.js',
  './js/engine.js',
  './js/backup.js',
  './js/audio.js',
  './js/render.js',
  './js/ui.js',
  './js/minigames.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  const network = fetch(req)
    .then(async res => {
      if (res && res.ok) {
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        await cache.put(req, copy);
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(network.then(() => undefined));
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return network.then(res => {
        if (res) return res;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
