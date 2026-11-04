#!/usr/bin/env python3
"""Run Claudia's listen -> draft pipeline forever on an always-on machine.

One worker per feed, each looping: record 2 min -> draft (if anything worth reporting) -> repeat.
Usage:  python3 desk_loop.py                 (all feeds)
        python3 desk_loop.py 9119 45708      (only these feed ids)
Reads the same environment variables as desk_pipeline.py (see /etc/claudia.env).
"""
import subprocess, sys, threading, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
FEEDS = {
    "9119":  ("Bradley County — Cleveland", "Bradley County"),
    "45708": ("Chattanooga Police Department", "Chattanooga"),
    "45709": ("Chattanooga Public Safety", "Chattanooga"),
    "29255": ("Tennessee Highway Patrol District 2 — Chattanooga", "Chattanooga region"),
    "44571": ("Hamilton County Public Safety", "Hamilton County"),
    "45706": ("Soddy Daisy Police and Fire", "Soddy Daisy"),
    "37220": ("Polk County Public Safety", "Polk County"),
    "44617": ("Rhea County Public Safety", "Rhea County"),
}
SECONDS = 120
PAUSE = 5          # seconds between segments


def worker(fid: str) -> None:
    name, place = FEEDS[fid]
    while True:
        try:
            subprocess.run([sys.executable, str(HERE / "desk_pipeline.py"), "run", "--feed-id", fid,
                            "--feed-name", name, "--place", place, "--seconds", str(SECONDS)],
                           timeout=SECONDS + 600)
        except Exception as exc:  # keep going no matter what
            print(f"[{fid}] {exc}", flush=True)
            time.sleep(60)
        time.sleep(PAUSE)


if __name__ == "__main__":
    ids = sys.argv[1:] or list(FEEDS)
    for fid in ids:
        if fid not in FEEDS:
            sys.exit(f"unknown feed id {fid}")
        threading.Thread(target=worker, args=(fid,), daemon=True).start()
        time.sleep(20)   # stagger so the machine isn't hit all at once
    while True:
        time.sleep(3600)
