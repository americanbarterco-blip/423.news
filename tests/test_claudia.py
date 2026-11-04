import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import claudia
import supabase_sync


class ClaudiaScannerTests(unittest.TestCase):
    def test_example_config_points_at_root_feed(self):
        config = json.loads(Path("config.example.json").read_text())
        self.assertEqual(config["data_path"], "feed.json")
        self.assertGreaterEqual(len(config["feeds"]), 4)
        for feed in config["feeds"]:
            self.assertTrue(feed["feed_id"])
            self.assertTrue(feed["page_url"].startswith("https://www.broadcastify.com/listen/feed/"))

    def test_online_broadcastify_page_is_detected_as_live(self):
        self.assertTrue(claudia.LIVE_RE.search("<div>Online · 85 listening</div>"))
        self.assertFalse(claudia.LIVE_RE.search("<div>Offline</div>"))

    def test_report_file_is_a_draft_and_does_not_put_claudia_on_air(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            feed_path = root / "feed.json"
            feed_path.write_text(json.dumps({
                "reports": [],
                "claudia": {"status": "at-desk", "on_air": True, "line": "old state"},
                "scanner": {"feeds": [], "log": []}
            }))
            report_path = root / "report.json"
            report_path.write_text(json.dumps({
                "id": "test-draft-1",
                "kind": "HEARD",
                "confidence": "unconfirmed",
                "headline": "Test scanner report draft",
                "summary": "This is a test-only draft."
            }))
            cfg = {"data_path": str(feed_path), "work_dir": str(root / "work"), "feeds": []}
            claudia.cmd_file(cfg, report_path)
            saved = json.loads(feed_path.read_text())
            self.assertFalse(saved["reports"][0]["published"])
            self.assertFalse(saved["claudia"]["on_air"])
            self.assertEqual(saved["claudia"]["status"], "at-desk")

    def test_status_rows_expose_source_url_and_capture_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            feed_path = Path(tmp) / "feed.json"
            feed_path.write_text(json.dumps({"reports": [], "scanner": {"feeds": [], "log": []}}))
            cfg = {
                "data_path": str(feed_path),
                "feeds": [{
                    "name": "Example Feed",
                    "feed_id": "123",
                    "page_url": "https://www.broadcastify.com/listen/feed/123",
                    "priority": 1
                }]
            }
            with patch.object(claudia, "status_for", return_value={
                "status": "active", "listeners": 8, "connected": True
            }):
                block = claudia.cmd_status(cfg, quiet=True)
            self.assertEqual(block["feeds"][0]["url"], cfg["feeds"][0]["page_url"])
            self.assertFalse(block["feeds"][0]["capture_enabled"])


class SupabaseSyncTests(unittest.TestCase):
    def test_missing_publication_flag_never_defaults_to_publish(self):
        with patch.object(supabase_sync, "call") as mocked:
            supabase_sync.sync_reports([{
                "id": "legacy-report",
                "headline": "Existing local report",
                "summary": "A previously filed report."
            }])
        rows = mocked.call_args.args[2]
        self.assertNotIn("published", rows[0])

    def test_explicit_draft_flag_is_preserved(self):
        with patch.object(supabase_sync, "call") as mocked:
            supabase_sync.sync_reports([{
                "id": "new-draft",
                "headline": "New report draft",
                "summary": "Awaiting editor approval.",
                "published": False
            }])
        rows = mocked.call_args.args[2]
        self.assertIs(rows[0]["published"], False)


if __name__ == "__main__":
    unittest.main()
