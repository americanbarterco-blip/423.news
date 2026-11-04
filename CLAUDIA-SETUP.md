# Claudia Green — 423.news setup and operations

This is the actual flat repository layout. The scripts are at the root beside `feed.json`, `index.html`, and the site assets. Older notes that refer to `scanner/`, `data/`, `assets/`, or `supabase/schema.sql` do not describe this repository.

## What is already running

The connected Supabase project already contains the 423.news tables and RLS policies. Its active Edge Functions include `admin`, `claudia-desk`, `claudia-draft`, `claudia-scanner-ingest`, `sports-sync`, `weather-alerts`, and `push-send`.

Existing database schedules are active:
- Claudia desk feed: every 10 minutes.
- Sports sync: every minute.
- Severe-weather push checks: every 2 minutes.

The existing Claudia desk function reads the configured NWS and local RSS sources and publishes those reports automatically while `news_desk_state.auto_enabled` is true. The scanner-ingest function uses a separate `scanner_auto_publish` setting; the current setting is false. This repository update does not change those live settings.

## 1. Public Broadcastify status

Copy the example config and run the status check:

```bash
cp config.example.json config.json
python3 claudia.py doctor
python3 claudia.py status
```

The example lists public feed pages for Bradley, Hamilton/Chattanooga, Rhea, and Polk counties. Public page status checks do not require an audio stream credential. The status workflow in `.github/workflows/claudia-scanner-status.yml` runs every 10 minutes and syncs the results to the existing Supabase scanner tables when the repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured.

The public feed page being online is not the same as having an authorized audio stream. Audio capture is intentionally off until a permitted `stream_url` or `mount` is added to your private `config.json`.

## 2. Optional authorized audio capture

Install FFmpeg on a trusted worker and add the authorized feed stream URL or mount to the matching entry in `config.json`. Then:

```bash
python3 listen.py resolve --feed "Bradley County Sheriff, Cleveland Police, Fire Rescue and MAC"
python3 listen.py record --feed "Bradley County Sheriff, Cleveland Police, Fire Rescue and MAC" --seconds 30
```

Broadcastify static audio URLs may require a paid account. Do not paste account passwords into the config and do not bypass feed access controls or terms. If you do not have an authorized stream URL, use the public feed page manually.

## 3. Scanner transcript and draft pipeline

The existing Supabase `claudia-scanner-ingest` function is active. It requires the `SCANNER_INGEST_TOKEN` and `ANTHROPIC_API_KEY` Edge Function secrets. It records a transcript, applies the safety/paraphrase gate, and files a report. Scanner auto-publishing is controlled separately by `news_desk_state.scanner_auto_publish`; it is currently disabled, so reports remain drafts for human review.

The `paraphrase.py` helper provides local redact/check/build commands. Never publish raw dispatch transcripts or identifying details.

## 4. Local report sync

The root-level `supabase_sync.py` syncs the local `feed.json` into the existing tables. It requires:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service-role key; keep it in GitHub Secrets, never in browser code)

It does not create tables or change RLS. Reports created by `claudia.py file` are marked `published=false`. Missing publication flags are omitted from the upsert so an existing published report is not accidentally unpublished.

## 5. What still needs provider setup

- Continuous audio capture needs an always-on worker and authorized Broadcastify stream URLs.
- Scanner AI drafting needs the Anthropic and ingest-token secrets.
- Claudia's LiveKit audio room needs a working token endpoint and LiveKit URL/API credentials. The static repository currently points at `/api/livekit-token`; confirm that route exists on the deployed host before enabling the on-air room.
- Traffic incidents need a valid TomTom key restricted to the production site domains.

The site must show a truthful disconnected/unconfigured state when one of these dependencies is missing. Do not display sample scanner logs as real incidents.
