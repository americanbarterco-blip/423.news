/* 423.news — live 5-day forecast board (built from the 423.news forecast template), forecast video stage,
   and the editor upload panel. Mounts itself wherever it finds [data-fx="board" | "videos" | "editor"],
   and puts a forecast section on the home page, right under the live news block. */
(function () {
  'use strict';
  var SB_URL = 'https://kdiwehqtezlhecxsoysj.supabase.co';
  var CITIES = [
    { name: 'Chattanooga', lat: 35.0456, lon: -85.3097, st: 'TN' }, { name: 'Cleveland', lat: 35.1595, lon: -84.8766, st: 'TN' },
    { name: 'Athens', lat: 35.4429, lon: -84.5927, st: 'TN' }, { name: 'Knoxville', lat: 35.9606, lon: -83.9207, st: 'TN' },
    { name: 'Morristown', lat: 36.214, lon: -83.2949, st: 'TN' }, { name: 'Johnson City', lat: 36.3134, lon: -82.3535, st: 'TN' },
    { name: 'Kingsport', lat: 36.5484, lon: -82.5618, st: 'TN' }, { name: 'Bristol', lat: 36.5951, lon: -82.1887, st: 'TN' }
  ];
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var CITY_KEY = 'fx_city';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function find(name) { return CITIES.filter(function (c) { return c.name === name; })[0] || CITIES[0]; }
  function saved() { try { return localStorage.getItem(CITY_KEY) || ''; } catch (e) { return ''; } }
  function save(n) { try { localStorage.setItem(CITY_KEY, n); } catch (e) {} }

  /* ---- weather codes -> the template's wording and artwork ---- */
  function look(code) {
    if (code === 0) return { t: 'Sunny Skies', i: 'sun' };
    if (code === 1) return { t: 'Mostly Sunny', i: 'mostly' };
    if (code === 2) return { t: 'Partly Cloudy', i: 'partly' };
    if (code === 3) return { t: 'Cloudy', i: 'cloud' };
    if (code === 45 || code === 48) return { t: 'Foggy', i: 'fog' };
    if (code >= 51 && code <= 55) return { t: 'Light Drizzle', i: 'rain' };
    if (code === 56 || code === 57) return { t: 'Freezing Drizzle', i: 'rain' };
    if (code === 61) return { t: 'Light Rain', i: 'rain' };
    if (code === 63) return { t: 'Rain', i: 'rain' };
    if (code === 65) return { t: 'Heavy Rain', i: 'rain' };
    if (code === 66 || code === 67) return { t: 'Freezing Rain', i: 'rain' };
    if (code === 71) return { t: 'Light Snow', i: 'snow' };
    if (code === 73) return { t: 'Snow', i: 'snow' };
    if (code === 75 || code === 77) return { t: 'Heavy Snow', i: 'snow' };
    if (code === 80) return { t: 'Scattered Showers', i: 'storm' };
    if (code === 81) return { t: 'Showers', i: 'storm' };
    if (code === 82) return { t: 'Heavy Showers', i: 'storm' };
    if (code === 85 || code === 86) return { t: 'Snow Showers', i: 'snow' };
    if (code === 95) return { t: 'Thunderstorms', i: 'storm' };
    if (code === 96 || code === 99) return { t: 'Severe Storms', i: 'storm' };
    return { t: 'Partly Cloudy', i: 'partly' };
  }
  function windTxt(mph, deg) {
    if (mph == null) return '';
    if (mph < 3) return 'Calm';
    var hi = Math.max(10, Math.ceil(mph / 5) * 5), lo = hi - 5;
    return COMPASS[Math.round(((deg || 0) % 360) / 45) % 8] + ' ' + lo + '-' + hi + ' mph';
  }

  /* ---- data ---- */
  function load(city) {
    var key = 'fx_' + city.name, now = Date.now();
    try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && now - c.t < 15 * 60 * 1000) return Promise.resolve(c.d); } catch (e) {}
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=5';
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('Weather service returned ' + r.status); return r.json(); }).then(function (j) {
      var d = j.daily, out = [];
      for (var i = 0; i < d.time.length && i < 5; i++) {
        var p = d.time[i].split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]);
        out.push({ dow: dt.getDay(), hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]),
          code: d.weather_code[i], wind: d.wind_speed_10m_max[i], wdir: d.wind_direction_10m_dominant[i], pop: d.precipitation_probability_max[i] });
      }
      try { sessionStorage.setItem(key, JSON.stringify({ t: now, d: out })); } catch (e) {}
      return out;
    });
  }

  /* ---- severe weather alerts: National Weather Service (US), for the chosen city ---- */
  function loadAlerts(city) {
    var key = 'fxa_' + city.name, now = Date.now();
    try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && now - c.t < 2 * 60 * 1000) return Promise.resolve(c.d); } catch (e) {}
    return fetch('https://api.weather.gov/alerts/active?point=' + city.lat + ',' + city.lon, { headers: { Accept: 'application/geo+json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('alerts ' + r.status); return r.json(); })
      .then(function (j) {
        var rank = function (e) { return /Warning/.test(e) ? 0 : /Watch/.test(e) ? 1 : 2; };
        var sev = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
        var list = (j.features || []).map(function (f) {
          var p = f.properties || {};
          return { event: p.event || 'Weather alert', severity: p.severity, headline: p.headline || '', area: p.areaDesc || '', ends: p.ends || p.expires || '',
            desc: p.description || '', instr: p.instruction || '', sender: p.senderName || 'National Weather Service' };
        }).sort(function (a, b) { return rank(a.event) - rank(b.event) || (sev[a.severity] || 4) - (sev[b.severity] || 4); });
        try { sessionStorage.setItem(key, JSON.stringify({ t: now, d: list })); } catch (e) {}
        return list;
      });
  }
  function untilTxt(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    var day = d.toDateString() === new Date().toDateString() ? '' : d.toLocaleDateString([], { weekday: 'short' }) + ' ';
    return 'until ' + day + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function alertsHtml(list) {
    if (!list.length) return '';
    var shown = list.slice(0, 3), more = list.length - shown.length;
    return '<div class="fx-al-wrap" role="region" aria-label="Weather alerts">' + shown.map(function (a, i) {
      var cls = /Warning/.test(a.event) ? 'warn' : /Watch/.test(a.event) ? 'watch' : 'adv';
      var area = a.area.length > 110 ? a.area.slice(0, 107) + '…' : a.area;
      var body = esc(a.desc.length > 1100 ? a.desc.slice(0, 1097) + '…' : a.desc).replace(/\n\n/g, '<br><br>').replace(/\n/g, ' ');
      return '<details class="fx-al ' + cls + '"' + (i === 0 && cls === 'warn' ? ' open' : '') + '><summary><b>' + esc(a.event) + '</b><span>' + esc(untilTxt(a.ends)) + '</span><small>' + esc(area) + '</small></summary>' +
        '<div class="fx-al-b">' + body + (a.instr ? '<p><b>What to do:</b> ' + esc(a.instr) + '</p>' : '') + '<p class="muted">' + esc(a.sender) + '</p></div></details>';
    }).join('') + (more > 0 ? '<div class="fx-al-more">+ ' + more + ' more alert' + (more > 1 ? 's' : '') + ' in effect. See weather.gov for the full list.</div>' : '') + '</div>';
  }

  /* ---- when rain starts / stops: Open-Meteo, 15-minute steps for the next 24 hours ---- */
  function loadRain(city) {
    var key = 'fxr_' + city.name, now = Date.now();
    try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && now - c.t < 5 * 60 * 1000) return Promise.resolve(c.d); } catch (e) {}
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
      '&minutely_15=precipitation&forecast_minutely_15=96&precipitation_unit=inch&timezone=America%2FNew_York';
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('rain ' + r.status); return r.json(); }).then(function (j) {
      var m = j.minutely_15; if (!m || !m.time) throw new Error('rain data');
      var d = { t: m.time, p: m.precipitation };
      try { sessionStorage.setItem(key, JSON.stringify({ t: now, d: d })); } catch (e) {}
      return d;
    });
  }
  function etNow() { return new Date().toLocaleString('sv-SE', { timeZone: 'America/New_York' }).slice(0, 16).replace(' ', 'T'); }
  function clock(iso, base) {
    var h = +iso.slice(11, 13), m = iso.slice(14, 16), ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    var day = iso.slice(0, 10) === base.slice(0, 10) ? '' : 'tomorrow ';
    return day + h12 + ':' + m + ' ' + ap;
  }
  function inTxt(iso, base) {
    var mins = Math.round((Date.parse(iso + ':00Z') - Date.parse(base + ':00Z')) / 60000);
    if (mins < 60) return 'in about ' + Math.max(mins, 5) + ' min';
    var h = Math.floor(mins / 60), r = mins % 60;
    return 'in about ' + h + ' hr' + (r >= 30 ? ' 30 min' : '');
  }
  function rainSummary(rd) {
    var base = etNow(), T = rd.t, P = rd.p, WET = 0.01, cur = -1, i;
    for (i = 0; i < T.length; i++) { if (T[i] <= base) cur = i; else break; }
    if (cur < 0) cur = 0;
    var wet = function (k) { return (P[k] || 0) >= WET; };
    var strength = function (a, b) { var mx = 0; for (var k = a; k < b && k < P.length; k++) mx = Math.max(mx, P[k] || 0); return mx < 0.03 ? 'Light' : mx < 0.1 ? 'Moderate' : 'Heavy'; };
    if (wet(cur)) {
      var e = cur; while (e < T.length && (wet(e) || wet(e + 1))) e++;
      if (e >= T.length) return { icon: '🌧️', cls: 'wet', text: 'Raining now, and it is expected to continue for the next 24 hours.' };
      return { icon: '🌧️', cls: 'wet', text: strength(cur, e) + ' rain now. Expected to ease around ' + clock(T[e], base) + '.' };
    }
    for (i = cur + 1; i < T.length; i++) if (wet(i)) break;
    if (i >= T.length) return { icon: '☀️', cls: 'dry', text: 'No rain expected in the next 24 hours.' };
    var e2 = i; while (e2 < T.length && (wet(e2) || wet(e2 + 1))) e2++;
    return { icon: '🌦️', cls: 'soon', text: strength(i, e2) + ' rain expected to start around ' + clock(T[i], base) + ' (' + inTxt(T[i], base) + ').' };
  }

  /* ---- the board ---- */
  var WIND_SVG = '<svg viewBox="0 0 40 24" width="30" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M2 8h22a4.5 4.5 0 1 0-4.5-4.5"/><path d="M2 14h30a4.5 4.5 0 1 1-4.5 4.5"/><path d="M2 20h14"/></svg>';
  function cardHtml(d, idx) {
    var lk = look(d.code), wk = d.dow === 0 || d.dow === 6, w = windTxt(d.wind, d.wdir);
    return '<div class="fx-card' + (wk ? ' wk' : '') + '" role="listitem" aria-label="' + esc(DAYS[d.dow] + ': ' + lk.t + ', high ' + d.hi + ', low ' + d.lo + (w ? ', wind ' + w : '') + (d.pop != null ? ', ' + d.pop + ' percent chance of precipitation' : '')) + '">' +
      '<div class="fx-day">' + DAYS[d.dow] + '</div>' +
      '<div class="fx-ico"><img src="fx-' + lk.i + '.png" alt="" width="150" height="115" loading="' + (idx < 2 ? 'eager' : 'lazy') + '"></div>' +
      '<div class="fx-hi">' + d.hi + '°</div><div class="fx-lo">' + d.lo + '°</div>' +
      '<div class="fx-cond">' + esc(lk.t) + '</div>' +
      '<div class="fx-wind">' + WIND_SVG + '<span>' + esc(w) + '</span></div></div>';
  }
  function mountBoard(el) {
    var cityName = el.getAttribute('data-city') || saved() || 'Chattanooga';
    var showChips = el.getAttribute('data-chips') === '1';
    el.innerHTML = '<div class="fx-alerts"></div><div class="fx-board"><div class="fx-head"><img src="fx-header.jpg" alt="423.news. Accurate Local News and Weather. 5 Day Forecast" width="1536" height="288">' +
      '<div class="fx-city" aria-live="polite"></div></div>' +
      '<div class="fx-rain" role="status" hidden></div>' +
      '<div class="fx-cards" role="list"><div class="fx-wait">Loading the forecast…</div></div>' +
      '<div class="fx-foot"><img src="fx-footer.jpg" alt="Your local weather authority. 423.news. Stay weather ready!" width="1536" height="119" loading="lazy"></div></div>' +
      (showChips ? '<div class="fx-chips" role="group" aria-label="Choose a city"></div>' : '') +
      '<div class="fx-notify"></div><div class="fx-meta"></div>';
    var alertsEl = el.querySelector('.fx-alerts'), rainEl = el.querySelector('.fx-rain'), cardsEl = el.querySelector('.fx-cards'), cityEl = el.querySelector('.fx-city'), chipsEl = el.querySelector('.fx-chips'), meta = el.querySelector('.fx-meta');
    var timer = null, notifyEl = el.querySelector('.fx-notify');
    function notify() {
      var pf = {}; try { pf = JSON.parse(localStorage.getItem('push_prefs') || 'null') || {}; } catch (e) {}
      var wx = pf.topics && pf.topics.indexOf('weather') > -1;
      notifyEl.innerHTML = wx
        ? '<span>🔔 Severe weather alerts are on for this phone</span><button type="button" data-n="1">Change</button>'
        : '<span>Get tornado, storm and flood warnings the moment they are issued.</span><button type="button" data-n="1" class="go">🔔 Turn on weather alerts</button>';
    }
    notifyEl.addEventListener('click', function (e) { if (e.target.closest('button[data-n]') && window.Push423) window.Push423.open({ weather: true }); });
    el.__notify = notify; notify();
    function chips(cur) {
      if (!chipsEl) return;
      chipsEl.innerHTML = CITIES.map(function (c) { return '<button type="button" data-c="' + esc(c.name) + '" aria-pressed="' + (c.name === cur) + '">' + esc(c.name) + '</button>'; }).join('');
    }
    function paint(name) {
      var city = find(name); cityEl.textContent = city.name + ', ' + city.st; chips(city.name);
      clearTimeout(timer);
      var open = alertsEl.querySelector('details[open]') ? 1 : 0;
      loadAlerts(city).then(function (l) { if (el.isConnected) alertsEl.innerHTML = alertsHtml(l); }).catch(function () { if (el.isConnected) alertsEl.innerHTML = ''; });
      loadRain(city).then(function (rd) {
        if (!el.isConnected) return;
        var s = rainSummary(rd); rainEl.hidden = false; rainEl.className = 'fx-rain ' + s.cls;
        rainEl.innerHTML = '<span aria-hidden="true">' + s.icon + '</span><b>' + esc(s.text) + '</b>';
      }).catch(function () { if (el.isConnected) rainEl.hidden = true; });
      load(city).then(function (days) {
        if (!el.isConnected) return;
        cardsEl.innerHTML = days.map(cardHtml).join('');
        meta.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · Forecast and rain timing: Open-Meteo.com · Alerts: National Weather Service';
        timer = setTimeout(function () { if (el.isConnected) paint(city.name); }, 3 * 60 * 1000);
      }).catch(function () {
        if (!el.isConnected) return;
        cardsEl.innerHTML = '<div class="fx-wait">The forecast could not be loaded right now. Trying again shortly…</div>';
        timer = setTimeout(function () { if (el.isConnected) paint(city.name); }, 60 * 1000);
      });
    }
    if (chipsEl) chipsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-c]'); if (!b) return;
      save(b.getAttribute('data-c')); paint(b.getAttribute('data-c'));
    });
    paint(cityName);
  }

  /* ---- video stage: any shape of phone video sits inside a 16:9 broadcast frame ---- */
  function fetchVideos(limit) {
    var key = (window.News423 && window.News423.key) || '';
    var url = SB_URL + '/rest/v1/news_forecast_videos?select=*&active=eq.true&order=created_at.desc&limit=' + (limit || 12);
    var h = { apikey: key };
    var tok = window.News423 && window.News423.token && window.News423.token();
    h.Authorization = 'Bearer ' + (tok || key);
    return fetch(url, { headers: h }).then(function (r) { if (!r.ok) throw new Error('videos ' + r.status); return r.json(); });
  }
  function stageHtml(v) {
    var tag = '<div class="fx-lt"><span class="fx-lt-a">423.NEWS WEATHER</span><span class="fx-lt-b">' + esc(v.title) + '</span></div>';
    if (v.provider === 'file') {
      return '<div class="fx-stage"><canvas class="fx-amb" aria-hidden="true"></canvas><video class="fx-vid" controls playsinline preload="metadata" src="' + esc(v.ref) + '"></video>' + tag + '</div>';
    }
    return '<div class="fx-stage fx-embed">' + (window.Embed423 ? window.Embed423.html({ provider: v.provider, ref: v.ref, kind: 'video' }, v.title) : '') + tag + '</div>';
  }
  function ambient(stage) {
    var vid = stage.querySelector('video.fx-vid'), cv = stage.querySelector('canvas.fx-amb');
    if (!vid || !cv) return;
    function draw() {
      try { cv.width = 64; cv.height = 36; cv.getContext('2d').drawImage(vid, 0, 0, 64, 36); } catch (e) {}
    }
    vid.addEventListener('loadeddata', draw); vid.addEventListener('seeked', draw);
    var t = null; vid.addEventListener('play', function () { clearInterval(t); t = setInterval(function () { if (!vid.isConnected) clearInterval(t); else draw(); }, 700); });
    vid.addEventListener('pause', function () { clearInterval(t); draw(); });
    vid.addEventListener('ended', function () { clearInterval(t); });
  }
  function mountVideos(el) {
    var limit = parseInt(el.getAttribute('data-limit') || '12', 10), compact = el.getAttribute('data-compact') === '1';
    el.innerHTML = '<div class="fx-vwrap"><div class="fx-main"></div><div class="fx-list" role="list"></div></div>';
    var main = el.querySelector('.fx-main'), list = el.querySelector('.fx-list');
    function show(v) { main.innerHTML = stageHtml(v); ambient(main.querySelector('.fx-stage')); }
    fetchVideos(limit).then(function (vs) {
      if (!el.isConnected) return;
      if (!vs.length) { el.innerHTML = compact ? '' : '<div class="fx-empty">No forecast videos yet. Check back soon.</div>'; return; }
      show(vs[0]);
      if (vs.length > 1 && !compact) {
        list.innerHTML = vs.map(function (v, i) { return '<button type="button" role="listitem" class="fx-item' + (i === 0 ? ' on' : '') + '" data-i="' + i + '"><span class="fx-play">▶</span><span><b>' + esc(v.title) + '</b><small>' + esc(new Date(v.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })) + '</small></span></button>'; }).join('');
        list.addEventListener('click', function (e) {
          var b = e.target.closest('.fx-item'); if (!b) return;
          list.querySelectorAll('.fx-item').forEach(function (x) { x.classList.toggle('on', x === b); });
          show(vs[+b.getAttribute('data-i')]);
          main.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    }).catch(function () { if (el.isConnected) el.innerHTML = compact ? '' : '<div class="fx-empty">Forecast videos could not be loaded.</div>'; });
  }

  /* ---- editor panel: upload from a phone (any size the plan allows, resumable) or paste a link ---- */
  var tusWait = null;
  function loadTus(cb) {
    if (window.tus) return cb();
    if (tusWait) { tusWait.push(cb); return; }
    tusWait = [cb];
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.1.0/dist/tus.min.js';
    s.onload = function () { var q = tusWait; tusWait = null; q.forEach(function (f) { f(); }); };
    s.onerror = function () { var q = tusWait; tusWait = null; q.forEach(function (f) { f(new Error('tus')); }); };
    document.head.appendChild(s);
  }
  function mime(file) {
    if (file.type) return file.type;
    var n = (file.name || '').toLowerCase();
    return /\.mov$/.test(n) ? 'video/quicktime' : /\.webm$/.test(n) ? 'video/webm' : /\.3gp$/.test(n) ? 'video/3gpp' : /\.m4v$/.test(n) ? 'video/x-m4v' : 'video/mp4';
  }
  function fmtSize(b) { return b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(1) + ' MB'; }
  function resumable(N, file, objectName, onPct) {
    return new Promise(function (resolve, reject) {
      loadTus(function (err) {
        if (err || !window.tus) return reject(new Error('The upload tool could not be loaded. Check your connection and try again.'));
        N.sb.auth.getSession().then(function (r) {
          var tok = r.data && r.data.session && r.data.session.access_token;
          if (!tok) return reject(new Error('Please sign in again.'));
          var up = new window.tus.Upload(file, {
            endpoint: SB_URL + '/storage/v1/upload/resumable', retryDelays: [0, 2000, 5000, 10000, 20000], chunkSize: 6 * 1024 * 1024,
            headers: { authorization: 'Bearer ' + tok, 'x-upsert': 'false' }, uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
            metadata: { bucketName: 'news-forecast', objectName: objectName, contentType: mime(file), cacheControl: '3600' },
            onError: function (e) { reject(e); }, onProgress: function (a, b) { onPct(a / b); }, onSuccess: function () { resolve(); }
          });
          up.findPreviousUploads().then(function (prev) { if (prev.length) up.resumeFromPreviousUpload(prev[0]); up.start(); });
        });
      });
    });
  }
  function mountEditor(el) {
    var N = window.News423;
    if (!N || !N.isStaff()) { el.innerHTML = ''; return; }
    el.innerHTML = '<section class="fx-ed"><h2>Editor: forecast videos</h2>' +
      '<p class="muted">Record on your phone or pick a video from your gallery. Any shape works (vertical, square or wide), and large files upload in pieces, so a dropped connection resumes. Keep this page open until it says Done.</p>' +
      '<label for="fxt">Title</label><input id="fxt" maxlength="120" placeholder="Tuesday evening forecast with …">' +
      '<label for="fxf">Video from this phone</label><input id="fxf" type="file" accept="video/*">' +
      '<div class="fx-prog" hidden><div class="fx-bar"><i></i></div><span class="fx-pct"></span></div>' +
      '<button type="button" class="fx-btn" id="fxu">Upload video</button>' +
      '<label for="fxl" style="margin-top:14px">…or paste a link (YouTube, Facebook, TikTok, X, Instagram, Vimeo, Twitch, .m3u8, .mp4)</label><input id="fxl" inputmode="url" placeholder="https://">' +
      '<button type="button" class="fx-btn alt" id="fxa">Add link</button><div class="fx-err" id="fxe" role="alert"></div>' +
      '<h3>Current videos</h3><div id="fxm"></div></section>';
    var $ = function (s) { return el.querySelector(s); };
    var err = $('#fxe');
    function manage() {
      N.sb.from('news_forecast_videos').select('*').order('created_at', { ascending: false }).limit(50).then(function (r) {
        var box = $('#fxm'); if (!box) return;
        var rows = r.data || [];
        box.innerHTML = rows.length ? rows.map(function (v) {
          return '<div class="fx-row" data-id="' + v.id + '"><span><b>' + esc(v.title) + '</b><small>' + esc(v.provider) + (v.size_bytes ? ' · ' + fmtSize(v.size_bytes) : '') + (v.active ? '' : ' · hidden') + '</small></span>' +
            '<button type="button" data-a="tog">' + (v.active ? 'Hide' : 'Show') + '</button><button type="button" data-a="del">Delete</button></div>';
        }).join('') : '<p class="muted">Nothing uploaded yet.</p>';
        box.onclick = function (e) {
          var b = e.target.closest('button[data-a]'); if (!b) return;
          var row = b.closest('.fx-row'), id = row.getAttribute('data-id'), v = rows.filter(function (x) { return String(x.id) === id; })[0];
          if (b.getAttribute('data-a') === 'tog') N.sb.from('news_forecast_videos').update({ active: !v.active }).eq('id', id).then(manage);
          else if (confirm('Delete "' + v.title + '"? This cannot be undone.')) {
            var after = function () { N.sb.from('news_forecast_videos').delete().eq('id', id).then(function () { manage(); refreshPublic(); }); };
            var m = v.provider === 'file' && v.ref.split('/news-forecast/')[1];
            if (m) N.sb.storage.from('news-forecast').remove([decodeURIComponent(m)]).then(after, after); else after();
          }
        };
      });
    }
    function refreshPublic() { document.querySelectorAll('[data-fx="videos"]').forEach(function (n) { mountVideos(n); }); }
    function bad(m) { err.textContent = m; }
    $('#fxu').addEventListener('click', function () {
      bad('');
      var title = $('#fxt').value.trim(), file = $('#fxf').files[0];
      if (!title) return bad('Add a title first.');
      if (!file) return bad('Choose a video first.');
      if (!/^video\//.test(file.type || 'video/mp4')) return bad('That file is not a video.');
      var ext = ({ 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v' })[mime(file)] || 'mp4';
      var name = 'forecast/' + new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
      var btn = $('#fxu'), pg = $('.fx-prog'), bar = $('.fx-bar i'), pct = $('.fx-pct');
      btn.disabled = true; pg.hidden = false; bar.style.width = '0%'; pct.textContent = '0%';
      resumable(N, file, name, function (f) { bar.style.width = (f * 100).toFixed(1) + '%'; pct.textContent = Math.round(f * 100) + '%  (' + fmtSize(f * file.size) + ' of ' + fmtSize(file.size) + ')'; })
        .then(function () {
          return N.sb.from('news_forecast_videos').insert({ title: title, provider: 'file', ref: SB_URL + '/storage/v1/object/public/news-forecast/' + name, size_bytes: file.size });
        }).then(function (r) {
          if (r && r.error) throw r.error;
          pct.textContent = 'Done. It is live on the Forecast page.'; $('#fxt').value = ''; $('#fxf').value = ''; manage(); refreshPublic();
        }).catch(function (e) {
          var m = (e && (e.message || e.originalResponse && e.originalResponse.getBody && e.originalResponse.getBody())) || 'Upload failed.';
          if (/exceeded|too large|413|maximum allowed/i.test(String(m))) m = 'That file is bigger than your Supabase plan allows. Check Storage settings in Supabase, or trim the video.';
          bad(String(m)); pg.hidden = true;
        }).then(function () { btn.disabled = false; });
    });
    $('#fxa').addEventListener('click', function () {
      bad('');
      var title = $('#fxt').value.trim(), link = $('#fxl').value.trim();
      if (!title) return bad('Add a title first.');
      var pr = window.Embed423 && window.Embed423.parse(link);
      if (!pr) return bad('That link is not supported.');
      if (pr.provider === 'file' && /supabase\.co/.test(link)) return bad('Use the upload button for files from this site.');
      N.sb.from('news_forecast_videos').insert({ title: title, provider: pr.provider, ref: pr.ref }).then(function (r) {
        if (r.error) return bad(r.error.message);
        $('#fxt').value = ''; $('#fxl').value = ''; manage(); refreshPublic();
      });
    });
    manage();
  }

  /* ---- mounting ---- */
  function scan() {
    document.querySelectorAll('[data-fx]').forEach(function (el) {
      if (el.__fx) return; el.__fx = 1;
      var k = el.getAttribute('data-fx');
      if (k === 'board') mountBoard(el);
      else if (k === 'videos') mountVideos(el);
      else if (k === 'editor') editorWhenReady(el, 0);
    });
    /* home page: forecast section right under the live news block */
    var live = document.getElementById('homeLive');
    if (live && !document.getElementById('homeForecast')) {
      var sec = document.createElement('section'); sec.id = 'homeForecast'; sec.className = 'fx-section';
      sec.innerHTML = '<div class="sech"><h2>5-Day Forecast</h2><a href="#/forecast">Forecast &amp; videos →</a></div>' +
        '<div data-fx="board" data-chips="1"></div><div data-fx="videos" data-limit="1" data-compact="1"></div>';
      live.parentNode.insertBefore(sec, live.nextSibling);
      scan();
    }
  }
  function editorWhenReady(el, n) {
    var N = window.News423;
    if (N && N.profileLoaded && N.profileLoaded()) return mountEditor(el);
    if (n < 20 && el.isConnected) setTimeout(function () { editorWhenReady(el, n + 1); }, 700);
  }
  var pend = false;
  function watch() {
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(function () { if (pend) return; pend = true; setTimeout(function () { pend = false; scan(); }, 80); }).observe(document.body, { childList: true, subtree: true });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  window.Forecast423 = { mountBoard: mountBoard, scan: scan, refreshNotify: function () { document.querySelectorAll('[data-fx="board"]').forEach(function (n) { if (n.__notify) n.__notify(); }); } };
})();
