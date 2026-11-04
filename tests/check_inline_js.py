#!/usr/bin/env python3
"""Syntax-check inline JavaScript blocks in root HTML files with Node.js."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys


class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return
        attrs = dict(attrs)
        if attrs.get("src"):
            return
        kind = (attrs.get("type") or "").lower()
        if kind and kind not in ("text/javascript", "application/javascript", "module"):
            return
        self.current = {"type": kind, "parts": []}

    def handle_data(self, data):
        if self.current is not None:
            self.current["parts"].append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self.current is not None:
            source = "".join(self.current["parts"]).strip()
            if source:
                self.blocks.append((self.current["type"], source))
            self.current = None


def main():
    html_files = sorted(Path(".").glob("*.html"))
    failures = []
    checked = 0
    for page in html_files:
        parser = ScriptParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for index, (kind, source) in enumerate(parser.blocks, 1):
            args = ["node", "--check"]
            if kind == "module":
                args.append("--input-type=module")
            result = subprocess.run(args, input=source, text=True, capture_output=True)
            checked += 1
            if result.returncode:
                failures.append(f"{page} inline script {index}:\n{result.stderr}")
    print(f"Checked {checked} inline JavaScript block(s) across {len(html_files)} HTML file(s).")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
