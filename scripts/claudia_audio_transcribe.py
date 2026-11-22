#!/usr/bin/env python3
"""Transcribe authorized newsroom audio/video files with Gemini; never publishes transcripts.

Drop files in scripts/media-inbox (mp3, wav, m4a, mp4, webm). Transcripts are written
locally to claudia-transcripts/ and uploaded as workflow artifacts, not posted publicly.
"""
from __future__ import annotations
import argparse, os, json, sys
from pathlib import Path

SUPPORTED={".mp3",".wav",".m4a",".aac",".flac",".ogg",".mp4",".webm"}
MODEL=os.environ.get("CLAUDIA_TRANSCRIBE_MODEL","gemini-3.5-transcribe")

def transcribe_file(path: Path, client=None):
    if client is None:
        from google import genai
        client=genai.Client(http_options={"api_version":"v1beta"})
    uploaded=client.files.upload(file=str(path))
    response=client.interactions.create(model=MODEL,input=[uploaded])
    text=getattr(response,"output_text",None)
    if not isinstance(text,str) or not text.strip():
        raise RuntimeError("Gemini returned an empty transcript")
    return text.strip()

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--inbox",default="scripts/media-inbox")
    ap.add_argument("--out",default="claudia-transcripts")
    args=ap.parse_args();inbox=Path(args.inbox);out=Path(args.out)
    files=sorted(p for p in inbox.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED) if inbox.exists() else []
    if not files:
        print(f"Audio transcription skipped: no supported files found in {inbox}.");return 0
    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GEMINI_API_KEY")):
        print("Audio transcription skipped: Gemini API key not configured.");return 0
    out.mkdir(parents=True,exist_ok=True);ok=0;fail=0
    for path in files:
        target=out/(path.stem+".txt")
        if target.exists(): print(f"Already transcribed, skipped: {path.name}");continue
        try:
            transcript=transcribe_file(path)
            target.write_text(transcript+"\\n",encoding="utf-8")
            meta={"file":path.name,"model":MODEL,"transcript_file":target.name,"transcribed":True}
            (out/(path.stem+".json")).write_text(json.dumps(meta,indent=2)+"\\n",encoding="utf-8")
            print(f"Transcribed: {path.name} -> {target.name}");ok+=1
        except Exception as exc:
            print(f"Transcription failed for {path.name}: {type(exc).__name__}: {exc}");fail+=1
    print(f"Transcription batch complete: {ok} successful, {fail} failed.")
    return 1 if fail else 0
if __name__=="__main__":sys.exit(main())
