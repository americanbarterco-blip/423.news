import unittest
from unittest.mock import patch
from scripts.claudia_research_executor import tokens, similarity, safe_url, feed_items, PageParser
class ResearchExecutorTests(unittest.TestCase):
    def test_overlap_scoring(self):
        self.assertGreater(similarity("Cleveland schools announce winter event","Cleveland schools winter event"),0.4)
    def test_unrelated_topic_low(self):
        self.assertLess(similarity("Cleveland school winter event","Miami beach tourism"),0.1)
    def test_local_urls_rejected(self):
        for url in ("http://localhost/a","http://127.0.0.1/","file:///etc/passwd","https://host.local/a"):
            with self.assertRaises(ValueError):safe_url(url)
    @patch("scripts.claudia_research_executor.socket.getaddrinfo",return_value=[(2,1,6,"",("93.184.216.34",0))])
    def test_public_https_accepted(self,_mock):
        self.assertEqual(safe_url("https://example.org/news"),"https://example.org/news")
    def test_feed_rss_and_atom_links(self):
        xml='<rss><channel><item><title>County announces park opening</title><link>https://county.gov/park</link><description>New public park</description></item></channel></rss>'
        rows=feed_items(xml,"https://county.gov/rss")
        self.assertEqual(rows[0]["url"],"https://county.gov/park")
        self.assertIn("park",rows[0]["title"])
    def test_html_title_and_text(self):
        parser=PageParser();parser.feed("<html><title>School Board Update</title><p>Meeting on Tuesday</p><script>noise</script></html>")
        data=parser.result()
        self.assertEqual(data["title"],"School Board Update")
        self.assertIn("Meeting on Tuesday",data["excerpt"])
        self.assertNotIn("noise",data["excerpt"])
if __name__=="__main__":unittest.main()
