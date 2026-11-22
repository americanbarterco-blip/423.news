import tempfile, unittest
from pathlib import Path
from scripts.claudia_audio_transcribe import SUPPORTED, transcribe_file

class FakeClient:
    class Files:
        def upload(self, file): return file
    class Interactions:
        def create(self, model, input):
            class R: output_text = "A sample transcript."
            return R()
    def __init__(self):
        self.files=self.Files();self.interactions=self.Interactions()

class Tests(unittest.TestCase):
    def test_supported_extensions(self):
        self.assertIn(".mp3",SUPPORTED)
        self.assertIn(".mp4",SUPPORTED)
        self.assertNotIn(".exe",SUPPORTED)
    def test_transcript_text_returned(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"audio.mp3";p.write_bytes(b"fake audio")
            self.assertEqual(transcribe_file(p,FakeClient()),"A sample transcript.")
    def test_empty_transcript_rejected(self):
        class Empty(FakeClient):
            class Interactions:
                def create(self, model, input):
                    class R: output_text = "  "
                    return R()
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"audio.wav";p.write_bytes(b"fake audio")
            with self.assertRaises(RuntimeError):transcribe_file(p,Empty())
if __name__=="__main__":unittest.main()
