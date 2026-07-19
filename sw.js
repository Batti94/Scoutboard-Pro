// Minimal app-shell service worker.
//
// Network-first for the same-origin shell (index.html, manifest, icons):
// always prefer the latest deployed version when online (this app ships
// frequent fixes, especially around cloud sync — serving a stale cached
// index.html could silently reintroduce fixed bugs). The cache only kicks
// in as a fallback when the network request fails (offline, e.g. in a
// stadium with no signal), so the app can still open.
//
// Cross-origin requests (Supabase, the Supabase/html2canvas CDN scripts)
// are left untouched — same behavior as without a service worker.
const CACHE_NAME = 'scoutboard-shell-v1';
const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin requests pass through normally
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
  );
});
