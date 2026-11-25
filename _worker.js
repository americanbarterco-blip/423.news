import { handleArcadeStripe } from "./arcade-stripe.js";
/* 423.news — dynamic story sitemap.
 * Serves the existing static section sitemap plus every published editorial story.
 * Spanish URLs are included only when a reviewed translation is approved.
 * Static section entries should be canonical clean URLs; redirecting .html entries waste crawl budget.
 */
const SITE_ORIGIN = "https://423.news";
const SUPABASE_URL = "https://kdiwehqtezlhecxsoysj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkaXdlaHF0ZXpsaGVjeHNveXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDQzOTEsImV4cCI6MjEwNjIyMDM5MX0.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE";
const PAGE_SIZE = 1000;
const MAX_STORIES = 24000;
const INDEXABLE_SECTIONS = new Set(["news", "community", "sports", "schools", "outdoors", "government"]);

function xmlEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function storyUrl(path, slug) {
  const url = new URL(path, SITE_ORIGIN);
  url.searchParams.set("slug", slug);
  return url.toString();
}

function sitemapEntry(loc, lastmod, alternates) {
  const links = alternates.map((item) =>
    '    <xhtml:link rel="alternate" hreflang="' + item.lang +
    '" href="' + xmlEscape(item.url) + '"/>'
  ).join("\n");
  return [
    "  <url>",
    "    <loc>" + xmlEscape(loc) + "</loc>",
    lastmod ? "    <lastmod>" + xmlEscape(lastmod) + "</lastmod>" : "",
    links,
    "  </url>"
  ].filter(Boolean).join("\n");
}

async function fetchRows(table, query, offset, env) {
  const url = new URL("/rest/v1/" + table, SUPABASE_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  // Bound upstream wait time so the Worker can fall back to the static sitemap.
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(4000),
    headers: {
      apikey: env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
      Authorization: "Bearer " + (env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY)
    }
  });
  if (!response.ok) throw new Error("Supabase " + table + " returned " + response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Supabase " + table + " returned an invalid response");
  return rows;
}

async function getPublishedStories(env) {
  const stories = [];
  for (let offset = 0; offset < MAX_STORIES; offset += PAGE_SIZE) {
    const rows = await fetchRows("news_posts", {
      select: "id,slug,section,created_at,updated_at",
      status: "eq.published",
      section: "in.(news,sports,schools,outdoors,government)",
      order: "created_at.desc"
    }, offset, env);
    stories.push(...rows);
    if (rows.length < PAGE_SIZE || stories.length >= MAX_STORIES) break;
  }
  return stories.slice(0, MAX_STORIES);
}

async function getApprovedSpanishSourceIds(env) {
  const ids = new Set();
  try {
    for (let offset = 0; offset < MAX_STORIES; offset += PAGE_SIZE) {
      const rows = await fetchRows("news_translations", {
        select: "source_id",
        source_table: "eq.news_posts",
        locale: "eq.es",
        status: "in.(approved,auto_published)"
      }, offset, env);
      for (const row of rows) if (row && row.source_id) ids.add(String(row.source_id));
      if (rows.length < PAGE_SIZE || ids.size >= MAX_STORIES) break;
    }
  } catch (_) {
    // The translations migration may not yet be installed. English stories remain indexable.
  }
  return ids;
}

async function buildSitemap(staticXml, env) {
  const stories = await getPublishedStories(env);
  const spanishIds = await getApprovedSpanishSourceIds(env);
  const entries = [];

  for (const post of stories) {
    if (!post || !post.id || !post.slug ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(post.slug) ||
        !INDEXABLE_SECTIONS.has(post.section)) continue;

    const english = storyUrl("/story", post.slug);
    const spanish = storyUrl("/es/historia", post.slug);
    const hasSpanish = spanishIds.has(String(post.id));
    const englishAlternates = [{ lang: "en", url: english }];
    if (hasSpanish) englishAlternates.push({ lang: "es", url: spanish });
    englishAlternates.push({ lang: "x-default", url: english });
    entries.push(sitemapEntry(english, post.updated_at || post.created_at || "", englishAlternates));

    if (hasSpanish) {
      entries.push(sitemapEntry(spanish, post.updated_at || post.created_at || "", [
        { lang: "en", url: english },
        { lang: "es", url: spanish },
        { lang: "x-default", url: english }
      ]));
    }
  }

  const closingTag = /<\/urlset>\s*$/i;
  if (!closingTag.test(staticXml)) throw new Error("Static sitemap is not a valid urlset");
  return staticXml.replace(closingTag, entries.length ? entries.join("\n") + "\n</urlset>" : "</urlset>");
}


