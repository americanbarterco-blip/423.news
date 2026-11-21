import unittest
from scripts.claudia_community_discovery import parse_reddit,parse_youtube,relevant
class CommunityDiscoveryTests(unittest.TestCase):
    def test_reddit_author_not_stored_and_local_filter(self):
        payload={"data":{"children":[{"data":{"title":"Chattanooga road closure update","subreddit":"Chattanooga","permalink":"/r/Chattanooga/comments/abc/post","selftext":"Road work downtown","created_utc":1790000000,"author":"privateusername"}}]}}
        rows=parse_reddit(payload)
        self.assertEqual(len(rows),1)
        self.assertNotIn("author",rows[0])
        self.assertIn("reddit.com",rows[0]["url"])
    def test_statewide_nonlocal_post_filtered(self):
        payload={"data":{"children":[{"data":{"title":"Statewide policy debate","subreddit":"Tennessee","permalink":"/r/Tennessee/comments/abc/post","selftext":"Nothing local here","created_utc":1790000000}}]}}
        self.assertEqual(parse_reddit(payload),[])
    def test_local_keyword_matches_statewide_sub(self):
        self.assertTrue(relevant("Bradley County meeting","", "Tennessee"))
    def test_youtube_metadata_to_video_url(self):
        rows=parse_youtube({"items":[{"id":{"videoId":"abc123"},"snippet":{"title":"Local sports highlights","description":"Highlights","channelTitle":"School TV","publishedAt":"2026-11-20T12:00:00Z"}}]})
        self.assertEqual(rows[0]["url"],"https://www.youtube.com/watch?v=abc123")
        self.assertEqual(rows[0]["source_type"],"video")
if __name__=="__main__":unittest.main()
