# Claudia Green live incident service

Standalone Node 20+ backend that accepts already-extracted incident JSON, resolves a location against Mapbox within approximate 423 coverage bounds, and broadcasts packets to WebSocket map clients. It does **not** transcribe audio or perform LLM extraction; that step must call this service after extraction.

## Environment
- `PORT` (optional; defaults to 8788)
- `MAPBOX_ACCESS_TOKEN` (required to produce map coordinates)
- `CLAUDIA_INCIDENT_INGEST_TOKEN` (required; use a long random secret)

## Endpoints
- `GET /health` — service health
- `POST /incidents` — authenticated incident ingest, JSON body:
  `{ "title":"...", "location_raw":"...", "transcript":"...", "status":"developing", "source":"scanner transcript" }`
  Requires `Authorization: Bearer <CLAUDIA_INCIDENT_INGEST_TOKEN>`.
- WebSocket `/live-incidents` — receives incident packets. On a geocoding miss/out-of-bounds result, packet is still delivered with `map_ready:false` and `lat/lng:null`; clients must not draw a map pin.

## Coverage and safeguards
Approximate bounds are used only as a geocoder sanity filter; they do not establish the incident is local. The service biases geocoding toward Chattanooga but doesn't hardcode Nashville. It accepts only high-relevance Mapbox matches within the bounds. It never creates random fallback coordinates.

## Run and test
```sh
npm install
npm test
npm start
```

## Connecting the existing app
Load `client.js` after defining `window.CLAUDIA_INCIDENTS_WS` with the deployed secure WebSocket URL. Subscribe to the `claudia:incident` event and draw a pin only when `detail.map_ready === true`. Do not include the ingest secret in browser code. The service is not deployed by this commit; provision it on a backend host, set secrets, then connect the map.
