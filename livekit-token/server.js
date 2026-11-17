import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";

const ALLOWED_ORIGINS = new Set(["https://423.news", "https://www.423.news"]);

function json(data, status = 200, origin = null) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (!origin || !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }});
    }

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "423.news Claudia token worker" }, 200, origin);
    }
    if (url.pathname !== "/getToken" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, origin);
    }
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403);
    }
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      return json({ error: "Voice service is not configured yet." }, 503, origin);
    }

    try {
      const roomName = "423-news-claudia-" + crypto.randomUUID();
      const identity = "visitor-" + crypto.randomUUID();
      const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity,
        name: "423.news visitor",
        ttl: "10m"
      });
      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true
      });
      token.roomConfig = new RoomConfiguration({
        agents: [new RoomAgentDispatch({ agentName: "claudia-green" })]
      });
      const participantToken = await token.toJwt();
      return json({
        server_url: env.LIVEKIT_URL,
        participant_token: participantToken,
        room_name: roomName
      }, 201, origin);
    } catch (error) {
      console.error("LiveKit token generation failed:", error?.message || error);
      return json({ error: "Unable to start the voice session." }, 500, origin);
    }
  }
};
