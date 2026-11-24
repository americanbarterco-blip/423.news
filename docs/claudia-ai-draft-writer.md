# Claudia Green — autonomous discovery and publishing

Claudia's scheduled newsroom workflow runs every 15 minutes. It discovers public RSS/web leads, stores them in the private Supabase lead queue, gathers publisher-page evidence, then drafts, fact-checks, and automatically publishes eligible reports to `news_posts`.

## Publishing behavior

- Qualifying, evidence-backed reports publish automatically; the writer appends source links from retrieved evidence.
- Coverage is topic-neutral. Crime, emergencies, crashes, courts, politics, schools, sports, weather, outdoors, business, and community stories are not blanket exclusions.
- The factual gate evaluates claims, not topics. Material unsupported or conflicting claims are not published.
- An individual lead that lacks readable evidence, independent corroboration when required, or a passing factual check is flagged in its own lead record (`status=dismissed`, `CLAUDIA_AUTO_FLAGGED` note). The lead is retained for audit; it is not repeatedly retried.
- Flagging one item never pauses the run or blocks other eligible stories. Temporary AI/database/provider errors are logged separately and do not get mislabeled as rumors.
- Successfully published leads are marked `drafted` so they leave the automatic selection queue. A slug/idempotency guard prevents duplicate posts.

## Required GitHub Actions secrets

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The workflow sets the 423.news Supabase URL and the configured Cloudflare Workers AI model. If required credentials are missing, publishing safely skips; no paid-provider fallback is attempted.

## Workflow

`.github/workflows/claudia-story-discovery.yml` runs discovery and publishing every 15 minutes and can also be started manually. It includes unit tests on relevant pull requests and pushes.
