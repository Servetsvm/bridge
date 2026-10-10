/* Bridge Table — offline cache. Bump VERSION after changing any file so phones pick up the new version. */
const VERSION = 'bridge-v116';
const FILES = ['./', './index.html', './css/style.css', './js/core.js', './js/bidding.js', './js/play.js', './js/field.js', './js/storage.js', './js/photo.js', './js/lang.js', './js/app.js', './js/net.js', './guide.html', './guide-en.html', './guide-no.html', './guide-es.html', './guide-fr.html', './guide-it.html', './guide-de.html', './guide-ru.html', './guide-pl.html', './guide-zh.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first so updates arrive; fall back to the cache when offline
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// tapping a notification brings the app to the front
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => { for (const c of L) if ('focus' in c) return c.focus(); return self.clients.openWindow('./'); }));
});
