import unittest
from scripts.claudia_research_executor import tokens, similarity, safe_url
class ResearchExecutorTests(unittest.TestCase):
    def test_overlap_scoring(self):
        self.assertGreater(similarity("Cleveland schools announce winter event","Cleveland schools winter event"),0.4)
    def test_unrelated_topic_low(self):
        self.assertLess(similarity("Cleveland school winter event","Miami beach tourism"),0.1)
    def test_local_urls_rejected(self):
        for url in ("http://localhost/a","http://127.0.0.1/","file:///etc/passwd","https://host.local/a"):
            with self.assertRaises(ValueError):safe_url(url)
    def test_public_https_accepted(self):
        self.assertEqual(safe_url("https://example.org/news"),"https://example.org/news")
if __name__=="__main__":unittest.main()
