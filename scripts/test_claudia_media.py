import tempfile,unittest
from pathlib import Path
from scripts.claudia_media import validate,MAX_BYTES
class Tests(unittest.TestCase):
 def test_valid_image(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"photo.png";p.write_bytes(b"png")
   self.assertEqual(validate(str(p),"caption","Alt text","Credit","","Permission")[2],"image/png")
 def test_alt_required_for_images(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"photo.png";p.write_bytes(b"x")
   with self.assertRaises(ValueError):validate(str(p),"caption","","credit","","rights")
 def test_rights_required(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"video.mp4";p.write_bytes(b"x")
   with self.assertRaises(ValueError):validate(str(p),"caption","","credit","","")
 def test_size_limit(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"video.mp4"
   with p.open("wb") as f:f.truncate(MAX_BYTES+1)
   with self.assertRaises(ValueError):validate(str(p),"caption","","credit","","rights")
if __name__=="__main__":unittest.main()
