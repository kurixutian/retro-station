const CACHE_NAME = 'retro-station-v10';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.emulatorjs.org/stable/data/loader.js',
  'https://cdn.emulatorjs.org/stable/data/emulator.min.js',
  'https://cdn.emulatorjs.org/stable/data/emulator.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            fetch(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin', cache: 'reload' })
              .then((res) => (res && res.ok ? cache.put(url, res) : null))
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);

  // Never intercept Cloud Sync API calls in the Service Worker
  if (reqUrl.pathname.startsWith('/api/') || reqUrl.hostname.includes('workers.dev')) {
    return;
  }

  // 1. Navigation requests (HTML pages): NETWORK-FIRST strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches
            .match('./index.html')
            .then((cached) => cached || caches.match('./'));
        })
    );
    return;
  }

  // 2a. Cross-origin requests (EmulatorJS CDN cores & runtime assets):
  // Runtime-cache cores on successful load so offline play works on the go
  if (reqUrl.origin !== self.location.origin) {
    if (reqUrl.hostname.includes('emulatorjs.org')) {
      event.respondWith(
        caches.match(event.request, { ignoreVary: true }).then((cached) => {
          if (cached) return cached;
          return fetch(event.request)
            .then((networkRes) => {
              if (
                networkRes &&
                (networkRes.status === 200 || networkRes.type === 'opaque')
              ) {
                const clone = networkRes.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
              }
              return networkRes;
            })
            .catch(() => cached);
        })
      );
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (
            networkRes &&
            (networkRes.status === 200 || networkRes.type === 'opaque')
          ) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(event.request, { ignoreVary: true }))
    );
    return;
  }

  // 2b. Local static assets: Cache-First / Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkRes) => {
          if (
            networkRes &&
            (networkRes.status === 200 || networkRes.type === 'opaque') &&
            (networkRes.type === 'basic' || networkRes.type === 'cors' || networkRes.type === 'opaque')
          ) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});
