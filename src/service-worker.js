// A unique name for your cache
const CACHE_NAME = "local-ledger"; // Changed cache name to trigger update

// Files to cache
const URLS_TO_CACHE = [
  // HTML
  "/",
  "/index.html",
  "/orders.html",
  "/products.html",
  "/borrowers.html",
  "/statistics.html",
  "/import_export.html",

  // CSS
  "/css/shared.css",
  "/css/orders.css",
  "/css/products.css",
  "/css/borrowers.css",
  "/css/statistics.css",
  "/css/import_export.css",
  "/css/install_css.css",

  // JS core
  "/js/db.js",
  "/js/language.js",
  "/js/main.js",
  "/js/orders.js",
  "/js/products.js",
  "/js/borrowers.js",
  "/js/statistics.js",
  "/js/import_export.js",
  "/js/script.js",

  // JS UI
  "/ui/orders_ui.js",
  "/ui/products_ui.js",
  "/ui/borrowers_ui.js",
  "/ui/statistics_ui.js",

  // Languages
  "/languages/en.json",
  "/languages/fr.json",
  "/languages/ar.json",

  // Assets
  "/assets/store-scanner-beep-90395.mp3",

  // Icons
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",

  // Libraries
  "/libs/sql-wasm.js",
  "/libs/sql-wasm.wasm",
  "/libs/chart.umd.min.js",

  // Manifest
  "/manifest.json"
];

const NETWORK_ONLY_DOMAINS = [
  'httpbin.org',
  'googleapis.com',
  'accounts.google.com',
  'drive.google.com',
  'oauth2.googleapis.com',
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[Service Worker] Caching files:', URLS_TO_CACHE);
      for (const url of URLS_TO_CACHE) {
        try {
          await cache.add(url);
          console.log(`[Service Worker] Cached: ${url}`);
        } catch (err) {
          console.warn(`[Service Worker] Failed to cache ${url}:`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only domains bypass cache
  const isNetworkOnly = NETWORK_ONLY_DOMAINS.some(domain =>
    url.hostname.includes(domain)
  );
  if (isNetworkOnly) return;

  if (event.request.method !== 'GET') return;

  // External requests: Network-first + Cache fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Local requests: Cache-first + Network fallback
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() =>
        new Response('📴 المورد غير متوفر في وضع عدم الاتصال.', {
          status: 504,
          statusText: 'Gateway Timeout'
        })
      );
    })
  );
});
