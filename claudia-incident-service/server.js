import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 8788);
const MAPBOX_TOKEN = (process.env.MAPBOX_ACCESS_TOKEN || "").trim();
const INGEST_TOKEN = (process.env.CLAUDIA_INCIDENT_INGEST_TOKEN || "").trim();
const MAX_BODY = 64 * 1024;

// Approximate 423-area bounds: used as a strict geocoder sanity check, not as a
// substitute for confirming an incident's location. Unknown/out-of-area locations
// stay unpinned instead of receiving fabricated/random coordinates.
export const COVERAGE_BOUNDS = { minLat: 34.8, maxLat: 36.8, minLng: -85.8, maxLng: -81.4 };
export function isWithinCoverage(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= COVERAGE_BOUNDS.minLat && lat <= COVERAGE_BOUNDS.maxLat &&
    lng >= COVERAGE_BOUNDS.minLng && lng <= COVERAGE_BOUNDS.maxLng;
}
export function normalizeIncident(input) {
  const location = String(input?.location_raw ?? input?.location ?? "").trim();
  const transcript = String(input?.transcript ?? "").trim();
  const title = String(input?.title ?? input?.incident ?? "").trim();
  if (!location || location.length > 500) throw new Error("location_raw is required (max 500 characters)");
  if (!title || title.length > 300) throw new Error("incident title is required (max 300 characters)");
  return {
    incident_id: String(input?.incident_id || input?.job_id || `incident-${Date.now()}`).slice(0,100),
    title,
    transcript: transcript.slice(0,4000),
    location_raw: location,
    status: ["developing","verified","monitoring"].includes(input?.status) ? input.status : "developing",
    source: String(input?.source || "scanner transcript").slice(0,160),
    reported_at: input?.reported_at || new Date().toISOString()
  };
}
export async function geocodeLocation(locationRaw, token = MAPBOX_TOKEN) {
  if (!token) return { located: false, reason: "geocoding_not_configured" };
  const q = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/" + encodeURIComponent(locationRaw) + ".json");
  q.searchParams.set("access_token", token);
  q.searchParams.set("limit", "3");
  q.searchParams.set("country", "US");
  q.searchParams.set("bbox", "-85.8,34.8,-81.4,36.8");
  q.searchParams.set("proximity", "-85.3097,35.0456");
  q.searchParams.set("types", "address,poi,neighborhood,locality,place");
  const response = await fetch(q, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Mapbox geocoding failed with HTTP ${response.status}`);
  const body = await response.json();
  const features = Array.isArray(body.features) ? body.features : [];
  const match = features.find(f => Array.isArray(f?.center) && f.center.length >= 2 &&
    Number(f.relevance) >= 0.75 && isWithinCoverage(f.center[1], f.center[0]));
  if (!match) return { located: false, reason: "no_confident_local_match" };
  return {
    located: true,
    lat: match.center[1],
    lng: match.center[0],
    place_name: String(match.place_name || locationRaw).slice(0,300),
    confidence: Number(match.relevance)
  };
}
export function makeIncidentPayload(incident, geocode) {
  return {
    ...incident,
    location: geocode.located ? geocode.place_name : incident.location_raw,
    lat: geocode.located ? geocode.lat : null,
    lng: geocode.located ? geocode.lng : null,
    location_confidence: geocode.located ? geocode.confidence : null,
    map_ready: Boolean(geocode.located),
    location_status: geocode.located ? "located" : geocode.reason || "unlocated",
    created_at: new Date().toISOString()
  };
}
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "content-length":Buffer.byteLength(body) });
  res.end(body);
}
const server = http.createServer(async (req,res) => {
  if (req.method === "GET" && req.url === "/health") return json(res,200,{ok:true,service:"claudia-incident-service"});
  if (req.method !== "POST" || req.url !== "/incidents") return json(res,404,{error:"not_found"});
  if (!INGEST_TOKEN || req.headers.authorization !== `Bearer ${INGEST_TOKEN}`) return json(res,401,{error:"unauthorized"});
  let size=0, chunks=[];
  req.on("data",chunk=>{size+=chunk.length;if(size>MAX_BODY){req.destroy();}});
  try {
    for await (const chunk of req) { size+=chunk.length; if(size>MAX_BODY) throw new Error("payload_too_large"); chunks.push(chunk); }
    const input=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const incident=normalizeIncident(input);
    const geocode=await geocodeLocation(incident.location_raw);
    const payload=makeIncidentPayload(incident,geocode);
    const packet=JSON.stringify(payload);
    let delivered=0;
    for(const client of wss.clients) if(client.readyState===WebSocket.OPEN){client.send(packet);delivered++;}
    return json(res,202,{accepted:true,incident:payload,clients_notified:delivered});
  } catch(err) {
    const status=err.message==="payload_too_large"?413:err instanceof SyntaxError?400:422;
    return json(res,status,{error:status===413?"payload_too_large":status===400?"invalid_json":String(err.message||"invalid_incident")});
  }
});
const wss = new WebSocketServer({server,path:"/live-incidents"});
wss.on("connection",socket=>socket.send(JSON.stringify({type:"ready",service:"claudia-incident-service"})));
server.listen(PORT,()=>console.log(`Claudia incident service listening on ${PORT}`));
