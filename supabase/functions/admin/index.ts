// Supabase Edge Function named "admin" (Verify JWT is OFF; it checks its own session token).
// The signing secret and password hash live in the admin_auth table. Optional env overrides: SESSION_SECRET, ADMIN_PASSWORD, ADMIN_TABLES.
// CHANGES in this version: news_ads and news_ad_settings are always allowed tables; "uploadAd" (small images) and "adUploadUrl" (large files, incl. video) actions; deleteFile also works on the news-ads bucket.
const DEFAULT_TABLES = 'news_profiles,news_posts,news_comments,news_streams,news_reports,news_scores,news_headlines,events,hotspots';
const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Content-Type': 'application/json' };
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function pbk(pw: string, salt: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256));
}
let _sec = '';
async function secret() {
  if (_sec) return _sec;
  _sec = Deno.env.get('SESSION_SECRET') || ((await (await rest('admin_auth?id=eq.1&select=secret')).json())[0] || {}).secret || '';
  return _sec;
}
async function hmac(s: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(await secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(s)));
}
async function valid(tok: unknown) {
  const [exp, sig] = String(tok || '').split('.');
  return !!sig && Number(exp) > Date.now() && same(sig, await hmac(exp));
}
const rest = (path: string, o: RequestInit & { prefer?: string } = {}) => fetch(`${URL_}/rest/v1/${path}`, {
  method: o.method, body: o.body,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: o.prefer || 'return=representation' }
});
async function check(pw: string) { // 'ok' | 'bad' | 'locked' — 5 wrong tries locks for 15 minutes
  const r = (await (await rest('admin_auth?id=eq.1')).json())[0] || {};
  if (r.locked_until && new Date(r.locked_until) > new Date()) return 'locked';
  const ok = r.hash ? same(await pbk(pw, r.salt), r.hash) : same(pw, Deno.env.get('ADMIN_PASSWORD') || '\u0000');
  let fails = ok ? 0 : (r.fails || 0) + 1, lock: string | null = null;
  if (fails >= 5) { fails = 0; lock = new Date(Date.now() + 15 * 60000).toISOString(); }
  await rest('admin_auth', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({ id: 1, salt: r.salt ?? null, hash: r.hash ?? null, fails, locked_until: lock }) });
  return ok ? 'ok' : 'bad';
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: H });
  const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
  if (!await secret()) return j({ error: 'not configured' }, 500);
  let b: any = {}; try { b = await req.json(); } catch { /* empty */ }
  const a = b.action;
  if (a === 'login') {
    const c = await check(String(b.password || ''));
    if (c === 'locked') return j({ error: 'locked' }, 429);
    if (c !== 'ok') return j({ error: 'bad' }, 401);
    const exp = Date.now() + 12 * 3600000;
    return j({ token: exp + '.' + await hmac(String(exp)), expiresAt: exp });
  }
  if (!await valid(b.token)) return j({ error: 'auth' }, 401);
  const tables = (Deno.env.get('ADMIN_TABLES') || DEFAULT_TABLES).split(',').map(s => s.trim()).filter(s => /^[a-z0-9_]+$/.test(s));
  for (const t of ['news_ads', 'news_ad_settings']) if (!tables.includes(t)) tables.push(t);
  if (a === 'tables') return j({ tables });
  if (a === 'change') {
    const nw = String(b.next || '');
    if (nw.length < 10) return j({ error: 'short' }, 400);
    const c = await check(String(b.current || ''));
    if (c === 'locked') return j({ error: 'locked' }, 429);
    if (c !== 'ok') return j({ error: 'bad' }, 401);
    const salt = crypto.randomUUID();
    await rest('admin_auth', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({ id: 1, salt, hash: await pbk(nw, salt), fails: 0, locked_until: null }) });
    return j({ ok: true });
  }
  if (a === 'deleteFile') { // remove a photo/video/ad image from the news-media or news-ads bucket
    const u = String(b.url || '');
    for (const bucket of ['news-media', 'news-ads']) {
      const base = `${URL_}/storage/v1/object/public/${bucket}/`;
      if (!u.startsWith(base)) continue;
      const path = u.slice(base.length).split('?')[0];
      if (!path || path.includes('..')) return j({ error: 'url' }, 400);
      const r = await fetch(`${URL_}/storage/v1/object/${bucket}/${path}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      return j({ ok: r.ok }, r.ok ? 200 : 400);
    }
    return j({ error: 'url' }, 400);
  }
  if (a === 'uploadAd') { // upload an ad image (base64) to the public news-ads bucket; returns its URL
    const mime = String(b.type || '');
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[mime];
    if (!ext) return j({ error: 'type' }, 400);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(String(b.data || '')), c => c.charCodeAt(0)); } catch { return j({ error: 'data' }, 400); }
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) return j({ error: 'size' }, 400);
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const r = await fetch(`${URL_}/storage/v1/object/news-ads/${path}`, {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes });
    return r.ok ? j({ url: `${URL_}/storage/v1/object/public/news-ads/${path}` }) : j({ error: 'upload' }, 400);
  }
  if (a === 'adUploadUrl') { // returns a one-time upload URL so the browser can send a big file (video) straight to storage
    const mime = String(b.type || '');
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[mime];
    if (!ext) return j({ error: 'type' }, 400);
    if (!(Number(b.size) > 0) || Number(b.size) > 25 * 1024 * 1024) return j({ error: 'size' }, 400);
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const r = await fetch(`${URL_}/storage/v1/object/upload/sign/news-ads/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) return j({ error: 'sign' }, 400);
    const d = await r.json(); const token = d.token || String(d.url || '').split('token=')[1] || '';
    if (!token) return j({ error: 'sign' }, 400);
    return j({ uploadUrl: `${URL_}/storage/v1/object/upload/sign/news-ads/${path}?token=${token}`, url: `${URL_}/storage/v1/object/public/news-ads/${path}` });
  }
  if (a === 'deleteUser') { // remove a login (auth user)
    const uid = String(b.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(uid)) return j({ error: 'id' }, 400);
    const r = await fetch(`${URL_}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    return j({ ok: r.ok }, r.ok ? 200 : 400);
  }
  const t = String(b.table || '');
  if (!tables.includes(t)) return j({ error: 'table' }, 400);
  if (a === 'list') { const r = await rest(`${t}?select=*&limit=200`); return j({ rows: await r.json() }, r.status); }
  if (a === 'insert') {
    const row = { ...(b.row || {}) }; delete row.id;
    const r = await rest(t, { method: 'POST', body: JSON.stringify(row), prefer: 'return=minimal' });
    return j({ ok: r.ok }, r.ok ? 200 : 400);
  }
  const id = encodeURIComponent(String(b.id ?? ''));
  if (!id) return j({ error: 'id' }, 400);
  if (a === 'update') {
    const patch = { ...(b.patch || {}) }; delete patch.id;
    const r = await rest(`${t}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return j({ ok: r.ok }, r.ok ? 200 : 400);
  }
  if (a === 'delete') { const r = await rest(`${t}?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' }); return j({ ok: r.ok }, r.ok ? 200 : 400); }

  // Spanish editorial workflow. Source material is read-only; only approved translations
  // are exposed to public visitors by the migration's RLS policy.
  const translationSources = ['news_posts', 'events', 'news_headlines'];
  const contentFor = (table: string, row: any) => table === 'news_posts'
    ? { title: row.title || '', body: row.body || '' }
    : table === 'events'
      ? { title: row.title || '', description: row.description || '' }
      : { title: row.title || '' };
  const updatedFor = (table: string, row: any) => row.updated_at || row.created_at || row.published || row.starts_at || null;
  if (a === 'translationQueue') {
    const now = new Date().toISOString();
    const [postsR, eventsR, headlinesR, translationsR] = await Promise.all([
      rest('news_posts?select=id,section,slug,title,body,status,updated_at,created_at&status=eq.published&section=in.(news,community,sports,schools,outdoors,government)&order=updated_at.desc&limit=200'),
      rest('events?select=id,title,description,starts_at,location,city,created_at&starts_at=gte.' + encodeURIComponent(now) + '&order=starts_at.asc&limit=100'),
      rest('news_headlines?select=id,league,title,url,source,published,created_at&published=not.is.null&order=published.desc&limit=100'),
      rest('news_translations?select=*&locale=eq.es&limit=1000')
    ]);
    for (const r of [postsR, eventsR, headlinesR, translationsR]) if (!r.ok) return j({ error: 'translation_read' }, 500);
    const [posts, events, headlines, translations] = await Promise.all([postsR.json(), eventsR.json(), headlinesR.json(), translationsR.json()]);
    const byKey = new Map((translations || []).map((x: any) => [x.source_table + ':' + x.source_id, x]));
    const items = [
      ...(posts || []).map((row: any) => ({ source_table: 'news_posts', source_id: String(row.id), section: row.section, source_title: row.title, source_content: contentFor('news_posts', row), source_updated_at: updatedFor('news_posts', row), row })),
      ...(events || []).map((row: any) => ({ source_table: 'events', source_id: String(row.id), section: 'events', source_title: row.title, source_content: contentFor('events', row), source_updated_at: updatedFor('events', row), row })),
      ...(headlines || []).map((row: any) => ({ source_table: 'news_headlines', source_id: String(row.id), section: 'sports', source_title: row.title, source_content: contentFor('news_headlines', row), source_updated_at: updatedFor('news_headlines', row), row }))
    ].map((item: any) => {
      const translation: any = byKey.get(item.source_table + ':' + item.source_id) || null;
      const contentChanged = !!(translation && Object.keys(item.source_content).some((k: string) => String(item.source_content[k] || '') !== String(translation.original_content?.[k] || '')));
      const stale = !!(translation && (contentChanged || (translation.source_updated_at && item.source_updated_at &&
        new Date(item.source_updated_at).getTime() > new Date(translation.source_updated_at).getTime())));
      return { ...item, translation, stale };
    });
    const counts = { total: items.length, untranslated: 0, draft: 0, pending_review: 0, approved: 0, rejected: 0, stale: 0 };
    for (const item of items) {
      const status = item.stale ? 'stale' : item.translation?.status || 'untranslated';
      if (status in counts) (counts as any)[status]++;
    }
    return j({ items, counts });
  }
  if (a === 'translationSave') {
    const table = String(b.source_table || ''), sourceId = String(b.source_id || '');
    const translated = b.translated_content && typeof b.translated_content === 'object' ? b.translated_content : {};
    if (!translationSources.includes(table) || !sourceId || sourceId.length > 180) return j({ error: 'source' }, 400);
    const required = table === 'news_posts' ? ['title', 'body'] : table === 'events' ? ['title', 'description'] : ['title'];
    if (required.some((k: string) => !String(translated[k] || '').trim())) return j({ error: 'translation_fields' }, 400);
    const select = table === 'news_posts' ? 'id,section,title,body,updated_at,created_at' :
      table === 'events' ? 'id,title,description,starts_at,created_at' : 'id,title,published,created_at';
    const sourceR = await rest(table + '?select=' + select + '&id=eq.' + encodeURIComponent(sourceId) + '&limit=1');
    if (!sourceR.ok) return j({ error: 'source_read' }, 500);
    const sourceRows = await sourceR.json();
    if (!sourceRows.length) return j({ error: 'source_missing' }, 404);
    const source = sourceRows[0], original = contentFor(table, source);
    const submittedOriginal = b.source_snapshot && typeof b.source_snapshot === 'object' ? b.source_snapshot : {};
    if (required.some((k: string) => String(submittedOriginal[k] || '') !== String(original[k] || ''))) return j({ error: 'source_changed' }, 409);
    const payload = {
      source_table: table, source_id: sourceId, locale: 'es',
      original_content: original, translated_content: translated,
      source_updated_at: updatedFor(table, source), status: 'pending_review',
      review_notes: String(b.review_notes || '').slice(0, 2000) || null, reviewed_at: null, approved_at: null, updated_at: new Date().toISOString()
    };
    const saveR = await rest('news_translations?on_conflict=source_table,source_id,locale', {
      method: 'POST', body: JSON.stringify(payload), prefer: 'resolution=merge-duplicates,return=representation'
    });
    if (!saveR.ok) return j({ error: 'translation_save' }, 400);
    return j({ ok: true, translation: (await saveR.json())[0] || payload });
  }
  if (a === 'translationApprove') {
    const table = String(b.source_table || ''), sourceId = String(b.source_id || '');
    if (!translationSources.includes(table) || !sourceId || sourceId.length > 180) return j({ error: 'source' }, 400);
    const existingR = await rest('news_translations?select=id,translated_content,source_updated_at&source_table=eq.' + table + '&source_id=eq.' + encodeURIComponent(sourceId) + '&locale=eq.es&limit=1');
    if (!existingR.ok) return j({ error: 'translation_read' }, 500);
    const existing = (await existingR.json())[0];
    const required = table === 'news_posts' ? ['title','body'] : table === 'events' ? ['title','description'] : ['title'];
    if (!existing || required.some((k: string) => !String(existing.translated_content?.[k] || '').trim())) return j({ error: 'translation_missing' }, 404);
    // No approval is allowed for stale text.
    const checkSelect = table === 'news_posts' ? 'id,title,body,updated_at,created_at' : table === 'events' ? 'id,title,description,created_at,starts_at' : 'id,title,published,created_at';
    const checkR = await rest(table + '?select=' + checkSelect + '&id=eq.' + encodeURIComponent(sourceId) + '&limit=1');
    if (!checkR.ok) return j({ error: 'source_read' }, 500);
    const current = (await checkR.json())[0];
    if (!current) return j({ error: 'source_missing' }, 404);
    const currentUpdated = updatedFor(table, current), currentContent = contentFor(table, current);
    const requiredContent = table === 'news_posts' ? ['title','body'] : table === 'events' ? ['title','description'] : ['title'];
    if (requiredContent.some((k: string) => String(currentContent[k] || '') !== String(existing.original_content?.[k] || ''))) return j({ error: 'source_changed' }, 409);
    if (existing.source_updated_at && currentUpdated && new Date(currentUpdated).getTime() > new Date(existing.source_updated_at).getTime()) return j({ error: 'source_changed' }, 409);
    const stamp = new Date().toISOString();
    const approveR = await rest('news_translations?source_table=eq.' + table + '&source_id=eq.' + encodeURIComponent(sourceId) + '&locale=eq.es', {
      method: 'PATCH', body: JSON.stringify({ status: 'approved', reviewed_at: stamp, approved_at: stamp, updated_at: stamp, review_notes: null })
    });
    return approveR.ok ? j({ ok: true }) : j({ error: 'translation_approve' }, 400);
  }
  return j({ error: 'action' }, 400);
});
