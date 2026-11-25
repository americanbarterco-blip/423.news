// Public, privacy-minimized ad delivery event collector.
// It records only impression/click type, campaign/ad/placement IDs, timestamp and a random deduplication key.
const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EDITION = (Deno.env.get('AD_EDITION_ID') || '423').trim();
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const json = (v: unknown, s = 200) => new Response(JSON.stringify(v), { status: s, headers });
const enc = (v: unknown) => encodeURIComponent(String(v ?? ''));
const uuid = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ''));
const rest = (path: string, options: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...options, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(options.headers || {}) }
});
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const origin = req.headers.get('origin') || '';
  let host = '';
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return json({ error: 'origin' }, 403); }
  const allowed = host === '423.news' || host === 'www.423.news' || host.endsWith('.workers.dev') || host.endsWith('.pages.dev') ||
    (EDITION === '808' && (host === '808.news' || host === 'www.808.news'));
  if (!allowed) return json({ error: 'origin' }, 403);
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  if (/bot|crawler|spider|curl|wget|python-requests|headlesschrome/.test(ua)) return json({ ok: true, ignored: true });
  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'json' }, 400); }
  const ad_id = String(b.ad_id || ''), campaign_id = String(b.campaign_id || ''), event_key = String(b.event_key || '');
  const placement_key = String(b.placement_key || ''), event_type = String(b.event_type || '');
  if (!uuid(ad_id) || !uuid(campaign_id) || !uuid(event_key) || !/^[a-z0-9_-]{1,80}$/.test(placement_key) || !['impression','click'].includes(event_type)) return json({ error: 'fields' }, 400);
  const [adR, campaignR, placementR] = await Promise.all([
    rest(`news_ads?select=id,campaign_id,edition_id,slot,active,starts_at,ends_at&edition_id=eq.${enc(EDITION)}&id=eq.${enc(ad_id)}&limit=1`),
    rest(`ad_campaigns?select=id,edition_id,status,starts_at,ends_at&edition_id=eq.${enc(EDITION)}&id=eq.${enc(campaign_id)}&limit=1`),
    rest(`ad_placements?select=placement_key,active&edition_id=eq.${enc(EDITION)}&placement_key=eq.${enc(placement_key)}&limit=1`)
  ]);
  if (!adR.ok || !campaignR.ok || !placementR.ok) return json({ error: 'lookup' }, 503);
  const [ad, campaign, placement] = [(await adR.json())[0], (await campaignR.json())[0], (await placementR.json())[0]];
  if (!ad || !campaign || !placement || ad.campaign_id !== campaign_id || ad.slot !== placement_key || !ad.active || !placement.active || campaign.status !== 'active') return json({ error: 'not_deliverable' }, 409);
  const now = Date.now();
  for (const item of [ad, campaign]) {
    if (item.starts_at && new Date(item.starts_at).getTime() > now) return json({ error: 'not_started' }, 409);
    if (item.ends_at && new Date(item.ends_at).getTime() <= now) return json({ error: 'expired' }, 409);
  }
  const save = await rest('ad_delivery_events?on_conflict=event_key', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ edition_id: EDITION, campaign_id, ad_id, placement_key, event_type, event_key })
  });
  if (!save.ok) return json({ error: 'event_save' }, 503);
  return json({ ok: true });
});
