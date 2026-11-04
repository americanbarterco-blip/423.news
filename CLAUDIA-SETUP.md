# Claudia Green — 423.news setup

This repository uses a flat layout. The scripts, public feed file, and site pages live at the repository root.

## 1. Configure the scanner status feeds

```bash
cp config.example.json config.json
python3 claudia.py doctor
python3 claudia.py status
```

The example config includes public Broadcastify feed pages for Bradley, Hamilton/Chattanooga, Rhea, and Polk counties. The status command reads the public feed pages and updates the local `feed.json` scanner rack. It does not need a Broadcastify API key for page-status checks.

The public page status is not an audio connection. Audio capture is intentionally disabled until you supply a stream URL or mount that your Broadcastify account is authorized to use. Do not paste account passwords or private credentials into `config.json`; the file is git-ignored.

## 2. Run the status monitor

```bash
python3 claudia.py status
python3 claudia.py watch --interval 60
```

`status` performs one check. `watch` repeats checks and only attempts audio capture for feeds that have an authorized stream configured. Use `Ctrl+C` to stop it.

## 3. Optional audio capture

Install FFmpeg on the worker machine, then add an authorized `stream_url` (or `mount`) to the matching feed object in your private `config.json`. Test it with:

```bash
python3 listen.py resolve --feed "Bradley County Sheriff, Cleveland Police, Fire Rescue and MAC"
python3 listen.py record --feed "Bradley County Sheriff, Cleveland Police, Fire Rescue and MAC" --seconds 30
```

Broadcastify static audio URLs may require a paid account. The scripts do not bypass login, paywalls, access controls, or feed terms. If you do not have authorized stream access, keep the public feed-page status mode enabled and use the Broadcastify link to listen manually.

## 4. Supabase sync (optional)

Set these as environment variables on a trusted worker or GitHub Actions secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service-role key; never put it in the browser or commit it)

Then run:

```bash
python3 supabase_sync.py
```

The sync expects the existing tables `news_scanner_feeds`, `news_scanner_log`, and `news_reports`. It does not create tables or alter RLS. Ensure the tables and policies already exist before enabling the sync.

Scanner reports created by `claudia.py file` are drafts (`published=false`). The sync only changes a report's publication flag when the local report explicitly includes that field. An editor must approve a draft in Admin before it appears in the public feed.

## 5. Weather alert drafts

The separate `nws_alerts.py` workflow imports National Weather Service alerts for the configured Tennessee counties as unpublished drafts. It does not publish or delete reports. It requires the same two Supabase environment secrets and the existing `news_reports` table.

## Important service dependencies

The site itself remains static HTML/CSS/JavaScript and continues using the existing Supabase browser integration. Some optional functions require services that are not provisioned by source code alone:

- Broadcastify authorized stream access for automatic audio capture.
- A running worker/host for continuous scanner monitoring.
- Supabase tables, RLS policies, and storage buckets already configured in the connected project.
- A configured Cloudflare Pages Function and LiveKit project for Claudia's live audio room.
- A restricted TomTom Traffic API key for traffic incidents.

The app must display a disconnected/unconfigured state when any of those dependencies are absent. It must never label demo data as live or publish an unreviewed scanner report.
