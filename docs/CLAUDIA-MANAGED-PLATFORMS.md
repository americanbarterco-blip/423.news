# Claudia managed-platform tenant registry

Claudia now has an administrator-only tenant inventory and a tenant-scoped read tool.

## Current tenant behavior

- `423.news` uses the existing 423 Supabase configuration and existing approved read-table allowlist.
- `808.news`, `let-us.farm`, and `ameri-star.online` are registered as tenants but remain disconnected until their own database URL, key, and table allowlist are configured.
- A missing tenant connection is reported as `not_configured`; it is never treated as an empty database.
- A global 423.news GitHub token is never reported as access to another repository. Repository operations remain 423.news-only until separately implemented and authorized for each repository.

## Per-tenant server-side configuration

Configure these as LiveKit agent secrets/environment variables. Do not put values in the repository or browser.

| Tenant | Prefix |
|---|---|
| 808.news | `CLAUDIA_PLATFORM_808_NEWS` |
| Let-us.Farm | `CLAUDIA_PLATFORM_LET_US_FARM` |
| Ameri-Star | `CLAUDIA_PLATFORM_AMERI_STAR` |

For each tenant, configure:

- `<PREFIX>_SUPABASE_URL`
- `<PREFIX>_SUPABASE_KEY`
- `<PREFIX>_ALLOWED_TABLES` — comma-separated exact table names approved for read access
- `<PREFIX>_GITHUB_REPOSITORY` — only if the repository exists and is the intended managed repository

The key must be scoped to that tenant's database. The table allowlist is mandatory for non-423 tenants. Do not reuse 423.news credentials. The module rejects unknown tenant IDs, unconfigured connections, and tables outside the tenant's allowlist.

## Administrator tools

- `admin_list_managed_platforms` returns tenant connection status and capability metadata without returning secrets.
- `admin_read_platform_table(table, platform_id)` reads only an allowlisted table through that tenant's own connection. The default platform remains `423.news` for backward compatibility.

This is a read-only first stage. It does not yet enable writes, publishing, billing, DNS, deployments, cross-repository code changes, or account administration on additional tenants. Those require separate scoped integrations, operation allowlists, audit logging, tests, and deployment verification.
