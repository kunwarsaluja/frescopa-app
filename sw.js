// App shell is cached for offline start; EDS content is network-first so it is always fresh.
const CACHE = 'frescopa-v12';
const SHELL = ['./', 'index.html', 'book.html', 'app.js', 'app.css', 'manifest.webmanifest', 'fonts/montserrat.woff2', 'fonts/eb-garamond-italic.woff2', 'icons/icon.svg', 'icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (new URL(e.request.url).origin === location.origin || /\.(plain\.html|json)$/.test(new URL(e.request.url).pathname))) {
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});
