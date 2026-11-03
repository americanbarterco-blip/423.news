/* 423.news — video sources. One place that knows how to turn a pasted link (or a saved row) into a player.
   Embed423.parse(url)        -> { provider, ref, kind } or null   (used when an editor pastes a link)
   Embed423.src(row, opts)    -> { type: 'iframe' | 'video' | 'hls', url } or null
   Embed423.html(row, title)  -> player markup;  hydrate() wires up .m3u8 streams automatically.
   Only embed what you own or have permission to carry. */
(function () {
  'use strict';
  var YT = /(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function parse(input) {
    var t = String(input || '').trim(), u, h, m;
    if (/^[A-Za-z0-9_-]{11}$/.test(t)) return { provider: 'youtube', ref: t, kind: 'video' };
    if (!/^https:\/\//i.test(t)) return null;
    try { u = new URL(t); } catch (e) { return null; }
    h = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');
    var path = u.pathname;
    if (/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(h)) {
      m = t.match(YT);
      if (m) return { provider: 'youtube', ref: m[1], kind: /\/live\//.test(path) ? 'live' : 'video' };
      m = t.match(/[?&]list=([A-Za-z0-9_-]{10,64})/);
      return m ? { provider: 'youtube', ref: m[1], kind: 'playlist' } : null;
    }
    if (/(^|\.)facebook\.com$|^fb\.watch$|^fb\.com$/.test(h)) return { provider: 'facebook', ref: t, kind: 'video' };
    if (/(^|\.)tiktok\.com$/.test(h)) return /\/video\/\d+/.test(path) ? { provider: 'tiktok', ref: u.origin + path, kind: 'video' } : null;
    if (/^(x|twitter)\.com$/.test(h)) return /\/status\/\d+/.test(path) ? { provider: 'x', ref: u.origin + path, kind: 'video' } : null;
    if (/(^|\.)instagram\.com$/.test(h)) return /\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/.test(path) ? { provider: 'instagram', ref: u.origin + path, kind: 'video' } : null;
    if (/(^|\.)vimeo\.com$/.test(h)) return /\/\d+/.test(path) ? { provider: 'vimeo', ref: u.origin + path, kind: 'video' } : null;
    if (/(^|\.)twitch\.tv$/.test(h)) {
      if (/^\/videos\/\d+/.test(path) || /^\/[A-Za-z0-9_]{3,25}\/?$/.test(path)) return { provider: 'twitch', ref: u.origin + path, kind: /^\/videos\//.test(path) ? 'video' : 'live' };
      return null;
    }
    if (/\.m3u8$/i.test(path)) return { provider: 'hls', ref: t, kind: 'live' };
    if (/\.(mp4|webm|mov)$/i.test(path)) return { provider: 'file', ref: t, kind: 'video' };
    return null;
  }

  function addq(url, q) { return url + (url.indexOf('?') > -1 ? '&' : '?') + q; }

  function src(st, o) {
    if (!st || !st.ref) return null;
    o = o || {};
    var p = st.provider || 'youtube', r = String(st.ref), m, url;
    if (p === 'youtube') {
      url = st.kind === 'playlist' ? 'https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(r)
                                   : 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(r) + '?rel=0';
      return { type: 'iframe', url: o.autoplay ? addq(url, 'autoplay=1&mute=1') : url };
    }
    if (!/^https:\/\//i.test(r)) return null;
    if (p === 'facebook') return { type: 'iframe', url: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(r) + '&show_text=false' + (o.autoplay ? '&autoplay=true&muted=true' : '') };
    if (p === 'tiktok') { m = r.match(/\/video\/(\d+)/); return m ? { type: 'iframe', url: 'https://www.tiktok.com/embed/v2/' + m[1] } : null; }
    if (p === 'x') { m = r.match(/\/status\/(\d+)/); return m ? { type: 'iframe', url: 'https://platform.twitter.com/embed/Tweet.html?theme=dark&id=' + m[1] } : null; }
    if (p === 'instagram') { m = r.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/); return m ? { type: 'iframe', url: 'https://www.instagram.com/' + (m[1] === 'reels' ? 'reel' : m[1]) + '/' + m[2] + '/embed' } : null; }
    if (p === 'vimeo') { m = r.match(/\/(\d+)/); return m ? { type: 'iframe', url: 'https://player.vimeo.com/video/' + m[1] + (o.autoplay ? '?autoplay=1&muted=1' : '') } : null; }
    if (p === 'twitch') {
      var par = '&parent=' + encodeURIComponent(location.hostname || '423.news') + (o.autoplay ? '&autoplay=true&muted=true' : '');
      m = r.match(/\/videos\/(\d+)/);
      if (m) return { type: 'iframe', url: 'https://player.twitch.tv/?video=v' + m[1] + par };
      m = r.match(/twitch\.tv\/([A-Za-z0-9_]{3,25})/);
      return m ? { type: 'iframe', url: 'https://player.twitch.tv/?channel=' + m[1] + par } : null;
    }
    if (p === 'hls') return { type: 'hls', url: r };
    if (p === 'file') return { type: 'video', url: r };
    return null;
  }

  function html(st, title) {
    var e = src(st);
    if (!e) return '<div class="vwrap"><div style="display:grid;place-items:center;height:100%;color:#9eafc0;padding:16px;text-align:center">This video cannot be shown.</div></div>';
    if (e.type === 'iframe') return '<div class="vwrap"><iframe src="' + esc(e.url) + '" title="' + esc(title || st.title || 'Video') + '" loading="lazy" allow="autoplay; accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    if (e.type === 'hls') return '<div class="vwrap"><video controls playsinline muted data-hls="' + esc(e.url) + '" style="position:absolute;inset:0;width:100%;height:100%"></video></div>';
    return '<div class="vwrap"><video controls playsinline preload="metadata" src="' + esc(e.url) + '" style="position:absolute;inset:0;width:100%;height:100%"></video></div>';
  }

  var hlsWait = null;
  function loadHls(cb) {
    if (window.Hls) return cb();
    if (hlsWait) { hlsWait.push(cb); return; }
    hlsWait = [cb];
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
    s.onload = function () { var q = hlsWait; hlsWait = null; q.forEach(function (f) { f(); }); };
    s.onerror = function () { var q = hlsWait; hlsWait = null; q.forEach(function (f) { f(new Error('hls')); }); };
    document.head.appendChild(s);
  }
  function hydrate(root) {
    (root || document).querySelectorAll('video[data-hls]').forEach(function (v) {
      if (v.__hls) return; v.__hls = 1;
      var u = v.getAttribute('data-hls');
      if (v.canPlayType('application/vnd.apple.mpegurl')) { v.src = u; return; }
      loadHls(function (err) {
        if (err || !window.Hls || !window.Hls.isSupported()) return;
        var h = new window.Hls(); h.loadSource(u); h.attachMedia(v);
      });
    });
  }
  var pending = false;
  function watch() {
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(function () { if (pending) return; pending = true; setTimeout(function () { pending = false; hydrate(); }, 60); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  window.Embed423 = { parse: parse, src: src, html: html, hydrate: hydrate };
})();
