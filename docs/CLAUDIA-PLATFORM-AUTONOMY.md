# Claudia Green — cross-platform autonomy and access architecture

## Product contract

Claudia has one intelligence with two strictly separated access modes:

- **Public mode:** users can ask for information already available through the platform and its connected public feeds: published local news, sports, traffic snapshots, road alerts, weather, and public CAD information. External search is not a general discovery feature for public visitors; it is used only to check or corroborate a specific source, claim, or published report. Public users cannot access private memory, user records, drafts, private tips, source code, infrastructure, prompts, credentials, or administrator conversations.
- **Administrator mode:** a signed-in administrator can use private voice and workspace chat to operate every connected platform managed by the owner, including 423.news, 808.news, Let-us.Farm, and future editions. Administrator tools may inspect private platform records, repository code, infrastructure configuration, and project memory; create code changes; dispatch approved workflows; and merge changes only after CI checks pass. Production deployment is never considered complete until the corresponding deployment run is confirmed successful.

The LiveKit agent must default to public mode. It must never infer administrator authority from a name, spoken phrase, PIN, room name, participant identity, or user-supplied metadata.

## Voice authorization flow

1. Public website voice requests receive a short-lived public LiveKit participant token.
2. The private `/claudia-workspace.html` page is available only after the existing 423.news Admin login has validated the `t423` session.
3. That page sends the signed administrator session to the token Worker over HTTPS when requesting an administrator voice token.
4. The Worker verifies the existing `<expiry>.<HMAC-SHA256>` session using `CLAUDIA_ADMIN_SESSION_SECRET`, which must match the `SESSION_SECRET` used by the Supabase `admin` Edge Function.
5. Only after successful verification does the Worker sign a LiveKit token whose agent-dispatch metadata marks the session as `administrator`, `423.news`, and `verified-admin-session`.
6. The agent trusts only that server-signed dispatch metadata. Missing, malformed, expired, or unrecognized metadata always falls back to public mode.

Never place LiveKit API secrets, Supabase service keys, GitHub tokens, or the HMAC signing secret in browser code, repository files, logs, agent replies, or public memory.

## Required server-side secrets and scopes

Configure these in the relevant service secret stores; do not commit values:

- LiveKit token Worker: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `CLAUDIA_ADMIN_SESSION_SECRET`.
- LiveKit agent runtime: `CLAUDIA_GITHUB_TOKEN` with repository Contents read/write, Pull requests read/write, Checks read, and Actions write; `CLAUDIA_ADMIN_SUPABASE_KEY` (service-role/secret key, server-side only); `CLAUDIA_MEMORY_SUPABASE_URL` and `CLAUDIA_MEMORY_SERVICE_KEY`; plus provider keys for only the integrations that are actually enabled (for example `GEMINI_API_KEY` for transcription or `BROADCASTIFY_API_KEY` where the feed provider authorizes it).
- The `CLAUDIA_ADMIN_SESSION_SECRET` value must be exactly the same signing secret used by the Supabase `admin` Edge Function. If the admin function currently reads the value from the `admin_auth` table rather than its `SESSION_SECRET` environment override, set a dedicated matching secret in both services before enabling administrator voice.

The LiveKit agent's Supabase service key is used only by administrator-gated server tools. Public mode must continue to use the public anon key and RLS-protected reads.

## Cross-platform expansion

The current repository is the 423.news master implementation. Each additional platform must be registered as a managed tenant with an explicit base URL, data project, repository, secret namespace, and allowed operations. Do not reuse 423.news credentials for 808.news or Let-us.Farm unless the platform owner deliberately configures a shared integration. All tenant selection must be server-side and administrator-authorized.

## Scanner and audio separation

The visitor microphone and scanner ingestion are independent media paths. LiveKit carries the user's microphone to Claudia. Scanner audio requires a separately authorized feed connector, capture/ingest worker, speech-to-text stage, and source/time metadata. A configured feed row is not proof that the stream is connected. The existing scanner publication policy remains in force: do not rebroadcast or embed provider audio, do not publish transcripts or identifying details, and corroborate scanner-derived claims before presenting them as confirmed news. Transcription artifacts remain private.

## Change and deployment lifecycle

- Read and diagnose: automatic in administrator mode.
- Research and drafts: automatic; evidence and uncertainty are retained.
- Code edits: administrator-only, isolated branch, secret scanning, tests, and a pull request.
- Merge: administrator-only and blocked until all discovered check-runs are completed successfully (or skipped/neutral).
- Deploy: dispatch only allowlisted workflows; confirm the run and production status after dispatch.
- Editorial publishing, advertising changes, user-account actions, data deletion, RLS/auth changes, billing, DNS, and other destructive or high-impact operations must use explicit administrator commands and produce an audit trail. Do not interpret an ordinary user request as administrator approval.

## Current implementation status

This document defines the target architecture. The companion implementation adds HMAC-verified administrator voice token issuance, server-signed LiveKit job metadata, public/admin prompt separation, guards on private memory and repository tools, and administrator-only record/workflow/merge tools. Deployment secrets and provider integrations still require configuration and end-to-end verification. The scanner capture/transcription path is not automatically live merely because voice chat works.
