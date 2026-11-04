#!/usr/bin/env python3
"""
Claudia Green — Chattanooga Vehicle Incidents (City of Chattanooga open data)
============================================================================
Downloads the city's "Chattanooga Vehicle Incidents" CSV (rolling ~90 days), and files one short
daily-style summary report: how many incidents in the last 24 hours, the most common types, and
which areas had the most. Counts only — no street addresses, names, or per-incident details.

The report is labeled city data, not confirmed by the desk (the city makes no guarantee that it is
complete or precise). It is saved UNPUBLISHED unless you pass --publish.

Run:
  python3 chatt_incidents.py --inspect          # print the columns + 3 sample rows (run this FIRST)
  python3 chatt_incidents.py --dry-run          # build the summary, print it, save nothing
  python3 chatt_incidents.py                    # save as an unpublished draft in Supabase
  python3 chatt_incidents.py --publish          # save and publish
Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
If the column guesses below are wrong, set them: --time-col X --type-col Y --area-col Z
"""
from __future__ import annotations
import argparse, collections, csv, datetime as dt, io, json, os, re, sys, urllib.error, urllib.request

DATASETS = {   # key -> (ArcGIS item id, plain-English label, hub page)
    "vehicles": ("73e6c2e4be7f4a84932f536a684141ac", "vehicle incidents",
                 "https://data.chattanooga.gov/datasets/4baf1acaa8ba4cdb95ddd222d3ca30c1/about"),
    # add more here, e.g. "police": ("<item id>", "police incidents", "<hub page url>")
}
UA = "423.news Claudia Green desk (+https://423.news)"
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
STREET_NUM = re.compile(r"^\s*\d+\s+")          # drop house numbers if an area column holds addresses


def download(item: str) -> str:
    req = urllib.request.Request(f"https://www.arcgis.com/sharing/rest/content/items/{item}/data", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8-sig", errors="replace")


def pick(cols: list[str], words: tuple[str, ...]) -> str | None:
    for w in words:
        for c in cols:
            if w in c.lower():
                return c
    return None


def parse_time(v: str) -> dt.datetime | None:
    v = (v or "").strip()
    if not v:
        return None
    if re.fullmatch(r"\d{12,14}", v):                       # epoch milliseconds
        return dt.datetime.fromtimestamp(int(v) / 1000, dt.timezone.utc)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%m/%d/%Y %I:%M:%S %p",
                "%m/%d/%Y %H:%M", "%m/%d/%Y", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S+00", "%Y/%m/%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(v[:25].strip(), fmt).replace(tzinfo=dt.timezone.utc)
        except ValueError:
            pass
    return None


def sb(method: str, path: str, body=None):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "Prefer": "return=minimal,resolution=merge-duplicates"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError as exc:
        sys.exit(f"Supabase {method} {path} -> {exc.code}: {exc.read().decode()[:300]}")


def top(counter: collections.Counter, n=3) -> str:
    items = [f"{k.title()} ({v})" for k, v in counter.most_common(n) if k]
    return ", ".join(items)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--publish", action="store_true")
    ap.add_argument("--from-file")
    ap.add_argument("--time-col"); ap.add_argument("--type-col"); ap.add_argument("--area-col")
    ap.add_argument("--hours", type=int, default=24)
    ap.add_argument("--dataset", default="vehicles", help="key in DATASETS, or an ArcGIS item id")
    ap.add_argument("--label", default=None, help="plain-English name, for a dataset given by item id")
    a = ap.parse_args()

    item, label, page = DATASETS.get(a.dataset, (a.dataset, a.label or "incidents", "https://data.chattanooga.gov/"))
    text = open(a.from_file, encoding="utf-8-sig").read() if a.from_file else download(item)
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        sys.exit("CSV had no rows")
    cols = list(rows[0].keys())
    if a.inspect:
        print(f"{len(rows)} rows. Columns:\n  " + "\n  ".join(cols))
        for r in rows[:3]:
            print(json.dumps(r, indent=1)[:900])
        return 0

    tcol = a.time_col or pick(cols, ("incident_date", "date_time", "datetime", "date", "time"))
    ycol = a.type_col or pick(cols, ("incident_type", "type", "category", "offense", "description", "nature"))
    acol = a.area_col or pick(cols, ("neighborhood", "district", "zone", "area", "beat", "city", "location", "address"))
    if not tcol:
        sys.exit(f"could not find a date/time column in: {cols}\nre-run with --time-col NAME")
    print(f"using time={tcol!r} type={ycol!r} area={acol!r}")

    newest = max((t for t in (parse_time(r.get(tcol)) for r in rows) if t), default=None)
    if not newest:
        sys.exit("could not read any dates from the time column")
    now = dt.datetime.now(dt.timezone.utc)
    cutoff = newest - dt.timedelta(hours=a.hours)           # measure against the newest record, not the clock
    recent = [r for r in rows if (t := parse_time(r.get(tcol))) and t >= cutoff]
    stale_hours = (now - newest).total_seconds() / 3600
    types = collections.Counter((r.get(ycol) or "").strip().lower() for r in recent) if ycol else collections.Counter()
    areas = collections.Counter(STREET_NUM.sub("", (r.get(acol) or "")).strip().lower() for r in recent) if acol else collections.Counter()

    summary = (f"The City of Chattanooga's open {label} data lists {len(recent)} incident(s) in the "
               f"{a.hours} hours ending at its newest record.")
    if types:
        summary += f" The most common types were {top(types)}."
    if areas and len(areas) > 1:
        summary += f" The areas with the most were {top(areas)}."
    summary += (" This is city-posted data, not confirmed by 423.news. The city says it does not guarantee that "
                "the data is complete or precise.")
    if stale_hours > 48:
        summary += f" Note: the newest record is about {int(stale_hours // 24)} days old, so this may lag current conditions."
    print("\n" + summary)
    if a.dry_run or not (URL and KEY):
        print("\n(not saved)")
        return 0

    stamp = now.strftime("%Y%m%d")
    sb("POST", "news_reports?on_conflict=id", [{
        "id": f"chatt-{a.dataset[:12]}-{stamp}", "ts": now.isoformat(), "kind": "FIELD",
        "dateline": "Chattanooga, TN", "confidence": "unconfirmed",
        "headline": f"Chattanooga {label}: {len(recent)} in the last {a.hours} hours, per city data",
        "summary": summary, "tags": ["chattanooga", "city-data"], "scanner": [],
        "sources": [{"label": f"City of Chattanooga open data — {label}",
                     "url": page}],
        "safety": ["Give emergency crews room if you pass a scene."],
        "uncertain": ["City data may be incomplete or delayed."], "heard_on": None,
        "paraphrase": None, "published": bool(a.publish)}])
    print("saved", "and published" if a.publish else "as an unpublished draft")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
