const CACHE='claudia-chat-v5';
const SHELL=['./','./index.html','./manifest.webmanifest','./claudia-icon.svg','./claudia-icon-192.png','./claudia-icon-512.png','/claudia-livekit.js','/offline.html'];
/* Cache independently: a missing optional asset must not block installation. */
self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>Promise.all(SHELL.map(path=>cache.add(path).catch(()=>undefined))))
      .then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('claudia-chat-')&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname.includes('/voice/')||url.pathname.startsWith('/api/'))return;
  if(request.headers.has('range')||/\.(mp4|mp3|m4a|wav|ogg|webm)$/i.test(url.pathname))return;
  event.respondWith(
    fetch(request).then(response=>{
      if(response.ok&&response.type==='basic'){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
      }
      return response;
    }).catch(()=>caches.match(request).then(cached=>{
      if(cached)return cached;
      return request.mode==='navigate'
        ? caches.match('./index.html').then(page=>page||caches.match('/offline.html'))
        : new Response('',{status:504});
    }))
  );
});