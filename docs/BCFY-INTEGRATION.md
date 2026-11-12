# Broadcastify API connector — 423.news

This is a private, metadata-only connector for the Broadcastify API. It is deliberately separate from the existing `claudia-scanner-ingest` function.

## Safety defaults

- The connector does not make any Broadcastify request until `BCFY_ENABLED=true`.
- Requests require a separate `x-bcfy-proxy-token` shared only by trusted server-side workers.
- Broadcastify credentials are Edge Function secrets, never browser variables or Git-tracked files.
- A fresh HS256 JWT is generated for each upstream request and expires after 15 minutes.
- Only GET requests to the four documented API endpoint families are accepted.
- Only JSON metadata responses are returned. Audio streaming, archive downloads, publishing, transcript creation, and database writes are out of scope.
- No CORS headers are enabled. Do not call this function directly from public browser code.
- Keep Broadcastify portal monthly caps at zero until an operator intentionally authorizes paid testing.

## Required Edge Function secrets

Set these in Supabase Dashboard → Edge Functions → Secrets. Do not put values in this repository.

| Secret | Meaning |
|---|---|
| `BCFY_ENABLED` | Must remain `false` until approved and paid access is intentionally activated |
| `BCFY_PROXY_TOKEN` | Random private token shared only with a trusted backend worker |
| `BCFY_APP_ID` | Application ID shown in Broadcastify Company & Apps |
| `BCFY_API_KEY_ID` | API key ID (`kid`) from the issued key definition |
| `BCFY_API_KEY_SECRET` | HMAC-SHA256 signing secret from the issued API key |

Do not set the API key ID/secret until Broadcastify issues the key and the application's entitlements and geographic scope have been confirmed.

## Deploy when ready

Deploy as a separate function named `bcfy-proxy` with Supabase JWT verification disabled because this function uses its own high-entropy server-to-server token. The function body rejects every request without `BCFY_PROXY_TOKEN`.

Example CLI command:

```bash
supabase functions deploy bcfy-proxy --no-verify-jwt
```

The current preview branch contains the function source. It has **not** been deployed to the Supabase project.

## Trusted backend request

```bash
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/bcfy-proxy' \
  -H 'content-type: application/json' \
  -H 'x-bcfy-proxy-token: <server-only-token>' \
  --data '{"path":"/feeds/v1/feeds","query":{}}'
```

The sample path is the feed-list URL shown in Broadcastify's Getting Started documentation. Calls API route names and query parameters must be taken from the specific Calls endpoint documentation before use; do not guess them.

## Activation checklist

1. Confirm the 423.news application has the intended `bcfy_calls_api` entitlement (and `bcfy_feed_api` only if the catalog is needed).
2. Confirm permitted coverage includes the actual intended 423-region use case.
3. Review the applicable Terms, especially restrictions on audio/metadata redistribution and downstream services.
4. Keep the portal monthly cap low and auto-top-off disabled.
5. Issue the API key only when ready for a deliberate, small test.
6. Configure the secrets above with `BCFY_ENABLED=false`.
7. Test the connector's disabled response and authentication rejection without making an upstream request.
8. Set `BCFY_ENABLED=true` only for an explicitly approved, budgeted test. Check the portal usage counter immediately afterward.

## Not implemented yet

- No scheduled polling or automatic ingestion.
- No call-record endpoint assumptions.
- No audio download, playback, or rebroadcast.
- No AI transcription or newsroom publication.
- No writes to existing 423.news tables.

Those features require confirmed API endpoint schemas, entitlements, licensing review, and a separate editorial design review.
