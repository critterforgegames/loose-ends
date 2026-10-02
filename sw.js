const VERSION = "92d8b91250";
const FILES = ["./", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "js/audio.js", "js/fx.js", "js/game.js", "js/i18n.js", "js/lang/de.js", "js/lang/en.js", "js/lang/es.js", "js/lang/fr.js", "js/lang/hi.js", "js/lang/id.js", "js/lang/it.js", "js/lang/pl.js", "js/lang/pt.js", "js/lang/ru.js", "js/lang/tr.js", "js/lang/uk.js", "js/level.js", "js/main.js", "js/platform.js", "js/progress.js", "js/render.js", "js/screens.js", "js/themes.js", "manifest.webmanifest"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/tg/")) return;
  // Сначала сеть (всегда свежая версия), кэш - только без интернета.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
