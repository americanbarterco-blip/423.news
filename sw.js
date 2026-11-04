/* 423.news service worker — makes the site installable and gives a friendly offline page.
   Safe by design: pages, scripts and data are always fetched fresh from the network first,
   so new uploads show up right away. Nothing from Supabase or other sites is touched.
   Bump VERSION to force every phone to drop old cached files. */
var VERSION = 'v5';
var CACHE = '423news-' + VERSION;
var PRECACHE = ['offline.html', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('423news-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;          /* never touch other sites or writes */
  if (req.headers.has('range') || /\.(mp4|mp3|m4a|wav|ogg|webm)$/i.test(url.pathname)) return;   /* let video/audio stream normally */
  if (/\/(voice)\//.test(url.pathname)) return;

  /* network first for everything, copy kept as a fallback for offline */
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('offline.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

/* ---------- push notifications ---------- */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '423.news', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined,
    requireInteraction: !!d.urgent, renotify: !!(d.urgent && d.tag), vibrate: d.urgent ? [300, 150, 300, 150, 600] : undefined,
    data: { url: d.url || 'index.html' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = new URL((e.notification.data && e.notification.data.url) || 'index.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) {
        if ('navigate' in list[i]) list[i].navigate(target);
        return list[i].focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
