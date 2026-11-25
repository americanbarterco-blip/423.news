# Claudia Green — isolated direct-provider preview

This directory is a separate LiveKit agent build for testing the direct OpenAI, Deepgram, and Inworld providers.

- Dispatch name: `claudia-green-preview`
- Region: `us-east`
- OpenAI Responses API: `gpt-4.1-mini`
- Deepgram STT: `nova-3`, multilingual mode
- Inworld TTS: `inworld-tts-2`, voice `Ashley`

This directory intentionally has no `livekit.toml` yet. The manual preview workflow creates a new LiveKit agent and opens a pull request containing its newly generated configuration. Merge that configuration-only pull request into `preview/claudia-direct-provider-migration` before using the workflow's `deploy` operation.

Required repository Actions secrets:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `INWORLD_API_KEY`

The workflow passes provider keys directly to the newly created preview agent. The Inworld credential must be used exactly as generated; it is already Base64 encoded.

Safety:
- Do not run the existing production LiveKit deployment workflows for this preview.
- Do not copy the production `livekit-agent/livekit.toml` into this directory.
- The preview dispatch name is different from production's `claudia-green`.
- This workflow is manual-only and never changes the website token Worker or public website dispatch.
