# Deploying Claudia on your stack

She doesn't get "her own everything". She is a **repo, three tables, one room** inside the stack you
already run. There is no server to patch, no Docker, no Netlify.

| You already have | Claudia uses it for |
|---|---|
| **GitHub** | the repo (site + worker), and Actions as her cron — the "desk loop" runs on a runner every 15 min and exits |
| **Cloudflare Pages** | the static pages, plus one Function (`/api/livekit-token`) — no other backend |
| **Supabase** | `reports`, `scanner_feeds`, `scanner_log`, `areas`; **Realtime** replaces the polling entirely |
| **LiveKit** | her live "on air" voice — you already pay for WebRTC, so she gets an actual live mic, not just text |
| **Broadcastify** | what she listens to (audio only, never restreamed) |

```
GitHub Action (cron 15m)
   └── scanner/claudia.py status ──► data/feed.json
   └── scanner/supabase_sync.py ──► Supabase (reports · feeds · log)
                                        │  Realtime
Cloudflare Pages (index · desk · conditions) ◄──┘
   └── /api/livekit-token ──► LiveKit room "claudia-desk" ──► listener audio
```

---

## One-time setup (~20 minutes)

### 1. Repo
Push the contents of `files/` as the repo root. `functions/` must sit **next to `index.html`** — that
is where Pages looks for Functions.

```bash
cd files && git init && git add -A && git commit -m "claudia: 423.news live desk"
git remote add origin git@github.com:you/423news.git && git push -u origin main
```

### 2. Supabase
New project → SQL Editor → paste `supabase/schema.sql` → Run. It creates four tables, RLS (public read,
service-role write), the Realtime publication, and the opening area.

Copy from Settings → API:
- **Project URL** → `assets/config.js` → `supabase.url`
- **anon public key** → `assets/config.js` → `supabase.anonKey`
- **service_role key** → GitHub secret `SUPABASE_SERVICE_KEY` (**never** in the browser)

### 3. Cloudflare Pages
Create project → connect the repo → framework preset **None**, build command empty, output directory
`.` (or `files` if you kept that folder).

Then Settings → Environment variables:

```
LIVEKIT_URL          wss://your-project.livekit.cloud
LIVEKIT_API_KEY      (LiveKit dashboard)
LIVEKIT_API_SECRET   (LiveKit dashboard — secret)
EDITOR_KEY           (openssl rand -hex 24)
```

`functions/api/livekit-token.js` signs its own HS256 JWT with WebCrypto, so there is nothing to install.
Set the custom domain; HTTPS is required for microphone and geolocation.

### 4. LiveKit
Create a project at livekit.io → copy URL / API key / secret into the Pages env above. The room is
created on first join; no dashboard config needed.

### 5. GitHub secrets + cron
Repo → Settings → Secrets → Actions:

```
SUPABASE_URL              https://xxxx.supabase.co
SUPABASE_SERVICE_KEY      service_role key
BROADCASTIFY_API_KEY      (optional until you have it)
```

`.github/workflows/desk.yml` is already in the repo — it runs every 15 minutes and can be triggered by
hand from the Actions tab. First run creates the rack rows in Supabase.

---

## What happens at runtime

**Serving a page.** Cloudflare Pages serves static files. `assets/store.js` sees a Supabase URL in the
config and switches backends:

- reads `reports`, `scanner_feeds`, `scanner_log` over PostgREST with the anon key (RLS allows read)
- subscribes to `postgres_changes` → a new row repaints the homepage in under a second
- if the CDN or network blocks supabase-js, it silently falls back to polling `data/feed.json`

Nothing on the page knows or cares which backend it got.

**Filing a report.** Either:

```bash
# from the desk (agent or editor), writes locally then pushes to Supabase
python3 scanner/claudia.py file --json report.json
python3 scanner/supabase_sync.py        # needs the service key in env
```

or insert straight into `reports` in the Supabase table editor — Realtime takes it from there. No
deploy, no cache purge. This is the part the static-host version could never do.

**Listening.** `listen.py` records a segment → transcription → `paraphrase.py` gate → `file` → sync.

---

## LiveKit: the part you already pay for

- **Visitors** — a small bar appears bottom-left, *Claudia is on air* → **Listen** joins the room as a
  subscriber. Audio only, no camera, no recording. It probes `/api/livekit-token?role=probe` every 30s
  so the bar is honest about whether she's actually live.
- **The desk** — `desk.html` shows a **Desk mic** button once LiveKit is configured. It asks for the
  editor key (the same `EDITOR_KEY`), gets a publisher token, and publishes the microphone.
- **Listeners never get a publish token.** The Function refuses `role=publisher` without
  `x-editor-key`, and the API secret never leaves Cloudflare.

**Legal line that matters:** LiveKit carries **her voice reading her own account**. Never route the
Broadcastify stream into the room — that would be rebroadcasting the feed, which `POLICY.md` forbids and
which is the fastest way to lose the feed and inherit a complaint.

---

## Verify

```bash
curl -sI https://yourdomain/ | head -1
curl -s https://yourdomain/api/livekit-token?role=probe          # {"live":false}
curl -s https://yourdomain/api/livekit-token?role=listener | head -c 120
```

In the browser:

- [ ] Homepage hero shows the newest report; the ticker scrolls
- [ ] Insert a row in Supabase `reports` → the open page updates **without reload** (Realtime)
- [ ] `curl .../api/livekit-token?role=publisher` without the header → `401`
- [ ] Desk **Desk mic** → bar flips to *On air*, a second browser can hear her
- [ ] `weather <your city>` in the command bar returns a live card
- [ ] Mic button in the command bar works (HTTPS only)

## Troubleshooting

| Symptom | Cause |
|---|---|
| Page loads, no reports | `supabase.url` or anon key wrong, or RLS disabled — check the browser console for `HTTP 401/404` |
| Reports arrive but the page doesn't update | Realtime not enabled on the table (re-run the `alter publication` block in `schema.sql`) |
| `supabase_sync.py` → `HTTP 401` | you used the anon key as `SUPABASE_SERVICE_KEY` |
| `/api/livekit-token` → `501 livekit_not_configured` | Pages env vars not set for the **production** environment |
| Publisher returns `401` | `x-editor-key` mismatch — `EDITOR_KEY` changed but the prompt is cached |
| Bar never appears | `livekit.tokenEndpoint` blank, or the Function is not at `functions/api/…` |
| "not configured" in the traffic card | TomTom key empty in `assets/config.js` |

---

## Appendix — static-only

Everything still works with no Supabase and no LiveKit: fill neither in `assets/config.js` and the site
reads `data/feed.json` exactly as before, polling every 20 seconds. That mode is fine for a preview.

`docker-compose.yml`, `deploy/nginx-site.conf`, `deploy/claudia-desk.service`, `serve.py`, `netlify.toml`
and `vercel.json` are leftovers from the first pass — **you don't need any of them** on Cloudflare, and
they can be deleted. `cloudflare/` is a dead stub now that `functions/` exists.
