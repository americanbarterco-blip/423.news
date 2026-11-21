import importlib.util, pathlib, unittest
from unittest.mock import patch
source=pathlib.Path(__file__).with_name("claudia_memory.py")
spec=importlib.util.spec_from_file_location("claudia_memory",source)
mem=importlib.util.module_from_spec(spec); spec.loader.exec_module(mem)
class Tests(unittest.TestCase):
 def test_tokenizer(self):
  self.assertEqual(set(mem.normalize("Bradley County: road repair")),{"bradley","county","road","repair"})
 def test_allowlist(self):
  with patch.object(mem,"_request",return_value=[]):
   with self.assertRaises(ValueError): mem.save_memory("example",kind="audio")
 def test_empty_recall(self):
  with patch.object(mem,"_request",return_value=[]): self.assertEqual(mem.recall("query"),[])
 def test_missing_creds(self):
  with patch.object(mem,"BASE",""),patch.object(mem,"KEY",""):
   with self.assertRaises(RuntimeError): mem.recall("x")
 def test_duplicate(self):
  rows=[{"id":"abc","content":"A stored lesson."}]
  with patch.object(mem,"_request",side_effect=[rows,[]]) as call:
   out=mem.save_memory("A stored lesson.",kind="lesson")
   self.assertEqual(out["action"],"updated"); self.assertEqual(call.call_count,2)
if __name__=="__main__": unittest.main()
