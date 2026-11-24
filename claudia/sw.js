const CACHE='claudia-chat-v2';
const SHELL=['./','./manifest.webmanifest','./claudia-icon.svg','/apple-touch-icon.png','/claudia-livekit.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('claudia-chat-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.includes('/voice/'))return;
 e.respondWith(fetch(req).then(res=>{if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req).then(hit=>hit|| (req.mode==='navigate'?caches.match('./'):new Response('',{status:504}))));
});