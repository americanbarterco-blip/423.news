/* 423.news — notification button. Turns web push on/off for this phone. */
(function () {
  'use strict';
  var SB = 'https://kdiwehqtezlhecxsoysj.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkaXdlaHF0ZXpsaGVjeHNveXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDQzOTEsImV4cCI6MjEwNjIyMDM5MX0.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE';   /* public (anon) key, same one app.js uses */
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function b64(u) { var p = '='.repeat((4 - u.length % 4) % 4), s = (u + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function rpc(fn, body) { return fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  function reg() { return navigator.serviceWorker.ready; }
  function current() { return reg().then(function (r) { return r.pushManager.getSubscription(); }); }
  function modal(html) {
    close();
    var d = document.createElement('div'); d.id = 'pushModal';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:grid;place-items:center;padding:20px';
    d.innerHTML = '<div style="background:#0b1826;color:#e8eef5;border:1px solid #24384a;border-radius:16px;max-width:360px;width:100%;padding:20px;font:15px/1.5 system-ui,sans-serif">' + html + '</div>';
    d.addEventListener('click', function (e) { if (e.target === d || e.target.getAttribute('data-x') !== null) close(); });
    document.body.appendChild(d); return d;
  }
  function close() { var d = document.getElementById('pushModal'); if (d) d.remove(); }
  var BTN = 'border:0;border-radius:99px;padding:10px 20px;font:700 14px system-ui;cursor:pointer;margin-right:8px';

  function paintBtn(on) { var b = document.getElementById('pushBtn'); if (b) b.textContent = on ? '🔔 Notifications on' : '🔔 Get notifications'; }

  function enable(topics, msg) {
    msg.textContent = 'Working…';
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings, then try again.');
      return fetch(SB + '/functions/v1/push-send?key=1').then(function (r) { return r.json(); });
    }).then(function (k) {
      if (!k.publicKey) throw new Error('Notifications are not ready yet. Try again in a minute.');
      return reg().then(function (r) { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.publicKey) }); });
    }).then(function (sub) {
      var j = sub.toJSON();
      return rpc('news_push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_topics: topics });
    }).then(function (r) {
      if (!r.ok) throw new Error('Could not save your choice. Try again.');
      paintBtn(true); close();
      reg().then(function (r2) { r2.showNotification('Notifications are on', { body: "You'll get 423.news alerts here.", icon: 'icon-192.png', badge: 'icon-192.png' }); });
    });
  }
  function disable() {
    return current().then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () { return rpc('news_push_unsubscribe', { p_endpoint: ep }); });
    }).then(function () { paintBtn(false); close(); });
  }

  function open() {
    if (!supported || (ios && !standalone)) {
      modal('<h2 style="margin:0 0 8px;font-size:18px">Get 423.news alerts</h2><p style="color:#9eafc0;margin:0 0 12px">' +
        (ios && !standalone ? 'On iPhone, first add the app to your home screen: tap <b>Share</b>, then <b>Add to Home Screen</b>. Open it from there and tap this button again.'
                            : 'This browser cannot show notifications. Try Chrome on Android, or install the app from the button below.') +
        '</p><button type="button" data-x style="' + BTN + ';background:#ff5a0a;color:#fff">Got it</button>');
      return;
    }
    current().then(function (sub) {
      if (sub) {
        var m = modal('<h2 style="margin:0 0 8px;font-size:18px">Notifications are on</h2><p style="color:#9eafc0;margin:0 0 12px">This phone will get 423.news alerts.</p>' +
          '<button type="button" id="pushOff" style="' + BTN + ';background:#24384a;color:#fff">Turn off</button><button type="button" data-x style="' + BTN + ';background:#ff5a0a;color:#fff">Done</button>');
        m.querySelector('#pushOff').onclick = function () { disable(); };
        return;
      }
      var m2 = modal('<h2 style="margin:0 0 8px;font-size:18px">Get 423.news alerts</h2><p style="color:#9eafc0;margin:0 0 10px">Choose what you want on this phone:</p>' +
        '<label style="display:flex;gap:8px;margin:6px 0"><input type="checkbox" id="tpB" checked><span><b>Breaking and alerts</b><br><span style="color:#9eafc0">Urgent items only</span></span></label>' +
        '<label style="display:flex;gap:8px;margin:6px 0 12px"><input type="checkbox" id="tpC"><span><b>Every Claudia Green report</b><br><span style="color:#9eafc0">Includes unconfirmed scanner reports, labeled as such</span></span></label>' +
        '<div id="pushMsg" style="color:#f87171;min-height:20px;margin-bottom:6px"></div>' +
        '<button type="button" id="pushOn" style="' + BTN + ';background:#ff5a0a;color:#fff">Turn on</button><button type="button" data-x style="' + BTN + ';background:#24384a;color:#fff">Not now</button>');
      m2.querySelector('#pushOn').onclick = function () {
        var t = []; if (m2.querySelector('#tpB').checked) t.push('breaking'); if (m2.querySelector('#tpC').checked) t.push('claudia');
        var msg = m2.querySelector('#pushMsg'); if (!t.length) { msg.textContent = 'Pick at least one.'; return; }
        enable(t, msg).catch(function (e) { msg.textContent = (e && e.message) || 'Could not turn on notifications.'; });
      };
    });
  }

  function add() {
    var f = document.querySelector('footer .wrap'); if (!f || document.getElementById('pushBtn')) return;
    var b = document.createElement('button'); b.id = 'pushBtn'; b.type = 'button'; b.textContent = '🔔 Get notifications';
    b.style.cssText = 'display:block;margin:10px 0 0;background:#1479ff;color:#fff;border:0;border-radius:99px;padding:10px 18px;font:700 14px system-ui,sans-serif;cursor:pointer';
    b.addEventListener('click', open); f.appendChild(b);
    if (supported) current().then(function (s) { paintBtn(!!s); }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
