#!/usr/bin/env python3
"""Pull Tennessee Highway Patrol monthly checkpoint PDFs, parse them, geocode, and
write checkpoints.json for 423.news. Run by GitHub Actions on a schedule."""
import hashlib, json, os, re, subprocess, sys, time, urllib.request, urllib.parse, datetime as dt

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "checkpoints.json")
CACHE = os.path.join(ROOT, "geocode_cache.json")
BASE = "https://www.tn.gov/content/dam/tn/safety/documents/thp-checkpoints/{y}/{m}.pdf"
UA = "423news-checkpoint-updater/1.0 (+https://423.news)"

# Counties to publish. Edit freely.
COUNTIES = {c.lower() for c in """Hamilton Bradley Marion Sequatchie Bledsoe Rhea Meigs McMinn Polk Monroe
Sullivan Washington Carter Johnson Unicoi Greene Hawkins Hancock Hamblen Cocke Grainger Claiborne
Knox Anderson Blount Loudon Roane Union Campbell Scott Morgan Jefferson Sevier Grundy""".split()}
TWO_WORD = ["van buren"]  # extend if a two-word county is added above

def month_names(today):
    names = []
    for off in (-1, 0, 1):  # last month (diagnostic), this month, next month
        y, m = today.year, today.month + off
        if m > 12: y, m = y + 1, 1
        if m < 1: y, m = y - 1, 12
        names.append((y, dt.date(y, m, 1).strftime("%B").upper()))
    return names

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except Exception as e:
        print("skip", url.rsplit('/',1)[-1], e); return None

def pdf_text(data):
    p = "/tmp/thp.pdf"
    open(p, "wb").write(data)
    return subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True, check=True).stdout

ROW = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s+(.*\S)\s*$")
TYPE = re.compile(r"(sobriety|seat\s*-?\s*belt|d\.?\s?l\.?|driver'?s?\s+licen[sc]e)\s*$", re.I)

def parse(text):
    rows = []
    for line in text.splitlines():
        m = ROW.match(line)
        if not m: continue
        mo, d, y, rest = int(m[1]), int(m[2]), int(m[3]), m[4]
        t = TYPE.search(rest)
        if not t: continue
        kind_raw = t[1].lower().replace(" ", "")
        rest = rest[:t.start()].strip()
        words = rest.split()
        county = None
        if words:
            if " ".join(words[:2]).lower() in TWO_WORD: county, loc = " ".join(words[:2]), " ".join(words[2:])
            else: county, loc = words[0], " ".join(words[1:])
        if not county or county.lower() not in COUNTIES: continue
        if kind_raw.startswith("sobriety"): typ, sub = "DUI", "Sobriety checkpoint"
        elif "belt" in kind_raw: typ, sub = "Roadblock", "Seat belt checkpoint"
        else: typ, sub = "Roadblock", "Driver license checkpoint"
        rows.append(dict(date=dt.date(y, mo, d), county=county.title(), location=loc.strip(), type=typ, sub=sub))
    return rows

def load_cache():
    try: return json.load(open(CACHE))
    except Exception: return {}

def geocode(q, cache):
    if q in cache: return cache[q]
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "json", "limit": 1, "countrycodes": "us"})
    time.sleep(1.1)  # Nominatim policy: max 1 req/sec
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        res = json.load(urllib.request.urlopen(req, timeout=30))
        cache[q] = [float(res[0]["lat"]), float(res[0]["lon"])] if res else None
    except Exception as e:
        print("geocode fail", q, e); cache[q] = None
    return cache[q]

def main():
    today = dt.date.today()
    rows = []
    for y, name in month_names(today):
        data = fetch(BASE.format(y=y, m=name))
        if data:
            got = parse(pdf_text(data)); print(name, y, len(got), "rows"); rows += got
    cache = load_cache(); items = []
    for r in rows:
        if r["date"] < today: continue
        pt = geocode(f'{r["location"]}, {r["county"]} County, Tennessee', cache); prec = "approx-location"
        if not pt:
            pt = geocode(f'{r["county"]} County, Tennessee', cache); prec = "county-only"
        if not pt: continue
        iso = r["date"].isoformat()
        items.append({
            "id": f'thp-{iso}-{hashlib.md5((r["location"]+r["county"]).encode()).hexdigest()[:6]}',
            "type": r["type"], "title": f'{r["sub"]}: {r["county"]} County',
            "location": f'{r["location"]} ({r["county"]} Co.)',
            "lat": pt[0], "lng": pt[1], "precision": prec,
            "start": f"{iso}T00:00:00-05:00", "end": f"{iso}T23:59:00-05:00",
            "time_note": "Hours not published by THP; shown for the full day",
            "agency": "Tennessee Highway Patrol",
            "source_url": BASE.format(y=r["date"].year, m=r["date"].strftime("%B").upper()),
            "status": "verified", "last_verified": dt.datetime.now(dt.timezone.utc).isoformat()})
    json.dump(cache, open(CACHE, "w"), indent=1)
    # Keep other-source entries (non-THP) that are still current.
    try: old = json.load(open(OUT)).get("checkpoints", [])
    except Exception: old = []
    keep = [c for c in old if not c.get("id", "").startswith("thp-") and c.get("end", "") >= today.isoformat()]
    out = {"updated": dt.datetime.now(dt.timezone.utc).isoformat(), "checkpoints": keep + items}
    if not rows and not keep and len(old) > 0 and "--force" not in sys.argv:
        print("No rows parsed; leaving existing file untouched"); return
    json.dump(out, open(OUT, "w"), indent=1)
    print("wrote", len(out["checkpoints"]), "checkpoints")

if __name__ == "__main__": main()
