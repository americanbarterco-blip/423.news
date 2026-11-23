// 423 Arcade Stripe Checkout — Cloudflare Worker routes
// Configure STRIPE_SECRET_KEY, ARCADE_CLUB_PRICE_ID, and ARCADE_SPONSOR_PRICE_ID as Worker secrets/vars.
// Stripe Checkout sessions deposit proceeds into the 423.news platform Stripe balance.
// Stripe then pays the platform's configured bank account according to its payout schedule.
// No game coins, scores, or winnings are redeemable for cash.

const ALLOWED_ORIGINS = new Set(["https://423.news", "https://www.423.news"]);

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(request ? cors(request) : {})
  }});
}

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://423.news",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

async function arcadeCheckout(request, env) {
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors(request)});
  if (request.method !== "POST") return json({error:"method_not_allowed"},405,request);
  const origin = request.headers.get("Origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({error:"origin_not_allowed"},403,request);
  if (!env.STRIPE_SECRET_KEY) return json({error:"stripe_not_configured"},503,request);
  let payload;
  try { payload = await request.json(); } catch { return json({error:"invalid_json"},400,request); }
  const type = payload && payload.product;
  const products = {
    arcade_club: {price:env.ARCADE_CLUB_PRICE_ID, mode:"subscription"},
    arcade_sponsor: {price:env.ARCADE_SPONSOR_PRICE_ID, mode:"payment"}
  };
  const chosen = products[type];
  if (!chosen || !chosen.price) return json({error:"product_unavailable"},503,request);
  const params = new URLSearchParams();
  params.set("mode", chosen.mode);
  params.set("line_items[0][price]", chosen.price);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", "https://423.news/gamehub.html?checkout=success");
  params.set("cancel_url", "https://423.news/gamehub.html?checkout=cancelled");
  params.set("allow_promotion_codes", "true");
  params.set("billing_address_collection", "auto");
  params.set("metadata[product]", type);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method:"POST",
    headers:{Authorization:"Bearer "+env.STRIPE_SECRET_KEY,"Content-Type":"application/x-www-form-urlencoded"},
    body:params.toString()
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.url) {
    console.error("Stripe checkout session error",response.status,data.error?.type || "unknown");
    return json({error:"checkout_creation_failed"},502,request);
  }
  return json({url:data.url},200,request);
}

async function verifyStripeSignature(body, header, secret) {
  const parts = (header || "").split(",").map(s=>s.split("="));
  const timestamp = parts.find(p=>p[0]==="t")?.[1];
  const signatures = parts.filter(p=>p[0]==="v1").map(p=>p[1]);
  if (!timestamp || !signatures.length || Math.abs(Date.now()/1000-Number(timestamp))>300) return false;
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+body));
  const expected = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  return signatures.some(sig=>sig.length===expected.length && sig===expected);
}

async function stripeWebhook(request, env) {
  if (request.method !== "POST") return json({error:"method_not_allowed"},405);
  if (!env.STRIPE_WEBHOOK_SECRET) return json({error:"webhook_not_configured"},503,request);
  const body = await request.text();
  const verified = await verifyStripeSignature(body,request.headers.get("Stripe-Signature"),env.STRIPE_WEBHOOK_SECRET);
  if (!verified) return json({error:"invalid_signature"},400,request);
  const event = JSON.parse(body);
  // Verified event accepted. Durable membership/sponsor records and entitlement sync
  // will be added when the site's storage schema is installed and tested.
  console.log("Stripe webhook verified",event.type,event.id);
  return json({received:true},200,request);
}

export async function handleArcadeStripe(request, env, path) {
  if (path === "/api/arcade/checkout") return arcadeCheckout(request,env);
  if (path === "/api/arcade/stripe-webhook") return stripeWebhook(request,env);
  return json({error:"not_found"},404);
}
