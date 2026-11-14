/* Veldbrein service worker — offline app-shell cache. */
// index.html is volledig zelfstandig (css + js inline); de veld-achtergronden
// horen in de precache zodat skins ook offline (op het veld) werken.
var CACHE = 'veldbrein-v26';
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

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var isAsset = req.url.indexOf('/assets/') !== -1;
  e.respondWith(
    caches.match(req).then(function (hit) {
      function netwerk() {
        return fetch(req).then(function (res) {
          if (res && res.status === 200 && req.url.indexOf(self.location.origin) === 0) {
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
      return netwerk().catch(function () {
        // Alleen navigaties op de app-shell laten terugvallen; een mislukt beeld
        // moet gewoon een fout geven zodat field.js zijn eigen fallback toont.
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
