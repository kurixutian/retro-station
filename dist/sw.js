const CACHE_NAME = 'retro-station-v5';
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

// Inject Cross-Origin Isolation headers on top-level HTML navigations so
// window.SharedArrayBuffer is unlocked for multi-threaded WebAssembly cores
// (desmume2015-thread-wasm / melonds-thread-wasm pthreads).
function withIsolationHeaders(res, userAgent) {
  if (!res || res.status !== 200 || res.type === 'opaque') return res;
  const headers = new Headers(res.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  const isAppleWebKitOnly =
    typeof userAgent === 'string' &&
    /Safari\//.test(userAgent) &&
    !/Chrome\/|Chromium\/|CriOS\/|Edg\//.test(userAgent);
  // Chromium/Android supports 'credentialless' (unlocks SharedArrayBuffer without CORP restrictions);
  // Safari/WebKit requires 'require-corp' (all EmulatorJS & Libretro CDNs serve Cross-Origin-Resource-Policy: cross-origin).
  headers.set('Cross-Origin-Embedder-Policy', isAppleWebKitOnly ? 'require-corp' : 'credentialless');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

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
  const ua = event.request.headers.get('user-agent') || '';

  // 1. Navigation requests (HTML pages): NETWORK-FIRST with Cross-Origin Isolation headers
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return withIsolationHeaders(networkRes, ua);
        })
        .catch(() => {
          return caches
            .match('./index.html')
            .then((cached) => cached || caches.match('./'))
            .then((fallback) => (fallback ? withIsolationHeaders(fallback, ua) : fallback));
        })
    );
    return;
  }

  // 2a. Cross-origin (EmulatorJS CDN cores): pass straight to the network so the
  // browser keeps the original request mode. Cache is only an offline fallback;
  // serving a cached opaque response to a CORS fetch stalls "Download Game Data".
  if (new URL(event.request.url).origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request, { ignoreVary: true }))
    );
    return;
  }

  // 2b. Static Assets: Cache-First / Stale-While-Revalidate strategy
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
