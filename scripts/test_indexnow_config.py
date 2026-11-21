import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY_FILE = ROOT / "ef61166f0435493c9aae43c3d90a25cf.txt"
DEPLOY_WORKFLOW = ROOT / ".github/workflows/deploy-423-news-cloudflare.yml"
SITEMAP = ROOT / "sitemap.xml"
ROBOTS = ROOT / "robots.txt"
PAGES_WORKFLOW = ROOT / ".github/workflows/refresh-story-sitemap.yml"

class IndexNowDeploymentTests(unittest.TestCase):
    def test_verification_key_matches_filename(self):
        key = KEY_FILE.read_text(encoding="utf-8").strip()
        self.assertEqual(KEY_FILE.stem, key)
        self.assertRegex(key, r"^[a-f0-9]{32}$")

    def test_cloudflare_deploy_triggers_for_text_assets(self):
        workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("      - '**/*.txt'", workflow)

    def test_sitemap_lists_unique_clean_canonical_urls(self):
        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        root = ET.parse(SITEMAP).getroot()
        locs = [node.text.strip() for node in root.findall(f".//{ns}loc") if node.text]
        self.assertTrue(locs)
        self.assertEqual(len(locs), len(set(locs)), "Sitemap locations should be unique")
        self.assertFalse(any(url.endswith(".html") for url in locs), "Sitemap should use clean canonical routes")
        self.assertFalse(any(url.startswith("http://423.news/") for url in locs), "Sitemap should use HTTPS")

    def test_pages_deploy_triggers_for_indexnow_key_and_workflow(self):
        workflow = PAGES_WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("  push:", workflow)
        self.assertIn('      - "ef61166f0435493c9aae43c3d90a25cf.txt"', workflow)
        self.assertIn('      - ".github/workflows/refresh-story-sitemap.yml"', workflow)

    def test_robots_points_to_canonical_sitemap(self):
        robots = ROBOTS.read_text(encoding="utf-8")
        self.assertIn("Sitemap: https://423.news/sitemap.xml", robots)

if __name__ == "__main__":
    unittest.main()
