import unittest
import update_checkpoints as updater

class SobrietyCheckpointSummaryTests(unittest.TestCase):
    def setUp(self):
        updater.DUI_COUNTS.clear()
        updater.SEEN[0] = 0

    def test_sobriety_entries_aggregate_month_only(self):
        bulletin = """11/15/2026 Hamilton I-75 Sobriety
11/20/2026 Bradley US-64 Sobriety
11/22/2026 Hamilton I-24 Driver License
"""
        other = updater.parse(bulletin)
        self.assertEqual(updater.DUI_COUNTS, {"2026-11": 2})
        self.assertEqual(len(other), 1)
        self.assertEqual(other[0]["sub"], "Driver license checkpoint")
        # DUI entries aren't emitted as location/date records.
        self.assertFalse(any("Sobriety" in row.get("sub", "") for row in other))
        self.assertFalse(any("I-75" in row.get("location", "") for row in other))

if __name__ == "__main__":
    unittest.main()
