import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import claudia


class ClaudiaScannerConfigTests(unittest.TestCase):
    def test_default_config_path_matches_documented_location(self):
        self.assertEqual(claudia.DEFAULT_CONFIG, ROOT / "scanner" / "config.json")

    def test_data_path_defaults_inside_repository(self):
        self.assertEqual(claudia.data_path({}), (ROOT / "data" / "feed.json").resolve())

    def test_explicit_relative_data_path_is_root_relative(self):
        self.assertEqual(claudia.data_path({"data_path": "data/feed.json"}),
                         (ROOT / "data" / "feed.json").resolve())


if __name__ == "__main__":
    unittest.main()
