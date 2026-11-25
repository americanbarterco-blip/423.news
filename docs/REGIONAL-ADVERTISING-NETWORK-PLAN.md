# Regional Advertising Network — Implementation Plan

Status: preview design and repository audit. No production code, database, credentials, billing, or deployment changes are included in this document.

## Goal

Build one reusable advertising product that can serve 423.news, 808.news, and future regional editions while keeping each edition's advertisers, campaigns, placements, reporting, and revenue records isolated.

The advertising product has two independent channels:

1. **Direct sponsorships** — publisher-sold local business campaigns, sponsored sections, featured business placements, newsletter/video sponsorships, and custom packages.
2. **Programmatic/display inventory** — optional third-party demand integrations, only after the publisher chooses and configures a provider. Never represent an ad as programmatic when it is a direct sponsor.

## Existing 423.news capabilities found in the repository

The current main branch already contains a basic ad-management system:

- `ads.js` renders top, mid, and bottom image/video ad slots and fetches active rows from `news_ads`.
- `ads-setup.sql` defines `news_ads`, public read-only RLS for eligible ads, and a public `news-ads` storage bucket.
- `admin.html` contains an authenticated Ads tab for uploading, creating, editing, pausing, resuming, and deleting ads; it also exposes live-video commercial-break settings.
- `supabase/functions/admin/index.ts` includes authenticated ad upload and CRUD support through the existing staff session.
- Some pages already load `ads.js`; complete English/Spanish route coverage has not yet been proven.

This existing system must be extended, not replaced blindly. Preserve the current 423 placements and staff workflow while adding network support.

## Important gaps to close

The existing implementation is a publisher-controlled ad rotator, not yet a complete advertising business platform.

- Ad rows are not yet demonstrably edition-scoped.
- The browser script contains a hard-coded 423 Supabase project URL and public key.
- There is no verified end-to-end inventory of which English and Spanish routes load the ad script.
- The current ad schema does not provide a full advertiser, campaign, package, order, invoice, payment, or contract model.
- No trustworthy impression/click reporting pipeline or advertiser-facing performance dashboard was identified in the inspected files.
- There is no self-service advertiser account/approval workflow.
- No billing or payment integration is authorized for this work.
- Existing video-break settings are not yet proven to be consistently scoped per edition.
- No production migration or live behavior was verified during this repository review.

## Target architecture

### Edition isolation

Every advertising record must belong to an explicit `edition_id` (for example, `423` or `808`). Each regional deployment must resolve its edition from trusted server/deployment configuration, never from an advertiser-supplied query parameter.

Recommended first deployment model: keep each edition's advertising records in that edition's separate Supabase project, consistent with the regional platform blueprint. Include `edition_id` in the shared schema and reporting contracts as defense-in-depth and to support later consolidated network reporting.

Do not copy 423.news advertiser records, private campaign information, customer data, or payment information into 808.news.

### Core data model

Introduce versioned migrations for these concepts, designed so existing `news_ads` can be migrated safely:

- `ad_advertisers`: business/organization profile, contact and approval status.
- `ad_campaigns`: advertiser, edition, campaign name, objective, status, start/end, approval and internal notes.
- `ad_creatives`: image/video assets, destination URL, alt text, disclosure label, creative approval state.
- `ad_placements`: edition-specific inventory key, page/section targeting, dimensions, format and availability.
- `ad_orders`: sold package, price, currency, service period, insertion-order/contract reference and fulfillment status.
- `ad_delivery_events`: privacy-minimized impression and click events, deduplication key, timestamp, edition, campaign, creative and placement.
- `ad_daily_metrics`: server-side aggregated counts for reporting; do not expose raw visitor identifiers to advertisers.
- `ad_packages`: configurable products such as island/county sponsorship, section sponsor, featured business, and display inventory.

Use foreign keys, indexes, constraints, retention rules, and RLS policies. Keep payment credentials out of the database and never store card numbers. Do not mark an order paid based solely on a browser callback.

### Delivery and measurement

- Render only approved, active, date-valid campaigns for the current edition and placement.
- Clearly label paid placements as **Advertisement** or **Sponsored**; distinguish editorial coverage from paid promotion.
- Track valid impressions and clicks through a controlled endpoint with basic bot filtering, deduplication, rate limits, and server-side validation.
- Avoid collecting names, precise location, or cross-site identifiers for ad measurement.
- Report delivery totals and click-through rates to staff; expose only the advertiser's own campaign metrics to advertiser accounts.
- Make empty inventory fail gracefully without breaking article pages or app navigation.
- Keep ad delivery independent of Claudia and the newsroom pipeline.

### Advertiser workflow

1. Business submits an advertiser inquiry or staff creates the account.
2. Staff reviews the business and campaign.
3. Advertiser selects or is assigned a package and provides creative assets.
4. Staff approves creative, destination URL, disclosures, dates and placement.
5. Campaign goes live only after approval and confirmed order status.
6. Advertiser receives a campaign report; staff retains audit history.

Start with staff-managed sales and reporting. Self-service account creation and automated payments are later phases, not prerequisites.

### Initial packages to test

These are proposed pilot products, not published rate commitments:

- Local display placement.
- Sponsored section or topic.
- Featured local business profile.
- Newsletter or video sponsorship.
- Regional or island-wide sponsorship bundle.

Pricing should be tested with actual local advertiser conversations and delivery data. Do not promise a fixed audience, impression volume, or revenue outcome.

## Rollout phases

### Phase 0 — Audit and protect (this PR)

- Document the existing 423 ad implementation and its gaps.
- Keep this work on a preview branch.
- Do not modify production data or enable new ad placements.

### Phase 1 — Shared schema and edition-aware delivery

- Design backward-compatible migrations.
- Add edition configuration and placement registry.
- Migrate existing 423 ad records without changing their behavior.
- Add automated checks for all intended English/Spanish routes.
- Add an 808 configuration with no copied 423 advertiser data.

### Phase 2 — Campaign operations and reporting

- Staff advertiser/campaign management.
- Approval, disclosure, scheduling, pause/resume and audit history.
- Privacy-minimized impression/click events and aggregated reports.
- Reporting tests for edition isolation and campaign ownership.

### Phase 3 — Sales and advertiser experience

- Public advertiser inquiry flow.
- Package catalog and media specifications.
- Advertiser dashboard limited to their own campaigns.
- Optional billing integration only after separate approval and provider selection.

### Phase 4 — Network reporting

- Network-level aggregate view for authorized owner/admin users.
- Per-edition revenue and campaign reporting.
- No cross-edition access to individual advertiser or user records unless explicitly authorized and necessary.

## Acceptance criteria

- 423.news existing ad slots and admin controls continue to work.
- 808.news can run ads using its own configuration and database, without reading 423 private data.
- Campaigns cannot appear on another edition due to a missing or spoofed edition identifier.
- Paid placements are visibly disclosed and cannot be confused with newsroom coverage.
- Impression/click reports are reproducible from validated event records and aggregate correctly.
- Advertisers cannot see another advertiser's campaigns, invoices, or metrics.
- Ads failing to load do not break the news product.
- No production deployment, payment activation, or live campaign change occurs without explicit approval.

## Non-goals for this phase

- No merge or deployment.
- No production database migration.
- No automatic signup or billing activation.
- No third-party ad-network account creation.
- No changes to Claudia, OpenAI, Deepgram, Inworld, newsroom publishing, or regional source ingestion.
- No promise that illustrative RPM or sponsorship examples are achievable rates.
