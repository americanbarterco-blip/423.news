/* Shared locality guard for every public Claudia Green feed on 423.news.
   A publisher dateline alone is not proof that a syndicated story is local. */
(function (w) {
  'use strict';

  var LOCAL_RE = /\b(chattanooga|hamilton county|red bank|signal mountain|collegedale|east ridge|ooltewah|cleveland|bradley county|athens|mcminn county|dayton|rhea county|jasper|town of marion|marion, virginia|smyth county|ringgold|dalton|catoosa county|polk county|copper basin|mc caysville|mccaysville|tri-cities|tri cities|kingsport|johnson city|bristol|sullivan county|washington county|carter county|elizabethton|unicoi county|erwin|greeneville|greene county|hawkins county|rogersville|jonesborough|blountville|morristown|hamblen county|newport|cocke county|sevierville|gatlinburg|knoxville|knox county|anderson county|blount county|loudon county|monroe county|meigs county|sequatchie county|marion county|bledsoe county|roane county|claiborne county|grainger county|jefferson county|east tennessee|northeast tennessee|southeast tennessee|north georgia|northwest georgia|southwest virginia|423)\b/i;
  var LOCAL_DATELINE_RE = /\b(chattanooga|cleveland|athens|knoxville|morristown|johnson city|kingsport|bristol|tri[ -]cities|northeast tennessee|east tennessee|north georgia|southwest virginia|423 area)\b/i;
  var WORLD_RE = /\b(argentina|egypt|iran|iraq|israel|gaza|hamas|nato|putin|ukraine|russia|kremlin|china|beijing|taiwan|riyadh|venezuela|microsoft|nvidia|wall street|nasdaq|hollywood|white house|congress|supreme court|president trump|melania trump|lsu|transatlantic|artificial reef)\b/i;
  var NONLOCAL_ROUTE_RE = /\/(regional-national|en-espanol)(\/|$)/i;
  var LOCAL_ROUTE_RE = /\/(local-news|news\/local|news\/knox-county-news|knox-county-news|local)(\/|$)/i;
  var LOCAL_PUBLISHER_RE = /(^|\.)((local3news)|(wjhl)|(wate)|(wbir)|(timesfreepress)|(chattanoogan)|(clevelandbanner)|(mainstreetnews)|(nooga))\.com$/i;

  function getHostAndPath(rawUrl) {
    var match = String(rawUrl || '').match(/^https?:\/\/([^/?#]+)([^?#]*)/i);
    if (!match) return null;
    return {
      hostname: match[1].toLowerCase().replace(/:\\d+$/, ''),
      pathname: match[2] || '/'
    };
  }

  function isLocal(report) {
    if (!report || typeof report !== 'object') return false;
    var headline = String(report.headline || '');
    var summary = String(report.summary || '');
    var dateline = String(report.dateline || '');
    var tags = Array.isArray(report.tags) ? report.tags.join(' ') : String(report.tags || '');
    var sources = Array.isArray(report.sources) ? report.sources : [];
    var storyText = headline + ' ' + summary + ' ' + tags;
    var explicitLocal = LOCAL_RE.test(storyText);
    var urls = sources.map(function (s) { return String((s && s.url) || ''); });
    var regionalSyndication = urls.some(function (u) { return NONLOCAL_ROUTE_RE.test(u); });

    /* Explicit place names in the story can establish local relevance.
       A Chattanooga dateline cannot override a national/regional syndication URL. */
    if (explicitLocal) return true;
    if (regionalSyndication || WORLD_RE.test(headline + ' ' + summary)) return false;

    /* Permit generic local service items only when both the dateline and
       the source's URL identify a local publisher/local-news section. */
    var localDateline = LOCAL_DATELINE_RE.test(dateline);
    var localPublisherSection = sources.some(function (s) {
      var parsed = getHostAndPath(s && s.url);
      return !!parsed && LOCAL_PUBLISHER_RE.test(parsed.hostname) && LOCAL_ROUTE_RE.test(parsed.pathname);
    });
    return localDateline && localPublisherSection;
  }

  w.ClaudiaLocality = { isLocal: isLocal };
})(window);
