// Service worker — az app váza (HTML/CSS/JS/ikonok) gyorsítótárból tölt,
// így a betöltés gyors; a háttérben frissül a legújabb verzióra.
// A Firebase-kéréseket (más domain) egyáltalán nem érinti.
const CACHE = "munkaora-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Csak a saját fájljainkat kezeljük; a Firebase (más domain) menjen közvetlenül.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate: azonnal a gyorsítótárból, közben frissít a háttérben.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
