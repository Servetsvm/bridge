// BridgeGate service worker — app-shell offline caching + installability.
//
// IMPORTANT: bump CACHE_NAME every time you deploy new files (index.html,
// any .js/.css file). Otherwise returning users may keep loading a stale
// cached version instead of your update. Suggested pattern:
// 'bridgegate-v' + YYYYMMDD, e.g. 'bridgegate-v20260709'.
const CACHE_NAME = 'kulup-v38';

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
  './cardcam.js',
  '../js/photo.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// the cache may hang (seen in one Chrome: every file then stayed loading for ever), so nothing waits for it for long
const soon = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(res, ms))]).catch(() => {});

self.addEventListener('install', (event) => {
  // Non-fatal — e.g. an icon path is missing. Don't block install.
  event.waitUntil(soon(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)), 15000));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    soon(caches.keys().then((names) =>
      // only this program's old caches: Bridge Table and other apps on this address keep theirs
      Promise.all(names.filter((n) => n !== CACHE_NAME && n.startsWith('kulup-')).map((n) => caches.delete(n)))
    ), 5000)
  );
  self.clients.claim();
});

// network first: the file is read whole and the page gets its own copy, so a cache write that hangs cannot hold it up
const fromNet = (req, key) => fetch(req, { cache: 'no-cache' }).then(async (res) => {
  if (!res.ok) return res;
  const body = await res.arrayBuffer(), make = () => new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  caches.open(CACHE_NAME).then((cache) => cache.put(key, make())).catch(() => {});
  return make();
});
const fromCache = (key, opt) => soon(caches.match(key, opt), 3000).then((m) => m || Response.error());

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
    event.respondWith(fromNet(req, './index.html').catch(() => fromCache('./index.html')));
    return;
  }

  // Everything else: network first too (an update arrives at once), the cache when offline
  event.respondWith(fromNet(req, req).catch(() => fromCache(req, { ignoreSearch: true })));
});
