# START HERE — putting Claudia online, step by step

Written for someone who has never done this before. Every step tells you **what to click**, **what to
type**, and **what you should see when it worked**. Nothing here needs a terminal except Step 7
(optional). Total time: about 45 minutes, and you can stop after any phase and come back.

You will use four browser tabs the whole way: **GitHub**, **Cloudflare**, **Supabase**, **LiveKit**.

---

## Phase 0 — One decision first (2 min)

Where does she live?

| Option | Address | Good if |
|---|---|---|
| **A. Subdomain** | `claudia.423.news` | cleanest. Your existing 423.news index stays exactly as it is, and you paste a category block into it (see `INTEGRATION.md`) |
| **B. Folder** | `423.news/desk/` | if your host already serves that path |

Rest of this guide assumes **Option A**. It changes nothing except the domain name in Phase 8.

---

## Phase 1 — Put the files on GitHub (10 min)

1. Go to **github.com** → sign in → **+** (top right) → **New repository**.
2. Name: `423news-desk`. Visibility: **Private** is fine. Do **not** tick "Add a README".
   Click **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Drag the **contents** of the `files` folder into the box — `index.html`, `desk.html`,
   `conditions.html`, `category.html`, `assets`, `data`, `scanner`, `supabase`, `functions`,
   `.github`, plus the `.md` files.

   ⚠️ Drag the **contents**, not the `files` folder itself. `index.html` must sit at the very top
   level of the repo, and `functions/` must be beside it.
5. Type a message like `claudia: first upload` → **Commit changes**.

**You should see:** the repo page listing `index.html`, `desk.html`, `assets/`, `functions/`…

---

## Phase 2 — Cloudflare Pages serves it (8 min)

1. **dash.cloudflare.com** → sign in → left menu **Workers & Pages** → **Create** → **Pages** tab →
   **Connect to Git**.
2. Authorise GitHub if asked, pick `423news-desk`, click **Begin setup**.
3. Settings:
   - **Project name:** `claudia-423`
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** leave **empty**
   - **Build output directory:** `.` (a single full stop)
4. **Save and deploy**. Wait ~60 seconds.

**You should see:** "Success! Your site is live" and a URL like
`https://claudia-423.pages.dev`. Click it.

**Checkpoint:** the homepage opens with a logo, a scrolling news ticker, and a lead story about
weather in the Tri-Cities. Click **Claudia's desk** — you should see the desk drawing and an ON AIR
lamp. That's the whole site working off the JSON file, before any database exists.

If it 404s: the build output directory is wrong — set it to `.` and redeploy.

---

## Phase 3 — Supabase holds the data (10 min)

1. **supabase.com** → sign in → **New project**.
   - Name: `423news`
   - Database password: click **Generate a password**, then **save it somewhere**. You likely won't
     need it again.
   - Region: **East US (North Virginia)** — closest to Tennessee.
   - Plan: Free is fine to start.
   - **Create new project**, wait ~2 minutes while it provisions.
