/* 423.news — live app. Hash-routed single page on Supabase (auth, posts, comments, photos, realtime). */
(function () {
  'use strict';

  var SB_URL = 'https://kdiwehqtezlhecxsoysj.supabase.co';
  /* Public anon key — safe in the browser. Row Level Security protects the data. */
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkaXdlaHF0ZXpsaGVjeHNveXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDQzOTEsImV4cCI6MjEwNjIyMDM5MX0.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE';
  var MEDIA_BASE = SB_URL + '/storage/v1/object/public/news-media/';
  var VIDEO_BASE = SB_URL + '/storage/v1/object/public/news-video/';

  var SECTIONS = {
    news:        { label: 'News',        emoji: '📰', blurb: 'Local reporting from across the region.' },
    sports:      { label: 'Local Sports', emoji: '🏈', blurb: 'High school, college, youth and Little League sports from every program across the 423.' },
        outdoors:    { label: 'Outdoors',    emoji: '🏞️', blurb: 'Trails, lakes, hunting, fishing and getting outside.' },
    classifieds: { label: 'Classifieds', emoji: '🏷️', blurb: 'Buy, sell and trade with your neighbors.' },
    community:   { label: 'citizen423report',   emoji: '👥', blurb: 'Real people. Local stories.' },
    government:  { label: 'Government',  emoji: '🏛️', blurb: 'Councils, commissions, courts and public meetings.' }
  };
  var SPORTS_TOPICS = [['all', 'All Local Sports'], ['highschool', 'High School'], ['college', 'College'], ['littleleague', 'Little League'], ['youth', 'Youth & Rec']];
  var COMMUNITY_TOPICS = [
    ['all', 'All Posts'], ['photos', 'Photos'], ['events', 'Events'],
    ['discussions', 'Discussions'], ['lost', 'Lost & Found'], ['announcements', 'Announcements'],
    ['checkpoint', 'Checkpoints'], ['accident', 'Accidents'], ['roadblock', 'Roadblocks']
  ];
  var CLASSIFIED_TOPICS = [['all', 'All'], ['sell', 'For Sale'], ['buy', 'Wanted'], ['trade', 'Trade']];
  var TOPIC_LABEL = { events: 'Events', discussions: 'Discussions', lost: 'Lost & Found', announcements: 'Announcements', highschool: 'High School', college: 'College', littleleague: 'Little League', youth: 'Youth & Rec', checkpoint: 'Checkpoint', accident: 'Accident', roadblock: 'Roadblock', general: 'General', sell: 'For Sale', buy: 'Wanted', trade: 'Trade', photos: 'Photos' };

  /* GPS on road reports: the post body carries one marker line, [[gps:lat,lng]], added only when the poster ticks the box. */
  var GPS_TOPICS = { checkpoint: 1, accident: 1, roadblock: 1 };
  var GPS_RE = /\n?\[\[gps:(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)\]\]\s*$/;
  function splitGps(body) {
    var m = GPS_RE.exec(String(body || ''));
    if (!m) return { text: String(body || ''), lat: null, lng: null };
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return { text: String(body || '').replace(GPS_RE, ''), lat: null, lng: null };
    return { text: String(body).replace(GPS_RE, ''), lat: lat, lng: lng };
  }
  function gpsLink(body) {
    var g = splitGps(body); if (g.lat == null) return '';
    return '<p style="margin-top:12px"><a class="btn dark sm" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=' + g.lat + '&mlon=' + g.lng + '#map=16/' + g.lat + '/' + g.lng + '">📍 View location on map</a></p>';
  }
  function getGps() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(function (p) {
        resolve({ lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) });
      }, function () { resolve(null); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });
  }
  var POST_COLS = 'id,slug,section,topic,title,body,image_url,video_url,price,author_id,author_name,status,created_at';

  if (!window.supabase || !window.supabase.createClient) {
    document.getElementById('app').innerHTML = '<div class="err">Could not load the data library. Check your connection and refresh.</div>';
    return;
  }
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  var state = { user: null, profile: null, route: null, token: 0 };

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isStaff() { return !!(state.profile && (state.profile.role === 'editor' || state.profile.role === 'admin')); }
  window.News423 = { sb: sb, key: SB_KEY, isStaff: isStaff, profileLoaded: function () { return !!state.authReady; } };
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = 'none'; }, 3600);
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' days ago';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function safeVid(u) { return (u && String(u).indexOf(VIDEO_BASE) === 0) ? u : ''; }
  function vid(p) { var u = safeVid(p.video_url); return u ? '<video class="ugc-video" controls playsinline preload="metadata" src="' + esc(u) + '"></video>' : ''; }
  function safeImg(u) { return (u && String(u).indexOf(MEDIA_BASE) === 0) ? u : ''; }
  function money(n) { return n == null ? '' : '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  function excerpt(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function secEmoji(s) { return (SECTIONS[s] || SECTIONS.news).emoji; }
  function media(p, cls) {
    var u = safeImg(p.image_url);
    return u ? '<img ' + (cls ? 'class="' + cls + '" ' : '') + 'src="' + esc(u) + '" alt="" loading="lazy">'
             : '<div class="ph ' + (cls || '') + '" aria-hidden="true">' + secEmoji(p.section) + '</div>';
  }
  function href(p) { return '#/story/' + encodeURIComponent(p.slug); }
  function label(p) { return (p.topic && TOPIC_LABEL[p.topic]) || (SECTIONS[p.section] || {}).label || 'News'; }

  /* ---------- cards ---------- */
  function card(p) {
    return '<a class="panel card" href="' + href(p) + '">' + media(p) +
      '<div class="pad"><span class="badge">' + esc(label(p)) + '</span>' +
      '<h3>' + esc(p.title) + '</h3>' +
      (p.price != null ? '<div class="price">' + esc(money(p.price)) + '</div>' : '') +
      '<p class="muted">' + esc(excerpt(splitGps(p.body).text, 110)) + '</p>' +
      '<p class="muted">' + esc(p.author_name) + ' · ' + esc(ago(p.created_at)) + '</p></div></a>';
  }
  function tile(p) {
    return '<a class="tile" href="' + href(p) + '">' + media(p) +
      '<span class="badge">' + esc(label(p)) + '</span><h3>' + esc(p.title) + '</h3>' +
      '<p class="muted">' + esc(ago(p.created_at)) + '</p></a>';
  }
  function mini(p) {
    return '<a class="mini" href="' + href(p) + '">' + media(p) +
      '<div><span class="badge">' + esc(label(p)) + '</span><h3>' + esc(p.title) + '</h3>' +
      '<p class="muted">' + esc(ago(p.created_at)) + '</p></div></a>';
  }
  function ugc(p) {
    return '<article class="panel ugc"><div class="byline"><b>' + esc(p.author_name) + '</b><span class="muted">' + esc(ago(p.created_at)) + ' · ' + esc(label(p)) + '</span></div>' +
      (safeImg(p.image_url) ? media(p) : '') + vid(p) +
      '<h3>' + esc(p.title) + '</h3><p class="muted">' + esc(excerpt(splitGps(p.body).text, 160)) + '</p>' +
      '<div class="foot"><a href="' + href(p) + '">💬 Read &amp; comment</a><button type="button" data-share="' + esc(p.slug) + '">↗ Share</button><button type="button" data-flagpost="' + esc(p.id) + '">🚩 Flag</button></div></article>';
  }
  function empty(title, text, btn) {
    return '<div class="panel empty"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (btn || '') + '</div>';
  }
  function errBox(e) {
    return '<div class="err">Something went wrong loading this page. <button class="linkbtn" data-retry>Try again</button>' +
      (e && e.message ? '<div class="muted" style="margin-top:6px">' + esc(e.message) + '</div>' : '') + '</div>';
  }

  /* ---------- data ---------- */
  function listPosts(opts) {
    opts = opts || {};
    var q = sb.from('news_posts').select(POST_COLS).eq('status', 'published').order('created_at', { ascending: false }).limit(opts.limit || 40);
    if (opts.section) q = q.eq('section', opts.section);
    else if (!opts.sections) q = q.neq('section', 'community');   /* community posts show only inside citizen423report */
    if (opts.sections) q = q.in('section', opts.sections);
    if (opts.topic && opts.topic !== 'all') q = q.eq('topic', opts.topic);
    if (opts.photos) q = q.not('image_url', 'is', null);
    if (opts.search) {
      var t = opts.search.replace(/[%_,()\\]/g, ' ').trim().slice(0, 60);
      if (t) q = q.or('title.ilike.%' + t + '%,body.ilike.%' + t + '%');
    }
    return q.then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }

  /* ---------- Claudia wire integration ---------- */
  function claudiaSection(r) {
    var t = [r.headline, r.summary, (r.tags || []).join(' '), r.dateline].join(' ');
    var rules = [
      ['sports', /\b(sports?|football|basketball|baseball|softball|soccer|wrestling|volleyball|athlete|coach|team|tournament|playoff|little league)\b/i],
      ['outdoors', /\b(outdoors?|fishing|hunting|boating|camping|trail|lake|wildlife|parks?|wildfire)\b/i],
      ['government', /\b(government|city council|county commission|commissioners?|mayor|election|vote|court|lawsuit|ordinance|budget|public meeting|school board)\b/i],
      ['news', /\b(police|sheriff|fire|ems|ambulance|crash|accident|traffic|road|weather|storm|flood|missing|arrest|crime|closure|emergency|power outage|water outage)\b/i],
      ['classifieds', /\b(for sale|wanted|yard sale|garage sale|flea market|classifieds?|selling|trade|swap|marketplace|rent(?:al|als)?|equipment for sale|vehicle for sale)\b/i],
      ['community', /\b(community|festival|parade|fundraiser|volunteer|nonprofit|celebration|church|charity|event|announcement|lost and found)\b/i]
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(t)) return rules[i][0];
    return 'community';
  }
  function claudiaCards(rows) {
    if (!rows.length) return '';
    return '<div class="sech"><h2>Claudia Green · Local Wire</h2><a href="claudia-scanner.html">Open live wire →</a></div>' +
      '<div class="grid claudia-wire-grid">' + rows.map(function (r) {
        var summary = excerpt(r.summary || 'Follow the developing local report.', 180);
        var kind = String(r.kind || 'REPORT').replace(/[<>]/g, '');
        return '<article class="panel pad"><span class="badge">Claudia · ' + esc(kind) + '</span>' +
          '<h3><a href="report.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.headline) + '</a></h3>' +
          '<p class="muted">' + esc(summary) + '</p><div class="foot"><span class="muted">' + esc(r.dateline || '423 area') + ' · ' + esc(ago(r.ts)) + '</span>' +
          '<a href="report.html?id=' + encodeURIComponent(r.id) + '">Read report →</a></div></article>';
      }).join('') + '</div>';
  }

  /* ---------- views ---------- */
  var views = {};

  /* small mini feed of the latest citizen posts, with who posted them */
  function citizenMini(list) {
    return '<div class="sech"><h2>citizen423report</h2><a href="#/community">Join in →</a></div><div class="panel pad" style="margin-bottom:26px">' +
      list.map(function (p) {
        var nm = p.author_name || 'Neighbor';
        return '<a href="' + href(p) + '" style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);color:inherit;text-decoration:none">' +
          '<span aria-hidden="true" style="flex:0 0 32px;width:32px;height:32px;border-radius:50%;background:#7c3aed;color:#fff;display:grid;place-items:center;font-weight:800">' + esc(nm.charAt(0).toUpperCase()) + '</span>' +
          '<span style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.title) + '</b>' +
          '<small class="muted">' + esc(nm) + ' · ' + esc(ago(p.created_at)) + '</small></span></a>';
      }).join('') + '</div>';
  }

  views.home = function () {
    return Promise.all([
      listPosts({ sections: ['news', 'sports', 'outdoors', 'government'], limit: 40 }),
      listPosts({ section: 'community', limit: 5 }),
      listPosts({ section: 'classifieds', limit: 4 }),
      sb.from('news_reports').select('id,kind,dateline,headline,ts').eq('published', true).order('ts', { ascending: false }).limit(4),
      sb.from('news_scores').select('*').in('status', ['in', 'pre']).gte('start_time', new Date(Date.now() - 12 * 3600e3).toISOString()).lte('start_time', new Date(Date.now() + 3 * 86400e3).toISOString()).order('start_time', { ascending: true }).limit(12)
    ]).then(function (r) {
      var news = r[0], comm = r[1], cls = r[2], wire = (r[3] && r[3].data) || [];
      var out = '';
      var quick = '<div class="quick">' +
        [['news', '#db2777'], ['sports', '#2563eb'], ['outdoors', '#ca8a04'], ['classifieds', '#ea580c'], ['community', '#7c3aed']].map(function (x) {
          return '<a href="#/' + x[0] + '"><span style="background:' + x[1] + '" aria-hidden="true">' + SECTIONS[x[0]].emoji + '</span>' + SECTIONS[x[0]].label + '</a>';
        }).join('') + '</div>';

      if (news.length) {
        var lead = news[0], rail = news.slice(1, 4);
        out += '<div class="hero"><a class="lead" href="' + href(lead) + '">' + media(lead) +
          '<div class="lc"><span class="badge">' + esc(label(lead)) + '</span><h1>' + esc(lead.title) + '</h1>' +
          '<p>' + esc(excerpt(splitGps(lead.body).text, 160)) + '</p><p class="muted">' + esc(lead.author_name) + ' · ' + esc(ago(lead.created_at)) + '</p></div></a>' +
          '<div class="rail">' + rail.map(mini).join('') + '</div></div>';
      } else {
        out += '<div class="panel pad" style="margin-bottom:18px"><span class="badge">Welcome</span><h1>Local news, written by the people who live here</h1>' +
          '<p class="muted">Be the first to file a story, post to citizen423report, or list something for sale.</p>' +
          '<div class="row-actions"><button class="btn" data-submit="news">Submit a Story</button><a class="btn dark" href="#/community">Visit citizen423report</a></div></div>';
      }
      out += quick;
      var allG = (r[4] && r[4].data) || [];
      var liveG = allG.filter(function (g) { return g.status === 'in'; });
      var soonG = allG.filter(function (g) { return g.status === 'pre'; }).slice(0, 4);
      var showG = liveG.length ? liveG.slice(0, 6) : soonG;
      out += '<div class="sech"><h2>' + (liveG.length ? 'Live now' : 'Up next') + '</h2><a href="#/scores">All scores →</a></div>' +
        (showG.length ? '<div class="games" style="margin-bottom:26px">' + showG.map(gameCard).join('') + '</div>'
                      : '<p class="muted" style="margin-bottom:26px">No games on right now. <a href="#/scores" style="text-decoration:underline">See scores, video and headlines →</a></p>');

      /* Claudia Green's reports now live in the merged card at the top of the home page (home-live.js). */
      if (news.length > 4) {
        out += '<div class="sech"><h2>Latest</h2><a href="#/news">More news →</a></div><div class="g4">' + news.slice(4, 8).map(tile).join('') + '</div>';
        if (news.length > 8) out += '<div class="lower panel pad" style="margin-bottom:26px"><div style="grid-column:1/-1"><h2 class="sm">More stories</h2>' + news.slice(8, 16).map(mini).join('') + '</div></div>';
      }
      if (cls.length) out += '<div class="sech"><h2>Classifieds</h2><a href="#/classifieds">See all →</a></div><div class="g4">' + cls.map(tile).join('') + '</div>';
      out += comm.length ? citizenMini(comm) : '<div class="sech"><h2>citizen423report</h2><a href="#/community">Join in →</a></div><p class="muted" style="margin-bottom:26px">No posts yet. <a href="#/community" style="text-decoration:underline">Be the first to post →</a></p>';
      return out;
    });
  };

  /* Live video on the News page: same table as Scores & Live (news_streams), kept apart by league = 'news'. */
  function newsVideos() {
    return sb.from('news_streams').select('*').eq('league', 'news').eq('active', true)
      .order('sort', { ascending: true }).order('created_at', { ascending: false }).limit(20).then(function (r) {
        var list = r.error ? [] : (r.data || []);
        var streams = list.filter(function (s) { return s.kind === 'live'; }).concat(list.filter(function (s) { return s.kind !== 'live'; }));
        state.streams = streams;
        var out = '';
        if (streams.length) {
          out += '<div class="sech"><h2>Live video</h2></div><div id="vplayer">' + player(streams[0]) + '</div><div class="chips" id="vlist">' + streams.map(function (st, i) {
            return '<span class="chip"><button type="button" class="linkbtn" style="text-decoration:none;color:inherit" data-play="' + i + '">' + (st.kind === 'live' ? '🔴 ' : '▶ ') + esc(st.title) + '</button>' +
              (isStaff() ? '<button type="button" data-delstream="' + esc(st.id) + '" aria-label="Remove">×</button>' : '') + '</span>';
          }).join('') + '</div>';
        }
        if (isStaff()) {
          out += '<form id="streamForm" class="panel pad" style="margin:12px 0 24px"><b>Add live video (editors)</b><div class="hint">Paste a link from YouTube, Facebook, TikTok, X, Instagram, Vimeo or Twitch, or a direct .m3u8 / .mp4 stream. It shows here and on the home page. Only use streams you have the right to embed.</div>' +
            '<input name="title" placeholder="Title" maxlength="120" required><input name="url" placeholder="https://www.youtube.com/watch?v=…" required>' +
            '<input type="hidden" name="league" value="news">' +
            '<select name="kind"><option value="live">Live stream</option><option value="video">Video</option><option value="playlist">Playlist</option></select><button class="btn" type="submit">Add</button></form>';
        }
        return out;
      }, function () { return ''; });
  }

  function sectionView(sec, topic) {
    var meta = SECTIONS[sec];
    var tabs = '';
    var topics = sec === 'community' ? COMMUNITY_TOPICS : sec === 'classifieds' ? CLASSIFIED_TOPICS : sec === 'sports' ? SPORTS_TOPICS : null;
    topic = topic || 'all';
    if (topics) {
      tabs = '<div class="tabs">' + topics.map(function (t) {
        return '<a class="' + (t[0] === topic ? 'on' : '') + '" href="#/' + sec + (t[0] === 'all' ? '' : '/' + t[0]) + '">' + t[1] + '</a>';
      }).join('') + (sec === 'sports' ? '<a href="#/scores">Scores &amp; Live</a><a href="#/teams">⭐ My Teams</a>' : '') + '</div>';
    }
    var opts = { section: sec, limit: 60 };
    if (sec === 'community' && topic === 'photos') opts.photos = true; else opts.topic = topic;
    if (sec === 'sports') return sportsView(topic, tabs, opts);
    var vidP = sec === 'news' && topic === 'all' ? newsVideos() : Promise.resolve('');
    var wireP = sec === 'news' || sec === 'sports' || sec === 'outdoors' || sec === 'government' || sec === 'community' || sec === 'classifieds'
      ? sb.from('news_reports').select('id,kind,dateline,headline,summary,ts,tags,published').eq('published', true).order('ts', { ascending: false }).limit(200)
          .then(function (r) {
            if (r.error) return [];
            return (r.data || []).filter(function (x) {
              return window.ClaudiaLocality && window.ClaudiaLocality.isLocal(x) && claudiaSection(x) === sec;
            }).slice(0, 12);
          })
      : Promise.resolve([]);
    return Promise.all([listPosts(opts), vidP, wireP]).then(function (rr) {
      var posts = rr[0], vid = rr[1], wire = rr[2] || [];
      var head = '<div class="chead"><div style="margin-bottom:18px"><span class="badge">' + esc(meta.label) + '</span><h1>' + esc(meta.label) + '</h1><p class="muted">' + esc(meta.blurb) + '</p></div>' +
        '<button class="btn" data-submit="' + sec + '"' + (topic && topic !== 'all' && topic !== 'photos' ? ' data-topic="' + esc(topic) + '"' : '') + '>' +
        (sec === 'community' ? 'Create Post' : sec === 'classifieds' ? 'Post a Listing' : sec === 'sports' ? 'Post a Score or Story' : 'Submit a Story') + '</button></div>';
      var body;
      if (!posts.length) {
        body = empty('Nothing here yet', sec === 'news' || sec === 'sports' || sec === 'outdoors' || sec === 'government'
          ? 'Stories are reviewed by an editor before they go live. Be the first to submit one.' : 'Be the first to post.');
      } else if (sec === 'community') {
        body = '<div class="ugcs">' + posts.map(ugc).join('') + '</div>';
      } else {
        body = '<div class="grid">' + posts.map(card).join('') + '</div>';
      }
      var claudia = claudiaCards(wire);
      return head + vid + tabs + claudia + body;
    });
  }

  views.forecast = function () {
    document.title = '5-Day Forecast & Weather Videos • 423.news';
    return Promise.resolve('<div class="fx-page"><div class="sech"><h1 style="margin:0">5-Day Forecast</h1><a href="claudia-scanner.html">Area conditions →</a></div>' +
      '<div data-fx="board" data-chips="1"></div>' +
      '<div class="sech" style="margin-top:26px"><h2>423.news Forecast Videos</h2></div><div data-fx="videos" data-limit="12"></div>' +
      '<div data-fx="editor"></div></div>');
  };

  views.story = function (slug) {
    return sb.from('news_posts').select(POST_COLS).eq('slug', slug).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var p = r.data;
      if (!p) return empty('Story not found', 'It may have been removed or is still awaiting review.', '<a class="btn" href="#/home">Back to home</a>');
      document.title = p.title + ' • 423.news';
      var canEdit = state.user && (state.user.id === p.author_id || isStaff());
      var html = '<article class="article"><a class="muted" href="#/' + esc(SECTIONS[p.section] ? p.section : 'news') + '">← ' + esc((SECTIONS[p.section] || SECTIONS.news).label) + '</a>' +
        '<div style="margin-top:10px"><span class="badge">' + esc(label(p)) + '</span> ' +
        (p.status !== 'published' ? '<span class="st ' + esc(p.status) + '">' + esc(p.status) + '</span>' : '') + '</div>' +
        '<h1>' + esc(p.title) + '</h1>' +
        '<div class="muted">' + esc(p.author_name) + ' · ' + esc(ago(p.created_at)) + '</div>' +
        (p.price != null ? '<div class="price" style="margin-top:8px">' + esc(money(p.price)) + '</div>' : '') +
        (safeImg(p.image_url) ? '<img class="hero-img" src="' + esc(safeImg(p.image_url)) + '" alt="">' : '') + vid(p) +
        '<div class="body">' + esc(splitGps(p.body).text) + '</div>' + gpsLink(p.body) +
        '<div class="row-actions"><button class="btn dark sm" data-share="' + esc(p.slug) + '">↗ Share</button>' +
        (canEdit ? '<button class="btn danger sm" data-delpost="' + esc(p.id) + '">Delete</button>' : '') +
        (!(state.user && state.user.id === p.author_id) ? '<button class="btn dark sm" data-flagpost="' + esc(p.id) + '">🚩 Flag</button>' : '') + '</div>' +
        '<h2 class="sm" style="margin-top:30px">Comments</h2><div id="cmts" data-post="' + esc(p.id) + '"><p class="muted">Loading…</p></div>' +
        '<div id="cform"></div></article>';
      state.currentPost = p.id;
      return html;
    });
  };

  function loadComments() {
    var box = $('#cmts'); if (!box) return;
    var pid = box.getAttribute('data-post');
    sb.from('news_comments').select('id,author_id,author_name,body,created_at').eq('post_id', pid).order('created_at', { ascending: true }).then(function (r) {
      if (!$('#cmts')) return;
      if (r.error) { box.innerHTML = '<p class="muted">Could not load comments.</p>'; return; }
      var rows = r.data || [];
      box.innerHTML = rows.length ? rows.map(function (c) {
        var mine = state.user && (state.user.id === c.author_id || isStaff());
        return '<div class="cmt"><div class="byline"><b>' + esc(c.author_name) + '</b><span class="muted">' + esc(ago(c.created_at)) + '</span>' +
          (mine ? ' <button class="linkbtn muted" data-delcmt="' + esc(c.id) + '">delete</button>' : '') + '</div><p>' + esc(c.body) + '</p></div>';
      }).join('') : '<p class="muted">No comments yet.</p>';
    });
    var cf = $('#cform');
    if (cf) {
      cf.innerHTML = state.user
        ? '<form id="cmtForm"><label for="cbody">Add a comment</label><textarea id="cbody" rows="3" maxlength="2000" required></textarea><button class="btn" type="submit">Post comment</button></form>'
        : '<p class="muted"><button class="linkbtn" data-auth="signin">Sign in</button> to join the conversation.</p>';
    }
  }

  views.search = function (q) {
    return listPosts({ search: q, limit: 60 }).then(function (posts) {
      return '<h1>Search</h1><form id="srch2" class="srch" style="max-width:none;margin:0 0 16px"><input name="q" type="search" value="' + esc(q) + '" placeholder="Search 423.news…"></form>' +
        (posts.length ? '<p class="muted">' + posts.length + ' result' + (posts.length === 1 ? '' : 's') + ' for “' + esc(q) + '”</p><div class="grid">' + posts.map(card).join('') + '</div>'
                      : empty('No results', 'Nothing matched “' + q + '”. Try a different word.'));
    });
  };

  views.teams = function () {
    if (!state.user) return Promise.resolve(empty('Follow your teams', 'Sign in to pick the teams you follow and see their stories here.', '<button class="btn" data-auth="signin">Sign in</button>'));
    return Promise.all([
      sb.from('news_follows').select('team').eq('user_id', state.user.id).order('created_at', { ascending: true }),
      listPosts({ section: 'sports', limit: 100 })
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      var teams = (r[0].data || []).map(function (x) { return x.team; });
      var posts = r[1];
      var matched = posts.filter(function (p) {
        var hay = (p.title + ' ' + splitGps(p.body).text + ' ' + (p.topic || '')).toLowerCase();
        return teams.some(function (t) { return hay.indexOf(t.toLowerCase()) >= 0; });
      });
      return '<a class="muted" href="#/sports">← Local Sports</a><div class="chead" style="margin-top:8px"><div><span class="badge">Local Sports</span><h1>⭐ My Teams</h1><p class="muted">Sports stories that mention the teams you follow.</p></div></div>' +
        '<form id="teamForm" style="display:flex;gap:8px;align-items:flex-start"><input name="team" maxlength="80" placeholder="Add a team, e.g. Science Hill" required style="margin:0"><button class="btn" type="submit">Follow</button></form>' +
        '<div class="chips">' + (teams.length ? teams.map(function (t) { return '<span class="chip">' + esc(t) + '<button type="button" data-unfollow="' + esc(t) + '" aria-label="Unfollow ' + esc(t) + '">×</button></span>'; }).join('') : '<span class="muted">You are not following any teams yet.</span>') + '</div>' +
        (teams.length ? (matched.length ? '<div class="grid">' + matched.map(card).join('') + '</div>' : empty('No stories yet', 'We will list sports stories here as soon as one mentions your teams.')) : '');
    });
  };

  views.profile = function () {
    if (!state.user) return Promise.resolve(empty('Your profile', 'Sign in to manage your posts and display name.', '<button class="btn" data-auth="signin">Sign in</button>'));
    return Promise.all([sb.from('news_posts').select(POST_COLS).eq('author_id', state.user.id).order('created_at', { ascending: false }).limit(100), tipsHtml()]).then(function (all) {
      var r = all[0], tipsSection = all[1] || '';
      if (r.error) throw r.error;
      var mine = r.data || [];
      return '<h1>Your profile</h1><div class="panel pad" style="max-width:520px"><form id="nameForm"><label for="dn">Display name (shown on your posts)</label>' +
        '<input id="dn" name="name" maxlength="60" required value="' + esc(state.profile ? state.profile.display_name : '') + '"><div class="muted" style="margin-bottom:10px">' + esc(state.user.email || '') + (isStaff() ? ' · ' + esc(state.profile.role) : '') + '</div>' +
        '<div class="row-actions"><button class="btn" type="submit">Save</button><button class="btn dark" type="button" data-signout>Sign out</button></div></form></div>' +
        promoPanel() + pushPanel() + tipsSection + '<div class="sech" style="margin-top:26px"><h2>Your posts</h2></div>' +
        (mine.length ? mine.map(function (p) {
          return '<div class="row"><div><a href="' + href(p) + '"><b>' + esc(p.title) + '</b></a><div class="muted">' + esc(label(p)) + ' · ' + esc(ago(p.created_at)) + '</div></div><span class="st ' + esc(p.status) + '">' + esc(p.status) + '</span></div>';
        }).join('') : empty('No posts yet', 'Anything you submit will show up here with its review status.'));
    });
  };


  /* ---------- editors: send a push notification to everyone who turned alerts on ---------- */
  function promoPanel() {
    return '<div class="panel pad" style="max-width:520px;margin-top:12px"><b>🎁 423 Perks</b><p class="muted" style="margin:4px 0 8px">Free offers from local businesses. <a href="#/perks/wallet" style="text-decoration:underline">My Perks</a></p>' +
      '<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="promoChk" style="width:auto;margin-top:3px"' + (state.profile && state.profile.promo_optin ? ' checked' : '') + '><span>Email me free perks and promotions</span></label></div>';
  }
  function pushPanel() {
    if (!isStaff()) return '';
    return '<div class="sech" style="margin-top:26px"><h2>Send a notification</h2></div>' +
      '<form id="pushForm" class="panel pad" style="margin-bottom:12px"><p class="muted" style="margin-top:0">Goes to every phone that turned on 423.news alerts. Claudia\'s new reports already notify automatically.</p>' +
      '<label for="pft">Title</label><input id="pft" name="title" maxlength="80" required placeholder="e.g. Road closed on I-26">' +
      '<label for="pfb">Message</label><textarea id="pfb" name="body" rows="3" maxlength="200" required placeholder="One or two short sentences"></textarea>' +
      '<label for="pfu">Link inside the site (optional)</label><input id="pfu" name="url" maxlength="300" placeholder="e.g. claudia-scanner.html">' +
      '<div id="pfmsg" class="muted" style="min-height:20px"></div>' +
      '<div class="row-actions"><button class="btn" type="submit" id="pfsubmit">Send notification</button></div></form>';
  }

  /* ---------- scanner clips & tips for Claudia (private: staff and the sender only) ---------- */
  var CLIP_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', webm: 'audio/webm' };
  function uploadClip(file) {
    if (!file || !file.size) return Promise.resolve(null);
    var m = /\.([a-z0-9]+)$/i.exec(file.name || ''), ext = m ? m[1].toLowerCase() : '';
    if (!CLIP_MIME[ext]) return Promise.reject(new Error('Clip must be an MP3, M4A, WAV, OGG, AAC or WebM audio file.'));
    if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error('Clip is larger than 15 MB. Trim it to the part that matters.'));
    var path = state.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
    return sb.storage.from('scanner-clips').upload(path, file, { contentType: CLIP_MIME[ext], upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      return path;
    });
  }
  function openTip(direct) {
    state.tipDirect = !!(direct && isStaff());
    if (!state.user) { toast('Sign in to send Claudia a clip'); openAuth('signin'); return; }
    openModal('<h2 style="margin-top:0">' + (state.tipDirect ? 'Share a clip straight to Claudia' : 'Send Claudia a scanner clip') + '</h2>' +
      (state.tipDirect ? '<p class="muted" style="margin-top:0">This goes into Claudia\'s desk queue right away, ahead of reader tips. She transcribes it, writes her own account and runs the paraphrase check. Nothing is published as-is.</p>' : '') +
      '<p class="muted" style="margin-top:0">Share something you heard on public scanner audio. It goes privately to Claudia and the editors. ' +
      'It is never posted or played on the site. If it checks out, Claudia writes her own short account in her own words, marked unconfirmed.</p>' +
      '<form id="tipForm">' +
      '<label for="ta">Where (area or block, no street numbers)</label><input id="ta" name="area" maxlength="120" required placeholder="e.g. east side near the mall, Kingsport">' +
      '<label for="tw">When you heard it</label><input id="tw" name="heard_at" maxlength="80" placeholder="e.g. today around 6:15 PM">' +
      '<label for="tn">What you heard</label><textarea id="tn" name="note" rows="5" maxlength="2000" minlength="5" required placeholder="Units, what was happening, what changed. No names, ages or plates."></textarea>' +
      '<label for="tu">Link to the feed or archive (optional)</label><input id="tu" name="source_url" type="url" maxlength="300" placeholder="https://www.broadcastify.com/…">' +
      '<label for="tc">Audio clip (optional, MP3/M4A/WAV, up to 15 MB)</label><input id="tc" name="clip" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm">' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px"><input type="checkbox" name="ok" required style="width:auto;margin-top:3px"><span class="muted">This is public dispatch audio I am allowed to share. It is not a private call or recording.</span></label>' +
      '<div class="hint">Claudia never publishes names, street numbers, plates or ages, and does not copy radio traffic word for word.</div>' +
      '<div id="terr" style="color:#f87171;min-height:20px"></div>' +
      '<div class="row-actions"><button class="btn" type="submit" id="tsubmit">' + (state.tipDirect ? 'Send straight to Claudia' : 'Send to Claudia') + '</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
  }
  function tipsHtml() {
    var staff = isStaff();
    var q = sb.from('news_scanner_tips').select('id,author_name,area,heard_at,source_url,note,clip_path,status,to_claudia,picked_up_at,created_at').order('created_at', { ascending: false }).limit(staff ? 50 : 20);
    if (!staff) q = q.eq('author_id', state.user.id);
    return q.then(function (r) {
      var rows = r.error ? [] : (r.data || []);
      var out = '<div class="sech" style="margin-top:26px"><h2>' + (staff ? 'Scanner clips for Claudia' : 'Your scanner clips') + '</h2></div>' +
        '<div class="panel pad" style="margin-bottom:12px"><p class="muted" style="margin-top:0">Heard something on the scanner? Send Claudia a clip or a note. It stays private. She reports only her own account, never your audio.</p>' +
        '<div class="row-actions"><button class="btn" type="button" data-tip>Send Claudia a clip</button>' +
        (staff ? '<button class="btn ok" type="button" data-tip="direct">Share straight to Claudia</button>' : '') + '</div></div>';
      if (!rows.length) return out + (staff ? '<p class="muted">No clips from readers yet.</p>' : '');
      return out + rows.map(function (t) {
        var src = /^https:\/\//i.test(t.source_url || '') ? ' · <a href="' + esc(t.source_url) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">feed link</a>' : '';
        var acts = staff ? '<div class="row-actions" style="margin-top:8px">' +
          (t.clip_path ? '<button class="btn dark sm" type="button" data-tipclip="' + esc(t.clip_path) + '">Listen</button>' : '') +
          (/^https:\/\/([a-z0-9-]+\.)*broadcastify\.com\//i.test(t.source_url || '') ? '<button class="btn ok sm" type="button" data-tippost="' + esc(t.id) + '" data-name="' + esc(t.area) + '" data-url="' + esc(t.source_url) + '">Post feed on Claudia\'s page</button>' : '') +
          (!t.to_claudia && t.status === 'new' ? '<button class="btn ok sm" type="button" data-tipsend="' + esc(t.id) + '">Send to Claudia</button>' : '') +
          (t.status !== 'used' ? '<button class="btn ok sm" type="button" data-tipstatus="used" data-id="' + esc(t.id) + '">Mark used</button>' : '') +
          (t.status !== 'dismissed' ? '<button class="btn dark sm" type="button" data-tipstatus="dismissed" data-id="' + esc(t.id) + '">Dismiss</button>' : '') + '</div>' : '';
        return '<div class="panel q-item"><span class="st ' + (t.status === 'used' || t.to_claudia ? 'published' : '') + '">' + (t.to_claudia && t.status === 'new' ? (t.picked_up_at ? 'Claudia has it' : 'with Claudia') : esc(t.status)) + '</span> <span class="muted">' +
          (staff ? 'from ' + esc(t.author_name || 'a reader') + ' · ' : '') + esc(ago(t.created_at)) + src + (t.clip_path ? ' · clip attached' : '') + '</span>' +
          '<h3 style="margin:6px 0">' + esc(t.area) + (t.heard_at ? ' · ' + esc(t.heard_at) : '') + '</h3>' +
          '<p style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0">' + esc(excerpt(t.note, 700)) + '</p>' + acts + '</div>';
      }).join('');
    }, function () { return ''; });
  }

  /* ---------- live sports: scores, headlines, video ---------- */
  var LEAGUES = [['all', 'All Sports'], ['nfl', 'NFL'], ['nba', 'NBA'], ['ncaaf', 'College Football'], ['ncaab', 'College Basketball'], ['wwe', 'WWE']];
  var LEAGUE_NAME = { nfl: 'NFL', nba: 'NBA', ncaaf: 'College Football', ncaab: 'College Basketball', wwe: 'WWE', general: 'General' };
  function logo(u) { return (u && String(u).indexOf('https://a.espncdn.com/') === 0) ? '<img class="tl" src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="tl"></span>'; }
  function gameCard(g) {
    var live = g.status === 'in', done = g.status === 'post', pre = g.status === 'pre';
    var aw = !pre && g.away_score != null && g.home_score != null && g.away_score > g.home_score;
    var hw = !pre && g.away_score != null && g.home_score != null && g.home_score > g.away_score;
    var when = pre ? new Date(g.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : (g.detail || (done ? 'Final' : 'Live'));
    function row(name, abbr, lg, sc, win) {
      return '<div class="trow' + (win ? ' win' : '') + '">' + logo(lg) + '<span class="tn">' + esc(name) + '</span><span class="ts">' + (pre || sc == null ? '' : esc(sc)) + '</span></div>';
    }
    return '<div class="panel game' + (live ? ' live' : '') + '"><div class="gh"><span class="st ' + (live ? 'published' : '') + '">' + (live ? '● LIVE' : done ? 'Final' : 'Upcoming') + '</span><span class="muted">' + esc(LEAGUE_NAME[g.league] || g.league) + '</span></div>' +
      row(g.away_name, g.away_abbr, g.away_logo, g.away_score, aw) + row(g.home_name, g.home_abbr, g.home_logo, g.home_score, hw) +
      '<div class="gf muted">' + esc(when) + (g.broadcast ? ' · ' + esc(g.broadcast) : '') + '</div></div>';
  }
  function ytId(input) {
    var t = String(input || '').trim();
    var m = t.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/) || t.match(/^([A-Za-z0-9_-]{11})$/);
    return m ? m[1] : null;
  }
  function ytList(input) { var m = String(input || '').match(/[?&]list=([A-Za-z0-9_-]{10,64})/); return m ? m[1] : null; }
  function embedSrc(st) {
    var base = 'https://www.youtube-nocookie.com/embed/';
    return st.kind === 'playlist' ? base + 'videoseries?list=' + encodeURIComponent(st.ref) : base + encodeURIComponent(st.ref) + '?rel=0';
  }
  function player(st) {
    if (window.Embed423) return Embed423.html(st);
    return '<div class="vwrap"><iframe src="' + esc(embedSrc(st)) + '" title="' + esc(st.title) + '" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  }
  state.streams = [];

  views.scores = function (league) {
    league = LEAGUE_NAME[league] && league !== 'general' ? league : 'all';
    var since = new Date(Date.now() - 36 * 3600e3).toISOString();
    var until = new Date(Date.now() + 4 * 86400e3).toISOString();
    var sq = sb.from('news_scores').select('*').gte('start_time', since).lte('start_time', until).order('start_time', { ascending: true }).limit(400);
    var hq = sb.from('news_headlines').select('id,league,title,url,source,published,created_at').order('published', { ascending: false, nullsFirst: false }).limit(30);
    var vq = sb.from('news_streams').select('*').eq('active', true).neq('league', 'news').order('sort', { ascending: true }).order('created_at', { ascending: false }).limit(30);
    if (league !== 'all') { sq = sq.eq('league', league); hq = hq.eq('league', league); vq = vq.in('league', [league, 'general']); }
    return Promise.all([sq, hq, vq]).then(function (r) {
      var games = r[0].data || [], heads = r[1].data || [], streams = r[2].data || [];
      state.streams = streams;
      var live = games.filter(function (g) { return g.status === 'in'; });
      var upcoming = games.filter(function (g) { return g.status === 'pre'; }).slice(0, league === 'all' ? 12 : 30);
      var finals = games.filter(function (g) { return g.status === 'post'; }).reverse().slice(0, league === 'all' ? 12 : 30);
      var tabs = '<div class="tabs">' + LEAGUES.map(function (t) { return '<a class="' + (t[0] === league ? 'on' : '') + '" href="#/scores' + (t[0] === 'all' ? '' : '/' + t[0]) + '">' + t[1] + '</a>'; }).join('') + '</div>';
      var out = '<div class="chead"><div style="margin-bottom:14px"><span class="badge">Live</span><h1>Scores &amp; Live Sports</h1><p class="muted">Scores update automatically. Local high school results come from stories in the <a href="#/sports" style="text-decoration:underline">Sports</a> section.</p></div></div>' + tabs;

      out += '<div class="sech"><h2>Watch</h2></div>';
      if (streams.length) {
        out += '<div id="vplayer">' + player(streams[0]) + '</div><div class="chips" id="vlist">' + streams.map(function (st, i) {
          return '<span class="chip"><button type="button" class="linkbtn" style="text-decoration:none;color:inherit" data-play="' + i + '">' + (st.kind === 'live' ? '🔴 ' : '▶ ') + esc(st.title) + '</button>' +
            (isStaff() ? '<button type="button" data-delstream="' + esc(st.id) + '" aria-label="Remove">×</button>' : '') + '</span>';
        }).join('') + '</div>';
      } else {
        out += empty('No video yet', isStaff() ? 'Add a YouTube video, live stream or playlist below.' : 'Live streams and highlights will appear here.');
      }
      if (isStaff()) {
        out += '<form id="streamForm" class="panel pad" style="margin:12px 0 24px"><b>Add video (editors)</b><div class="hint">Paste a link from YouTube, Facebook, TikTok, X, Instagram, Vimeo or Twitch, or a direct .m3u8 / .mp4 stream. Only use streams you have the right to embed.</div>' +
          '<input name="title" placeholder="Title" maxlength="120" required><input name="url" placeholder="https://www.youtube.com/watch?v=…" required>' +
          '<select name="league">' + ['general', 'nfl', 'nba', 'ncaaf', 'ncaab', 'wwe'].map(function (l) { return '<option value="' + l + '">' + LEAGUE_NAME[l] + '</option>'; }).join('') + '</select>' +
          '<select name="kind"><option value="video">Video</option><option value="live">Live stream</option><option value="playlist">Playlist</option></select><button class="btn" type="submit">Add</button></form>';
      }

      if (live.length) out += '<div class="sech"><h2>Live now</h2></div><div class="games">' + live.map(gameCard).join('') + '</div>';
      if (league !== 'wwe') {
        out += '<div class="sech"><h2>Upcoming</h2></div>' + (upcoming.length ? '<div class="games">' + upcoming.map(gameCard).join('') + '</div>' : '<p class="muted" style="margin-bottom:22px">No games scheduled in the next few days.</p>');
        out += '<div class="sech"><h2>Final scores</h2></div>' + (finals.length ? '<div class="games">' + finals.map(gameCard).join('') + '</div>' : '<p class="muted" style="margin-bottom:22px">No recent finals.</p>');
      }
      out += '<div class="sech"><h2>Headlines</h2></div>' + (heads.length ? '<div class="wire">' + heads.map(function (h) {
        return '<a href="' + esc(h.url) + '" target="_blank" rel="noopener noreferrer"><div><span class="badge">' + esc(LEAGUE_NAME[h.league] || h.league) + '</span></div><div><h3>' + esc(h.title) + '</h3><span class="muted">' + esc(h.source || '') + (h.published ? ' · ' + esc(ago(h.published)) : '') + '</span></div></a>';
      }).join('') + '</div>' : '<p class="muted">No headlines yet.</p>');
      out += '<p class="muted" style="margin-top:18px">Scores and headlines from ESPN and other public feeds; links open the original publisher.</p>';
      return out;
    });
  };

  views.review = function () {
    if (!isStaff()) return Promise.resolve(empty('Editors only', 'You need an editor account to review submissions.'));
    return Promise.all([
      sb.from('news_posts').select(POST_COLS).eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      sb.from('news_flags').select('post_id,reason,note,created_at').order('created_at', { ascending: false }).limit(500)
    ]).then(function (rr) {
      var r = rr[0]; if (r.error) throw r.error;
      var flags = (rr[1] && rr[1].data) || [], byPost = {};
      flags.forEach(function (f) { (byPost[f.post_id] = byPost[f.post_id] || []).push(f); });
      var rows = r.data || [], pendingIds = {};
      rows.forEach(function (p) { pendingIds[p.id] = 1; });
      var liveIds = Object.keys(byPost).filter(function (id) { return !pendingIds[id]; }).slice(0, 60);
      function flagLine(id) {
        var fl = byPost[id] || []; if (!fl.length) return '';
        var rs = {}; fl.forEach(function (f) { rs[f.reason] = (rs[f.reason] || 0) + 1; });
        var notes = fl.filter(function (f) { return f.note; }).slice(0, 3).map(function (f) { return '“' + esc(f.note) + '”'; }).join(' · ');
        return '<div style="margin:6px 0;color:#f87171;font-weight:700">🚩 ' + fl.length + ' flag' + (fl.length === 1 ? '' : 's') + ': ' + Object.keys(rs).map(function (k) { return esc(k) + ' ×' + rs[k]; }).join(', ') + '</div>' + (notes ? '<div class="muted">' + notes + '</div>' : '');
      }
      function item(p, live) {
        return '<div class="panel q-item"><span class="badge">' + esc(label(p)) + '</span> <span class="muted">by ' + esc(p.author_name) + ' · ' + esc(ago(p.created_at)) + '</span>' + flagLine(p.id) +
          '<h3>' + esc(p.title) + '</h3>' + (safeImg(p.image_url) ? '<img src="' + esc(safeImg(p.image_url)) + '" alt="" style="max-width:240px;border-radius:8px">' : '') + vid(p) +
          '<p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(excerpt(splitGps(p.body).text, 900)) + '</p>' +
          '<div class="row-actions">' + (byPost[p.id] ? '<button class="btn ok sm" data-keepup="' + esc(p.id) + '">Keep up (clear flags)</button>' : (live ? '' : '<button class="btn ok sm" data-setstatus="published" data-id="' + esc(p.id) + '">Approve</button>')) +
          '<button class="btn danger sm" data-setstatus="rejected" data-id="' + esc(p.id) + '">Remove</button>' +
          '<a class="btn dark sm" href="' + href(p) + '">Open</a></div></div>';
      }
      var livePosts = liveIds.length ? sb.from('news_posts').select(POST_COLS).in('id', liveIds).eq('status', 'published') : Promise.resolve({ data: [] });
      return livePosts.then(function (lr) {
        var live = (lr.data || []).sort(function (a, b) { return (byPost[b.id] || []).length - (byPost[a.id] || []).length; });
        return '<h1>Review queue</h1><p class="muted">Waiting for approval or hidden by flags (' + rows.length + ').</p>' +
          (rows.length ? rows.map(function (p) { return item(p, false); }).join('') : empty('All caught up', 'No submissions are waiting.')) +
          (live.length ? '<h2 style="margin-top:28px">🚩 Flagged but still live (' + live.length + ')</h2><p class="muted">Posts hide on their own at 3 flags.</p>' + live.map(function (p) { return item(p, true); }).join('') : '');
      });
    });
  };

  /* ---------- router ---------- */
  var scrollTop = true;
  function parse() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '');
    var parts = h.split('/').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    return { name: parts[0] || 'home', a: parts[1], b: parts[2] };
  }
  function setActive(name) {
    var map = { home: '#/home', forecast: '#/forecast', news: '#/news', sports: '#/sports', scores: '#/scores',  outdoors: '#/outdoors', classifieds: '#/classifieds', community: '#/community', teams: '#/sports', alerts: '#/alerts', yardsales: '#/yardsales', perks: '#/perks', games: '#/perks', government: '#/government' };
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === map[name]); });
  }
  function render() {
    var rt = parse(); state.route = rt;
    if (rt.name === 'tip') { /* #/tip opens the scanner-clip form on top of the profile page */
      try { history.replaceState(null, '', '#/profile'); } catch (e) {}
      rt = parse(); state.route = rt;
      setTimeout(openTip, 0);
    }
    var my = ++state.token;
    var app = $('#app');
    setActive(rt.name);
    document.title = '423.news • Local News & Sports';
    app.innerHTML = '<p class="muted">Loading…</p>';
    var p;
    try {
      if (SECTIONS[rt.name]) {
        var topic = rt.a;
        if (rt.name === 'community' && topic === 'all') topic = 'all';
        p = sectionView(rt.name, topic);
        document.title = SECTIONS[rt.name].label + ' • 423.news';
      } else if (rt.name === 'story') p = views.story(rt.a || '');
      else if (rt.name === 'search') p = views.search(rt.a || '');
      else if (rt.name === 'alerts') { p = views.alerts(rt.a); }
      else if (rt.name === 'yardsales') { p = views.yardsales(rt.a); }
      else if (rt.name === 'perks') { p = views.perks(rt.a); }
      else if (rt.name === 'scores') { p = views.scores(rt.a); document.title = 'Scores & Live • 423.news'; }
      else if (views[rt.name]) p = views[rt.name]();
      else p = views.home();
    } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(function (html) {
      if (my !== state.token) return;
      app.innerHTML = html;
      if (rt.name === 'story') loadComments();
      if (scrollTop) window.scrollTo(0, 0);
      scrollTop = true;
    }).catch(function (e) {
      if (my !== state.token) return;
      app.innerHTML = errBox(e);
    });
  }

  /* ---------- modal ---------- */
  function openModal(html) {
    var m = $('#modal'); m.className = 'modal'; m.innerHTML = '<div class="panel" role="dialog" aria-modal="true">' + html + '</div>';
    var f = m.querySelector('input,textarea,select'); if (f) f.focus();
  }
  function closeModal() { var m = $('#modal'); m.className = ''; m.innerHTML = ''; }

  function openAuth(mode) {
    var signup = mode === 'signup';
    openModal('<h2 style="margin-top:0">' + (signup ? 'Create your account' : 'Sign in') + '</h2>' +
      '<form id="authForm" data-mode="' + (signup ? 'signup' : 'signin') + '">' +
      (signup ? '<label for="an">Display name</label><input id="an" name="name" maxlength="60" required autocomplete="nickname">' +
        '<label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0"><input type="checkbox" name="promo" style="width:auto;margin-top:3px"><span>Email me free perks and promotions from 423 businesses. <span class="muted">(Optional. Unsubscribe anytime.)</span></span></label>' : '') +
      '<label for="ae">Email</label><input id="ae" name="email" type="email" required autocomplete="email">' +
      '<label for="ap">Password</label><input id="ap" name="password" type="password" minlength="8" required autocomplete="' + (signup ? 'new-password' : 'current-password') + '">' +
      (signup ? '<div class="hint">At least 8 characters.</div>' : '') +
      '<div id="aerr" class="muted" style="color:#f87171;min-height:20px"></div>' +
      '<div class="row-actions"><button class="btn" type="submit">' + (signup ? 'Sign up' : 'Sign in') + '</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>' +
      '<p class="muted" style="margin-top:14px">' + (signup ? 'Already have an account? <button class="linkbtn" data-auth="signin">Sign in</button>'
        : 'New here? <button class="linkbtn" data-auth="signup">Create an account</button>') + '</p>');
  }

  function openSubmit(section, topic) {
    if (!state.user) { toast('Sign in to post'); openAuth('signin'); return; }
    section = SECTIONS[section] ? section : 'news';
    var opts = Object.keys(SECTIONS).map(function (k) { return '<option value="' + k + '"' + (k === section ? ' selected' : '') + '>' + SECTIONS[k].label + '</option>'; }).join('');
    openModal('<h2 style="margin-top:0">Post to 423.news</h2><form id="postForm">' +
      '<label for="ps">Section</label><select id="ps" name="section">' + opts + '</select>' +
      '<div id="topicWrap"></div>' +
      '<label for="pt">Title</label><input id="pt" name="title" maxlength="200" minlength="3" required>' +
      '<label for="pb">Details</label><textarea id="pb" name="body" rows="7" maxlength="20000" required></textarea>' +
      '<div id="gpsWrap" hidden><label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px"><input type="checkbox" id="pgps" name="gps" style="width:auto;margin-top:3px"><span>Show my GPS location on this report (shared to about 10 m; you will be asked for permission)</span></label></div>' +
      '<div id="priceWrap" hidden><label for="pp">Price (USD, optional)</label><input id="pp" name="price" type="number" min="0" step="0.01" inputmode="decimal"></div>' +
      '<label for="pi">Photo (optional, up to 5 MB)</label><input id="pi" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif">' +
      '<label for="pv">Video (optional, up to 50 MB: tap to record or choose one)</label><input id="pv" name="video" type="file" accept="video/mp4,video/quicktime,video/webm,video/*">' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px"><input type="checkbox" id="pvc" name="vconsent" style="width:auto;margin-top:3px"><span>I shot this video or have permission to share it, and 423.news may publish it after review.</span></label>' +
      '<div class="hint" id="pnote"></div><div id="perr" style="color:#f87171;min-height:20px"></div>' +
      '<div class="row-actions"><button class="btn" type="submit" id="psubmit">Submit</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
    var sel = $('#ps');
    function sync() {
      var s = sel.value, tw = $('#topicWrap');
      var list = s === 'community' ? ['general', 'events', 'discussions', 'lost', 'announcements', 'checkpoint', 'accident', 'roadblock'] : s === 'classifieds' ? ['sell', 'buy', 'trade'] : s === 'sports' ? ['highschool', 'college', 'littleleague', 'youth'] : null;
      tw.innerHTML = list ? '<label for="ptp">Type</label><select id="ptp" name="topic">' + list.map(function (t) { return '<option value="' + t + '"' + (t === topic ? ' selected' : '') + '>' + TOPIC_LABEL[t] + '</option>'; }).join('') + '</select>' : '';
      $('#priceWrap').hidden = s !== 'classifieds';
      var tsel = $('#ptp');
      function gpsSync() { $('#gpsWrap').hidden = !(s === 'community' && tsel && GPS_TOPICS[tsel.value]); if ($('#gpsWrap').hidden) $('#pgps').checked = false; }
      if (tsel) tsel.addEventListener('change', gpsSync);
      gpsSync();
      $('#pnote').textContent = (s === 'community' || s === 'classifieds' || isStaff()) ? 'Posts in this section go live right away.' : 'Stories are reviewed by an editor before they are published.';
      if (s === 'sports') $('#pnote').textContent += ' Youth sports: use first names only. Never post a child’s last name, address or where a child will be.';
      if ($('#pv') && $('#pv').files && $('#pv').files.length) $('#pnote').textContent = 'Posts with a video are reviewed by an editor before they go live.';
    }
    sel.addEventListener('change', sync); sync();
  }

  function uploadImage(file) {
    if (!file || !file.size) return Promise.resolve(null);
    var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
    if (!ext) return Promise.reject(new Error('Photo must be a JPG, PNG, WebP or GIF.'));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Photo is larger than 5 MB.'));
    var rand = Math.random().toString(36).slice(2, 10);
    var path = state.user.id + '/' + Date.now() + '-' + rand + '.' + ext;
    return sb.storage.from('news-media').upload(path, file, { contentType: file.type, upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      return MEDIA_BASE + path;
    });
  }

  function uploadVideo(file) {
    if (!file || !file.size) return Promise.resolve(null);
    var ext = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[file.type];
    if (!ext) return Promise.reject(new Error('Video must be MP4, MOV or WebM.'));
    if (file.size > 50 * 1024 * 1024) return Promise.reject(new Error('Video is larger than 50 MB. Record a shorter clip or trim it first.'));
    var rand = Math.random().toString(36).slice(2, 10);
    var path = state.user.id + '/' + Date.now() + '-' + rand + '.' + ext;
    return sb.storage.from('news-video').upload(path, file, { contentType: file.type, upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      return VIDEO_BASE + path;
    });
  }

  /* ---------- auth state ---------- */
  function loadProfile() {
    if (!state.user) { state.profile = null; state.authReady = true; return Promise.resolve(); }
    return sb.from('news_profiles').select('id,display_name,role,promo_optin').eq('id', state.user.id).maybeSingle().then(function (r) {
      state.profile = r.data || null; state.authReady = true;
    }, function () { state.authReady = true; });
  }
  function paintAccount() {
    var b = $('#acctBtn'), bb = $('#bAcct');
    var nm = state.user ? (state.profile ? state.profile.display_name : 'Account') : 'Sign in';
    if (b) b.textContent = nm.length > 16 ? nm.slice(0, 15) + '…' : nm;
    if (bb) bb.innerHTML = '👤<span>' + (state.user ? 'Profile' : 'Sign in') + '</span>';
    var nav = $('#nav'), old = $('#navReview');
    if (old) old.remove();
    if (isStaff()) {
      var a = document.createElement('a'); a.id = 'navReview'; a.href = '#/review'; a.textContent = 'Review';
      nav.appendChild(a);
    }
  }
  function applySession(session) {
    state.user = session && session.user ? session.user : null;
    return loadProfile().then(paintAccount);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-submit],[data-auth],[data-close],[data-share],[data-delpost],[data-delcmt],[data-unfollow],[data-setstatus],[data-signout],[data-retry],[data-play],[data-delstream],[data-tip],[data-tipclip],[data-tipstatus],[data-tipsend],[data-tippost]');
    if (!t) { if (e.target.id === 'modal') closeModal(); return; }
    if (t.hasAttribute('data-close')) { closeModal(); return; }
    if (t.hasAttribute('data-retry')) { render(); return; }
    if (t.hasAttribute('data-play')) {
      var st = state.streams[parseInt(t.getAttribute('data-play'), 10)];
      var pv = $('#vplayer'); if (st && pv) pv.innerHTML = player(st);
      return;
    }
    if (t.hasAttribute('data-delstream')) {
      if (!confirm('Remove this video from the site?')) return;
      sb.from('news_streams').delete().eq('id', t.getAttribute('data-delstream')).then(function (r) { if (r.error) toast(r.error.message); else { scrollTop = false; render(); } });
      return;
    }

    if (t.hasAttribute('data-tip')) { openTip(t.getAttribute('data-tip') === 'direct'); return; }
    if (t.hasAttribute('data-tippost')) {
      var fname = (t.getAttribute('data-name') || '').trim().slice(0, 80), furl = t.getAttribute('data-url') || '';
      if (!fname || !/^https:\/\/([a-z0-9-]+\.)*broadcastify\.com\//i.test(furl)) { toast('Needs a Broadcastify link'); return; }
      sb.from('news_scanner_feeds').upsert({ name: fname, url: furl, status: 'active', live_data: false }, { onConflict: 'name' }).then(function (r) {
        if (r.error) { toast('Failed: ' + r.error.message); return; }
        sb.from('news_scanner_tips').update({ status: 'used' }).eq('id', t.getAttribute('data-tippost')).then(function () { toast('Posted on Claudia\'s page'); scrollTop = false; render(); });
      });
      return;
    }
    if (t.hasAttribute('data-tipsend')) {
      sb.from('news_scanner_tips').update({ to_claudia: true }).eq('id', t.getAttribute('data-tipsend')).then(function (r) {
        if (r.error) toast('Failed: ' + r.error.message); else { toast('Sent to Claudia'); scrollTop = false; render(); }
      });
      return;
    }
    if (t.hasAttribute('data-tipclip')) {
      sb.storage.from('scanner-clips').createSignedUrl(t.getAttribute('data-tipclip'), 300).then(function (r) {
        if (r.error || !r.data) { toast('Could not open the clip'); return; }
        var au = document.createElement('audio'); au.controls = true; au.autoplay = true; au.src = r.data.signedUrl; au.style.cssText = 'width:100%;margin-top:6px';
        t.replaceWith(au);
      });
      return;
    }
    if (t.hasAttribute('data-tipstatus')) {
      sb.from('news_scanner_tips').update({ status: t.getAttribute('data-tipstatus') }).eq('id', t.getAttribute('data-id')).then(function (r) {
        if (r.error) toast('Failed: ' + r.error.message); else { toast('Updated'); scrollTop = false; render(); }
      });
      return;
    }
    if (t.hasAttribute('data-submit')) { openSubmit(t.getAttribute('data-submit'), t.getAttribute('data-topic')); return; }
    if (t.hasAttribute('data-auth')) { openAuth(t.getAttribute('data-auth')); return; }
    if (t.hasAttribute('data-signout')) {
      sb.auth.signOut().then(function () { toast('Signed out'); location.hash = '#/home'; });
      return;
    }
    if (t.hasAttribute('data-share')) {
      var url = location.origin + location.pathname + '#/story/' + encodeURIComponent(t.getAttribute('data-share'));
      if (navigator.share) { navigator.share({ title: '423.news', url: url }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function () { toast('Link copied'); }, function () { toast(url); }); }
      else toast(url);
      return;
    }
    if (t.hasAttribute('data-delpost')) {
      if (!confirm('Delete this post? This cannot be undone.')) return;
      sb.from('news_posts').delete().eq('id', t.getAttribute('data-delpost')).then(function (r) {
        if (r.error) { toast('Could not delete: ' + r.error.message); return; }
        toast('Deleted'); location.hash = '#/home';
      });
      return;
    }
    if (t.hasAttribute('data-delcmt')) {
      sb.from('news_comments').delete().eq('id', t.getAttribute('data-delcmt')).then(function (r) {
        if (r.error) toast('Could not delete: ' + r.error.message); else loadComments();
      });
      return;
    }
    if (t.hasAttribute('data-unfollow')) {
      sb.from('news_follows').delete().eq('user_id', state.user.id).eq('team', t.getAttribute('data-unfollow')).then(function () { render(); });
      return;
    }
    if (t.hasAttribute('data-setstatus')) {
      sb.from('news_posts').update({ status: t.getAttribute('data-setstatus') }).eq('id', t.getAttribute('data-id')).then(function (r) {
        if (r.error) toast('Failed: ' + r.error.message); else { toast('Updated'); scrollTop = false; render(); }
      });
    }
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.id) return;
    e.preventDefault();

    if (f.id === 'srch' || f.id === 'srch2') {
      var q = (new FormData(f).get('q') || '').toString().trim();
      if (q) location.hash = '#/search/' + encodeURIComponent(q);
      return;
    }

    if (f.id === 'authForm') {
      var fd = new FormData(f), mode = f.getAttribute('data-mode');
      var email = fd.get('email'), pw = fd.get('password'), btn = f.querySelector('button[type=submit]');
      var err = $('#aerr'); err.textContent = ''; btn.disabled = true;
      var run = mode === 'signup'
        ? sb.auth.signUp({ email: email, password: pw, options: { data: { name: (fd.get('name') || '').toString().trim(), promo: fd.get('promo') ? 'true' : 'false' }, emailRedirectTo: location.origin + location.pathname } })
        : sb.auth.signInWithPassword({ email: email, password: pw });
      run.then(function (r) {
        btn.disabled = false;
        if (r.error) { err.textContent = r.error.message; return; }
        if (mode === 'signup' && !r.data.session) {
          openModal('<h2 style="margin-top:0">Check your email</h2><p>We sent a confirmation link to <b>' + esc(email) + '</b>. Open it, then come back and sign in.</p><button class="btn" data-close>OK</button>');
          return;
        }
        closeModal(); toast(mode === 'signup' ? 'Welcome to 423.news!' : 'Signed in');
      });
      return;
    }

    if (f.id === 'pushForm') {
      var pd = new FormData(f), pm = $('#pfmsg'), pb = $('#pfsubmit');
      if (!confirm('Send this to everyone who turned on notifications?')) return;
      pb.disabled = true; pm.textContent = 'Sending…';
      sb.auth.getSession().then(function (r) {
        var tok = r.data && r.data.session && r.data.session.access_token;
        if (!tok) throw new Error('Please sign in again.');
        return fetch(SB_URL + '/functions/v1/push-send', { method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + tok },
          body: JSON.stringify({ title: pd.get('title'), body: pd.get('body'), url: (pd.get('url') || '').toString().trim() || 'index.html', topics: ['breaking', 'claudia'] }) });
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not send'); return j; }); })
        .then(function (j) { pb.disabled = false; pm.textContent = 'Sent to ' + j.sent + ' phone' + (j.sent === 1 ? '' : 's') + (j.failed ? ' (' + j.failed + ' failed)' : '') + '.'; f.reset(); })
        .catch(function (er) { pb.disabled = false; pm.textContent = (er && er.message) || 'Could not send.'; });
      return;
    }

    if (f.id === 'tipForm') {
      var td = new FormData(f), tsub = $('#tsubmit'), terr = $('#terr'); terr.textContent = '';
      var tsrc = (td.get('source_url') || '').toString().trim();
      if (tsrc && !/^https:\/\//i.test(tsrc)) { terr.textContent = 'The link must start with https://'; return; }
      tsub.disabled = true; tsub.textContent = 'Sending…';
      var tfile = td.get('clip');
      uploadClip(tfile && tfile.size ? tfile : null).then(function (path) {
        return sb.from('news_scanner_tips').insert({
          author_name: state.profile ? state.profile.display_name : '',
          area: (td.get('area') || '').toString().trim(), heard_at: (td.get('heard_at') || '').toString().trim(),
          source_url: tsrc, note: (td.get('note') || '').toString().trim(), clip_path: path, to_claudia: !!(state.tipDirect && isStaff()) });
      }).then(function (r) {
        if (r.error) throw r.error;
        closeModal(); toast(state.tipDirect ? 'Sent straight to Claudia' : 'Sent to Claudia. Thank you.');
        if ((state.route || {}).name === 'profile') { scrollTop = false; render(); } else location.hash = '#/profile';
      }).catch(function (er) {
        tsub.disabled = false; tsub.textContent = state.tipDirect ? 'Send straight to Claudia' : 'Send to Claudia';
        terr.textContent = (er && er.message) || 'Could not send. Try again.';
      });
      return;
    }

    if (f.id === 'postForm') {
      var d = new FormData(f), submit = $('#psubmit'), perr = $('#perr'); perr.textContent = '';
      var vfile = d.get('video');
      if (vfile && vfile.size && !d.get('vconsent')) { perr.textContent = 'Please confirm you shot the video or have permission to share it.'; return; }
      submit.disabled = true; submit.textContent = (vfile && vfile.size) ? 'Uploading video…' : 'Posting…';
      var file = d.get('image');
      var wantGps = !!d.get('gps') && d.get('section') === 'community' && !!GPS_TOPICS[d.get('topic')];
      if (wantGps) submit.textContent = 'Getting location…';
      (wantGps ? getGps() : Promise.resolve(null)).then(function (gps) {
        if (wantGps && !gps) throw new Error('Could not get your location. Allow location access in your browser, or untick the GPS box.');
        return uploadImage(file && file.size ? file : null).then(function (iu) {
          return uploadVideo(vfile && vfile.size ? vfile : null).then(function (vu) { return { img: iu, vid: vu, gps: gps }; });
        });
      }).then(function (up) {
        var imgUrl = up.img, section = d.get('section');
        var price = section === 'classifieds' && d.get('price') !== '' && d.get('price') != null ? Number(d.get('price')) : null;
        var row = { section: section, topic: d.get('topic') || null, title: (d.get('title') || '').toString().trim(), body: (d.get('body') || '').toString().trim() + (up.gps ? '\n[[gps:' + up.gps.lat + ',' + up.gps.lng + ']]' : ''), image_url: imgUrl, video_url: up.vid, price: price };
        return sb.from('news_posts').insert(row).select('slug,status,section').single();
      }).then(function (r) {
        if (r.error) throw r.error;
        closeModal();
        if (r.data.status === 'pending') { toast('Thanks! Your story was sent to an editor for review.'); location.hash = '#/profile'; }
        else { toast('Posted'); location.hash = '#/story/' + encodeURIComponent(r.data.slug); }
      }).catch(function (er) {
        submit.disabled = false; submit.textContent = 'Submit';
        perr.textContent = (er && er.message) || 'Could not post. Try again.';
      });
      return;
    }

    if (f.id === 'cmtForm') {
      var ta = $('#cbody'), body = ta.value.trim(); if (!body) return;
      var pid = $('#cmts').getAttribute('data-post'); var cb = f.querySelector('button'); cb.disabled = true;
      sb.from('news_comments').insert({ post_id: pid, body: body }).then(function (r) {
        cb.disabled = false;
        if (r.error) { toast('Could not post comment: ' + r.error.message); return; }
        ta.value = ''; loadComments();
      });
      return;
    }

    if (f.id === 'streamForm') {
      var sd = new FormData(f), url = (sd.get('url') || '').toString(), kind = sd.get('kind'), ref = null, provider = 'youtube';
      var pr = window.Embed423 ? Embed423.parse(url) : null;
      if (pr && pr.provider !== 'youtube') { provider = pr.provider; ref = pr.ref; if (kind === 'playlist') kind = 'video'; }
      else ref = kind === 'playlist' ? ytList(url) : ytId(url);
      if (!ref) { toast('That link is not supported. Use a YouTube, Facebook, TikTok, X, Instagram, Vimeo or Twitch link, or a direct .m3u8 / .mp4 link.'); return; }
      sb.from('news_streams').insert({ title: (sd.get('title') || '').toString().trim(), league: sd.get('league'), kind: kind, ref: ref, provider: provider }).then(function (r) {
        if (r.error) toast(r.error.message); else { toast('Added'); scrollTop = false; render(); }
      });
      return;
    }

    if (f.id === 'teamForm') {
      var team = (new FormData(f).get('team') || '').toString().trim(); if (!team) return;
      sb.from('news_follows').upsert({ user_id: state.user.id, team: team }, { onConflict: 'user_id,team', ignoreDuplicates: true }).then(function (r) {
        if (r.error) toast(r.error.message); else render();
      });
      return;
    }

    if (f.id === 'nameForm') {
      var nm = (new FormData(f).get('name') || '').toString().trim(); if (!nm) return;
      sb.from('news_profiles').update({ display_name: nm }).eq('id', state.user.id).then(function (r) {
        if (r.error) { toast(r.error.message); return; }
        state.profile.display_name = nm; paintAccount(); toast('Saved');
      });
    }
  });

  $('#submitBtn').addEventListener('click', function () { openSubmit('news'); });
  $('#acctBtn').addEventListener('click', function () { if (state.user) location.hash = '#/profile'; else openAuth('signin'); });
  var bp = $('#bPost'); if (bp) bp.addEventListener('click', function () { var r = state.route || {}; openSubmit(SECTIONS[r.name] ? r.name : 'community'); });
  var bs = $('#bSearch'); if (bs) bs.addEventListener('click', function () { var i = $('#q'); i.scrollIntoView({ block: 'center' }); i.focus(); });
  var ba = $('#bAcct'); if (ba) ba.addEventListener('click', function () { if (state.user) location.hash = '#/profile'; else openAuth('signin'); });

  /* ---------- realtime: refresh list pages when posts change ---------- */
  var rtTimer;
  function onChange(payload) {
    var rt = state.route || {};
    if (rt.name === 'story' && payload && payload.table === 'news_comments') { loadComments(); return; }
    if (rt.name === 'story' || rt.name === 'profile' || rt.name === 'search' || rt.name === 'teams') return;
    if ($('#modal').className) return;
    clearTimeout(rtTimer);
    rtTimer = setTimeout(function () { scrollTop = false; render(); }, 900);
  }

  var nvTimer;
  function onNewsStreams() {
    var rt = state.route || {};
    if (rt.name !== 'news' || $('#modal').className) return;
    var ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    clearTimeout(nvTimer);
    nvTimer = setTimeout(function () { var y = window.scrollY; scrollTop = false; render(); setTimeout(function () { window.scrollTo(0, y); }, 400); }, 1500);
  }
  var scTimer;
  function onScores() {
    var rt = state.route || {};
    if ((rt.name !== 'scores' && rt.name !== 'sports') || $('#modal').className) return;
    var ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    clearTimeout(scTimer);
    scTimer = setTimeout(function () { var y = window.scrollY; scrollTop = false; render(); setTimeout(function () { window.scrollTo(0, y); }, 400); }, 1500);
  }
  try {
    sb.channel('news-sports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_scores' }, onScores)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_streams' }, onScores)
      .subscribe();
    sb.channel('news-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_posts' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_comments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_streams' }, onNewsStreams)
      .subscribe();
  } catch (e) { /* page still works without live updates */ }

  /* ---------- header weather (Open-Meteo, no key) ---------- */
  function weather() {
    var el = $('#wx'); if (!el) return;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=36.3134&longitude=-82.3535&current=temperature_2m&temperature_unit=fahrenheit')
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.current && typeof j.current.temperature_2m === 'number') el.textContent = '☀️ ' + Math.round(j.current.temperature_2m) + '°F Tri-Cities'; })
      .catch(function () {});
  }

  /* ---------- Local Sports: ESPN-style front page ---------- */
  function esStyle() {
    if (document.getElementById('esStyle')) return;
    var s = document.createElement('style'); s.id = 'esStyle';
    s.textContent =
      '.es-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;padding-left:12px;border-left:6px solid #e8392f}' +
      '.es-head h1{margin:0;font-size:34px;line-height:1;font-weight:900;text-transform:uppercase;letter-spacing:-.02em;font-style:italic}' +
      '.es-sub{display:block;color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-top:4px}' +
      '.es-post{background:#e8392f!important;text-transform:uppercase;letter-spacing:.04em;font-weight:900!important;border-radius:6px!important}' +
      '.es-tabs{display:flex;gap:2px;overflow-x:auto;border-bottom:2px solid var(--line);margin:0 0 14px;scrollbar-width:none}.es-tabs::-webkit-scrollbar{display:none}' +
      '.es-tabs a{flex:0 0 auto;padding:11px 14px;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:4px solid transparent;margin-bottom:-2px;white-space:nowrap}' +
      '.es-tabs a.on{color:#fff;border-bottom-color:#e8392f}' +
      '.es-tick{display:flex;gap:0;overflow-x:auto;margin:0 0 18px;background:#0b0f16;border:1px solid var(--line);border-radius:8px;scrollbar-width:none}.es-tick::-webkit-scrollbar{display:none}' +
      '.es-sc{flex:0 0 auto;width:168px;padding:9px 12px;border-right:1px solid var(--line);color:inherit;display:block}' +
      '.es-sc:last-child{border-right:0}.es-sc:hover{background:#121826}' +
      '.es-st{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.es-st.live{color:#ff5a4d}.es-st.live:before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff3b30;margin-right:5px;animation:esp 1.2s infinite}' +
      '@keyframes esp{50%{opacity:.25}}' +
      '.es-tm{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700;line-height:1.7}.es-tm img{width:18px;height:18px;object-fit:contain}.es-tm span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.es-tm b{font-size:16px;font-weight:900}.es-tm.lose{opacity:.55}' +
      '.es-grid{display:grid;gap:16px;grid-template-columns:1fr;margin:0 0 22px}@media(min-width:820px){.es-grid{grid-template-columns:1.7fr 1fr}}' +
      '.es-hero{position:relative;display:block;border-radius:10px;overflow:hidden;min-height:260px;background:linear-gradient(135deg,#1a2438,#0b0f16);color:#fff}' +
      '.es-hero img,.es-hero video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
      '.es-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 25%,rgba(0,0,0,.88))}' +
      '.es-hero .in{position:absolute;left:0;right:0;bottom:0;padding:16px 16px 14px;z-index:2}' +
      '.es-hero h2{margin:8px 0 4px;font-size:26px;line-height:1.08;font-weight:900}.es-hero p{margin:0;opacity:.85;font-size:13px}' +
      '.es-tag{display:inline-block;background:#e8392f;color:#fff;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;padding:3px 8px;border-radius:3px}' +
      '.es-side{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:4px 14px}' +
      '.es-side h3,.es-h{margin:0;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);padding:12px 0 6px}' +
      '.es-row{display:flex;gap:11px;align-items:center;padding:11px 0;border-top:1px solid var(--line);color:inherit}.es-row:first-of-type{border-top:0}' +
      '.es-row img{width:78px;height:58px;object-fit:cover;border-radius:6px;flex:0 0 auto}' +
      '.es-row b{display:block;font-size:15px;line-height:1.2}.es-row small{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}' +
      '.es-sec{display:flex;align-items:center;justify-content:space-between;margin:20px 0 10px;padding-left:10px;border-left:5px solid #e8392f}.es-sec h2{margin:0;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-.01em}' +
      '.es-heads{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:4px 14px;margin:0 0 22px}' +
      '.es-heads a{display:block;padding:10px 0;border-top:1px solid var(--line);color:inherit;font-weight:700}.es-heads a:first-of-type{border-top:0}.es-heads small{display:block;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;margin-top:2px}';
    document.head.appendChild(s);
  }
  function esSafeLogo(u) { return /^https:\/\//i.test(u || '') ? u : ''; }
  function esScore(g) {
    var st = g.status === 'in' ? '<div class="es-st live">' + esc(g.detail || 'Live') + '</div>'
      : g.status === 'post' ? '<div class="es-st">Final · ' + esc((LEAGUE_NAME[g.league] || String(g.league || '').toUpperCase())) + '</div>'
      : '<div class="es-st">' + esc(new Date(g.start_time).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + '</div>';
    var hs = g.home_score, as = g.away_score, done = g.status !== 'pre';
    function row(name, abbr, logo, score, lose) {
      var lg = esSafeLogo(logo);
      return '<div class="es-tm' + (lose ? ' lose' : '') + '">' + (lg ? '<img src="' + esc(lg) + '" alt="" loading="lazy">' : '') + '<span>' + esc(abbr || name) + '</span>' + (done && score != null ? '<b>' + esc(score) + '</b>' : '') + '</div>';
    }
    var fin = g.status === 'post' && hs != null && as != null;
    var u = /^https:\/\//i.test(g.url || '') ? ' href="' + esc(g.url) + '" target="_blank" rel="noopener noreferrer"' : ' href="#/scores"';
    return '<a class="es-sc"' + u + '>' + st + row(g.away_name, g.away_abbr, g.away_logo, as, fin && as < hs) + row(g.home_name, g.home_abbr, g.home_logo, hs, fin && hs < as) + '</a>';
  }
  function esRow(p) {
    var im = safeImg(p.image_url);
    return '<a class="es-row" href="' + href(p) + '">' + (im ? '<img src="' + esc(im) + '" alt="" loading="lazy">' : '') + '<div><small>' + esc(label(p)) + ' · ' + esc(ago(p.created_at)) + '</small><b>' + esc(p.title) + '</b></div></a>';
  }
  function sportsView(topic, tabs, opts) {
    esStyle();
    var since = new Date(Date.now() - 30 * 3600e3).toISOString(), until = new Date(Date.now() + 36 * 3600e3).toISOString();
    var pScores = sb.from('news_scores').select('*').gte('start_time', since).lte('start_time', until).order('start_time', { ascending: false }).limit(60);
    var pHeads = sb.from('news_headlines').select('id,title,url,source,league').order('published', { ascending: false, nullsFirst: false }).limit(6);
    var pWire = sb.from('news_reports').select('id,kind,dateline,headline,summary,ts,tags,published').eq('published', true).order('ts', { ascending: false }).limit(200)
      .then(function (r) {
        if (r.error) return [];
        return (r.data || []).filter(function (x) {
          return window.ClaudiaLocality && window.ClaudiaLocality.isLocal(x) && claudiaSection(x) === 'sports';
        }).slice(0, 12);
      });
    return Promise.all([listPosts(opts), pScores, pHeads, pWire]).then(function (r) {
      var posts = r[0], games = (r[1] && r[1].data) || [], heads = (r[2] && r[2].data) || [], wire = r[3] || [];
      var live = games.filter(function (g) { return g.status === 'in'; });
      var fin = games.filter(function (g) { return g.status === 'post'; });
      var pre = games.filter(function (g) { return g.status === 'pre'; }).reverse();
      var tick = live.concat(fin.slice(0, 8), pre.slice(0, 6)).slice(0, 16);
      var head = '<div class="es-head"><div><h1>Local Sports</h1><span class="es-sub">High school · College · Youth · Little League</span></div><button class="btn es-post" data-submit="sports"' + (topic && topic !== 'all' ? ' data-topic="' + esc(topic) + '"' : '') + '>＋ Post a score or story</button></div>';
      var tabsHtml = tabs.replace('class="tabs"', 'class="es-tabs"');
      var ticker = tick.length ? '<div class="es-tick">' + tick.map(esScore).join('') + '</div>' : '';
      var body;
      if (!posts.length) {
        body = empty('Nothing posted yet', 'Coaches, parents and fans: post the first score, photo or highlight.', '<button class="btn" data-submit="sports">Post a score or story</button>');
      } else {
        var li = posts.findIndex(function (p) { return safeImg(p.image_url); });
        var lead = posts[li >= 0 ? li : 0], rest = posts.filter(function (p) { return p !== lead; });
        var side = rest.slice(0, 5), more = rest.slice(5);
        var im = safeImg(lead.image_url);
        var hero = '<a class="es-hero" href="' + href(lead) + '">' + (im ? '<img src="' + esc(im) + '" alt="">' : '') +
          '<div class="in"><span class="es-tag">' + esc(label(lead)) + '</span><h2>' + esc(lead.title) + '</h2><p>' + esc(lead.author_name) + ' · ' + esc(ago(lead.created_at)) + '</p></div></a>';
        body = '<div class="es-grid">' + hero + '<div class="es-side"><h3>Top stories</h3>' + (side.length ? side.map(esRow).join('') : '<p class="muted" style="padding:8px 0">More coming soon.</p>') + '</div></div>' +
          (more.length ? '<div class="es-sec"><h2>Latest</h2></div><div class="grid">' + more.map(card).join('') + '</div>' : '');
      }
      var hl = heads.length ? '<div class="es-sec"><h2>Around the sports world</h2><a class="muted" href="#/scores">All scores →</a></div><div class="es-heads">' + heads.map(function (h) {
        var u = /^https:\/\//i.test(h.url || '') ? h.url : '';
        return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(h.title) + '<small>' + esc(h.source || LEAGUE_NAME[h.league] || '') + '</small></a>' : '';
      }).join('') + '</div>' : '';
      return head + tabsHtml + ticker + claudiaCards(wire) + body + hl;
    });
  }

  /* ---------- flagging ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-flagpost],[data-keepup]'); if (!t) return;
    if (t.hasAttribute('data-keepup')) {
      var id = t.getAttribute('data-keepup'); t.disabled = true;
      sb.from('news_posts').update({ status: 'published' }).eq('id', id).then(function (r) {
        if (r.error) { t.disabled = false; toast(r.error.message); return; }
        return sb.from('news_flags').delete().eq('post_id', id).then(function (d) { if (d.error) toast(d.error.message); scrollTop = false; render(); });
      });
      return;
    }
    if (!state.user) { toast('Sign in to flag a post'); openAuth('signin'); return; }
    openModal('<h2 style="margin-top:0">Flag this post</h2><form id="flagForm"><input type="hidden" name="post_id" value="' + esc(t.getAttribute('data-flagpost')) + '">' +
      '<label for="fr">What is wrong?</label><select id="fr" name="reason"><option value="inappropriate">Inappropriate or offensive</option><option value="kids">Shows or names a child unsafely</option><option value="spam">Spam or ad</option><option value="false">False or misleading</option><option value="other">Something else</option></select>' +
      '<label for="fn">Details (optional)</label><textarea id="fn" name="note" rows="3" maxlength="300"></textarea>' +
      '<div id="ferr" style="color:#f87171;min-height:20px"></div><div class="row-actions"><button class="btn" type="submit" id="fsub">Send flag</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || f.id !== 'flagForm') return;
    var d = new FormData(f), b = $('#fsub'), er = $('#ferr'); er.textContent = ''; b.disabled = true;
    sb.from('news_flags').insert({ post_id: d.get('post_id'), user_id: state.user.id, reason: d.get('reason'), note: (d.get('note') || '').toString().trim() || null }).then(function (r) {
      if (r.error) { b.disabled = false; er.textContent = /duplicate|23505/i.test(r.error.message + (r.error.code || '')) ? 'You already flagged this post.' : r.error.message; return; }
      closeModal(); toast('Thanks. An editor will take a look.');
    });
  });

  /* ---------- Alerts, Yard Sales, Local Deals ---------- */
  var HUB_AREAS = ['Chattanooga', 'Cleveland', 'Athens', 'Knoxville', 'Tri-Cities', 'Other 423'];
  var ALERT_KINDS = { school: ['🏫', 'School'], outage: ['⚡', 'Outage'], road: ['🚧', 'Road'], weather: ['⛈️', 'Weather'], safety: ['🛡️', 'Safety'], other: ['📣', 'Notice'] };
  var ALERT_COLOR = { urgent: '#e8392f', warning: '#f5a524', info: '#3b82f6' };
  function hubStyle() {
    if (document.getElementById('hubStyle')) return;
    var s = document.createElement('style'); s.id = 'hubStyle';
    s.textContent =
      '.hb-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px;padding-left:12px;border-left:6px solid var(--hc,#e8392f)}' +
      '.hb-head h1{margin:0;font-size:32px;line-height:1;font-weight:900;text-transform:uppercase;font-style:italic;letter-spacing:-.02em}.hb-head span.s{display:block;color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;margin-top:4px}' +
      '.hb-chips{display:flex;gap:6px;overflow-x:auto;margin:0 0 14px;scrollbar-width:none;align-items:center}.hb-chips::-webkit-scrollbar{display:none}' +
      '.hb-chips a,.hb-chips select{flex:0 0 auto;border:1px solid var(--line);background:var(--panel);color:inherit;border-radius:99px;padding:7px 13px;font-weight:700;font-size:13px;width:auto}.hb-chips a.on{background:var(--hc,#e8392f);border-color:var(--hc,#e8392f);color:#fff}' +
      '.hb-card{background:var(--panel);border:1px solid var(--line);border-left:6px solid var(--ac,#3b82f6);border-radius:10px;padding:12px 14px;margin:0 0 10px;overflow-wrap:anywhere}' +
      '.hb-card h3{margin:4px 0;font-size:18px;line-height:1.2}.hb-meta{color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}' +
      '.hb-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.hb-grid .hb-card{margin:0}' +
      '.hb-img{width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin:8px 0 4px}' +
      '.hb-code{display:inline-block;border:2px dashed var(--accent);border-radius:6px;padding:3px 9px;font-weight:900;letter-spacing:.06em;margin:6px 0}' +
      '.hb-x{background:none;border:0;color:var(--muted);cursor:pointer;font-size:13px;text-decoration:underline;padding:0 6px 0 0}' +
      '.hb-banner{display:block;border-radius:10px;padding:10px 14px;margin:0 0 14px;color:#fff;background:var(--ac,#e8392f)}.hb-banner b{display:block}.hb-banner small{opacity:.9}' +
      '.hb-safe{font-size:12px;color:var(--muted);margin:4px 0}';
    document.head.appendChild(s);
  }
  function ymd(d) { var x = d instanceof Date ? d : new Date(d); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  function dLabel(s) { var x = new Date(s + 'T12:00:00'); return isNaN(x) ? '' : x.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
  function mapLink(addr, area) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr + ' ' + (area && area !== 'Other 423' ? area + ' TN' : '')); }
  function hubErr(e) { var m = (e && e.message) || ''; return /does not exist|schema cache/i.test(m) ? new Error('This feature is not switched on yet.') : e; }
  function weekendRange() {
    var n = new Date(), day = n.getDay(), a = new Date(n), b = new Date(n);
    if (day === 5 || day === 6 || day === 0) { b.setDate(n.getDate() + (day === 0 ? 0 : 7 - day)); }
    else { a.setDate(n.getDate() + (5 - day)); b.setDate(n.getDate() + (7 - day)); }
    return [ymd(a), ymd(b)];
  }
  function chips(base, cur, list) { return '<div class="hb-chips">' + list.map(function (c) { return '<a class="' + (c[0] === cur ? 'on' : '') + '" href="#/' + base + (c[0] === 'all' ? '' : '/' + c[0]) + '">' + c[1] + '</a>'; }).join(''); }
  function areaSelect(id) { return '<select id="' + id + '" data-hubarea aria-label="Area"><option value="">All areas</option>' + HUB_AREAS.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>'; }
  function flagBtn(kind, id, uid, authorId) {
    if (uid && authorId === uid) return '<button type="button" class="hb-x" data-hubdel="' + kind + ':' + esc(id) + '">Delete</button>';
    return '<button type="button" class="hb-x" data-itemflag="' + kind + ':' + esc(id) + '">🚩 Flag</button>' + (isStaff() ? '<button type="button" class="hb-x" data-hubdel="' + kind + ':' + esc(id) + '">Remove</button>' : '');
  }

  /* ---- alerts ---- */
  function alertActive(a) { return !a.expires_at || new Date(a.expires_at) > new Date(); }
  function alertCard(a, ended) {
    var k = ALERT_KINDS[a.kind] || ALERT_KINDS.other, col = ALERT_COLOR[a.severity] || ALERT_COLOR.info;
    var until = a.expires_at ? (ended ? 'Ended ' + ago(a.expires_at) : 'Until ' + new Date(a.expires_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })) : 'Until further notice';
    var lk = /^https:\/\//i.test(a.url || '') ? '<p><a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">More information →</a></p>' : '';
    return '<div class="hb-card" style="--ac:' + col + (ended ? ';opacity:.6' : '') + '"><div class="hb-meta">' + k[0] + ' ' + k[1] + ' · ' + esc(a.area) + ' · ' + esc(ago(a.created_at)) + '</div><h3>' + esc(a.title) + '</h3>' +
      (a.body ? '<p style="margin:4px 0;white-space:pre-wrap">' + esc(a.body) + '</p>' : '') + lk + '<div class="hb-meta">' + esc(until) + '</div>' +
      (isStaff() ? '<div style="margin-top:8px">' + (ended ? '' : '<button type="button" class="hb-x" data-alertend="' + esc(a.id) + '">End now</button>') + '<button type="button" class="hb-x" data-hubdel="alert:' + esc(a.id) + '">Delete</button></div>' : '') + '</div>';
  }
  views.alerts = function (kind) {
    hubStyle(); document.title = 'Alerts • 423.news';
    kind = ALERT_KINDS[kind] ? kind : 'all';
    return sb.from('news_alerts').select('*').order('created_at', { ascending: false }).limit(100).then(function (r) {
      if (r.error) throw hubErr(r.error);
      var all = (r.data || []).filter(function (a) { return kind === 'all' || a.kind === kind; });
      var sev = { urgent: 0, warning: 1, info: 2 };
      var act = all.filter(alertActive).sort(function (a, b) { return (sev[a.severity] - sev[b.severity]) || (new Date(b.created_at) - new Date(a.created_at)); });
      var end = all.filter(function (a) { return !alertActive(a); });
      var list = [['all', 'All']].concat(Object.keys(ALERT_KINDS).map(function (k) { return [k, ALERT_KINDS[k][0] + ' ' + ALERT_KINDS[k][1]]; }));
      return '<div class="hb-head" style="--hc:#e8392f"><div><h1>Alerts</h1><span class="s">Closings · outages · roads · weather across the 423</span></div>' + '<span><button class="btn dark" data-alertpush>🔔 Get alerts on my phone</button> ' + (isStaff() ? '<button class="btn" data-alertnew style="background:#e8392f">＋ Post alert</button>' : '') + '</span></div>' +
        chips('alerts', kind, list) + '</div>' +
        (act.length ? act.map(function (a) { return alertCard(a, false); }).join('') : '<div class="panel pad" style="margin-bottom:18px"><b>✅ All clear.</b><p class="muted" style="margin:4px 0 0">No active alerts right now.</p></div>') +
        (end.length ? '<div class="es-h" style="margin-top:18px;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.1em;font-size:13px">Recently ended</div>' + end.slice(0, 10).map(function (a) { return alertCard(a, true); }).join('') : '');
    });
  };
  function alertModal() {
    openModal('<h2 style="margin-top:0">Post an alert</h2><form id="alertForm">' +
      '<label for="al1">Type</label><select id="al1" name="kind">' + Object.keys(ALERT_KINDS).map(function (k) { return '<option value="' + k + '">' + ALERT_KINDS[k][0] + ' ' + ALERT_KINDS[k][1] + '</option>'; }).join('') + '</select>' +
      '<label for="al2">How serious</label><select id="al2" name="severity"><option value="info">Info</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select>' +
      '<label for="al3">Area</label><select id="al3" name="area"><option>All 423</option>' + HUB_AREAS.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>' +
      '<label for="al4">Headline</label><input id="al4" name="title" maxlength="140" minlength="3" required placeholder="Bradley County Schools closed Monday">' +
      '<label for="al5">Details (optional)</label><textarea id="al5" name="body" rows="3" maxlength="1000"></textarea>' +
      '<label for="al6">Source link (optional, https)</label><input id="al6" name="url" type="url" placeholder="https://">' +
      '<label for="al7">Stays up for</label><select id="al7" name="hours"><option value="3">3 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24" selected>24 hours</option><option value="72">3 days</option><option value="">Until I end it</option></select>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" name="push" checked style="width:auto"> Send a phone notification to subscribers</label>' +
      '<div id="alerr" style="color:#f87171;min-height:20px"></div><div class="row-actions"><button class="btn" type="submit" id="alsub">Post alert</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
  }

  /* ---- yard sales ---- */
  views.yardsales = function (when) {
    hubStyle(); document.title = 'Yard Sales • 423.news'; when = ['weekend', 'today', 'all'].indexOf(when) >= 0 ? when : 'weekend';
    var today = ymd(new Date()), wk = weekendRange(), uid = state.user && state.user.id;
    return sb.from('news_yardsales').select('*').gte('sale_end', today).order('sale_start', { ascending: true }).limit(200).then(function (r) {
      if (r.error) throw hubErr(r.error);
      var rows = (r.data || []).filter(function (x) {
        if (when === 'today') return x.sale_start <= today && x.sale_end >= today;
        if (when === 'weekend') return x.sale_start <= wk[1] && x.sale_end >= wk[0];
        return true;
      });
      var cards = rows.map(function (x) {
        var im = safeImg(x.image_url), same = x.sale_start === x.sale_end;
        return '<div class="hb-card" data-area="' + esc(x.area) + '" style="--ac:#16a34a' + (x.status === 'hidden' ? ';opacity:.5' : '') + '"><div class="hb-meta">🏷️ ' + esc(same ? dLabel(x.sale_start) : dLabel(x.sale_start) + ' – ' + dLabel(x.sale_end)) + (x.hours ? ' · ' + esc(x.hours) : '') + '</div>' +
          '<h3>' + esc(x.title) + '</h3><div>📍 <a href="' + esc(mapLink(x.address, x.area)) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">' + esc(x.address) + '</a> <span class="muted">· ' + esc(x.area) + '</span></div>' +
          (im ? '<img class="hb-img" src="' + esc(im) + '" alt="" loading="lazy">' : '') + (x.description ? '<p style="margin:6px 0;white-space:pre-wrap">' + esc(x.description) + '</p>' : '') +
          '<div class="hb-meta" style="margin-top:6px">Posted by ' + esc(x.author_name) + ' · ' + esc(ago(x.created_at)) + (x.status === 'hidden' ? ' · HIDDEN' : '') + '</div><div style="margin-top:6px">' + flagBtn('yardsale', x.id, uid, x.author_id) + '</div></div>';
      }).join('');
      return '<div class="hb-head" style="--hc:#16a34a"><div><h1>Yard Sales</h1><span class="s">Garage, yard and estate sales across the 423</span></div><button class="btn" data-salenew style="background:#16a34a">＋ Post a sale</button></div>' +
        chips('yardsales', when, [['weekend', 'This weekend'], ['today', 'Today'], ['all', 'All upcoming']]) + areaSelect('salearea') + '</div>' +
        '<div id="hubList">' + (cards || empty('No sales listed', 'Be the first to post one. It takes a minute and it is free.', '<button class="btn" data-salenew>Post a sale</button>')) + '</div>';
    });
  };
  function saleModal() {
    var t = ymd(new Date());
    openModal('<h2 style="margin-top:0">Post a yard sale</h2><form id="saleForm">' +
      '<label for="ys1">Title</label><input id="ys1" name="title" maxlength="100" minlength="3" required placeholder="Multi-family yard sale, tools and kids stuff">' +
      '<label for="ys2">Address</label><input id="ys2" name="address" maxlength="160" required placeholder="123 Main St">' +
      '<label for="ys3">Area</label><select id="ys3" name="area">' + HUB_AREAS.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>' +
      '<div class="hb-chips" style="margin:0"><div style="flex:1"><label for="ys4">First day</label><input id="ys4" name="start" type="date" min="' + t + '" value="' + t + '" required></div><div style="flex:1"><label for="ys5">Last day</label><input id="ys5" name="end" type="date" min="' + t + '" value="' + t + '" required></div></div>' +
      '<label for="ys6">Hours</label><input id="ys6" name="hours" maxlength="60" placeholder="8am – 2pm">' +
      '<label for="ys7">What you are selling (optional)</label><textarea id="ys7" name="description" rows="3" maxlength="800"></textarea>' +
      '<label for="ys8">Photo (optional)</label><input id="ys8" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif">' +
      '<div class="hb-safe">Sales can run up to 7 days. Only post the sale address, never your phone number or other personal details.</div>' +
      '<div id="yserr" style="color:#f87171;min-height:20px"></div><div class="row-actions"><button class="btn" type="submit" id="yssub">Post sale</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
  }

  /* ---- 423 Perks: free sponsor offers for members ---- */
  function pkStyle() {
    if (document.getElementById('pkStyle')) return;
    var s = document.createElement('style'); s.id = 'pkStyle';
    s.textContent =
      '.pk-hero{border-radius:16px;padding:18px;margin:0 0 16px;color:#fff;background:linear-gradient(135deg,#ff5a0a,#c026d3 70%,#4f46e5)}' +
      '.pk-hero h1{margin:0;font-size:32px;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}.pk-hero p{margin:6px 0 0;opacity:.95}' +
      '.pk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}' +
      '.pk-coin{background:rgba(0,0,0,.28);border-radius:99px;padding:6px 12px;font-weight:900}' +
      '.pk-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));margin:0 0 22px}' +
      '.pk-card{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;overflow:hidden}' +
      '.pk-card.feat{border:2px solid #ff5a0a}' +
      '.pk-rib{position:absolute;top:12px;right:-34px;transform:rotate(38deg);background:#16a34a;color:#fff;font-weight:900;font-size:11px;letter-spacing:.08em;padding:4px 40px;text-transform:uppercase}' +
      '.pk-rib.lock{background:#6d28d9}.pk-card.locked .pk-img{filter:grayscale(.7) brightness(.8)}' +
      '.pk-adv{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding-right:60px}' +
      '.pk-card h3{margin:4px 0 6px;font-size:19px;line-height:1.2;padding-right:30px}' +
      '.pk-img{width:100%;max-height:170px;object-fit:cover;border-radius:10px;margin:6px 0}' +
      '.pk-btn{display:block;width:100%;text-align:center;margin-top:10px;border:0;border-radius:10px;padding:11px;font-weight:900;font-size:15px;cursor:pointer;background:linear-gradient(90deg,#ff5a0a,#e11d48);color:#fff}' +
      '.pk-btn.lock{background:#4c1d95}.pk-btn.off{background:var(--s2);color:var(--muted);cursor:default}' +
      '.pk-tix{border:2px dashed var(--accent);border-radius:14px;padding:14px;margin:0 0 12px;background:var(--panel)}.pk-tix.used{opacity:.5}' +
      '.pk-code{font-size:30px;font-weight:900;letter-spacing:.08em;text-align:center;margin:8px 0;font-variant-numeric:tabular-nums}' +
      '.pk-note{font-size:12px;color:var(--muted)}';
    document.head.appendChild(s);
  }
  function coinBal() { return state.user ? sb.rpc('perk_balance').then(function (r) { return r.error ? 0 : (r.data || 0); }, function () { return 0; }) : Promise.resolve(0); }
  function perkTicket(code, title, adv, terms, used, id) {
    return '<div class="pk-tix' + (used ? ' used' : '') + '"><div class="hb-meta">🎁 ' + esc(adv || '') + '</div><b>' + esc(title || '') + '</b><div class="pk-code">' + esc(code) + '</div>' +
      '<div class="pk-note">' + (used ? 'Used' : 'Show this screen to the business to redeem.') + '</div>' + (terms ? '<div class="pk-note" style="margin-top:4px">' + esc(terms) + '</div>' : '') +
      (id && !used ? '<button type="button" class="hb-x" data-perkuse="' + esc(id) + '" style="margin-top:6px">Mark as used</button>' : '') + '</div>';
  }
  views.perks = function (sub) {
    pkStyle(); hubStyle(); document.title = '423 Perks • 423.news';
    var uid = state.user && state.user.id;
    if (sub === 'wallet') {
      if (!uid) return Promise.resolve(empty('My Perks', 'Sign up free to claim perks and keep them here.', '<button class="btn" data-auth="signup">Sign up free</button>'));
      return sb.from('news_perk_claims').select('id,code,status,claimed_at,news_perks(advertiser,title,terms,ends_on)').eq('user_id', uid).order('claimed_at', { ascending: false }).limit(100).then(function (r) {
        if (r.error) throw hubErr(r.error);
        var rows = r.data || [];
        return '<a class="muted" href="#/perks">← All perks</a><div class="hb-head" style="--hc:#c026d3;margin-top:10px"><div><h1>My Perks</h1><span class="s">Your claimed freebies</span></div></div>' +
          (rows.length ? rows.map(function (c) { var p = c.news_perks || {}; return perkTicket(c.code, p.title || 'Perk (expired)', p.advertiser, p.terms, c.status === 'used', c.id); }).join('') : empty('Nothing here yet', 'Claim a free perk and it shows up here.', '<a class="btn" href="#/perks">Browse perks</a>'));
      });
    }
    return Promise.all([
      sb.from('news_perks').select('*').order('featured', { ascending: false }).order('ends_on', { ascending: true }).limit(100),
      uid ? sb.from('news_perk_claims').select('perk_id').eq('user_id', uid) : Promise.resolve({ data: [] }),
      coinBal(),
      isStaff() ? sb.from('news_perk_requests').select('*').order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
      uid ? sb.from('news_coins').select('id').eq('user_id', uid).eq('source', 'daily').gte('created_at', ymd(new Date()) + 'T00:00:00') : Promise.resolve({ data: [] })
    ]).then(function (r) {
      if (r[0].error) throw hubErr(r[0].error);
      var perks = r[0].data || [], claimed = {}; (r[1].data || []).forEach(function (c) { claimed[c.perk_id] = 1; });
      var bal = r[2], reqs = r[3].data || [], doneToday = (r[4].data || []).length > 0;
      var hero = uid
        ? '<div class="pk-hero"><h1>🎁 423 Perks</h1><p>Free stuff from 423 businesses, just for being a member.</p><div class="pk-row"><span class="pk-coin">🪙 ' + bal + ' coins</span>' +
          (doneToday ? '<span class="pk-coin" style="opacity:.7">✓ Checked in today</span>' : '<button class="btn" data-checkin style="background:#fff;color:#111">Daily check-in +5</button>') +
          '<a class="btn dark" href="#/perks/wallet">My Perks</a><a class="btn dark" href="#/games">🎮 Game Hub</a></div></div>'
        : '<div class="pk-hero"><h1>🎁 423 Perks</h1><p>Free perks from 423 businesses. Sign up free to unlock them.</p><div class="pk-row"><button class="btn" data-auth="signup" style="background:#fff;color:#111">Sign up free</button><button class="btn dark" data-auth="signin">Sign in</button></div></div>';
      var staff = isStaff() ? '<div class="panel pad" style="margin:0 0 16px"><b>Editor tools</b><div class="pk-row"><button class="btn sm" data-perknew>＋ New perk</button><button class="btn dark sm" data-promoemails>📧 Copy promo emails</button></div>' +
        (reqs.length ? '<div style="margin-top:10px"><b>Partner requests (' + reqs.length + ')</b>' + reqs.map(function (q) { return '<div class="hb-meta" style="margin-top:8px;text-transform:none">' + esc(q.business) + ' · ' + esc(q.contact_name || '') + ' · ' + esc(q.email || '') + ' ' + esc(q.phone || '') + '<br>' + esc(q.message || '') + ' <button type="button" class="hb-x" data-reqdel="' + esc(q.id) + '">dismiss</button></div>'; }).join('') + '</div>' : '') + '</div>' : '';
      var areaSel = '<div class="hb-chips">' + areaSelect('perkarea') + '</div>';
      var cards = perks.map(function (p) {
        var im = safeImg(p.image_url), have = claimed[p.id], coins = p.unlock_type === 'coins', left = p.max_claims ? p.max_claims - p.claims_count : null, gone = left !== null && left <= 0;
        var locked = coins && !have && bal < p.coin_cost;
        var btn;
        if (have) btn = '<a class="pk-btn off" href="#/perks/wallet" style="text-decoration:none">✓ In My Perks</a>';
        else if (gone) btn = '<div class="pk-btn off">All claimed</div>';
        else if (!uid) btn = '<button type="button" class="pk-btn" data-auth="signup">Sign up to unlock</button>';
        else if (locked) btn = '<div class="pk-btn lock">🔒 Needs ' + p.coin_cost + ' coins (you have ' + bal + ')</div><a class="pk-note" href="#/games" style="display:block;text-align:center;margin-top:6px;text-decoration:underline">Earn coins in the Game Hub →</a>';
        else btn = '<button type="button" class="pk-btn' + (coins ? ' lock' : '') + '" data-perkclaim="' + esc(p.id) + '">' + (coins ? '🔓 Unlock for ' + p.coin_cost + ' coins' : '🎁 Claim free') + '</button>';
        var adm = isStaff() ? '<div style="margin-top:8px"><span class="pk-note">' + p.claims_count + ' claimed · ' + esc(p.status) + '</span> <button type="button" class="hb-x" data-perktoggle="' + esc(p.id) + ':' + (p.status === 'published' ? 'paused' : 'published') + '">' + (p.status === 'published' ? 'Pause' : 'Resume') + '</button><button type="button" class="hb-x" data-perkdel="' + esc(p.id) + '">Delete</button></div>' : '';
        return '<div class="pk-card' + (p.featured ? ' feat' : '') + (locked ? ' locked' : '') + (p.status === 'paused' ? '" style="opacity:.55' : '') + '" data-area="' + esc(p.area) + '"><div class="pk-rib' + (coins ? ' lock' : '') + '">' + (coins ? 'Unlock' : 'Free') + '</div>' +
          '<div class="pk-adv">' + (p.featured ? '⭐ ' : '') + esc(p.advertiser) + ' · ' + esc(p.area) + '</div><h3>' + esc(p.title) + '</h3>' + (im ? '<img class="pk-img" src="' + esc(im) + '" alt="" loading="lazy">' : '') +
          (p.details ? '<p style="margin:4px 0">' + esc(p.details) + '</p>' : '') + (p.address ? '<div class="pk-note">📍 <a href="' + esc(mapLink(p.address, p.area)) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">' + esc(p.address) + '</a></div>' : '') +
          (/^https:\/\//i.test(p.url || '') ? '<div class="pk-note"><a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer nofollow" style="text-decoration:underline">Visit ' + esc(p.advertiser) + ' →</a></div>' : '') +
          '<div class="pk-note" style="margin-top:4px">Ends ' + esc(dLabel(p.ends_on)) + (left !== null && left > 0 ? ' · ' + left + ' left' : '') + '</div>' + btn + adm + '</div>';
      }).join('');
      return hero + staff + areaSel + '<div id="hubList" class="pk-grid">' + (cards || '<div>' + empty('No perks right now', 'New perks from local businesses are added all the time. Check back soon.') + '</div>') + '</div>' +
        '<div class="panel pad" style="text-align:center"><b>Own a business in the 423?</b><p class="muted" style="margin:4px 0 10px">Reach local members with a free perk. Get in front of readers who are ready to shop local.</p><button class="btn" data-partner>Become a Perks partner</button></div>';
    });
  };
  views.games = function () {
    pkStyle(); hubStyle(); document.title = 'Game Hub • 423.news';
    return coinBal().then(function (bal) {
      return '<div class="pk-hero" style="background:linear-gradient(135deg,#4f46e5,#0ea5e9)"><h1>🎮 Game Hub</h1><p>Coming soon: play local games, earn coins, unlock free perks.</p>' +
        (state.user ? '<div class="pk-row"><span class="pk-coin">🪙 ' + bal + ' coins</span><a class="btn dark" href="#/perks">Spend on perks</a></div>' : '<div class="pk-row"><button class="btn" data-auth="signup" style="background:#fff;color:#111">Sign up to get ready</button></div>') + '</div>' +
        '<div class="panel pad"><b>How it will work</b><p class="muted">Play games, earn coins. Use coins to unlock premium perks from 423 businesses. You can already earn coins today with the daily check-in on the Perks page.</p><a class="btn" href="#/perks">Go to 423 Perks</a></div>';
    });
  };
  function perkModal() {
    var t = ymd(new Date()), e = ymd(new Date(Date.now() + 30 * 864e5));
    openModal('<h2 style="margin-top:0">New perk</h2><form id="perkForm">' +
      '<label for="pf1">Sponsor / business</label><input id="pf1" name="advertiser" maxlength="80" minlength="2" required>' +
      '<label for="pf2">Headline</label><input id="pf2" name="title" maxlength="120" minlength="3" required placeholder="Free medium drink with any entree">' +
      '<label for="pf3">Details</label><textarea id="pf3" name="details" rows="2" maxlength="600"></textarea>' +
      '<label for="pf4">Terms (optional)</label><input id="pf4" name="terms" maxlength="400" placeholder="One per customer. Show this screen at checkout.">' +
      '<label for="pf5">Code prefix (letters/numbers)</label><input id="pf5" name="prefix" maxlength="8" pattern="[A-Za-z0-9]{2,8}" value="PERK" required>' +
      '<label for="pf6">Area</label><select id="pf6" name="area"><option>All 423</option>' + HUB_AREAS.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>' +
      '<label for="pf7">Address (optional)</label><input id="pf7" name="address" maxlength="160">' +
      '<label for="pf8">Link (optional, https)</label><input id="pf8" name="url" type="url" placeholder="https://">' +
      '<div class="hb-chips" style="margin:0"><div style="flex:1"><label for="pf9">Starts</label><input id="pf9" name="starts" type="date" value="' + t + '" required></div><div style="flex:1"><label for="pf10">Ends</label><input id="pf10" name="ends" type="date" value="' + e + '" required></div></div>' +
      '<label for="pf11">How members get it</label><select id="pf11" name="unlock"><option value="free">Free for any signed-in member</option><option value="coins">Locked until they spend coins</option></select>' +
      '<label for="pf12">Coin cost (only if locked)</label><input id="pf12" name="cost" type="number" min="0" max="100000" value="0">' +
      '<label for="pf13">Limit total claims (optional)</label><input id="pf13" name="max" type="number" min="1" placeholder="No limit">' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" name="featured" style="width:auto"> Feature at the top</label>' +
      '<label for="pf14">Photo or logo (optional)</label><input id="pf14" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif">' +
      '<div id="pferr" style="color:#f87171;min-height:20px"></div><div class="row-actions"><button class="btn" type="submit" id="pfsub">Publish perk</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
  }
  function partnerModal() {
    openModal('<h2 style="margin-top:0">Become a Perks partner</h2><form id="partnerForm">' +
      '<label for="pt1">Business name</label><input id="pt1" name="business" maxlength="80" minlength="2" required>' +
      '<label for="pt2">Your name</label><input id="pt2" name="contact" maxlength="80">' +
      '<label for="pt3">Email</label><input id="pt3" name="email" type="email" maxlength="120" required>' +
      '<label for="pt4">Phone (optional)</label><input id="pt4" name="phone" maxlength="30">' +
      '<label for="pt5">What would you like to offer?</label><textarea id="pt5" name="message" rows="3" maxlength="600" placeholder="Free dessert with any entree, a free oil change, etc."></textarea>' +
      '<div id="pterr" style="color:#f87171;min-height:20px"></div><div class="row-actions"><button class="btn" type="submit" id="ptsub">Send</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
  }

  /* ---- home: alert banner + this weekend + deals ---- */
  var homeBase = views.home;
  views.home = function () {
    hubStyle();
    var today = ymd(new Date()), wk = weekendRange();
    return Promise.all([
      homeBase(),
      sb.from('news_alerts').select('id,kind,severity,title,area,expires_at,created_at').order('created_at', { ascending: false }).limit(20).then(function (r) { return r.data || []; }, function () { return []; }),
      sb.from('news_yardsales').select('id,title,address,area,sale_start,sale_end,hours').eq('status', 'published').gte('sale_end', today).lte('sale_start', wk[1]).order('sale_start', { ascending: true }).limit(4).then(function (r) { return r.data || []; }, function () { return []; }),
      sb.from('news_perks').select('id,advertiser,title,area,ends_on,unlock_type,coin_cost').eq('status', 'published').gte('ends_on', today).lte('starts_on', today).order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(4).then(function (r) { return r.data || []; }, function () { return []; })
    ]).then(function (r) {
      var sev = { urgent: 0, warning: 1, info: 2 };
      var act = r[1].filter(alertActive).sort(function (a, b) { return sev[a.severity] - sev[b.severity]; }).slice(0, 3);
      var banner = act.map(function (a) {
        var k = ALERT_KINDS[a.kind] || ALERT_KINDS.other;
        return '<a class="hb-banner" href="#/alerts" style="--ac:' + (ALERT_COLOR[a.severity] || ALERT_COLOR.info) + '"><b>' + k[0] + ' ' + esc(a.title) + '</b><small>' + esc(a.area) + ' · ' + esc(ago(a.created_at)) + ' · Tap for all alerts</small></a>';
      }).join('');
      var extra = '';
      if (r[2].length) extra += '<div class="sech"><h2>🏷️ Yard sales this weekend</h2><a href="#/yardsales">See all →</a></div><div class="hb-grid" style="margin-bottom:26px">' + r[2].map(function (x) {
        return '<a class="hb-card" href="#/yardsales" style="--ac:#16a34a;display:block"><div class="hb-meta">' + esc(dLabel(x.sale_start)) + (x.hours ? ' · ' + esc(x.hours) : '') + '</div><h3>' + esc(x.title) + '</h3><div class="muted">' + esc(x.address) + ' · ' + esc(x.area) + '</div></a>';
      }).join('') + '</div>';
      if (r[3].length) extra += '<div class="sech"><h2>🎁 423 Perks</h2><a href="#/perks">Free for members →</a></div><div class="hb-grid" style="margin-bottom:26px">' + r[3].map(function (x) {
        return '<a class="hb-card" href="#/perks" style="--ac:#c026d3;display:block"><div class="hb-meta">' + esc(x.advertiser) + ' · ' + esc(x.area) + '</div><h3>' + esc(x.title) + '</h3><div class="muted">' + (x.unlock_type === 'coins' ? '🔒 ' + x.coin_cost + ' coins' : '🎁 Free for members') + '</div></a>';
      }).join('') + '</div>';
      return banner + r[0] + extra;
    });
  };

  /* ---- shared handlers ---- */
  var ITEM_TABLE = { alert: 'news_alerts', yardsale: 'news_yardsales' };
  function pushAlert(title, body, tag) {
    return sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token; if (!tok) return null;
      return fetch(SB_URL + '/functions/v1/push-send', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ title: title, body: body, url: 'index.html#/alerts', tag: tag, topics: ['breaking'] }) }).then(function (x) { return x.json(); });
    }).catch(function () { return null; });
  }
  document.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-hubarea]'); if (sel) {
      var v = sel.value; document.querySelectorAll('#hubList [data-area]').forEach(function (c) { var a = c.getAttribute('data-area'); c.style.display = !v || a === v || a === 'All 423' ? '' : 'none'; });
      return;
    }
    if (e.target.id === 'promoChk' && state.user) {
      var on = e.target.checked;
      sb.from('news_profiles').update({ promo_optin: on }).eq('id', state.user.id).then(function (r) {
        if (r.error) { toast(r.error.message); e.target.checked = !on; return; }
        if (state.profile) state.profile.promo_optin = on; toast(on ? 'You will get free perks by email' : 'Email promotions off');
      });
    }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-alertnew],[data-alertend],[data-alertpush],[data-salenew],[data-hubdel],[data-itemflag],[data-hubrestore],[data-perkclaim],[data-perkuse],[data-checkin],[data-perknew],[data-perktoggle],[data-perkdel],[data-promoemails],[data-partner],[data-reqdel]'); if (!t) return;
    function again() { scrollTop = false; render(); }
    if (t.hasAttribute('data-alertpush')) { if (window.Push423 && Push423.open) Push423.open({}); else toast('Notifications are not available in this browser'); return; }
    if (t.hasAttribute('data-alertnew')) { if (isStaff()) alertModal(); return; }
    if (t.hasAttribute('data-alertend')) { sb.from('news_alerts').update({ expires_at: new Date().toISOString() }).eq('id', t.getAttribute('data-alertend')).then(function (r) { if (r.error) toast(r.error.message); else again(); }); return; }
    if (t.hasAttribute('data-hubdel')) {
      var p = t.getAttribute('data-hubdel').split(':'); if (!confirm('Delete this? This cannot be undone.')) return;
      sb.from(ITEM_TABLE[p[0]]).delete().eq('id', p[1]).then(function (r) { if (r.error) toast(r.error.message); else again(); }); return;
    }
    if (t.hasAttribute('data-hubrestore')) {
      var q = t.getAttribute('data-hubrestore').split(':');
      sb.from(ITEM_TABLE[q[0]]).update({ status: 'published' }).eq('id', q[1]).then(function (r) {
        if (r.error) { toast(r.error.message); return; }
        sb.from('news_item_flags').delete().eq('item_kind', q[0]).eq('item_id', q[1]).then(again);
      }); return;
    }
    if (t.hasAttribute('data-perktoggle')) { var pt = t.getAttribute('data-perktoggle').split(':'); sb.from('news_perks').update({ status: pt[1] }).eq('id', pt[0]).then(function (r) { if (r.error) toast(r.error.message); else again(); }); return; }
    if (t.hasAttribute('data-perkdel')) { if (!confirm('Delete this perk and all claims?')) return; sb.from('news_perks').delete().eq('id', t.getAttribute('data-perkdel')).then(function (r) { if (r.error) toast(r.error.message); else again(); }); return; }
    if (t.hasAttribute('data-reqdel')) { sb.from('news_perk_requests').delete().eq('id', t.getAttribute('data-reqdel')).then(again); return; }
    if (t.hasAttribute('data-perknew')) { if (isStaff()) perkModal(); return; }
    if (t.hasAttribute('data-promoemails')) {
      sb.rpc('perk_promo_emails').then(function (r) {
        if (r.error) { toast(r.error.message); return; }
        var rows = r.data || [], txt = rows.map(function (x) { return x.email; }).join(', ');
        openModal('<h2 style="margin-top:0">Promo emails (' + rows.length + ')</h2><p class="muted">Members who opted in to free perks by email. Include an unsubscribe link in every email you send.</p><textarea id="promoTxt" rows="6" readonly style="width:100%">' + esc(txt) + '</textarea><div class="row-actions"><button class="btn" type="button" id="promoCopy">Copy</button><button class="btn dark" type="button" data-close>Close</button></div>');
        var cb = document.getElementById('promoCopy'); if (cb) cb.onclick = function () { var ta = document.getElementById('promoTxt'); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (x) { toast('Select and copy the text'); } };
      }); return;
    }
    if (t.hasAttribute('data-partner')) { if (!state.user) { toast('Sign in first'); openAuth('signup'); return; } partnerModal(); return; }
    if (t.hasAttribute('data-perkuse')) { if (!confirm('Mark this perk as used?')) return; sb.rpc('perk_use', { p_claim: t.getAttribute('data-perkuse') }).then(function (r) { if (r.error) toast(r.error.message); else again(); }); return; }
    if (t.hasAttribute('data-checkin')) { if (!state.user) { openAuth('signup'); return; } t.disabled = true; sb.rpc('perk_daily_checkin').then(function (r) { if (r.error) { t.disabled = false; toast(r.error.message.replace(/^.*: /, '')); return; } toast('+5 coins! You have ' + r.data); again(); }); return; }
    if (t.hasAttribute('data-perkclaim')) {
      if (!state.user) { openAuth('signup'); return; }
      t.disabled = true; var pid = t.getAttribute('data-perkclaim');
      sb.rpc('perk_claim', { p_perk: pid }).then(function (r) {
        if (r.error) { t.disabled = false; toast((r.error.message || '').replace(/^.*: /, '')); return; }
        var card = t.closest('.pk-card'), ttl = card && card.querySelector('h3'), adv = card && card.querySelector('.pk-adv');
        openModal('<h2 style="margin-top:0">🎉 It’s yours!</h2>' + perkTicket(r.data.code, ttl ? ttl.textContent : 'Perk', adv ? adv.textContent.replace(/^⭐ /, '').split(' · ')[0] : '', '', false, null) + '<div class="row-actions"><a class="btn" href="#/perks/wallet" data-close>Open My Perks</a><button class="btn dark" type="button" data-close>Close</button></div>');
        again();
      }); return;
    }
    if (!state.user) { toast('Sign in first'); openAuth('signin'); return; }
    if (t.hasAttribute('data-salenew')) { saleModal(); return; }
    if (t.hasAttribute('data-itemflag')) {
      var f = t.getAttribute('data-itemflag').split(':');
      openModal('<h2 style="margin-top:0">Flag this listing</h2><form id="itemFlagForm"><input type="hidden" name="kind" value="' + esc(f[0]) + '"><input type="hidden" name="id" value="' + esc(f[1]) + '">' +
        '<label for="if1">What is wrong?</label><select id="if1" name="reason"><option value="scam">Looks like a scam</option><option value="inappropriate">Inappropriate</option><option value="spam">Spam or ad</option><option value="false">False or expired</option><option value="other">Something else</option></select>' +
        '<label for="if2">Details (optional)</label><textarea id="if2" name="note" rows="3" maxlength="300"></textarea><div id="iferr" style="color:#f87171;min-height:20px"></div>' +
        '<div class="row-actions"><button class="btn" type="submit" id="ifsub">Send flag</button><button class="btn dark" type="button" data-close>Cancel</button></div></form>');
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.id) return;
    var d, b, er;
    function done(label, r, okMsg) { if (r.error) { b.disabled = false; b.textContent = label; er.textContent = hubErr(r.error).message; return false; } closeModal(); toast(okMsg); scrollTop = false; render(); return true; }
    if (f.id === 'alertForm') {
      d = new FormData(f); b = $('#alsub'); er = $('#alerr'); er.textContent = ''; b.disabled = true; b.textContent = 'Posting…';
      var h = d.get('hours'), u = (d.get('url') || '').toString().trim(), ttl = d.get('title').toString().trim(), bd = (d.get('body') || '').toString().trim(), kk = ALERT_KINDS[d.get('kind')] || ALERT_KINDS.other;
      sb.from('news_alerts').insert({ kind: d.get('kind'), severity: d.get('severity'), area: d.get('area'), title: ttl, body: bd || null, url: u || null, expires_at: h ? new Date(Date.now() + Number(h) * 3600e3).toISOString() : null }).then(function (r) {
        if (r.error) { done('Post alert', r, ''); return; }
        if (d.get('push')) {
          pushAlert(kk[0] + ' ' + (d.get('area') === 'All 423' ? 'Alert' : d.get('area') + ' alert'), ttl + (bd ? '. ' + bd : ''), 'alert-' + Date.now()).then(function (j) { done('Post alert', r, j && j.sent != null ? 'Alert posted and sent to ' + j.sent + ' phone' + (j.sent === 1 ? '' : 's') : 'Alert posted'); });
        } else done('Post alert', r, 'Alert posted');
      });
    } else if (f.id === 'saleForm') {
      d = new FormData(f); b = $('#yssub'); er = $('#yserr'); er.textContent = ''; b.disabled = true; b.textContent = 'Posting…';
      var file = d.get('photo');
      uploadImage(file && file.size ? file : null).then(function (img) {
        return sb.from('news_yardsales').insert({ title: d.get('title').toString().trim(), address: d.get('address').toString().trim(), area: d.get('area'), sale_start: d.get('start'), sale_end: d.get('end'), hours: (d.get('hours') || '').toString().trim() || null, description: (d.get('description') || '').toString().trim() || null, image_url: img });
      }).then(function (r) { done('Post sale', r, 'Sale posted'); }, function (x) { b.disabled = false; b.textContent = 'Post sale'; er.textContent = x.message; });
    } else if (f.id === 'perkForm') {
      d = new FormData(f); b = $('#pfsub'); er = $('#pferr'); er.textContent = ''; b.disabled = true; b.textContent = 'Publishing…';
      var pf = d.get('photo'), pu = (d.get('url') || '').toString().trim(), mx = d.get('max');
      uploadImage(pf && pf.size ? pf : null).then(function (img) {
        var coins = d.get('unlock') === 'coins';
        return sb.from('news_perks').insert({ advertiser: d.get('advertiser').toString().trim(), title: d.get('title').toString().trim(), details: (d.get('details') || '').toString().trim() || null, terms: (d.get('terms') || '').toString().trim() || null,
          code_prefix: d.get('prefix').toString().trim().toUpperCase(), area: d.get('area'), address: (d.get('address') || '').toString().trim() || null, url: pu || null, image_url: img, starts_on: d.get('starts'), ends_on: d.get('ends'),
          unlock_type: coins ? 'coins' : 'free', coin_cost: coins ? Number(d.get('cost') || 0) : 0, max_claims: mx ? Number(mx) : null, featured: !!d.get('featured') });
      }).then(function (r) { done('Publish perk', r, 'Perk published'); }, function (x) { b.disabled = false; b.textContent = 'Publish perk'; er.textContent = x.message; });
    } else if (f.id === 'partnerForm') {
      d = new FormData(f); b = $('#ptsub'); er = $('#pterr'); er.textContent = ''; b.disabled = true; b.textContent = 'Sending…';
      sb.from('news_perk_requests').insert({ business: d.get('business').toString().trim(), contact_name: (d.get('contact') || '').toString().trim() || null, email: d.get('email').toString().trim(), phone: (d.get('phone') || '').toString().trim() || null, message: (d.get('message') || '').toString().trim() || null, user_id: state.user.id })
        .then(function (r) { done('Send', r, 'Thanks! We will be in touch.'); });
    } else if (f.id === 'itemFlagForm') {
      d = new FormData(f); b = $('#ifsub'); er = $('#iferr'); er.textContent = ''; b.disabled = true;
      sb.from('news_item_flags').insert({ item_kind: d.get('kind'), item_id: d.get('id'), user_id: state.user.id, reason: d.get('reason'), note: (d.get('note') || '').toString().trim() || null }).then(function (r) {
        if (r.error) { b.disabled = false; er.textContent = /duplicate|23505/i.test(r.error.message + (r.error.code || '')) ? 'You already flagged this.' : r.error.message; return; }
        closeModal(); toast('Thanks. An editor will take a look.');
      });
    }
  });

  /* hidden listings in the editor review queue */
  var reviewBase = views.review;
  views.review = function () {
    if (!isStaff()) return reviewBase();
    return Promise.all([reviewBase(), sb.from('news_yardsales').select('*').eq('status', 'hidden').limit(50)]).then(function (r) {
      var rows = [];
      ((r[1] && r[1].data) || []).forEach(function (x) { rows.push(['yardsale', x.id, 'Yard sale', x.title, x.address + ' · ' + x.area, x.author_name]); });
      if (!rows.length) return r[0];
      return r[0] + '<h2 style="margin-top:28px">🚩 Hidden listings (' + rows.length + ')</h2><p class="muted">Hidden after 3 flags. Restore or delete.</p>' + rows.map(function (x) {
        return '<div class="panel q-item"><span class="badge">' + esc(x[2]) + '</span> <span class="muted">by ' + esc(x[5]) + '</span><h3>' + esc(x[3]) + '</h3><p class="muted">' + esc(x[4]) + '</p>' +
          '<div class="row-actions"><button class="btn ok sm" data-hubrestore="' + x[0] + ':' + esc(x[1]) + '">Restore (clear flags)</button><button class="btn danger sm" data-hubdel="' + x[0] + ':' + esc(x[1]) + '">Delete</button></div></div>';
      }).join('');
    });
  };

  /* ---------- boot ---------- */
  window.addEventListener('hashchange', render);
  sb.auth.onAuthStateChange(function (event, session) {
    /* defer: calling Supabase inside this callback can deadlock the auth lock */
    setTimeout(function () {
      var before = state.user && state.user.id;
      applySession(session).then(function () {
        var after = state.user && state.user.id;
        if (before !== after && state.route) render();
      });
    }, 0);
  });
  sb.auth.getSession().then(function (r) { return applySession(r.data && r.data.session); }).then(function () { render(); weather(); });
})();
