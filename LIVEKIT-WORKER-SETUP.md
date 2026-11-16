# LiveKit token endpoint (Cloudflare Worker)

The Worker now serves `GET /api/livekit-token` directly from `_worker.js`. This repository is deployed as a Cloudflare Worker with an Assets binding (see `wrangler.jsonc`), not as a Pages Functions project, so a `functions/api/` directory would not be picked up by the current deployment.

## Required Worker settings

In Cloudflare Dashboard → Workers & Pages → **423-news** → Settings → Variables and Secrets, add:

| Name | Type | Value |
|---|---|---|
| `LIVEKIT_URL` | Variable | Your LiveKit server URL, e.g. `wss://your-project.livekit.cloud` |
| `LIVEKIT_API_KEY` | Secret | API key from the LiveKit project |
| `LIVEKIT_API_SECRET` | Secret | API secret from the LiveKit project |
| `EDITOR_KEY` | Secret | A long, random editor-only key |

Set the values for the environment used by the preview deployment first. Add the same values to production only after the preview has been verified. Never put the API secret or editor key in browser code, Git, or a public issue.

## Endpoint behavior

- `?role=listener`: returns a short-lived (30-minute) room token with subscribe permission and no publish permission.
- `?role=publisher`: requires the `x-editor-key` header to match `EDITOR_KEY`; returns a short-lived token with publish permission.
- `?role=probe`: checks LiveKit room participants and returns `{ "live": true|false }`.
- Unknown roles and invalid room names are rejected. Missing LiveKit settings return HTTP 501; a missing/incorrect editor key returns HTTP 401.

The endpoint never returns the LiveKit API secret. The scanner audio feed is not relayed or rebroadcast.

## Preview verification

After setting the Worker variables/secrets and the preview deployment updates, test:

```sh
curl -i 'https://YOUR-PREVIEW-HOST/api/livekit-token?role=probe&room=claudia-desk'
curl -i 'https://YOUR-PREVIEW-HOST/api/livekit-token?role=listener&room=claudia-desk'
curl -i 'https://YOUR-PREVIEW-HOST/api/livekit-token?role=publisher&room=claudia-desk'
```

Expected: probe returns HTTP 200 with a live boolean; listener returns HTTP 200 with a token and URL; publisher without the header returns HTTP 401. Only test the publisher with the editor key from a secure local terminal. Then test Listen and Desk mic in the preview browser.

Do not merge to production until all three endpoint checks and the browser audio test pass.
