import json
import unittest
from scripts.claudia_draft_writer import domain, distinct_domains, eligible_evidence, parse_model_json, risk_flags, source_list

class OpenAIOnlyDraftWriterTests(unittest.TestCase):
    def test_domain_normalizes_www(self):
        self.assertEqual(domain("https://www.example.com/path"), "example.com")

    def test_evidence_requires_two_independent_domains(self):
        one=[{"evidence_type":"source","url":"https://a.com/x","excerpt":"x"}]
        self.assertEqual(eligible_evidence(one),[])
        two=one+[{"evidence_type":"corroboration","url":"https://b.org/y","excerpt":"y"}]
        self.assertEqual(len(eligible_evidence(two)),2)
        self.assertEqual(len(distinct_domains(two)),2)

    def test_rejects_ineligible_evidence_types(self):
        items=[{"evidence_type":"media","url":"https://a.com","excerpt":"image"},{"evidence_type":"source","url":"https://b.com","excerpt":"text"}]
        self.assertEqual(eligible_evidence(items),[])

    def test_model_json_validation(self):
        good={"title":"Title","summary":"Summary","body_markdown":"Body","editor_notes":"Check"}
        self.assertEqual(parse_model_json(json.dumps(good))["title"],"Title")
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            parse_model_json('{"title":"only"}')

    def test_source_links_deduplicated(self):
        links=source_list([{"url":"https://a.com","source_name":"A"},{"url":"https://a.com","source_name":"A"}])
        self.assertEqual(links.count("https://a.com"),1)

    def test_sensitive_story_flags(self):
        self.assertIn("shooting",risk_flags("Reported shooting investigation"))

if __name__=="__main__":
    unittest.main()
