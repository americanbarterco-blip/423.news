"""Offline unit tests for Claudia's public health monitor."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from scripts import claudia_health as health


class HealthMonitorTests(unittest.TestCase):
    def fake_site(self, feed_time=None, sitemap_status=200, bad_url_status=200):
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
            return {"url": url, "final_url": url, "status": bad_url_status, "content_type": "text/html",
                    "body": "", "latency_ms": 1}
        return fake

    def test_healthy_site_has_no_findings(self):
        with patch.object(health, "fetch", side_effect=self.fake_site()):
            result = health.run()
        self.assertEqual(result["summary"]["passed"], result["summary"]["checks"])
        self.assertEqual(result["findings"], [])

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
