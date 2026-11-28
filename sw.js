const VERSION = 'mx03lv8z';
const CACHE = 'pp-hub-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './hub/icon-192.png', './hub/icon-512.png', './hub/favicon-64.png'];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pp-hub-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    event.respondWith(url.search.includes('v=') ? cacheFirst(req) : networkFirst(req));
    return;
  }
  if (CDN.test(req.url)) event.respondWith(cacheFirst(req));
});
