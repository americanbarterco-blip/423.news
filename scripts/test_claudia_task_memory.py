import json, tempfile, unittest
from pathlib import Path
from scripts.claudia_task_memory import update_memory, load_memory
class MemoryTests(unittest.TestCase):
 def test_first_run_seeds_whitelisted_tasks(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"memory.json"; m=update_memory(p)
   self.assertEqual(m["run_count"],1)
   self.assertEqual(m["tasks"]["editorial-research"]["status"],"pending")
   self.assertEqual(len(m["tasks"]),5)
 def test_resume_preserves_in_progress(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"memory.json"; m=update_memory(p)
   m["tasks"]["maintenance"]["status"]="in_progress"; p.write_text(json.dumps(m))
   m2=update_memory(p)
   self.assertEqual(m2["run_count"],2)
   self.assertEqual(m2["tasks"]["maintenance"]["status"],"in_progress")
 def test_completed_resets_next_cycle(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"memory.json"; m=update_memory(p)
   m["tasks"]["seo-indexing"]["status"]="completed"; p.write_text(json.dumps(m))
   m2=update_memory(p)
   self.assertEqual(m2["tasks"]["seo-indexing"]["status"],"pending")
 def test_unknown_task_removed(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"memory.json"; m=update_memory(p)
   m["tasks"]["dangerous-task"]={"status":"in_progress"}; p.write_text(json.dumps(m))
   self.assertNotIn("dangerous-task",update_memory(p)["tasks"])
 def test_corrupt_json_recovered(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"memory.json"; p.write_text("{broken")
   self.assertEqual(update_memory(p)["run_count"],1)
if __name__=="__main__": unittest.main()
