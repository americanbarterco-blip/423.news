# Broadcastify private pilot — 423.news

This integration is for a private editor-only newsroom workflow. It is not a public scanner,
audio player, or audio relay. The endpoint returns call metadata only and is on-demand;
there is no scheduled polling.

## Files and deployment

- Worker entrypoint: `worker.js`
- Private API handler: `functions/api/broadcastify.js`
- Route: `GET /api/broadcastify?action=health`
- Static files are served through the `ASSETS` binding; `/api/*` is routed through the Worker.
- Keep all work on `feature/broadcastify-live-calls` until tested.

This repository is deployed as a Cloudflare Worker with static assets, not a Pages project.
`wrangler.jsonc` sets `main: worker.js`, binds static assets as `ASSETS`, and routes `/api/*`
through the Worker before falling back to the site's static files.

## Cloudflare preview variables and secrets

Set these only in the **Preview** environment first:

| Name | Type | Value |
|---|---|---|
| `SUPABASE_ADMIN_FUNCTION_URL` | Variable | `https://kdiwehqtezlhecxsoysj.supabase.co/functions/v1/admin` |
| `BCFY_API_SECRET` | Encrypted Secret | Signing secret shown once when the active Broadcastify API key was created |
| `BCFY_KEY_ID` | Variable | `abb72b6` |
| `BCFY_APP_ID` | Variable | `6af4f3c210049` |
| `BCFY_USERNAME` | Encrypted Secret | Broadcastify account username |
| `BCFY_PASSWORD` | Encrypted Secret | Broadcastify account password |

The bridge validates the existing newsroom admin session by calling the existing Supabase
admin Edge Function's authenticated `tables` action. It does not need a second editor
password, a static editor key, or the Supabase service-role key in Cloudflare.

The browser must send the existing admin session token in an
`Authorization: Bearer <session-token>` header when calling `/api/broadcastify`.
Never hard-code that token. The token is held in the admin page's session storage and
expires after 12 hours.

Do not put Broadcastify credentials in browser JavaScript, GitHub files, public Supabase
settings, or chat. Do not use the disabled API key `5bac511`.

## Test sequence

1. Deploy this branch to a Cloudflare preview URL only.
2. Add the variables/secrets above to the **Preview** environment, not Production.
3. From an authenticated admin session, request
   `/api/broadcastify?action=health` with the admin session bearer token. It should return
   `ok: true`.
4. Obtain the correct Broadcastify Calls county ID (`ctid`) for Bradley County from the
   Broadcastify Calls county listing. Do not guess the ID.
5. Request `/api/broadcastify?action=groups&ctid=<CTID>` with the same bearer token.
6. Select only the relevant test group IDs, then request
   `/api/broadcastify?action=live&groups=<GROUP_ID>`. Keep this as a manual, one-shot test.

## Important limits

- The Live Calls endpoint must not be polled more often than once every 5 seconds.
- This first implementation deliberately does not auto-poll or run a background loop.
- Calls are billed by records returned, not by request count. Keep the pilot narrow.
- This first version obtains a Broadcastify user token on each on-demand request. Do not
  put it on an automatic polling loop; a later polling implementation should use a
  carefully managed server-side token cache.
- Never expose raw Broadcastify audio, stream URLs, API credentials, or this private endpoint
  to public visitors. Human editorial review is required before any scanner-derived report
  is published.
- Do not send Broadcastify audio to LiveKit or create a public listener feature without
  confirming the applicable licensing terms.
