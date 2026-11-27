"""Explicit, least-privilege registry for Claudia's managed platform tenants.

Only 423.news inherits the existing connection by default. Every other tenant
requires its own server-side URL/key and explicit table allowlist.
"""
from __future__ import annotations

import os
import re
from typing import Mapping

DEFAULT_TABLES = frozenset({
    "news_profiles", "news_posts", "news_comments", "news_streams", "news_reports",
    "news_scores", "news_headlines", "news_ads", "news_ad_settings", "news_alerts",
    "news_scanner_tips", "events", "hotspots", "claudia_story_leads",
    "claudia_story_drafts", "claudia_story_media", "claudia_research_tasks",
    "claudia_memories", "claudia_workspace_conversations",
    "claudia_workspace_messages", "claudia_workspace_action_requests",
})
TENANTS = {
    "423.news": {
        "name": "423.news",
        "prefix": "CLAUDIA_PLATFORM_423_NEWS",
        "repository": "americanbarterco-blip/423.news",
        "legacy": True,
        "default_tables": DEFAULT_TABLES,
    },
    "808.news": {
        "name": "808.news",
        "prefix": "CLAUDIA_PLATFORM_808_NEWS",
        "repository": "",
        "legacy": False,
        "default_tables": frozenset(),
    },
    "let-us.farm": {
        "name": "Let-us.Farm",
        "prefix": "CLAUDIA_PLATFORM_LET_US_FARM",
        "repository": "",
        "legacy": False,
        "default_tables": frozenset(),
    },
    "ameri-star.online": {
        "name": "Ameri-Star",
        "prefix": "CLAUDIA_PLATFORM_AMERI_STAR",
        "repository": "americanbarterco-blip/ameri-star-command-center",
        "legacy": False,
        "default_tables": frozenset(),
    },
}
_ID = re.compile(r"^[a-z0-9][a-z0-9.-]{1,62}$")
_TABLE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def _first(env: Mapping[str, str], *names: str) -> str:
    for name in names:
        value = str(env.get(name, "") or "").strip()
        if value:
            return value
    return ""


def _tenant_connection(platform_id: str, env: Mapping[str, str]):
    item = TENANTS[platform_id]
    prefix = item["prefix"]
    if item["legacy"]:
        url = _first(env, prefix + "_SUPABASE_URL", "CLAUDIA_MEMORY_SUPABASE_URL", "SUPABASE_URL")
        key = _first(env, prefix + "_SUPABASE_KEY", "CLAUDIA_ADMIN_SUPABASE_KEY",
                     "SUPABASE_SERVICE_ROLE_KEY", "CLAUDIA_MEMORY_SERVICE_KEY")
    else:
        url = _first(env, prefix + "_SUPABASE_URL")
        key = _first(env, prefix + "_SUPABASE_KEY")
    repo = _first(env, prefix + "_GITHUB_REPOSITORY") or item["repository"]
    tables_raw = _first(env, prefix + "_ALLOWED_TABLES")
    if item["legacy"] and not tables_raw:
        tables = set(item["default_tables"])
    else:
        tables = {part.strip().lower() for part in tables_raw.split(",") if part.strip()}
    tables = {table for table in tables if _TABLE.fullmatch(table)}
    return url.rstrip("/"), key, repo, tables


def list_managed_platforms(env: Mapping[str, str] | None = None) -> list[dict]:
    """Return non-secret connection status; never returns credential values."""
    env = os.environ if env is None else env
    rows = []
    for platform_id, item in TENANTS.items():
        url, key, repo, tables = _tenant_connection(platform_id, env)
        rows.append({
            "id": platform_id,
            "name": item["name"],
            "database_connected": bool(url and key),
            "repository_registered": bool(repo),
            "github_access_available": bool(platform_id == "423.news" and repo and _first(env, "CLAUDIA_GITHUB_TOKEN")),
            "readable_table_count": len(tables) if url and key else 0,
            "status": "connected" if url and key else "not_configured",
        })
    return rows


def get_platform_connection(platform_id: str, env: Mapping[str, str] | None = None) -> dict:
    """Resolve a tenant's explicitly configured database connection and table scope."""
    env = os.environ if env is None else env
    platform_id = str(platform_id or "").strip().lower()
    if not _ID.fullmatch(platform_id) or platform_id not in TENANTS:
        raise ValueError("Unknown managed platform.")
    url, key, repo, tables = _tenant_connection(platform_id, env)
    if not url or not key:
        raise RuntimeError("This platform's own database connection is not configured.")
    if not tables:
        raise RuntimeError("This platform has no approved read-table allowlist.")
    return {
        "id": platform_id,
        "name": TENANTS[platform_id]["name"],
        "url": url,
        "key": key,
        "repository": repo,
        "allowed_tables": frozenset(tables),
    }
