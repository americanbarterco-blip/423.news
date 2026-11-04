# Claudia integration in 423.news

This file replaces an older integration guide for a standalone demo bundle. The old referenced asset `assets/claudia-category.js` is not part of this repository and should not be copied into the site.

Claudia's current site pages are:

- `claudia-scanner.html` — public scanner/live-wire interface.
- `desk.html` — desk interface.
- `claudia-voice.js` — browser voice briefing.
- `feed.json` — static fallback data only; Supabase is the live source when available.

The main application and navigation are in `index.html` and `app.js`. Keep the existing Supabase project URL, public key, tables, RLS policies, and Edge Functions intact.

For the current architecture and deployment process, use `README.md`, `DEPLOY.md`, and `CLAUDIA-SETUP.md`.
