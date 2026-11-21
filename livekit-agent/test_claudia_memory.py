import unittest
from unittest.mock import patch
from livekit_agent import claudia_memory as mem

class MemoryUnitTests(unittest.TestCase):
    def test_tokenizer(self):
        self.assertEqual(set(mem.normalize("Bradley County: road repair")), {"bradley","county","road","repair"})
    def test_memory_types_allowlist(self):
        with patch.object(mem, "_request", return_value=[]):
            with self.assertRaises(ValueError):
                mem.save_memory("text", kind="scanner_audio")
    def test_empty_memory_recall(self):
        with patch.object(mem, "_request", return_value=[]):
            self.assertEqual(mem.recall("anything"), [])
    def test_no_credentials_fail_closed(self):
        with patch.object(mem, "BASE", ""), patch.object(mem, "KEY", ""):
            with self.assertRaises(RuntimeError):
                mem.recall("test")
    def test_exact_duplicate_updates_not_inserts(self):
        existing=[{"id":"123","content":"The newsroom requires source corroboration."}]
        with patch.object(mem, "_request", side_effect=[existing, []]) as req:
            result=mem.save_memory("The newsroom requires source corroboration.",kind="lesson")
            self.assertEqual(result["action"],"updated")
            self.assertEqual(req.call_count,2)

if __name__=="__main__":
    unittest.main()
