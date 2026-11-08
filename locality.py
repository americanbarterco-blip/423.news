#!/usr/bin/env python3
"""
423.news locality + language gate
=================================

A report is publishable on 423.news only if it is
  1. written in English, and
  2. actually about the 423 area (named in the headline or summary, not just
     tagged in the dateline).

Used by:
    claudia.py          (cmd_file)       -> refuses to file a failing report
    supabase_sync.py    (sync_reports)   -> uploads failing reports as published=false
Can also be run on its own:
    python3 locality.py feed.json        -> prints a pass/fail line for every report
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Cities, towns and counties in and around the 423 area code (East Tennessee,
# SW Virginia / NW North Carolina / N Georgia edges). Extend freely.
PLACES = [
    # Chattanooga region
    "chattanooga", "hamilton county", "red bank", "soddy-daisy", "signal mountain", "collegedale",
    "east ridge", "lookout mountain", "ooltewah", "harrison", "cleveland", "bradley county",
    "athens", "mcminn county", "etowah", "dayton", "rhea county", "dunlap", "sequatchie",
    "marion county", "jasper", "south pittsburg", "ringgold", "dalton", "catoosa", "walker county",
    "polk county", "benton", "copperhill", "sweetwater", "monroe county", "madisonville",
    "meigs county", "decatur", "bledsoe county", "pikeville", "grundy county", "tracy city",
    # Tri-Cities / Northeast Tennessee
    "tri-cities", "kingsport", "johnson city", "bristol", "sullivan county", "washington county",
    "carter county", "elizabethton", "unicoi", "erwin", "greene county", "greeneville",
    "hawkins county", "rogersville", "johnson county", "mountain city", "jonesborough",
    "blountville", "piney flats", "gray", "bluff city", "hancock county", "sneedville",
    # Upper East Tennessee / Smokies edge
    "cocke county", "newport", "morristown", "hamblen county", "jefferson county", "jefferson city",
    "dandridge", "sevier county", "sevierville", "pigeon forge", "gatlinburg", "cumberland gap",
    "claiborne county", "tazewell", "campbell county", "jacksboro", "lafollette", "union county",
    "grainger county", "rutledge", "cherokee lake",
    # Region labels
    "northeast tennessee", "east tennessee", "southeast tennessee", "southwest virginia",
    "423", "tennessee valley", "tennessee",
]
# a bare "Tennessee" is deliberately last/weak: see check_report()
WEAK = {"tennessee"}

# Things that are national/international filler unless a real local place is also named.
OFF_TOPIC = re.compile(
    r"\b(putin|ukrain\w*|kremlin|russia\w*|gaza|israel\w*|hamas|nato|zelensk\w*|beijing|taiwan|"
    r"white house|congress\w*|supreme court|wall street|nasdaq|s&p 500|hollywood|premier league)\b", re.I)

_SPANISH = set("el la los las de del que en un una unos unas por para con su sus al lo como pero más "
               "este esta esto estos estas fue fueron son está están hay sobre entre también según "
               "tras ante ayer hoy nuevo nueva gobierno presidente guerra".split())
_ENGLISH = set("the of and to in is are was were for on with at by from that this it as be has have "
               "had will an or not but after about over into says said police county".split())


def _words(text: str) -> list[str]:
    return re.findall(r"[a-záéíóúñüà-ÿ']+", text.lower())


def is_english(text: str) -> bool:
    """Heuristic, no dependencies. Short strings pass unless clearly not English."""
    w = _words(text)
    if len(w) < 4:
        return True
    es = sum(x in _SPANISH for x in w)
    en = sum(x in _ENGLISH for x in w)
    accented = len(re.findall(r"[áéíóúñ¿¡]", text.lower()))
    if accented >= 2 and es >= en:
        return False
    return not (es >= 3 and es > en)


def local_places(text: str) -> list[str]:
    t = text.lower()
    hits = []
    for p in PLACES:
        if re.search(r"(?<![a-z])" + re.escape(p) + r"(?![a-z])", t):
            hits.append(p)
    return hits


def check_report(r: dict) -> tuple[bool, list[str]]:
    """Return (ok, reasons). Reasons are empty when ok."""
    head = str(r.get("headline", ""))
    summ = str(r.get("summary", ""))
    body = f"{head} {summ}"
    reasons: list[str] = []

    if not is_english(body):
        reasons.append("not English")

    # The dateline is a label, not evidence: the place must show up in the story itself.
    strong = [p for p in local_places(body) if p not in WEAK]
    weak = [p for p in local_places(body) if p in WEAK]
    if not strong and not weak:
        reasons.append("no 423-area place named in headline or summary")
    elif not strong:
        # only the word "Tennessee": fine for statewide items, but not for national/world filler
        if OFF_TOPIC.search(body):
            reasons.append("national/world story with no 423-area place named")
    elif OFF_TOPIC.search(head) and not local_places(head):
        reasons.append("national/world headline; local place appears only in the body")

    return (not reasons, reasons)


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit("usage: python3 locality.py feed.json")
    doc = json.loads(Path(sys.argv[1]).read_text())
    bad = 0
    for r in doc.get("reports", []):
        ok, why = check_report(r)
        bad += not ok
        print(("PASS " if ok else "FAIL ") + str(r.get("id")) + "  " + str(r.get("headline"))[:70]
              + ("" if ok else "  <- " + "; ".join(why)))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
