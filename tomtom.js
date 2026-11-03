/* 423.news — TomTom traffic incidents, shared by the homepage, conditions, desk, Claudia pages.
   Tries TomTom's current v5 service first and falls back to the older v4 one.
   TomTom.incidents(lat, lon, radiusKm, key) -> Promise<[{type,text,severe,delay,length,from,to}]>
   When it fails the error says why (key refused, quota, blocked address), so the page can show it. */
(function () {
  'use strict';

  /* ===== YOUR TOMTOM KEY: paste it between the quotes on the next line, then save. =====
     Every traffic panel on the site (homepage, Conditions, Claudia Green, her studio) uses this one key.
     Leave it empty to keep using whatever key each page already has. */
  var SITE_KEY = 'ekv73Nbmk5yJVb1cVNekupb9dpPZShY9';
  /* ====================================================================================== */
  var TYPES = { 0: 'Incident', 1: 'Accident', 2: 'Fog', 3: 'Dangerous conditions', 4: 'Rain', 5: 'Ice', 6: 'Jam', 7: 'Lane closed',
    8: 'Road closed', 9: 'Road works', 10: 'Wind', 11: 'Flooding', 14: 'Broken down vehicle' };
  var SEVERE = { 1: 1, 5: 1, 6: 1, 7: 1, 8: 1, 11: 1 };

  function HttpErr(status, text) {
    var e = new Error(status === 401 || status === 403
      ? 'TomTom refused the key (HTTP ' + status + '). In your TomTom dashboard, make sure the key has Traffic enabled and that this site\'s address is allowed.'
      : status === 429 ? 'TomTom says the key is over its daily limit (HTTP 429).'
      : 'TomTom returned HTTP ' + status + (text ? ': ' + String(text).replace(/\s+/g, ' ').slice(0, 120) : ''));
    e.status = status; return e;
  }
  function get(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw HttpErr(r.status, t); });
      return r.json();
    }, function () { var e = new Error('Could not reach TomTom (network or the address is blocked).'); e.status = 0; throw e; });
  }
  function box(lat, lon, km) { var d = km / 111, dl = d / Math.max(0.2, Math.cos(lat * Math.PI / 180)); return [lon - dl, lat - d, lon + dl, lat + d]; }

  function v5(lat, lon, km, key) {
    var b = box(lat, lon, km);
    var fields = '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory},from,to,length,delay,roadNumbers}}}';
    var url = 'https://api.tomtom.com/traffic/services/5/incidentDetails?key=' + encodeURIComponent(key) +
      '&bbox=' + b.join(',') + '&fields=' + encodeURIComponent(fields) + '&language=en-US&timeValidityFilter=present';
    return get(url).then(function (raw) {
      return (raw.incidents || []).map(function (i) {
        var p = i.properties || {}, ev = (p.events && p.events[0]) || {}, cat = p.iconCategory != null ? p.iconCategory : ev.iconCategory;
        var type = TYPES[cat] || 'Incident', road = (p.roadNumbers || []).join(', ');
        var g = i.geometry || {}, c = g.coordinates, pt = null;
        if (c && c.length) { var q = g.type === 'LineString' ? c[0] : c; if (q && typeof q[0] === 'number') pt = { lon: q[0], lat: q[1] }; }
        return { type: type, text: ev.description || type, severe: !!SEVERE[cat] || (p.magnitudeOfDelay || 0) >= 3,
          delay: p.delay || null, length: p.length || null, from: p.from || road || null, to: p.to || null,
          road: road || null, lat: pt ? pt.lat : null, lon: pt ? pt.lon : null };
      });
    });
  }
  function v4(lat, lon, km, key) {
    var b = box(lat, lon, km);
    var url = 'https://api.tomtom.com/traffic/services/4/incidentDetails/s3/' + b.join(',') + '/10/-1/json?key=' + encodeURIComponent(key) + '&projection=EPSG4326';
    return get(url).then(function (raw) {
      return (((raw.tm || {}).poi) || []).map(function (p) {
        var desc = (p.d && p.d.description && p.d.description.value) || (typeof p.d === 'string' ? p.d : '');
        var type = TYPES[p.ic] || TYPES[p.ty] || 'Incident';
        return { type: type, text: desc || type, severe: !!SEVERE[p.ty] || p.c === 1, delay: p.dl || null, length: p.l || null, from: p.f || null, to: p.t || null };
      });
    });
  }

  window.TomTom = {
    incidents: function (lat, lon, km, key) {
      key = SITE_KEY || key;
      return v5(lat, lon, km || 12, key).catch(function (e) {
        if (e.status === 401 || e.status === 403 || e.status === 429) { e.message += ' [file v2, key ' + String(key).slice(0, 4) + '...' + String(key).slice(-2) + ']'; throw e; }     /* a key problem: v4 would fail the same way */
        return v4(lat, lon, km || 12, key).catch(function () { throw e; });         /* keep the first, clearer reason */
      }).then(function (list) {
        var seen = {};
        list = list.filter(function (x) { var k = [x.type, x.text, x.from, x.to].join('|'); if (seen[k]) return false; seen[k] = 1; return true; });
        list.sort(function (a, b) { return (b.severe ? 1 : 0) - (a.severe ? 1 : 0); });
        return list;
      });
    }
  };
})();
