/* Claudia Green visual + function refresh for 423.news.
   Additive module: preserves the existing live-wire engines and routes. */
(function(){
  'use strict';
  if(document.getElementById('cg-refresh')) return;
  var style=document.createElement('style');
  style.textContent=`
  #cg-refresh{--ink:#eaf5ff;--muted:#8faac3;--line:#203b55;--panel:#081b2d;--cyan:#32d4ff;--red:#ff385b;--blue:#1677d2;color:var(--ink);margin:0 0 16px}
  #cg-refresh *{box-sizing:border-box}
  #cg-refresh .cgx-head{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px;align-items:end;border:1px solid #174361;border-radius:18px;padding:16px 16px 0;background:radial-gradient(ellipse at 15% 60%,#0c4864 0,#071c30 48%,#020913 100%);overflow:hidden}
  #cg-refresh .cgx-body{padding-bottom:16px;align-self:center}
  #cg-refresh .cgx-portrait{position:relative;display:flex;align-items:flex-end;justify-content:center;min-height:320px;margin-bottom:0}
  #cg-refresh .cgx-portrait:before{content:'';position:absolute;left:8%;right:8%;bottom:0;height:70%;background:radial-gradient(ellipse at 50% 100%,#32d4ff55 0,#32d4ff00 70%)}
  #cg-refresh .cgx-portrait img{position:relative;display:block;width:auto;max-width:100%;height:auto;max-height:420px;filter:drop-shadow(0 10px 22px #000a)}
  #cg-refresh .cgx-portrait span{position:absolute;bottom:9px;left:0;font:700 11px system-ui;background:#020c18cc;padding:5px 8px;border-radius:8px;color:#e8f7ff}
  #cg-refresh .cgx-gallery{display:grid;grid-template-columns:minmax(0,340px) repeat(2,minmax(0,1fr));grid-auto-rows:340px;gap:10px;margin-top:10px}
  #cg-refresh .cgx-gallery figure{margin:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#061421;position:relative}
  #cg-refresh .cgx-gallery img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 8%}
  #cg-refresh .cgx-gallery figcaption{position:absolute;left:8px;bottom:8px;font:700 11px system-ui;background:#020c18cc;padding:4px 8px;border-radius:8px;color:#e8f7ff}
  #cg-refresh .cgx-kicker{font:800 11px system-ui;letter-spacing:.18em;color:var(--cyan);text-transform:uppercase}
  #cg-refresh h2{margin:5px 0 3px;font:italic 34px Georgia,serif;letter-spacing:-.04em}
  #cg-refresh .cgx-sub{color:#d2e8f6;font-weight:700}
  #cg-refresh .cgx-desc{color:var(--muted);line-height:1.55;margin:10px 0}
  #cg-refresh .cgx-status{display:inline-flex;align-items:center;gap:7px;border:1px solid #26536b;background:#061727;border-radius:30px;padding:6px 10px;font-size:12px}
  #cg-refresh .cgx-dot{width:8px;height:8px;background:#f2a33b;border-radius:50%;box-shadow:0 0 10px #f2a33b}
  #cg-refresh .cgx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
  #cg-refresh .cgx-card{background:linear-gradient(160deg,#0b2034,#061421);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}
  #cg-refresh .cgx-card h3{margin:0 0 7px;font-size:14px}
  #cg-refresh .cgx-card p{margin:0;color:var(--muted);font-size:12.5px;line-height:1.5}
  #cg-refresh .cgx-icon{font-size:21px;margin-bottom:8px}
  #cg-refresh .cgx-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  #cg-refresh a.cgx-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;border:1px solid #276080;background:#09233a;color:#eaf5ff;border-radius:10px;padding:9px 12px;text-decoration:none;font:700 12px system-ui}
  #cg-refresh a.cgx-btn.primary{background:linear-gradient(90deg,#087bb5,#1265b9);border-color:#19a9e5}
  #cg-refresh a.cgx-btn:hover{filter:brightness(1.15)}
  #cg-refresh .cgx-note{margin-top:10px;padding:10px 12px;border-left:3px solid #f0a443;background:#071725;color:#a9bed0;font-size:12px;line-height:1.5}
  @media(max-width:680px){#cg-refresh .cgx-head{grid-template-columns:120px minmax(0,1fr);padding:10px 10px 0;gap:10px}#cg-refresh .cgx-portrait{min-height:190px}#cg-refresh .cgx-portrait img{max-height:240px}#cg-refresh .cgx-gallery{grid-template-columns:1fr 1fr;grid-auto-rows:auto}#cg-refresh .cgx-gallery figure{height:240px}#cg-refresh .cgx-gallery figure:first-child{grid-column:1/-1;height:auto}#cg-refresh .cgx-gallery figure:first-child img{height:auto}#cg-refresh h2{font-size:27px}#cg-refresh .cgx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#cg-refresh .cgx-card{padding:11px}}
  @media(max-width:420px){#cg-refresh .cgx-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  var section=document.createElement('section');
  section.id='cg-refresh';
  section.innerHTML=`
   <div class="cgx-head">
    <div class="cgx-portrait"><img src="/claudia-fullbody-v2.png" alt="Claudia Green, 423.news newsroom assistant" width="382" height="1200" loading="eager"><span>423.news</span></div>
    <div class="cgx-body">
     <div class="cgx-kicker">423.news • newsroom intelligence</div>
     <h2>Claudia Green</h2>
     <div class="cgx-sub">Newsroom Assistant · Local Research · Live Wire</div>
     <p class="cgx-desc">Scanning public sources, finding community leads, researching stories, gathering media context, and preparing private drafts for editorial review.</p>
     <span class="cgx-status"><span class="cgx-dot"></span>Pipeline status is verified separately</span>
     <div class="cgx-actions"><a class="cgx-btn primary" href="claudia-review.html">Open Story &amp; Media Review</a><a class="cgx-btn" href="index.html#/news">Newsroom homepage</a></div>
    </div>
   </div>
   <div class="cgx-gallery">
    <figure><img src="/claudia-card-v2.jpg" alt="Claudia Green, Newsroom Assistant: live reports, video updates, weather, sports, traffic and community" loading="lazy"></figure>
    <figure><img src="/claudia-full-1-v2.jpg" alt="Claudia Green in the 423.news studio" loading="lazy"><figcaption>In the studio</figcaption></figure>
    <figure><img src="/claudia-full-2-v2.jpg" alt="Claudia Green on the 423.news set" loading="lazy"><figcaption>On set</figcaption></figure>
   </div>
   <div class="cgx-grid">
    <article class="cgx-card"><div class="cgx-icon">🛰️</div><h3>Public-source discovery</h3><p>Official feeds, local government, schools, public agencies, community organizations and neighborhood reporting leads.</p></article>
    <article class="cgx-card"><div class="cgx-icon">🗣️</div><h3>Community signals</h3><p>Social posts, discussion boards, Reddit, video platforms and community tips treated as leads—not verified facts.</p></article>
    <article class="cgx-card"><div class="cgx-icon">🔎</div><h3>Research &amp; evidence</h3><p>Source checking, corroboration, local relevance, timelines and uncertainty notes before drafting.</p></article>
    <article class="cgx-card"><div class="cgx-icon">📝</div><h3>Private story drafts</h3><p>Research-backed story drafts stay in the private queue for human editorial review. Nothing here auto-publishes.</p></article>
    <article class="cgx-card"><div class="cgx-icon">🎥</div><h3>Image &amp; video intake</h3><p>Staged media includes source, credit, rights basis, caption and accessibility text before approval.</p></article>
    <article class="cgx-card"><div class="cgx-icon">📡</div><h3>Live area intelligence</h3><p>Weather, traffic, public safety signals and local activity—clearly labeled developing or confirmed.</p></article>
   </div>
   <div class="cgx-note">Editorial safeguards: community posts and scanner activity are leads only. Claudia does not publish automatically; verify claims and media rights before approval.</div>`;
  var main=document.querySelector('main');
  if(main) main.insertBefore(section,main.firstChild);
})();