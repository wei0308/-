// 離線快取：App 本體先用快取，行情 API 一律走網路
const VERSION = "v2";
const SHELL = ["./", "index.html", "styles.css", "app.js", "indicators.js", "sync.js", "manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"];

self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
