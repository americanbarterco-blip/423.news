/* 423.news — Claudia Green LiveKit voice widget.
   LiveKit API credentials remain server-side in Cloudflare Worker secrets. */
(function () {
  "use strict";
  var TOKEN_ENDPOINT = "https://voice-api.423.news/getToken";
  var css = `
    #cg-livekit-launch{position:fixed;right:18px;bottom:86px;z-index:9998;border:1px solid #e8392f;border-radius:999px;background:#171b24;color:#fff;padding:12px 17px;font:700 13px system-ui;box-shadow:0 8px 28px #0008;cursor:pointer}
    #cg-livekit-panel{position:fixed;right:18px;bottom:142px;z-index:9999;width:min(340px,calc(100vw - 36px));padding:18px;border:1px solid #354052;border-radius:16px;background:#101722;color:#f3eee4;box-shadow:0 18px 50px #000a;font:14px/1.5 system-ui;display:none}
    #cg-livekit-panel h2{font:700 19px Georgia,serif;margin:0 0 6px}
    #cg-livekit-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
    #cg-livekit-close{border:1px solid #596579;border-radius:8px;padding:6px 10px;background:#202b3a;color:#fff;font-weight:700;cursor:pointer}
    #cg-livekit-status{color:#b9c4d3;font-size:13px;min-height:38px;margin:8px 0}
    #cg-livekit-actions{display:flex;gap:8px;flex-wrap:wrap}
    #cg-livekit-actions button{border:1px solid #596579;border-radius:9px;padding:9px 12px;background:#202b3a;color:white;font-weight:700}
    #cg-livekit-actions button.primary{background:#b72d2a;border-color:#e8392f}
    #cg-3d{position:relative;height:min(300px,36vh);margin:-18px -18px 12px;border-radius:16px 16px 0 0;overflow:hidden;background:#e9eaec;display:flex;justify-content:center}
    #cg-3d video,#cg-3d img{height:100%;width:auto;max-width:100%;object-fit:contain;display:block}
    #cg-3d .cg-3d-msg{position:absolute;inset:auto 0 10px 0;text-align:center;font:600 12px system-ui;color:#35566b;pointer-events:none}
    #cg-livekit-note{font-size:11px;color:#9ba7b8;margin-top:12px}
  `;
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  var launch = document.createElement("button");
  launch.id = "cg-livekit-launch";
  launch.type = "button";
  launch.textContent = "🎙 Talk to Claudia";
  launch.setAttribute("aria-expanded", "false");
  document.body.appendChild(launch);
  var panel = document.createElement("section");
  panel.id = "cg-livekit-panel";
  panel.setAttribute("aria-label", "Talk with Claudia Green");
  panel.innerHTML = '<div id="cg-3d" aria-label="Claudia Green video"><div class="cg-3d-msg">Loading Claudia…</div></div><div id="cg-livekit-header"><h2>Claudia Green</h2><button id="cg-livekit-close" type="button" aria-label="Close chat">✕</button></div><div>423.news virtual voice assistant</div><div id="cg-livekit-status" role="status">Ready when you are.</div><div id="cg-livekit-actions"><button class="primary" id="cg-livekit-start" type="button">Start voice chat</button><button id="cg-livekit-stop" type="button" disabled>End chat</button></div><div id="cg-livekit-note">Microphone access is required. Claudia is an AI assistant, not an emergency service.</div>';
  document.body.appendChild(panel);
  var status = panel.querySelector("#cg-livekit-status");
  var close = panel.querySelector("#cg-livekit-close");
  close.addEventListener("click", function () { panel.style.display = "none"; launch.setAttribute("aria-expanded", "false"); });
  var start = panel.querySelector("#cg-livekit-start");
  var stop = panel.querySelector("#cg-livekit-stop");
  var room = null, busy = false, attachedAudio = [], connectAttempt = 0, tokenRequest = null;
  function setStatus(message) { status.textContent = message; }
  function setBusy(value) { busy = value; start.disabled = value || !!room; stop.disabled = !(room || value); }
  launch.addEventListener("click", function () {
    var open = panel.style.display === "block";
    panel.style.display = open ? "none" : "block";
    launch.setAttribute("aria-expanded", String(!open));
  });

  /* Chat panel visual: Claudia's muted video (no audio), starts when the panel opens, pauses when it closes. */
  var box = panel.querySelector("#cg-3d"), cgVid = null, building = false;
  function buildVideo(d) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var msg = box.querySelector(".cg-3d-msg"); if (msg) msg.remove();
    if (reduce) { box.innerHTML = '<img alt="Claudia Green" src="' + d.poster + '">'; return; }
    cgVid = document.createElement("video");
    cgVid.muted = true; cgVid.defaultMuted = true; cgVid.loop = true; cgVid.playsInline = true; cgVid.setAttribute("playsinline", "");
    cgVid.setAttribute("aria-label", "Claudia Green, recorded video"); cgVid.poster = d.poster; cgVid.src = d.video;
    box.insertBefore(cgVid, box.firstChild); syncVideo();
  }
  function ensureVideo() {
    if (cgVid || building) return; building = true;
    if (window.CG_SPEAK_VIDEO) return buildVideo(window.CG_SPEAK_VIDEO);
    var sc = document.createElement("script"); sc.src = "/claudia-speak-video.js";
    sc.onload = function () { if (window.CG_SPEAK_VIDEO) buildVideo(window.CG_SPEAK_VIDEO); };
    sc.onerror = function () { building = false; };
    document.head.appendChild(sc);
  }
  function syncVideo() {
    if (!cgVid) return;
    if (panel.style.display === "block") { var p = cgVid.play(); if (p && p.catch) p.catch(function () {}); } else { cgVid.pause(); }
  }
  new MutationObserver(function () { if (panel.style.display === "block") ensureVideo(); syncVideo(); }).observe(panel, { attributes: true, attributeFilter: ["style"] });
  launch.addEventListener("click", function () { window.setTimeout(function () { if (panel.style.display === "block") ensureVideo(); syncVideo(); }, 0); });
  start.addEventListener("click", async function () {
    if (busy || room) return;
    var attempt = ++connectAttempt;
    setBusy(true); setStatus("Contacting Claudia’s voice service…");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser does not support microphone access.");
      tokenRequest = new AbortController();
      var response = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: tokenRequest.signal });
      if (attempt !== connectAttempt) return;
      if (!response.ok) {
        var issue = await response.json().catch(function () { return {}; });
        throw new Error(issue.error || "Voice service is not ready yet.");
      }
      var credentials = await response.json();
      if (!credentials.server_url || !credentials.participant_token) throw new Error("The voice service returned incomplete connection details.");
      setStatus("Loading voice connection…");
      var lk;
      try {
        lk = await import("https://esm.sh/livekit-client@2.15.6");
      } catch (cdnError) {
        if (attempt !== connectAttempt) return;
        try { lk = await import("https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/+esm"); }
        catch (_) { throw new Error("Claudia’s voice library could not load. Please try again."); }
      }
      if (attempt !== connectAttempt) return;
      room = new lk.Room({ adaptiveStream: true, dynacast: true });
      room.on(lk.RoomEvent.TrackSubscribed, function (track) {
        if (track.kind === lk.Track.Kind.Audio) {
          var audio = track.attach(); audio.autoplay = true; document.body.appendChild(audio); attachedAudio.push(audio);
        }
      });
      room.on(lk.RoomEvent.Disconnected, function () {
        room = null; attachedAudio.forEach(function (audio) { audio.remove(); }); attachedAudio = [];
        setBusy(false); setStatus("Disconnected. You can start another chat.");
      });
      await room.connect(credentials.server_url, credentials.participant_token);
      if (attempt !== connectAttempt) return;
      await room.localParticipant.setMicrophoneEnabled(true);
      if (attempt !== connectAttempt) return;
      setBusy(false); setStatus("Connected. Claudia is joining — say hello!");
    } catch (error) {
      if (room) { try { await room.disconnect(); } catch (_) {} room = null; }
      if (attempt !== connectAttempt) return;
      if (error && error.name === "AbortError") setStatus("Connection cancelled.");
      else setStatus(error && error.message ? error.message : "Could not connect. Please try again.");
      setBusy(false);
    }
  });
  stop.addEventListener("click", async function () {
    if (!room && busy) {
      connectAttempt++;
      if (tokenRequest) { try { tokenRequest.abort(); } catch (_) {} tokenRequest = null; }
      setBusy(false); setStatus("Connection cancelled.");
      return;
    }
    if (!room) return;
    var active = room; room = null; connectAttempt++; setStatus("Ending voice chat…");
    try { await active.disconnect(); } catch (_) {}
    attachedAudio.forEach(function (audio) { audio.remove(); }); attachedAudio = [];
    setBusy(false); setStatus("Voice chat ended.");
  });
})();
