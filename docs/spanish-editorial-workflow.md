# Spanish editorial workflow

This branch adds a human-reviewed Spanish translation workflow for 423.news.

## Scope

- Published `news_posts` in the news, community, sports, schools, outdoors, and government sections.
- Upcoming `events`.
- Published sports headlines in `news_headlines`.
- Claudia Green / scanner research is intentionally excluded. Scanner leads remain private research until separately verified and edited under the existing policy.

## Editorial states

1. **Untranslated** — source content has no Spanish translation.
2. **Pending review** — an editor saved a Spanish draft.
3. **Approved** — an editor explicitly approved it; only this state is readable by public Spanish pages.
4. **Stale** — source content changed after the translation was saved. The editor must translate the current source and save again before approval.

Saving never publishes. Approval is a separate action and the server rechecks that the English source still matches the saved source snapshot.

## Files

- `supabase/migrations/20261114000000_news_translations.sql` creates the translation table and grants public read access only to approved Spanish records.
- `supabase/functions/admin/index.ts` adds authenticated admin actions for queue, save, and approval. It uses the existing admin session token and service-role key on the server.
- `translation-admin.html` is the staff translation desk, linked from the existing admin page.
- `es/noticias.html`, `es/comunidad.html`, `es/eventos.html`, and `es/deportes.html` display approved Spanish translations and otherwise identify the original-language content.

## Deployment order (not performed by this branch)

1. Review and apply the SQL migration to the existing Supabase project.
2. Deploy the updated `admin` Edge Function from `supabase/functions/admin/index.ts`.
3. Deploy the site branch / merge the PR after approval.
4. Test admin login, saving a draft, stale-source rejection, explicit approval, and public rendering in all four Spanish sections.

No Supabase migration or Edge Function deployment has been run as part of this preview. No Google Cloud Translation calls, API keys, billing activation, or paid services are included. The workflow has no translation-provider cost; translations are entered by a human editor.
