# Scanner policy — what Claudia may publish

This is the desk's rulebook for anything sourced from public dispatch audio. It exists so that a
listening post stays useful and lawful: the public gets a clear, fast warning about what is
happening near them, and nobody gets a transcript of police radio, a named bystander, or a
paraphrase that is really a copy.

**Not legal advice.** Laws on recording and publishing radio traffic, and platform terms, vary by
country and by station. This policy is the desk's own conservative standard; check your local rules
before publishing.

---

## 1. Listening

- Feeds are opened and monitored **as a listener**, in a browser, the way any member of the public
  would (`scanner/listen.py open --feed "…"`).
- Recording is short, technical and for **verification only** — confirming what a dispatcher said so
  her account is accurate, not to produce audio content.
- **Audio is never rebroadcast, uploaded, or embedded.** No clips, no "listen here", no stream relays.
- Feed providers' terms come first after 423.news. If a feed's terms forbid a use, that use does happen.

## 2. What gets published

One thing only: **her own clear account** of what she heard, in her own words, with a public-safety
purpose. Filed as `kind: HEARD`.

The structure is fixed, and the gate enforces it:

```
# headline
PLACE: block-level area
WHAT I HEARD:        her account, 40+ words, no quotes
WHAT IT MEANS FOR YOU:  bullets — where to avoid, what to expect
WHAT I DON'T KNOW YET:  bullets — what is unconfirmed
SAFETY:              one sentence of practical guidance
```

## 3. Hard rules

| Rule | Why |
|---|---|
| **No verbatim runs of 6+ words** | Six consecutive words is copying. `paraphrase.py` rejects it and names the run. |
| **No quotes, no quotation marks around radio traffic** | A quote is a transcript fragment. She reports what it sounded like, not what was said. |
| **No transcript publication, in any form** | Includes "cleaned up" transcripts and dialogue-style retellings. |
| **No names** | Not of suspects, victims, callers, bystanders, or officers. Describe the role instead: *a resident*, *a responding engine*. |
| **No street numbers** | Block or district level only: *the 1400 block*, *the east-side commercial strip*. |
| **No plate, phone, DOB, or age** | Direct identifiers of people who did not choose to be in the news. |
| **No medical detail** | *One person was evaluated*, not a condition, age, or prognosis. |
| **No guilt, no motive, no speculation** | Dispatch traffic is a request for resources, not a finding. "Reported", "indicated", "according to radio traffic" — never "police say" when they did not. |
| **Never presented as fact** | Every `HEARD` item is `confidence: unconfirmed` until a published record or a second independent source upgrades it. |
| **Public-safety purpose required** | If there is no "what it means for you", the item is not published. |

## 4. The gate

`scanner/paraphrase.py` is the mechanical check, because intent is not a control.

```bash
# 1. scrub the source before drafting — removes identifiers from what she reads
python3 paraphrase.py redact --transcript t.txt --out t.safe.txt

# 2. draft from the scrubbed text, then gate it
python3 paraphrase.py check --draft draft.md --transcript t.txt
#   exit 0 = passed · exit 1 = rejected, with the exact reason

# 3. only if it passes, build the feed report
python3 paraphrase.py build --draft draft.md --transcript t.txt \
    --feed "County Fire — Ops 1" --place "East side, 423 metro" --out report.json

# 4. file it
python3 claudia.py file --json report.json
```

Rejections look like this:

```
REJECTED — fix these before filing:
  ✗ 34 verbatim 6-word run(s) copied from the source: "4 transport one patient priority two" | …
  ✗ identifiers present in draft: age of a person, street address
```

The gate checks: headline, `PLACE`, a 40+ word account, a mandatory `WHAT IT MEANS FOR YOU` and
`SAFETY`, verbatim n-gram overlap against the source, quoted material, re-introduced identifiers,
and speech attribution. Passes are stored on the item under `paraphrase` so a reader can see the
policy and the guard that was applied.

## 5. Attribution

Every `HEARD` item carries the feed it came from (`heard_on`) and the source line
*"Public dispatch audio (Broadcastify) — listened to and summarised, not quoted"*. No individual
responder or dispatcher is ever credited or named.

## 6. Corrections

Scanner accounts are provisional by construction. When an official release contradicts her account,
she files a `DESK` item naming what changed, keeps the original visible, and never silently edits
history. If an item names or endangers someone, it comes down immediately and a correction runs.
