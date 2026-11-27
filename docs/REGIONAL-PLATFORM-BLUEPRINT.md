# Regional Platform Blueprint: 423.news → 808.news

**Status:** Architecture proposal; documentation only  
**Master reference:** 423.news  
**First regional expansion:** 808.news (Hawaiʻi)  
**Production changes:** None authorized by this document

## 1. Product model

423.news is the reference implementation for a repeatable network of regional news editions. A new edition should reuse the same application capabilities and operating model while receiving its own regional identity, coverage configuration, source network, editorial priorities, content, and operational credentials.

The goal is **shared platform, independent regional editions**—not a single blended newsroom and not separately hand-built websites.

## 2. Shared platform capabilities

The following capabilities should remain common and improve centrally:

- Public website shell, navigation, responsive layouts, accessibility, and core design system.
- News, article pages, search, comments, accounts, community, classifieds, events, sports, schools, outdoors, government, and reader submissions.
- Claudia newsroom software: discovery, intake, research, evidence capture, drafting, publishing orchestration, monitoring, and operational health.
- Scanner/incident interface components and adapters where a region has suitable public sources.
- English/Spanish localization framework and translation workflow.
- SEO foundations, structured metadata, sitemap generation, RSS, notifications, and deployment automation.
- Common security controls, authentication patterns, auditability, observability, and automated tests.

Shared code must not imply shared regional records or shared regional secrets.

## 3. Regional configuration

Each edition must have an explicit, version-controlled regional configuration. Proposed fields:

- `edition_id` (stable identifier, e.g. `423`, `808`)
- `domain` and public brand name
- `timezone`, locale defaults, and supported languages
- Geographic coverage hierarchy: state/territory, islands/counties, cities, communities
- Coverage priorities (ranking, never an exclusion list)
- Approved/public source registry with source type, geography, URL, access method, and last-checked metadata
- Public safety and scanner integrations actually available in that region
- Regional sports, schools, government, weather, transport, agriculture, business, and community source groups
- Region-specific SEO titles, descriptions, canonical host, and social metadata
- Regional Claudia identity/context settings and operational contact details

A priority score changes discovery emphasis only. It must never silently blacklist a place, topic, source, or story.

## 4. Regional data and tenant isolation

Each edition must have independently scoped:

- Published articles and Claudia wire reports
- Leads, evidence, research tasks, drafts, media staging, and publishing queues
- Source inventory, coverage priorities, and regional Claudia memories
- Scanner tips, incident records, reader flags, community posts, classifieds, events, and comments
- Regional user-facing settings, notifications, and analytics

**Preferred initial safety posture:** use separate Supabase projects (or otherwise demonstrably isolated database/storage/auth environments) for each public edition. This is the simplest boundary to reason about for the first expansion. A shared multi-tenant database is a possible later optimization only after explicit tenant keys, row-level security, storage policies, service-role boundaries, background-job scoping, and cross-tenant negative tests are designed and reviewed.

Never copy production credentials, user records, private memories, drafts, or unpublished media from 423 into 808. Bootstrap 808 with schema/migrations and public configuration only.

## 5. Claudia: shared engine, separate regional newsroom

Claudia's reusable software and operational patterns should be shared. Her regional working context must not be shared by default.

For every edition, isolate:

- Coverage geography and priority settings
- Source registry and source health
- Discovery cursors and ingestion history
- Leads, research tasks, evidence, drafts, and publication history
- Long-term regional memories and learned source context
- Scanner/incident connectors and credentials
- Provider credentials, rate limits, usage budgets, and health status where independently provisioned

Preserve the currently configured 423.news provider arrangement (including OpenAI, Deepgram, and Inworld where configured). This blueprint does not authorize provider migration, replacement, or removal. Confirm actual deployed provider wiring before cloning or changing it.

All ingested leads remain eligible for consideration. Regional priorities guide attention, not eligibility. Do not create county, island, topic, or sensitivity blacklists. Keep source attribution and distinguish confirmed facts from developing, unverified, or conflicting details. Apply privacy protections to specific details where warranted without excluding entire beats.

## 6. 423.news master edition

423.news remains the first production edition and the reference for feature behavior. Its current coverage priorities remain:

1. Bradley and Polk counties — tied highest priority
2. Hamilton County — strong second priority
3. Rhea and Grundy counties — important regional coverage
4. Other relevant communities remain eligible for coverage

The 423 source registry, stories, memories, and operational data remain 423-specific.

## 7. 808.news first expansion

808.news is a Hawaiʻi statewide edition for the 808 area code, not a Honolulu-only site.

Initial geographic configuration should cover:

- Oʻahu
- Hawaiʻi Island (Big Island)
- Maui
- Kauaʻi
- Molokaʻi
- Lānaʻi
- Niʻihau when reliable, publicly available information warrants coverage

808 must receive its own source research and verification before any source is represented as active. Do not imply scanner, CAD, or live incident integrations exist until they are actually confirmed and tested. Establish island/community coverage priorities with broad statewide representation; do not let Honolulu crowd out smaller islands.

## 8. Deployment and operations

Each edition should have:

- Its own domain and DNS/Cloudflare configuration
- Its own frontend deployment and environment bindings
- Its own Supabase project, auth settings, storage buckets, and Edge Function secrets
- Its own Claudia scheduled workflows and provider credentials
- Its own sitemap, canonical host, robots policy, RSS, and monitoring
- A documented rollback target and health-check procedure

A code release may be shared, but deployment must be independently controllable. A failed 808 deployment must not affect 423, and vice versa.

## 9. Replication workflow for future area-code editions

1. Select the new edition identifier, domain, geography, and ownership/operational contacts.
2. Create a fresh regional configuration and review its coverage map.
3. Provision isolated database, auth, storage, secrets, and deployment resources.
4. Apply reviewed schema migrations; do not copy production user/content data.
5. Load and validate public regional source registry.
6. Configure a separate Claudia newsroom context and scheduled jobs.
7. Verify language parity, core product features, accessibility, SEO, and regional data isolation.
8. Run cross-edition negative tests proving 423 cannot read/write 808 data and 808 cannot read/write 423 data.
9. Run failure tests for Claudia, providers, feeds, database, and deployment.
10. Publish only after an explicit launch approval.

## 10. Acceptance criteria before 808 launch

- 808 uses the same core product capabilities as the approved 423 baseline.
- Every displayed region, source, feed, and integration is real and validated.
- No 423 stories, users, comments, leads, private memories, drafts, or secrets appear in 808.
- 808 data cannot appear in 423.
- Claudia's 808 priorities and memory are separate from 423.
- Failure of one edition does not interrupt the other.
- English and Spanish are equivalent product experiences, not reduced parallel products.
- Provider configuration is explicit and tested; no silent provider substitutions.
- Public pages remain usable when Claudia or an optional widget is unavailable.
- Rollback and operational ownership are documented.

## 11. Recommended implementation order

1. Complete the 423.news resilience and dependency work already identified.
2. Inventory the real deployed 423 configuration, providers, secrets, migrations, and scheduled jobs without exposing secret values.
3. Define and validate the regional configuration schema.
4. Refactor code to consume regional configuration only where this can be done safely and incrementally.
5. Provision a non-production 808 environment with isolated data services.
6. Build and test 808 source coverage and Claudia configuration.
7. Run feature-parity, isolation, outage, and rollback tests.
8. Review a complete preview before any production launch.

## 12. Explicit non-goals for this blueprint

This document does not create 808.news, change production routing, migrate providers, change authentication, copy data, provision cloud services, deploy database migrations, or modify the live 423.news experience. Those are separate implementation steps requiring review and approval.
