# Claudia voice features

The public site uses `claudia-voice.js` for browser-based speech synthesis. It reads published, recent reports from the local fallback feed and speaks them when a visitor chooses the voice control. Browsers without SpeechSynthesis support should show an unavailable message rather than pretend audio is playing.

The live audio-room code is separate and lives in `claudia-scanner.html`. It references a `/api/livekit-token` endpoint and a LiveKit room URL. The repository does not include that token endpoint, and the LiveKit URL is currently blank in the page configuration. The room is not ready until the endpoint is deployed and the required LiveKit API credentials are configured securely on the server.

Do not use a browser-exposed LiveKit API secret. Never rebroadcast Broadcastify scanner audio. Only Claudia's own approved voice may be sent to a LiveKit room.
