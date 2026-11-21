#!/usr/bin/env python3
"""Persist Claudia task statuses between runs; records no private newsroom content."""
from __future__ import annotations
import argparse, json, os, tempfile
from datetime import datetime, timezone
from pathlib import Path
DEFAULT_TASKS=("editorial-research","spanish-queue","seo-indexing","maintenance","audience-growth")
STATUSES={"pending","in_progress","completed","blocked"}
def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds")
def load_memory(path):
    try:
        raw=json.loads(path.read_text(encoding="utf-8"))
        tasks=raw.get("tasks",{})
        if not isinstance(tasks,dict): raise ValueError("invalid tasks")
        clean={}
        for key,value in tasks.items():
            if key not in DEFAULT_TASKS or not isinstance(value,dict): continue
            status=value.get("status","pending")
            if status not in STATUSES: status="pending"
            clean[key]={"status":status,"created_at":str(value.get("created_at",now()))[:40],
              "updated_at":str(value.get("updated_at",now()))[:40],"last_seen_run":max(0,int(value.get("last_seen_run",0)))}
        return {"version":1,"run_count":max(0,int(raw.get("run_count",0))),"tasks":clean}
    except (OSError,ValueError,TypeError,json.JSONDecodeError):
        return {"version":1,"run_count":0,"tasks":{}}
def write_atomic(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix=path.name+".",suffix=".tmp",dir=str(path.parent))
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as stream:
            json.dump(data,stream,indent=2);stream.write("\\n")
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
def update_memory(path):
    memory=load_memory(path);cycle=memory["run_count"]+1;stamp=now()
    for task_id in DEFAULT_TASKS:
        task=memory["tasks"].setdefault(task_id,{"status":"pending","created_at":stamp,"updated_at":stamp,"last_seen_run":0})
        if task["status"]=="completed": task["status"]="pending"
        task["last_seen_run"]=cycle;task["updated_at"]=stamp
    memory.update({"version":1,"run_count":cycle,"updated_at":stamp})
    write_atomic(path,memory);return memory
def set_status(path,task_id,status):
    if task_id not in DEFAULT_TASKS or status not in STATUSES: raise ValueError("Unknown task ID or invalid status")
    data=load_memory(path)
    if task_id not in data["tasks"]: data["tasks"][task_id]={"status":"pending","created_at":now(),"updated_at":now(),"last_seen_run":data["run_count"]}
    data["tasks"][task_id]["status"]=status;data["tasks"][task_id]["updated_at"]=now()
    write_atomic(path,data);return data
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--memory",default="claudia-work-memory.json")
    p.add_argument("--set",dest="set_status",help="Update status task-id=status")
    args=p.parse_args();path=Path(args.memory)
    result=update_memory(path)
    if args.set_status:
        if "=" not in args.set_status: p.error("--set format is task-id=status")
        key,status=args.set_status.split("=",1)
        try: result=set_status(path,key,status)
        except ValueError as error: p.error(str(error))
    print("Claudia memory cycle %s: %s tasks tracked" % (result["run_count"],len(result["tasks"])))
if __name__=="__main__": main()
