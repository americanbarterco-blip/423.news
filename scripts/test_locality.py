import unittest

from locality import check_report, local_places


class ExpandedRegionalLocalityTests(unittest.TestCase):
    def test_expanded_counties_and_communities_are_recognized(self):
        places = [
            "Grundy County", "Tracy City", "Altamont", "Coalmont",
            "Polk County", "Benton", "Copperhill", "Ducktown",
            "McMinn County", "Athens", "Rhea County", "Dayton", "Spring City",
            "Bradley County", "Cleveland", "Hamilton County", "Chattanooga",
        ]
        for place in places:
            with self.subTest(place=place):
                self.assertTrue(local_places(place), f"{place} was not recognized")

    def test_story_about_newly_added_community_passes(self):
        ok, reasons = check_report({
            "headline": "Tracy City approves new community park",
            "summary": "Grundy County officials approved funding for the project."
        })
        self.assertTrue(ok, reasons)

    def test_dateline_alone_does_not_make_story_local(self):
        ok, reasons = check_report({
            "headline": "National market report reviews technology stocks",
            "summary": "A syndicated publisher based in Chattanooga filed this report."
        })
        self.assertFalse(ok)
        self.assertTrue(reasons)


if __name__ == "__main__":
    unittest.main()
