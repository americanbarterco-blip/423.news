# Claudia Green LiveKit voice integration

This is a staged 423.news integration. It adds a homepage voice-chat button, a private token-issuing API, and a LiveKit Agents worker.

## What is included

- `claudia-livekit.js`: browser widget. It requests a short-lived room token and publishes microphone audio.
- `livekit-token/`: Node token service. The LiveKit API secret is read only from server environment variables.
- `livekit-agent/`: Python LiveKit Agent named `claudia-green`.
- `render.yaml`: Render Blueprint for the token web service and agent worker.

## Required Render environment variables

Set these privately on **both** Render services:

- `LIVEKIT_URL` = `wss://project-423-rent-371z3vas.livekit.cloud`
- `LIVEKIT_API_KEY` = the LiveKit API key
- `LIVEKIT_API_SECRET` = the LiveKit API secret

Never put the API secret in GitHub, browser JavaScript, Cloudflare public variables, or a chat message.

The token service health check is `/health`; the token endpoint is `POST /getToken`.

## Important before deployment

The Blueprint currently selects Render Starter plans for the web service and worker. These are paid resources. Do not apply the Blueprint until the owner has reviewed the current Render pricing and explicitly approved the recurring cost. No Render service is created by opening this pull request.

The token service URL in `claudia-livekit.js` assumes Render assigns
`https://423-news-claudia-token.onrender.com`. Confirm the actual service URL after provisioning and update the constant if Render assigns a different hostname.

## Current capability and newsroom safeguards

This first version provides a real-time voice conversation. It does **not** yet read the 423.news Supabase database or live Scanner Wire feed. Claudia is instructed not to invent current incidents, scanner calls, forecasts, traffic conditions, scores, or reports. A later, separately reviewed change can connect approved published content using read-only, least-privilege access.

The widget is currently added to the English homepage. It requires HTTPS and the visitor's microphone permission. The Spanish page and Claudia Live Wire page are not yet wired to this widget.

## Testing checklist

1. Configure the three environment variables on both Render services.
2. Deploy the Blueprint only after approving the recurring cost.
3. Confirm `GET /health` returns `{ "ok": true }`.
4. Confirm the LiveKit agent worker is connected and named `claudia-green`.
5. Visit the homepage over HTTPS, start a voice session, and confirm audio flows both ways.
6. Test the browser permission-denied and service-unavailable states.
7. Do not merge to production until the preview has passed these checks.
