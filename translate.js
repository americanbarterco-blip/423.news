/* 423.news language switcher.
   This intentionally does NOT use Google's retired Website Translator widget.
   It links visitors to maintained, crawlable Spanish/English pages instead. */
(function () {
  'use strict';
  if (window.__t423LanguageSwitch) return;
  window.__t423LanguageSwitch = true;
  if (window.top !== window.self) return;

  var KEY = '423lang';
  if (new URLSearchParams(location.search).get('lang') === 'en') {
    try { localStorage.setItem(KEY, 'en'); } catch (e) {}
  }
  var spanish = location.pathname === '/es' || location.pathname.indexOf('/es/') === 0;
  var toSpanish = {
    '/': '/es/',
    '/index.html': '/es/',
    '/news.html': '/es/noticias.html',
    '/traffic.html': '/es/trafico.html',
    '/sports.html': '/es/deportes.html',
    '/community.html': '/es/comunidad.html',
    '/events.html': '/es/eventos.html',
    '/live-wire.html': '/es/claudia.html'
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
    '/es/live-wire.html': '/live-wire.html?lang=en'
  };

  var target = (spanish ? toEnglish[location.pathname] : toSpanish[location.pathname]) || '/welcome.html';
  function save(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }

  var css = document.createElement('style');
  css.textContent = [
    '#t423{position:fixed;right:18px;bottom:18px;z-index:70;display:inline-flex;align-items:center;gap:7px;',
    'padding:10px 15px;border-radius:999px;border:1px solid #ff5a0a;background:rgba(5,11,18,.96);color:#fff;',
    'font:700 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.02em;cursor:pointer;',
    'box-shadow:0 8px 26px rgba(0,0,0,.45);text-decoration:none;-webkit-tap-highlight-color:transparent}',
    '#t423:hover{background:#ff5a0a}',
    '#t423:focus-visible{outline:3px solid #ffa51f;outline-offset:2px}',
    '@media(max-width:720px){#t423{right:12px;bottom:calc(66px + env(safe-area-inset-bottom,0px));padding:9px 13px;font-size:12px}}',
    '@media print{#t423{display:none}}'
  ].join('');
  document.head.appendChild(css);

  function boot() {
    var btn = document.createElement('a');
    btn.id = 't423';
    btn.href = target;
    btn.lang = spanish ? 'en' : 'es';
    btn.setAttribute('aria-label', spanish ? 'Cambiar a inglés' : 'Switch to Spanish');
    btn.textContent = spanish ? '🌐 English' : '🌐 Español';
    btn.addEventListener('click', function () { save(spanish ? 'en' : 'es'); });
    document.body.appendChild(btn);
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
