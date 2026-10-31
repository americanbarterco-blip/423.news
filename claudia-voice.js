/* 423.news — Claudia Green voiceover.
   Tap "Enable voice": she reads the latest reports, newest to oldest, over her video, then reads
   each new report as it is filed. Uses her rendered audio (voice/<id>.mp3, see VOICE.md) when a
   report has it, otherwise the browser's own text-to-speech. The video never stops or gets sound.
   Settings: window.CLAUDIA_VOICE = { voiceName:'', rate:1, pitch:1, feedUrl:'feed.json', pollSeconds:30, briefing:12 } */
(function () {
  'use strict';
  var C = Object.assign({ voiceName: '', rate: 1, pitch: 1.05, feedUrl: 'feed.json', pollSeconds: 30, briefing: 12 }, window.CLAUDIA_VOICE || {});
  var synth = window.speechSynthesis;
  var enabled = false, seen = null, queue = [], busy = false, token = 0;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function pickVoice() {
    if (!synth) return null;
    var vs = synth.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); });
    if (!vs.length) return null;
    var want = (get('cgVoice') || C.voiceName || '').toLowerCase();
    if (want) { var m = vs.filter(function (v) { return v.name.toLowerCase() === want; })[0]; if (m) return m; }
    var prefs = [/aria|jenny|ava|emma|natural/i, /google us english/i, /samantha|allison|serena|karen|moira/i, /female|zira|susan/i];
    for (var i = 0; i < prefs.length; i++) { var f = vs.filter(function (v) { return prefs[i].test(v.name); })[0]; if (f) return f; }
    return vs.filter(function (v) { return /en-US/i.test(v.lang); })[0] || vs[0];
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

  function vids() { return [].slice.call(document.querySelectorAll('video[src*="claudia-onair"]')); }
  function playVideo() { vids().forEach(function (v) { v.muted = true; v.loop = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }); }
  function setTag(on) {
    document.querySelectorAll('.cg-cam .cg-tag').forEach(function (t) { t.textContent = on ? 'Reporting' : (t.getAttribute('data-idle') || 'On camera'); });
  }
  function setBtn() { document.querySelectorAll('.cg-snd').forEach(function (b) { b.textContent = enabled ? 'Stop voice' : 'Enable voice'; }); }

  /* speak one block of text in short chunks (long utterances get cut off by Chrome) */
  function speakText(text, my, done) {
    var parts = text.match(/[^.!?]+[.!?]*/g) || [text], i = 0;
    (function step() {
      if (my !== token) return;
      if (i >= parts.length) return done();
      var s = parts[i++].trim(); if (!s) return step();
      var u = new SpeechSynthesisUtterance(s), v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = C.rate; u.pitch = C.pitch;
      u.onend = step; u.onerror = function () { if (my === token) done(); };
      synth.speak(u);
    })();
  }
  function playAudio(url, my, done, fallbackText) {
    var a = new Audio(url), ended = false;
    function fin(failed) { if (ended) return; ended = true; if (my !== token) return; if (failed) speakText(fallbackText, my, done); else done(); }
    a.onended = function () { fin(false); }; a.onerror = function () { fin(true); };
    var p = a.play(); if (p && p.catch) p.catch(function () { fin(true); });
  }

  function next() {
    if (busy || !enabled || !queue.length) return;
    busy = true; setTag(true); playVideo();
    var item = queue.shift(), my = token;
    function done() { if (my !== token) return; busy = false; setTag(false); playVideo(); next(); }
    if (item.audio) playAudio(item.audio, my, done, item.text); else speakText(item.text, my, done);
  }

  function items(d) {
    return (d.reports || []).slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); }); /* newest first */
  }
  function toItem(r) { return { audio: r.audio || '', text: script(r) }; }

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
    enabled = true; token++; busy = false; queue = []; setBtn(); playVideo();
    try { synth.cancel(); } catch (e) {}
    /* spoken straight from the tap so the browser allows sound; then the briefing follows */
    queue.push({ audio: '', text: 'Claudia Green, 423 dot news. Here are the latest reports, newest first.' });
    next();
    loadFeed().then(function (d) {
      var list = items(d);
      seen = {}; list.forEach(function (r) { seen[r.id] = 1; });
      list.slice(0, C.briefing).forEach(function (r) { queue.push(toItem(r)); });
      queue.push({ audio: '', text: "That's the latest from 423 dot news." });
      next();
    }).catch(function () {
      queue.push({ audio: '', text: 'I could not load the reports right now.' }); next();
    });
  }
  function stop() {
    enabled = false; token++; busy = false; queue = [];
    try { synth.cancel(); } catch (e) {}
    setTag(false); setBtn(); playVideo();
  }

  function wire() {
    playVideo();
    document.querySelectorAll('.cg-snd').forEach(function (b) {
      b.removeAttribute('onclick'); b.textContent = 'Enable voice';
      b.onclick = function () {
        if (!synth) { b.textContent = 'Voice not supported'; return; }
        enabled ? stop() : start();
      };
    });
  }
  document.addEventListener('DOMContentLoaded', function () { wire(); poll(); setInterval(poll, C.pollSeconds * 1000); });
  new MutationObserver(function () { if (!document.hidden) playVideo(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.ClaudiaVoice = { voices: function () { return synth ? synth.getVoices().map(function (v) { return v.name + ' (' + v.lang + ')'; }) : []; }, setVoice: function (n) { set('cgVoice', n); } };
})();
