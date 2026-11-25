import json
import unittest
from unittest.mock import patch
from scripts.claudia_draft_writer import domain, distinct_domains, eligible_evidence, parse_model_json, source_list, leads_with_evidence, region_profile, classify_content, is_duplicate_title, requires_strong_verification

class ClaudiaAutoPublisherTests(unittest.TestCase):
    def test_bradley_and_polk_tie_for_top_priority_with_hamilton_second(self):
        polk = region_profile({"title":"Polk County commission meeting","summary":""})
        bradley = region_profile({"title":"Bradley County school board","summary":""})
        hamilton = region_profile({"title":"Hamilton County Schools","summary":""})
        self.assertEqual(polk["location_priority"], bradley["location_priority"])
        self.assertGreater(bradley["location_priority"], hamilton["location_priority"])
        self.assertGreater(polk["location_priority"], hamilton["location_priority"])
        self.assertEqual(region_profile({"title":"Rhea County road project","summary":""})["county"], "Rhea")
        self.assertEqual(region_profile({"title":"Grundy County meeting","summary":""})["county"], "Grundy")

    def test_county_classifier_does_not_infer_from_publisher_name(self):
        self.assertEqual(region_profile({"title":"Bristol holiday open house","summary":"Bristol Herald Courier reports this story"})["coverage_tier"], "outside_area")

    def test_sensitive_and_urgent_leads_always_require_strong_verification(self):
        self.assertTrue(requires_strong_verification({"title":"Fire crews respond to a house fire","summary":""}, []))
        self.assertTrue(requires_strong_verification({"title":"Missing person search continues","summary":""}, []))
        self.assertFalse(requires_strong_verification({"title":"County announces new library hours","summary":""}, []))

    def test_duplicate_detection_catches_exact_and_near_duplicate_headlines(self):
        existing=["Eight grants approved for Hurricane Helene projects in Unicoi County"]
        self.assertTrue(is_duplicate_title("Eight grants approved for Hurricane Helene projects in Unicoi County", existing))
        self.assertTrue(is_duplicate_title("Eight grants approved for Hurricane Helene projects in Unicoi County!", existing))
        self.assertFalse(is_duplicate_title("Polk County schools announce new calendar", existing))

    def test_domain_normalizes_www(self):
        self.assertEqual(domain("https://www.example.com/path"), "example.com")

    def test_evidence_filter_allows_single_source_for_onboarding(self):
        one=[{"evidence_type":"source","url":"https://a.com/x","excerpt":"x"}]
        self.assertEqual(len(eligible_evidence(one)),1)
        self.assertEqual(len(eligible_evidence(one,min_domains=2)),0)

    def test_evidence_filter_accepts_two_domains_after_onboarding(self):
        two=[{"evidence_type":"source","url":"https://a.com/x","excerpt":"x"},
             {"evidence_type":"corroboration","url":"https://b.org/y","excerpt":"y"}]
        self.assertEqual(len(eligible_evidence(two,min_domains=2)),2)
        self.assertEqual(len(distinct_domains(two)),2)

    def test_rejects_ineligible_evidence_types(self):
        items=[{"evidence_type":"media","url":"https://a.com","excerpt":"image"}]
        self.assertEqual(eligible_evidence(items),[])

    def test_model_json_validation(self):
        good={"title":"Title","summary":"Summary","body_markdown":"Body","editor_notes":"Check"}
        self.assertEqual(parse_model_json(json.dumps(good))["title"],"Title")
        with self.assertRaises((ValueError,json.JSONDecodeError)):
            parse_model_json('{"title":"only"}')

    def test_prompt_contains_newsroom_quality_standards(self):
        from scripts.claudia_draft_writer import build_prompt
        lead={"title":"Council approves project","summary":"Council voted."}
        evidence=[{"source_name":"Official source","url":"https://city.example/page","excerpt":"Council voted 4-1."}]
        prompt=build_prompt(lead,evidence,{"section":"government","topic":"government"},["Attribute claims clearly"])
        for phrase in ("Coverage priority: Bradley and Polk Counties tied for first","Provisional geographic match","Do not manufacture a county connection","verified connection to the 423 coverage area","accurate, specific headline","fact-first","Synthesize evidence across sources","Do not invent quotes","topic-neutral","FLAG-FEEDBACK LESSONS"):
            self.assertIn(phrase,prompt)

    @patch("scripts.claudia_draft_writer.api")
    def test_flag_lead_dismisses_only_that_item_and_keeps_audit_note(self,mocked_api):
        from scripts.claudia_draft_writer import flag_lead
        flag_lead("https://db.example","service-key",{"id":"lead-1","title":"Unverified claim","notes":"prior note"},"No independent corroboration")
        args=mocked_api.call_args.args
        self.assertEqual(args[2],"rest/v1/claudia_story_leads?id=eq.lead-1")
        self.assertEqual(args[3],"PATCH")
        patch=json.loads(args[4].decode())
        self.assertEqual(patch["status"],"dismissed")
        self.assertIn("CLAUDIA_AUTO_FLAGGED",patch["notes"])
        self.assertIn("prior note",patch["notes"])

    @patch("scripts.claudia_draft_writer.api")
    def test_missing_evidence_still_publishes_an_attributed_intake_brief(self,mocked_api):
        from scripts.claudia_draft_writer import process_lead
        mocked_api.side_effect=[(200,"[]"),(200,"[]"),(201,"[]"),(204,"")]
        lead={"id":"lead-2","title":"Unverified item","summary":"A source says a new project was announced.","url":"https://source.example/item","source_name":"Example News"}
        result=process_lead("https://db.example","service-key","","",lead,{"section":"news","topic":"general"})
        self.assertTrue(result)
        self.assertEqual(mocked_api.call_count,4)
        published=json.loads(mocked_api.call_args_list[2].args[4].decode())
        self.assertEqual(published["status"],"published")
        self.assertIn("Developing/source-attributed",published["body"])
        self.assertIn("https://source.example/item",published["body"])

    def test_writer_keeps_all_ingested_leads_even_without_evidence_rows(self):
        leads=[{"id":"1","title":"Has source"},{"id":"2","title":"No source"}]
        selected=leads_with_evidence("db","key",leads)
        self.assertEqual([row["id"] for row in selected],["1","2"])
    def test_community_human_interest_routes_to_news_community(self):
        from scripts.claudia_draft_writer import classify_content
        examples=[
            {"title":"Johnson City barber says goal is helping neurodivergent community","summary":""},
            {"title":"Cleveland Mayor Emeritus Tom Rowland celebrates 95th birthday","summary":""},
            {"title":"East Tennessee woman makes sure nursing home residents aren't forgotten during holidays","summary":""},
        ]
        for lead in examples:
            result=classify_content(lead)
            self.assertEqual(result["section"],"news",lead["title"])
            self.assertEqual(result["topic"],"community",lead["title"])

    def test_specific_sections_route_correctly(self):
        from scripts.claudia_draft_writer import classify_content
        examples=[
            ({"title":"High school football team wins championship","summary":""},"sports","sports"),
            ({"title":"County commission approves new budget at public meeting","summary":""},"government","government"),
            ({"title":"School district announces graduation schedule","summary":""},"schools","education"),
            ({"title":"Wildlife conservation project restores river habitat","summary":""},"outdoors","outdoors"),
            ({"title":"Local restaurant opens new location","summary":""},"news","business"),
        ]
        for lead,section,topic in examples:
            result=classify_content(lead)
            self.assertEqual(result["section"],section,lead["title"])
            self.assertEqual(result["topic"],topic,lead["title"])

    def test_source_links_deduplicated(self):
        links=source_list([{"url":"https://a.com","source_name":"A"},{"url":"https://a.com","source_name":"A"}])
        self.assertEqual(links.count("https://a.com"),1)

    @patch("scripts.claudia_draft_writer.openai_json")
    def test_sensitive_subject_is_not_a_topic_based_block(self, mocked):
        from scripts.claudia_draft_writer import verify_article
        mocked.return_value={"pass":True,"confidence":0.80,"unsupported_claims":[],"conflicting_claims":[],"sensitive":True,"reason":"Evidence supports facts"}
        draft={"title":"Report","summary":"Summary","body_markdown":"Article"}
        evidence=[{"url":"https://source.example/article","source_name":"Source","excerpt":"evidence"}]
        result=verify_article("model","key",{"title":"Local report"},evidence,draft,min_confidence=0.75)
        self.assertTrue(result["passed"])

    @patch("scripts.claudia_draft_writer.openai_json")
    def test_first_two_publications_use_75_percent_threshold(self, mocked):
        from scripts.claudia_draft_writer import verify_article
        mocked.return_value={"pass":True,"confidence":0.78,"unsupported_claims":[],"conflicting_claims":[],"sensitive":False,"reason":"Supported"}
        draft={"title":"Report","summary":"Summary","body_markdown":"Article"}
        evidence=[{"url":"https://source.example/article","source_name":"Source","excerpt":"evidence"}]
        self.assertTrue(verify_article("model","key",{"title":"Local report"},evidence,draft,min_confidence=0.75)["passed"])
        self.assertFalse(verify_article("model","key",{"title":"Local report"},evidence,draft,min_confidence=0.90)["passed"])

    @patch("scripts.claudia_draft_writer.api")
    def test_verification_attempt_counter(self, mocked_api):
        from scripts.claudia_draft_writer import verification_attempts
        mocked_api.return_value=(200,json.dumps([{"id":1},{"id":2}]))
        self.assertEqual(verification_attempts("db","key"),2)

if __name__=="__main__":
    unittest.main()
