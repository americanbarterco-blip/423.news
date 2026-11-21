import unittest
from scripts.claudia_discovery import parse_feed, parse_html, fingerprint

class DiscoveryTests(unittest.TestCase):
    def test_feed_rss_item(self):
        xml='<rss><channel><item><title>County opens new public park</title><link>https://example.org/park</link><description>Park information</description><pubDate>Sat, 21 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>'
        source={"name":"Example","url":"https://example.org/feed","type":"feed"}
        rows=parse_feed(xml,source)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["title"],"County opens new public park")
        self.assertEqual(rows[0]["url"],"https://example.org/park")
    def test_atom_link(self):
        xml='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>School announces winter concert</title><link href="https://example.org/event"/><updated>2026-11-20</updated></entry></feed>'
        rows=parse_feed(xml,{"name":"Atom","url":"https://example.org","type":"feed"})
        self.assertEqual(rows[0]["url"],"https://example.org/event")
    def test_html_links_filter_and_resolve(self):
        html='<a href="/news/1">Local community event announcement has long title</a><a href="javascript:bad">ignore this link</a><a href="/x">tiny</a>'
        rows=parse_html(html,{"name":"Web","url":"https://example.org/news","type":"web"})
        self.assertEqual(rows[0]["url"],"https://example.org/news/1")
        self.assertEqual(len(rows),1)
    def test_url_fingerprint_stable(self):
        self.assertEqual(fingerprint("https://example.org/a"),fingerprint("https://example.org/a"))
        self.assertNotEqual(fingerprint("https://example.org/a"),fingerprint("https://example.org/b"))
if __name__=="__main__": unittest.main()
