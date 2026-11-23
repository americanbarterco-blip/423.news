import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT || 8788);
const MAPBOX_TOKEN = (process.env.MAPBOX_ACCESS_TOKEN || "").trim();
const INGEST_TOKEN = (process.env.CLAUDIA_INCIDENT_INGEST_TOKEN || "").trim();
const MAX_BODY = 64 * 1024;
export const COVERAGE_BOUNDS = { minLat: 34.8, maxLat: 36.8, minLng: -85.8, maxLng: -81.4 };
export function isWithinCoverage(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= COVERAGE_BOUNDS.minLat && lat <= COVERAGE_BOUNDS.maxLat &&
    lng >= COVERAGE_BOUNDS.minLng && lng <= COVERAGE_BOUNDS.maxLng;
}
export function normalizeIncident(input) {
  const location = String(input?.location_raw ?? input?.location ?? "").trim();
  const title = String(input?.title ?? input?.incident ?? "").trim();
  if (!location || location.length > 500) throw new Error("location_raw is required (max 500 characters)");
  if (!title || title.length > 300) throw new Error("incident title is required (max 300 characters)");
  return {
    incident_id: String(input?.incident_id || input?.job_id || `incident-${Date.now()}`).slice(0,100),
    title,
    transcript: String(input?.transcript ?? "").trim().slice(0,4000),
    location_raw: location,
    status: ["developing","verified","monitoring"].includes(input?.status) ? input.status : "developing",
    source: String(input?.source || "scanner transcript").slice(0,160),
    reported_at: input?.reported_at || new Date().toISOString()
  };
}
export async function geocodeLocation(locationRaw, token = MAPBOX_TOKEN) {
  if (!token) return { located: false, reason: "geocoding_not_configured" };
  const url = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/" + encodeURIComponent(locationRaw) + ".json");
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "3");
  url.searchParams.set("country", "US");
  url.searchParams.set("bbox", "-85.8,34.8,-81.4,36.8");
  url.searchParams.set("proximity", "-85.3097,35.0456");
  url.searchParams.set("types", "address,poi,neighborhood,locality,place");
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Mapbox geocoding failed with HTTP ${response.status}`);
  const body = await response.json();
  const features = Array.isArray(body.features) ? body.features : [];
  const match = features.find(feature => Array.isArray(feature?.center) &&
    feature.center.length >= 2 && Number(feature.relevance) >= 0.75 &&
    isWithinCoverage(feature.center[1], feature.center[0]));
  if (!match) return { located: false, reason: "no_confident_local_match" };
  return { located: true, lat: match.center[1], lng: match.center[0],
    place_name: String(match.place_name || locationRaw).slice(0,300), confidence: Number(match.relevance) };
}
export function makeIncidentPayload(incident, geocode) {
  return { ...incident, location: geocode.located ? geocode.place_name : incident.location_raw,
    lat: geocode.located ? geocode.lat : null, lng: geocode.located ? geocode.lng : null,
    location_confidence: geocode.located ? geocode.confidence : null,
    map_ready: Boolean(geocode.located), location_status: geocode.located ? "located" : geocode.reason || "unlocated",
    created_at: new Date().toISOString() };
}
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" });
  res.end(body);
}
export function createService({ port = PORT, mapboxToken = MAPBOX_TOKEN, ingestToken = INGEST_TOKEN } = {}) {
  const server = http.createServer(async (req,res) => {
    if (req.method === "GET" && req.url === "/health") return json(res,200,{ok:true,service:"claudia-incident-service"});
    if (req.method !== "POST" || req.url !== "/incidents") return json(res,404,{error:"not_found"});
    if (!ingestToken || req.headers.authorization !== `Bearer ${ingestToken}`) return json(res,401,{error:"unauthorized"});
    try {
      const chunks=[]; let size=0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return json(res,413,{error:"payload_too_large"});
        chunks.push(chunk);
      }
      const input=JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const incident=normalizeIncident(input);
      const geocode=await geocodeLocation(incident.location_raw,mapboxToken);
      const payload=makeIncidentPayload(incident,geocode);
      const packet=JSON.stringify(payload); let delivered=0;
      for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) { client.send(packet); delivered++; }
      return json(res,202,{accepted:true,incident:payload,clients_notified:delivered});
    } catch(err) {
      const status=err instanceof SyntaxError?400:422;
      return json(res,status,{error:status===400?"invalid_json":String(err.message||"invalid_incident")});
    }
  });
  const wss = new WebSocketServer({server,path:"/live-incidents"});
  wss.on("connection",socket=>socket.send(JSON.stringify({type:"ready",service:"claudia-incident-service"})));
  return {server,wss,listen:()=>server.listen(port,()=>console.log(`Claudia incident service listening on ${port}`))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) createService().listen();
