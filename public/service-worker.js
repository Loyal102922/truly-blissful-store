const CACHE_NAME = 'truly-blissful-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json'
];

// Install — cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', event => {

  // Skip non-GET requests and API calls
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/create-checkout-session') ||
    event.request.url.includes('/products') ||
    event.request.url.includes('/reviews') ||
    event.request.url.includes('/contact') ||
    event.request.url.includes('/newsletter') ||
    event.request.url.includes('stripe.com') ||
    event.request.url.includes('google.com') ||
    event.request.url.includes('googletagmanager.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {

        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});