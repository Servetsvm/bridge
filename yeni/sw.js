/* the trial "new BridgePlay" is gone: this replaces its service worker, clears its copy and sends its pages to BridgePlay */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('bp2-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(new URL('../', self.registration.scope).href);
})()));
