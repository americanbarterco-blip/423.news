import json
import unittest
from unittest.mock import patch
from scripts.claudia_draft_writer import domain, distinct_domains, eligible_evidence, parse_model_json, risk_flags, source_list, leads_with_evidence

class OpenAIOnlyDraftWriterTests(unittest.TestCase):
    def test_domain_normalizes_www(self):
        self.assertEqual(domain("https://www.example.com/path"), "example.com")

    def test_evidence_requires_two_independent_domains(self):
        one=[{"evidence_type":"source","url":"https://a.com/x","excerpt":"x"}]
        self.assertEqual(eligible_evidence(one),[])
        two=one+[{"evidence_type":"corroboration","url":"https://b.org/y","excerpt":"y"}]
        self.assertEqual(len(eligible_evidence(two)),2)
        self.assertEqual(len(distinct_domains(two)),2)

    def test_primary_source_can_support_private_draft_only(self):
        one=[{"evidence_type":"source","url":"https://primary.example/story","excerpt":"confirmed article text"}]
        self.assertEqual(eligible_evidence(one),[])
        self.assertEqual(len(eligible_evidence(one,min_domains=1)),1)

    def test_rejects_ineligible_evidence_types(self):
        items=[{"evidence_type":"media","url":"https://a.com","excerpt":"image"},{"evidence_type":"source","url":"https://b.com","excerpt":"text"}]
        self.assertEqual(eligible_evidence(items),[])

    def test_model_json_validation(self):
        good={"title":"Title","summary":"Summary","body_markdown":"Body","editor_notes":"Check"}
        self.assertEqual(parse_model_json(json.dumps(good))["title"],"Title")
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            parse_model_json('{"title":"only"}')

    @patch("scripts.claudia_draft_writer.api")
    def test_writer_filters_to_leads_with_evidence(self,mocked_api):
        mocked_api.return_value=(200,json.dumps([{"lead_id":"1"}]))
        leads=[{"id":"1","title":"Has source"},{"id":"2","title":"No source"}]
        selected=leads_with_evidence("db","key",leads)
        self.assertEqual([row["id"] for row in selected],["1"])

    def test_source_links_deduplicated(self):
        links=source_list([{"url":"https://a.com","source_name":"A"},{"url":"https://a.com","source_name":"A"}])
        self.assertEqual(links.count("https://a.com"),1)

    def test_sensitive_story_flags(self):
        self.assertIn("shooting",risk_flags("Reported shooting investigation"))

    @patch("scripts.claudia_draft_writer.api")
    def test_save_draft_always_private(self, mocked_api):
        from scripts.claudia_draft_writer import save_draft
        mocked_api.return_value=(201,"{}")
        lead={"id":123,"title":"Local update","summary":"Summary"}
        evidence=[{"url":"https://one.example/a","source_name":"One"},{"url":"https://two.example/b","source_name":"Two"}]
        draft={"title":"Draft","summary":"Short summary","body_markdown":"Body","editor_notes":"Review"}
        classification={"section":"news","topic":"general","priority_score":50,"priority_reason":"baseline"}
        verification={"passed":True,"confidence":0.95,"result":{"reason":"supported"}}
        save_draft("https://db.example","key",lead,evidence,draft,classification,verification)
        payload=json.loads(mocked_api.call_args.args[4].decode())
        self.assertEqual(payload["status"],"needs_review")
        self.assertEqual(payload["verification_status"],"verified")
        self.assertIsNone(payload["published_at"])

    @patch("scripts.claudia_draft_writer.api")
    def test_unverified_draft_is_still_private(self, mocked_api):
        from scripts.claudia_draft_writer import save_draft
        mocked_api.return_value=(201,"{}")
        lead={"id":124,"title":"Local update","summary":"Summary"}
        evidence=[{"url":"https://one.example/a","source_name":"One"},{"url":"https://two.example/b","source_name":"Two"}]
        draft={"title":"Draft","summary":"Short summary","body_markdown":"Body","editor_notes":"Review"}
        classification={"section":"news","topic":"general","priority_score":50,"priority_reason":"baseline"}
        save_draft("https://db.example","key",lead,evidence,draft,classification,None)
        payload=json.loads(mocked_api.call_args.args[4].decode())
        self.assertEqual(payload["status"],"needs_review")
        self.assertEqual(payload["verification_status"],"unverified")
        self.assertIsNone(payload["published_at"])

if __name__=="__main__":
    unittest.main()
