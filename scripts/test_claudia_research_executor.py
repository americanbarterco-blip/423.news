import unittest
from unittest.mock import patch
from scripts.claudia_research_executor import tokens, similarity, safe_url, feed_items, PageParser, retry_patch, evidence_insert_path, google_news_candidates, url_domain
class ResearchExecutorTests(unittest.TestCase):
    def test_evidence_insert_targets_unique_constraint(self):
        self.assertEqual(evidence_insert_path(), "rest/v1/claudia_story_evidence?on_conflict=lead_id,evidence_type,url")

    def test_domain_uses_final_publisher_host(self):
        self.assertEqual(url_domain("https://www.news.example/article"),"news.example")
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
    @patch("scripts.claudia_research_executor.safe_url",side_effect=lambda url:url)
    @patch("scripts.claudia_research_executor.fetch_raw")
    def test_google_news_finds_independent_publisher(self,mock_fetch,_mock_safe):
        xml='<rss><channel><item><title>Cleveland school board meeting update</title><link>https://news.google.com/rss/articles/ABCD?oc=5</link><description>Budget agenda at public meeting</description><source url="https://news.example">Example Local News</source></item></channel></rss>'
        mock_fetch.return_value=(xml,"application/rss+xml","https://news.google.com/rss/search")
        task={"title":"Cleveland school board meeting","result":{"summary":"budget meeting agenda","lead_url":"https://original.example/story"}}
        rows=google_news_candidates(task)
        self.assertEqual(rows[0]["source_name"],"Example Local News")
        self.assertEqual(rows[0]["url"],"https://news.google.com/rss/articles/ABCD?oc=5")
        self.assertEqual(rows[0]["source_url"],"https://news.example")
    def test_retry_backoff_and_exhaustion(self):
        patch,delay=retry_patch({"attempt_count":2,"max_attempts":4},RuntimeError("temporary"))
        self.assertEqual(patch["status"],"queued")
        self.assertEqual(delay,600)
        exhausted,delay2=retry_patch({"attempt_count":4,"max_attempts":4},ValueError("bad input"))
        self.assertEqual(exhausted["status"],"blocked")
        self.assertIsNone(delay2)
    def test_html_title_and_text(self):
        parser=PageParser();parser.feed("<html><title>School Board Update</title><p>Meeting on Tuesday</p><script>noise</script></html>")
        data=parser.result()
        self.assertEqual(data["title"],"School Board Update")
        self.assertIn("Meeting on Tuesday",data["excerpt"])
        self.assertNotIn("noise",data["excerpt"])
if __name__=="__main__":unittest.main()
