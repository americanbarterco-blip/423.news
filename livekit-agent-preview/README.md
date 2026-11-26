# Claudia Green — isolated direct-provider preview

This directory is a separate LiveKit agent build for testing Claudia with Google Gemini's Developer API free tier.

- Dispatch name: `claudia-green-preview`
- Region: `us-east`
- LLM: Gemini Developer API, `gemini-3.5-flash` (free tier where available)
- Deepgram STT: `nova-3`, multilingual mode
- Inworld TTS: `inworld-tts-2`, voice `Ashley`

The LLM no longer depends on an OpenAI API key or OpenAI API credits. Create a Google AI Studio API key and configure it as `GOOGLE_API_KEY` in both the LiveKit preview agent Secrets and the GitHub Actions repository secrets.

**Free-tier limitation:** Google applies model, project, and rate limits. This avoids OpenAI charges but does not provide unlimited requests or guaranteed uptime. Keep the Google project on its free tier and do not enable paid billing if a hard $0 ceiling is required. Google states that free-tier content may be used to improve its products; do not send sensitive/private user data through this model.

Required repository Actions secrets:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GOOGLE_API_KEY`
- `DEEPGRAM_API_KEY`
- `INWORLD_API_KEY`

The workflow passes provider keys to the separate preview agent only.

Safety:
- Do not run the existing production LiveKit deployment workflows for this preview.
- Do not copy the production `livekit-agent/livekit.toml` into this directory.
- The preview dispatch name is different from production's `claudia-green`.
- This workflow is manual-only and never changes the website token Worker or public website dispatch.
