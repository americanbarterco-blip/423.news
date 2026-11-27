# Claudia scanner bridge

`claudia.py` reads its local configuration from `scanner/config.json`. Start by copying `scanner/config.example.json` to that local, untracked path.

Each feed entry must be an authorized Broadcastify feed and should contain:

- `name`: newsroom display name
- `feed_id`: provider feed ID
- `page_url`: public feed page URL
- `stream_url`: provider-authorized audio stream URL, kept only in the local config or a protected secret store
- `priority` and `tags`: optional newsroom classification

Set `BROADCASTIFY_API_KEY` and, if supplied by the account, `BROADCASTIFY_STATUS_ENDPOINT` as environment secrets. Never commit `scanner/config.json`, feed stream URLs, or API keys.

Run `python claudia.py doctor` and `python claudia.py status` after configuration. A status row or listener count does not prove that audio capture works. Test an authorized feed with `python claudia.py capture --feed "FEED NAME" --seconds 30` and verify the resulting segment before treating the feed as connected.

Audio segments are separate from the LiveKit user microphone. This bridge does not automatically publish or rebroadcast provider audio. Transcripts and scanner-derived tips must remain unconfirmed until independently corroborated; do not publish raw audio, raw transcripts, sensitive identifiers, or dispatch-only details.

The repository intentionally contains no real feed IDs or stream URLs. Configure only feeds that the account is authorized to access.
