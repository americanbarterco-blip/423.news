#!/usr/bin/env node
/* Build a static story sitemap for GitHub Pages from public published posts. */
const ORIGIN = "https://423.news";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PAGE_SIZE = 1000;
const MAX_STORIES = 24000;
const MARKER_START = "  <!-- DYNAMIC-STORIES:START -->";
const MARKER_END = "  <!-- DYNAMIC-STORIES:END -->";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required.");
}

async function fetchRows(table, filters, offset) {
  const url = new URL("/rest/v1/" + table, SUPABASE_URL);
  url.searchParams.set("select", filters.select);
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "select") url.searchParams.set(key, value);
  }
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY
    }
  });
  if (!response.ok) {
    throw new Error(table + " query failed: HTTP " + response.status);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(table + " returned a non-array response.");
  return rows;
}

async function fetchAll(table, filters) {
  const result = [];
  for (let offset = 0; offset < MAX_STORIES; offset += PAGE_SIZE) {
    const rows = await fetchRows(table, filters, offset);
    result.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return result.slice(0, MAX_STORIES);
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function storyUrl(path, slug) {
  const url = new URL(path, ORIGIN);
  url.searchParams.set("slug", slug);
  return url.toString();
}

function entry(loc, alternates) {
  const links = alternates.map(item =>
    '    <xhtml:link rel="alternate" hreflang="' + item.lang +
    '" href="' + escapeXml(item.url) + '"/>'
  ).join("\n");
  return [
    "  <url>",
    "    <loc>" + escapeXml(loc) + "</loc>",
    links,
    "  </url>"
  ].join("\n");
}

async function main() {
  const posts = await fetchAll("news_posts", {
    select: "id,slug,section",
    status: "eq.published",
    section: "in.(news,sports,outdoors,government)",
    order: "created_at.desc"
  });

  let translations = [];
  try {
    translations = await fetchAll("news_translations", {
      select: "source_id",
      source_table: "eq.news_posts",
      locale: "eq.es",
      status: "eq.approved"
    });
  } catch (error) {
    // If the translations table is not deployed, keep English story URLs.
    console.warn("Spanish translation list unavailable; publishing English URLs only:", error.message);
  }

  const spanishIds = new Set(translations.map(row => String(row.source_id)));
  const entries = [];
  const seen = new Set();

  for (const post of posts) {
    if (!post || !post.id || !post.slug ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(post.slug) ||
        !["news", "sports", "outdoors", "government"].includes(post.section)) continue;

    const en = storyUrl("/story.html", post.slug);
    const es = storyUrl("/es/historia.html", post.slug);
    if (!seen.has(en)) {
      const alternates = [{ lang: "en", url: en }];
      if (spanishIds.has(String(post.id))) alternates.push({ lang: "es", url: es });
      alternates.push({ lang: "x-default", url: en });
      entries.push(entry(en, alternates));
      seen.add(en);
    }
    if (spanishIds.has(String(post.id)) && !seen.has(es)) {
      entries.push(entry(es, [
        { lang: "en", url: en },
        { lang: "es", url: es },
        { lang: "x-default", url: en }
      ]));
      seen.add(es);
    }
  }

  const fs = await import("node:fs/promises");
  const file = "sitemap.xml";
  let xml = await fs.readFile(file, "utf8");
  const start = xml.indexOf(MARKER_START);
  const end = xml.indexOf(MARKER_END);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error("Sitemap dynamic-story markers are malformed.");
  }
  if (start !== -1) {
    xml = xml.slice(0, start) + xml.slice(end + MARKER_END.length);
  } else {
    const close = xml.lastIndexOf("</urlset>");
    if (close === -1) throw new Error("sitemap.xml has no closing urlset tag.");
    xml = xml.slice(0, close) + xml.slice(close);
  }
  const close = xml.lastIndexOf("</urlset>");
  const block = MARKER_START + "\n" +
    (entries.length ? entries.join("\n") + "\n" : "") +
    MARKER_END + "\n";
  xml = xml.slice(0, close) + block + xml.slice(close);
  await fs.writeFile(file, xml);
  console.log("Generated sitemap with " + posts.length + " published posts and " + seen.size + " story URLs.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
