// Jocular Insights' service worker (17 Oct 2026): what makes the site an
// installable app that opens at once, and opens its frame offline.
//
// It never touches /api/: market data, accounts, watchlists and alerts always
// come from the server, never from a copy on the phone. Pages go to the
// network first (a deploy shows at once) and fall back to the last copy
// offline; the built files carry a hash in their names and never change, so
// they come from the copy first. Bump VERSION to drop every copy. A page
// that gets the host's 502 during a deploy opens from the copy too.
const VERSION = "v7"; // v3: the glass JI logo; v4: its header pictures (21 Oct 2026); v5: the mark without its tile (22 Oct); v6: the white JI site icon (27 Oct); v7: the same JI filling its circle, to show in a tab (31 Oct)
const SHELL = `jocular-shell-${VERSION}`, ASSETS = `jocular-assets-${VERSION}`;
const KEEP_ASSETS = 80; // a few deploys' worth; the oldest go first

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL)
    .then(cache => cache.addAll(["/", "/manifest.webmanifest", "/jocular-insights-dark.png", "/jocular-insights-light.png", "/favicon-96.png", "/icons/icon-192.png"]))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("jocular-") && k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - KEEP_ASSETS))) await cache.delete(key);
}

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then(async res => {
      // A stock address has its own title and crawlable summary; never save
      // that HTML as the offline home shell.
      if (url.pathname === "/" && res.ok && (res.headers.get("content-type") ?? "").includes("text/html")) {
        const copy = res.clone();
        caches.open(SHELL).then(cache => cache.put("/", copy));
      }
      // While a deploy swaps the server, Render answers with its own 502
      // page for 20–30 s: the last copy of the app opens instead, and its
      // requests wait the swap out (src/api.js)
      if (res.status === 502 || res.status === 503 || res.status === 504) return (await caches.match("/")) ?? res;
      return res;
    }).catch(async () => (await caches.match("/")) ?? Response.error()));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.match(req).then(hit => hit ?? fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(ASSETS).then(cache => cache.put(req, copy).then(() => trim(cache)));
      }
      return res;
    })));
    return;
  }

  // the rest (the logo, the icons): the network, and the installed copy when
  // offline — without this the copies made at install were never handed back
  event.respondWith(fetch(req).catch(async () => (await caches.match(req)) ?? Response.error()));
});
