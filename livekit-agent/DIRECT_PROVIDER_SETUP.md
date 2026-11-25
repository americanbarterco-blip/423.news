# Claudia Green — direct provider setup

This preview replaces LiveKit Inference with the existing direct providers while keeping the same models and voice:

- OpenAI Responses API: `gpt-4.1-mini`
- Deepgram STT: `nova-3`, multilingual mode
- Inworld TTS: `inworld-tts-2`, voice `Ashley`

## Required LiveKit Agent secrets

Before deploying this preview, add these secrets to the `claudia-green` agent in LiveKit Cloud:

| Secret name | Value |
| --- | --- |
| `OPENAI_API_KEY` | API key from the owner's OpenAI API account |
| `DEEPGRAM_API_KEY` | API key from the owner's Deepgram account |
| `INWORLD_API_KEY` | Base64-encoded API key from the owner's Inworld account |

Do not commit keys to GitHub or paste them into chat. Add them only in the LiveKit Agent Secrets interface.

## Important deployment sequence

1. Create or confirm billing-enabled API access with each provider.
2. Add all three secrets to a separate preview agent/deployment configuration.
3. Deploy this branch to the preview agent, not the production `claudia-green` agent.
4. Test the automatic greeting, English and Spanish speech recognition, turn-taking, interruptions, and Ashley voice playback.
5. Review provider usage and cost limits.
6. Only merge and promote after the owner approves the preview.

The source change does not alter the website token Worker, room dispatch, frontend, Claudia's tools, or her instructions. It does not deploy or change production by itself.
