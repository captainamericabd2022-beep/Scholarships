const OFFLINE_SHELL = "/offline.html";
self.addEventListener("install", (event) => event.waitUntil(caches.open("scholarship-public-v1").then((cache) => cache.addAll([OFFLINE_SHELL, "/favicon.svg"]))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_PUBLIC_SNAPSHOT" || !Array.isArray(event.data.scholarships)) return;
  const safe = event.data.scholarships.slice(0, 500).map(({ id, shortName, country, opens, deadline, officialNoticeUrl }) => ({ id, shortName, country, opens, deadline, officialNoticeUrl }));
  event.waitUntil(caches.open("scholarship-public-v1").then((cache) => cache.put("/offline-data.json", new Response(JSON.stringify({ savedAt: new Date().toISOString(), scholarships: safe }), { headers: { "content-type": "application/json" } }))));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_SHELL)));
});
