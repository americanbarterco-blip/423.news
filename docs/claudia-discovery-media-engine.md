# Claudia research workflow foundation

The queue, evidence, and draft tables are private service-role-only records. Research tasks have retry metadata, availability and lock fields, explicit statuses, and idempotent uniqueness per lead/task type. Evidence rows track corroborating source types and URLs. Draft records remain separate from the published news content.

`scripts/claudia_workloop.py` is queue intake only: it converts new leads into research task rows when Supabase service-role credentials are available. It does not research, verify, write articles, or publish. The migration must be applied after `20261121000000_claudia_story_discovery.sql`.

Next: build the task executor with safe claiming/locking, fetch/corroborate multiple accessible sources, model-assisted original draft generation, source evidence storage, review gates, and story/media attachment integration.
