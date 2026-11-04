#!/usr/bin/env python3
"""
Claudia Green — automatic listen → draft pipeline (human approves before publishing)
====================================================================================

    record a segment   (ffmpeg, from the public feed)
 -> transcribe         (faster-whisper, local; transcript is never saved or published)
 -> redact identifiers (paraphrase.scrub)
 -> screen             (skip chatter with no public-safety content)
 -> draft in her own words (Claude API, following POLICY.md)
 -> gate               (paraphrase.check_draft: no 6-word copies, no quotes, no identifiers)
 -> save as a DRAFT    (Supabase news_reports with published=false, and pending/*.json)

Nothing here publishes. The site only shows rows where published=true, so an editor reads the
draft and flips that flag (admin SQL, Supabase table editor, or the approve command below).
Audio and transcripts live in a temp folder and are deleted at the end of every run.

Environment
-----------
  ANTHROPIC_API_KEY      required for drafting
  ANTHROPIC_MODEL        optional, default claude-sonnet-5-5
  SUPABASE_URL, SUPABASE_SERVICE_KEY   optional; without them drafts are only written to pending/
  BROADCASTIFY_STREAM_URLS JSON map of feed id -> stream URL (account-specific; see listen.py resolve)
  BROADCASTIFY_STREAM_URL  single-feed fallback

Usage
-----
  python3 desk_pipeline.py run --feed-id 9119 --feed-name "Bradley County — Cleveland" --seconds 120
  python3 desk_pipeline.py run --transcript-file t.txt ...     # skip recording/transcription
  python3 desk_pipeline.py approve cg-heard-20261104051700     # publish a reviewed draft
  python3 desk_pipeline.py approve ID --reject                 # delete a draft
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import paraphrase as pp  # noqa: E402
from claudia import log, now_z  # noqa: E402
import listen  # noqa: E402

PENDING = HERE / "pending"
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
MAX_TRIES = 3

# a segment must mention something a reader could act on, or we don't spend an API call
SAFETY_WORDS = re.compile(
    r"\b(fire|structure|wreck|crash|accident|collision|rollover|entrapment|extricat|"
    r"hazmat|gas leak|smoke|explosion|shots?|shooting|stabbing|pursuit|chase|armed|"
    r"missing|search|rescue|flood|tree down|power line|lines down|road closed|closure|"
    r"overdose|medical|ambulance|ems|evacuat|brush fire|wildfire)\b", re.I)
MIN_WORDS = 25

SYSTEM = """You are Claudia Green, a local public-safety correspondent for 423.news in the Tri-Cities / \
southeast Tennessee area. You write short, calm, plain-English reports from public dispatch audio.

You will be given a SCRUBBED transcript. Write your own account of what happened. Hard rules:
- Output EXACTLY this structure and nothing else:

# <headline, under 150 characters>

PLACE: <block-level area only, e.g. "east side near the interstate"; never a street number>

WHAT I HEARD:
<at least 50 words, ordinary sentences, in your own words>

WHAT IT MEANS FOR YOU:
- <where to avoid / what to expect>
- <what to do if nearby>

WHAT I DON'T KNOW YET:
- <open question>
- <open question>

SAFETY: <one sentence of practical guidance>

