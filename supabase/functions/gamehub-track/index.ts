// 423.news Arcade analytics intake. Requires Supabase Edge JWT verification (anon key).
const SUPABASE_URL = 'https://kdiwehqtezlhecxsoysj.supabase.co';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed = new Set(['https://423.news','https://www.423.news']);
const headers = (origin: string) => ({
  'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://423.news',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin'
});
Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok',{headers:headers(origin)});
  const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:headers(origin)});
  if (!allowed.has(origin)) return out({error:'origin'},403);
  if(req.method!=='POST') return out({error:'method'},405);
  let b:any; try{b=await req.json()}catch{return out({error:'json'},400)}
  const type=String(b.event_type||'');
  if(!['page_view','game_launch','download'].includes(type))return out({error:'event'},400);
  const slug=String(b.game_slug||'').trim().toLowerCase();
  if(slug&&! /^[a-z0-9-]{1,80}$/.test(slug))return out({error:'game'},400);
  const visitor=String(b.visitor_id||''),session=String(b.session_id||''),item=String(b.item_name||'').slice(0,120);
  if(!/^[0-9a-f-]{36}$/i.test(visitor)||!/^[0-9a-f-]{36}$/i.test(session))return out({error:'id'},400);
  const row={event_type:type,game_slug:slug,visitor_id:visitor,session_id:session,item_name:item};
  const r=await fetch(SUPABASE_URL+'/rest/v1/gamehub_events',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)});
  return out({ok:r.ok},r.ok?200:502);
});
