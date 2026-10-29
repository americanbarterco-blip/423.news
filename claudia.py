#!/usr/bin/env python3
"""
Claudia Green — Broadcastify scanner bridge for 423.news
=========================================================

Reads the public Broadcastify scanner feeds named in `scanner/config.json`,
keeps the site's scanner rack current, records short audio segments when a
feed gets busy, and hands those segments off for transcription.

Nothing here invents audio or invents traffic. If a credential is missing the
module says so and writes `"connected": false` into the feed instead of
pretending to listen.

Commands
--------
  doctor                       check config, ffmpeg, credential presence
  status                       poll feeds, update data/feed.json scanner block
  capture --feed "NAME" [--seconds 45]
                               record one segment to work/scanner/
  watch [--interval 60]        loop: status, auto-capture busy feeds
  ingest --feed FIRE1 --file t.txt
                               turn a transcript into graded scanner-log lines
  file --json report.json      append a report to data/feed.json

Credentials (environment, never in config files)
------------------------------------------------
  BROADCASTIFY_API_KEY         Broadcastify account API key
  BROADCASTIFY_STATUS_ENDPOINT optional status API URL, e.g.
                               https://api.broadcastify.com/feeds?key={key}
                               (copy the exact URL from your Broadcastify
                               account docs — the endpoint is account-specific)

Without a key the module still works in `page` mode: it reads the public feed
page and picks up the listener count and live marker. Stream capture needs the
per-feed `stream_url` (and `mount`) from a signed-in Broadcastify session.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config.json"
UA = "Mozilla/5.0 (compatible; ClaudiaGreen/1.0; +https://423.news)"


# --------------------------------------------------------------------------
# plumbing
# --------------------------------------------------------------------------
def now_z() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_config(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"[claudia] config not found: {path}\n"
                 f"          copy scanner/config.example.json -> scanner/config.json and add your feeds")
    with path.open() as fh:
        return json.load(fh)


def data_path(cfg: dict) -> Path:
    p = Path(cfg.get("data_path", "../data/feed.json"))
    return p if p.is_absolute() else (ROOT / p).resolve()


def read_feed(cfg: dict) -> dict:
    p = data_path(cfg)
    if not p.exists():
        return {"generated_at": now_z(), "reports": [], "scanner": {"feeds": [], "log": []}}
    with p.open() as fh:
        return json.load(fh)


def write_feed(cfg: dict, feed: dict) -> None:
    p = data_path(cfg)
    p.parent.mkdir(parents=True, exist_ok=True)
    feed["generated_at"] = now_z()
    body = json.dumps(feed, indent=2, ensure_ascii=False) + "\n"
    # atomic replace where the filesystem supports it, plain overwrite otherwise
    # (network/ZFS-over-FUSE volumes reject rename over an existing file)
    try:
        tmp = p.with_suffix(".json.tmp")
        with tmp.open("w") as fh:
            fh.write(body)
        os.replace(tmp, p)
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        with p.open("w") as fh:
            fh.write(body)


def work_dir(cfg: dict) -> Path:
    p = Path(cfg.get("work_dir", "../work/scanner"))
    p = p if p.is_absolute() else (ROOT / p).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def log(msg: str) -> None:
    print(f"[claudia {dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def http_get(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


# --------------------------------------------------------------------------
# feed status
# --------------------------------------------------------------------------
LISTENER_RE = re.compile(r"([\d,]{1,7})\s*(?:people\s+)?(?:listening|listeners)", re.I)
LIVE_RE = re.compile(r"(on\s+air|is\s+live|live\s+now|currently\s+live)", re.I)


def status_via_api(cfg: dict, feed: dict) -> dict | None:
    """Ask a Broadcastify status endpoint (URL template with {key}) for feed data."""
    key = os.environ.get("BROADCASTIFY_API_KEY", "").strip()
    tmpl = (cfg.get("status_endpoint") or os.environ.get("BROADCASTIFY_STATUS_ENDPOINT", "")).strip()
    if not key or not tmpl:
        return None
    url = tmpl.replace("{key}", key).replace("{feed_id}", str(feed.get("feed_id", "")))
    try:
        raw = http_get(url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        log(f"  api status failed for {feed['name']}: {exc}")
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    items = payload if isinstance(payload, list) else payload.get("feeds") or payload.get("data") or []
    for item in items if isinstance(items, list) else []:
        if str(item.get("id") or item.get("feed_id")) == str(feed.get("feed_id")):
            n = item.get("listeners") or item.get("listener_count") or 0
            return {"listeners": int(n), "live": bool(item.get("live", True)), "via": "api"}
    return None


def status_via_page(feed: dict) -> dict | None:
    """Public feed page: listener count + live marker. No key required."""
    url = feed.get("page_url") or (f"https://www.broadcastify.com/listen/feed/{feed['feed_id']}"
                                   if feed.get("feed_id") else "")
    if not url:
        return None
    try:
        html = http_get(url)
    except Exception as exc:  # noqa: BLE001 - page shapes vary, degrade quietly
        log(f"  page status failed for {feed['name']}: {exc}")
        return None
    m = LISTENER_RE.search(html)
    listeners = int(m.group(1).replace(",", "")) if m else 0
    return {"listeners": listeners, "live": bool(LIVE_RE.search(html)), "via": "page"}


def status_for(cfg: dict, feed: dict) -> dict:
    got = status_via_api(cfg, feed) or status_via_page(feed)
    if not got:
        return {"status": "unknown", "listeners": None, "connected": False}
    listeners = got["listeners"]
    if got["live"] and listeners >= int(feed.get("hot_threshold", 40)):
        status = "hot"
    elif got["live"] and listeners > 0:
        status = "active"
    else:
        status = "idle"
    return {"status": status, "listeners": listeners, "connected": True}


def cmd_status(cfg: dict, quiet: bool = False) -> dict:
    feed = read_feed(cfg)
    block = feed.setdefault("scanner", {})
    block["provider"] = "Broadcastify"
    block.setdefault("log", [])

    rows, any_conn = [], False
    prior = {r.get("name"): r for r in block.get("feeds", []) if isinstance(r, dict)}
    for f in cfg.get("feeds", []):
        st = status_for(cfg, f)
        any_conn = any_conn or st["connected"]
        row = {
            "name": f["name"],
            "feed_id": f.get("feed_id", ""),
            "status": st["status"],
            "listeners": st["listeners"],
            "priority": f.get("priority", 3),
            "tags": f.get("tags", []),
            "live_data": st["connected"],
        }
        if not st["connected"] and f["name"] in prior:
            # never invent traffic: keep the last known/sample row, flagged as stale
            old = prior[f["name"]]
            row["status"] = old.get("status", "idle")
            row["listeners"] = old.get("listeners")
        rows.append(row)
        if not quiet:
            log(f"  {f['name']:<34} {st['status']:<8} {st['listeners'] if st['listeners'] is not None else '—'}")

    block["feeds"] = rows
    block["connected"] = any_conn
    block["last_poll"] = now_z()
    if not any_conn:
        block["note"] = ("Broadcastify not connected — add BROADCASTIFY_API_KEY and per-feed "
                         "page_url/stream_url in scanner/config.json. Rack values are not live.")
    else:
        block.pop("note", None)
    write_feed(cfg, feed)
    if not quiet:
        log(f"status written -> {data_path(cfg)}  (connected={any_conn})")
    return block


# --------------------------------------------------------------------------
# capture
# --------------------------------------------------------------------------
def find_feed(cfg: dict, name: str) -> dict:
    for f in cfg.get("feeds", []):
        if f["name"].lower() == name.lower() or f.get("feed_id") == name:
            return f
    sys.exit(f"[claudia] no feed matched {name!r}; check scanner/config.json")


def cmd_capture(cfg: dict, name: str, seconds: int) -> Path:
    feed = find_feed(cfg, name)
    url = (feed.get("stream_url") or "").strip()
    if not url:
        sys.exit(f"[claudia] feed {feed['name']!r} has no stream_url.\n"
                 f"          Open the feed while signed in to Broadcastify, copy the audio stream URL\n"
                 f"          (audio.broadcastify.com/<mount>.<ext>) into scanner/config.json.")
    if not shutil.which("ffmpeg"):
        sys.exit("[claudia] ffmpeg not found on PATH")

    out = work_dir(cfg) / f"{dt.datetime.now().strftime('%Y%m%dT%H%M%S')}_{slug(feed['name'])}.wav"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-i", url, "-t", str(seconds),
           "-ac", "1", "-ar", "16000", "-vn", str(out)]
    log(f"recording {seconds}s from {feed['name']} -> {out.name}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        log(f"ffmpeg failed: {res.stderr.strip()[:400]}")
        sys.exit(1)

    manifest = work_dir(cfg) / "segments.jsonl"
    with manifest.open("a") as fh:
        fh.write(json.dumps({
            "ts": now_z(), "feed": feed["name"], "file": str(out),
            "seconds": seconds, "status": "pending_transcript",
        }) + "\n")
    log(f"segment ready. transcribe with:  423.news Claudia agent -> speech_to_text on {out.name}")
    return out


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]


# --------------------------------------------------------------------------
# transcript -> graded log lines
# --------------------------------------------------------------------------
PRIORITY_TERMS = {
    "A": ["structure fire", "working fire", "second alarm", "shots fired", "officer down",
          "cardiac arrest", "evacuat", "hazmat", "multi-vehicle", "entrapment", "mayday",
          "search and rescue", "water rescue", "aircraft"],
    "B": ["injury", "transport", "pursuit", "assist", "alarm", "smoke", "collision",
          "accident", "medical", "standby", "investigat"],
}
NOISE_TERMS = ["code 4", "clearing", "no further", "traffic stop", "report number",
               "ten-four", "copy", "radio check", "back at station"]


def grade(line: str) -> str:
    low = line.lower()
    if any(t in low for t in NOISE_TERMS):
        return "C"
    if any(t in low for t in PRIORITY_TERMS["A"]):
        return "A"
    if any(t in low for t in PRIORITY_TERMS["B"]):
        return "B"
    return "C"


def cmd_ingest(cfg: dict, feed_label: str, transcript_path: Path) -> int:
    """Transcript lines -> scanner log entries. Never auto-publishes a report."""
    text = transcript_path.read_text(encoding="utf-8", errors="replace")
    lines = [re.sub(r"\s+", " ", ln).strip(" -–—[]") for ln in text.splitlines()]
    lines = [ln for ln in lines if len(ln) >= 12][:40]
    if not lines:
        log("transcript produced no usable lines")
        return 0

    feed_doc = read_feed(cfg)
    log_block = feed_doc.setdefault("scanner", {}).setdefault("log", [])
    added = 0
    for ln in lines:
        entry = {"ts": now_z(), "feed": feed_label, "text": ln[:180], "grade": grade(ln)}
        log_block.insert(0, entry)
        added += 1
    del log_block[24:]
    write_feed(cfg, feed_doc)
    log(f"ingested {added} graded lines from {transcript_path.name}")
    top = [e for e in log_block if e["grade"] == "A"][:3]
    for e in top:
        log(f"  grade A candidate -> {feed_label}: {e['text']}")
    if top:
        log("  these are scanner-sourced. Draft as UNCONFIRMED until corroborated.")
    return added


# --------------------------------------------------------------------------
# file a report
# --------------------------------------------------------------------------
VALID_KINDS = {"BREAKING", "SCANNER", "HEARD", "FIELD", "VERIFIED", "DESK"}
VALID_CONF = {"unconfirmed", "developing", "confirmed"}


def cmd_file(cfg: dict, report_path: Path) -> str:
    payload = json.loads(report_path.read_text())
    items = payload if isinstance(payload, list) else [payload]
    doc = read_feed(cfg)
    have = {r.get("id") for r in doc.get("reports", [])}
    added = 0
    for r in items:
        kind = str(r.get("kind", "FIELD")).upper()
        conf = str(r.get("confidence", "developing")).lower()
        if kind not in VALID_KINDS:
            sys.exit(f"[claudia] bad kind {kind!r}; use one of {sorted(VALID_KINDS)}")
        if conf not in VALID_CONF:
            sys.exit(f"[claudia] bad confidence {conf!r}; use one of {sorted(VALID_CONF)}")
        if len(str(r.get("headline", ""))) < 12:
            sys.exit("[claudia] every report needs a headline of 12+ characters")
        rid = r.get("id") or f"cg-{int(time.time())}-{added}"
        if rid in have:
            continue
        have.add(rid)
        doc.setdefault("reports", []).insert(0, {
            "id": rid,
            "ts": r.get("ts") or now_z(),
            "kind": kind,
            "dateline": r.get("dateline", "423.NEWS DESK"),
            "confidence": conf,
            "headline": str(r["headline"])[:180],
            "summary": str(r.get("summary", ""))[:1400],
            "tags": [str(t) for t in (r.get("tags") or [])][:8],
            "scanner": [str(t) for t in (r.get("scanner") or [])][:4],
            "sources": r.get("sources") or [],
            "safety": [str(s)[:180] for s in (r.get("safety") or [])][:5],
            "uncertain": [str(s)[:180] for s in (r.get("uncertain") or [])][:5],
            "heard_on": r.get("heard_on") or (r.get("scanner") or [""])[0],
            "paraphrase": r.get("paraphrase"),
        })
        added += 1

    doc["reports"] = doc["reports"][:60]
    doc["claudia"] = doc.get("claudia") or {}
    if added:
        doc["claudia"]["on_air"] = True
        doc["claudia"]["line"] = f"On air — reading the {dt.datetime.now().strftime('%H:%M')} update."
    write_feed(cfg, doc)
    log(f"filed {added} report(s); feed now holds {len(doc['reports'])}")
    return doc["reports"][0]["id"] if doc["reports"] else ""


# --------------------------------------------------------------------------
# watch loop
# --------------------------------------------------------------------------
def cmd_watch(cfg: dict, interval: int) -> None:
    log(f"watching {len(cfg.get('feeds', []))} feeds every {interval}s — ctrl-c to stop")
    busy: dict[str, float] = {}
    while True:
        block = cmd_status(cfg, quiet=True)
        for row in block.get("feeds", []):
            if row["status"] != "hot":
                continue
            last = busy.get(row["name"], 0)
            if time.time() - last < int(cfg.get("capture_cooldown", 300)):
                continue
            busy[row["name"]] = time.time()
            try:
                cmd_capture(cfg, row["name"], int(cfg.get("capture_seconds", 45)))
            except SystemExit as exc:
                log(f"capture skipped: {exc}")
        time.sleep(interval)


# --------------------------------------------------------------------------
# doctor
# --------------------------------------------------------------------------
def cmd_doctor(cfg: dict) -> int:
    ok = True
    print("Claudia Green — scanner doctor")
    print(f"  config           {DEFAULT_CONFIG}")
    print(f"  feeds            {len(cfg.get('feeds', []))}")
    print(f"  data file        {data_path(cfg)}  {'ok' if data_path(cfg).exists() else 'MISSING'}")
    print(f"  ffmpeg           {shutil.which('ffmpeg') or 'NOT FOUND'}")
    key = os.environ.get("BROADCASTIFY_API_KEY", "")
    print(f"  API key          {'set (' + key[:4] + '…)' if key else 'NOT SET — page mode only'}")
    print(f"  status endpoint  {cfg.get('status_endpoint') or '(none)'}")
    for f in cfg.get("feeds", []):
        has_stream = bool(f.get("stream_url"))
        print(f"   - {f['name']:<32} stream_url {'yes' if has_stream else 'no'}")
        if not has_stream:
            ok = False
    if not key:
        print("\n  Without BROADCASTIFY_API_KEY the rack polls public feed pages only;")
        print("  stream capture needs per-feed stream_url from a signed-in session.")
    return 0 if ok else 1


# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="Claudia Green — Broadcastify scanner bridge")
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor")
    sub.add_parser("status")

    c = sub.add_parser("capture"); c.add_argument("--feed", required=True); c.add_argument("--seconds", type=int, default=45)
    w = sub.add_parser("watch"); w.add_argument("--interval", type=int, default=60)

    i = sub.add_parser("ingest"); i.add_argument("--feed", required=True); i.add_argument("--file", type=Path, required=True)
    fi = sub.add_parser("file"); fi.add_argument("--json", type=Path, required=True)

    args = ap.parse_args()
    cfg = load_config(args.config)

    if args.cmd == "doctor":
        return cmd_doctor(cfg)
    if args.cmd == "status":
        cmd_status(cfg); return 0
    if args.cmd == "capture":
        cmd_capture(cfg, args.feed, args.seconds); return 0
    if args.cmd == "watch":
        try:
            cmd_watch(cfg, args.interval)
        except KeyboardInterrupt:
            log("watch stopped")
        return 0
    if args.cmd == "ingest":
        cmd_ingest(cfg, args.feed, args.file); return 0
    if args.cmd == "file":
        cmd_file(cfg, args.json); return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