- NEVER copy 6 or more consecutive words from the transcript. Reword everything.
- NEVER use quotation marks. NEVER quote or retell dialogue.
- NEVER include names of any person, street numbers, phone numbers, plates, ages, or medical details \
(say "one person was evaluated", not conditions).
- NEVER suggest guilt, motive, or cause. Radio traffic is a request for resources, not a finding. \
Use "radio traffic indicated" or "crews were told".
- Everything is unconfirmed. Say so where it matters.
- If the transcript has no public-safety value, output exactly: SKIP"""


# ---------------------------------------------------------------- recording + transcription
def record(feed_id: str, name: str, seconds: int, tmp: Path) -> Path | None:
    url = os.environ.get("BROADCASTIFY_STREAM_URL", "")
    try:   # one JSON secret holding every feed: {"9119": "https://...", "45708": "https://..."}
        url = json.loads(os.environ.get("BROADCASTIFY_STREAM_URLS") or "{}").get(str(feed_id), url)
    except ValueError:
        log("BROADCASTIFY_STREAM_URLS is not valid JSON")
    feed = {"name": name, "feed_id": feed_id, "stream_url": url}
    cfg = {"work_dir": str(tmp)}
    stream, how = listen.resolve_stream(cfg, feed)
    if not stream:
        log("no stream URL could be resolved — set BROADCASTIFY_STREAM_URL (see listen.py resolve)")
        return None
    log(f"recording {seconds}s via {how}")
    return listen.record_segment(cfg, feed, stream, seconds)


def transcribe(audio: Path) -> str:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("pip install faster-whisper   (needed to transcribe audio)")
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(audio), vad_filter=True, language="en")
    return " ".join(s.text.strip() for s in segs).strip()


# ---------------------------------------------------------------- drafting
def call_claude(system: str, user: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        sys.exit("ANTHROPIC_API_KEY is not set")
    body = json.dumps({"model": MODEL, "max_tokens": 900, "system": system,
                       "messages": [{"role": "user", "content": user}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, method="POST", headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.load(r)
    except urllib.error.HTTPError as exc:
        sys.exit(f"Claude API error {exc.code}: {exc.read().decode()[:300]}")
    return "".join(b.get("text", "") for b in data.get("content", [])).strip()


def draft_until_clean(safe_text: str, drafter=call_claude) -> tuple[str, list[str]] | None:
    """Return (draft, []) when the gate passes, or None if SKIP / never passes."""
    prompt = "SCRUBBED TRANSCRIPT:\n\n" + safe_text
    for attempt in range(1, MAX_TRIES + 1):
        draft = drafter(SYSTEM, prompt)
        if draft.strip().upper().startswith("SKIP"):
            log("model judged it no public-safety value — skipping")
            return None
        violations, warnings, _ = pp.check_draft(draft, safe_text, 6)
        if not violations:
            return draft, warnings
        log(f"attempt {attempt} rejected by gate: {violations[0][:140]}")
        prompt = ("SCRUBBED TRANSCRIPT:\n\n" + safe_text +
                  "\n\nYour previous draft was rejected for:\n- " + "\n- ".join(violations) +
                  "\n\nRewrite it fixing every item. Same structure, entirely new wording.")
    log("gave up after repeated gate failures — nothing saved")
    return None


# ---------------------------------------------------------------- saving
def sb_call(method: str, path: str, body=None):
    url, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return None
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "Prefer": "return=minimal"}
    req = urllib.request.Request(f"{url}/rest/v1/{path}", method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as exc:
        sys.exit(f"Supabase {method} {path} -> {exc.code}: {exc.read().decode()[:300]}")


def save_draft(report: dict) -> None:
    report["published"] = False
    PENDING.mkdir(exist_ok=True)
    (PENDING / f"{report['id']}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    row = {k: report.get(k) for k in ("id", "ts", "kind", "dateline", "confidence", "headline", "summary",
                                       "tags", "scanner", "sources", "safety", "uncertain", "heard_on",
                                       "paraphrase", "published")}
    row["headline"] = (row["headline"] or "")[:180]
    if sb_call("POST", "news_reports?on_conflict=id", row) is None:
        log(f"draft saved locally only (no Supabase env): pending/{report['id']}.json")
    else:
        log(f"DRAFT saved for review: {report['id']}  (published=false)")


def cmd_approve(a) -> int:
    if a.reject:
        sb_call("DELETE", f"news_reports?id=eq.{a.id}")
        (PENDING / f"{a.id}.json").unlink(missing_ok=True)
        print("draft deleted")
        return 0
    if sb_call("PATCH", f"news_reports?id=eq.{a.id}", {"published": True}) is None:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY not set")
    print(f"{a.id} is now live")
    return 0


# ---------------------------------------------------------------- main run
def cmd_run(a) -> int:
    with tempfile.TemporaryDirectory(prefix="claudia-") as t:
        tmp = Path(t)
        if a.transcript_file:
            raw = Path(a.transcript_file).read_text(encoding="utf-8", errors="replace")
        else:
            if not shutil.which("ffmpeg"):
                sys.exit("ffmpeg is required")
            audio = record(a.feed_id, a.feed_name, a.seconds, tmp)
            if not audio:
                return 1
            raw = transcribe(audio)
        # transcript exists only in memory / this temp dir; the directory is deleted on exit
        safe, kinds = pp.scrub(raw)
        log(f"transcript {len(raw.split())} words; redacted: {', '.join(kinds) or 'nothing'}")
        if len(safe.split()) < MIN_WORDS or not SAFETY_WORDS.search(safe):
            log("nothing of public-safety value in this segment — done")
            return 0
        result = draft_until_clean(safe)
        if not result:
            return 0
        draft, warnings = result
        parts = pp.split_draft(draft)
        report = pp.build_report(parts, a.feed_name, parts["place"] or a.place, 6, safe)
        report["tags"] = report["tags"] + ["auto-draft"]
        for w in warnings:
            log(f"warning: {w}")
        save_draft(report)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--feed-id", default="9119")
    r.add_argument("--feed-name", default="Bradley County — Cleveland")
    r.add_argument("--place", default="Bradley County")
    r.add_argument("--seconds", type=int, default=120)
    r.add_argument("--transcript-file")
    p = sub.add_parser("approve")
    p.add_argument("id")
    p.add_argument("--reject", action="store_true")
    a = ap.parse_args()
    return cmd_run(a) if a.cmd == "run" else cmd_approve(a)


if __name__ == "__main__":
    raise SystemExit(main())
