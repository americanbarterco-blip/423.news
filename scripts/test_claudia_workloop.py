import unittest
class QueueSmokeTest(unittest.TestCase):
 def test_module_import(self):
  import scripts.claudia_workloop as module
  self.assertTrue(callable(module.main))
if __name__=="__main__":unittest.main()
