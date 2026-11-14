/* Veldbrein service worker — offline app-shell cache.
 *
 * - De SPEELPAGINA (index.html / navigaties) komt NETWERK-EERST: online krijg je altijd
 *   de nieuwste versie; zonder (of met heel traag) netwerk valt hij terug op de cache.
 *   (Vroeger was dat cache-eerst: een geïnstalleerde gsm-app bleef dan op de oude
 *   versie hangen tot je hem twee keer volledig afsloot.)
 * - Beelden/iconen komen CACHE-EERST (snel + offline op het veld), met verversing op
 *   de achtergrond.
 * - Bij het installeren wordt alles opgehaald met cache:'reload', zodat de HTTP-cache
 *   van GitHub Pages (max-age 600) geen oude bestanden in de nieuwe cache stopt.
 * REGEL: bij elke nieuwe versie CACHE ophogen (build.php toont dat nummer in de app).
 */
var CACHE = 'veldbrein-v27';
var ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png',
  'assets/field-bg-portrait.jpeg',
  'assets/field-bg.png',
  'assets/field-clay.jpeg',
  'assets/field-turf.jpeg',
  'assets/field-avond.jpeg',
  'assets/field-winter.jpeg',
  'assets/field-tijgers.jpeg'
];
var NET_TIMEOUT_MS = 4000;   // trager dan dit (slecht bereik op het veld) -> cache

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isPage(req) {
  if (req.mode === 'navigate') return true;
  var p = new URL(req.url).pathname;
  return /\/$/.test(p) || /\/index\.html$/.test(p);
}

// Netwerk-eerst voor de speelpagina, met tijdslimiet en terugval op de cache.
function pageFromNetwork(req) {
  var key = new URL(req.url).pathname.replace(/[^/]*$/, '') + 'index.html';
  var net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
    if (res && res.status === 200) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(key, copy); });
    }
    return res;
  });
  var timeout = new Promise(function (resolve) {
    setTimeout(function () {
      caches.match(key).then(function (hit) { if (hit) resolve(hit); });
    }, NET_TIMEOUT_MS);
  });
  return Promise.race([net, timeout]).catch(function () {
    return caches.match(key).then(function (hit) { return hit || Response.error(); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf(self.location.origin) !== 0) return;   // bv. de databank: niet aankomen
  if (isPage(req)) { e.respondWith(pageFromNetwork(req)); return; }

  var isAsset = req.url.indexOf('/assets/') !== -1 || req.url.indexOf('/icons/') !== -1;
  e.respondWith(
    caches.match(req).then(function (hit) {
      function netwerk() {
        return fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      }
      if (hit) {
        // Beelden: cache-first mét verversing op de achtergrond, zodat een
        // vervangen beeld (zelfde bestandsnaam) bestaande spelers toch bereikt.
        if (isAsset) netwerk().catch(function () {});
        return hit;
      }
      return netwerk().catch(function () { return Response.error(); });
    })
  );
});
