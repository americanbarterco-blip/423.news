#!/usr/bin/env python3
"""Apply 423 Arcade's free-to-play / rewarded-ad-only policy to staged originals."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent / "arcade" / "games"
FILES = [
    "game-mr-green.html",
    "game-trumps-quarters.html",
    "game-quarter-shoveler.html",
    "game-atv-deer-dodge.html",
    "game-apex-society-hunt.html",
]


def read(name):
    p = ROOT / name
    if not p.is_file() or p.stat().st_size == 0:
        raise SystemExit(f"Missing staged game: {p}")
    return p.read_text(encoding="utf-8")


def write(name, source):
    (ROOT / name).write_text(source, encoding="utf-8")


def remove_purchase_buttons(source):
    source, n = re.subn(
        r'<button\b[^>]*data-buy=["\']p[15]["\'][^>]*>.*?</button>',
        "", source, flags=re.I | re.S,
    )
    if n < 2:
        raise SystemExit(f"Expected at least two purchase buttons, removed {n}")
    return source


def patch_coin_pusher(name):
    s = read(name)
    s = remove_purchase_buttons(s)
    s = s.replace(
        "when they run out, buy more or watch an ad.",
        "when they run out, watch a rewarded ad to receive more free coins.",
    )
    s = s.replace('aria-label="Add funds"', 'aria-label="Use winnings"')
    s = s.replace('<h2>Add funds</h2>', '<h2>Use winnings</h2>')
    s = s.replace(
        "const BDFM_TEST = false;           // true = Buy/Ad buttons grant coins directly (testing only)",
        "const BDFM_TEST = false;           // production rewards are granted only after a rewarded ad completes",
    )
    s = re.sub(r"const PACKS = \{ p1: 200, p5: 600 \};[^\n]*\n", "", s)
    pattern = r"function bdfmRequest\(kind\) \{\s*if \(BDFM_TEST\) \{ bdfmGrant\(kind === 'ad' \? AD_COINS : PACKS\[kind\]\); return; \}\s*try \{ parent\.postMessage\(\{ bdfm: kind \}, '\*'\); \} catch \(e\) \{\}\s*\}"
    replacement = "function bdfmRequest(kind) {\n  if (kind !== 'ad') return; // coin purchases are disabled; only rewarded ads may refill the wallet\n  if (BDFM_TEST) { bdfmGrant(AD_COINS); return; }\n  try { parent.postMessage({ bdfm: 'ad' }, '*'); } catch (e) {}\n}"
    s, count = re.subn(pattern, replacement, s, count=1)
    if count != 1:
        raise SystemExit(f"Could not enforce ad-only requests in {name}")
    write(name, s)


def patch_shooting_game(name):
    s = read(name)
    old = "['p1|Buy $1 \\u00B7 200 coins','p5|Buy $5 \\u00B7 600 coins','ad|Watch ad \\u00B7 +50 coins']"
    if old not in s:
        raise SystemExit(f"Could not locate coin offer list in {name}")
    s = s.replace(old, "['ad|Watch ad \\u00B7 +50 coins']", 1)
    s = re.sub(r"const BDFM_PACKS = \{ p1: 200, p5: 600 \};\s*", "", s)
    pattern = r"function bdfmRequest\(kind\) \{\s*if \(BDFM_TEST\) \{ bdfmGrant\(kind === 'ad' \? AD_COINS : BDFM_PACKS\[kind\]\); return; \}\s*try \{ parent\.postMessage\(\{ bdfm: kind \}, '\*'\); \} catch \(e\) \{\}\s*\}"
    replacement = "function bdfmRequest(kind) {\n    if (kind !== 'ad') return; // purchases are disabled\n    if (BDFM_TEST) { bdfmGrant(AD_COINS); return; }\n    try { parent.postMessage({ bdfm: 'ad' }, '*'); } catch (e) {}\n  }"
    s, count = re.subn(pattern, replacement, s, count=1)
    if count != 1:
        raise SystemExit(f"Could not enforce ad-only requests in {name}")
    write(name, s)


def patch_mr_green():
    name = "game-mr-green.html"
    s = read(name)
    old = '<p id="bestLine">Best: $0.00</p>\n        <button id="again">Play again</button>'
    new = '<p id="bestLine">Best: $0.00</p>\n        <button id="watchAdBtn" class="fbtn">Watch ad · +50 coins</button>\n        <button id="again">Play again</button>'
    if old not in s:
        raise SystemExit("Could not locate Mr. Green out-of-coins panel")
    s = s.replace(old, new, 1)
    s = s.replace('aria-label="Add funds"', 'aria-label="Use winnings"')
    s = s.replace('<h2>Add funds</h2>', '<h2>Use winnings</h2>')
    s = s.replace('<span>Add funds</span>', '<span>Use winnings</span>')
    anchor = "againBtn.addEventListener('click', restart);"
    if anchor not in s:
        raise SystemExit("Could not locate Mr. Green restart handler")
    s = s.replace(
        anchor,
        anchor + "\ndocument.getElementById('watchAdBtn').addEventListener('click', () => { try { parent.postMessage({ bdfm: 'ad' }, '*'); } catch (e) {} });",
        1,
    )
    s = s.replace(
        "// Coins bought with a card or redeemed with a promo code reach the game here, handed over by the Big D hub as quarters in play.",
        "// Rewarded-ad coin grants are handed over by the 423 Arcade hub as quarters in play.",
    )
    write(name, s)


for filename in FILES:
    if filename in ("game-trumps-quarters.html", "game-quarter-shoveler.html"):
        patch_coin_pusher(filename)
    elif filename in ("game-atv-deer-dodge.html", "game-apex-society-hunt.html"):
        patch_shooting_game(filename)
patch_mr_green()

for filename in FILES:
    s = read(filename)
    if re.search(r'data-buy=["\']p[15]["\']|Buy \$[15]', s, re.I):
        raise SystemExit(f"Purchase UI remains in {filename}")
    if filename != "game-mr-green.html" and "Watch ad" not in s and "WATCH AD" not in s:
        raise SystemExit(f"Rewarded-ad option missing from {filename}")
print("Prepared five Arcade games: purchases removed; rewarded-ad-only refill controls retained.")
