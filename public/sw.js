/* Fate v6 — Service Worker
 * Strategy:
 *  - Navigations:  network-first → cached app shell ("/") → built-in offline HTML
 *  - JS/CSS:       network-first → cache fallback (stale-safe in dev)
 *  - Immutable assets (icons/manifest/fonts/images): cache-first → network
 *  - Everything else: network passthrough
 */
const VERSION = "fate-v6-v1.2.0";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/apple-touch-icon.png",
];

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Fate v6 — Offline</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0c0a09;color:#f5b84a;font-family:Georgia,serif;text-align:center;padding:24px}
  .ring{width:88px;height:88px;border:6px solid #f5b84a;border-radius:50%;margin:0 auto 20px;
        display:flex;align-items:center;justify-content:center;color:#fff4e0;font-size:34px}
  h1{font-size:26px;margin:0 0 8px}p{color:#d6c9a8;max-width:34ch;margin:0 auto;line-height:1.6}
</style></head>
<body><div><div class="ring">◆</div>
<h1>The threads are unreachable</h1>
<p>Fate v6 could not reach the network, and this page was not cached yet. Reconnect once and the app shell will be stored for next time.</p>
</div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failing asset must not break installation.
      await Promise.allSettled(
        PRECACHE_URLS.map((u) =>
          cache.add(new Request(u, { cache: "reload" }))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      // Tell every open tab that the app shell is stored → offline-ready.
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      for (const client of clients) {
        client.postMessage({ type: "OFFLINE_READY", version: VERSION });
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never intercept dev-server hot reload traffic.
  if (
    url.pathname.includes("hot-update") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs")
  ) {
    return;
  }

  // --- Navigations: network-first, fall back to cached shell ---
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const shell = await caches.open(SHELL_CACHE);
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            // Cache the canonical shell under "/" so offline navigations resolve.
            shell.put("/", fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          return (
            (await shell.match("/")) ||
            (await shell.match(req)) ||
            new Response(OFFLINE_HTML, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // --- Static assets ---
  // JS/CSS change between deploys (and during dev): network-first with cache fallback.
  // Icons/manifest/fonts are effectively immutable: cache-first.
  const isJsCss = url.pathname.startsWith("/_next/static") || /\.(css|js)$/i.test(url.pathname);
  const isImmutable =
    (url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.json" ||
      url.pathname === "/apple-touch-icon.png" ||
      /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname)) &&
    !isJsCss;

  if (isJsCss || isImmutable) {
    event.respondWith(
      (async () => {
        const runtime = await caches.open(RUNTIME_CACHE);
        const shell = await caches.open(SHELL_CACHE);
        const cached = (await runtime.match(req)) || (await shell.match(req));
        if (isImmutable && cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) runtime.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          if (cached) return cached;
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })()
    );
  }
  // Anything else: default network behaviour (no interception).
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
