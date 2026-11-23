import test from "node:test";
import assert from "node:assert/strict";
import { isWithinCoverage, normalizeIncident, makeIncidentPayload } from "./server.js";

test("coverage check rejects random and out-of-region coordinates",()=>{
  assert.equal(isWithinCoverage(35.0456,-85.3097),true);
  assert.equal(isWithinCoverage(40.7,-74.0),false);
  assert.equal(isWithinCoverage(NaN,-85),false);
});
test("incident input requires title and location",()=>{
  assert.throws(()=>normalizeIncident({title:"Crash"}),/location_raw/);
  assert.throws(()=>normalizeIncident({location_raw:"Cleveland"}),/title/);
});
test("incident input safely bounds strings and defaults status",()=>{
  const i=normalizeIncident({title:"Crash",location_raw:"I-75 near Cleveland",transcript:"x".repeat(5000),status:"unexpected"});
  assert.equal(i.status,"developing");
  assert.equal(i.transcript.length,4000);
});
test("unresolved geocoding does not create fake map pins",()=>{
  const i=normalizeIncident({title:"Crash",location_raw:"unconfirmed location"});
  const payload=makeIncidentPayload(i,{located:false,reason:"no_confident_local_match"});
  assert.equal(payload.map_ready,false);
  assert.equal(payload.lat,null);
  assert.equal(payload.lng,null);
  assert.equal(payload.location_status,"no_confident_local_match");
});
test("confirmed geocoding carries a real matched location and pin",()=>{
  const i=normalizeIncident({title:"Crash",location_raw:"I-75"});
  const payload=makeIncidentPayload(i,{located:true,lat:35.2,lng:-85.1,place_name:"I-75, Tennessee",confidence:0.91});
  assert.equal(payload.map_ready,true);
  assert.equal(payload.lat,35.2);
  assert.equal(payload.location_confidence,0.91);
});
