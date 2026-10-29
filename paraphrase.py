#!/usr/bin/env python3
"""
Claudia Green — scanner paraphrase engine (legal + editorial gate)
==================================================================

Claudia listens to public dispatch audio. What she publishes is **her own clear
account** of what she heard — never a transcript, never a quote, never a
line-by-line rewrite. This tool enforces that mechanically instead of trusting
good intentions.

Two commands:

  check    Validate a draft against the source transcript.
           Fails (exit 1) on verbatim overlap, quoted material, identifiers,
           or missing sections.

  build    Turn a passing draft into a report object for the 423.news feed
           (kind: HEARD), carrying the safety notes and the legal flags.

  redact   Produce a scrubbed version of a transcript for reading — names,
           house numbers, plate fragments, phone numbers and patient detail
           removed before anyone drafts from it.

Why an n-gram guard: "paraphrase" that keeps six or more consecutive words from
the source is copying, not reporting. Six is the threshold this desk uses for
dispatch audio. Change it with --ngram.

Usage
-----
  python3 paraphrase.py redact --transcript t.txt --out t.safe.txt
  python3 paraphrase.py check  --draft draft.md --transcript t.txt
  python3 paraphrase.py build  --draft draft.md --transcript t.txt \
      --feed "County Fire — Ops 1" --place "east corridor" --out report.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# identifier scrubbing — applied to source *and* checked in drafts
# --------------------------------------------------------------------------
STREET = re.compile(
    r"\b\d{1,5}\s+(?:[A-Z][a-zA-Z]+\s+){0,3}"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|"
    r"Court|Ct|Place|Pl|Highway|Hwy|Circle|Cir|Trail|Trl)\b\.?", re.I)
PHONE = re.compile(r"\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b")
HONORIFIC_NAME = re.compile(
    r"\b(?:Mr|Mrs|Ms|Miss|Dr|Officer|Deputy|Sergeant|Sgt|Captain|Capt|Lieutenant|Lt|"
    r"Chief|Firefighter|Paramedic|EMT)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?")
TWO_NAME = re.compile(r"\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b")
AGE = re.compile(r"\b\d{1,2}[- ]year[- ]old\b", re.I)
PLATE = re.compile(r"\b(?:plate|tag|registration)\b[^.]{0,24}?\b[A-Z0-9]{4,8}\b", re.I)
DOB = re.compile(r"\b(?:dob|date of birth)\b[^.]{0,20}", re.I)
PATIENT = re.compile(
    r"\b(?:patient|victim|subject)\b[^.]{0,60}?"
    r"\b(?:critical|serious|stable|transported|pronounced|unconscious|bleeding)\b[^.]{0,40}", re.I)

# words that look like two capitalised names but are place/agency names
NAME_SAFE = {
    "County", "City", "State", "Fire", "Police", "Sheriff", "Department", "Deputy",
    "Highway", "Patrol", "Medical", "Center", "Centre", "Hospital", "Station",
    "Road", "Street", "Avenue", "Park", "River", "Creek", "Lake", "North", "South",
    "East", "West", "Main", "Oak", "Elm", "Union", "Central", "Memorial", "Broad",
}


def scrub(text: str) -> tuple[str, list[str]]:
    """Return (scrubbed_text, list_of_redaction_kinds)."""
    found = []

    def sub(pattern, label, replacement):
        nonlocal text
        if pattern.search(text):
            found.append(label)
        text = pattern.sub(replacement, text)

    sub(STREET, "street address", "[address withheld — block level only]")
    sub(PHONE, "phone number", "[number withheld]")
    sub(PLATE, "plate/registration", "[plate withheld]")
    sub(DOB, "date of birth", "[DOB withheld]")
    sub(AGE, "age of a person", "[age withheld]")
    sub(HONORIFIC_NAME, "named person", "[name withheld]")
    sub(PATIENT, "medical condition", "[condition withheld]")

    def two_name(m):
        a, b = m.group(1), m.group(2)
        if a in NAME_SAFE or b in NAME_SAFE:
            return m.group(0)
        found.append("named person")
        return "[name withheld]"

    text = TWO_NAME.sub(two_name, text)
    return text, sorted(set(found))


# --------------------------------------------------------------------------
# verbatim overlap
# --------------------------------------------------------------------------
def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def ngrams(toks: list[str], n: int) -> set[tuple[str, ...]]:
    return {tuple(toks[i:i + n]) for i in range(max(0, len(toks) - n + 1))}


def verbatim_runs(draft: str, source: str, n: int) -> list[str]:
    """Every n-word sequence that appears in both draft and source."""
    d, s = tokens(draft), tokens(source)
    if len(d) < n:
        return []
    shared = ngrams(d, n) & ngrams(s, n)
    return [" ".join(g) for g in sorted(shared)]


# --------------------------------------------------------------------------
# draft structure
# --------------------------------------------------------------------------
SECTIONS = {
    "headline": r"^#\s+(.+)$",
    "place": r"^PLACE:\s*(.+)$",
    "heard": r"^WHAT I HEARD:\s*$",
    "means": r"^WHAT IT MEANS FOR YOU:\s*$",
    "unknown": r"^WHAT I DON'T KNOW YET:\s*$",
    "safety": r"^SAFETY:\s*(.+)$",
}
HEADLINE_RE = re.compile(SECTIONS["headline"], re.M)
PLACE_RE = re.compile(SECTIONS["place"], re.M | re.I)
SAFETY_RE = re.compile(SECTIONS["safety"], re.M | re.I)


def split_draft(text: str) -> dict:
    out = {"headline": "", "place": "", "heard": "", "means": "", "unknown": "", "safety": ""}
    m = HEADLINE_RE.search(text)
    if m:
        out["headline"] = m.group(1).strip()
    m = PLACE_RE.search(text)
    if m:
        out["place"] = m.group(1).strip()
    m = SAFETY_RE.search(text)
    if m:
        out["safety"] = m.group(1).strip()

    def grab(start_label, next_labels):
        pat = re.compile(r"^" + start_label + r":\s*$", re.M | re.I)
        mm = pat.search(text)
        if not mm:
            return ""
        rest = text[mm.end():]
        stop = len(rest)
        for nl in next_labels:
            n = re.compile(r"^" + nl + r":\s*$", re.M | re.I).search(rest)
            if n:
                stop = min(stop, n.start())
        return rest[:stop].strip()

    out["heard"] = grab("WHAT I HEARD", ["WHAT IT MEANS FOR YOU", "WHAT I DON'T KNOW YET", "SAFETY"])
    out["means"] = grab("WHAT IT MEANS FOR YOU", ["WHAT I DON'T KNOW YET", "SAFETY"])
    out["unknown"] = grab("WHAT I DON'T KNOW YET", ["SAFETY"])
    return out


BANNED_QUOTES = re.compile(r"[\"“”]|(?<![\w])'[^']{20,}'(?![\w])")


def check_draft(draft_text: str, transcript: str, n: int = 6) -> tuple[list[str], list[str], dict]:
    """Return (violations, warnings, stats)."""
    violations, warnings = [], []
    parts = split_draft(draft_text)
    body = "\n".join([parts["heard"], parts["means"], parts["unknown"]])

    # 1. structure
    if not parts["headline"]:
        violations.append("missing `# headline` line")
    elif len(parts["headline"]) > 180:
        violations.append(f"headline is {len(parts['headline'])} chars (max 180)")
    if not parts["place"]:
        violations.append("missing `PLACE:` line — state the block-level area")
    if len(parts["heard"].split()) < 40:
        violations.append(f"WHAT I HEARD is only {len(parts['heard'].split())} words — explain what happened (40+)")
    if not parts["means"]:
        violations.append("missing `WHAT IT MEANS FOR YOU:` — the public-safety point is mandatory")
    if not parts["unknown"]:
        warnings.append("no `WHAT I DON'T KNOW YET:` section — say what is unconfirmed")
    if not parts["safety"]:
        violations.append("missing `SAFETY:` line — one sentence of practical guidance")

    # 2. verbatim
    runs = verbatim_runs(body, transcript, n)
    if runs:
        shown = runs[:5]
        violations.append(
            f"{len(runs)} verbatim {n}-word run(s) copied from the source: "
            + " | ".join(f'"{r}"' for r in shown))

    # 3. quoting
    if BANNED_QUOTES.search(body):
        violations.append("quoted material found — dispatch audio is paraphrased, never quoted")

    # 4. identifiers in the draft (source had them scrubbed; the draft must not reintroduce)
    _, leaks = scrub(body)
    real_leaks = [l for l in leaks if l in {"street address", "phone number", "named person",
                                            "plate/registration", "date of birth",
                                            "age of a person", "medical condition"}]
    if real_leaks:
        violations.append("identifiers present in draft: " + ", ".join(real_leaks))

    # 5. framing
    if re.search(r"\b(the (?:suspect|driver|man|woman) (?:said|stated|admitted))\b", body, re.I):
        warnings.append("attributing speech to a person — report what units did, not what anyone said")

    stats = {
        "words": len(body.split()),
        "verbatim_runs": len(runs),
        "sections": sorted(k for k, v in parts.items() if v),
    }
    return violations, warnings, stats


# --------------------------------------------------------------------------
# build the feed report
# --------------------------------------------------------------------------
def bullet_list(block: str) -> list[str]:
    items = []
    for line in block.splitlines():
        line = line.strip()
        if not line:
            continue
        items.append(re.sub(r"^[-*•]\s*", "", line))
    return items


def build_report(parts: dict, feed_name: str, place: str, n: int, transcript: str) -> dict:
    means = bullet_list(parts["means"])
    unknown = bullet_list(parts["unknown"])
    safety = bullet_list(parts["safety"])

    summary = parts["heard"].strip()
    if means:
        summary += "\n\nWhat it means for you: " + "; ".join(m.rstrip(".") for m in means[:3]) + "."
    if unknown:
        summary += "\n\nStill unconfirmed: " + "; ".join(u.rstrip(".") for u in unknown[:3]) + "."

    stamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    return {
        "id": "cg-heard-" + stamp.strftime("%Y%m%d%H%M%S"),
        "ts": stamp.isoformat().replace("+00:00", "Z"),
        "kind": "HEARD",
        "dateline": place,
        "confidence": "unconfirmed",
        "headline": parts["headline"][:180],
        "summary": summary[:1400],
        "safety": safety,
        "uncertain": unknown,
        "heard_on": feed_name,
        "paraphrase": {
            "policy": "own-words account of public dispatch audio; not a transcript",
            "ngram_guard": n,
            "verbatim_runs": len(verbatim_runs(parts["heard"], transcript, n)),
            "identifiers_removed": scrub(parts["heard"])[1],
        },
        "tags": ["scanner", "heard", "public-safety"],
        "scanner": [feed_name],
        "sources": [{
            "label": "Public dispatch audio (Broadcastify) — listened to and summarised, not quoted",
            "url": ""
        }],
    }


# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="Claudia Green — scanner paraphrase gate")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("redact")
    r.add_argument("--transcript", type=Path, required=True)
    r.add_argument("--out", type=Path, required=True)

    c = sub.add_parser("check")
    c.add_argument("--draft", type=Path, required=True)
    c.add_argument("--transcript", type=Path, required=True)
    c.add_argument("--ngram", type=int, default=6)

    b = sub.add_parser("build")
    b.add_argument("--draft", type=Path, required=True)
    b.add_argument("--transcript", type=Path, required=True)
    b.add_argument("--feed", required=True)
    b.add_argument("--place", required=True)
    b.add_argument("--out", type=Path, required=True)
    b.add_argument("--ngram", type=int, default=6)

    a = ap.parse_args()

    if a.cmd == "redact":
        raw = a.transcript.read_text(encoding="utf-8", errors="replace")
        clean, kinds = scrub(raw)
        a.out.write_text(clean, encoding="utf-8")
        print(f"redacted -> {a.out}  ({', '.join(kinds) if kinds else 'nothing matched'})")
        return 0

    transcript = a.transcript.read_text(encoding="utf-8", errors="replace")
    draft = a.draft.read_text(encoding="utf-8", errors="replace")
    violations, warnings, stats = check_draft(draft, transcript, a.ngram)

    print(f"sections  : {', '.join(stats['sections'])}")
    print(f"words     : {stats['words']}")
    print(f"verbatim  : {stats['verbatim_runs']} run(s) of {a.ngram}+ words")
    for w in warnings:
        print(f"warning   : {w}")

    if violations:
        print("\nREJECTED — fix these before filing:")
        for v in violations:
            print(f"  ✗ {v}")
        return 1

    print("PASSED — own words, no quotes, no identifiers, safety section present")

    if a.cmd == "check":
        return 0

    parts = split_draft(draft)
    report = build_report(parts, a.feed, a.place, a.ngram, transcript)
    a.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"report    : {a.out}")
    print(f"kind      : {report['kind']}  confidence: {report['confidence']}")
    print("next      : python3 claudia.py file --json " + str(a.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
