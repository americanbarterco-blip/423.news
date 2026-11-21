# Claudia staged-media review console

This adds a service-role-only CLI for reviewing privately staged media records.

## List staged media
```sh
python scripts/claudia_media_review.py list --limit 30
```

## Mark a media record approved or rejected
```sh
python scripts/claudia_media_review.py review MEDIA_UUID --status approved
python scripts/claudia_media_review.py review MEDIA_UUID --status rejected
```

Approval records an editor decision only. It does **not** expose the private object,
make it public, or attach it to an article. Before approval, check the source,
rights/permission basis, creator credit, caption, image alt text, and relevance.
Only staged records can be reviewed; approved/rejected records cannot be silently
re-reviewed by this CLI.

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Use the service role
only in a trusted environment; never expose it in a browser or commit secrets.