2. Left menu → **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` from your GitHub repo, click the **copy raw** / copy button, paste the
   whole thing into the SQL editor, click **Run**.

**You should see:** `Success. No rows returned`. Left menu → **Table Editor** now lists four tables:
`areas`, `reports`, `scanner_feeds`, `scanner_log`.

4. Left menu → **Project Settings** (gear) → **API**. Copy two things:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public** key — the long one under "Project API keys", *not* `service_role`
5. In GitHub, open `assets/config.js` → click the **pencil** (Edit) icon.
6. Fill in these two lines, keeping the quotes:

   ```js
   supabase: {
     url: 'https://abcdefgh.supabase.co',   // your Project URL
     anonKey: 'eyJhbGciOi…'                 // your anon public key
   },
   ```
7. Scroll down → **Commit changes** → commit directly to `main`.

**Checkpoint:** Cloudflare redeploys on its own (~1 min). Reload the site. It should look **empty** —
no stories. That is correct and good: the site is now reading the database, and the database has no
reports yet.

**Prove the wiring works** — this is the moment it becomes real:

8. Supabase → **Table Editor** → `reports` → **Insert** → **Insert row**.
9. Fill in only these, leave the rest alone:
   - `kind`: `VERIFIED`
   - `headline`: `Test row from the desk`
   - `summary`: `If you can read this on the website, the database is connected.`
   - `confidence`: `confirmed`
10. **Save**. Reload the website.

**You should see:** your test row as the lead story, with no page reload needed if the tab was open
(that's Realtime). Delete the row afterwards in the table editor.

---

## Phase 4 — The GitHub Action is her "server" (7 min)

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add exactly two:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL (same as config.js) |
   | `SUPABASE_SERVICE_KEY` | the **service_role** key from Supabase → Settings → API. This is the secret one — it must never go in `config.js` |

3. GitHub repo → **Actions** tab → if prompted, click **I understand my workflows, go ahead and enable
   them** → left side click **desk** → right side **Run workflow** → **Run workflow**.
4. Wait ~30 seconds, click the running job, watch the steps turn green.

**You should see:** the job finishes with a green tick. Supabase → Table Editor → `scanner_feeds` now
has five rows (the rack), and `reports` has your seven Tri-Cities stories.

That workflow now runs **by itself every 15 minutes**. You never start a server.

> **Cost note, before you run it for a month.** GitHub gives private repos 2,000 free Action minutes
> per month; a 15-minute cron at ~40 seconds a run is roughly 2,000 by itself. Two ways out:
> make the repo **public** (unlimited minutes — a news front end is public anyway, and no secrets
> live in the repo), or open `.github/workflows/desk.yml`, change `cron: '*/15 * * * *'` to
> `'*/30 * * * *'`, and commit. If you make the repo public, double-check that `scanner/config.json`
> holds only feed IDs and stream URLs — never the API key.

**Checkpoint:** the website shows the seven real reports — weather, I-26 lane work, early voting,
the fair-wage complaints, the I-26 stabbing, the TBI shooting review, the Sullivan County house fire.

---

## Phase 5 — How new reports get in (5 min to learn, 30 sec each time after)

Three ways, easiest first:

1. **Table editor paste** — Supabase → Table Editor → `reports` → Insert row. Fill `kind`
   (`BREAKING`, `VERIFIED`, `HEARD`, `FIELD`, `SCANNER`, `DESK`), `headline`, `summary`,
   `confidence` (`unconfirmed`, `developing`, `confirmed`). Optional but good: `dateline`, `tags`
   (comma-separated), `safety`, `uncertain`. Save → it is live instantly.
2. **From the agent** — when Claudia runs in Creao she hands you `claudia-report-<stamp>.json`. Put
   that array into `data/feed.json`'s `reports` list (GitHub web editor), commit, then Actions → desk →
   **Run workflow**. The sync pushes it to Supabase.
3. **From the scanner pipeline** — `claudia.py file`, then the workflow. (Ignore until Phase 6.)

Nothing requires a rebuild — the page reads the database directly.

---

## Phase 6 — Give her ears (Broadcastify) (10 min, optional)

Until this is done she is web-only, and the site says so on the rack rather than pretending.

1. Sign in at **broadcastify.com** → your account → **API / developer** area → copy your API key.
2. Find the feeds you want, e.g. search "Kingsport" or "Washington County TN". For each feed note:
   - the **feed ID** — the number in the URL `broadcastify.com/listen/feed/12345`
   - the **stream URL** — while the feed plays, the mount looks like
     `https://audio.broadcastify.com/12345.mp3` (right-click the player → copy audio address, or read
     it from the page source)
3. GitHub → `scanner/config.json` → pencil → for each feed fill `feed_id` and `stream_url`:

   ```json
   { "name": "Kingsport Fire — Dispatch", "feed_id": "12345",
     "stream_url": "https://audio.broadcastify.com/12345.mp3",
     "page_url": "https://www.broadcastify.com/listen/feed/12345",
     "tags": ["fire"], "priority": 1, "hot_threshold": 40 }
   ```
4. GitHub → Settings → Secrets → Actions → add `BROADCASTIFY_API_KEY`.
5. Actions → **desk** → **Run workflow**. Then open `data/feed.json` in the repo — after the run, the
   `scanner` block should have real listener counts and `"connected": true`.

**Never** commit the API key into `scanner/config.json`. It goes in Secrets only.

---

## Phase 7 — Her live voice (LiveKit) (10 min, optional)

Skip this until the site is live on a real domain with HTTPS — browsers refuse the microphone without it.

1. **livekit.io** → sign in → **Create project** → free tier. Copy three values from the project
   settings: **WebSocket URL** (`wss://….livekit.cloud`), **API Key**, **API Secret**.
2. Make up an **editor key**: open your password manager, generate a random 32-character string.
   That string is what you will type to go on air. Keep it.
