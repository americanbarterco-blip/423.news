#!/usr/bin/env python3
"""Fetch active NWS alerts affecting the 423-area counties and save them as drafts only.

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY to save. Without credentials, use --dry-run.
This tool never publishes, unpublishes, or deletes an existing report.
"""
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, os, sys, urllib.error, urllib.parse, urllib.request

UA = "423.news Claudia Green desk (+https://423.news)"
# Tennessee SAME codes for the 423-area counties only.
COUNTIES = {
    "Bradley": "047011", "Hamilton": "047065", "Polk": "047139",
    "Rhea": "047143", "McMinn": "047107", "Marion": "047115",
    "Sequatchie": "047153", "Meigs": "047121", "Monroe": "047123",
    "Bledsoe": "047007",
}
DROP = ("Test", "Special Weather Statement")
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def request_json(url: str, method: str = "GET", body=None):
    headers = {"User-Agent": UA, "Accept": "application/geo+json"}
    data = None
    if body is not None:
        headers.update({"apikey": KEY, "Authorization": f"Bearer {KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"})
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc

def report_id(alert_id: str) -> str:
    return "nws-" + hashlib.sha1(alert_id.encode()).hexdigest()[:16]

def make_report(feature: dict):
    p = feature.get("properties") or {}
    event = p.get("event") or ""
    if p.get("status") != "Actual" or p.get("messageType") == "Cancel":
        return None
    if any(word.lower() in event.lower() for word in DROP):
        return None
    if not any(word.lower() in event.lower() for word in ("warning", "watch", "advisory", "emergency")):
        return None
    same = set((p.get("geocode") or {}).get("SAME") or [])
    counties = [name for name, code in COUNTIES.items() if code in same]
    if not counties:
        return None
    alert_id = p.get("id") or feature.get("id") or (event + str(p.get("sent")))
    description = " ".join((p.get("description") or "").split())[:1100]
    instruction = " ".join((p.get("instruction") or "").split())[:600]
    sent = p.get("sent") or dt.datetime.now(dt.timezone.utc).isoformat()
    expires = p.get("ends") or p.get("expires") or ""
    return {
        "id": report_id(alert_id),
        "ts": sent,
        "kind": "VERIFIED",
        "dateline": ", ".join(counties) + (" County" if len(counties) == 1 else " Counties") + ", TN",
        "confidence": "confirmed",
        "headline": (p.get("headline") or event)[:180],
        "summary": description,
        "tags": ["weather", "nws", "alert", (p.get("severity") or "unknown").lower()],
        "scanner": [],
        "sources": [{"label": "National Weather Service", "url": "https://www.weather.gov/mrx/"}],
        "safety": [instruction] if instruction else [],
        "uncertain": ["Official alert text; verify the alert remains active before publication."],
        "heard_on": None,
        "paraphrase": {"policy": "Official National Weather Service alert", "expires": expires},
        "published": False,
    }

def save_draft(report: dict):
    base = f"{URL}/rest/v1/news_reports"
    query = urllib.parse.urlencode({"id": f"eq.{report['id']}", "select": "id,published"})
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
               "Content-Type": "application/json", "Prefer": "return=minimal"}
    existing = request_json(base + "?" + query, method="GET", body=None)
    if existing:
        if existing[0].get("published") is True:
            print(f"kept already-published report unchanged: {report['id']}")
            return
        q = urllib.parse.urlencode({"id": f"eq.{report['id']}", "published": "eq.false"})
        request_json(base + "?" + q, method="PATCH", body=report)
        print(f"refreshed draft: {report['id']}")
    else:
        request_json(base, method="POST", body=report)
        print(f"created draft: {report['id']}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--from-file", help="Read a saved NWS GeoJSON response instead of the live API")
    args = parser.parse_args()
    if args.from_file:
        with open(args.from_file, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = request_json("https://api.weather.gov/alerts/active?area=TN")
    reports = [r for r in (make_report(f) for f in data.get("features", [])) if r]
    print(f"{len(reports)} active alert(s) matched the configured 423-area counties.")
    for report in reports:
        print(f"- {report['headline']} [{report['dateline']}] — draft only")
    if args.dry_run:
        print("Dry run: no Supabase changes made.")
        return 0
    if not URL or not KEY:
        print("No Supabase credentials: no reports saved. Configure SUPABASE_URL and SUPABASE_SERVICE_KEY.")
        return 0
    for report in reports:
        save_draft(report)
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
