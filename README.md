# Claudia Green — 423.news live desk

Claudia Green is an independent correspondent contracted by **423.news**. This bundle is her
live desk: a two-page site (the live homepage and her studio page), a feed file that drives both,
and a scanner bridge that keeps the rack honest.

Everything is plain HTML/CSS/JS with no build step and no dependencies.

---

## What's in the box

```
files/
├── index.html                 the 423.news live homepage
├── desk.html                  Claudia's desk — studio view, open mic, queue
├── conditions.html            live weather · alerts · traffic · crime radar, any area
├── POLICY.md                  scanner policy: what may be published from dispatch audio
├── DEPLOY.md                  deploy on GitHub + Supabase + LiveKit + Cloudflare
├── supabase/schema.sql        tables, RLS, Realtime publication
├── functions/api/livekit-token.js   Cloudflare Pages Function (mints live audio tokens)
├── .github/workflows/desk.yml GitHub Action = the cron "desk loop"
├── docker-compose.yml         site (nginx) + desk worker in one command
├── netlify.toml / vercel.json host config — no-store on data/feed.json
├── serve.py                   local dev server with correct cache headers
├── deploy/                    nginx site config, systemd unit
├── assets/
│   ├── theme.css              shared design system (all pages)
│   ├── config.js              area, units, traffic key, radar source, mic language
│   ├── feed.js                feed engine: loads data/feed.json, renders, polls every 20s
│   ├── conditions.js          weather / alerts / traffic providers + cards
│   ├── radar.js               crime radar scope, plotting and lists
│   └── search.js              the command bar (typed or spoken)
├── data/
│   └── feed.json              ← the single source of truth. Edit this, both pages update
└── scanner/
    ├── claudia.py             Broadcastify bridge: status · capture · watch · ingest · file
    ├── listen.py              open a feed and listen: open · record · session · resolve
    ├── paraphrase.py          the legal gate: redact · check · build (no verbatim, no quotes, no IDs)
    ├── draft-template.md      the draft structure she fills in after listening
    ├── config.example.json    copy to config.json, add your feed IDs
    └── config.json            (created from the example)
```

---

## Run it

> **Production stack:** Cloudflare Pages (site) + Supabase (data + Realtime) + LiveKit (on-air audio)
> + GitHub Actions (the every-15-minutes desk loop). See [DEPLOY.md](DEPLOY.md).

```bash
cd files
python3 serve.py            # 127.0.0.1:8000, no cache on feed.json
# home  → http://localhost:8000/
# desk  → http://localhost:8000/desk.html
```

Hosting: it's a static site. Drop the folder on Netlify, Vercel, Cloudflare Pages, GitHub Pages,
S3 + CloudFront, or any nginx box. The only requirement is that `data/feed.json` is served from
the same directory as the pages. `file://` also works — the pages fall back to an embedded seed
feed when `fetch()` is blocked.

---

## How the pages work

**`index.html` — the live homepage.** Live badge, scrolling wire ticker, the current live report as
the hero, then the filed stream filterable by *Breaking / Scanner / Verified*. Right rail holds the
scanner rack, the graded scanner log, and the door into her desk.

**`desk.html` — her desk.** The studio scene (monitors, boom mic, scanner radio with a live
waveform, ON AIR lamp), an *open microphone* console that types out what she is currently saying,
meter tiles for feed status / open items / scanner feeds / listeners, and the story queue with each
item marked *filed*, *working* or *watching*.

**`Go live`** on the desk cuts her in: status flips to *Live now*, the ON AIR lamp brightens, and the
homepage pill changes on its next poll. **`Stand down`** reverses it. State is kept in
`localStorage` per browser; the feed file remains the authority for report content.

---

## Command bar — she searches on command, typed or spoken

Present in the header of every page. Press `/` anywhere to focus it, or click the mic and talk.

| What you type / say | What happens |
|---|---|
| `weather durham` · `wx durham` | live weather, hourly precipitation and active alerts for that area, in the panel |
| `traffic cary` · `roads cary` | traffic incidents plus weather-related road advisories |
| `radar raleigh` · `crime raleigh` | live crime radar scope for that area |
| `area chapel hill` · `conditions …` | weather + traffic in one answer |
| `live` · `go live` | puts Claudia on air |
| `stand down` · `off air` | takes her off air |
| anything else | searches her filed reports, the scanner log and the feed rack — click a hit to drill in |

Nothing matching is a real state, and the panel says so, offering the live-lookup action instead of
inventing a result. Voice input uses the browser's own `SpeechRecognition`; if the browser has none,
the mic explains that instead of silently doing nothing.

**Microphone + live lookups need the site served over http(s) or localhost** — browsers block mic
access and cross-origin fetches on `file://`. Everything else still renders from the embedded seed.

---

