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


## Geographic ranking, deduplication and Live Wire integration

- Rank county-connected leads with Polk first, then Bradley and Hamilton, followed by Rhea and Grundy. Wider 423-area and outside-area items remain eligible at lower priority; the publisher's location alone never establishes local relevance.
- Before drafting, compare normalized titles against recent published stories and higher-ranked leads. Exact and near-identical headlines are retained in the lead audit trail but are not published again.
- Sensitive or urgent public-safety material uses a stricter gate even during onboarding: at least two distinct source domains and a 0.95 factual-confidence score, with unsupported or conflicting claims held out of publication. A domain count is not, by itself, proof of independent ownership or corroboration.
- The public Claudia Live Wire combines published news_reports with eligible published news_posts. Automatically published posts are labeled as verified; other published posts are not automatically upgraded to verified. The wire describes these items as reports, not as live CAD incidents.


## Autonomous news-hub publishing policy

Claudia is a news hub. Ingested leads are not discarded because they are single-source, developing, sensitive, outside the core counties, duplicated in headline, or not yet independently corroborated. County priority changes processing order only; it does not decide whether an item may be published.

- Process every new or researching lead in priority order, without a fixed per-section or per-run editorial quota.
- Publish a source-attributed developing brief even when evidence excerpts or the AI writing service are temporarily unavailable. Use the incoming headline, supplied summary and original source link; never fill gaps with invented details.
- Use AI drafting and fact-checking to improve presentation and provide a transparent status, not as a publication veto.
- A failed or unavailable fact check means publish as developing/source-attributed, not dismiss or suppress.
- Sensitivity flags call for clear labeling and editorial attention. They do not suppress coverage or automatically exclude any topic.
- Keep per-lead idempotency so scheduled runs do not republish the same lead repeatedly. Do not discard a distinct incoming lead merely because its headline resembles another item.
- The public wire includes all published stories and does not convert an automatic publication into a verified incident. A story's status is explicit in its visible editorial note.
- Continue learning from feedback and corrections; lessons improve writing and presentation, not topic bans or blanket publication blocks.
