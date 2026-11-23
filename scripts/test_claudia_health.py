"""Offline unit tests for Claudia's public health monitor."""
import json
import unittest
from pathlib import Path
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from scripts import claudia_health as health




class MetaCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta = {}
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = attrs.get("name") or attrs.get("property")
            if key:
                self.meta[key.lower()] = attrs.get("content", "")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


class HealthMonitorTests(unittest.TestCase):
    def fake_site(self, feed_time=None, sitemap_status=200, bad_url_status=200, redirect_url=None):
        now = datetime.now(timezone.utc)
        feed_time = feed_time or now.isoformat()
        sitemap = '<urlset><url><loc>https://423.news/</loc></url></urlset>'
        def fake(url, method="GET"):
            if url.endswith("/robots.txt"):
                return {"url": url, "final_url": url, "status": 200, "content_type": "text/plain",
                        "body": "Sitemap: https://423.news/sitemap.xml\n", "latency_ms": 1}
            if url.endswith("/sitemap.xml"):
                return {"url": url, "final_url": url, "status": sitemap_status, "content_type": "application/xml",
                        "body": sitemap if sitemap_status == 200 else "", "latency_ms": 1}
            if url.endswith("/feed.json"):
                return {"url": url, "final_url": url, "status": 200, "content_type": "application/json",
                        "body": json.dumps({"generated_at": feed_time}), "latency_ms": 1}
            final_url = redirect_url if method == "HEAD" and url == "https://423.news/" and redirect_url else url
            return {"url": url, "final_url": final_url, "status": bad_url_status, "content_type": "text/html",
                    "body": "", "latency_ms": 1}
        return fake

    def test_static_sitemap_uses_clean_routes(self):
        sitemap = (Path(__file__).resolve().parent.parent / "sitemap.xml").read_text(encoding="utf-8")
        root = ET.fromstring(sitemap)
        locs = {node.text.strip() for node in root.findall(".//{*}loc") if node.text}
        expected = {
            "https://423.news/", "https://423.news/es/",
            "https://423.news/news", "https://423.news/live-wire",
            "https://423.news/traffic", "https://423.news/checkpoints",
            "https://423.news/community", "https://423.news/events",
            "https://423.news/es/noticias", "https://423.news/es/trafico",
            "https://423.news/es/deportes", "https://423.news/es/comunidad",
            "https://423.news/es/eventos", "https://423.news/es/reportes",
            "https://423.news/es/claudia", "https://423.news/areas",
        }
        self.assertTrue(expected.issubset(locs), "missing canonical sitemap URLs")
        legacy_static = {url for url in locs if url.endswith(".html") and "/story.html?slug=" not in url}
        self.assertEqual(legacy_static, set(), "sitemap contains redirecting legacy .html routes")

    def test_homepage_static_fallback_contains_h1_and_intro(self):
        html = (Path(__file__).resolve().parent.parent / "index.html").read_text(encoding="utf-8")
        self.assertIn("<h1>Local News Across Southeast Tennessee</h1>", html)
        self.assertIn("423.news brings local reporting", html)

    def test_spanish_homepage_metadata_lengths_and_consistency(self):
        html = (Path(__file__).resolve().parent.parent / "es" / "index.html").read_text(encoding="utf-8")
        parser = MetaCollector()
        parser.feed(html)
        self.assertLessEqual(len(parser.title.strip()), 60)
        for key in ("description", "og:description", "twitter:description"):
            self.assertIn(key, parser.meta)
            self.assertLessEqual(len(parser.meta[key]), 160, key)
        for key in ("og:title", "twitter:title"):
            self.assertIn(key, parser.meta)
            self.assertEqual(parser.meta[key], parser.title.strip())

    def test_healthy_site_has_no_findings(self):
        with patch.object(health, "fetch", side_effect=self.fake_site()):
            result = health.run()
        self.assertEqual(result["summary"]["passed"], result["summary"]["checks"])
        self.assertEqual(result["findings"], [])

    def test_sitemap_redirect_is_detected(self):
        with patch.object(health, "fetch", side_effect=self.fake_site(redirect_url="https://423.news/news")):
            result = health.run()
        self.assertTrue(any(f["title"] == "Sitemap URL redirects" for f in result["findings"]))

    def test_failed_sitemap_is_detected(self):
        with patch.object(health, "fetch", side_effect=self.fake_site(sitemap_status=503)):
            result = health.run()
        self.assertTrue(any(f["title"] == "Sitemap request failed" for f in result["findings"]))

    def test_stale_fallback_feed_is_info_not_failure(self):
        stale = (datetime.now(timezone.utc) - timedelta(hours=80)).isoformat()
        with patch.object(health, "fetch", side_effect=self.fake_site(feed_time=stale)):
            result = health.run()
        self.assertTrue(any(f["level"] == "info" and f["title"] == "Static fallback feed is old" for f in result["findings"]))
        self.assertFalse(any(f["level"] in {"high", "medium"} for f in result["findings"]))


if __name__ == "__main__":
    unittest.main()
