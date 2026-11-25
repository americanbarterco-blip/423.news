"""Private, service-role-gated long-term memory for Claudia."""
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE = os.environ.get("CLAUDIA_MEMORY_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("CLAUDIA_MEMORY_SERVICE_KEY", "")
TABLE = "claudia_memories"
KINDS = {"fact", "episode", "decision", "lesson", "project", "goal", "research"}
MAX_CONTENT, MAX_TAGS = 5000, 16


def stamp():
    return datetime.now(timezone.utc).isoformat()


def _request(method, path, payload=None, headers=None):
    if not BASE or not KEY:
        raise RuntimeError("Private Claudia memory disabled: URL and service key required.")

    # Supabase's new sb_secret_* keys are opaque API keys, not JWTs.
    # Send them only in the apikey header. Legacy service_role keys are JWTs
    # and continue to require the matching Bearer Authorization header.
    request_headers = {
        "apikey": KEY,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if KEY.startswith("eyJ"):
        request_headers["Authorization"] = "Bearer " + KEY
    request_headers.update(headers or {})

    req = urllib.request.Request(
        BASE + "/rest/v1/" + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers=request_headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as exc:
        raise RuntimeError("Claudia memory HTTP " + str(exc.code)) from None


def normalize(text):
    return re.findall(r"[a-z0-9]{2,}", (text or "").lower())


def normalize_project(project):
    raw = (project or "423.news").strip().lower()
    aliases = {"newsroom", "four two three dot news", "four two three dot me", "423news", "423.news"}
    if raw in aliases:
        return "423.news"
    return re.sub(r"[^a-z0-9]+", "-", raw).strip("-") or "423.news"



def save_memory(content, kind="fact", tags=None, importance=3, source_ref=None, project="423.news"):
    content = (content or "").strip()
    if not content or len(content) > MAX_CONTENT:
        raise ValueError("Memory empty or too long.")
    if kind not in KINDS:
        raise ValueError("Invalid memory type.")
    importance = max(1, min(5, int(importance)))
    project = normalize_project(project)
    tags = list(dict.fromkeys(
        str(t).strip().lower()[:40] for t in (tags or []) if str(t).strip()
    ))[:MAX_TAGS]

    # Deduplicate within the target project and memory kind.
    query = urllib.parse.urlencode({
        "select": "id,content",
        "kind": "eq." + kind,
        "project": "eq." + str(project),
        "limit": "100",
        "order": "updated_at.desc",
    })
    rows = _request("GET", TABLE + "?" + query)
    match = next((row for row in rows if row.get("content", "").strip().casefold() == content.casefold()), None)
    if match:
        result = _request(
            "PATCH",
            TABLE + "?id=eq." + urllib.parse.quote(str(match["id"])) + "&select=id,content,kind,project",
            {
                "tags": tags,
                "importance": importance,
                "source_ref": source_ref,
                "project": project,
                "updated_at": stamp(),
            },
            headers={"Prefer": "return=representation"},
        )
        if not result or not any(row.get("id") == match["id"] for row in result):
            raise RuntimeError("Memory update was not confirmed by the database.")
        action, memory_id = "updated", match["id"]
    else:
        data = {
            "content": content,
            "kind": kind,
            "tags": tags,
            "importance": importance,
            "source_ref": source_ref,
            "project": project,
            "created_at": stamp(),
            "updated_at": stamp(),
        }
        created = _request("POST", TABLE, data, headers={"Prefer": "return=representation"})
        if not created or not created[0].get("id"):
            raise RuntimeError("Memory insert was not confirmed by the database.")
        action, memory_id = "saved", created[0]["id"]

    # Read-after-write verification: confirm the exact row is persisted.
    verify_query = urllib.parse.urlencode({
        "select": "id,content,kind,project",
        "id": "eq." + str(memory_id),
        "limit": "1",
    })
    verified_rows = _request("GET", TABLE + "?" + verify_query)
    verified = next((row for row in verified_rows if
        row.get("id") == memory_id and
        row.get("content", "").strip().casefold() == content.casefold() and
        row.get("kind") == kind and row.get("project") == project), None)
    if not verified:
        raise RuntimeError("Memory write could not be verified after saving.")
    return {"action": action, "id": memory_id, "verified": True}

def recall(query, limit=8, project=None, kind=None):
    limit = max(1, min(20, int(limit)))
    params = {
        "select": "id,content,kind,tags,importance,project,source_ref,created_at,updated_at",
        "order": "updated_at.desc",
        "limit": "100",
    }
    if project:
        params["project"] = "eq." + normalize_project(project)
    if kind in KINDS:
        params["kind"] = "eq." + kind
    rows = _request("GET", TABLE + "?" + urllib.parse.urlencode(params))
    words = set(normalize(query))
    scored = []
    for row in rows:
        tokens = set(normalize(row.get("content", "")) + normalize(" ".join(row.get("tags") or [])))
        overlap = len(words & tokens)
        if words and not overlap:
            continue
        score = overlap * 3 + int(row.get("importance", 3)) * 0.25
        scored.append((score, row))
    scored.sort(key=lambda item: (item[0], item[1].get("updated_at", "")), reverse=True)
    return [row for _, row in scored[:limit]]


def forget(memory_id):
    _request(
        "DELETE",
        TABLE + "?id=eq." + urllib.parse.quote(str(memory_id)),
        headers={"Prefer": "return=minimal"},
    )
    return {"deleted": True}
