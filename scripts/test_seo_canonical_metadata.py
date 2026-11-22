"""Regression tests for canonical/hreflang alignment on priority 423.news landing pages."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

EXPECTED = {
    "news.html": {
        "canonical": "https://423.news/news",
        "hreflang": {
            "en": "https://423.news/news",
            "es": "https://423.news/es/noticias",
            "x-default": "https://423.news/news",
        },
    },
    "live-wire.html": {
        "canonical": "https://423.news/live-wire",
        "hreflang": {
            "en": "https://423.news/live-wire",
            "es": "https://423.news/es/claudia",
            "x-default": "https://423.news/live-wire",
        },
    },
    "es/noticias.html": {
        "canonical": "https://423.news/es/noticias",
        "hreflang": {
            "es": "https://423.news/es/noticias",
            "en": "https://423.news/news",
            "x-default": "https://423.news/news",
        },
    },
    "es/claudia.html": {
        "canonical": "https://423.news/es/claudia",
        "hreflang": {
            "es": "https://423.news/es/claudia",
            "en": "https://423.news/live-wire",
            "x-default": "https://423.news/live-wire",
        },
    },
}

class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.hreflang = {}
        self.og_urls = []
        self.in_noscript = False
        self.noscript_h1 = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link":
            if attrs.get("rel") == "canonical":
                self.canonicals.append(attrs.get("href"))
            if attrs.get("rel") == "alternate" and attrs.get("hreflang"):
                self.hreflang[attrs["hreflang"]] = attrs.get("href")
        if tag == "meta" and attrs.get("property") == "og:url":
            self.og_urls.append(attrs.get("content"))
        if tag == "noscript":
            self.in_noscript = True
        if tag == "h1" and self.in_noscript:
            self.noscript_h1 += 1

    def handle_endtag(self, tag):
        if tag == "noscript":
            self.in_noscript = False

class CanonicalMetadataTests(unittest.TestCase):
    def parse(self, relative):
        parser = MetadataParser()
        parser.feed((ROOT / relative).read_text(encoding="utf-8"))
        return parser

    def test_priority_pages_use_clean_canonical_and_language_urls(self):
        for relative, expected in EXPECTED.items():
            with self.subTest(page=relative):
                parser = self.parse(relative)
                self.assertEqual(parser.canonicals, [expected["canonical"]])
                self.assertEqual(parser.hreflang, expected["hreflang"])
                self.assertEqual(parser.og_urls, [expected["canonical"]])

    def test_claudia_pages_have_non_javascript_heading_fallbacks(self):
        for relative in ("live-wire.html", "es/claudia.html"):
            with self.subTest(page=relative):
                parser = self.parse(relative)
                self.assertGreaterEqual(parser.noscript_h1, 1)

if __name__ == "__main__":
    unittest.main()
