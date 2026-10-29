#!/usr/bin/env python3
"""
Claudia Green — open Broadcastify and listen
=============================================

Turns a public Broadcastify scanner feed into (a) short audio segments and
(b) a manifest the desk can transcribe. It does not transcribe and it does not
write copy — that is deliberate:

    listen.py  →  segments + manifest
    speech_to_text (agent)  →  transcript.txt
    paraphrase.py redact    →  transcript.safe.txt   (identifiers removed)
    <Claudia writes her own account>
    paraphrase.py check     →  gate: no verbatim runs, no quotes, no identifiers
    paraphrase.py build     →  report.json  (kind: HEARD)
    claudia.py file         →  live on 423.news

Broadcastify terms note: audio is public safety radio, but the stream itself is
Broadcastify's service. Open it in a browser as a listener, keep the recording
short and for verification only, never rebroadcast the audio itself, and never
publish a transcript. What gets published is Claudia's own account of what she
heard, plus safety guidance.

Commands
--------
  open    --feed "NAME" [--show] [--seconds 30]
  record  --feed "NAME" [--seconds 45] [--segments 1]
  session --feed "NAME" [--minutes 5] [--seconds 45]
  resolve --feed "NAME"
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from claudia import load_config, find_feed, work_dir, now_z, log, http_get, slug  # noqa: E402

DEFAULT_CONFIG = Path(__file__).resolve().parent / "config.json"


# --------------------------------------------------------------------------
def resolve_stream(cfg: dict, feed: dict) -> tuple[str, str]:
    """Return (stream_url, how). Uses config first, then the public feed page."""
    url = (feed.get("stream_url") or "").strip()
    if url:
        return url, "config"

    mount = (feed.get("mount") or "").strip().strip("/")
    if mount:
        return f"https://audio.broadcastify.com/{mount}.mp3", "mount"

    page = feed.get("page_url") or (
        f"https://www.broadcastify.com/listen/feed/{feed['feed_id']}" if feed.get("feed_id") else "")
    if page:
        try:
            html = http_get(page)
            m = re.search(r"https?://audio\.broadcastify\.com/[A-Za-z0-9_./-]+\.(?:mp3|m4a)", html)
            if m:
                return m.group(0), "page"
        except Exception as exc:  # noqa: BLE001
            log(f"  page resolve failed: {exc}")
    return "", "none"


def cmd_open(cfg: dict, name: str, show: bool, seconds: int) -> None:
    feed = find_feed(cfg, name)
    stream, how = resolve_stream(cfg, feed)
    page = feed.get("page_url") or (
        f"https://www.broadcastify.com/listen/feed/{feed['feed_id']}" if feed.get("feed_id") else "")

    print(f"\n  feed      {feed['name']}")
    print(f"  page      {page or '(none — set page_url in scanner/config.json)'}")
    print(f"  stream    {stream or '(unresolved — set stream_url or mount)'}   [{how}]")

    opened = False
    if page:
        try:
            from playwright.sync_api import sync_playwright  # type: ignore
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=not show)
                ctx = browser.new_context()
                pg = ctx.new_page()
                pg.goto(page, wait_until="domcontentloaded", timeout=45000)
                title = pg.title()
                log(f"  opened in chromium: {title[:80]}")
                log(f"  listening for {seconds}s on the page…")
                pg.wait_for_timeout(seconds * 1000)
                listeners = pg.eval_on_selector_all(
                    "body", "els => (document.body.innerText.match(/([\\d,]+)\\s*(?:listening|listeners)/i)||[])[0] || ''")
                if listeners:
                    log(f"  page reports: {listeners}")
                if not stream:
                    html = pg.content()
                    m = re.search(r"https?://audio\.broadcastify\.com/[A-Za-z0-9_./-]+\.(?:mp3|m4a)", html)
                    if m:
                        stream = m.group(0)
                        log(f"  resolved stream from browser: {stream}")
                browser.close()
                opened = True
        except ImportError:
            log("  playwright not installed — opening the page for you instead")
        except Exception as exc:  # noqa: BLE001
            log(f"  browser path failed: {exc}")

    if not opened and page:
        try:
            import webbrowser
            webbrowser.open(page)
            log("  opened the feed page in your default browser")
        except Exception:  # noqa: BLE001
            pass

    if not stream:
        log("  no stream URL yet. While signed in to Broadcastify, copy the audio stream URL "
            "(audio.broadcastify.com/<mount>.mp3) into scanner/config.json → stream_url.")
        return

    feed["stream_url"] = stream
    log("  backend ready — record with:  python3 listen.py record --feed \"%s\"" % feed["name"])


# --------------------------------------------------------------------------
def record_segment(cfg: dict, feed: dict, stream: str, seconds: int) -> Path | None:
    if not shutil.which("ffmpeg"):
        log("ffmpeg not found")
        return None
    out = work_dir(cfg) / f"{dt.datetime.now().strftime('%Y%m%dT%H%M%S')}_{slug(feed['name'])}.wav"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", stream,
           "-t", str(seconds), "-ac", "1", "-ar", "16000", "-vn", str(out)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not out.exists():
        log(f"  ffmpeg failed: {res.stderr.strip()[:200]}")
        return None
    manifest = work_dir(cfg) / "segments.jsonl"
    entry = {"ts": now_z(), "feed": feed["name"], "file": str(out), "seconds": seconds,
             "status": "pending_transcript", "publish_rule": "paraphrase-only, no quotes, no identifiers"}
    try:
        with manifest.open("a") as fh:
            fh.write(json.dumps(entry) + "\n")
    except OSError:
        # some network mounts reject append; keep a numbered sidecar instead
        side = work_dir(cfg) / f"segments-{int(dt.datetime.now().timestamp())}.json"
        side.write_text(json.dumps(entry, indent=2) + "\n")
    log(f"  recorded {seconds}s -> {out.name}")
    return out


def cmd_record(cfg: dict, name: str, seconds: int, segments: int) -> None:
    feed = find_feed(cfg, name)
    stream, how = resolve_stream(cfg, feed)
    if not stream:
        sys.exit(f"[claudia] no stream for {feed['name']!r} — run `listen.py open --feed \"{feed['name']}\"` first")
    log(f"stream via {how}")
    for i in range(segments):
        record_segment(cfg, feed, stream, seconds)
    log("next: transcribe each segment with speech_to_text, then paraphrase.py redact")


def cmd_session(cfg: dict, name: str, minutes: int, seconds: int) -> None:
    import time
    feed = find_feed(cfg, name)
    stream, how = resolve_stream(cfg, feed)
    if not stream:
        sys.exit("[claudia] no stream URL")
    end = time.time() + minutes * 60
    log(f"listening to {feed['name']} for {minutes} min in {seconds}s segments (stream via {how})")
    n = 0
    while time.time() < end:
        if record_segment(cfg, feed, stream, seconds):
            n += 1
        time.sleep(1)
    log(f"session done — {n} segment(s) awaiting transcription")


def cmd_resolve(cfg: dict, name: str) -> None:
    feed = find_feed(cfg, name)
    stream, how = resolve_stream(cfg, feed)
    print(json.dumps({"feed": feed["name"], "stream": stream, "via": how}, indent=2))


def main() -> int:
    ap = argparse.ArgumentParser(description="Open Broadcastify and listen")
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    sub = ap.add_subparsers(dest="cmd", required=True)

    o = sub.add_parser("open")
    o.add_argument("--feed", required=True)
    o.add_argument("--show", action="store_true", help="show the browser window")
    o.add_argument("--seconds", type=int, default=30)

    r = sub.add_parser("record")
    r.add_argument("--feed", required=True)
    r.add_argument("--seconds", type=int, default=45)
    r.add_argument("--segments", type=int, default=1)

    s = sub.add_parser("session")
    s.add_argument("--feed", required=True)
    s.add_argument("--minutes", type=int, default=5)
    s.add_argument("--seconds", type=int, default=45)

    v = sub.add_parser("resolve")
    v.add_argument("--feed", required=True)

    a = ap.parse_args()
    cfg = load_config(a.config)

    if a.cmd == "open":
        cmd_open(cfg, a.feed, a.show, a.seconds); return 0
    if a.cmd == "record":
        cmd_record(cfg, a.feed, a.seconds, a.segments); return 0
    if a.cmd == "session":
        cmd_session(cfg, a.feed, a.minutes, a.seconds); return 0
    if a.cmd == "resolve":
        cmd_resolve(cfg, a.feed); return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
