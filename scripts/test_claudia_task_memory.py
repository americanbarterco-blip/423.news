import json
import tempfile
import unittest
from pathlib import Path

from scripts.claudia_task_memory import load_memory, set_status, update_memory


class MemoryTests(unittest.TestCase):
    def test_first_run_seeds_whitelisted_tasks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            memory = update_memory(path)
            self.assertEqual(memory["run_count"], 1)
            self.assertEqual(memory["tasks"]["editorial-research"]["status"], "pending")
            self.assertEqual(len(memory["tasks"]), 5)

    def test_atomic_file_round_trips_and_run_count_increments(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            update_memory(path)
            second = update_memory(path)
            self.assertEqual(second["run_count"], 2)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["run_count"], 2)

    def test_resume_preserves_in_progress(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            memory = update_memory(path)
            memory["tasks"]["maintenance"]["status"] = "in_progress"
            path.write_text(json.dumps(memory), encoding="utf-8")
            resumed = update_memory(path)
            self.assertEqual(resumed["run_count"], 2)
            self.assertEqual(resumed["tasks"]["maintenance"]["status"], "in_progress")

    def test_completed_resets_next_cycle(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            memory = update_memory(path)
            memory["tasks"]["seo-indexing"]["status"] = "completed"
            path.write_text(json.dumps(memory), encoding="utf-8")
            resumed = update_memory(path)
            self.assertEqual(resumed["tasks"]["seo-indexing"]["status"], "pending")

    def test_unknown_task_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            memory = update_memory(path)
            memory["tasks"]["dangerous-task"] = {"status": "in_progress"}
            path.write_text(json.dumps(memory), encoding="utf-8")
            self.assertNotIn("dangerous-task", update_memory(path)["tasks"])

    def test_corrupt_json_recovered(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            path.write_text("{broken", encoding="utf-8")
            self.assertEqual(update_memory(path)["run_count"], 1)

    def test_status_update_is_limited_to_whitelisted_tasks_and_states(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memory.json"
            update_memory(path)
            updated = set_status(path, "maintenance", "blocked")
            self.assertEqual(updated["tasks"]["maintenance"]["status"], "blocked")
            with self.assertRaises(ValueError):
                set_status(path, "unlisted-task", "completed")
            with self.assertRaises(ValueError):
                set_status(path, "maintenance", "unknown")


if __name__ == "__main__":
    unittest.main()
