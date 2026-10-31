# Claudia's own voice (free)

Kokoro is open-source (Apache-2.0) offline text-to-speech, and the most natural free voice I know of. No account, key or fee. Piper stays available as a lighter fallback (ENGINE = "piper").

1. `pip install kokoro-onnx soundfile numpy` (Python 3.9–3.12; also install ffmpeg for small mp3s)
2. After a report is filed: `python3 voice_render.py --feed feed.json --outdir voice`
   - first run downloads the Kokoro voice model (about 300 MB, one time) into `voice-models/`
   - writes `voice/<report id>.mp3` and adds `"audio"` to that report in feed.json
3. Upload `voice/` and the updated feed.json with the site. Leave `voice-models/` out of the upload.

GitHub Actions step (after the step that files reports):

    - run: sudo apt-get install -y ffmpeg && pip install kokoro-onnx soundfile numpy && python3 voice_render.py --feed feed.json --outdir voice

Change the voice: edit KOKORO_VOICE (af_heart, af_bella, af_nicole, af_sarah, af_sky) or KOKORO_SPEED at the top of voice_render.py (samples: rhasspy.github.io/piper-samples).
Only published text is voiced. Unconfirmed scanner items are always introduced as unconfirmed.
