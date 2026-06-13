const CACHE = 'gkhub-v2';

const PRECACHE = [
  './',
  './index.html',
  './icon.svg',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
];

// ── Install: pre-cache static assets ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Firebase RTDB: network-only, never cache
  if (url.hostname.includes('firebaseio.com')) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify(null), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Google Fonts CSS: network-first, fall back to cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache-first, update in background
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res.ok && req.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => null);

      // Return cached immediately; if none, wait for network
      return cached || fetchPromise.then(res => {
        if (res) return res;
        // Offline fallback for navigation
        if (req.destination === 'document') return caches.match('./index.html');
        return new Response('', { status: 503 });
      });
    })
  );
});

// ── Background sync message handler ───────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
