# Deploying the existing 423.news site

This repository is already the source for 423.news. Do not create a replacement repository, upload a separate Claudia demo bundle, or move the production domain as part of a code review.

## Production layout

- The static site root is the repository root; `index.html` must remain at the root.
- The site uses the existing Supabase project for authentication, posts, comments, scanner reports, scores, streams, and realtime updates.
- Existing Supabase Edge Functions and database schedules are already active. This branch does not redeploy them or change their schedules.
- GitHub Actions contains checkpoint automation and the review-branch validation workflow. The Claudia scanner status workflow is optional and needs the two Supabase secrets described below.

## Safe deployment procedure

1. Review changes on `review/claudia-updates-safe`.
2. Wait for the `423.news checks` GitHub Actions workflow to finish.
3. Compare the branch with `main` and confirm the changes.
4. Merge only after the user explicitly approves.
5. Let the repository's existing production host/deployment integration publish the approved `main` commit. Do not change DNS, Pages settings, custom domains, or environment variables during this code review.

The current live host could not be independently verified from the public web fetcher during this review. Preserve the host already configured for `423.news`.

## GitHub Actions secrets

For the optional Claudia scanner status sync, add these in repository Settings → Secrets and variables → Actions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` — service-role key, never browser code.

The workflow skips the Supabase sync if either secret is missing. The NWS/RSS desk automation is already running from Supabase database schedules; do not add a duplicate NWS importer.

## Optional scanner audio

The scanner scripts can poll public Broadcastify page status without an audio credential. Automatic audio capture requires an authorized stream URL or mount and FFmpeg on a persistent worker. GitHub's short-lived scheduled runners are not a substitute for a continuously running audio listener.

## Optional live voice room

The Claudia page currently references `/api/livekit-token`. A matching route and LiveKit credentials must exist on the deployed host before the live audio room can work. Do not mark the room ready merely because the front-end button is present.

## Rollback

If an approved deployment has a problem, revert the deployment commit or restore the last known-good `main` checkpoint. Do not edit the Supabase schema or reset user data as a rollback method.
