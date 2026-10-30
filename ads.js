/* 423.news — ad spaces. Add <script src="ads.js"></script> at the end of EVERY page and tool.
   Puts a top banner (under the header), an in-content slot, and a bottom banner (above the footer).
   Ads come from window.ADS_CFG (set it before this script) or the defaults below.
   Ad format: { img: 'https://…image', href: 'https://…link', alt: 'Advertiser name' } (https only). */
(function () {
  'use strict';
  var CFG = Object.assign({
    ads: { top: [], mid: [], bottom: [] },
    contactUrl: 'mailto:ads@423.news',
    rotateSeconds: 20
  }, window.ADS_CFG || {});

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var css = document.createElement('style');
  css.textContent =
    '.ad-slot{max-width:1100px;margin:12px auto;padding:0 12px;text-align:center}' +
    '.ad-slot small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:4px}' +
    '.ad-box{display:grid;place-items:center;min-height:90px;border:1px dashed rgba(150,170,190,.45);border-radius:12px;overflow:hidden;background:rgba(150,170,190,.08)}' +
    '.ad-box img{display:block;max-width:100%;max-height:250px;height:auto}' +
    '.ad-box a{color:inherit;text-decoration:none}' +
    '.ad-box a.ad-ph{padding:20px;font-size:14px;font-weight:600}';
  document.head.appendChild(css);

  var idx = {};
  function good(u) { return /^https:\/\//i.test(u || ''); }
  function paint(el) {
    var name = el.getAttribute('data-slot');
    var list = ((CFG.ads || {})[name] || []).filter(function (a) { return a && good(a.img) && good(a.href); });
    var box = el.querySelector('.ad-box');
    if (!list.length) {
      box.innerHTML = '<a class="ad-ph" href="' + esc(CFG.contactUrl) + '">Your ad here · Advertise on 423.news</a>';
      return;
    }
    var a = list[(idx[name] = ((idx[name] || 0) + 1) % list.length)];
    box.innerHTML = '<a href="' + esc(a.href) + '" target="_blank" rel="sponsored noopener noreferrer"><img src="' +
      esc(a.img) + '" alt="' + esc(a.alt || 'Advertisement') + '" loading="lazy"></a>';
  }
  function make(name) {
    var el = document.createElement('div');
    el.className = 'ad-slot';
    el.setAttribute('data-slot', name);
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
  function start() {
    place();
    var host = document.getElementById('app');
    if (host) new MutationObserver(place).observe(host, { childList: true });
    setInterval(function () {
      if (document.hidden) return;
      document.querySelectorAll('.ad-slot').forEach(paint);
    }, Math.max(5, CFG.rotateSeconds) * 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
