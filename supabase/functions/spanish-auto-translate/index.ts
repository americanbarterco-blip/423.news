// 423.news automated Spanish translation worker. Invoked only by the Cloudflare scheduled Worker.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://kdiwehqtezlhecxsoysj.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const CRON_SECRET = Deno.env.get("SPANISH_AUTO_TRANSLATE_SECRET") || "";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash-lite";
const BATCH_SIZE = 3;
const MAX_SOURCE_CHARS = 18000;
const SECTIONS = ["news", "community", "sports", "schools", "outdoors", "government"];
const headers = () => ({ apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" });
const json = (body, status=200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const contentFor = (table,row) => table === "news_posts" ? { title: row.title || "", body: row.body || "" } : table === "events" ? { title: row.title || "", description: row.description || "" } : { title: row.title || "" };
const updatedFor = (table,row) => row.updated_at || row.created_at || row.published || row.starts_at || null;
async function rest(path, options={}) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: { ...headers(), ...(options.headers||{}) }, ...options });
  if (!r.ok) throw new Error("database_" + r.status + "_" + path.split("?")[0]);
  return r.json();
}
function alreadySpanish(text) {
  const s = String(text||"").toLowerCase();
  if (/[¿¡ñáéíóúü]/.test(s)) return true;
  const words = (s.match(/\b(el|la|los|las|una|uno|que|para|por|con|del|de|en|se|está|fueron|será|desde|sobre|como|más|pero|también|tras|según|entre|hacia|hasta)\b/g)||[]).length;
  return words >= 5 && words / Math.max(1,(s.match(/\b[\wáéíóúñü]+\b/g)||[]).length) > 0.045;
}
function scannerExcluded(item) {
  if (item.source_table !== "news_posts") return false;
  const sample = (item.source_title + " " + (item.source_content.body||"")).slice(0,2500);
  return /scanner\s*wire|claudia\s*green|tacn\s*(p25|network)?|radio\s*(scanner|dispatch)|scanner\s*(report|log)|live\s*scanner/i.test(sample);
}
function requiredFor(table) { return table==="news_posts" ? ["title","body"] : table==="events" ? ["title","description"] : ["title"]; }
function promptFor(item) {
  const src = item.source_content;
  return [
    "Translate the supplied 423.news article into natural US Spanish.",
    "Return ONLY valid JSON with the same fields: title and body for news_posts; title and description for events; title only for news_headlines.",
    "Preserve names, dates, locations, numbers, attribution, quotes, URLs and meaning. Do not add facts, rewrite into opinion, or omit details. Use neutral newsroom Spanish. If content is empty, keep it empty.",
    "SOURCE TABLE: "+item.source_table,
    JSON.stringify(src)
  ].join("\n\n");
}
async function translate(item) {
  const fields = requiredFor(item.source_table);
  const sourceText = fields.map(k=>String(item.source_content[k]||"")).join("\n");
  if (!sourceText.trim()) throw new Error("empty_source");
  if (sourceText.length > MAX_SOURCE_CHARS) throw new Error("source_too_long");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(MODEL)+":generateContent?key="+encodeURIComponent(GEMINI_KEY);
  const r = await fetch(url, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({
    contents:[{parts:[{text:promptFor(item)}]}],
    generationConfig:{temperature:0.15,responseMimeType:"application/json"}
  }) });
  if (!r.ok) throw new Error("provider_"+r.status);
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
  let translated; try { translated=JSON.parse(text); } catch { throw new Error("invalid_provider_json"); }
  for(const field of fields) if(typeof translated[field]!=="string"||!translated[field].trim()) throw new Error("missing_"+field);
  return translated;
}
async function sources() {
  const posts = await rest("news_posts?select=id,section,slug,title,body,status,updated_at,created_at&status=eq.published&section=in.("+SECTIONS.join(",")+")&order=created_at.desc&limit=100");
  const now = new Date().toISOString();
  const events = await rest("events?select=id,title,description,starts_at,location,city,created_at&starts_at=gte."+encodeURIComponent(now)+"&order=starts_at.asc&limit=100");
  const headlines = await rest("news_headlines?select=id,league,title,url,source,published,created_at&published=not.is.null&order=published.desc&limit=100");
  return [
    ...posts.map(row=>({source_table:"news_posts",source_id:String(row.id),section:row.section,source_title:row.title,source_content:contentFor("news_posts",row),source_updated_at:updatedFor("news_posts",row),row})),
    ...events.map(row=>({source_table:"events",source_id:String(row.id),section:"events",source_title:row.title,source_content:contentFor("events",row),source_updated_at:updatedFor("events",row),row})),
    ...headlines.map(row=>({source_table:"news_headlines",source_id:String(row.id),section:"sports",source_title:row.title,source_content:contentFor("news_headlines",row),source_updated_at:updatedFor("news_headlines",row),row}))
  ];
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({error:"method_not_allowed"},405);
  if (!CRON_SECRET || req.headers.get("x-translation-cron-secret") !== CRON_SECRET) return json({error:"unauthorized"},401);
  if (!SERVICE_KEY || !GEMINI_KEY) return json({error:"missing_configuration",required:["SUPABASE_SERVICE_ROLE_KEY","GEMINI_API_KEY"]},503);
  try {
    const [list, translations] = await Promise.all([
      sources(),
      rest("news_translations?select=source_table,source_id,locale,status,original_content,source_updated_at&locale=eq.es&limit=2000")
    ]);
    const byKey = new Map(translations.map(t=>[t.source_table+":"+t.source_id,t]));
    const candidates = list.filter(item=>{
      const old=byKey.get(item.source_table+":"+item.source_id);
      if(scannerExcluded(item)) return false;
      const original=JSON.stringify(item.source_content);
      if(alreadySpanish(item.source_title+" "+(item.source_content.body||item.source_content.description||""))) return false;
      if(old && old.status==="pending_review") return false; // preserve human drafts
      if(old && old.status==="approved" && JSON.stringify(old.original_content||{})===original) return false;
      return true;
    });
    let translated=0,failed=0,skipped=0;
    const errors=[];
    for(const item of candidates.slice(0,BATCH_SIZE)){
      try {
        const translatedContent=await translate(item);
        const payload={source_table:item.source_table,source_id:item.source_id,locale:"es",original_content:item.source_content,translated_content:translatedContent,source_updated_at:item.source_updated_at,status:"approved",review_notes:"AUTOMATED SPANISH TRANSLATION — published automatically; not human-reviewed. Source facts and wording may need editorial verification.",reviewed_at:null,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        await rest("news_translations?on_conflict=source_table,source_id,locale",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(payload)});
        translated++;
      } catch(e) { failed++; errors.push({source_table:item.source_table,source_id:item.source_id,error:String(e.message||e)}); }
    }
    skipped=list.length-candidates.length;
    return json({ok:true,checked:list.length,candidates:candidates.length,translated,failed,skipped,remaining:Math.max(0,candidates.length-BATCH_SIZE),model:MODEL,errors});
  } catch(e) { return json({ok:false,error:String(e.message||e)},500); }
});
