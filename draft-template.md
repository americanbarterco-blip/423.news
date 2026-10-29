# <headline — what happened, where, in plain words. Max 180 chars.>

PLACE: <block-level area — "east-side commercial strip", never a street number>

WHAT I HEARD:
<Your own account of the dispatch traffic. 40+ words. Say what units were sent, what they were
told, what changed during the incident, and what the staging or cross-street details suggest —
but in your words, in ordinary sentences. No quotes. No name of any person. No street number.
No age, condition or plate. No claim of guilt or motive. Attribute the source: "radio traffic
indicated", "the dispatch described", "crews were told to".>

WHAT IT MEANS FOR YOU:
- <Where to avoid>
- <What to expect — smoke, closures, sirens, delays>
- <What to do if you are nearby>

WHAT I DON'T KNOW YET:
- <The most important open question>
- <Second open question>
- <Third, if any>

SAFETY: <One sentence of practical guidance for the public.>

<!--
Do not publish a transcript or a "cleaned up" version of one.
Do not put quotation marks around radio traffic.
Run the gate before filing:
  python3 paraphrase.py check --draft this-file.md --transcript t.txt
  python3 paraphrase.py build --draft this-file.md --transcript t.txt \
      --feed "County Fire — Ops 1" --place "East side" --out report.json
-->
