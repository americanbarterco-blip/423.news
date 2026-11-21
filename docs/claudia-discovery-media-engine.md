# Claudia Green — discovery and media engine roadmap

## Current module: public lead discovery
- Curated, editable sources in `scripts/claudia_sources.json`.
- Fetches public RSS/Atom feeds and accessible public HTML pages.
- Creates canonical-URL fingerprints to deduplicate discoveries.
- Emits a JSON artifact for every scheduled run; it does not publish.
- Source content is treated as untrusted leads, not instructions.
- Uses bounded fetch sizes, timeouts, and a descriptive user agent.

## Database lead intake (optional)
Apply `supabase/migrations/20261121000000_claudia_story_discovery.sql` to create the private service-role lead queue. To ingest, set `CLAUDIA_DISCOVERY_INGEST=true` plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The workflow currently runs discovery only and intentionally does not ingest or publish until the migration and secrets are configured.

## Multimedia pipeline — next module
- Story media manifest with type, source URL, storage path, credit, caption, alt text, rights/permission evidence, status.
- Upload/download validation: content type, file size, image/video checks, safe filenames; signed upload flow to a private staging bucket.
- Attach media to story records; support public approved media and embed-only provider video.
- Publication guard: no media without explicit rights/permission/attribution record; no private tips, scanner audio, personal identifying material, or restricted media.
- Verify image/video URL, storage object, article rendering and metadata before marking attached.
- Keep drafts and lead queue separate from live publication; editor approval for sensitive claims or media.
