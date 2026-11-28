/* 423.news — Claudia Green LiveKit voice widget.
   LiveKit API credentials remain server-side in Cloudflare Worker secrets. */
(function () {
  "use strict";
  if (window.__CG_LIVEKIT_INITIALIZED) return;
  window.__CG_LIVEKIT_INITIALIZED = true;
  var TOKEN_ENDPOINT = "https://voice-api.423.news/getToken";
  var css = `
    #cg-livekit-launch{position:fixed;right:18px;bottom:86px;z-index:9998;border:1px solid #e8392f;border-radius:999px;background:#171b24;color:#fff;padding:12px 17px;font:700 13px system-ui;box-shadow:0 8px 28px #0008;cursor:pointer}
    #cg-livekit-panel{position:fixed;right:18px;bottom:142px;z-index:9999;width:min(340px,calc(100vw - 36px));max-height:calc(100dvh - 170px);overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:18px;border:1px solid #354052;border-radius:16px;background:#101722;color:#f3eee4;box-shadow:0 18px 50px #000a;font:14px/1.5 system-ui;display:none}
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
    #cg-livekit-text-toggle{margin-top:9px;border:0;background:transparent;color:#d5e2f0;text-decoration:underline;padding:7px 2px;font:600 12px system-ui;cursor:pointer}
    #cg-livekit-script[hidden]{display:none}
    #cg-livekit-script{margin-top:8px;padding:10px;border:1px solid #354052;border-radius:10px;background:#0b1420}
    #cg-livekit-script-log{min-height:48px;max-height:34vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;margin-bottom:8px}
    #cg-livekit-script-log p{margin:6px 0;padding:7px 9px;border-radius:8px;background:#1b2b3e}
    #cg-livekit-script-entry{width:100%;min-height:150px;max-height:42vh;resize:vertical;box-sizing:border-box;background:#09121c;border:1px solid #596579;border-radius:8px;padding:12px;color:#fff;font:inherit;line-height:1.5;white-space:pre-wrap}
    #cg-livekit-script-send{margin-top:7px;width:100%;border:1px solid #596579;border-radius:8px;padding:9px;background:#223347;color:white;font-weight:700}
    #cg-download-claudia{display:block;width:100%;margin-top:12px;border:1px solid #258c67;border-radius:10px;padding:10px 12px;background:#123d32;color:#eafff5;font:700 13px system-ui;cursor:pointer}
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
  panel.innerHTML = '<div id="cg-3d" aria-label="Claudia Green video"><div class="cg-3d-msg">Loading Claudia…</div></div><div id="cg-livekit-header"><h2>Claudia Green</h2><button id="cg-livekit-close" type="button" aria-label="Close chat">✕</button></div><div>423.news virtual voice assistant</div><div id="cg-livekit-status" role="status">Ready when you are.</div><div id="cg-livekit-actions"><button class="primary" id="cg-livekit-start" type="button">Start voice chat</button><button id="cg-livekit-stop" type="button" disabled>End chat</button></div><button id="cg-livekit-text-toggle" type="button">Use text instead</button><div id="cg-livekit-script" hidden><div id="cg-livekit-script-log" role="log" aria-live="polite"></div><textarea id="cg-livekit-script-entry" maxlength="6000" rows="6" autocomplete="off" autocapitalize="sentences" spellcheck="true" aria-label="Message Claudia" placeholder="Write a message to Claudia…"></textarea><button id="cg-livekit-script-send" type="button">Send</button></div><button id="cg-download-claudia" type="button">📲 Download Claudia</button><div id="cg-livekit-note">Voice and text options are available. Claudia is an AI assistant, not an emergency service.</div>';
  document.body.appendChild(panel);
  var status = panel.querySelector("#cg-livekit-status");
  var close = panel.querySelector("#cg-livekit-close");
  close.addEventListener("click", function () { panel.style.display = "none"; launch.setAttribute("aria-expanded", "false"); });
  var downloadClaudia = panel.querySelector("#cg-download-claudia");
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  var isClaudiaAppPage = /^\/claudia(?:\/|$)/.test(window.location.pathname);
  var isClaudiaStandalone = isClaudiaAppPage && isStandalone;
  var installPrompt = null;
  /* Do not infer that Claudia is installed merely because 423.news is running standalone. */
  downloadClaudia.hidden = false;
  window.addEventListener("beforeinstallprompt", function (event) {
    /* Only the /claudia/ page has Claudia's manifest. Never capture 423.news' install prompt. */
    if (!isClaudiaAppPage || isStandalone) return;
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", function () {
    if (!isClaudiaAppPage) return;
    downloadClaudia.hidden = true;
    setStatus("Claudia has been added to your home screen.");
  });
  downloadClaudia.addEventListener("click", async function () {
    /* Cross to Claudia's independent origin. This leaves the 423.news PWA
       scope entirely and avoids Android intent-scheme handoff failures. */
    if (!isClaudiaAppPage) {
      window.location.href = "https://claudia.423.news/";
      return;
    }
    if (installPrompt) {
      var promptEvent = installPrompt;
      installPrompt = null;
      await promptEvent.prompt();
      var choice = await promptEvent.userChoice;
      if (choice && choice.outcome === "accepted") {
        downloadClaudia.hidden = true;
        setStatus("Claudia is being installed.");
      } else {
        setStatus("Installation was not completed. You can try again from your browser menu.");
      }
      return;
    }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setStatus("In Safari, tap Share, choose Add to Home Screen, then tap Add.");
      return;
    }
    if (/android/i.test(navigator.userAgent)) {
      setStatus("In Chrome, tap the menu (⋮), choose Install app or Add to Home screen, and confirm.");
      return;
    }
    setStatus("Use your browser menu and choose Install Claudia or Add to Home Screen.");
  });
  var start = panel.querySelector("#cg-livekit-start");
  var stop = panel.querySelector("#cg-livekit-stop");
  var textToggle = panel.querySelector("#cg-livekit-text-toggle");
  var scriptPanel = panel.querySelector("#cg-livekit-script");
  var scriptLog = panel.querySelector("#cg-livekit-script-log");
  var scriptEntry = panel.querySelector("#cg-livekit-script-entry");
  var scriptSend = panel.querySelector("#cg-livekit-script-send");
  var scriptSessionId = null;
  var room = null, busy = false, attachedAudio = [], textMode = false;
  function setStatus(message) { status.textContent = message; }
  function setBusy(value) { busy = value; start.disabled = value || !!room; stop.disabled = !room; }
  function addScriptReply(message) {
    var line = document.createElement("p");
    line.textContent = String(message || "");
    scriptLog.appendChild(line);
    scriptLog.scrollTop = scriptLog.scrollHeight;
  }
  async function ensureTextRoom() {
    if (room) return;
    if (busy) return;
    busy = true; textMode = true; scriptSend.disabled = true; setStatus("Connecting to Claudia…");
    try {
      var lk = await import("https://esm.sh/livekit-client@2.15.6");
      var adminSession = window.sessionStorage.getItem("t423") || "";
      var tokenRequest = adminSession ? { role: "administrator", admin_session_token: adminSession } : {};
      if (window.location.pathname === "/claudia-workspace.html" && !adminSession) throw new Error("Administrator session unavailable. Sign in again.");
      var response = await fetch(TOKEN_ENDPOINT, { method: "POST", mode: "cors", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tokenRequest) });
      var credentials = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(credentials.error || "Claudia text chat is unavailable.");
      room = new lk.Room({ adaptiveStream: true, dynacast: true });
      room.registerTextStreamHandler("lk.transcription", async function (reader, participantInfo) {
        try { var message = await reader.readAll(); if (message && participantInfo && participantInfo.identity !== room.localParticipant.identity) addScriptReply("Claudia: " + message); }
        catch (_) {}
      });
      room.on(lk.RoomEvent.Disconnected, function () {
        room = null; textMode = false; scriptSend.disabled = false; setStatus("Chat disconnected. Tap Send to reconnect.");
      });
      await room.connect(credentials.server_url, credentials.participant_token);
      busy = false; scriptSend.disabled = false; setStatus("Text chat connected. Send Claudia a message.");
    } catch (error) {
      room = null; busy = false; textMode = false; scriptSend.disabled = false;
      setStatus(error && error.message ? error.message : "Could not connect to Claudia.");
      throw error;
    }
  }
  async function sendScriptAnswer() {
    var answer = scriptEntry.value.trim();
    if (!answer || scriptSend.disabled) return;
    scriptSend.disabled = true; scriptEntry.disabled = true;
    try {
      await ensureTextRoom();
      if (!room) throw new Error("Text chat is not connected.");
      addScriptReply("You: " + answer);
      await room.localParticipant.sendText(answer, { topic: "lk.chat" });
      scriptEntry.value = "";
      setStatus("Message sent to Claudia.");
    } catch (error) { setStatus(error && error.message ? error.message : "Message could not be sent."); }
    finally { scriptEntry.disabled = false; scriptSend.disabled = false; scriptEntry.focus(); }
  }
  textToggle.addEventListener("click", function () {
    scriptPanel.hidden = !scriptPanel.hidden;
    if (!scriptPanel.hidden) { scriptEntry.focus(); ensureTextRoom().catch(function () {}); }
  });
  scriptSend.addEventListener("click", sendScriptAnswer);
  scriptEntry.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); sendScriptAnswer(); }
  });
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
    setBusy(true); setStatus("Connecting securely…");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser does not support microphone access.");
      var lk = await import("https://esm.sh/livekit-client@2.15.6");
      var tokenRequest = {};
      var adminSession = window.sessionStorage.getItem("t423") || "";
      if (adminSession) {
        tokenRequest = { role: "administrator", admin_session_token: adminSession };
      } else if (window.location.pathname === "/claudia-workspace.html") {
        throw new Error("The administrator session is unavailable. Return to the Admin area and reopen Claudia.");
      }
      var response = await fetch(TOKEN_ENDPOINT, { method: "POST", mode: "cors", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tokenRequest) });
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
    setBusy(false); textMode = false; scriptSend.disabled = false; setStatus("Voice chat ended.");
  });
})();
