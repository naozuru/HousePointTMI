const CACHE_NAME = 'tmi-points-v1';
const urlsToCache = [
  './',
  './index.html',
  './dashboard.html',
  './reports.html',
  './parent.html',
  './style.css',
  './config.js',
  './app.js',
  './dashboard.js',
  './reports.js',
  'https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});