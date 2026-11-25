/* BridgePlay (new) — works without a connection: its files are kept on the phone; a new VERSION brings the new ones. */
const VERSION = 'bp2-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './css/app.css', './app/main.js', './app/net.js', './app/i18n.js', './app/ui.js',
  './app/score.js', './app/clubs.js', './app/play.js', '../js/dds.js', '../js/core.js', '../js/bidding.js', '../js/play.js', '../js/photo.js',
  '../icons/icon-192.png', '../icons/icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {}))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bp2-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const OWN = new Set(FILES.map(f => new URL(f, self.location).pathname));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || !OWN.has(u.pathname)) return;   // the database and everything else: the network
  // the page and its files: the network first (a new version at once), the kept copy without a connection
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || Response.error())));
});
