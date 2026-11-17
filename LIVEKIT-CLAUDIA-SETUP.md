# Claudia Green — Cloudflare + LiveKit deployment

This branch stages the 423.news voice assistant. The web token endpoint is designed for **Cloudflare Workers**; the real-time voice agent runs on **LiveKit Cloud**. Cloudflare Workers are not the right runtime for the persistent LiveKit Agents worker process.

## Architecture

- 423.news website: Cloudflare Pages / existing Cloudflare hosting.
- Token endpoint: Cloudflare Worker at `https://voice-api.423.news/getToken`.
- Realtime media and rooms: your existing LiveKit Cloud project.
- Claudia agent: deployed to LiveKit Cloud using the LiveKit CLI.

## Cloudflare Worker setup

From the `livekit-token` folder:

```sh
npm install
npx wrangler login
npx wrangler deploy
```

In Cloudflare Dashboard → Workers & Pages → `423-news-claudia-token` → Settings → Variables and Secrets, add these as **encrypted secrets**:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

The LiveKit URL is already set as a non-secret Worker variable in `wrangler.toml`. Do not expose the API secret in GitHub or browser code.

Create the DNS/custom domain `voice-api.423.news` for this Worker (the Wrangler config requests this custom domain). Cloudflare may ask you to confirm DNS setup.

## LiveKit agent setup

The Python agent in `livekit-agent/` is deployed to LiveKit Cloud, not Cloudflare Workers. Follow LiveKit's current CLI workflow:

```sh
lk cloud auth
cd livekit-agent
lk agent create
```

The CLI builds and deploys the agent. Verify its status and logs in the LiveKit Cloud dashboard or with `lk agent status` and `lk agent logs`.

## Current limitations before launch

- The voice widget is staged on the English homepage only.
- The agent has not yet been deployed or tested.
- The agent currently has no verified connection to the 423.news Supabase database or live Scanner Wire feed. It must not claim to know live incidents, weather, traffic, or scores.
- The widget needs microphone permission and HTTPS.
- Test the Worker health endpoint at `/health`, then test a complete two-way voice session before merging.
