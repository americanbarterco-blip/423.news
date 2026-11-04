# Start here — working on the existing 423.news site

You already have the repository and the live Supabase project. Do not create a new repository or upload a separate Claudia package.

## 1. Keep production safe

- Production branch: `main`.
- Review branch: `review/claudia-updates-safe`.
- Pull request: https://github.com/americanbarterco-blip/423.news/pull/1
- Compare: https://github.com/americanbarterco-blip/423.news/compare/main...review/claudia-updates-safe

The review branch is separate. Nothing is merged or deployed by this review process.

## 2. Check the work

Open the pull request and wait for the `423.news checks` workflow. It checks Python syntax, unit tests, root JavaScript, and inline JavaScript in the HTML pages.

Read `CLAUDIA-UPDATE-REVIEW.md` for the changes and the dependencies that still need external setup.

## 3. Understand the existing backend

The existing Supabase project already has the 423.news tables, RLS policies, storage buckets, Edge Functions, and active database schedules. The Claudia desk, sports sync, and weather push jobs were succeeding during the latest read-only check.

Do not paste service-role keys, admin passwords, Broadcastify account details, Anthropic keys, or LiveKit secrets into a chat or commit them to GitHub.

## 4. Decide before production

After the checks are green, review the branch diff. Merge only when you explicitly approve. The existing production host should deploy from its already configured branch; no DNS or hosting changes are part of this work.
