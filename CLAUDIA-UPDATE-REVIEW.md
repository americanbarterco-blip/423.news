# 423.news — safe review branch

This branch is a broader, isolated repair pass. It keeps `main` unchanged and preserves the existing Supabase project, schema, RLS, Edge Functions, database schedules, auth, and storage.

## Changes in this branch

- Adds `config.example.json` for the actual flat repository layout, with verified public Broadcastify feed pages for Bradley, Hamilton/Chattanooga, Rhea, and Polk counties.
- Fixes Claudia scanner path defaults so the scripts read/write the root `feed.json`, not a nonexistent `../data/feed.json`.
- Recognizes the provider's explicit `Online` status in Broadcastify feed pages.
- Prevents the watch loop from attempting audio capture unless an authorized stream URL or mount is configured.
- Makes local scanner report filing draft-only and prevents it from falsely switching Claudia to on-air.
- Changes Supabase sync so a missing `published` flag is omitted from the upsert instead of defaulting to `true`; explicit draft flags remain false.
- Exposes Broadcastify source URLs in the synced feed rows.
- Hides explicitly unpublished drafts from the Claudia public page, homepage fallback, and voice briefing.
- Removes fabricated embedded scanner demo incidents/log lines from the Claudia pages. Empty/unavailable live data now appears as unavailable rather than invented incidents.
- Adds tests for scanner config, online status parsing, draft safety, and Supabase publication behavior.
- Adds GitHub Actions validation for Python, JavaScript, inline scripts, and the example config.
- Adds an optional scheduled scanner status sync workflow. It skips safely if Supabase repository secrets are not configured.
- Rewrites the root README and Claudia setup notes to match the real repository and existing Supabase architecture.

## Intentionally not changed

- No changes to `main`, production deployment, site domain, Supabase tables, RLS, auth, Storage buckets, existing Edge Functions, or database cron schedules.
- No second NWS importer. The connected project already has an active Claudia desk job that processes NWS and RSS sources; a duplicate importer would create duplicate reports.
- No automatic scanner audio recording. Public Broadcastify pages can show feed status, but audio capture requires authorized stream access and a worker.
- No automatic publishing change. The existing Claudia desk currently publishes its configured NWS/RSS items automatically; scanner ingest auto-publishing is currently disabled in Supabase.

## External setup that cannot be fabricated

- The scheduled scanner sync needs GitHub Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.
- Audio capture needs an authorized Broadcastify stream URL/mount and FFmpeg on a worker.
- AI scanner drafting needs the existing Supabase Edge Function secrets `SCANNER_INGEST_TOKEN` and `ANTHROPIC_API_KEY`.
- Claudia's LiveKit audio room needs a working deployed `/api/livekit-token` endpoint and LiveKit credentials; the repo alone does not provision those secrets or host routes.
- Traffic incident data needs a valid TomTom key restricted to the production domain.

## Verification

GitHub Actions must report green for the new `423.news checks` workflow before this branch is considered ready. The Supabase project was inspected read-only: the expected 423.news tables and active Edge Functions exist, and the existing Claudia, sports, and weather database jobs were succeeding at the time of inspection.

Do not merge or deploy until the user reviews the diff and approves it.
