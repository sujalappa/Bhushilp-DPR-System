// Service worker: keeps the app itself (the page, its scripts and styles,
// the icons) on the phone so it opens with no signal. Data is not handled
// here — /api requests pass straight through, and the app keeps its own
// copy of what the forms need (src/offline/).
//
// The page is fetched from the network first, so a phone with signal always
// gets the latest deploy; only when that fails, or takes too long
// underground, is the kept copy used.

const CACHE = 'dpr-app-v1';
const NAVIGATION_TIMEOUT_MS = 4000;
const STATIC_FILES = ['/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

// Files the page loads straight away, read from its HTML (Vite puts the
// hashed script, style and preload paths there).
const assetsIn = (html) =>
  [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);

// Keep this version of the page and its files; drop files only an older
// version used.
async function keepPage(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const assets = assetsIn(html);
  await cache.put('/index.html', response);
  const missing = [];
  for (const path of [...assets, ...STATIC_FILES]) if (!(await cache.match(path))) missing.push(path);
  await cache.addAll(missing);
  const keep = new Set(assets);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/index.html', { cache: 'no-store' })
      .then((res) => (res.ok ? keepPage(res) : undefined))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Any page of the app is the same single page (the router picks the
  // screen), so every navigation can fall back to the kept copy.
  if (request.mode === 'navigate') {
    const network = fetch(request);
    event.waitUntil(
      network.then((res) => (res.ok ? keepPage(res.clone()) : undefined)).catch(() => undefined)
    );
    event.respondWith(
      withTimeout(network, NAVIGATION_TIMEOUT_MS).catch(async () => {
        const kept = await caches.match('/index.html');
        return kept || network;
      })
    );
    return;
  }

  // Hashed files never change, so a kept copy is always right; anything
  // else kept is used only when the network fails.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (kept) =>
          kept ||
          fetch(request).then(async (res) => {
            if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
            return res;
          })
      )
    );
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(request).then((kept) => kept || Response.error())));
});
