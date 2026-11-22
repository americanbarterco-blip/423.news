#!/usr/bin/env python3
"""Transcribe media from Claudia's latest public discovery artifacts into private review artifacts.

Direct media URLs are downloaded with a strict size cap. YouTube URLs are handled with
yt-dlp under duration/size limits. No transcript or media is published automatically.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path
from claudia_audio_transcribe import transcribe_file, SUPPORTED

MAX_BYTES = 50 * 1024 * 1024
MAX_ITEMS = 3
DIRECT_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".mp4", ".webm"}

def load_leads(paths):
    rows = []
    for path in paths:
        p = Path(path)
        if not p.exists(): continue
        try: data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError): continue
        rows.extend(data if isinstance(data, list) else data.get("leads", []))
    unique = {}
    for lead in rows:
        url = lead.get("url", "")
        if url.startswith(("https://", "http://")):
            unique.setdefault(hashlib.sha256(url.encode()).hexdigest(), lead)
    return list(unique.values())

def direct_media_url(url):
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    return ext in DIRECT_EXTS

def fetch_direct(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent":"423.news Claudia media transcription/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        declared = response.headers.get("Content-Length")
        if declared and int(declared) > MAX_BYTES: raise ValueError("Media exceeds 50 MB cap.")
        total = 0
        with dest.open("wb") as out:
            while True:
                chunk = response.read(1024 * 128)
                if not chunk: break
                total += len(chunk)
                if total > MAX_BYTES: raise ValueError("Downloaded media exceeds 50 MB cap.")
                out.write(chunk)
    return dest

def youtube_url(url):
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    return host in {"youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com", "youtube-nocookie.com"}

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--discovery", default="claudia-discovery.json")
    ap.add_argument("--community", default="claudia-community-discovery.json")
    ap.add_argument("--out", default="claudia-transcripts")
    ap.add_argument("--limit", type=int, default=MAX_ITEMS)
    args = ap.parse_args()
    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")):
        print("Media transcription skipped: Gemini API key not configured."); return 0
    leads = load_leads([args.discovery, args.community])
    candidates = [lead for lead in leads if youtube_url(lead["url"]) or direct_media_url(lead["url"])]
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    already = {p.stem for p in out.glob("*.json")}
    count = 0; failures = 0
    for lead in candidates:
        if count >= max(1, min(args.limit, MAX_ITEMS)): break
        uid = hashlib.sha256(lead["url"].encode()).hexdigest()[:16]
        if uid in already: continue
        try:
            with tempfile.TemporaryDirectory(prefix="claudia-media-") as td:
                tmp = Path(td)
                if youtube_url(lead["url"]):
                    downloaded = tmp / (uid + ".mp3")
                    cmd = ["yt-dlp", "--no-playlist", "--max-filesize", "50M",
                           "--match-filter", "duration <= 1800", "--format", "bestaudio/best",
                           "--extract-audio", "--audio-format", "mp3", "--audio-quality", "5",
                           "--output", str(downloaded), lead["url"]]
                    subprocess.run(cmd, check=True, timeout=180, capture_output=True, text=True)
                    files = list(tmp.glob(uid + ".*"))
                    if not files: raise RuntimeError("yt-dlp produced no audio file")
                    media = files[0]
                else:
                    ext = Path(urllib.parse.urlparse(lead["url"]).path).suffix.lower()
                    media = fetch_direct(lead["url"], tmp / (uid + ext))
                if media.stat().st_size > MAX_BYTES: raise ValueError("Media file exceeds 50 MB cap")
                transcript = transcribe_file(media)
                txt = out / (uid + ".txt")
                meta = out / (uid + ".json")
                txt.write_text(transcript + "\n", encoding="utf-8")
                meta.write_text(json.dumps({"id":uid,"source_url":lead["url"],"source_name":lead.get("source_name"),"title":lead.get("title"),"media_file":media.name,"transcript_file":txt.name,"model":os.getenv("CLAUDIA_TRANSCRIBE_MODEL","gemini-3.5-transcribe"),"transcribed":True,"private_review_only":True},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
                print("Transcribed:", lead.get("title","(untitled)"), "=>", txt.name); count += 1
        except Exception as exc:
            print("Media transcription failed:", lead.get("title","(untitled)"), type(exc).__name__, str(exc)[:180]); failures += 1
    print(f"Discovered-media transcript batch: {count} transcribed, {failures} failed.")
    return 1 if failures else 0
if __name__ == "__main__": sys.exit(main())
