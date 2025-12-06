const CACHE_NAME = 'minimemo-v3';

// Only cache the shell files initially. 
// Vite generates hashed filenames for JS/CSS (e.g., index-A1b2.js), so we can't hardcode them here.
// We will cache them dynamically in the fetch event.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. External dependencies (Tailwind CDN, Fonts) - Stale While Revalidate
  if (url.hostname.includes('tailwindcss.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if(networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 2. Local Assets (JS, CSS, HTML) - Cache First, Fallback to Network
  // This handles the Vite-generated assets (e.g. /assets/index-xyz.js)
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache valid responses from our own origin
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Clone the response because it's a stream and can only be consumed once
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});