import unittest
from scripts.claudia_workloop import filter_unqueued

class QueueSmokeTest(unittest.TestCase):
 def test_module_import(self):
  import scripts.claudia_workloop as module
  self.assertTrue(callable(module.main))

 def test_skips_existing_and_duplicate_leads(self):
  leads=[{"id":"a"},{"id":"b"},{"id":"a"},{"id":"c"}]
  self.assertEqual(filter_unqueued(leads,{"b"}),[{"id":"a"},{"id":"c"}])

 def test_empty_lead_ids_are_skipped(self):
  self.assertEqual(filter_unqueued([{"id":None},{"title":"no id"}],set()),[])

if __name__=="__main__":unittest.main()
