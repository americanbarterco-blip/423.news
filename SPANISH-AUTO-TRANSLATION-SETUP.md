# 423.news — Claudia Spanish Auto-Translation

This feature is isolated on the `claudia-spanish-auto-translation` branch. It does not change the production site until the branch is reviewed and merged/deployed.

## Behavior

- Cloudflare Worker cron triggers every 30 minutes.
- Each run sends up to 3 eligible items to the translation function.
- Supported source tables: `news_posts`, future `events`, and published `news_headlines`.
- Translation writes use `status=auto_published`, separate from human `approved`.
- Public Spanish pages and the dynamic sitemap recognize both statuses.
- Scanner Wire / Claudia research is excluded by source table and keyword filters.
- Human `pending_review` drafts are never overwritten.
- A source that is already Spanish is skipped; oversized or failed items are skipped/logged.
- Original English source records are never edited.

## Required secrets (after branch review)

**Supabase Edge Function secrets**
- `GEMINI_API_KEY`: API key from Google AI Studio. Verify that the account/model has an eligible no-billing free quota before enabling. Free limits can change; this is not a guaranteed $0 service.
- `SPANISH_AUTO_TRANSLATE_SECRET`: a long random shared secret.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL`: the project values used by the Edge Function.

**Cloudflare Worker secret**
- `SPANISH_AUTO_TRANSLATE_SECRET`: exactly the same random secret as in Supabase.

The scheduled Worker calls `/functions/v1/spanish-auto-translate` with the shared secret and the project's public anon key. The Edge Function authenticates the secret itself.

## Deployment order

1. Review/merge this branch.
2. Apply `supabase/migrations/20261119000000_auto_publish_spanish_translations.sql`.
3. Deploy `supabase/functions/spanish-auto-translate/index.ts` as Edge Function `spanish-auto-translate` (keep JWT verification enabled; Worker sends the anon JWT).
4. Set the Supabase secrets above.
5. Set the matching Cloudflare Worker secret.
6. Deploy the Worker. Confirm the cron is listed and inspect the first scheduled invocation logs.
7. Check `/translation-admin.html`: auto-published count should rise; Spanish articles should be visible.

## Safety / cost controls

- Batch size is 3 items per 30-minute run.
- No automatic processing runs unless both secrets are present.
- Provider quotas/limits may stop processing; failures are logged and the item is retried on later runs.
- Automated translations are published without human review. Public labels are neutral; the translation admin notes identify them as automated.
- Scanner Wire / Claudia content remains excluded.
