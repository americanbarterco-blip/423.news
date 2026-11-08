/* 423.news — ad spaces. <script src="ads.js"></script> at the end of every page.
   Three slots: top (under the header), mid (in the content), bottom (above the footer).
   Ads are managed in Admin -> Ads: image upload, link, slot, size, timing, start/end dates, pause.
   Each ad shows for its own number of seconds, then the next one in that slot takes over.
   window.ADS_CFG may still supply fallback ads: { ads:{top:[{img,href,alt}],...}, contactUrl } (https only). */
(function () {
  'use strict';
  var SB_URL = 'https://kdiwehqtezlhecxsoysj.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkaXdlaHF0ZXpsaGVjeHNveXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDQzOTEsImV4cCI6MjEwNjIyMDM5MX0.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE'; /* public anon key. Row Level Security returns only live ads. */
  var CFG = Object.assign({ ads: { top: [], mid: [], bottom: [] }, contactUrl: 'mailto:ads@423.news' }, window.ADS_CFG || {});
  var SLOTS = ['top', 'mid', 'bottom'];
  var live = { top: [], mid: [], bottom: [] };
  /* Page key used for targeting. Other files use their file name (desk, claudia-scanner...).
     index.html is the app: its key is the section in the address, e.g. home, news, sports. */
  function pageKeys() {
    var f = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '') || 'index';
    if (f !== 'index') return [f];
    var r = (location.hash || '#/home').replace(/^#\/?/, '').split('/')[0] || 'home';
    return ['index', r];                 /* 'index' = every section of the app */
  }
  function here(a) {
    var p = String(a.pages || 'all');
    if (p === 'all') return true;
    var keys = pageKeys();
    return p.split(',').some(function (x) { return keys.indexOf(x.trim()) > -1; });
  }
  var pos = {}, timers = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function good(u) { return /^https:\/\//i.test(u || ''); }

  var css = document.createElement('style');
  css.textContent =
    '.ad-slot{max-width:1100px;margin:12px auto;padding:0 12px;text-align:center}' +
    '.ad-slot small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:4px}' +
    '.ad-box{display:grid;place-items:center;min-height:90px;border:1px dashed rgba(150,170,190,.45);border-radius:12px;overflow:hidden;background:rgba(150,170,190,.08)}' +
    '.ad-box.has{border-style:solid;border-color:transparent;background:none;min-height:0}' +
    '.ad-box img{display:block;max-width:100%;height:auto}' +
    '.ad-box video{background:#000}' +
    '.ad-box a{color:inherit;text-decoration:none;display:block}' +
    '.ad-box a.ad-ph{padding:20px;font-size:14px;font-weight:600}';
  document.head.appendChild(css);

  function normal(a) { return { pages: a.pages || 'all', kind: a.kind === 'video' ? 'video' : 'image', img: a.image_url || a.img, href: a.href, alt: a.alt, w: a.max_width || 0, h: a.height || 0, fit: a.fit || 'contain', secs: Math.max(3, a.seconds || 20) }; }
  function list(name) {
    var l = live[name].length ? live[name] : ((CFG.ads || {})[name] || []).map(normal);
    return l.filter(function (a) { return a && good(a.img) && good(a.href) && here(a); });
  }
  function paint(el) {
    var name = el.getAttribute('data-slot'), box = el.querySelector('.ad-box'), l = list(name);
    clearTimeout(timers[name]);
    if (!l.length) {
      box.className = 'ad-box';
      box.innerHTML = '<a class="ad-ph" href="' + esc(CFG.contactUrl) + '">Your ad here · Advertise on 423.news</a>';
      return;
    }
    pos[name] = pos[name] == null ? 0 : (pos[name] + 1) % l.length;
    var a = l[pos[name]];
    var style = (a.w ? 'width:' + a.w + 'px;' : '') + (a.h ? 'height:' + a.h + 'px;object-fit:' + a.fit + ';' : '');
    box.className = 'ad-box has';
    var media = a.kind === 'video'
      ? '<video src="' + esc(a.img) + '" autoplay muted loop playsinline preload="metadata" aria-label="' + esc(a.alt || 'Advertisement') + '" style="display:block;max-width:100%;' + (a.w ? 'width:' + a.w + 'px;' : 'width:100%;') + (a.h ? 'height:' + a.h + 'px;object-fit:' + a.fit + ';' : 'height:auto;') + '"></video>'
      : '<img src="' + esc(a.img) + '" alt="' + esc(a.alt || 'Advertisement') + '" style="' + style + '" loading="lazy">';
    box.innerHTML = '<a href="' + esc(a.href) + '" target="_blank" rel="sponsored noopener noreferrer">' + media + '</a>';
    if (l.length > 1) timers[name] = setTimeout(function () { if (el.isConnected) paint(el); }, a.secs * 1000);
  }
  function make(name) {
    var el = document.createElement('div');
    el.className = 'ad-slot'; el.setAttribute('data-slot', name);
    el.innerHTML = '<small>Advertisement</small><div class="ad-box"></div>';
    paint(el);
    return el;
  }
  function place() {
    if (!document.querySelector('[data-slot="top"]')) {
      var h = document.querySelector('header');
      if (h) h.insertAdjacentElement('afterend', make('top')); else document.body.insertBefore(make('top'), document.body.firstChild);
    }
    if (!document.querySelector('[data-slot="bottom"]')) {
      var f = document.querySelector('footer');
      if (f) f.insertAdjacentElement('beforebegin', make('bottom')); else document.body.appendChild(make('bottom'));
    }
    var host = document.getElementById('app') || document.querySelector('main');
    if (host && host.children.length && !host.querySelector('[data-slot="mid"]')) host.appendChild(make('mid'));
  }
  function load() {
    fetch(SB_URL + '/rest/v1/news_ads?select=*&order=sort.asc,created_at.asc', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var next = { top: [], mid: [], bottom: [] };
        (rows || []).forEach(function (a) { if (next[a.slot]) next[a.slot].push(normal(a)); });
        live = next;
        document.querySelectorAll('.ad-slot').forEach(paint);
      })
      .catch(function () { /* keep what is showing */ });
  }
  function start() {
    place();
    var host = document.getElementById('app');
    if (host) new MutationObserver(place).observe(host, { childList: true });
    load();
    window.addEventListener('hashchange', function () { setTimeout(function () { place(); document.querySelectorAll('.ad-slot').forEach(function (el) { pos[el.getAttribute('data-slot')] = null; paint(el); }); }, 80); });
    setInterval(function () { if (!document.hidden) load(); }, 5 * 60 * 1000);   /* picks up new, paused and expired ads */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
