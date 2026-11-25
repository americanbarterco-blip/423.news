# Claudia Regional Coverage Intelligence

The private staff dashboard is available at `/claudia-coverage.html` and is linked from the 423.news admin navigation.

## Purpose

Give newsroom staff a measurable view of discovery, publishing, research work, evidence capture, and source activity across the core five-county coverage area.

The operational priority order is:

1. Bradley and Polk — tied highest priority.
2. Hamilton — strong second priority.
3. Rhea and Grundy — important regional coverage.

Priority is an attention and source-development guide only. It does not exclude or suppress any lead, subject, source, or county. All ingested leads remain eligible for Claudia's existing newsroom workflow.

## Data displayed

The dashboard calls the existing authenticated Supabase `admin` Edge Function using the existing staff login/session. The new `regionalCoverageStats` action reads:

- `claudia_story_leads`: ingested leads, county assignment, source names, and discovery timestamps.
- `news_posts`: published stories and publication timestamps.
- `claudia_research_tasks`: queued, in-progress, blocked, and completed work.
- `claudia_story_evidence`: evidence-record count.
- `claudia_story_drafts`: published draft count.

The configured source inventory is loaded from `scripts/claudia_sources.json`. Source inventory and source activity are intentionally shown as different measures.

## Metric definitions and limitations

- Lead and story windows use rolling 7-day and 30-day periods.
- County attribution is a transparent keyword match over available lead/story title, summary/body, source name, and source URL. Items that do not match a county remain regional/unassigned and are not discarded.
- The source table shows the latest recorded ingested lead from a configured source. A source with no lead recorded, or no lead in the last 7 days, is a coverage follow-up signal—not proof that the source is offline or that a scheduled check failed.
- Source counts are based on exact source-name matches between the configured inventory and ingested lead records.
- The endpoint reads up to 5,000 rows per table. A visible limit warning indicates totals may be partial.
- A missing/unavailable table is reported as unavailable; the dashboard does not convert missing data into a zero.
- The dashboard is read-only. It does not publish, suppress, edit, or delete stories or leads.

## Deployment notes

The HTML dashboard is a Cloudflare Pages asset. The `regionalCoverageStats` action is an update to the Supabase `admin` Edge Function and must be deployed to the Supabase project separately from the Cloudflare asset deployment. Until that function update is deployed, the dashboard will report that the metrics endpoint is unavailable. No service-role key is placed in browser code.
