# Broadcastify private pilot — 423.news

This integration is for a private editor-only newsroom workflow. It is not a public scanner,
audio player, or audio relay. The endpoint returns metadata/call records only and is on-demand;
there is no scheduled polling.

## Files and deployment

- Cloudflare Pages Function: `functions/api/broadcastify.js`
- Route: `GET /api/broadcastify?action=health`
- Keep all work on `feature/broadcastify-live-calls` until tested.

The Pages project must use the repository root as its build output directory, with
`functions/` alongside `index.html`. The checked-in `wrangler.jsonc` already serves
the repository root as static assets. Confirm that the Cloudflare project is configured
as Pages (not a static-only upload) and that Pages Functions are enabled for this repo.

## Cloudflare secrets

In **Workers & Pages → 423-news → Settings → Variables and Secrets**, add these as
encrypted **Secrets**, not plaintext variables:

| Secret name | Value |
|---|---|
| `BCFY_API_SECRET` | Signing secret shown once when the active Broadcastify API key was created |
| `BCFY_KEY_ID` | `abb72b6` |
| `BCFY_APP_ID` | `6af4f3c210049` |
| `BCFY_USERNAME` | Broadcastify account username |
| `BCFY_PASSWORD` | Broadcastify account password |
| `BCFY_EDITOR_KEY` | A new, long random private key used only by the newsroom |

Do not put any of these in browser JavaScript, GitHub files, public Supabase settings, or chat.
Do not use the disabled key `5bac511`.

## Test sequence

1. Deploy this branch to a Cloudflare preview URL only.
2. Add the six secrets to the **Preview** environment first. Do not add them to Production yet.
3. Send a request to `/api/broadcastify?action=health` with header
   `x-423-editor-key: <BCFY_EDITOR_KEY>`. It should return `ok: true`.
4. Obtain the correct Broadcastify Calls county ID (`ctid`) for Bradley County from the
   Broadcastify Calls county listing. Do not guess the ID.
5. Request `/api/broadcastify?action=groups&ctid=<CTID>` with the same header. This lists
   recent talkgroup metadata for the county.
6. Select only the relevant test group IDs, then request
   `/api/broadcastify?action=live&groups=<GROUP_ID>`. Keep this as a manual, one-shot test.

## Important limits

- The Live Calls endpoint must not be polled more often than once every 5 seconds.
- This first implementation deliberately does not auto-poll or run a background loop.
- Calls are billed by records returned, not by request count. Keep the pilot narrow.
- This first version obtains a Broadcastify user token on each on-demand request. Do not
  put it on an automatic 5-second polling loop; a later polling implementation should use
  a carefully managed server-side token cache (for example, a Cloudflare KV binding).
- Never expose raw Broadcastify audio, stream URLs, API credentials, or this private endpoint
  to public visitors. Human editorial review is required before any scanner-derived report
  is published.
- Do not send Broadcastify audio to LiveKit or create a public listener feature without
  confirming the applicable licensing terms.
