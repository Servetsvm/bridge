/* Bridge Table — offline cache. Bump VERSION after changing any file so phones pick up the new version. */
const VERSION = 'bridge-v483';
const FILES = ['./', './index.html', './css/style.css', './js/dds.js', './js/core.js', './js/bidding.js', './js/play.js', './js/field.js', './js/storage.js', './js/photo.js', './js/app.js', './js/net.js', './js/clubtour.js', './js/social.js', './js/puzzles.json', './js/puzzles-play.json', './guide.html', './guide-en.html', './guide-no.html', './guide-es.html', './guide-fr.html', './guide-it.html', './guide-de.html', './guide-ru.html', './guide-pl.html', './guide-zh.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
// the cache may hang (seen in one Chrome: every file then stayed loading for ever), so nothing waits for it for long
const soon = (p, ms) => Promise.race([p, new Promise(res => setTimeout(res, ms))]).catch(() => {});
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(soon(caches.open(VERSION).then(c => c.addAll(FILES)), 15000)); });
self.addEventListener('activate', e => { e.waitUntil(soon(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && /^bridge-v\d+$/.test(k)).map(k => caches.delete(k)))), 5000).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;   // other sites: the browser's own
  // network first so updates arrive; fall back to the cache when offline. The file is read whole first and the page gets
  // its own copy: a cache write that hangs cannot hold the page's file up
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(async r => {
    if (!r.ok) return r;
    const body = await r.arrayBuffer(), make = () => new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
    caches.open(VERSION).then(c => c.put(e.request, make())).catch(() => {});
    return make();
  }).catch(() => soon(caches.match(e.request, { ignoreSearch: true }), 3000).then(m => m || Response.error())));
});
// tapping a notification brings the app to the front
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => { for (const c of L) if ('focus' in c) return c.focus(); return self.clients.openWindow('./'); }));
});