## Live conditions — any area, the surrounding areas, or yours

`conditions.html` is the lookup page. It carries:

- **Weather** — temperature, feels-like, wind and gusts, precipitation, humidity, hi/lo and the next
  12 hours of precipitation probability. Source: **Open-Meteo** (no key, no signup).
- **Alerts** — active National Weather Service alerts for the point. US only; elsewhere the card says
  so plainly rather than showing an empty box.
- **Traffic** — TomTom incident feed inside a search box around the centre point (accidents, closures,
  road works, flooding, jams), severe items first. **Needs a key.** Without one the card says the feed
  is not configured and lists only NWS advisories that have road consequences.
- **Use my location** — browser geolocation, reverse-geocoded, then shown as the active area.
- **Surrounding areas** — one-click chips (`surrounding` in `assets/config.js`), so the desk can rotate
  Raleigh → Durham → Chapel Hill without retyping.

The active area is kept in the URL (`conditions.html?area=Cary%2C+NC`) and in `localStorage`, so a
bookmark reopens the same place. Lookups are cached for `refreshSeconds` (default 5 minutes).

The homepage and desk page each carry a compact version of the same card, mounted on
`defaultArea` from `assets/config.js`.

---

## Live crime radar

A sweep scope with range rings, bearing crosshairs and pulsing blips, plus a distance-sorted list.
Two sources, and the honest handling of each:

| Source | Plotted? | Label |
|---|---|---|
| City open data (Socrata) with real lat/lon | **yes**, inside the radius | `city open data · N rows geo-filtered` |
| Filed reports that carry `lat`/`lon` | **yes** | `desk report` |
| Scanner log grade A/B, reports without coordinates | **never plotted** — listed under the scope as *signals without coordinates* | `unconfirmed` |

That split is deliberate: a radar that drops an unlocated dispatch call at a random bearing is a
fabrication. Blips are coloured violent / property / other from the incident type, sized by distance,
and titled with distance + label on hover.

To plot real incidents, point the radar at a city open-data dataset (Socrata JSON endpoint):

```js
// assets/config.js
radar: {
  radiusKm: 8,
  lookbackDays: 7,
  refreshSeconds: 90,
  openData: {
    datasetUrl: 'https://data.cityofchicago.org/resource/ijzp5-x9u9.json',
    dateField: 'date',
    latField: 'latitude',
    lonField: 'longitude',
    typeField: 'primary_type'
  }
}
```

Any Socrata dataset with a date, a latitude and a longitude column works — swap the four field names.
Rows are fetched newest-first, filtered to `lookbackDays` and to `radiusKm`, then sorted by distance.

---

## Configuration (`assets/config.js`)

| Key | Meaning |
|---|---|
| `defaultArea` | the area the desk opens on — any place name or `lat,lon` |
| `units` | `imperial` (°F, mph, in) or `metric` |
| `traffic.apiKey` | TomTom Traffic key — the only credential this site needs, and only for traffic |
| `traffic.radiusKm` | half-size of the traffic search box |
| `radar.radiusKm` / `lookbackDays` | scope range and window |
| `radar.openData.*` | city open-data endpoint + field names |
| `surrounding` | the quick-pick areas |
| `refreshSeconds` | cache lifetime for area lookups |
| `micLanguage` | speech recognition language, e.g. `en-US` |

All credentials live here as placeholders and are read at runtime by the browser — put a key in,
never a secret you would not ship to a public static host. For a real deployment, proxy the TomTom
call through your own server if the key must stay private.

---

## The feed contract (`data/feed.json`)

```jsonc
{
  "generated_at": "2025-01-01T00:00:00Z",
  "claudia": { "status": "at-desk", "on_air": false, "line": "what she is saying right now" },
  "reports": [
    {
      "id": "cg-0001",
      "ts": "2025-01-01T00:00:00Z",
      "kind": "BREAKING",            // BREAKING | HEARD | SCANNER | FIELD | VERIFIED | DESK
      "dateline": "MULTI-COUNTY",
      "confidence": "unconfirmed",   // unconfirmed | developing | confirmed
      "headline": "…",
      "summary": "…",
      "tags": ["scanner", "fire"],
      "scanner": ["County Fire — Ops 1"],
      "sources": [{ "label": "…", "url": "…" }]
    }
  ],
  "scanner": {
    "provider": "Broadcastify",
    "connected": false,
    "note": "…",
    "feeds": [{ "name": "…", "status": "hot", "listeners": 214, "live_data": false }],
    "log": [{ "ts": "…", "feed": "FIRE1", "text": "…", "grade": "A" }]
  }
}
```

The newest report (smallest time delta) becomes the homepage hero. Nothing in the UI states a claim
the file doesn't carry — `confidence` is rendered verbatim on every card.

---

## Listening to Broadcastify — and what she is allowed to say

