const C = "hover-v1";
self.addEventListener("install", e => e.waitUntil(caches.open(C).then(c => c.addAll(["./","./index.html","./driver.js","./hover.js","./hover.wasm","./hover.data","./manifest.webmanifest","./assets/icon-192.png","./assets/icon-512.png"]))));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))));
self.addEventListener("fetch", e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
