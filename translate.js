/* 423.news — site-wide English <-> Español button.
   One file, added to every page with:  <script src="translate.js" defer></script>

   How it works
   - Uses Google's free website-translation engine, loaded only when needed (first visit stays fast).
   - Google watches the page for changes, so content your app.js draws later (stories, ticker,
     forecast, scores, modals, route changes) is translated automatically too.
   - The choice is remembered (localStorage + cookie), so every other page opens already in Spanish.
   - Google's own banner/toolbar is hidden; only this one button is shown.
   - Brand names and anything marked translate="no" / class="notranslate" are left alone.
   - If Google is blocked (ad-blocker, network), the button falls back to opening a Google-hosted
     Spanish copy of the current page. */
(function () {
  'use strict';
  if (window.__t423) return;
  window.__t423 = 1;
  if (window.top !== window.self) return;            /* never inside iframes/embeds */

  var SRC = 'en', TARGET = 'es', KEY = '423lang';
  var engineRequested = false, engineReady = false;

  /* ---------- tiny helpers ---------- */
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function cookieDomains() {
    var h = location.hostname, out = [''];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.indexOf('.') < 0) return out;
    var p = h.split('.');
    out.push(';domain=' + h);
    if (p.length >= 2) out.push(';domain=.' + p.slice(-2).join('.'));   /* covers claudia.423.news etc. */
    return out;
  }
  function setCookie(val) {          /* val like '/en/es', or null to clear */
    var exp = val ? ';max-age=31536000' : ';max-age=0';
    cookieDomains().forEach(function (d) {
      document.cookie = 'googtrans=' + (val || '') + ';path=/' + d + exp + ';SameSite=Lax';
    });
  }

  /* ---------- styles (button + hide Google's UI) ---------- */
  var css = [
    '#t423{position:fixed;right:18px;bottom:18px;z-index:70;display:inline-flex;align-items:center;gap:7px;',
    'padding:10px 15px;border-radius:999px;border:1px solid #ff5a0a;background:rgba(5,11,18,.96);color:#fff;',
    'font:700 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.02em;cursor:pointer;',
    'box-shadow:0 8px 26px rgba(0,0,0,.45);-webkit-tap-highlight-color:transparent}',
    '#t423:hover{background:#ff5a0a}',
    '#t423:focus-visible{outline:3px solid #ffa51f;outline-offset:2px}',
    '#t423[aria-busy="true"]{opacity:.7;cursor:progress}',
    '@media (max-width:720px){#t423{right:12px;bottom:calc(66px + env(safe-area-inset-bottom,0px));padding:9px 13px;font-size:12px}}',
    '@media print{#t423{display:none}}',
    /* hide Google's banner, tooltip, highlight, and the stray top offset it adds */
    'body{top:0!important}',
    '.goog-te-banner-frame,.goog-te-balloon-frame,#goog-gt-tt,.goog-tooltip,.goog-te-spinner-pos,.skiptranslate>iframe{display:none!important;visibility:hidden!important}',
    '.goog-text-highlight{background:none!important;box-shadow:none!important}',
    '#google_translate_element{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden}',
    'font[style*="vertical-align: inherit"]{vertical-align:baseline!important}'
  ].join('');
  var st = document.createElement('style');
  st.id = 't423-css';
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- protect brand names / non-prose from translation ---------- */
  function protect(root) {
    var sel = '.logo,.wm,[data-notranslate],code,pre,kbd,input,textarea,select,.tkr-brand';
    try {
      (root || document).querySelectorAll(sel).forEach(function (el) {
        if (!el.hasAttribute('translate')) el.setAttribute('translate', 'no');
        el.classList.add('notranslate');
      });
    } catch (e) {}
  }

  /* ---------- the button ---------- */
  var btn = document.createElement('button');
  btn.id = 't423';
  btn.type = 'button';
  btn.className = 'notranslate';
  btn.setAttribute('translate', 'no');

  function isSpanish() { return load(KEY) === TARGET; }
  function paint() {
    var es = isSpanish();
    btn.innerHTML = '<span aria-hidden="true">🌐</span><span>' + (es ? 'English' : 'Español') + '</span>';
    btn.setAttribute('aria-label', es ? 'Switch this site back to English' : 'Traducir este sitio al español');
    btn.setAttribute('lang', es ? 'en' : 'es');
    btn.setAttribute('aria-pressed', es ? 'true' : 'false');
    btn.removeAttribute('aria-busy');
  }

  /* ---------- Google engine ---------- */
  function ensureHost() {
    var h = document.getElementById('google_translate_element');
    if (!h) {
      h = document.createElement('div');
      h.id = 'google_translate_element';
      h.className = 'notranslate';
      h.setAttribute('translate', 'no');
      document.body.appendChild(h);
    }
    return h;
  }

  window.__t423init = function () {
    try {
      new google.translate.TranslateElement({
        pageLanguage: SRC,
        includedLanguages: SRC + ',' + TARGET,
        autoDisplay: false,
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE
      }, 'google_translate_element');
      engineReady = true;
      if (isSpanish()) forceCombo(TARGET);
    } catch (e) { fail(); }
  };

  function loadEngine() {
    if (engineRequested) return;
    engineRequested = true;
    ensureHost();
    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=__t423init';
    s.async = true;
    s.onerror = fail;
    document.head.appendChild(s);
    /* if nothing happens in 10s, assume it is blocked */
    setTimeout(function () { if (!engineReady && isSpanish()) fail(); }, 10000);
  }

  /* belt-and-braces: set the hidden language <select> in case the cookie alone didn't trigger it */
  function forceCombo(lang) {
    var tries = 0, t = setInterval(function () {
      var c = document.querySelector('select.goog-te-combo');
      if (c) {
        clearInterval(t);
        if (c.value !== lang && !document.documentElement.classList.contains('translated-ltr')) {
          c.value = lang;
          c.dispatchEvent(new Event('change'));
        }
        btn.removeAttribute('aria-busy');
      } else if (++tries > 50) { clearInterval(t); }
    }, 200);
  }

  function fail() {
    btn.removeAttribute('aria-busy');
    var ok = window.confirm('Translation could not load here (an ad-blocker or network setting may be blocking it).\n\nOpen a Google-translated Spanish copy of this page instead?');
    if (ok) {
      location.href = 'https://translate.google.com/translate?sl=en&tl=es&u=' + encodeURIComponent(location.href);
    } else {
      store(KEY, null); setCookie(null); paint();
    }
  }

  /* ---------- actions ---------- */
  function toSpanish() {
    store(KEY, TARGET);
    setCookie('/' + SRC + '/' + TARGET);
    btn.setAttribute('aria-busy', 'true');
    document.documentElement.setAttribute('lang', TARGET);
    loadEngine();
    if (engineReady) forceCombo(TARGET);
    paint();
    btn.setAttribute('aria-busy', 'true');          /* cleared once the page is translated */
    setTimeout(function () { btn.removeAttribute('aria-busy'); }, 4000);
  }

  function toEnglish() {
    /* Reverting cleanly means dropping Google's DOM wrappers, so reload (the #hash route is kept). */
    store(KEY, 'en');
    setCookie(null);
    document.documentElement.setAttribute('lang', SRC);
    location.reload();
  }

  btn.addEventListener('click', function () { isSpanish() ? toEnglish() : toSpanish(); });

  /* ---------- boot ---------- */
  function boot() {
    protect();
    document.body.appendChild(btn);
    paint();
    ensureHost();
    if (isSpanish()) {
      setCookie('/' + SRC + '/' + TARGET);           /* keeps cookie fresh across subdomains */
      document.documentElement.setAttribute('lang', TARGET);
      btn.setAttribute('aria-busy', 'true');
      loadEngine();
    } else {
      setCookie(null);                               /* make sure a stale cookie can't half-translate */
    }
    /* Newly drawn app content (modals, cards, inputs): keep protecting brand/inputs, cheaply. */
    if ('MutationObserver' in window) {
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        setTimeout(function () { queued = false; protect(); }, 600);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
