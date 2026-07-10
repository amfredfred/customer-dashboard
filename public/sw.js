/**
 * Apex Quantel - Service Worker
 *
 * Strategy:
 *   - App shell (HTML, JS, CSS, fonts, icons) → Cache-first, update in background
 *   - API / WebSocket requests                → Network-only (never cached)
 *   - Everything else                         → Network-first with cache fallback
 *
 * This is intentionally minimal. The dashboard is a real-time trading app;
 * we only cache the shell so it loads instantly and is installable as a PWA.
 * Live data always comes from the network.
 */

const CACHE = "apex-shell-v1";

const SHELL = [
  "/app/signals",
  "/app/execution",
  "/icon.png",
  "/manifest.json",
];

/* ── Install: cache the app shell ─────────────────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

/* ── Activate: remove old caches ──────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: routing strategy ──────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept WebSocket upgrades or non-GET requests
  if (request.method !== "GET") return;

  // Never cache gateway API calls or Supabase requests
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("somicast.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // let the browser handle it
  }

  // App shell and static assets: cache-first
  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // HTML navigation: network-first, fall back to cached shell
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }
});
