## Optional community and video source discovery

The community adapter uses OAuth client credentials for Reddit's official API (no RSS scraping) and the YouTube Data API for video discovery. It gathers public post/video metadata, stores titles, public links, excerpts/descriptions and timestamps, and omits Reddit usernames. Reddit posts from the Chattanooga, UTC, and ClevelandTN communities are kept local; the statewide Tennessee community is filtered for 423-area terms. YouTube searches target Chattanooga, Cleveland, Hamilton County, Bradley County, and the 423 region.


Credentials are optional and the adapter safely skips a provider if its credentials are absent. Configure GitHub Actions secrets `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `YOUTUBE_API_KEY`; Supabase service-role secrets are needed for ingestion. It is not a commenting, posting, private-group, or publishing bot. Source items are leads requiring verification.


Reddit RSS feeds are not used because Reddit announced the end of RSS support in November 2026; this adapter relies on authenticated API access instead.