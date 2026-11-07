/* Iron 75 offline support. Bump VERSION whenever you upload changed files. */
const VERSION = "iron75-v3.0.0";
const SHELL = ["./", "index.html", "styles.css", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "js/app.js", "js/config.js", "js/core.js", "js/food.js", "js/library.js", "js/nutrition.js", "js/store.js", "js/util.js", "js/views.js", "data/foods.json"];
const CDN = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Libraries and fonts: cache first (versioned URLs never change).
  if (CDN.includes(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase, food APIs: always live
  // The food database is large and rarely changes: cache first.
  if (url.pathname.endsWith("/data/foods.json")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
    return;
  }
  // App files: network first so updates arrive quickly; cache when offline.
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
});
