// A unique name for your cache
const CACHE_NAME = "local-ledger-v3"; // Changed cache name to trigger update

// Files to cache
const URLS_TO_CACHE = [
  // HTML
  "./",
  "./index.html",
  "./orders.html",
  "./products.html",
  "./borrowers.html",
  "./statistics.html",
  "./import_export.html",

  // CSS
  "./css/shared.css",
  "./css/orders.css",
  "./css/products.css",
  "./css/borrowers.css",
  "./css/statistics.css",
  "./css/import_export.css",
  "./css/install_css.css",

  // JS core
  "./js/db.js",
  "./js/language.js",
  "./js/main.js",
  "./js/orders.js",
  "./js/products.js",
  "./js/borrowers.js",
  "./js/statistics.js",
  "./js/import_export.js",

  // JS UI
  "./ui/orders_ui.js",
  "./ui/products_ui.js",
  "./ui/borrowers_ui.js",
  "./ui/statistics_ui.js",

  // Languages
  "./languages/en.json",
  "./languages/fr.json",
  "./languages/ar.json",

  // Assets
  "./assets/store-scanner-beep-90395.mp3",

  // Icons
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",

  // Libraries
  "./libs/sql-wasm.js",
  "./libs/sql-wasm.wasm",
  "./libs/chart.umd.min.js",
  
  // Manifest (added from your file list)
  "./manifest.json",

  // README.md (added if you want to cache this too, though generally not needed for offline functionality)
  // "./README.md", 

  // Python files and .vscode files are typically not cached for a web application service worker.
  // They are development/backend files and not served to the client for offline use.
  // Similarly, .swp files are temporary swap files and should not be cached.
];

// Install: cache all files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, then network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // File is in cache → serve it
        return response;
      }

      // If it's a navigation request and not in cache, try network, then fallback to index.html if offline
      if (event.request.mode === "navigate") {
        return fetch(event.request).catch(() => {
          return caches.match("./index.html"); // Fallback for navigation if offline
        });
      }

      // For other requests (scripts, images, etc.), try network, no specific fallback other than browser's default
      return fetch(event.request).catch(() => {
        // You could add a generic offline page or image here if needed for non-navigation requests
        // For example:
        // if (event.request.destination === 'image') {
        //   return caches.match('/offline.png');
        // }
      });
    })
  );
});