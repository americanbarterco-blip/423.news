# Claudia 423.news coverage audit (static entrypoint)
This read-only audit inspects index.html metadata and locally referenced href/src assets. It skips hash routes and external URLs, reports missing local files, and writes a JSON artifact. It does not crawl external sites, query the production database, publish, or deploy.
Run: `python scripts/claudia_site_coverage_audit.py --root . --json-out claudia-site-coverage.json`
