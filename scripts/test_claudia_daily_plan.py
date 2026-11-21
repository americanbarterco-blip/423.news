import unittest
from scripts.claudia_daily_plan import build_plan
class PlannerTests(unittest.TestCase):
 def test_workstreams_exist(self):
  p=build_plan({"findings":[]})
  ids={t["id"] for t in p["tasks"]}
  self.assertTrue({"editorial-research","spanish-queue","seo-indexing","maintenance","audience-growth"}.issubset(ids))
  self.assertFalse(any(t["priority"]=="P0" for t in p["tasks"]))
 def test_findings_add_p0(self):
  p=build_plan({"findings":[{"level":"medium"}]})
  self.assertEqual(p["tasks"][0]["id"],"site-incident")
 def test_limits(self):
  self.assertTrue(build_plan({})["safety_limits"])
if __name__=="__main__": unittest.main()
