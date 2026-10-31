/* 423.news — Claudia Green voiceover.
   The clip of Claudia stays muted and loops; every NEW report in feed.json is read aloud over it
   with the browser's text-to-speech. Browsers only allow speech after a click, so the viewer
   taps "Enable voice" once (remembered on that device).
   Optional settings: window.CLAUDIA_VOICE = { voiceName:'', rate:1, pitch:1, feedUrl:'feed.json', pollSeconds:30 } */
(function () {
  'use strict';
  var C = Object.assign({ voiceName: '', rate: 1, pitch: 1.05, feedUrl: 'feed.json', pollSeconds: 30, maxChars: 700 }, window.CLAUDIA_VOICE || {});
  if (!('speechSynthesis' in window)) return;
  var synth = window.speechSynthesis, enabled = false, seen = null, queue = [], busy = false;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* default voice: named one if present, else the best-sounding English female-leaning voice available */
  function pickVoice() {
    var vs = synth.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); });
    if (!vs.length) return null;
    var want = (get('cgVoice') || C.voiceName || '').toLowerCase();
    if (want) { var m = vs.filter(function (v) { return v.name.toLowerCase() === want; })[0]; if (m) return m; }
    var prefs = [/aria|jenny|ava|emma|natural/i, /google us english/i, /samantha|allison|ava|serena|karen|moira/i, /female|zira|susan/i];
    for (var i = 0; i < prefs.length; i++) { var f = vs.filter(function (v) { return prefs[i].test(v.name); })[0]; if (f) return f; }
    return vs.filter(function (v) { return /en-US/i.test(v.lang); })[0] || vs[0];
  }

  function script(r) {
    var t = 'Claudia Green, 423 dot news. ';
    if (/HEARD/i.test(r.kind || '') || r.confidence === 'unconfirmed') t += 'Unconfirmed, from public radio traffic. ';
    t += (r.headline || '') + '. ' + (r.summary || '');
    (r.safety || []).slice(0, 1).forEach(function (s) { t += ' Safety: ' + s; });
    return t.replace(/\s+/g, ' ').slice(0, C.maxChars);
  }

  function vids() { return [].slice.call(document.querySelectorAll('video[src*="claudia-onair"]')); }
  function setTag(on) {
    document.querySelectorAll('.cg-cam .cg-tag').forEach(function (t) { t.textContent = on ? 'Reporting' : (t.getAttribute('data-idle') || 'On camera'); });
  }
  function keepSilent() { vids().forEach(function (v) { v.muted = true; v.loop = true;
    if (enabled && !busy) { v.pause(); try { v.currentTime = 0; } catch (e) {} return; } /* idle: rests on her first frame */
    var p = v.play(); if (p && p.catch) p.catch(function () {}); }); }

  function next() {
    if (busy || !queue.length || !enabled) return;
    busy = true;
    var item = queue.shift();
    if (item && item.audio) { /* her rendered voice (voice_render.py) */
      var a = new Audio(item.audio); setTag(true); keepSilent();
      var done = function (failed) { busy = false; setTag(false); keepSilent(); if (failed) queue.unshift(item.text); next(); };
      a.onended = function () { done(false); }; a.onerror = function () { done(true); };
      var pp = a.play(); if (pp && pp.catch) pp.catch(function () { done(true); });
      return;
    }
    var u = new SpeechSynthesisUtterance(item && item.text ? item.text : item);
    var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = C.rate; u.pitch = C.pitch;
    u.onstart = function () { busy = true; setTag(true); keepSilent(); };
    u.onend = u.onerror = function () { busy = false; setTag(false); keepSilent(); next(); };
    synth.speak(u);
  }

  function poll() {
    if (document.hidden) return;
    fetch(C.feedUrl + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      var list = (d.reports || []).slice().sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
      if (seen === null) { seen = {}; list.forEach(function (r) { seen[r.id] = 1; }); return; } /* existing reports are not re-read */
      list.forEach(function (r) { if (!seen[r.id]) { seen[r.id] = 1; if (enabled) queue.push(r.audio ? { audio: r.audio, text: script(r) } : script(r)); } });
      next();
    }).catch(function () {});
  }

  function toggle(btn) {
    enabled = !enabled; set('cgVoiceOn', enabled ? '1' : '0');
    if (!enabled) { synth.cancel(); queue = []; busy = false; setTag(false); }
    else { var u = new SpeechSynthesisUtterance('Voice on.'); var v = pickVoice(); if (v) u.voice = v; u.volume = .6; synth.speak(u); }
    document.querySelectorAll('.cg-snd').forEach(function (b) { b.textContent = enabled ? 'Voice on' : 'Enable voice'; });
    keepSilent();
  }

  function wire() {
    keepSilent();
    document.querySelectorAll('.cg-snd').forEach(function (b) {
      b.removeAttribute('onclick'); b.textContent = 'Enable voice';
      b.onclick = function () { toggle(b); };
    });
    /* a returning visitor still has to tap once: browsers require a click before speech */
  }
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = function () {};
  document.addEventListener('DOMContentLoaded', function () { wire(); poll(); setInterval(poll, C.pollSeconds * 1000); });
  new MutationObserver(function () { keepSilent(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.ClaudiaVoice = { speak: function (t) { if (enabled) { queue.push(t); next(); } }, voices: function () { return synth.getVoices().map(function (v) { return v.name + ' (' + v.lang + ')'; }); },
    setVoice: function (n) { set('cgVoice', n); } };
})();
