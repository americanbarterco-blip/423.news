// Staff-only regional advertising operations for 423.news and future editions.
// Authentication is delegated to the existing admin Edge Function; no second password system.
const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EDITION = (Deno.env.get('AD_EDITION_ID') || '423').trim();
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Content-Type': 'application/json' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const rest = (path: string, options: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  ...options,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) }
});
const enc = (v: unknown) => encodeURIComponent(String(v ?? ''));
const uuid = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ''));
const text = (v: unknown, max = 180) => String(v ?? '').trim().slice(0, max);
const money = (v: unknown) => Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null;

async function readOne(table: string, id: string) {
  const r = await rest(`${table}?select=*&id=eq.${enc(id)}&edition_id=eq.${enc(EDITION)}&limit=1`);
  if (!r.ok) throw new Error('database_read');
  return (await r.json())[0] || null;
}
async function save(table: string, body: Record<string, unknown>, id?: string) {
  const payload = { ...body, edition_id: EDITION, updated_at: new Date().toISOString() };
  delete (payload as any).id;
  const r = id
    ? await rest(`${table}?id=eq.${enc(id)}&edition_id=eq.${enc(EDITION)}`, { method: 'PATCH', body: JSON.stringify(payload) })
    : await rest(table, { method: 'POST', body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('database_save');
  const rows = await r.json();
  return rows[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'json' }, 400); }
  const token = String(body.token || '');
  if (!token) return json({ error: 'auth' }, 401);

  // Reuse the existing 423.news staff session validation. This endpoint never issues sessions.
  const auth = await fetch(URL_ + '/functions/v1/admin', {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tables', token })
  });
  if (!auth.ok) return json({ error: 'auth' }, 401);

  try {
    const action = String(body.action || '');
    if (action === 'dashboard') {
      const names = ['ad_advertisers','ad_packages','ad_campaigns','ad_orders','ad_placements'];
      const results = await Promise.all(names.map(async (name) => {
        const order = name === 'ad_delivery_events' ? 'occurred_at' : 'created_at';
        const r = await rest(`${name}?select=*&edition_id=eq.${enc(EDITION)}&order=${order}.desc&limit=5000`);
        if (!r.ok) throw new Error('database_read_' + name);
        return [name, await r.json()] as const;
      }));
      const data: Record<string, any[]> = Object.fromEntries(results);
      const countEvents = async (type: string) => {
        const r = await rest(`ad_delivery_events?select=id&edition_id=eq.${enc(EDITION)}&event_type=eq.${enc(type)}`, {
          method: 'HEAD', headers: { Prefer: 'count=exact' }
        });
        if (!r.ok) throw new Error('event_count');
        const range = r.headers.get('content-range') || '';
        const total = Number(range.split('/')[1]);
        return Number.isFinite(total) ? total : 0;
      };
      const [impressions, clicks] = await Promise.all([countEvents('impression'), countEvents('click')]);
      const adsR = await rest(`news_ads?select=id,title,slot,kind,active,starts_at,ends_at,campaign_id,advertiser_id&edition_id=eq.${enc(EDITION)}&order=created_at.desc&limit=500`);
      if (!adsR.ok) throw new Error('database_read_ads');
      data.news_ads = await adsR.json();
      const metrics = {
        impressions,
        clicks,
        campaigns: data.ad_campaigns.length,
        activeCampaigns: data.ad_campaigns.filter((c) => c.status === 'active').length,
        advertisers: data.ad_advertisers.length,
        approvedAdvertisers: data.ad_advertisers.filter((a) => a.status === 'approved').length
      };
      return json({ edition_id: EDITION, data, metrics });
    }

    if (action === 'saveAdvertiser') {
      const b = body.record || {};
      const business_name = text(b.business_name, 180);
      if (!business_name) return json({ error: 'business_name_required' }, 400);
      const payload = {
        business_name, contact_name: text(b.contact_name, 140), contact_email: text(b.contact_email, 254),
        contact_phone: text(b.contact_phone, 60), website: text(b.website, 500), category: text(b.category, 100),
        service_area: text(b.service_area, 180), status: ['pending','approved','rejected','paused'].includes(b.status) ? b.status : 'pending',
        internal_notes: text(b.internal_notes, 4000)
      };
      if (b.id && !uuid(b.id)) return json({ error: 'id' }, 400);
      const advertiser = await save('ad_advertisers', payload, b.id);
      if (advertiser) {
        const cr = await rest(`ad_campaigns?select=id,status&edition_id=eq.${enc(EDITION)}&advertiser_id=eq.${enc(advertiser.id)}`);
        if (!cr.ok) throw new Error('campaign_sync_read');
        const linked = await cr.json();
        for (const campaign of linked) {
          const gate = advertiser.status === 'approved' && campaign.status === 'active';
          const sync = await rest(`news_ads?edition_id=eq.${enc(EDITION)}&campaign_id=eq.${enc(campaign.id)}`, {
            method: 'PATCH', body: JSON.stringify({ campaign_active: gate, starts_at: campaign.starts_at, ends_at: campaign.ends_at })
          });
          if (!sync.ok) throw new Error('campaign_sync');
        }
      }
      return json({ advertiser });
    }

    if (action === 'savePackage') {
      const b = body.record || {}, name = text(b.name, 120);
      if (!name) return json({ error: 'name_required' }, 400);
      const price = b.price_cents === '' || b.price_cents == null ? null : money(b.price_cents);
      if (b.price_cents != null && b.price_cents !== '' && price == null) return json({ error: 'price' }, 400);
      const payload = {
        name, description: text(b.description, 1200), placement_key: text(b.placement_key || 'custom', 80),
        duration_days: Math.min(365, Math.max(1, Number(b.duration_days) || 30)), price_cents: price,
        currency: /^[A-Z]{3}$/.test(String(b.currency || 'USD')) ? String(b.currency || 'USD') : 'USD',
        active: b.active !== false
      };
      if (b.id && !uuid(b.id)) return json({ error: 'id' }, 400);
      return json({ package: await save('ad_packages', payload, b.id) });
    }

    if (action === 'saveCampaign') {
      const b = body.record || {}, advertiser_id = String(b.advertiser_id || '');
      const name = text(b.name, 180);
      if (!uuid(advertiser_id) || !name) return json({ error: 'campaign_fields' }, 400);
      const advertiser = await readOne('ad_advertisers', advertiser_id);
      if (!advertiser) return json({ error: 'advertiser_not_found' }, 404);
      if (b.id && !uuid(b.id)) return json({ error: 'id' }, 400);
      const status = ['draft','pending_review','approved','active','paused','completed','rejected'].includes(b.status) ? b.status : 'draft';
      if (status === 'active' && advertiser.status !== 'approved') return json({ error: 'advertiser_not_approved' }, 409);
      const start = b.starts_at ? new Date(b.starts_at) : null, end = b.ends_at ? new Date(b.ends_at) : null;
      if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && end <= start)) return json({ error: 'campaign_dates' }, 400);
      const budget = b.budget_cents === '' || b.budget_cents == null ? null : money(b.budget_cents);
      const sold = b.sold_price_cents === '' || b.sold_price_cents == null ? null : money(b.sold_price_cents);
      if ((b.budget_cents != null && b.budget_cents !== '' && budget == null) || (b.sold_price_cents != null && b.sold_price_cents !== '' && sold == null)) return json({ error: 'campaign_amount' }, 400);
      const payload = {
        advertiser_id, package_id: uuid(b.package_id) ? b.package_id : null, name, objective: text(b.objective, 500),
        status, starts_at: start ? start.toISOString() : null, ends_at: end ? end.toISOString() : null,
        budget_cents: budget, sold_price_cents: sold, currency: /^[A-Z]{3}$/.test(String(b.currency || 'USD')) ? String(b.currency || 'USD') : 'USD',
        internal_notes: text(b.internal_notes, 4000)
      };
      const campaign = await save('ad_campaigns', payload, b.id);
      if (campaign) {
        const gate = campaign.status === 'active' && advertiser.status === 'approved';
        const sync = await rest(`news_ads?edition_id=eq.${enc(EDITION)}&campaign_id=eq.${enc(campaign.id)}`, {
          method: 'PATCH', body: JSON.stringify({ campaign_active: gate })
        });
        if (!sync.ok) throw new Error('campaign_sync');
      }
      return json({ campaign });
    }

    if (action === 'saveOrder') {
      const b = body.record || {}, advertiser_id = String(b.advertiser_id || ''), campaign_id = String(b.campaign_id || '');
      if (!uuid(advertiser_id) || !uuid(campaign_id)) return json({ error: 'order_fields' }, 400);
      const [advertiser, campaign] = await Promise.all([readOne('ad_advertisers', advertiser_id), readOne('ad_campaigns', campaign_id)]);
      if (!advertiser || !campaign || campaign.advertiser_id !== advertiser_id) return json({ error: 'order_relationship' }, 409);
      const amount = money(b.amount_cents);
      if (amount == null) return json({ error: 'amount' }, 400);
      const status = ['quoted','contracted','invoiced','paid','fulfilled','cancelled'].includes(b.status) ? b.status : 'quoted';
      if (b.id && !uuid(b.id)) return json({ error: 'id' }, 400);
      const payload = { advertiser_id, campaign_id, package_id: uuid(b.package_id) ? b.package_id : null, amount_cents: amount,
        currency: /^[A-Z]{3}$/.test(String(b.currency || 'USD')) ? String(b.currency || 'USD') : 'USD',
        status, reference_note: text(b.reference_note, 1000) };
      return json({ order: await save('ad_orders', payload, b.id) });
    }

    if (action === 'linkAd') {
      const ad_id = String(body.ad_id || ''), campaign_id = String(body.campaign_id || '');
      if (!uuid(ad_id) || !uuid(campaign_id)) return json({ error: 'link_fields' }, 400);
      const campaign = await readOne('ad_campaigns', campaign_id);
      if (!campaign) return json({ error: 'campaign_not_found' }, 404);
      const advertiser = await readOne('ad_advertisers', campaign.advertiser_id);
      if (!advertiser) return json({ error: 'advertiser_not_found' }, 404);
      const campaignGate = campaign.status === 'active' && advertiser.status === 'approved';
      const adR = await rest(`news_ads?select=id,active&edition_id=eq.${enc(EDITION)}&id=eq.${enc(ad_id)}&limit=1`);
      if (!adR.ok) throw new Error('ad_read');
      if (!(await adR.json()).length) return json({ error: 'ad_not_found' }, 404);
      const update = await rest(`news_ads?id=eq.${enc(ad_id)}&edition_id=eq.${enc(EDITION)}`, {
        method: 'PATCH', body: JSON.stringify({ campaign_id, advertiser_id: campaign.advertiser_id, edition_id: EDITION, disclosure: 'Advertisement', campaign_active: campaignGate, starts_at: campaign.starts_at, ends_at: campaign.ends_at })
      });
      if (!update.ok) throw new Error('ad_link');
      return json({ ok: true });
    }

    if (action === 'savePlacement') {
      const b = body.record || {}, placement_key = text(b.placement_key, 80), name = text(b.name, 120);
      if (!placement_key || !/^[a-z0-9_-]+$/.test(placement_key) || !name) return json({ error: 'placement_fields' }, 400);
      const payload = { placement_key, name, description: text(b.description, 1000), page_targets: text(b.page_targets || 'all', 200),
        format: ['image','video','image_video','sponsored_content'].includes(b.format) ? b.format : 'image_video', active: b.active !== false };
      if (b.id && !uuid(b.id)) return json({ error: 'id' }, 400);
      return json({ placement: await save('ad_placements', payload, b.id) });
    }

    return json({ error: 'action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'server_error' }, 500);
  }
});