function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value) {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signJwt(payload, secret) {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const unsigned = header + "." + body;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return unsigned + "." + base64url(new Uint8Array(signature));
}

async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(left || ""))));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(right || ""))));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function livekitToken(request, env) {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const role = url.searchParams.get("role") || "listener";
  const room = url.searchParams.get("room") || "claudia-desk";
  if (!["listener", "publisher", "probe"].includes(role)) {
    return jsonResponse({ error: "invalid_role" }, 400);
  }
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(room)) {
    return jsonResponse({ error: "invalid_room" }, 400);
  }

  const livekitUrl = env.LIVEKIT_URL || "";
  const apiKey = env.LIVEKIT_API_KEY || "";
  const apiSecret = env.LIVEKIT_API_SECRET || "";
  if (!livekitUrl || !apiKey || !apiSecret) {
    return jsonResponse({ error: "livekit_not_configured" }, 501);
  }

  if (role === "publisher") {
    const supplied = request.headers.get("x-editor-key") || "";
    if (!env.EDITOR_KEY || !(await constantTimeEqual(supplied, env.EDITOR_KEY))) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (role === "probe") {
    try {
      const host = livekitUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:").replace(/\/$/, "");
      const adminJwt = await signJwt({
        iss: apiKey, sub: "423-news-status", nbf: now - 5, exp: now + 60,
        video: { roomAdmin: true, room: room }
      }, apiSecret);
      const response = await fetch(host + "/twirp/livekit.RoomService/ListParticipants", {
        method: "POST",
        headers: { Authorization: "Bearer " + adminJwt, "Content-Type": "application/json" },
        body: JSON.stringify({ room })
      });
      if (!response.ok) return jsonResponse({ live: false });
      const data = await response.json();
      const live = Array.isArray(data.participants) && data.participants.some(p => p && p.identity !== "423-news-status");
      return jsonResponse({ live });
    } catch (_) {
      return jsonResponse({ live: false });
    }
  }

  const isPublisher = role === "publisher";
  const token = await signJwt({
    iss: apiKey,
    sub: (isPublisher ? "claudia-desk-" : "423-news-listener-") + crypto.randomUUID(),
    nbf: now - 5,
    exp: now + 1800,
    video: {
      roomJoin: true,
      room,
      canPublish: isPublisher,
      canSubscribe: true,
      canPublishData: isPublisher
    }
  }, apiSecret);

  return jsonResponse({ token, url: livekitUrl, room, role });
}

export default {
  async scheduled(event, env, ctx) {
    const secret = env.SPANISH_AUTO_TRANSLATE_SECRET || "";
    if (!secret) {
      console.warn("Spanish translation scheduled run skipped: missing worker secret.");
      return;
    }
    ctx.waitUntil((async () => {
      try {
        const response = await fetch(SUPABASE_URL + "/functions/v1/spanish-auto-translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + (env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY),
            "x-translation-cron-secret": secret
          },
          body: "{}"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) console.error("Spanish translation worker failed", response.status, data);
        else console.log("Spanish translation worker completed", data);
      } catch (error) {
        console.error("Spanish translation scheduled run error", String(error));
      }
    })());
  },
  async fetch(request, env) {
    const url = new URL(request.url);

    /* Claudia is served on its own origin so the 423.news root PWA service
       worker and install scope cannot capture Claudia install flow. The
       custom domain claudia.423.news must point to this Worker in Cloudflare. */
    if (url.hostname === "claudia.423.news") {
      const claudiaRootFiles = {
        "/": "/claudia/index.html",
        "/index.html": "/claudia/index.html",
        "/manifest.webmanifest": "/claudia/manifest.webmanifest",
        "/sw.js": "/claudia/sw.js",
        "/claudia-icon.svg": "/claudia/claudia-icon.svg",
        "/claudia-icon-192.png": "/claudia/claudia-icon-192.png",
        "/claudia-icon-512.png": "/claudia/claudia-icon-512.png"
      };
      const assetPath = claudiaRootFiles[url.pathname] || url.pathname;
      const assetUrl = new URL(assetPath + url.search, url.origin);
      const assetRequest = new Request(assetUrl.toString(), request);
      const response = await env.ASSETS.fetch(assetRequest);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Robots-Tag", "noindex, nofollow");
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
      if (url.pathname === "/sw.js") {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-cache");
        headers.set("Service-Worker-Allowed", "/");
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
      return response;
    }

    if (url.pathname.startsWith("/api/arcade/")) {
      return handleArcadeStripe(request, env, url.pathname);
    }
    if (url.pathname === "/api/livekit-token") {
      return livekitToken(request, env);
    }
    if (url.pathname !== "/sitemap.xml" || request.method !== "GET") {
      return env.ASSETS.fetch(request);
    }

    const cacheKey = new Request(SITE_ORIGIN + "/sitemap.xml", { method: "GET" });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const staticResponse = await env.ASSETS.fetch(new Request(SITE_ORIGIN + "/sitemap.xml"));
    if (!staticResponse.ok) return staticResponse;

    const staticXml = await staticResponse.text();
    try {
      const xml = await buildSitemap(staticXml, env);
      const response = new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=900",
          "X-Content-Type-Options": "nosniff"
        }
      });
      await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      // Preserve the known-good static sitemap if the database is temporarily unavailable.
      return new Response(staticXml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=120",
          "X-Sitemap-Story-Feed": "temporarily-unavailable",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
  }
};
