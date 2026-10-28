// AMS service worker — offline support for the Stock Take scan page only.
// - /_next/static and fonts: cache-first (file names are content-hashed)
// - /audits/{id}/scan documents: network-first, fall back to the cached copy when offline
// - everything else (APIs, other pages): untouched, always network
const CACHE = "ams-stocktake-v1";
const SCAN_PAGE = /^\/audits\/[^/]+\/scan\/?$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("ams-stocktake-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// The page reports what it loaded before this worker took control, so the first visit is cached too.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        event.data.urls.map(async (u) => {
          try {
            const url = new URL(u, self.location.origin);
            if (url.origin !== self.location.origin) return;
            if (!url.pathname.startsWith("/_next/static/") && !SCAN_PAGE.test(url.pathname) && !/\.woff2?$/.test(url.pathname)) return;
            if (await cache.match(url.href)) return;
            const res = await fetch(url.href, { credentials: "same-origin" });
            if (res.ok && !res.redirected) await cache.put(url.href, res);
          } catch {
            // ignore; best effort
          }
        }),
      );
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || /\.woff2?$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (req.mode === "navigate" && SCAN_PAGE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          // Do not cache the signin redirect
          if (res.ok && !res.redirected) cache.put(url.pathname, res.clone());
          return res;
        } catch {
          const hit = await cache.match(url.pathname);
          if (hit) return hit;
          return new Response("<!doctype html><meta charset=utf-8><title>ออฟไลน์</title><p style='font-family:sans-serif;padding:2rem'>ออฟไลน์ — กรุณาเปิดหน้าสแกนนี้ขณะออนไลน์อย่างน้อยหนึ่งครั้ง</p>", {
            status: 503,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
  }
});
