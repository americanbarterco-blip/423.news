import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Private Broadcastify API proxy for 423.news.
 *
 * Safety defaults:
 * - Disabled unless BCFY_ENABLED=true.
 * - Requires a separate server-to-server BCFY_PROXY_TOKEN.
 * - API key secret is read only from Edge Function environment variables.
 * - Creates a short-lived (15 minute) HS256 JWT for each upstream request.
 * - Allows GET/JSON retrieval only; no audio streaming, writes, or public browser CORS.
 * - Does not store, publish, or forward call records to the newsroom.
 */
const API_BASE = "https://api.bcfy.io";
const TOKEN_LIFETIME_SECONDS = 15 * 60;
const MAX_BODY_CHARS = 8_000;
const MAX_RESPONSE_CHARS = 1_500_000;
const ALLOWED_PREFIXES = [
  "/feeds/v1/",
  "/calls/v1/",
  "/alerts/v1/",
  "/common/v1/",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function createBroadcastifyJwt(): Promise<string> {
  const kid = Deno.env.get("BCFY_API_KEY_ID") ?? "";
  const secret = Deno.env.get("BCFY_API_KEY_SECRET") ?? "";
  const appId = Deno.env.get("BCFY_APP_ID") ?? "";

  if (!kid || !secret || !appId) {
    throw new Error("Broadcastify credentials are not fully configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "JWT", kid });
  const payload = encodeJson({
    iss: appId,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  });
  const signingInput = header + "." + payload;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );

  return signingInput + "." + base64Url(new Uint8Array(signature));
}

function validatePath(path: unknown): string | null {
  if (typeof path !== "string" || path.length > 500) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (/[\\?#]/.test(path) || /%2f|%5c/i.test(path)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded.split("/").some((part) => part === "." || part === "..")) {
    return null;
  }
  if (!ALLOWED_PREFIXES.some((prefix) => decoded.startsWith(prefix))) {
    return null;
  }
  return decoded;
}

function buildQuery(query: unknown): string {
  if (query === undefined || query === null) return "";
  if (typeof query !== "object" || Array.isArray(query)) {
    throw new Error("query must be a simple object of scalar values.");
  }

  const entries = Object.entries(query as Record<string, unknown>);
  if (entries.length > 30) throw new Error("Too many query parameters.");

  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) {
      throw new Error("Invalid query parameter name.");
    }
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new Error("Query values must be strings, numbers, or booleans.");
    }
    const text = String(value);
    if (text.length > 500) throw new Error("Query parameter value is too long.");
    params.set(key, text);
  }
  const encoded = params.toString();
  return encoded ? "?" + encoded : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "POST only." }, 405);
  }

  if (Deno.env.get("BCFY_ENABLED") !== "true") {
    return json({
      enabled: false,
      message: "Broadcastify integration is disabled. No upstream request was made.",
    }, 503);
  }

  const expectedToken = Deno.env.get("BCFY_PROXY_TOKEN") ?? "";
  const suppliedToken = req.headers.get("x-bcfy-proxy-token") ?? "";
  if (!expectedToken || !safeEqual(suppliedToken, expectedToken)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: "Request too large." }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "JSON object required." }, 400);
    }
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }

  const path = validatePath(body.path);
  if (!path) return json({ error: "Unsupported Broadcastify API path." }, 400);

  let query: string;
  try {
    query = buildQuery(body.query);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }

  try {
    const jwt = await createBroadcastifyJwt();
    const upstream = await fetch(API_BASE + path + query, {
      method: "GET",
      headers: {
        authorization: "Bearer " + jwt,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });

    const text = await upstream.text();
    if (text.length > MAX_RESPONSE_CHARS) {
      return json({ error: "Broadcastify response exceeded the configured size limit." }, 502);
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return json({
        error: "Broadcastify returned a non-JSON response; this proxy only handles metadata.",
        upstream_status: upstream.status,
      }, 502);
    }

    return json({
      ok: upstream.ok,
      upstream_status: upstream.status,
      data,
    }, upstream.ok ? 200 : (upstream.status >= 400 && upstream.status < 500 ? 400 : 502));
  } catch (error) {
    // Do not log credentials, JWTs, request headers, or upstream response bodies.
    return json({
      error: "Broadcastify request failed.",
      detail: (error as Error).name === "TimeoutError" ? "Upstream timeout." : "Check configuration and API availability.",
    }, 502);
  }
});
