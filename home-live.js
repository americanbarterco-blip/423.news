/* 423.news — homepage live block: news video + live traffic across the 423 area.
   Loaded by index.html after app.js. Injects itself at the top of #app on the home route. */
(function () {
  'use strict';

  /* ---------------- settings you edit ---------------- */
  var DEFAULTS = {
    /* Live news video. Use ONE of:
         - a YouTube live embed URL:  https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID
         - an HLS stream (.m3u8) you have the right to carry
       Leave '' and the panel says plainly that no stream is connected. */
    videoUrl: '',
    videoTitle: '423 live news',

    /* TomTom Traffic key (restrict it to your domain in the TomTom dashboard).
       Empty = the panel links to TDOT SmartWay instead of inventing incidents. */
    trafficKey: 'cMbIUJuSZbzdjBSuZRxNdf2VgGH17QSz',
    radiusKm: 12,
    maxPerHub: 4,
    refreshSeconds: 120,
    sportsRefreshSeconds: 30,   /* how often the Live sports spaces check for new videos */

    /* Hubs that together cover the 423 area */
    hubs: [
      { name: 'Chattanooga', lat: 35.0456, lon: -85.3097 },
      { name: 'Cleveland', lat: 35.1595, lon: -84.8766 },
      { name: 'Athens', lat: 35.4429, lon: -84.5927 },
      { name: 'Knoxville', lat: 35.9606, lon: -83.9207 },
      { name: 'Morristown', lat: 36.2140, lon: -83.2949 },
      { name: 'Johnson City', lat: 36.3134, lon: -82.3535 },
      { name: 'Kingsport', lat: 36.5484, lon: -82.5618 },
      { name: 'Bristol', lat: 36.5951, lon: -82.1887 }
    ],

    /* Commercials on the news feed: ad plays for adMinutes after every liveMinutes of live video.
       Clock-aligned (10-minute cycle), so every visitor sees the break at the same time.
       adUrls = https .mp4 or .m3u8 files you own the rights to. */
    liveMinutes: 9,
    adMinutes: 1,
    adUrls: [],

    /* Small Claudia Green feed on the home page (same-site page shown in a frame) */
    claudiaUrl: 'claudia-scanner.html',
    feedUrl: 'feed.json',   /* the same file the scanner page reads */
    claudiaCount: 5,
    claudiaFreshHours: 24,   /* reports older than this disappear on their own */
    claudiaImage: 'claudia-poster.jpg',   /* poster image for the recorded studio video */
    claudiaVideo: 'claudia-onair.mp4', /* recorded studio video; not a live broadcast */

    /* Sports block: one big stream, three smaller ones in a row under it.
       For YouTube embeds add ?autoplay=1&mute=1 to the URL. */
    sports: {
      main: { title: '423 live sports', url: '' },
      others: [
        { label: 'Basketball', url: '' },
        { label: 'Baseball', url: '' },
        { label: 'Soccer', url: '' }
      ]
    }
  };
  var CFG = Object.assign({}, DEFAULTS, window.HOME_LIVE || {});

  /* Public (anon) key: safe in the browser. Row Level Security decides what visitors can read. */
  var SB_URL = 'https://kdiwehqtezlhecxsoysj.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkaXdlaHF0ZXpsaGVjeHNveXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDQzOTEsImV4cCI6MjEwNjIyMDM5MX0.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE';

  var TYPES = { 1: 'Accident', 2: 'Fog', 3: 'Dangerous conditions', 4: 'Rain', 5: 'Ice', 6: 'Jam',
    7: 'Lane closed', 8: 'Road closed', 9: 'Road works', 10: 'Wind', 11: 'Flooding', 14: 'Broken down vehicle' };
  var SEVERE = { 1: 1, 5: 1, 6: 1, 7: 1, 8: 1, 11: 1 };
  var hubFilter = 'All';
  var results = [];
  var timer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isHome() { return /^#?\/?(home)?$/.test(location.hash.replace(/^#\/?/, '#/').replace('#/', '#')) || location.hash === '' || location.hash === '#/home'; }

  /* ---------------- css ---------------- */
  var css = document.createElement('style');
  css.textContent =
    '#homeLive{display:grid;gap:16px;grid-template-columns:1.4fr 1fr;margin-bottom:22px}' +
    '@media(max-width:900px){#homeLive{grid-template-columns:1fr}}' +
    '.hl{background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;min-width:0}' +
    '.hl-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}' +
    '.hl-h h2{margin:0;font-size:16px;display:flex;align-items:center;gap:8px}' +
    '.hl-dot{width:9px;height:9px;border-radius:50%;background:#9eafc0}' +
    '.hl-dot.on{background:#ef4444;animation:wpulse 2s infinite}' +
    '.hl-video{position:relative;aspect-ratio:16/9;background:#000}' +
    '.hl-video iframe,.hl-video video{position:absolute;inset:0;width:100%;height:100%;border:0}' +
    '.hl-empty{display:grid;place-items:center;text-align:center;height:100%;padding:20px;color:var(--muted);font-size:14px}' +
    '.hl-chips{display:flex;gap:6px;overflow-x:auto;padding:10px 14px 0}' +
    '.hl-chips button{flex:0 0 auto;background:var(--s2);border:1px solid var(--line);color:var(--muted);border-radius:99px;padding:5px 11px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}' +
    '.hl-chips button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}' +
    '.hl-list{max-height:330px;overflow:auto;padding:6px 14px 12px}' +
    '.hl-row{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}' +
    '.hl-row:last-child{border-bottom:0}' +
    '.hl-t{flex:0 0 auto;align-self:flex-start;font-size:10px;font-weight:800;text-transform:uppercase;border-radius:4px;padding:2px 7px;background:#1d4ed8;color:#fff;margin-top:2px}' +
    '.hl-t.sev{background:#b91c1c}' +
    '.hl-row small{display:block;color:var(--muted)}' +
    '.hl-note{padding:12px 14px;font-size:13px;color:var(--muted)}' +
    '.hl-t.warn{background:#c2410c}.hl-t.low{background:#475569}' +
    '.hl-chips button i{font-style:normal;opacity:.8;margin-left:4px}' +
    '.hl-clear{display:flex;gap:8px;align-items:center;padding:14px;font-size:14px}.hl-clear b{color:#16a34a;font-size:18px}' +
    '.hl-acts{display:flex;gap:10px;align-items:center}.hl-acts button{background:var(--s2);border:1px solid var(--line);color:inherit;border-radius:99px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}' +
    '.hl-map{font-size:12px;text-decoration:underline;margin-left:8px}' +
    '.hl-acts button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}' +
    '.hl-mapbox[hidden]{display:none}.hl-map-el{height:340px;background:#1e293b;margin-top:10px}' +
    '.hl-mapbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 14px;font-size:12px;color:var(--muted)}' +
    '.hl-mapbar button,.hl-mapbar a{background:var(--s2);border:1px solid var(--line);color:inherit;border-radius:99px;padding:5px 12px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}' +
    '.hl-pop{font-size:13px;line-height:1.4;color:#111}.hl-pop a{color:#1d4ed8;text-decoration:underline}' +
    '.hl-foot{padding:8px 14px 12px;font-size:11px;color:var(--muted);border-top:1px solid var(--line)}.hl-foot a{text-decoration:underline;color:inherit}' +
    '.hl-side{display:grid;gap:16px;min-width:0;align-content:start}' +
    '.hl-claudia{max-height:260px;overflow:auto;padding:4px 14px 10px}.hl-claudia a{color:inherit;text-decoration:none}' +
    '#homeSports{display:grid;gap:16px;margin-bottom:22px}' +
    '.hl-sports-row{display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,1fr))}' +
    '.hl-sports-row .hl-h{padding:8px 10px}.hl-sports-row .hl-h h2{font-size:13px}';
  document.head.appendChild(css);

  /* ---------------- video ---------------- */
  var hlsInst = null;
  function loadHls(cb) {
    if (window.Hls) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
    s.onload = cb;
    s.onerror = function () { cb(new Error('hls')); };
    document.head.appendChild(s);
  }
  function mountStream(box, u, title, empty) {
    u = (u || '').trim();
    if (!/^https:\/\//i.test(u)) { box.innerHTML = '<div class="hl-empty">' + empty + '</div>'; return false; }
    if (/\.m3u8(\?|$)/i.test(u)) {
      box.innerHTML = '<video controls autoplay muted playsinline></video>';
      var v = box.firstChild;
      if (v.canPlayType('application/vnd.apple.mpegurl')) { v.src = u; return true; }
      loadHls(function (err) {
        if (err || !window.Hls || !window.Hls.isSupported()) {
          box.innerHTML = '<div class="hl-empty">This browser cannot play the live stream.</div>'; return;
        }
        var h = new window.Hls(); h.loadSource(u); h.attachMedia(v);
        if (box.id === 'hlVideo') hlsInst = h;
        h.on(window.Hls.Events.ERROR, function (e, d) {
          if (d.fatal) box.innerHTML = '<div class="hl-empty">The live stream is offline right now.</div>';
        });
      });
      return true;
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) { box.innerHTML = '<video controls autoplay muted playsinline src="' + esc(u) + '"></video>'; return true; }
    box.innerHTML = '<iframe src="' + esc(u) + '" title="' + esc(title) +
      '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>';
    return true;
  }

  /* news feed: live for liveMinutes, then adMinutes of commercials, repeating on the clock */
  var newsPhase = null, newsTimer = null;
  function inAd() {
    var cyc = CFG.liveMinutes + CFG.adMinutes;
    return Math.floor(Date.now() / 60000) % cyc >= CFG.liveMinutes;
  }
  function secsToNextPhase() {
    var cycMs = (CFG.liveMinutes + CFG.adMinutes) * 60000, pos = Date.now() % cycMs, edge = inAd() ? cycMs : CFG.liveMinutes * 60000;
    return Math.max(0, Math.ceil((edge - pos) / 1000));
  }
  function mountAds(box) {
    var list = (CFG.adUrls || []).filter(function (u) { return /^https:\/\//i.test(u); });
    if (!list.length) {
      box.innerHTML = '<div class="hl-empty">Commercial break<br>Live news returns shortly.</div>';
      return;
    }
    var i = 0, fails = 0;
    box.innerHTML = '<video autoplay muted playsinline controls></video>';
    var v = box.firstChild;
    function next() { v.src = list[i++ % list.length]; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    v.addEventListener('ended', next);
    v.addEventListener('error', function () { if (++fails < list.length * 2) next(); });
    next();
  }
  function tickNews() {
    var box = document.getElementById('hlVideo'), tag = document.getElementById('hlTag'), dot = document.getElementById('hlDot');
    if (!box) { clearInterval(newsTimer); newsPhase = null; return; }
    var ad = inAd(), s = secsToNextPhase();
    if (ad !== newsPhase) {
      newsPhase = ad;
      if (hlsInst) { try { hlsInst.destroy(); } catch (e) {} hlsInst = null; }
      if (ad) { mountAds(box); dot.classList.remove('on'); }
      else dot.classList.toggle('on', mountStream(box, newsUrl(), newsTitle(),
        'No live news video yet.<br>Add one on the <a href="#/news" style="text-decoration:underline">News</a> page.'));
    }
    tag.textContent = ad ? 'Commercial break · live in ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) : newsTitle();
  }

  /* ---------------- live news: videos come from the News page (news_streams, league news) ---------------- */
  var newsStream = null, newsSig = '';
  function newsUrl() { return CFG.videoUrl || (newsStream ? ytSrc(newsStream, true) : ''); }
  function newsTitle() { return CFG.videoUrl ? CFG.videoTitle : (newsStream ? newsStream.title : CFG.videoTitle); }
  function paintNewsVideo() {
    if (CFG.videoUrl) return;                   /* a fixed URL typed into home-live.js wins */
    loadStreams(true).then(function (list) {
      var main = list.filter(function (x) { return x.kind === 'live'; })[0] || list[0] || null;
      var sig = main ? main.id + ':' + main.ref : '-';
      if (sig === newsSig) return;
      newsSig = sig; newsStream = main;
      newsPhase = null; tickNews();             /* swap the player now */
    }).catch(function () { /* keep what is showing */ });
  }

  /* ---------------- traffic ---------------- */
  function fetchHub(h) {
    return window.TomTom.incidents(h.lat, h.lon, CFG.radiusKm, CFG.trafficKey).then(function (list) {
      return { hub: h.name, ok: true, list: list.map(function (x) { x.hub = h.name; return x; }).slice(0, CFG.maxPerHub) };
    }).catch(function (e) { return { hub: h.name, ok: false, error: e.message, list: [] }; });
  }

  var HUB_KEY = 'hl_hub', hubChosen = false;
  function hubSave(n) { try { localStorage.setItem(HUB_KEY, n); } catch (e) {} }
  function hubLoad() { try { return localStorage.getItem(HUB_KEY) || ''; } catch (e) { return ''; } }
  function dist(a, b, c, d) { var r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r * Math.cos((a + c) / 2 * r); return Math.sqrt(x * x + y * y) * 6371; }
  function nearestHub(lat, lon) {
    var best = null, bd = 1e9;
    CFG.hubs.forEach(function (h) { var d = dist(lat, lon, h.lat, h.lon); if (d < bd) { bd = d; best = h; } });
    return bd <= 60 ? best.name : null;
  }
  function pickStartHub(root) {
    var saved = hubLoad();
    if (saved && CFG.hubs.some(function (h) { return h.name === saved; })) { hubFilter = saved; hubChosen = true; return; }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (p) {
        if (hubChosen) return;
        var n = nearestHub(p.coords.latitude, p.coords.longitude);
        if (n) { hubFilter = n; hubChosen = true; hubSave(n); paintTraffic(root); }
      }, function () {}, { maximumAge: 600000, timeout: 6000 });
    }
  }
  function sevClass(t) {
    if (/^(Road closed|Accident|Flooding|Ice)$/.test(t.type)) return ' sev';
    if (/^(Lane closed|Jam|Dangerous conditions|Fog|Broken down vehicle)$/.test(t.type)) return ' warn';
    return ' low';
  }
  function sevRank(t) { var c = sevClass(t); return c === ' sev' ? 0 : c === ' warn' ? 1 : 2; }
  function delayTxt(s) { if (!s) return ''; var m = Math.round(s / 60); return m >= 1 ? ' · about ' + m + ' min delay' : ''; }
  function lenTxt(m) { if (!m || m < 160) return ''; return ' · ' + (m / 1609.34).toFixed(1) + ' mi'; }
  function rowHtml(t) {
    var place = t.from ? esc(t.from) + (t.to && t.to !== t.from ? ' → ' + esc(t.to) : '') : (t.to ? esc(t.to) : '');
    var head = t.road ? esc(t.road) + ' · ' + esc(t.type) : esc(t.type);
    var detail = (t.text && t.text !== t.type ? esc(t.text) + ' · ' : '') + esc(t.hub) + (place ? ' · ' + place : '') + esc(delayTxt(t.delay) + lenTxt(t.length));
    var map = (t.lat != null && t.lon != null) ? ' <a class="hl-map" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=' + t.lat + ',' + t.lon + '">Map</a>' : '';
    return '<div class="hl-row"><span class="hl-t' + sevClass(t) + '">' + esc(t.type) + '</span><div><b>' + head + '</b>' + map + '<small>' + detail + '</small></div></div>';
  }

  /* ---------------- map view (Leaflet + OpenStreetMap, loaded only when the viewer opens Map) ---------------- */
  var view = 'list', lmap = null, mlayer = null, meMark = null, fitSig = '', lfWait = null;
  function loadLeaflet(cb) {
    if (window.L && window.L.map) return cb();
    if (lfWait) { lfWait.push(cb); return; }
    lfWait = [cb];
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    s.onload = function () { var q = lfWait; lfWait = null; q.forEach(function (f) { f(); }); };
    s.onerror = function () { var q = lfWait; lfWait = null; q.forEach(function (f) { f(new Error('map library')); }); };
    document.head.appendChild(s);
  }
  function popHtml(t) {
    var head = t.road ? esc(t.road) + ' · ' + esc(t.type) : esc(t.type);
    var detail = (t.text && t.text !== t.type ? esc(t.text) + '<br>' : '') + esc(t.hub) + esc(delayTxt(t.delay) + lenTxt(t.length));
    return '<div class="hl-pop"><b>' + head + '</b><br>' + detail + '<br><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=' + t.lat + ',' + t.lon + '">Directions to here</a></div>';
  }
  function paintMap(root, rows) {
    var box = root.querySelector('.hl-map-el'), note = root.querySelector('.hl-mapnote');
    loadLeaflet(function (err) {
      if (err || !window.L) { note.textContent = 'The map could not be loaded. Use the List view.'; return; }
      var L = window.L;
      if (!lmap) {
        lmap = L.map(box).setView([35.9, -84.2], 8);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(lmap);
        mlayer = L.layerGroup().addTo(lmap); fitSig = '';
      }
      lmap.invalidateSize(); mlayer.clearLayers();
      var pts = [], missing = 0;
      rows.forEach(function (t) {
        if (t.lat == null || t.lon == null) { missing++; return; }
        var c = sevClass(t), col = c === ' sev' ? '#b91c1c' : c === ' warn' ? '#c2410c' : '#475569';
        L.circleMarker([t.lat, t.lon], { radius: 9, color: '#fff', weight: 2, fillColor: col, fillOpacity: 0.95 }).addTo(mlayer).bindPopup(popHtml(t));
        pts.push([t.lat, t.lon]);
      });
      if (fitSig !== hubFilter) {            /* re-centre only when the viewer changes area, not on every refresh */
        fitSig = hubFilter;
        var hub = CFG.hubs.filter(function (x) { return x.name === hubFilter; })[0];
        if (pts.length) lmap.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
        else if (hub) lmap.setView([hub.lat, hub.lon], 11);
        else lmap.setView([35.9, -84.2], 8);
      }
      note.textContent = pts.length + ' incident' + (pts.length === 1 ? '' : 's') + ' on the map' + (missing ? ' · ' + missing + ' without a map location (see List)' : '');
    });
  }
  function showMe(root) {
    var note = root.querySelector('.hl-mapnote');
    if (!navigator.geolocation) { note.textContent = 'This browser cannot share your location.'; return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      if (!lmap || !window.L) return;
      var ll = [p.coords.latitude, p.coords.longitude];
      if (meMark) meMark.remove();
      meMark = window.L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(lmap).bindPopup('You are here');
      lmap.setView(ll, 12);
    }, function () { note.textContent = 'Location is blocked. Allow it in your browser settings to see where you are.'; }, { enableHighAccuracy: false, timeout: 8000 });
  }
  function applyView(root) {
    var isMap = view === 'map';
    root.querySelector('.hl-list').hidden = isMap;
    root.querySelector('.hl-mapbox').hidden = !isMap;
    root.querySelectorAll('.hl-view').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view)); });
  }

  function paintTraffic(root) {
    var chips = root.querySelector('.hl-chips'), list = root.querySelector('.hl-list'), stamp = root.querySelector('.hl-stamp');
    if (!CFG.trafficKey) {
      chips.innerHTML = '';
      list.innerHTML = '<div class="hl-note">Live incident feed is not connected yet (needs a TomTom Traffic key in home-live.js). ' +
        'Until then, official road conditions for the whole state: ' +
        '<a href="https://smartway.tn.gov" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">TDOT SmartWay</a>.</div>';
      return;
    }
    var names = ['All'].concat(CFG.hubs.map(function (h) { return h.name; }));
    var counts = { All: 0 }, loaded = results.length > 0;
    results.forEach(function (r) { counts[r.hub] = r.list.length; counts.All += r.list.length; });
    chips.innerHTML = names.map(function (n) {
      return '<button type="button" data-hub="' + esc(n) + '" aria-pressed="' + (n === hubFilter) + '">' + esc(n) + (loaded ? '<i>' + (counts[n] || 0) + '</i>' : '') + '</button>';
    }).join('');
    var rows = [], failed = 0;
    results.forEach(function (r) {
      if (!r.ok) failed++;
      if (hubFilter === 'All' || hubFilter === r.hub) rows = rows.concat(r.list);
    });
    rows.sort(function (a, b) { return sevRank(a) - sevRank(b); });
    var html;
    if (!loaded) html = '<div class="hl-note">Loading traffic…</div>';
    else if (rows.length) html = rows.map(rowHtml).join('');
    else if (failed < results.length) html = '<div class="hl-clear"><b>✓</b><span>No incidents reported' + (hubFilter === 'All' ? ' in the 423 area' : ' near ' + esc(hubFilter)) + ' right now.</span></div>';
    else html = '';
    if (failed) { var why = ''; results.some(function (r) { if (!r.ok) { why = r.error; return true; } });
      html += '<div class="hl-note">' + (failed === results.length ? 'Live traffic could not be loaded. ' : failed + ' area' + (failed > 1 ? 's' : '') + ' could not be loaded. ') + esc(why) + '</div>'; }
    list.innerHTML = html;
    applyView(root);
    if (view === 'map' && loaded) paintMap(root, rows);
    stamp.textContent = loaded ? 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  }

  function refreshTraffic(root) {
    if (!CFG.trafficKey) { paintTraffic(root); return; }
    Promise.all(CFG.hubs.map(fetchHub)).then(function (r) { results = r; paintTraffic(root); });
  }

  /* ---------------- Claudia Green small feed ---------------- */
  function paintClaudia(root) {
    var el = root.querySelector('.hl-claudia'); if (!el) return;
    var cutoff = Date.now() - CFG.claudiaFreshHours * 3600e3, hdr = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
    var live = fetch(SB_URL + '/rest/v1/news_reports?select=id,kind,dateline,headline,ts&published=eq.true&ts=gte.' + encodeURIComponent(new Date(cutoff).toISOString()) + '&order=ts.desc&limit=12', { headers: hdr, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('reports ' + r.status); return r.json(); }).catch(function () { return null; });
    var file = fetch(CFG.feedUrl + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); }).catch(function () { return null; });
    Promise.all([live, file]).then(function (x) {
      var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); };
      var stamp = root.querySelector('.hl-cstamp');
      if (x[0] === null && x[1] === null) { el.innerHTML = '<div class="hl-note">Claudia Green’s reports could not be loaded. <a href="' + esc(CFG.claudiaUrl) + '" style="text-decoration:underline">Open her page</a>.</div>'; return; }
      var rows = (x[0] || []).slice(), feed = x[1] || {}, seen = {};
      rows.forEach(function (r) { seen[norm(r.headline)] = 1; });
      (feed.reports || []).forEach(function (r) {      /* the scanner file only counts while it is fresh, and never twice */
        if (r.published === false) return;
        var t = Date.parse(r.ts); if (isNaN(t) || t < cutoff || seen[norm(r.headline)]) return; seen[norm(r.headline)] = 1; rows.push(r);
      });
      rows = rows.filter(function (r) { return !isNaN(Date.parse(r.ts)) && Date.parse(r.ts) >= cutoff; })
        .sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); }).slice(0, CFG.claudiaCount);
      var gen = Date.parse(feed.generated_at || ''), fresh = !isNaN(gen) && gen >= cutoff;
      var line = fresh && feed.claudia && feed.claudia.line ? '<div class="hl-note" style="padding:8px 0">' + esc(feed.claudia.line) + '</div>' : '';
      var ago = function (ts) { var s = Math.max(0, (Date.now() - Date.parse(ts)) / 1000); return s < 90 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' hr ago' : 'yesterday'; };
      el.innerHTML = line + (rows.map(function (r) {
        return '<a class="hl-row" href="report.html?id=' + encodeURIComponent(r.id) + '"><span class="hl-t' + (/^(BREAKING|ALERT)/i.test(r.kind || '') ? ' sev' : '') + '">' +
          esc(r.kind || 'Report') + '</span><div>' + esc(r.headline) + '<small>' + esc(r.dateline || '') + (r.dateline ? ' · ' : '') + esc(ago(r.ts)) + '</small></div></a>';
      }).join('') || '<div class="hl-note">No new reports in the last ' + CFG.claudiaFreshHours + ' hours. Claudia files here the moment something develops. <a href="' + esc(CFG.claudiaUrl) + '" style="text-decoration:underline">Earlier reports</a>.</div>');
      if (stamp) stamp.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    });
  }

  /* ---------------- live sports: videos come from Scores & Live (news_streams) ---------------- */
  var sportsSig = '', sportsTimer = null;
  function ytSrc(st, auto) {
    var em = window.Embed423 ? window.Embed423.src(st, { autoplay: !!auto }) : null;
    if (em) return em.url;
    var b = 'https://www.youtube-nocookie.com/embed/';
    return st.kind === 'playlist' ? b + 'videoseries?list=' + encodeURIComponent(st.ref) : b + encodeURIComponent(st.ref) + '?rel=0';
  }
  /* newsOnly = true: videos posted on the News page (league news). false: everything else (sports). */
  function loadStreams(newsOnly) {
    return fetch(SB_URL + '/rest/v1/news_streams?select=*&active=eq.true&league=' + (newsOnly ? 'eq.news' : 'neq.news') + '&order=sort.asc,created_at.desc&limit=12',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
      .then(function (r) { if (!r.ok) throw new Error('streams ' + r.status); return r.json(); });
  }
  function paintSports(box) {
    var sp = CFG.sports;
    /* If you type a stream URL into CFG.sports above, that fixed setup wins over the Scores & Live videos. */
    var manual = !!((sp.main && sp.main.url) || (sp.others || []).some(function (o) { return o.url; }));
    if (manual) {
      if (sportsSig === 'manual') return;
      sportsSig = 'manual';
      var onM = false;
      box.querySelectorAll('[data-sp]').forEach(function (el) {
        var i = +el.getAttribute('data-sp'), c = i === 0 ? sp.main : sp.others[i - 1];
        var ok = mountStream(el, c.url, c.label || c.title || 'Live sports', 'No stream connected yet.');
        if (i === 0) onM = ok;
      });
      var dm = document.getElementById('spDot'); if (dm) dm.classList.toggle('on', onM);
      return;
    }
    loadStreams(false).then(function (list) {
      if (!box.isConnected) return;
      var main = list.filter(function (x) { return x.kind === 'live'; })[0] || list[0] || null;
      var rest = list.filter(function (x) { return x !== main; }).slice(0, 3);
      var slots = [main, rest[0] || null, rest[1] || null, rest[2] || null];
      var sig = slots.map(function (x) { return x ? x.id + ':' + x.ref : '-'; }).join('|');
      if (sig === sportsSig) return;            /* nothing new: leave the playing videos alone */
      sportsSig = sig;
      var empty = 'No video yet. Add one in <a href="#/scores" style="text-decoration:underline">Scores &amp; Live</a>.';
      box.querySelectorAll('[data-sp]').forEach(function (el) {
        var i = +el.getAttribute('data-sp'), st = slots[i];
        var h = el.parentNode.querySelector('h2');
        if (i > 0 && h) h.textContent = st ? st.title : 'More video';
        if (st) mountStream(el, ytSrc(st), st.title, empty); else el.innerHTML = '<div class="hl-empty">' + empty + '</div>';
      });
      var t = document.getElementById('spTitle'); if (t) t.textContent = main ? main.title : sp.main.title;
      var d = document.getElementById('spDot'); if (d) d.classList.toggle('on', !!(main && main.kind === 'live'));
    }).catch(function () {
      if (sportsSig) return;                    /* keep whatever is already showing */
      box.querySelectorAll('[data-sp]').forEach(function (el) { el.innerHTML = '<div class="hl-empty">Videos could not be loaded right now.</div>'; });
    });
  }

  /* ---------------- mount ---------------- */
  function sportsHtml() {
    var sp = CFG.sports, small = (sp.others || []).slice(0, 3).map(function (o, i) {
      return '<div class="hl"><div class="hl-h"><h2>' + esc(o.label) + '</h2></div><div class="hl-video" data-sp="' + (i + 1) + '"></div></div>';
    }).join('');
    return '<div class="hl"><div class="hl-h"><h2><span class="hl-dot" id="spDot"></span>Live sports</h2><span><span class="muted" id="spTitle">' +
      esc(sp.main.title) + '</span> · <a href="#/scores" style="font-size:12px;text-decoration:underline">All video →</a></span></div><div class="hl-video" data-sp="0"></div></div><div class="hl-sports-row">' + small + '</div>';
  }
  function mount() {
    var app = document.getElementById('app');
    if (!app || !isHome() || document.getElementById('homeLive')) return;
    var root = document.createElement('section');
    root.id = 'homeLive';
    root.innerHTML =
      '<div class="hl"><div class="hl-h"><h2><span class="hl-dot" id="hlDot"></span>Live news</h2><span class="muted" id="hlTag"></span></div>' +
      '<div class="hl-video" id="hlVideo"></div></div>' +
      '<div class="hl-side">' +
      '<div class="hl"><div class="hl-h"><h2>Claudia Green</h2><span class="hl-acts"><span class="muted hl-cstamp"></span><a href="' + esc(CFG.claudiaUrl) + '" style="font-size:12px;text-decoration:underline">All reports →</a></span></div>' +
      (CFG.claudiaImage ? '<div style="padding:12px 14px 0"><div class="hl-video cg-cam" style="aspect-ratio:16/9;border-radius:12px;position:relative;overflow:hidden;background:#05080d"><video src="' + esc(CFG.claudiaVideo || 'claudia-onair.mp4') + '" poster="' + esc(CFG.claudiaImage) + '" autoplay muted loop playsinline preload="metadata" aria-label="Recorded video of Claudia Green at the 423.news studio desk" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video><span class="cg-tag" data-idle="On camera" style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,.72);color:#fff;font:700 10px system-ui;padding:5px 8px;border-radius:99px;letter-spacing:.08em">RECORDED STUDIO VIDEO</span><button type="button" class="cg-snd" style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.72);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:99px;padding:7px 11px;font:600 12px system-ui;cursor:pointer">Enable voice</button></div><div class="hl-note" style="padding:6px 0 0">Claudia Green, 423.news’s AI correspondent. Recorded studio video, not a live broadcast. <a href="#/tip" style="text-decoration:underline">Send Claudia a scanner clip</a></div></div>' : '') +
      '<div class="hl-claudia"><div class="hl-note">Loading…</div></div></div>' +
      '<div class="hl"><div class="hl-h"><h2>Traffic · 423 area</h2><span class="hl-acts"><span class="muted hl-stamp"></span><button type="button" class="hl-view" data-view="list" aria-pressed="true">List</button><button type="button" class="hl-view" data-view="map" aria-pressed="false">Map</button><button type="button" class="hl-refresh">Refresh</button></span></div>' +
      '<div class="hl-chips"></div><div class="hl-list" aria-live="polite"></div>' +
      '<div class="hl-mapbox" hidden><div class="hl-map-el"></div><div class="hl-mapbar"><button type="button" class="hl-me">📍 My location</button><a href="https://www.google.com/maps/dir/" target="_blank" rel="noopener noreferrer">Get directions</a><span class="hl-mapnote"></span></div></div>' +
      '<div class="hl-foot">Don’t use while driving. <a href="report.html">Report a problem</a> · Traffic data © <a href="https://www.tomtom.com/" target="_blank" rel="noopener noreferrer">TomTom</a></div></div></div>';
    app.insertBefore(root, app.firstChild);
    var sports = document.createElement('section');
    sports.id = 'homeSports';
    sports.innerHTML = sportsHtml();
    app.insertBefore(sports, root.nextSibling);
    sportsSig = ''; newsSig = '';
    paintSports(sports);
    paintNewsVideo();
    clearInterval(sportsTimer);
    sportsTimer = setInterval(function () {
      var sx = document.getElementById('homeSports');
      if (sx && !document.hidden) { paintSports(sx); paintNewsVideo(); }
    }, CFG.sportsRefreshSeconds * 1000);
    newsPhase = null; tickNews();
    clearInterval(newsTimer); newsTimer = setInterval(tickNews, 1000);
    root.querySelector('.hl-chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-hub]'); if (!b) return;
      hubFilter = b.getAttribute('data-hub'); hubChosen = true; hubSave(hubFilter); paintTraffic(root);
    });
    root.querySelector('.hl-refresh').addEventListener('click', function () { refreshTraffic(root); });
    lmap = null; mlayer = null; meMark = null; fitSig = ''; view = 'list';
    root.querySelectorAll('.hl-view').forEach(function (b) {
      b.addEventListener('click', function () { view = b.getAttribute('data-view'); paintTraffic(root); });
    });
    root.querySelector('.hl-me').addEventListener('click', function () { showMe(root); });
    results = []; pickStartHub(root);
    refreshTraffic(root);
    paintClaudia(root);
    clearInterval(timer);
    timer = setInterval(function () {
      var r = document.getElementById('homeLive');
      if (r && !document.hidden) { refreshTraffic(r); paintClaudia(r); }
    }, CFG.refreshSeconds * 1000);
  }

  function start() {
    var app = document.getElementById('app');
    if (!app) return;
    new MutationObserver(mount).observe(app, { childList: true });
    window.addEventListener('hashchange', function () { setTimeout(mount, 50); });
    mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
