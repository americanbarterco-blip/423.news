/* Claudia Green local media launcher: profile/video saved in this browser's IndexedDB. */
(function(){
 if(window.__cgMediaWidget)return;window.__cgMediaWidget=true;
 const DB='cg_media_widget',STORE='assets';
 const db=()=>new Promise((resolve,reject)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const get=k=>db().then(d=>new Promise((resolve,reject)=>{let r=d.transaction(STORE).objectStore(STORE).get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}));
 const set=(k,v)=>db().then(d=>new Promise((resolve,reject)=>{let r=d.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);r.onsuccess=resolve;r.onerror=()=>reject(r.error)}));
 const remove=k=>db().then(d=>new Promise((resolve,reject)=>{let r=d.transaction(STORE,'readwrite').objectStore(STORE).delete(k);r.onsuccess=resolve;r.onerror=()=>reject(r.error)}));
 const style=document.createElement('style');style.textContent=`
 #cg-float{position:fixed;right:16px;bottom:82px;z-index:99999;font-family:system-ui}
 #cg-launch{width:62px;height:62px;border-radius:50%;overflow:hidden;border:2px solid #35d1eb;background:#08324b;color:#e8faff;font-weight:900;box-shadow:0 4px 20px #0008,0 0 18px #25c7e655;cursor:pointer}
 #cg-launch img{width:100%;height:100%;object-fit:cover}
 #cg-panel{display:none;position:absolute;right:0;bottom:72px;width:min(340px,calc(100vw - 22px));max-height:72vh;overflow:auto;padding:14px;border:1px solid #23617d;border-radius:16px;background:#071725;color:#e9f8ff;box-shadow:0 18px 48px #000a}
 #cg-panel.open{display:block}#cg-panel h3{margin:0 0 8px;font:italic 24px Georgia,serif}#cg-panel p{font-size:12px;color:#aec5d5;line-height:1.5}
 #cg-panel video{width:100%;max-height:270px;background:#000;border-radius:10px;margin:6px 0}
 #cg-panel .cg-actions{display:flex;flex-wrap:wrap;gap:8px}#cg-panel label,#cg-panel button,#cg-panel a{display:inline-block;background:#0c344c;border:1px solid #286987;border-radius:9px;color:#eefaff;padding:9px 10px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none}
 #cg-panel input{display:none}#cg-panel .cg-note{font-size:11px;color:#8ca9bc}
 #cg-media-profile{margin:12px 0;padding:14px;background:#071d2e;border:1px solid #24516b;border-radius:14px}
 #cg-media-profile img{width:auto;max-width:150px;max-height:230px;border-radius:12px;object-fit:contain}
 #cg-media-profile video{width:100%;max-height:280px;background:#000;border-radius:10px}
 @media(max-width:480px){#cg-float{right:12px;bottom:80px}#cg-launch{width:58px;height:58px}}`;document.head.appendChild(style);
 const root=document.createElement('div');root.id='cg-float';root.innerHTML='<div id="cg-panel" role="dialog" aria-label="Claudia profile"><h3>Claudia Green</h3><p>423.news · Newsroom assistant / Live Wire</p><div id="cg-video"></div><div class="cg-actions"><label>Choose portrait<input type="file" id="cg-photo" accept="image/*"></label><label>Choose video<input type="file" id="cg-clip" accept="video/*"></label></div><p class="cg-note">Media is saved privately in this browser on this device (not uploaded to the server).</p><div class="cg-actions"><button id="cg-clear-photo">Reset portrait</button><button id="cg-clear-clip">Remove video</button><a href="live-wire.html">Open Live Wire</a></div></div><button id="cg-launch" aria-label="Claudia Green floating icon">CG</button>';document.body.appendChild(root);
 const panel=root.querySelector('#cg-panel'),launch=root.querySelector('#cg-launch'),v=root.querySelector('#cg-video');let photoUrl,clipUrl;
 function release(){if(photoUrl)URL.revokeObjectURL(photoUrl);if(clipUrl)URL.revokeObjectURL(clipUrl);photoUrl=clipUrl=null}
 async function refresh(){release();const p=await get('portrait'),c=await get('clip');launch.innerHTML=p?(photoUrl=URL.createObjectURL(p),'<img alt="Claudia Green" src="'+photoUrl+'">'):'CG';v.innerHTML=c?(clipUrl=URL.createObjectURL(c),'<video controls playsinline preload="metadata" src="'+clipUrl+'"></video>'):'<p>No video installed yet. Choose your clip above.</p>'}
 launch.onclick=()=>{panel.classList.toggle('open');refresh()};document.addEventListener('click',e=>{if(!root.contains(e.target))panel.classList.remove('open')});
 root.querySelector('#cg-photo').onchange=async e=>{let f=e.target.files[0];if(f&&f.type.startsWith('image/')){await set('portrait',f);e.target.value='';refresh()}};
 root.querySelector('#cg-clip').onchange=async e=>{let f=e.target.files[0];if(f&&f.type.startsWith('video/')){await set('clip',f);e.target.value='';refresh()}};
 root.querySelector('#cg-clear-photo').onclick=async()=>{await remove('portrait');refresh()};root.querySelector('#cg-clear-clip').onclick=async()=>{await remove('clip');refresh()};
 if(location.pathname.endsWith('live-wire.html')){const add=async()=>{let main=document.querySelector('main')||document.body;if(!document.getElementById('cg-media-profile')){let s=document.createElement('section');s.id='cg-media-profile';s.innerHTML='<h3>Claudia Green · Profile Media</h3><p>Portrait and newsroom video</p><div id="cg-inline-portrait"></div><div id="cg-inline-clip"></div>';main.prepend(s)}let p=await get('portrait'),c=await get('clip');if(p){let el=document.getElementById('cg-inline-portrait'),u=URL.createObjectURL(p);el.innerHTML='<img alt="Claudia Green portrait" src="'+u+'"'+'>'}if(c){let el=document.getElementById('cg-inline-clip'),u=URL.createObjectURL(c);el.innerHTML='<video controls playsinline preload="metadata" src="'+u+'"></video>'}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add()}
 refresh();
})();