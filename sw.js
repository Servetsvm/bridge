/* BridgePlay — offline cache. Bump VERSION after changing any file so phones pick up the new version. */
const VERSION = 'bridge-v644';
const FILES = ['./', './index.html', './css/style.css', './js/dds.js', './js/core.js', './js/bidding.js', './js/play.js', './js/field.js', './js/storage.js', './js/photo.js', './js/app.js', './js/net.js', './js/clubswiss.js', './js/clubmirror.js', './js/clubtour.js', './js/social.js', './js/bidprac.js', './js/puzzles.json', './js/puzzles-play.json', './guide.html', './guide-en.html', './guide-no.html', './guide-es.html', './guide-fr.html', './guide-it.html', './guide-de.html', './guide-ru.html', './guide-pl.html', './guide-zh.html', './privacy.html', './manifest.webmanifest',
  // the texts of each language (index.html loads the visitor's one): without it the page stays empty offline
  ...['en', 'tr', 'no', 'es', 'fr', 'it', 'de', 'ru', 'pl', 'zh'].map(l => './js/lang/' + l + '.js'), './icons/icon-192.png', './icons/icon-512.png'];
// the cache may hang (seen in one Chrome: every file then stayed loading for ever), so nothing waits for it for long
const soon = (p, ms) => Promise.race([p, new Promise(res => setTimeout(res, ms))]).catch(() => {});
// file by file: one file that fails does not leave the whole cache empty (addAll stores nothing when one fails)
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(soon(caches.open(VERSION).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))), 20000)); });
// the version before stays as a spare (a file the new one has not got yet is read from it offline); older ones go
self.addEventListener('activate', e => { e.waitUntil(soon(caches.keys().then(ks => { const old = ks.filter(k => k !== VERSION && /^bridge-v\d+$/.test(k)).sort((a, b) => +b.slice(8) - +a.slice(8)); return Promise.all(old.slice(1).map(k => caches.delete(k))); }), 5000).then(() => self.clients.claim())); });
// the app's own files (FILES, kept with this version) open straight from the phone: no wait for the network on each start,
// which made opening slow on a weak connection. A new version comes with a new sw.js (VERSION): the browser checks it in
// the background, the new one stores every file, and the next start opens the new version. Other files of this site:
// network first, the copy kept when offline.
const OWN = new Set(FILES.map(f => new URL(f, self.location).pathname));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // other sites: the browser's own
  if (OWN.has(url.pathname)) {
    e.respondWith(soon(caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: true })), 3000).then(m => m || fromNet(e)));
    return;
  }
  e.respondWith(fromNet(e));
});
// network first so updates arrive; fall back to the cache when offline. The file is read whole first and the page gets
// its own copy: a cache write that hangs cannot hold the page's file up
function fromNet(e) {
  return fetch(e.request, { cache: 'no-cache' }).then(async r => {
    if (!r.ok) return r;
    const body = await r.arrayBuffer(), make = () => new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
    caches.open(VERSION).then(c => c.put(e.request, make())).catch(() => {});
    return make();
  }).catch(() => soon(caches.match(e.request, { ignoreSearch: true }), 3000).then(m => m || Response.error()));
}
// tapping a notification brings the app to the front
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => { for (const c of L) if ('focus' in c) return c.focus(); return self.clients.openWindow('./'); }));
});
