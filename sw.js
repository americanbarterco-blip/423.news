const V='423-cp-v1',SHELL=['./','manifest.json','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // Data: network first (freshness matters), fall back to last copy offline
  if(u.pathname.endsWith('checkpoints.json')){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return}
  e.respondWith(caches.match(e.request).then(m=>m||fetch(e.request)));
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data.json()}catch(_){d={title:'423.news',body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Checkpoint alert',{body:d.body||'',icon:'icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(e.notification.data.url))});
