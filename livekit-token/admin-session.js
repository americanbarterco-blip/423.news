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

export async function createAdminSessionToken(secret, now = Date.now(), ttlMs = 12 * 60 * 60 * 1000) {
  if (!secret) throw new Error("Administrator session signing secret is unavailable.");
  const expiry = String(now + Math.max(60_000, Math.min(12 * 60 * 60 * 1000, ttlMs)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expiry)));
  const hex = [...signature].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return expiry + "." + hex;
}
