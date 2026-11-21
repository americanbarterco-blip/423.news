# Manual research execution

Run the GitHub Actions workflow “Claudia manual research execution” only after
both queue and task-claim migrations are deployed. Set the migration confirmation
input to true and choose a small batch (1–5). This worker gathers evidence
only; it does not publish articles. Keep service-role credentials in GitHub
Secrets and never in source code.