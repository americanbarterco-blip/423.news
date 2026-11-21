# Claudia integration conflict resolution

PRs 66–68 independently changed the same discovery workflow, creating overlapping edits. This integration branch consolidates research executor, evidence-gated draft writer, and optional community/video adapters onto main with one workflow file and standalone manual workflows.

Scheduled discovery runs public feed/site collection and lead queueing. Community/video discovery is enabled when API credentials are configured. Draft generation is gated behind the opt-in GitHub secret CLAUDIA_AUTONOMY_ENABLED=true and requires Supabase/OpenAI credentials; drafts stay private and review-only. Research executor remains manual pending deployed migration verification. No publication step is added.

This PR supersedes PRs 66–68 and includes their source scripts, tests, docs, and SQL migration.