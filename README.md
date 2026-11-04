# 423.news

423.news is a static, mobile-first local news and community site backed by Supabase. The repository is the live site source; it is not the separate Claudia demo bundle described in some older documentation.

## Main site

- `index.html` — main hash-routed single-page application.
- `app.js` — Supabase auth, posts, comments, profiles, follows, video streams, scanner tips, and realtime updates.
- `site.css`, `theme.css` — site styling and responsive layout.
- `admin.html` — staff Admin interface, using the existing Supabase `admin` Edge Function.
- `supabase/functions/admin/index.ts` — tracked source for that existing function; the review branch adds a safe delete path for the site's public media/video buckets. It is not deployed by GitHub Actions.
- `claudia-scanner.html`, `desk.html`, `claudia-voice.js` — Claudia Green live-wire and desk interfaces.
- `conditions.html`, `forecast.js`, `tomtom.js` — weather, alerts, and traffic features.
- `events.html`, `hotspots.html`, `category.html`, `report.html` — supporting site pages.
- `feed.json` — static fallback feed for Claudia's page. Supabase is the live source when available.
- `checkpoints.html`, `checkpoints.json`, `update_checkpoints.py` — checkpoint history and update helper.
- `.github/workflows/` — automated validation and scheduled jobs.

There is no build step. The HTML, CSS, and JavaScript files are served directly by the existing static host. Do not change the production host, custom domain, or deployment branch as part of a code review.

## Existing Supabase integration

The site uses the existing Supabase project and its existing tables, policies, Storage buckets, Realtime, and Edge Functions. This branch does not recreate the project, replace keys, run schema migrations, or change RLS.

The active site uses tables including:

- `news_posts`, `news_comments`, `news_profiles`, `news_follows`
- `news_reports`, `news_scanner_feeds`, `news_scanner_log`, `news_scanner_tips`, `news_scanner_transcripts`
- `news_scores`, `news_streams`, `news_areas`, `news_forecast_videos`

The connected project already has active Edge Functions for Admin, Claudia's desk/drafts/scanner ingest, sports sync, weather alerts, and push notifications. Scheduled database jobs run the Claudia desk every 10 minutes, sports sync every minute, and weather push-alert checks every 2 minutes.

**Important:** the existing Claudia desk automation is enabled and publishes its configured NWS/RSS items automatically. Scanner-ingest auto-publishing is separately disabled. Do not add a second weather importer or silently change these existing publishing rules.

## Local development

Serve the repository root over HTTP (rather than opening files with `file://`):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

The scanner status helper uses a private local config:

```bash
cp config.example.json config.json
python3 claudia.py doctor
python3 claudia.py status
```

`config.json`, scanner captures, and working files are git-ignored. Public Broadcastify page status can be checked without audio credentials. Audio recording requires an authorized stream URL or mount and FFmpeg; the code does not bypass provider access controls.

## Validation

Run the same checks used by GitHub Actions:

```bash
python3 -m compileall -q .
python3 -m unittest discover -s tests -v
python3 tests/check_inline_js.py
```

The pull request workflow also runs `node --check` on root JavaScript files and validates `config.example.json`.

## Secrets and external services

Never commit service-role keys, admin passwords, Anthropic keys, scanner ingest tokens, LiveKit secrets, or private feed URLs. Use GitHub Actions secrets or the relevant provider's secret manager. The browser may contain only the Supabase public/anon key and other provider keys that are intentionally public and appropriately domain-restricted.

Some optional features require external setup beyond this repository: authorized Broadcastify audio access, a worker for continuous audio capture, Anthropic and scanner-ingest secrets, and a LiveKit token endpoint/credentials. A feature must show a clear unavailable state when its required service is not configured; it must not pretend demo data is live.

## Safe change process

Work on a review branch and compare it with `main`. Keep `main` unchanged until the user has reviewed and approved the changes. Do not merge or deploy as part of a review.
