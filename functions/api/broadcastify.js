/**
 * 423.news — private Broadcastify Calls bridge.
 * Access is authorized by the existing Supabase-backed newsroom admin session.
 * No static editor key is embedded in browser code or required as a Cloudflare secret.
 * On-demand only: no polling, audio relay, or public listener.
 */
const API = "https://api.bcfy.io";

function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function encodeJson(value) { return b64url(new TextEncoder().encode(JSON.stringify(value))); }

async function signJwt(env, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "JWT", kid: env.BCFY_KEY_ID });
  const payload = encodeJson({ iss: env.BCFY_APP_ID, iat: now, exp: now + 3600, ...extra });
  const unsigned = header + "." + payload;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.BCFY_API_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return unsigned + "." + b64url(new Uint8Array(signature));
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, private", "x-content-type-options": "nosniff"
  }});
}
async function authorize(request, env) {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: "missing_admin_session" };
  if (!env.SUPABASE_ADMIN_FUNCTION_URL)
    return { ok: false, status: 503, error: "admin_verifier_not_configured" };
  try {
    // Reuse the existing admin function's own session verifier. The "tables"
    // action returns only after valid(token); no service-role key is stored here.
    const response = await fetch(env.SUPABASE_ADMIN_FUNCTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "tables", token: match[1] })
    });
    if (!response.ok) return { ok: false, status: 401, error: "admin_session_rejected" };
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: "admin_verifier_unreachable" };
  }
}
async function bcfyFetch(path, token, options = {}) {
  const response = await fetch(API + path, { ...options, headers: {
    authorization: "Bearer " + token, accept: "application/json",
    ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {})
  }});
  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : {}; } catch { data = { message: body.slice(0, 300) }; }
  if (!response.ok) {
    const error = new Error(data.message || data.error || ("Broadcastify returned " + response.status));
    error.status = response.status; throw error;
  }
  return data;
}
async function userToken(env) {
  const appJwt = await signJwt(env);
  const auth = await bcfyFetch("/common/v1/auth", appJwt, { method: "POST",
    body: JSON.stringify({ username: env.BCFY_USERNAME, password: env.BCFY_PASSWORD }) });
  if (!auth.uid || !auth.token) throw new Error("Broadcastify authentication did not return a user token.");
  return signJwt(env, { sub: Number(auth.uid), utk: auth.token });
}

export async function onRequestGet({ request, env }) {
  const authorization = await authorize(request, env);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "health";
  const required = ["BCFY_API_SECRET", "BCFY_KEY_ID", "BCFY_APP_ID", "BCFY_USERNAME", "BCFY_PASSWORD"];
  const missing = required.filter(key => !env[key]);
  if (action === "health") return json({ ok: true, service: "423.news private Broadcastify bridge",
    mode: "on-demand", audio: "not exposed", authentication: "existing newsroom admin session",
    broadcastifyConfiguration: missing.length ? "not_configured" : "ready",
    note: "No background polling is enabled." });
  if (missing.length) return json({ error: "broadcastify_not_configured", missing }, 503);
  try {
    const token = await userToken(env);
    if (action === "groups") {
      const ctid = url.searchParams.get("ctid");
      if (!ctid || !/^\d+$/.test(ctid)) return json({ error: "Supply a numeric Broadcastify county ID as ctid." }, 400);
      const body = { secs_ago: 86400 };
      const tagId = url.searchParams.get("tagId");
      if (tagId && /^\d+$/.test(tagId)) body.tagId = Number(tagId);
      const data = await bcfyFetch("/calls/v1/groups_ctid/" + encodeURIComponent(ctid), token,
        { method: "POST", body: JSON.stringify(body) });
      return json({ ok: true, action, countyId: ctid, data });
    }
    if (action === "live") {
      const groups = (url.searchParams.get("groups") || "").split(",").map(x => x.trim()).filter(Boolean);
      if (!groups.length || groups.length > 5 || groups.some(x => !/^\d+$/.test(x)))
        return json({ error: "Supply 1–5 numeric group IDs in groups, separated by commas." }, 400);
      const params = new URLSearchParams({ groups: groups.join(",") });
      const pos = url.searchParams.get("pos");
      if (pos && /^\d+$/.test(pos)) params.set("pos", pos);
      else if (url.searchParams.get("init") === "1") params.set("init", "1");
      const data = await bcfyFetch("/calls/v1/live/?" + params.toString(), token);
      return json({ ok: true, action, groups, data });
    }
    return json({ error: "Unknown action. Use health, groups, or live." }, 400);
  } catch (error) {
    return json({ error: "Broadcastify request failed", message: error.message,
      status: error.status || 502 }, error.status && error.status >= 400 && error.status < 500 ? error.status : 502);
  }
}
