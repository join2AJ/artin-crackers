// Offline cache: the app shell is cached on install; everything is served
// cache-first and refreshed in the background, so updates land on the next visit.
// Bump CACHE whenever shipped web files change.
const CACHE = 'patakha-v6';
const SHELL = [
  './', 'index.html', 'privacy.html', 'version.json', 'manifest.webmanifest',
  'css/app.css', 'css/fonts.css',
  'js/app.js', 'js/audio.js', 'js/synth.js', 'js/crackers.js', 'js/visuals.js', 'js/scene.js', 'js/fx.js', 'js/mic.js', 'js/store.js', 'js/lighter.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/Barlow-400.woff2', 'fonts/Barlow-500.woff2', 'fonts/Barlow-600.woff2', 'fonts/ChakraPetch-600.woff2', 'fonts/ChakraPetch-700.woff2',
  'fonts/ShareTechMono-400.woff2', 'fonts/YatraOne-deva.woff2', 'fonts/YatraOne-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then((res) => {
        if (res.ok && res.type === 'basic') cache.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
