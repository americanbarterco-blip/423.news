import tempfile, unittest
from pathlib import Path
from scripts.claudia_site_coverage_audit import audit, classify_link
class CoverageAuditTests(unittest.TestCase):
 def test_hash_routes_and_external_links_ignored(self):
  self.assertIsNone(classify_link('#/news'))
  self.assertIsNone(classify_link('https://example.org'))
  self.assertEqual(classify_link('/about.html'),'/about.html')
 def test_detects_broken_links_and_metadata(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);(root/'index.html').write_text('<title>Home</title><meta name="description" content="desc"><link rel="canonical" href="https://example.test/"><a href="/ok.html">ok</a><a href="/missing.html">broken</a>')
   (root/'ok.html').write_text('<title>OK</title>')
   r=audit(root)
   self.assertEqual(len(r['missing_local_links']),1)
   self.assertEqual(r['missing_local_links'][0]['href'],'/missing.html')
   self.assertEqual(r['status'],'needs_attention')
 def test_clean_site_passes(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);(root/'index.html').write_text('<title>Home</title><meta name="description" content="desc"><link rel="canonical" href="https://example.test/">')
   self.assertEqual(audit(root)['status'],'pass')
if __name__=='__main__':unittest.main()
