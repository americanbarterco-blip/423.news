#!/usr/bin/env python3
"""
Claudia Green — official National Weather Service alerts for the 423 area
=========================================================================
Pulls active NWS alerts (api.weather.gov — public, no key) for the counties below, files each as a
VERIFIED report on the site, and takes it down automatically when NWS ends or cancels it.

Source is an official government warning system, so these are labeled "confirmed" with NWS credited.
Use --draft to save them unpublished (published=false) if you would rather approve each one.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY  (without them it just prints what it would file)
Run: python3 nws_alerts.py [--draft] [--dry-run] [--from-file alerts.json]
Schedule: every 10 minutes (GitHub Actions or the server).
"""
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, os, sys, urllib.error, urllib.parse, urllib.request

UA = "423.news Claudia Green desk (+https://423.news)"      # NWS asks for an identifying User-Agent
# county name -> SAME/FIPS code (Tennessee = 047)
COUNTIES = {
    "Bradley": "047011", "Hamilton": "047065", "Polk": "047139", "Rhea": "047143",
    "McMinn": "047107", "Marion": "047115", "Sequatchie": "047153", "Meigs": "047121",
    "Monroe": "047123", "Sullivan": "047163", "Washington": "047179", "Carter": "047019",
    "Johnson": "047091", "Unicoi": "047171", "Greene": "047059", "Hawkins": "047073",
    "Hamblen": "047063", "Knox": "047093", "Blount": "047009", "Bledsoe": "047007",
}
# a short list a reader can act on; everything else is dropped as noise
IMPORTANT = ("Warning", "Watch", "Advisory", "Emergency", "Statement")
DROP = ("Test", "Special Weather Statement")   # remove the second to keep SWS
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/geo+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def sb(method: str, path: str, body=None):
    if not URL or not KEY:
        return None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "Prefer": "return=representation,resolution=merge-duplicates"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as exc:
        sys.exit(f"Supabase {method} {path} -> {exc.code}: {exc.read().decode()[:300]}")


def rid(alert_id: str) -> str:
    return "nws-" + hashlib.sha1(alert_id.encode()).hexdigest()[:16]


def counties_hit(props: dict) -> list[str]:
    same = set((props.get("geocode") or {}).get("SAME") or [])
    return [n for n, c in COUNTIES.items() if c in same]


def to_report(f: dict, published: bool) -> dict | None:
    p = f.get("properties", {})
    ev = p.get("event") or ""
    if p.get("status") != "Actual" or p.get("messageType") == "Cancel":
        return None
    if any(d in ev for d in DROP) or not any(k in ev for k in IMPORTANT):
        return None
    hit = counties_hit(p)
    if not hit:
        return None
    summary = " ".join((p.get("description") or "").split())[:1100]
    instr = " ".join((p.get("instruction") or "").split())
    sev = p.get("severity") or "Unknown"
    until = p.get("ends") or p.get("expires") or ""
    return {
        "id": rid(p.get("id") or f.get("id") or ev + str(p.get("sent"))),
        "ts": p.get("sent") or dt.datetime.now(dt.timezone.utc).isoformat(),
        "kind": "VERIFIED",
        "dateline": ", ".join(hit) + (" County" if len(hit) == 1 else " Counties") + ", TN",
        "confidence": "confirmed",
        "headline": (p.get("headline") or ev)[:180],
        "summary": summary,
        "tags": ["weather", "nws", "alert", sev.lower()],
        "scanner": [],
        "sources": [{"label": f"National Weather Service — {p.get('senderName') or 'NWS'}",
                     "url": "https://www.weather.gov/mrx/"}],
        "safety": [instr[:600]] if instr else [],
        "uncertain": [],
        "heard_on": None,
        "paraphrase": {"policy": "official NWS alert text (US government, public domain)", "until": until},
        "published": published,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-file")
    a = ap.parse_args()

    data = json.load(open(a.from_file)) if a.from_file else get_json("https://api.weather.gov/alerts/active?area=TN")
    reports = [r for r in (to_report(f, not a.draft) for f in data.get("features", [])) if r]
    live_ids = {r["id"] for r in reports}
    print(f"{len(reports)} active alert(s) for the 423 area")
    for r in reports:
        print(f"  - {r['headline'][:100]}  [{r['dateline']}]")
    if a.dry_run or not (URL and KEY):
        print("(not saved: dry run or no Supabase env)")
        return 0
    if reports:
        sb("POST", "news_reports?on_conflict=id", reports)
    # take down alerts NWS no longer lists (expired / cancelled)
    old = sb("GET", "news_reports?select=id&id=like.nws-*&published=eq.true") or []
    gone = [o["id"] for o in old if o["id"] not in live_ids]
    for g in gone:
        sb("PATCH", f"news_reports?id=eq.{g}", {"published": False})
    print(f"filed {len(reports)}, took down {len(gone)} expired")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
