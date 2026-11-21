# Claudia manual draft writer
Manual-only workflow. Requires confirmation that the research, evidence, and drafts schema migrations are deployed, and GitHub Actions secrets for Supabase service role, OpenAI API key, and writer model. Runs tests before generation. Script creates private `needs_review` drafts only and never publishes.
