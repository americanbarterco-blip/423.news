/* 423.news — "Get the app": registers the service worker and adds an install button. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var topButton = document.getElementById('getAppTop');
  if (standalone) { if (topButton) topButton.remove(); return; }                                   /* already installed: no button */

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('getApp'); if (b) b.remove(); if (topButton) topButton.remove(); closeHelp(); });

  var ua = navigator.userAgent || '', ios = /iphone|ipad|ipod/i.test(ua);
  function closeHelp() { var h = document.getElementById('appHelp'); if (h) h.remove(); }
  function help() {
    closeHelp();
    var steps = ios
      ? '<ol><li>Open 423.news in Safari.</li><li>Tap <b>Share</b>, then <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b> and open 423.news from your home screen.</li></ol>'
      : /android/i.test(ua)
        ? '<ol><li>Open 423.news in Chrome.</li><li>Tap the browser menu (<b>⋮</b>).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</li></ol>'
        : '<ol><li>Open 423.news in a supported browser.</li><li>Use the <b>Install</b> icon in the address bar or the browser menu.</li><li>Choose <b>Install 423.news</b>.</li></ol>';
    var d = document.createElement('div'); d.id = 'appHelp';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:grid;place-items:center;padding:20px';
    d.innerHTML = '<div style="background:#0b1826;color:#e8eef5;border:1px solid #24384a;border-radius:16px;max-width:360px;padding:20px;font:15px/1.5 system-ui,sans-serif">' +
      '<h2 style="margin:0 0 8px;font-size:18px">Get the 423.news app</h2><p style="margin:0 0 8px;color:#9eafc0">Opens full screen from your home screen, like any app.</p>' + steps +
      '<button type="button" id="appHelpClose" style="background:#ff5a0a;color:#fff;border:0;border-radius:99px;padding:10px 20px;font:700 14px system-ui;cursor:pointer">Got it</button></div>';
    d.addEventListener('click', function (ev) { if (ev.target === d || ev.target.id === 'appHelpClose') closeHelp(); });
    document.body.appendChild(d);
  }
  function click() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; }, function () { deferred = null; }); }
    else help();
  }
  if (topButton) topButton.addEventListener('click', click);
  function add() {
    var f = document.querySelector('footer .wrap'); if (!f || document.getElementById('getApp')) return;
    var b = document.createElement('button');
    b.id = 'getApp'; b.type = 'button'; b.textContent = '📲 Get the app';
    b.style.cssText = 'display:block;margin:10px 0 0;background:#ff5a0a;color:#fff;border:0;border-radius:99px;padding:10px 18px;font:700 14px system-ui,sans-serif;cursor:pointer';
    b.addEventListener('click', click);
    f.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
