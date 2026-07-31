// TMI House Points Service Worker v2.1
const CACHE_NAME = 'tmi-points-v3';
const APP_VERSION = '2.1.0';

const urlsToCache = [
  './',
  './index.html',
  './dashboard.html',
  './reports.html',
  './parent.html',
  './style.css',
  './config.js',
  './shared.js',
  './app.js',
  './dashboard.js',
  './reports.js',
  './parent.js',
  './manifest.json',
  'https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js'
];

// Install - cache all assets
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('Cache install failed:', err))
  );
});

// Activate - clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - cache-first with network fallback
self.addEventListener('fetch', e => {
  // Skip non-GET requests entirely (don't even call fetch)
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Only handle http(s) — skip chrome-extension://, data:, blob:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Don't intercept API requests — let them go straight to network
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('flaticon.com') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    return;
  }

  // For navigation requests, try network first, fall back to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Only cache successful, basic/cors responses with http(s) URLs
          if (res && res.status === 200 && res.type !== 'opaque') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // For other requests, cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Only cache http(s) successful basic/cors responses
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Listen for messages from app to skip waiting
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});