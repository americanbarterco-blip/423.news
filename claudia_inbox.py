#!/usr/bin/env python3
"""
Claudia Green — pull clips editors sent her
===========================================

Editors can "Share straight to Claudia" (or press "Send to Claudia" on a reader tip) from their
profile page. This script collects those clips for her desk run, the same way supabase_sync.py
talks to Supabase: no SDK, no dependencies.

    SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=... \
    python3 claudia_inbox.py            # download new clips into inbox/ and mark them picked up
    python3 claudia_inbox.py --peek     # list them, download nothing, change nothing

Each item lands in inbox/<id>/ as  clip.<ext>  and  tip.json  (area, when, the editor's note).

Then follow POLICY.md, nothing skips the gate:
    1. transcribe the clip (for verification only; the transcript is never published)
    2. python3 paraphrase.py redact --transcript t.txt --out t.safe.txt
    3. write her own account from draft-template.md
    4. python3 paraphrase.py check --draft draft.md --transcript t.txt
    5. paraphrase.py build, then  python3 claudia.py file --json report.json

The clip itself is private and is never uploaded, embedded or rebroadcast.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
BUCKET = "scanner-clips"


def api(method, path, body=None, raw=False):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out = r.read()
            return out if raw else json.loads(out.decode() or "[]")
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"[inbox] {method} {path} -> HTTP {exc.code}: {exc.read().decode()[:300]}")


def main():
    ap = argparse.ArgumentParser(description="Pull clips editors sent to Claudia")
    ap.add_argument("--peek", action="store_true", help="list only; download nothing, mark nothing")
    ap.add_argument("--out", default="inbox")
    a = ap.parse_args()
    if not URL or not KEY:
        sys.exit("[inbox] set SUPABASE_URL and SUPABASE_SERVICE_KEY (service-role key; keep it in GitHub Secrets)")

    rows = api("GET", "rest/v1/news_scanner_tips?to_claudia=eq.true&picked_up_at=is.null&status=eq.new"
                      "&select=id,author_name,area,heard_at,source_url,note,clip_path,created_at&order=created_at.asc")
    if not rows:
        print("[inbox] nothing waiting for Claudia"); return
    for t in rows:
        label = f"{t['id'][:8]}  {t['area']}  ({t.get('heard_at') or 'time not given'})  clip: {'yes' if t.get('clip_path') else 'no'}"
        if a.peek:
            print("[inbox]", label); continue
        d = Path(a.out) / t["id"]; d.mkdir(parents=True, exist_ok=True)
        if t.get("clip_path"):
            signed = api("POST", f"storage/v1/object/sign/{BUCKET}/{urllib.parse.quote(t['clip_path'])}", {"expiresIn": 300})
            clip = api("GET", "storage/v1" + signed["signedURL"], raw=True)
            (d / ("clip" + Path(t["clip_path"]).suffix)).write_bytes(clip)
        (d / "tip.json").write_text(json.dumps({k: t.get(k) for k in ("id", "area", "heard_at", "note", "source_url", "created_at")}, indent=2))
        api("PATCH", f"rest/v1/news_scanner_tips?id=eq.{t['id']}", {"picked_up_at": datetime.now(timezone.utc).isoformat()})
        print("[inbox] picked up", label, "->", d)
    if not a.peek:
        print("[inbox] next: transcribe, paraphrase.py redact, draft, check, build, file (see top of this file)")


if __name__ == "__main__":
    main()
