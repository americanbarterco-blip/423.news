#!/usr/bin/env python3
"""
Claudia Green — push the desk into Supabase (for the GitHub Action)
===================================================================

Reads the local desk state (data/feed.json + scanner/config.json), polls the
Broadcastify rack, and upserts it into Supabase over PostgREST. No SDK, no
dependencies.

    SUPABASE_URL=https://xxxx.supabase.co \
    SUPABASE_SERVICE_KEY=... \
    python3 scanner/supabase_sync.py

Runs in the scheduled GitHub workflow (.github/workflows/desk.yml), which is
also where you can add: capture a segment → paraphrase → file.

Idempotent: feeds upsert on `name`, reports upsert on `id`, log rows are only
inserted once (newer than the newest row already in the table).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# works in the full layout (data/feed.json) and in the flat repo (feed.json beside this script)
FEED = next((c for c in (Path(__file__).resolve().parent / "feed.json", ROOT / "data" / "feed.json") if c.exists()),
            ROOT / "data" / "feed.json")

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

if not URL or not KEY:
    sys.exit("[sync] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set "
             "(service-role key — keep it in GitHub Secrets, never in the browser)")


def call(method: str, path: str, body=None, prefer: str | None = None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode() or "[]"
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()[:400]
        raise SystemExit(f"[sync] {method} {path} → HTTP {exc.code}: {detail}")


def load_local() -> dict:
    if not FEED.exists():
        return {"reports": [], "scanner": {"feeds": [], "log": []}}
    return json.loads(FEED.read_text())


def sync_feeds(scanner: dict) -> int:
    rows = []
    for f in scanner.get("feeds", []):
        rows.append({
            "name": f.get("name"),
            "status": f.get("status") or "unknown",
            "listeners": f.get("listeners"),
            "live_data": bool(f.get("live_data")),
            "priority": f.get("priority", 3),
            "tags": f.get("tags") or [],
            "note": scanner.get("note"),
        })
    rows = [r for r in rows if r["name"]]
    if not rows:
        return 0
    call("POST", "news_scanner_feeds?on_conflict=name", rows, "resolution=merge-duplicates,return=minimal")
    return len(rows)


def max_log_ts() -> str:
    rows = call("GET", "news_scanner_log?select=ts&order=ts.desc&limit=1")
    return rows[0]["ts"] if rows else "1970-01-01T00:00:00Z"


def sync_log(scanner: dict) -> int:
    newest = max_log_ts()
    rows = []
    for line in scanner.get("log", []):
        ts = line.get("ts")
        if not ts or ts <= newest:
            continue
        rows.append({
            "ts": ts,
            "feed": line.get("feed") or "unknown",
            "line": (line.get("text") or "")[:400],
            "grade": (line.get("grade") or "C").upper()[:1],
        })
    if not rows:
        return 0
    call("POST", "news_scanner_log", rows, "return=minimal")
    return len(rows)


def sync_reports(reports: list) -> int:
    rows = []
    for r in reports:
        if not r.get("id"):
            continue
        rows.append({
            "id": r["id"],
            "ts": r.get("ts"),
            "kind": r.get("kind", "FIELD"),
            "dateline": r.get("dateline"),
            "confidence": r.get("confidence", "developing"),
            "headline": r.get("headline", "")[:180],
            "summary": r.get("summary", "")[:4000],
            "tags": r.get("tags") or [],
            "scanner": r.get("scanner") or [],
            "sources": r.get("sources") or [],
            "safety": r.get("safety") or [],
            "uncertain": r.get("uncertain") or [],
            "heard_on": r.get("heard_on"),
            "paraphrase": r.get("paraphrase"),
            "published": r.get("published", True),
        })
    if not rows:
        return 0
    call("POST", "news_reports?on_conflict=id", rows, "resolution=merge-duplicates,return=minimal")
    return len(rows)


def main() -> int:
    doc = load_local()
    scanner = doc.get("scanner", {})
    reports = doc.get("reports", [])

    nf = sync_feeds(scanner)
    nl = sync_log(scanner)
    nr = sync_reports(reports)

    print(f"[sync] feeds={nf}  log_rows={nl}  reports={nr}  → {URL}")
    if nf == 0 and nl == 0 and nr == 0:
        print("[sync] nothing to push")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
