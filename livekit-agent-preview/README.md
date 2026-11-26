# Claudia Green — isolated local-brain preview

This directory is a separate LiveKit agent build for testing Claudia's deterministic, in-code conversation router.

- Dispatch name: `claudia-green-preview`
- Region: `us-east`
- Conversation logic: local Python intent routing; no hosted LLM or LLM API key
- Deepgram STT: `nova-3`, multilingual mode
- Inworld TTS: `inworld-tts-2`, voice `Ashley`

Claudia recognizes a defined set of intents and routes them to existing 423.news services: published headlines, local weather and official NWS alerts, TomTom traffic snapshots, published road alerts, sports scores, scanner configuration metadata, public-source research leads, and public-site health. Greetings and common capability questions are answered locally. Unrecognized questions receive an honest prompt to use a supported request.

This is not an open-ended generative language model. Its response quality and intent coverage depend on the rules in `agent.py`; new capabilities must be deliberately implemented and tested. Public research results remain unverified leads, scanner configuration is not proof of live audio, and a zero-incident traffic result does not prove roads are clear.

## Required repository Actions secrets

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `DEEPGRAM_API_KEY`
- `INWORLD_API_KEY`

The preview workflow passes only the speech-provider credentials to the separate preview agent. No OpenAI or Google LLM key is used.

**Cost and availability:** This removes per-turn LLM API usage. Deepgram, Inworld, LiveKit hosting, and external data services may still have free-tier limits, metering, or charges. It is not a guarantee of unlimited free operation.

## Safety

- Do not run the existing production LiveKit deployment workflows for this preview.
- Do not copy the production `livekit-agent/livekit.toml` into this directory.
- The preview dispatch name is different from production's `claudia-green`.
- This workflow is manual-only and never changes the website token Worker or public website dispatch.
