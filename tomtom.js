/* 423.news — traffic incidents, shared by the homepage, conditions, desk, Claudia pages.
   Reads saved incidents from the 423 traffic service (a Cloudflare Worker that asks TomTom on a schedule).
   No TomTom key lives in this file or in the browser, so visitors and the Refresh button cannot use up the quota.
   TomTom.incidents(lat, lon, radiusKm) -> Promise<[{type,text,severe,delay,length,from,to,road,lat,lon}]>
   The old 4th argument (a key) is ignored, so the pages that still pass one keep working.
   When it fails the error says why, so the page can show it. */
(function () {
  'use strict';

  var API = 'https://traffic.423.news/';
  var CACHE_MS = 60000;   /* one request per minute per page, shared by every hub */

  var TYPES = { 0: 'Incident', 1: 'Accident', 2: 'Fog', 3: 'Dangerous conditions', 4: 'Rain', 5: 'Ice', 6: 'Jam', 7: 'Lane closed',
    8: 'Road closed', 9: 'Road works', 10: 'Wind', 11: 'Flooding', 14: 'Broken down vehicle' };
  var SEVERE = { 1: 1, 5: 1, 6: 1, 7: 1, 8: 1, 11: 1 };

  var cache = null, pending = null;

  function load() {
    if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.json);
    if (pending) return pending;
    pending = fetch(API, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { var e = new Error('The traffic service returned HTTP ' + r.status + '.'); e.status = r.status; throw e; }
      return r.json();
    }, function () {
      var e = new Error('Could not reach the traffic service (network or the address is blocked).'); e.status = 0; throw e;
    }).then(function (json) {
      cache = { at: Date.now(), json: json }; pending = null; return json;
    }, function (e) { pending = null; throw e; });
    return pending;
  }

  function box(lat, lon, km) {
    var d = km / 111, dl = d / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    return [lon - dl, lat - d, lon + dl, lat + d];
  }

  function convert(i) {
    var p = i.properties || {}, ev = (p.events && p.events[0]) || {};
    var cat = p.iconCategory != null ? p.iconCategory : ev.iconCategory;
    var type = TYPES[cat] || 'Incident', road = (p.roadNumbers || []).join(', ');
    var g = i.geometry || {}, c = g.coordinates, pt = null;
    if (c && c.length) { var q = g.type === 'LineString' ? c[0] : c; if (q && typeof q[0] === 'number') pt = { lon: q[0], lat: q[1] }; }
    return {
      type: type, text: ev.description || type, severe: !!SEVERE[cat] || (p.magnitudeOfDelay || 0) >= 3,
      delay: p.delay || null, length: p.length || null, from: p.from || road || null, to: p.to || null,
      road: road || null, lat: pt ? pt.lat : null, lon: pt ? pt.lon : null
    };
  }

  window.TomTom = {
    incidents: function (lat, lon, km) {
      km = km || 12;
      return load().then(function (json) {
        var data = json.data || {}, cities = Object.keys(data);
        if (!json.updated || !cities.length) {
          var errs = json.errors || {}, codes = Object.keys(errs).map(function (k) { return String(errs[k]).split(' ')[0]; });
          throw new Error('Live traffic is not available yet' + (codes.length ? ' (TomTom error ' + codes[0] + ')' : '') + '. It updates every hour.');
        }
        var b = box(lat, lon, km), list = [], total = 0, located = 0;
        cities.forEach(function (c) {
          ((data[c] && data[c].incidents) || []).forEach(function (i) {
            var x = convert(i); total++;
            if (x.lat == null || x.lon == null) return;
            located++;
            if (x.lon >= b[0] && x.lat >= b[1] && x.lon <= b[2] && x.lat <= b[3]) list.push(x);
          });
        });
        if (total > 0 && located === 0) throw new Error('The traffic service is missing incident locations. Update the traffic Worker.');
        var seen = {};
        list = list.filter(function (x) { var k = [x.type, x.text, x.from, x.to].join('|'); if (seen[k]) return false; seen[k] = 1; return true; });
        list.sort(function (a, b2) { return (b2.severe ? 1 : 0) - (a.severe ? 1 : 0); });
        return list;
      });
    }
  };
})();
