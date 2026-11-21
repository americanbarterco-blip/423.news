import unittest
from scripts.claudia_draft_writer import domain, distinct_domains, eligible_evidence, parse_model_json, risk_flags, source_list
class DraftWriterTests(unittest.TestCase):
    def test_domains_normalize_www(self):
        self.assertEqual(domain("https://www.example.com/path"),"example.com")
    def test_requires_two_domains(self):
        one=[{"evidence_type":"source","url":"https://a.com/x","excerpt":"a"}]
        self.assertEqual(eligible_evidence(one),[])
        two=one+[{"evidence_type":"corroboration","url":"https://b.org/y","excerpt":"b"}]
        self.assertEqual(len(eligible_evidence(two)),2)
    def test_rejects_non_article_evidence(self):
        data=[{"evidence_type":"media","url":"https://a.com","excerpt":"photo"},{"evidence_type":"source","url":"https://b.org","excerpt":"story"}]
        self.assertEqual(eligible_evidence(data),[])
    def test_model_json_validation(self):
        import json
        good={"title":"Title","summary":"Summary","body_markdown":"Body","editor_notes":"Review"}
        self.assertEqual(parse_model_json(json.dumps(good))["title"],"Title")
        with self.assertRaises(ValueError):parse_model_json('{"title":"x"}')
    def test_source_links_are_appended(self):
        result=source_list([{"url":"https://a.com","source_name":"A"},{"url":"https://a.com","source_name":"A"}])
        self.assertEqual(result.count("https://a.com"),1)
    def test_sensitive_story_flags(self):
        self.assertIn("shooting",risk_flags("Reported shooting investigation"))
if __name__=="__main__":unittest.main()
