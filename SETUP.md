# Claudia upgrade — setup (about 15 minutes)

Copy everything in this folder into the root of your 423.news repo (keep the folder layout; `.github/workflows/`
files go in that folder). `admin.html` and `POLICY.md` replace the existing ones. `server/` is only needed
when you get an always-on server.

## GitHub secrets (Settings → Secrets and variables → Actions)
- ANTHROPIC_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- BROADCASTIFY_STREAM_URLS   e.g. {"9119":"https://...","45708":"https://...","44571":"https://...","37220":"https://..."}

## Run in this order (Actions tab → pick workflow → Run workflow)
1. NWS alerts          — no Broadcastify needed; proves Supabase + secrets work
2. Inspect dataset     — paste the log to Claude so the Chattanooga report can be finished
3. Claudia listens     — only after you have stream links AND permission for each feed

## What publishes by itself
- NWS alerts: yes (official US government source). Add --draft in the workflow to approve each one.
- Scanner reports (Claudia listens): NEVER. Saved as drafts (published=false). Approve in Admin → news_reports.
- Chattanooga incident summary: draft unless you pass --publish.
- Booking items: always typed in by an editor, saved unpublished.

## Admin
Admin → news_reports tab must be allowed in the admin function's ADMIN_TABLES secret.
