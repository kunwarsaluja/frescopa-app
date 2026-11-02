// Caches the app's own files so it starts offline. Content always comes fresh from the site.
const CACHE = 'frescopa-app-v1';
const FILES = [
  './', 'index.html', 'app.css', 'app.js', 'eds.js', 'ui.js', 'sheet.js',
  'screens/home.js', 'screens/card.js', 'screens/offers.js', 'screens/products.js', 'screens/locations.js', 'screens/page.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

// App files: network first so updates show at once, cache when offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request)
    .then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return resp;
    })
    .catch(() => caches.match(event.request)));
});
