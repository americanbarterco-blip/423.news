# Claudia scanner policy

This is the desk's conservative policy for material sourced from public dispatch audio. It is not legal advice. Feed-provider terms and local law take precedence.

## Listening and recording

- Use only public feeds and access methods authorized by the feed provider.
- Short recordings are for verification and transcription only when permitted.
- Never rebroadcast or embed Broadcastify scanner audio.
- Do not bypass logins, paywalls, access controls, or provider terms.
- If a provider's terms prohibit a use, that use does not happen.

## Publishing

- Dispatch audio is not an official incident confirmation.
- Scanner-sourced reports must be clearly marked unconfirmed/developing until corroborated by an independent public source.
- Use original wording. Do not publish verbatim transcripts or extended quotations.
- Remove personal names, street numbers, phone numbers, vehicle plates, dates of birth, and unnecessary medical details.
- Avoid speculation, guilt claims, motive, and unsupported outcomes.
- Include practical public-safety information and state what is not yet known.
- A human editor must review scanner drafts. Scanner auto-publishing remains disabled in the current Supabase settings.

## Local tools

The repository's scanner helpers are at the root:

- `listen.py` — open and capture only from an authorized configured stream.
- `paraphrase.py` — redact, check, and build a report draft.
- `claudia.py` — status, watch, ingest, and file local reports.

Use `CLAUDIA-SETUP.md` for the actual flat-layout configuration. Do not use the old `scanner/` or `data/` paths from earlier package documentation.
