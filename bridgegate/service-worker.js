// BridgeGate service worker — app-shell offline caching + installability.
//
// IMPORTANT: bump CACHE_NAME every time you deploy new files (index.html,
// any .js/.css file). Otherwise returning users may keep loading a stale
// cached version instead of your update. Suggested pattern:
// 'bridgegate-v' + YYYYMMDD, e.g. 'bridgegate-v20260709'.
const CACHE_NAME = 'bgate-v7';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './manifest-tr.json',
  './styles.css',
  './i18n.js',
  './bridge-auth.js',
  './core.js',
  './club-auth.js',
  './superadmin-panel.js',
  './table-play.js',
  './screen-panel.js',
  './admin-panel-1.js',
  './admin-panel-2.js',
  './dealfiles.js',
  './dd.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Non-fatal — e.g. an icon path is missing. Don't block install.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      // only this program's old caches: Bridge Table and other apps on this address keep theirs
      Promise.all(names.filter((n) => n !== CACHE_NAME && n.startsWith('bgate-')).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests. Everything else (Firebase REST
  // calls to a different origin, POST/PUT/DELETE writes, etc.) passes
  // straight through to the network untouched — the app's own write
  // queue / _cache already handle Firebase offline behaviour.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Navigation requests (loading the page itself): network-first, so
  // users online always get the latest deployed index.html. Falls back
  // to the cached shell only when there's no network.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else: network first too (an update arrives at once), the cache when offline
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
