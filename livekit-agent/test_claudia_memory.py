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
 def test_insert_is_read_after_write_verified(self):
  row={"id":"new-id","content":"Verified note.","kind":"fact","project":"423.news"}
  with patch.object(mem,"_request",side_effect=[[],[row],[row]]) as call:
   out=mem.save_memory("Verified note.",kind="fact")
   self.assertEqual(out,{"action":"saved","id":"new-id","verified":True})
   self.assertEqual(call.call_count,3)
 def test_update_requires_returned_row_and_verification(self):
  row={"id":"existing-id","content":"Existing note.","kind":"lesson","project":"423.news"}
  with patch.object(mem,"_request",side_effect=[[row],[row],[row]]) as call:
   out=mem.save_memory("Existing note.",kind="lesson")
   self.assertEqual(out,{"action":"updated","id":"existing-id","verified":True})
   self.assertEqual(call.call_count,3)
 def test_update_zero_rows_is_failure(self):
  row={"id":"existing-id","content":"Existing note."}
  with patch.object(mem,"_request",side_effect=[[row],[]]):
   with self.assertRaisesRegex(RuntimeError,"update was not confirmed"): mem.save_memory("Existing note.")
 def test_insert_without_representation_is_failure(self):
  with patch.object(mem,"_request",side_effect=[[],[]]):
   with self.assertRaisesRegex(RuntimeError,"insert was not confirmed"): mem.save_memory("New note.")
 def test_read_after_write_mismatch_is_failure(self):
  row={"id":"new-id","content":"Other content","kind":"fact","project":"423.news"}
  with patch.object(mem,"_request",side_effect=[[],[{"id":"new-id"}],[row]]):
   with self.assertRaisesRegex(RuntimeError,"could not be verified"): mem.save_memory("Expected content.")

if __name__=="__main__": unittest.main()
