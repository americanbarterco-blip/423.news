/* 423.news — Claudia Green voiceover.
   Tap "Enable voice": she reads the latest reports, newest to oldest, over her video, then reads
   each new report as it is filed. Uses her rendered audio (voice/<id>.mp3, see VOICE.md) when a
   report has it, otherwise the browser's own text-to-speech. The video never stops or gets sound.
   Spanish: speaks Spanish automatically when the visitor chose Español (translate.js). Optional feed fields
   headline_es / summary_es / audio_es are used first; otherwise the text is translated on the fly.
   Settings: window.CLAUDIA_VOICE = { voiceName:'', voiceNameEs:'', lang:'' (force es or en), rate:1, pitch:1, feedUrl:'feed.json', pollSeconds:30, briefing:12 } */
(function () {
  'use strict';
  var C = Object.assign({ voiceName: '', rate: 1, pitch: 1.05, feedUrl: 'feed.json', pollSeconds: 30, briefing: 12 }, window.CLAUDIA_VOICE || {});
  var synth = window.speechSynthesis;
  var enabled = false, seen = null, queue = [], busy = false, token = 0, activeAudio = null;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* Spanish when the visitor picked Español with the site's translate button (see translate.js) */
  function lang() {
    if (C.lang === 'es' || C.lang === 'en') return C.lang;
    return (get('423lang') === 'es' || /^es/i.test(document.documentElement.lang || '')) ? 'es' : 'en';
  }

  function pickVoice(l) {
    if (!synth) return null;
    l = l || 'en';
    var vs = synth.getVoices().filter(function (v) { return new RegExp('^' + l + '(-|_)', 'i').test(v.lang); });
    if (!vs.length) return null;
    var want = (get(l === 'es' ? 'cgVoiceEs' : 'cgVoice') || (l === 'es' ? C.voiceNameEs : C.voiceName) || '').toLowerCase();
    if (want) { var m = vs.filter(function (v) { return v.name.toLowerCase() === want; })[0]; if (m) return m; }
    if (l === 'es') {
      var pe = [/paulina|monica|m\u00f3nica|helena|sabina|elena|laura|lucia|luc\u00eda|natural/i, /google espa\u00f1ol|google espanol/i, /female|mujer/i];
      for (var j = 0; j < pe.length; j++) { var g = vs.filter(function (v) { return pe[j].test(v.name); })[0]; if (g) return g; }
      return vs.filter(function (v) { return /es-US|es-MX/i.test(v.lang); })[0] || vs[0];
    }
    var prefs = [/aria|jenny|ava|emma|natural/i, /google us english/i, /samantha|allison|serena|karen|moira/i, /female|zira|susan/i];
    for (var i = 0; i < prefs.length; i++) { var f = vs.filter(function (v) { return prefs[i].test(v.name); })[0]; if (f) return f; }
    return vs.filter(function (v) { return /en-US/i.test(v.lang); })[0] || vs[0];
  }

  /* English -> Spanish for a report the feed has no Spanish for yet. Cached; falls back to English. */
  var tcache = {};
  function toSpanish(text) {
    if (tcache[text]) return Promise.resolve(tcache[text]);
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=' + encodeURIComponent(text),
      ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(to);
        var out = (j[0] || []).map(function (x) { return x[0]; }).join('').trim();
        if (!out) throw 0;
        tcache[text] = out; return out;
      });
  }

  function firstSentence(t) { var m = (t || '').match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t || '').trim(); }
  function clean(t) { return String(t || '').replace(/\bJan\./g,'January').replace(/\bFeb\./g,'February').replace(/\bAug\./g,'August').replace(/\bSept?\./g,'September').replace(/\bOct\./g,'October').replace(/\bNov\./g,'November').replace(/\bDec\./g,'December').replace(/\bSt\./g,'Saint').replace(/\bMt\./g,'Mount').replace(/\bDr\./g,'Doctor').replace(/\bU\.S\./g,'U S').replace(/\bI-(\d+)/g, 'I $1').replace(/\bNWS\b/g, 'the National Weather Service').replace(/\s[—–]\s/g, ', ').replace(/\s+/g, ' ').trim(); }

  /* what she says for one report: headline plus the first line of the summary */
  function script(r) {
    var t = '';
    if (/HEARD/i.test(r.kind || '') || r.confidence === 'unconfirmed') t += 'Unconfirmed, from public radio traffic. ';
    t += clean(r.headline).replace(/[.\s]+$/, '') + '. ' + firstSentence(clean(r.summary));
    return clean(t).slice(0, 420);
  }

  /* Spanish the newsroom wrote itself (feed fields headline_es / summary_es) beats machine translation */
  function scriptEs(r) {
    if (!r || !r.headline_es) return '';
    var t = '';
    if (/HEARD/i.test(r.kind || '') || r.confidence === 'unconfirmed') t += 'Sin confirmar, seg\u00fan el tr\u00e1fico de radio p\u00fablico. ';
    t += String(r.headline_es).replace(/[.\s]+$/, '') + '. ' + firstSentence(r.summary_es || '');
    return t.trim().slice(0, 460);
  }

  function vids() { return [].slice.call(document.querySelectorAll('video[src*="claudia-onair"]')); }
  function playVideo() { vids().forEach(function (v) { v.muted = true; v.loop = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }); }
  function setTag(on) {
    document.querySelectorAll('.cg-cam .cg-tag').forEach(function (t) {
      t.textContent = on ? (lang() === 'es' ? 'Al aire' : 'Reporting') : (t.getAttribute('data-idle') || (lang() === 'es' ? 'En cámara' : 'On camera'));
    });
  }
  function setBtn() {
    document.querySelectorAll('.cg-snd').forEach(function (b) { b.textContent = enabled ? (lang() === 'es' ? 'Detener voz' : 'Stop voice') : (lang() === 'es' ? 'Activar voz' : 'Enable voice'); });
  }
  function cancelAudio() {
    if (!activeAudio) return;
    try { activeAudio.pause(); activeAudio.currentTime = 0; } catch (e) {}
    activeAudio = null;
  }

  /* speak one block of text in short chunks (long utterances get cut off by Chrome) */
  function speakText(text, my, done, l) {
    l = l || 'en';
    var parts = text.match(/[^.!?]+[.!?]*/g) || [text], i = 0;
    (function step() {
      if (my !== token) return;
      if (i >= parts.length) return done();
      var s = parts[i++].trim(); if (!s) return step();
      var u = new SpeechSynthesisUtterance(s), v = pickVoice(l);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = (l === 'es') ? 'es-US' : 'en-US'; }
      u.rate = C.rate; u.pitch = C.pitch;
      u.onend = step; u.onerror = function () { if (my === token) done(); };
      synth.speak(u);
    })();
  }
  function playAudio(url, my, done, fallbackText, l) {
    var a = new Audio(url), ended = false;
    activeAudio = a;
    function fin(failed) {
      if (ended) return;
      ended = true;
      if (activeAudio === a) activeAudio = null;
      if (my !== token) return;
      if (failed) speakText(fallbackText, my, done, l); else done();
    }
    a.onended = function () { fin(false); }; a.onerror = function () { fin(true); };
    var p = a.play(); if (p && p.catch) p.catch(function () { fin(true); });
  }

  function next() {
    if (busy || !enabled || !queue.length) return;
    busy = true; setTag(true); playVideo();
    var item = queue.shift(), my = token;
    function done() { if (my !== token) return; busy = false; setTag(false); playVideo(); next(); }
    resolve(item).then(function (x) {
      if (my !== token) return;
      if (x.audio) playAudio(x.audio, my, done, x.text, x.lang); else speakText(x.text, my, done, x.lang);
    }).catch(function () {
      if (my === token) done();
    });
  }

  /* pick audio/text for the visitor's language */
  function resolve(item) {
    if (lang() !== 'es') return Promise.resolve({ audio: item.audio, text: item.text, lang: 'en' });
    if (item.es) return Promise.resolve({ audio: '', text: item.es, lang: 'es' });

    /* Always prepare Spanish fallback text before attempting rendered Spanish audio.
       This prevents an audio playback error from accidentally reading English aloud. */
    var spanishText = item.textEs ? Promise.resolve(item.textEs) : toSpanish(item.text);
    return spanishText.then(function (t) {
      return { audio: item.audioEs || '', text: t, lang: 'es' };
    }).catch(function () {
      var notice = 'No puedo leer este reporte en español en este momento. La traducción no está disponible.';
      return { audio: item.audioEs || '', text: notice, lang: 'es', translationUnavailable: true };
    });
  }

  function items(d) {
    return (d.reports || []).slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); }); /* newest first */
  }
  function toItem(r) { return { audio: r.audio || '', text: script(r), audioEs: r.audio_es || '', textEs: scriptEs(r) }; }

  function loadFeed() {
    return fetch(C.feedUrl + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); });
  }

  /* new reports after she is on */
  function poll() {
    if (document.hidden) return;
    loadFeed().then(function (d) {
      var list = items(d);
      if (seen === null) { seen = {}; list.forEach(function (r) { seen[r.id] = 1; }); return; }
      var fresh = list.filter(function (r) { return !seen[r.id]; });
      fresh.forEach(function (r) { seen[r.id] = 1; });
      if (enabled && fresh.length) { fresh.reverse().forEach(function (r) { queue.push(toItem(r)); }); next(); }
    }).catch(function () {});
  }

  function start() {
    enabled = true; token++; busy = false; queue = []; cancelAudio(); setBtn(); playVideo();
    try { synth.cancel(); } catch (e) {}
    /* spoken straight from the tap so the browser allows sound; then the briefing follows */
    queue.push({ audio: '', text: 'Claudia Green, 423 dot news. Here are the latest reports, newest first.', es: 'Claudia Green, cuatro dos tres punto news. Estos son los reportes m\u00e1s recientes, del m\u00e1s nuevo al m\u00e1s antiguo.' });
    next();
    loadFeed().then(function (d) {
      var list = items(d);
      seen = {}; list.forEach(function (r) { seen[r.id] = 1; });
      list.slice(0, C.briefing).forEach(function (r) { queue.push(toItem(r)); });
      queue.push({ audio: '', text: "That's the latest from 423 dot news.", es: 'Eso es lo \u00faltimo de cuatro dos tres punto news.' });
      next();
    }).catch(function () {
      queue.push({ audio: '', text: 'I could not load the reports right now.', es: 'No pude cargar los reportes en este momento.' }); next();
    });
  }
  function stop() {
    enabled = false; token++; busy = false; queue = []; cancelAudio();
    try { synth.cancel(); } catch (e) {}
    setTag(false); setBtn(); playVideo();
  }

  function wire() {
    playVideo();
    document.querySelectorAll('.cg-snd').forEach(function (b) {
      b.removeAttribute('onclick'); b.textContent = lang() === 'es' ? 'Activar voz' : 'Enable voice';
      b.onclick = function () {
        if (!synth) { b.textContent = 'Voice not supported'; return; }
        enabled ? stop() : start();
      };
    });
  }
  document.addEventListener('DOMContentLoaded', function () { wire(); poll(); setInterval(poll, C.pollSeconds * 1000); });
  new MutationObserver(function () { if (!document.hidden) playVideo(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.ClaudiaVoice = { voices: function () { return synth ? synth.getVoices().map(function (v) { return v.name + ' (' + v.lang + ')'; }) : []; }, setVoice: function (n) { set('cgVoice', n); }, setVoiceEs: function (n) { set('cgVoiceEs', n); } };
})();
