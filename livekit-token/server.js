import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";

const ALLOWED_ORIGINS = new Set(["https://423.news", "https://www.423.news", "https://claudia.423.news"]);

// Matches the administrator session format issued by Supabase function "admin":
// <unix-milliseconds-expiry>.<hex HMAC-SHA256>. The shared secret is server-only.
export async function verifyAdminSession(token, secret, now = Date.now()) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return false;
  const expiry = Number(parts[0]);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 12 * 60 * 60 * 1000 + 60_000) return false;
  if (!/^[a-f0-9]{64}$/i.test(parts[1])) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts[0])));
  const expected = [...signature].map(byte => byte.toString(16).padStart(2, "0")).join("");
  let diff = expected.length ^ parts[1].length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (parts[1].toLowerCase().charCodeAt(i) || 0);
  return diff === 0;
}

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

    let body = {};
    try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400, origin); }
    const requestedRole = body && body.role === "administrator" ? "administrator" : "public";
    let isAdmin = false;
    if (requestedRole === "administrator") {
      const sessionSecret = env.CLAUDIA_ADMIN_SESSION_SECRET || "";
      if (!sessionSecret) return json({ error: "Administrator voice authentication is not configured." }, 503, origin);
      isAdmin = await verifyAdminSession(body.admin_session_token, sessionSecret);
      if (!isAdmin) return json({ error: "Administrator session is invalid or expired. Sign in again." }, 401, origin);
    }

    try {
      const roomName = "423-news-claudia-" + crypto.randomUUID();
      const identity = (isAdmin ? "admin-" : "visitor-") + crypto.randomUUID();
      const role = isAdmin ? "administrator" : "public";
      const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity,
        name: isAdmin ? "423.news administrator" : "423.news visitor",
        ttl: "10m"
      });
      token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
      // This signed, server-generated dispatch metadata is the agent's authority signal.
      // Never trust a role supplied directly by a browser without the HMAC session check above.
      token.roomConfig = new RoomConfiguration({
        agents: [new RoomAgentDispatch({
          agentName: "claudia-green",
          metadata: JSON.stringify({
            role,
            platform: "423.news",
            authorization: isAdmin ? "verified-admin-session" : "public-session"
          })
        })]
      });
      const participantToken = await token.toJwt();
      return json({ server_url: env.LIVEKIT_URL, participant_token: participantToken, room_name: roomName, role }, 201, origin);
    } catch (error) {
      console.error("LiveKit token generation failed:", error?.message || error);
      return json({ error: "Unable to start the voice session." }, 500, origin);
    }
  }
};