3. Cloudflare → your `claudia-423` project → **Settings** → **Environment variables** →
   **Add variable** (choose **Secret** type for the last three):

   | Variable | Value |
   |---|---|
   | `LIVEKIT_URL` | `wss://….livekit.cloud` |
   | `LIVEKIT_API_KEY` | from LiveKit |
   | `LIVEKIT_API_SECRET` | from LiveKit |
   | `EDITOR_KEY` | the random string you just made |

4. Cloudflare → **Deployments** → **Retry deployment** (env vars only apply to a new build).
5. Open `https://claudia-423.pages.dev/desk.html` → the **Desk mic** button appears → click it → paste
   your editor key → **Allow** the microphone.
6. Open the site in a second browser or on your phone → a small bar bottom-left says *Claudia is on
   air* → **Listen**.

If the bar never appears, the Function didn't deploy: check that `functions/api/livekit-token.js`
exists at the repo root (not inside another folder).

---

## Phase 8 — Your domain, and her slot on the 423.news index (5 min)

1. Cloudflare → `claudia-423` → **Custom domains** → **Set up a custom domain** →
   type `claudia.423.news` → **Continue** → **Activate**. If `423.news` is on Cloudflare it adds the
   DNS record for you; HTTPS is automatic.
2. Visit `https://claudia.423.news`. Everything from Phase 1–7 now lives there.
3. To add her **category** to your existing 423.news index: open `INTEGRATION.md`, copy the block
   marked "drop this into your index", paste it where the category belongs in your own template, and
   point `data-href` at `https://claudia.423.news/category.html`. One script tag, no build step, no
   stylesheet conflicts.

---

## Phase 9 — Clean up (2 min)

In the GitHub repo, delete these — they were built for a different stack and do nothing on Cloudflare:

`docker-compose.yml`, `deploy/` (whole folder), `serve.py`, `netlify.toml`, `vercel.json`,
`cloudflare/` (whole folder).

Leave: `assets/`, `data/`, `functions/`, `scanner/`, `supabase/`, `.github/`, the four `.html` files,
and the `.md` files.

---

## Final check — tick all six

- [ ] `https://claudia.423.news` loads; lead story is real Tri-Cities reporting
- [ ] Press `/` and type `weather kingsport` — a weather card appears with live numbers
- [ ] Insert a row in Supabase `reports` → the open page updates **without a reload**
- [ ] Actions → desk shows a green run within the last 15 minutes
- [ ] `/desk.html` → **Desk mic** asks for a key; a second device can hear you
- [ ] Supabase → `scanner_feeds` → rows say `connected` / have real listener numbers (only after Phase 6)

---

## When something breaks

| What you see | What it means | Fix |
|---|---|---|
| Site loads but no stories at all | Supabase keys missing/wrong, or the table is empty | Recheck `assets/config.js` URL + anon key; check Table Editor has rows |
| Stories appear, page never updates by itself | Realtime not enabled | Re-run the `alter publication` block at the bottom of `schema.sql` |
| `401` in the site console | anon key pasted with a space, or you used the service key | Repaste the **anon public** key only |
| Action fails: `SUPABASE_SERVICE_KEY must be set` | secret name typo | Secrets are case-sensitive: `SUPABASE_SERVICE_KEY` |
| Action fails: `HTTP 401` on sync | you put the anon key in the service slot | Use the **service_role** key there |
| Weather/traffic cards empty | opened over `file://`, or no TomTom key | Use the https URL; TomTom key in `assets/config.js` `traffic.apiKey` |
| Bar never appears bottom-left | LiveKit env vars missing, or no redeploy after adding them | Add all four, then Retry deployment |
| Mic button does nothing | not HTTPS, or browser blocks the mic | Use the https domain; allow microphone in site settings |
| `Desk mic` rejects the key | `EDITOR_KEY` changed after the page cached the old prompt | Hard-refresh the page, paste the key again |

## Three rules that keep this from going wrong

1. **Never** put the `service_role` key, the Broadcastify key, or the LiveKit secret into
   `assets/config.js`. That file is public — it is sent to every visitor.
2. **Never** publish a scanner transcript. Her account goes through `paraphrase.py`; audio is never
   rebroadcast. (`POLICY.md`)
3. If a report says `unconfirmed`, it stays unconfirmed until something published confirms it. The
   site renders that label; don't edit around it.

## If you only do five of the nine phases

Do **1, 2, 3, 4, 8**. That gets a live, self-updating news desk on your own domain — no scanner audio,
no live voice, nothing that needs a key. Phases 6 and 7 can wait weeks; the site is honest about what
isn't connected yet.
