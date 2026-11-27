import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { ClaudiaScriptAuth, handleScriptAuth } from "./script-auth.js";
import { verifyAdminSession } from "./admin-session.js";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const secret = "script-auth-test-secret";
const phrase = "Hello my beautiful beautiful Claudia";
const env = {
  CLAUDIA_ADMIN_SESSION_SECRET: secret,
  CLAUDIA_ADMIN_SCRIPT_JSON: JSON.stringify({ steps: [
    { user: phrase, assistant: "Test reply one." },
    { user: "Exact second response.", assistant: "Test reply two." },
    { user: "Exact final response.", assistant: "All set." }
  ] })
};
function request(action, answer) {
  return new Request("https://script-auth.internal", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, answer })
  });
}
function storageMock() {
  const values = new Map();
  return {
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, value); },
    async delete(key) { return values.delete(key); }
  };
}
async function body(response) { return response.json(); }

test("exact scripted exchange advances one step at a time and issues a valid admin session", async () => {
  const storage = storageMock();
  let result = await body(await handleScriptAuth(request("start", phrase), env, storage, 1_800_000_000_000));
  assert.equal(result.reply, "Test reply one.");
  assert.equal(result.complete, false);
  result = await body(await handleScriptAuth(request("step", "Exact second response."), env, storage, 1_800_000_000_001));
  assert.equal(result.reply, "Test reply two.");
  assert.equal(result.complete, false);
  result = await body(await handleScriptAuth(request("step", "Exact final response."), env, storage, 1_800_000_000_002));
  assert.equal(result.reply, "All set.");
  assert.equal(result.complete, true);
  assert.equal(await verifyAdminSession(result.admin_session_token, secret, 1_800_000_000_003), true);
  assert.equal(await storage.get("state"), undefined);
});

test("incorrect wording silently destroys the challenge without revealing the expected phrase", async () => {
  const storage = storageMock();
  await handleScriptAuth(request("start", phrase), env, storage, 1_800_000_000_000);
  const result = await body(await handleScriptAuth(request("step", "Exact second response!"), env, storage, 1_800_000_000_001));
  assert.deepEqual(result, { ok: false, fallback: true });
  assert.equal(await storage.get("state"), undefined);
});

test("expired challenge cannot be resumed", async () => {
  const storage = storageMock();
  await handleScriptAuth(request("start", phrase), env, storage, 1_800_000_000_000);
  const result = await body(await handleScriptAuth(request("step", "Exact second response."), env, storage, 1_800_000_301_000));
  assert.equal(result.ok, false);
  assert.equal(await storage.get("state"), undefined);
});

test("missing or malformed private script fails closed", async () => {
  const storage = storageMock();
  const result = await body(await handleScriptAuth(request("start", phrase), { ...env, CLAUDIA_ADMIN_SCRIPT_JSON: "" }, storage));
  assert.deepEqual(result, { ok: false, fallback: true });
});

test("Durable Object adapter delegates to the stateful handler", async () => {
  const storage = storageMock();
  const object = new ClaudiaScriptAuth({ storage }, env);
  const result = await body(await object.fetch(request("start", phrase)));
  assert.equal(result.ok, true);
  assert.equal(result.reply, "Test reply one.");
});
