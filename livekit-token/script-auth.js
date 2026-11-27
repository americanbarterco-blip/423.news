import { createAdminSessionToken } from "./admin-session.js";

const FIRST_PHRASE = "Hello my beautiful beautiful Claudia";
const SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_ANSWER_LENGTH = 600;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function readScript(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.steps) || parsed.steps.length < 2 || parsed.steps.length > 12) return null;
    const steps = parsed.steps;
    if (steps[0]?.user !== FIRST_PHRASE) return null;
    if (steps.some(step => !step || typeof step.user !== "string" || !step.user ||
      typeof step.assistant !== "string" || !step.assistant ||
      step.user.length > MAX_ANSWER_LENGTH || step.assistant.length > MAX_ANSWER_LENGTH)) return null;
    if (new Set(steps.map(step => step.user)).size !== steps.length) return null;
    return steps;
  } catch {
    return null;
  }
}

/*
 * Durable Object state stores only the current step and expiry.
 * Neither user answers nor the script itself are persisted or logged.
 */
export async function handleScriptAuth(request, env, storage, now = Date.now()) {
  let body;
  try { body = await request.json(); } catch { return response({ ok: false, fallback: true }); }
  const action = String(body.action || "");
  const answer = typeof body.answer === "string" ? body.answer : "";
  if (!answer || answer.length > MAX_ANSWER_LENGTH) return response({ ok: false, fallback: true });

  const steps = readScript(env.CLAUDIA_ADMIN_SCRIPT_JSON);
  const signingSecret = env.CLAUDIA_ADMIN_SESSION_SECRET || "";
  if (!steps || !signingSecret) return response({ ok: false, fallback: true });

  if (action === "start") {
    if (answer !== steps[0].user) return response({ ok: false, fallback: true });
    await storage.put("state", { step: 1, expires: now + SESSION_TTL_MS });
    return response({ ok: true, complete: false, reply: steps[0].assistant });
  }

  if (action !== "step") return response({ ok: false, fallback: true });
  const state = await storage.get("state");
  if (!state || !Number.isInteger(state.step) || state.expires <= now) {
    await storage.delete("state");
    return response({ ok: false, fallback: true });
  }

  const expected = steps[state.step];
  if (!expected || answer !== expected.user) {
    await storage.delete("state");
    return response({ ok: false, fallback: true });
  }

  const nextStep = state.step + 1;
  if (nextStep >= steps.length) {
    await storage.delete("state");
    const adminSessionToken = await createAdminSessionToken(signingSecret, now);
    return response({
      ok: true,
      complete: true,
      reply: expected.assistant,
      admin_session_token: adminSessionToken,
      expires_at: now + 12 * 60 * 60 * 1000
    });
  }

  await storage.put("state", { step: nextStep, expires: state.expires });
  return response({ ok: true, complete: false, reply: expected.assistant });
}

export class ClaudiaScriptAuth {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    return handleScriptAuth(request, this.env, this.ctx.storage);
  }
}
