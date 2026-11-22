import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/"livekit-agent"))
from claudia_public_search import parse_google_news,parse_reddit,parse_youtube,search_sources

class PublicSearchTests(unittest.TestCase):
    def test_google_rss_extracts_link_and_publisher(self):
        xml='<rss><channel><item><title>Local school board update</title><link>https://news.example/story</link><description>Agenda for Tuesday</description><pubDate>Tue, 21 Nov 2026 10:00:00 GMT</pubDate><source url="https://news.example">Example News</source></item></channel></rss>'
        rows=parse_google_news(xml)
        self.assertEqual(rows[0]["publisher"],"Example News")
        self.assertEqual(rows[0]["url"],"https://news.example/story")
        self.assertIn("Agenda",rows[0]["summary"])
    def test_reddit_parser_sanitizes_and_links(self):
        payload={"data":{"children":[{"data":{"title":"Public meeting discussion","permalink":"/r/chattanooga/comments/abc/post/","subreddit":"chattanooga","selftext":"Details <b>here</b>","created_utc":1,"score":5,"num_comments":3}}]}}
        rows=parse_reddit(payload)
        self.assertEqual(rows[0]["url"],"https://www.reddit.com/r/chattanooga/comments/abc/post/")
        self.assertEqual(rows[0]["publisher"],"r/chattanooga")
        self.assertNotIn("<b>",rows[0]["summary"])
    def test_youtube_parser(self):
        rows=parse_youtube({"items":[{"id":{"videoId":"abc123"},"snippet":{"title":"County update","channelTitle":"Local Channel","description":"Video report","publishedAt":"2026-11-21T10:00:00Z"}}]})
        self.assertEqual(rows[0]["url"],"https://www.youtube.com/watch?v=abc123")
        self.assertEqual(rows[0]["publisher"],"Local Channel")
    def test_empty_query_no_network(self):
        result=search_sources("")
        self.assertEqual(result["results"],[])
        self.assertEqual(result["source_status"],{})
if __name__=="__main__":unittest.main()
