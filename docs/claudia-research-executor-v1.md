# Claudia research executor v1

This executor fetches a lead's public HTML page and topic-matching pages from configured public sources. It records excerpts and URLs in the private evidence ledger and marks research collected, not verified. No drafting or publishing.

Safety: HTTP(S) only; blocks localhost and non-public IPs, checks DNS resolution and redirects, bounded response size/time, small batches. No login, paywall, or restricted access bypass.

Deployment: Apply task-queue migration first, then the task-claim RPC migration. Test before enabling worker. Requires Supabase service-role credentials. Keep manual/scheduled until migration is reviewed and applied.