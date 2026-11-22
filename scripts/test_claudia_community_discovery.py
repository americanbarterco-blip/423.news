import unittest
from scripts.claudia_community_discovery import parse_reddit,parse_youtube,relevant,category,REDDIT_QUERIES,YOUTUBE_QUERIES,reddit_public_fetch,community_ingest_path
class CommunityDiscoveryTests(unittest.TestCase):
    def test_reddit_author_not_stored_and_local_filter(self):
        payload={"data":{"children":[{"data":{"title":"Chattanooga road closure update","subreddit":"Chattanooga","permalink":"/r/Chattanooga/comments/abc/post","selftext":"Road work downtown","created_utc":1790000000,"author":"privateusername"}}]}}
        rows=parse_reddit(payload)
        self.assertEqual(len(rows),1)
        self.assertNotIn("author",rows[0])
        self.assertIn("reddit.com",rows[0]["url"])
    def test_statewide_nonlocal_post_filtered(self):
        payload={"data":{"children":[{"data":{"title":"Statewide policy debate","subreddit":"Tennessee","permalink":"/r/Tennessee/comments/abc/post","selftext":"Nothing local here","created_utc":1790000000}}]}}
        self.assertEqual(parse_reddit(payload,"Tennessee"),[])
    def test_local_keyword_matches_statewide_sub(self):
        self.assertTrue(relevant("Bradley County meeting","", "Tennessee"))
    def test_youtube_metadata_to_video_url(self):
        rows=parse_youtube({"items":[{"id":{"videoId":"abc123"},"snippet":{"title":"Local sports highlights","description":"Highlights","channelTitle":"School TV","publishedAt":"2026-11-20T12:00:00Z"}}]})
        self.assertEqual(rows[0]["url"],"https://www.youtube.com/watch?v=abc123")
        self.assertEqual(rows[0]["source_type"],"video")
    def test_incident_category_classifies_not_verified(self):
        self.assertEqual(category("Reported shooting and police investigation"),"violent-crime")
        row=parse_reddit({"data":{"children":[{"data":{"title":"Reported shooting in Chattanooga","subreddit":"Chattanooga","permalink":"/r/Chattanooga/comments/abc/post","selftext":"Unconfirmed community report","created_utc":1790000000}}]}})
        self.assertIn("NOT VERIFIED",row[0]["summary"])
    @patch("scripts.claudia_community_discovery.time.sleep")
    @patch("scripts.claudia_community_discovery.request")
    def test_public_reddit_fallback_without_credentials(self, mock_request,_mock_sleep):
        payload={"data":{"children":[{"data":{"title":"Chattanooga road closure update","subreddit":"Tennessee","permalink":"/r/Tennessee/comments/abc/post","selftext":"Local road work in Chattanooga","created_utc":1790000000}}]}}
        mock_request.return_value=(200,payload)
        rows=reddit_public_fetch()
        self.assertEqual(len(rows),1)
        self.assertIn("Chattanooga",rows[0]["title"])
    def test_community_ingestion_targets_fingerprint(selfself):
        self.assertEqual(community_ingest_path(),"rest/v1/claudia_story_leads?on_conflict=fingerprint")
    def test_search_query_coverage(self):
        self.assertIn("shooting",REDDIT_QUERIES)
        self.assertTrue(any("police" in q.lower() for q in YOUTUBE_QUERIES))
if __name__=="__main__":unittest.main()
