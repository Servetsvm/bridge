// the club tournaments moved into Bridge Table (kulupler/): this old worker removes itself and its caches, and the
// pages it was serving load again (from the address that now leads to Bridge Table)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('bgate-')).map((n) => caches.delete(n)));
    await self.registration.unregister();
    const pages = await self.clients.matchAll({ type: 'window' });
    pages.forEach((c) => c.navigate(c.url));
  })());
});
