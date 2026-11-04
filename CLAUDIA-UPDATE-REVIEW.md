# Claudia update — review branch

This branch is a safe, limited first pass at the useful parts of the November 4 upload.

## Included
- `nws_alerts.py`: retrieves active National Weather Service alerts and creates or refreshes **unpublished drafts only** in the existing `news_reports` table.
- `.github/workflows/claudia-nws-drafts.yml`: optional 10-minute schedule and manual run. It skips cleanly until both Supabase secrets are configured.
- The alert importer is restricted to the ten 423-area Tennessee counties listed in the script.
- Existing published reports are left unchanged. The importer does not publish, unpublish, or delete reports.

## Deliberately not included yet
- Scanner audio/transcription pipeline: the uploaded version imports `claudia.py`, `listen.py`, and `paraphrase.py`, but those required files and the matching workflow were not part of that commit. It cannot be installed as-is.
- Continuous scanner server/bootstrap: requires separate server provisioning, Broadcastify feed permissions, credentials, and operational monitoring.
- Chattanooga vehicle incident summaries: the source-column selection and time-window assumptions need validation against the live dataset before it can safely create reports.
- Booking/arrest template and Admin changes: not added to the live Admin interface. The prior template used a fixed example ID and placeholder person/date/charge text, which could create incorrect records.
- No Supabase schema, RLS, auth, storage, or existing checkpoint workflow changes.

## Setup required to test
In GitHub repository Settings → Secrets and variables → Actions, add:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service-role secret; never put this in browser code)

The Admin edge function must already allow `news_reports` in its `ADMIN_TABLES` setting for editors to review drafts in Admin. This branch does not change that function or its secrets.

## Test plan
1. Run `python3 -m py_compile nws_alerts.py`.
2. Run `python3 nws_alerts.py --dry-run` to inspect matching live alerts without writing.
3. Run the GitHub Action manually after secrets are configured.
4. Confirm drafts appear in Admin and that the homepage continues to show only `published=true` reports.
5. Compare this branch with `main`; do not merge until approved.
