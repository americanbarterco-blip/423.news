import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { verifyAdminSession } from "./admin-session.js";
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const secret = "test-only-admin-session-secret";
function token(expiry) {
  const exp = String(expiry);
  return exp + "." + createHmac("sha256", secret).update(exp).digest("hex");
}

test("accepts a valid unexpired administrator session", async () => {
  const now = 1_800_000_000_000;
  assert.equal(await verifyAdminSession(token(now + 60_000), secret, now), true);
});

test("rejects expired sessions", async () => {
  const now = 1_800_000_000_000;
  assert.equal(await verifyAdminSession(token(now - 1), secret, now), false);
});

test("rejects forged signatures", async () => {
  const now = 1_800_000_000_000;
  assert.equal(await verifyAdminSession(String(now + 60_000) + "." + "0".repeat(64), secret, now), false);
});

test("rejects missing secrets and implausibly long sessions", async () => {
  const now = 1_800_000_000_000;
  assert.equal(await verifyAdminSession(token(now + 60_000), "", now), false);
  assert.equal(await verifyAdminSession(token(now + 13 * 60 * 60 * 1000), secret, now), false);
});
