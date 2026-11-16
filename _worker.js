/* 423.news — dynamic story sitemap.
 * Serves the existing static section sitemap plus every published editorial story.
 * Spanish URLs are included only when a reviewed translation is approved.
 */
const SITE_ORIGIN = "https://423.news";
const SUPABASE_URL = "https://kdiwehqtezlhecxsoysj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXAiLCJyZWYiOiJrZGl3ZWhxdGV6bGhlY3hzb3lzcWoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc5MDY0NDM5MSwiZXhwIjoyMTA2MjIwMzkxfQ.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE";
const PAGE_SIZE = 1000;
const MAX_STORIES = 24000;
const INDEXABLE_SECTIONS = new Set(["news", "sports", "outdoors", "government"]);

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
  const response = await fetch(url.toString(), {
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
      select: "id,slug,section,created_at",
      status: "eq.published",
      section: "in.(news,sports,outdoors,government)",
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
        status: "eq.approved"
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

    const english = storyUrl("/story.html", post.slug);
    const spanish = storyUrl("/es/historia.html", post.slug);
    const hasSpanish = spanishIds.has(String(post.id));
    const lastmod = post.created_at && !Number.isNaN(Date.parse(post.created_at))
      ? new Date(post.created_at).toISOString() : "";
    const englishAlternates = [{ lang: "en", url: english }];
    if (hasSpanish) englishAlternates.push({ lang: "es", url: spanish });
    englishAlternates.push({ lang: "x-default", url: english });
    entries.push(sitemapEntry(english, lastmod, englishAlternates));

    if (hasSpanish) {
      entries.push(sitemapEntry(spanish, lastmod, [
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
          "X-Sitemap-Story-Feed": "temporarily-unavailable"
        }
      });
    }
  }
};
