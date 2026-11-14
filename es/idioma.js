/* Shared Spanish-language preference and persistent English switcher for /es pages. */
(function () {
  'use strict';
  try { localStorage.setItem('423lang', 'es'); } catch (e) {}
  document.documentElement.setAttribute('lang', 'es');
  ['googtrans=;path=/;max-age=0;SameSite=Lax','googtrans=;path=/;domain=423.news;max-age=0;SameSite=Lax','googtrans=;path=/;domain=.423.news;max-age=0;SameSite=Lax'].forEach(function (cookie) { document.cookie = cookie; });
  var map = {'/es/':'/?lang=en','/es/index.html':'/?lang=en','/es/noticias.html':'/news.html?lang=en','/es/trafico.html':'/traffic.html?lang=en','/es/deportes.html':'/index.html?lang=en#/sports','/es/comunidad.html':'/community.html?lang=en','/es/eventos.html':'/events.html?lang=en','/es/claudia.html':'/live-wire.html?lang=en','/es/live-wire.html':'/live-wire.html?lang=en','/es/reporte.html':'/news.html?lang=en'};
  function addSwitcher() {
    if (!document.body || document.getElementById('es423-switch')) return;
    var style=document.createElement('style');
    style.textContent='#es423-switch{position:fixed;right:14px;bottom:14px;z-index:9999;padding:10px 15px;border:1px solid #ff5a0a;border-radius:999px;background:#08111d;color:#fff;font:700 13px system-ui,sans-serif;text-decoration:none;box-shadow:0 5px 20px #0008}#es423-switch:focus-visible{outline:3px solid #ffc078;outline-offset:3px}@media(max-width:720px){#es423-switch{bottom:calc(14px + env(safe-area-inset-bottom,0px))}}';
    document.head.appendChild(style);
    var link=document.createElement('a');link.id='es423-switch';link.href=map[location.pathname]||'/welcome.html';link.lang='en';link.textContent='🌐 English';link.setAttribute('aria-label','Switch to the English version');
    link.addEventListener('click',function(){try{localStorage.setItem('423lang','en')}catch(e){}});
    document.body.appendChild(link);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addSwitcher,{once:true});else addSwitcher();
})();