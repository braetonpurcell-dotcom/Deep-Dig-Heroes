// Offline support.
// - The page itself is network-first, so an online player always gets the newest index.html.
// - Scripts and styles are versioned (?v=1.2.3 in index.html), so a new page can never be paired
//   with old scripts, and they are served cache-first by their exact URL.
// - Installs fetch everything with cache: 'reload', so the browser's own HTTP cache can't slip an
//   old file into a new version's cache.
importScripts('./js/version.js');
const CACHE = 'ddh-beta-' + GAME_VERSION;
const V = '?v=' + GAME_VERSION;
const PAGE = ['./', './index.html'];
const ASSETS = [
  './style.css' + V,
  './js/version.js' + V,
  './js/beta.js' + V,
  './js/util.js' + V,
  './js/data.js' + V,
  './js/sprites.js' + V,
  './js/engine.js' + V,
  './js/backup.js' + V,
  './js/audio.js' + V,
  './js/render.js' + V,
  './js/ui.js' + V,
  './js/minigames.js' + V,
  './js/feedback.js' + V,
  './js/leaderboard.js' + V,
  './js/tappad.js' + V,
  './js/main.js' + V,
  './manifest.json',
  './fonts/Jersey10-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll([...PAGE, ...ASSETS].map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ddh-beta-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function fromNetwork(req) {
  const res = await fetch(req, { cache: 'no-cache' });
  if (res && res.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/feedback/')) return; // replies are always fetched live
  if (req.mode === 'navigate') {
    event.respondWith(
      fromNetwork(req).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => cached || fromNetwork(req).catch(() => Response.error()))
  );
});
