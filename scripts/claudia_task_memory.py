#!/usr/bin/env python3
"""Persist Claudia's task statuses and resume unfinished work across scheduled runs.

Only fixed task identifiers/statuses and timestamps are saved. No story text,
source URLs, tips, transcripts, secrets, or personal information are persisted.
"""
from __future__ import annotations
import argparse, json, os, tempfile
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_TASKS = [
    ("editorial-research", "Research fresh 423-area stories and prepare corroborated drafts"),
    ("spanish-queue", "Maintain Spanish coverage parity and translation drafts"),
    ("seo-indexing", "Audit SEO, canonical URLs, sitemap, metadata, and indexability"),
    ("maintenance", "Review health findings and propose tested maintenance fixes"),
    ("audience-growth", "Prepare zero-cost audience growth and outreach drafts"),
]
ALLOWED_STATUS = {"pending", "in_progress", "completed", "blocked"}
def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
def seed():
    return {task_id: {"status":"pending","created_at":now(),"updated_at":now(),"last_seen_run":0}
            for task_id,_ in DEFAULT_TASKS}
def load_memory(path: Path):
    try:
        data=json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data,dict) or not isinstance(data.get("tasks"),dict):
            raise ValueError("invalid memory format")
        cleaned={}
        for task_id,entry in data["tasks"].items():
            if task_id not in {k for k,_ in DEFAULT_TASKS} or not isinstance(entry,dict): continue
            status=entry.get("status","pending")
            if status not in ALLOWED_STATUS: status="pending"
            cleaned[task_id]={"status":status,"created_at":str(entry.get("created_at",now()))[:40],
              "updated_at":str(entry.get("updated_at",now()))[:40],
              "last_seen_run":max(0,int(entry.get("last_seen_run",0)))}
        return {"version":1,"run_count":max(0,int(data.get("run_count",0))),"tasks":cleaned}
    except (OSError,ValueError,TypeError,json.JSONDecodeError):
        return {"version":1,"run_count":0,"tasks":{}}
def update_memory(path:Path):
    mem=load_memory(path); run=mem["run_count"]+1; stamp=now()
    for task_id,_ in DEFAULT_TASKS:
        entry=mem["tasks"].setdefault(task_id,{"status":"pending","created_at":stamp,"updated_at":stamp,"last_seen_run":0})
        if entry["status"]=="completed":
            # Completed tasks roll back to pending for a new daily cycle.
            entry["status"]="pending"
        entry["last_seen_run"]=run
        entry["updated_at"]=stamp
    mem.update({"version":1,"run_count":run,"updated_at":stamp})
    # Atomic write, including when process is interrupted mid-write.
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix=path.name+".",suffix=".tmp",dir=str(path.parent))
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as f:
            json.dump(mem,f,indent=2); f.write("\n")
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
    return mem
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--memory",default="claudia-work-memory.json")
    args=parser.parse_args()
    result=update_memory(Path(args.memory))
    print(f"Memory cycle {result['run_count"]}: {len(result['tasks'])} tasks resumed/initialized.")
if __name__=="__main__": main()