Claudia **opens the feed and listens** like any member of the public, then publishes **her own clear
account** of what she heard. Not a transcript. Not a quote. Never a line-by-line rewrite.

```bash
cd scanner
python3 listen.py open   --feed "County Fire — Ops 1" --show   # open the feed, confirm it plays
python3 listen.py record --feed "County Fire — Ops 1" --seconds 45 --segments 3
python3 listen.py session --feed "County Fire — Ops 1" --minutes 10
```

`listen.py` resolves the stream (config first, then the public feed page, then a real browser via
Playwright if it is installed), records short verification segments to `work/scanner/`, and writes a
manifest. Audio is **never** rebroadcast or embedded on the site.

Then the pipeline is explicit, and each step can refuse:

```
listen.py record        →  segments + manifest
speech_to_text          →  transcript.txt          (agent transcription)
paraphrase.py redact    →  transcript.safe.txt     (names, addresses, ages, plates, medical detail removed)
<Claudia writes her account from the scrubbed text, using scanner/draft-template.md>
paraphrase.py check     →  gate — exit 1 on any violation
paraphrase.py build     →  report.json  (kind: HEARD, with safety + uncertain + paraphrase metadata)
claudia.py file         →  live on the homepage and the desk page
```

### The gate, concretely

```bash
python3 paraphrase.py check --draft draft.md --transcript t.txt
```

It fails the draft when it finds:

- **six or more consecutive words copied from the source** (the run is printed back to her)
- quotation marks around radio traffic, or any transcript-style dialogue
- a name, street number, plate, phone, age or medical detail that was scrubbed from the source
- a missing `WHAT IT MEANS FOR YOU` section, a missing `SAFETY` line, or a headline over 180 chars
- an account under 40 words

A rejected draft looks like:

```
REJECTED — fix these before filing:
  ✗ 34 verbatim 6-word run(s) copied from the source: "4 transport one patient priority two" | …
  ✗ identifiers present in draft: age of a person, street address
```

A `HEARD` item renders on the site with its own visual treatment: a *Heard on <feed> · her own account,
not a transcript* line, a **What it means for you** panel, and a **Still unconfirmed** line — plus
`confidence: unconfirmed` until something published corroborates it.

Full rules — including why each field is withheld, attribution, and corrections — are in
**[POLICY.md](POLICY.md)**.

---

## Wiring Broadcastify

```bash
cd files/scanner
cp config.example.json config.json
export BROADCASTIFY_API_KEY=…          # from your Broadcastify account
python3 claudia.py doctor
python3 claudia.py status              # updates the rack in data/feed.json
```

For each feed in `config.json` fill in as much as you have:

| field | used for |
|---|---|
| `feed_id` | the numeric Broadcastify feed id |
| `page_url` | public feed page — lets **page mode** read the listener count and live marker with no key |
| `mount` / `stream_url` | the audio stream (`audio.broadcastify.com/<mount>.mp3`) — required for recording, taken from a signed-in session |
| `hot_threshold` | listener count that marks the feed *hot* and triggers auto-capture |
| `tags` | what the feed covers, so reports can cite the right rack row |

Then:

```bash
python3 claudia.py watch --interval 60      # poll the rack, auto-record busy feeds
python3 claudia.py capture --feed "County Fire — Ops 1" --seconds 45
python3 claudia.py ingest --feed FIRE1 --file transcript.txt
python3 claudia.py file --json report.json  # validated, de-duplicated write into data/feed.json
```

`ingest` grades each transcript line — **A** for structure fire / shots fired / officer down /
mayday class traffic, **B** for injury, pursuit, collision, **C** for routine clears — and writes
them into the scanner log. It deliberately does **not** auto-publish a report: grade-A traffic is
printed as a candidate for the desk to develop and corroborate first.

If no credential is present the module writes `"connected": false` and a visible note instead of
fake listener counts. The rack keeps its last known values and flags them `live_data: false`.

---

## Editorial rules the site enforces

1. Scanner traffic is never printed as fact. Every radio-sourced item is filed `unconfirmed` or
   `developing` until a published record, an official release, or a second independent source
   corroborates it — then it is re-filed `VERIFIED` / `confirmed`.
2. Two-source minimum for anything that names a person.
3. No address-level detail lifted from scanner audio.
4. Corrections are appended as new items; nothing is deleted from the wire.

---

## Putting the Claudia agent on top

The companion CREAO agent (**Claudia Green — 423.news correspondent**) does the reporting loop:
scan the open web and the scanner rack, grade every claim, and emit a report object that matches the
feed contract above. Its output drops straight into `data/feed.json` — either by hand, or with:

```bash
python3 scanner/claudia.py file --json claudia-report.json
```

Schedule it (e.g. every 30 minutes) and the homepage stays current without anyone at the desk.
