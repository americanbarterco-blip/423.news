/* Optional live-map browser client. Configure window.CLAUDIA_INCIDENTS_WS before loading.
   Emits "claudia:incident" CustomEvents for the existing map UI to consume. */
(function () {
  "use strict";
  var url = window.CLAUDIA_INCIDENTS_WS;
  if (!url || !("WebSocket" in window)) return;
  var ws;
  try { ws = new WebSocket(url); } catch (_) { return; }
  ws.addEventListener("message", function (event) {
    try {
      var packet = JSON.parse(event.data);
      if (packet && packet.incident_id && packet.title) {
        window.dispatchEvent(new CustomEvent("claudia:incident", { detail: packet }));
      }
    } catch (_) { /* ignore malformed packets */ }
  });
  ws.addEventListener("error", function () { /* no UI disruption when service is offline */ });
})();
