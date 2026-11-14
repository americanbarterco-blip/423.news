/* 423.news native bilingual navigation. No third-party page translation widget. */
(function () {
  'use strict';
  if (window.__t423LanguageSwitch) return;
  window.__t423LanguageSwitch = true;
  if (window.top !== window.self) return;

  var KEY = '423lang';
  var spanish = location.pathname === '/es' || location.pathname.indexOf('/es/') === 0;
  var params = new URLSearchParams(location.search);
  if (params.get('lang') === 'en') { try { localStorage.setItem(KEY, 'en'); } catch (e) {} }
  if (params.get('lang') === 'es') { try { localStorage.setItem(KEY, 'es'); } catch (e) {} }

  var toSpanish = {
    '/': '/es/',
    '/index.html': '/es/',
    '/news.html': '/es/noticias.html',
    '/report.html': '/es/reporte.html',
    '/traffic.html': '/es/trafico.html',
    '/sports.html': '/es/deportes.html',
    '/community.html': '/es/comunidad.html',
    '/events.html': '/es/eventos.html',
    '/live-wire.html': '/es/claudia.html',
    '/claudia-scanner.html': '/es/claudia.html'
  };
  var toEnglish = {
    '/es/': '/index.html?lang=en#/home',
    '/es/index.html': '/index.html?lang=en#/home',
    '/es/noticias.html': '/news.html?lang=en',
    '/es/trafico.html': '/traffic.html?lang=en',
    '/es/deportes.html': '/index.html?lang=en#/sports',
    '/es/comunidad.html': '/community.html?lang=en',
    '/es/eventos.html': '/events.html?lang=en',
    '/es/claudia.html': '/live-wire.html?lang=en',
    '/es/live-wire.html': '/live-wire.html?lang=en',
    '/es/reportes.html': '/news.html?lang=en',
    '/es/reporte.html': '/report.html?lang=en'
  };
  var hash = location.hash || '';
  var hashMap = {
    '#/home':'/es/','#/news':'/es/noticias.html','#/alerts':'/es/noticias.html',
    '#/sports':'/es/deportes.html','#/scores':'/es/deportes.html',
    '#/community':'/es/comunidad.html','#/events':'/es/eventos.html',
    '#/forecast':'/es/trafico.html','#/government':'/es/noticias.html'
  };
  var target = spanish
    ? (toEnglish[location.pathname] || '/welcome.html')
    : ((location.pathname === '/' || location.pathname === '/index.html')
        ? (hashMap[hash] || '/es/')
        : (toSpanish[location.pathname] || '/welcome.html'));

  var css = document.createElement('style');
  css.textContent = '#t423{position:fixed;right:18px;bottom:18px;z-index:9999;display:inline-flex;align-items:center;padding:10px 15px;border-radius:999px;border:1px solid #ff5a0a;background:rgba(5,11,18,.97);color:#fff;font:700 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.45);text-decoration:none}#t423:hover{background:#ff5a0a}#t423:focus-visible{outline:3px solid #ffa51f;outline-offset:2px}@media(max-width:720px){#t423{right:12px;bottom:calc(66px + env(safe-area-inset-bottom,0px));padding:9px 13px;font-size:12px}}@media print{#t423{display:none}}';
  document.head.appendChild(css);
  function boot() {
    if (document.getElementById('t423')) return;
    var btn=document.createElement('a');
    btn.id='t423';btn.href=target;btn.lang=spanish?'en':'es';
    btn.setAttribute('aria-label',spanish?'Cambiar a inglés':'Switch to Spanish');
    btn.textContent=spanish?'🌐 English':'🌐 Español';
    btn.addEventListener('click',function(){try{localStorage.setItem(KEY,spanish?'en':'es')}catch(e){}});
    document.body.appendChild(btn);
  }
  if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();