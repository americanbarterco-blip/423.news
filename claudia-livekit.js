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
    #cg-3d{position:relative;height:min(300px,34vh);margin:-18px -18px 12px;border-radius:16px 16px 0 0;overflow:hidden;background:radial-gradient(ellipse at 50% 35%,#12425f 0,#08182a 70%)}
    #cg-3d model-viewer{width:100%;height:100%;background:transparent;--poster-color:transparent;--progress-bar-color:#35d1eb}
    #cg-3d .cg-3d-msg{position:absolute;inset:auto 0 10px 0;text-align:center;font:600 12px system-ui;color:#9fdcf0;pointer-events:none}
    #cg-3d img{width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block}
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
  panel.innerHTML = '<div id="cg-3d" aria-label="Claudia Green, 3D view"><div class="cg-3d-msg">Loading Claudia…</div></div><div id="cg-livekit-header"><h2>Claudia Green</h2><button id="cg-livekit-close" type="button" aria-label="Close chat">✕</button></div><div>423.news virtual voice assistant</div><div id="cg-livekit-status" role="status">Ready when you are.</div><div id="cg-livekit-actions"><button class="primary" id="cg-livekit-start" type="button">Start voice chat</button><button id="cg-livekit-stop" type="button" disabled>End chat</button></div><div id="cg-livekit-note">Microphone access is required. Claudia is an AI assistant, not an emergency service.</div>';
  document.body.appendChild(panel);
  var status = panel.querySelector("#cg-livekit-status");
  var close = panel.querySelector("#cg-livekit-close");
  close.addEventListener("click", function () { panel.style.display = "none"; launch.setAttribute("aria-expanded", "false"); });
  var start = panel.querySelector("#cg-livekit-start");
  var stop = panel.querySelector("#cg-livekit-stop");
  var room = null, busy = false, attachedAudio = [];
  function setStatus(message) { status.textContent = message; }
  function setBusy(value) { busy = value; start.disabled = value || !!room; stop.disabled = !room; }
  launch.addEventListener("click", function () {
    var open = panel.style.display === "block";
    panel.style.display = open ? "none" : "block";
    launch.setAttribute("aria-expanded", String(!open));
  });

  /* 3D anchor model: loads the first time the chat panel opens. Faces front; small side-to-side sway only. */
  var MODEL_URL = "/claudia-anchor.glb";
  var MV_URL = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
  var FALLBACK_IMG = "data:image/webp;base64,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";
  var box = panel.querySelector("#cg-3d"), loaded3d = false;
  function show2d() {
    box.innerHTML = '<img src="' + FALLBACK_IMG + '" alt="Claudia Green">';
  }
  function load3d() {
    if (loaded3d) return; loaded3d = true;
    var msg = box.querySelector(".cg-3d-msg");
    import(MV_URL).then(function () {
      var mv = document.createElement("model-viewer");
      mv.setAttribute("src", MODEL_URL);
      mv.setAttribute("alt", "Claudia Green, 423.news anchor, 3D model facing forward");
      mv.setAttribute("camera-orbit", "0deg 84deg 85%");
      mv.setAttribute("camera-target", "0m 0.22m 0m");
      mv.setAttribute("min-camera-orbit", "-25deg 70deg auto");
      mv.setAttribute("max-camera-orbit", "25deg 98deg auto");
      mv.setAttribute("field-of-view", "30deg");
      mv.setAttribute("camera-controls", "");
      mv.setAttribute("disable-zoom", "");
      mv.setAttribute("disable-pan", "");
      mv.setAttribute("touch-action", "pan-y");
      mv.setAttribute("interaction-prompt", "none");
      mv.setAttribute("shadow-intensity", "0");
      mv.setAttribute("exposure", "1.15");
      mv.setAttribute("environment-image", "neutral");
      mv.addEventListener("load", function () { if (msg) msg.remove(); });
      mv.addEventListener("error", show2d);
      box.insertBefore(mv, box.firstChild);
    }).catch(show2d);
  }
  new MutationObserver(function () { if (panel.style.display === "block") load3d(); }).observe(panel, { attributes: true, attributeFilter: ["style"] });
  launch.addEventListener("click", function () { window.setTimeout(function () { if (panel.style.display === "block") load3d(); }, 0); });
  start.addEventListener("click", async function () {
    if (busy || room) return;
    setBusy(true); setStatus("Connecting securely…");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser does not support microphone access.");
      var lk = await import("https://esm.sh/livekit-client@2.15.6");
      var response = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) {
        var issue = await response.json().catch(function () { return {}; });
        throw new Error(issue.error || "Voice service is not ready yet.");
      }
      var credentials = await response.json();
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
      await room.localParticipant.setMicrophoneEnabled(true);
      setBusy(false); setStatus("Connected. Claudia is joining — say hello!");
    } catch (error) {
      if (room) { try { await room.disconnect(); } catch (_) {} room = null; }
      setBusy(false); setStatus(error && error.message ? error.message : "Could not connect. Please try again.");
    }
  });
  stop.addEventListener("click", async function () {
    if (!room) return;
    var active = room; room = null; setStatus("Ending voice chat…");
    try { await active.disconnect(); } catch (_) {}
    attachedAudio.forEach(function (audio) { audio.remove(); }); attachedAudio = [];
    setBusy(false); setStatus("Voice chat ended.");
  });
})();
