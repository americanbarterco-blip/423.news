#!/usr/bin/env python3
"""Idempotent lead-to-task queue intake. Does not conduct research or publish."""
import json, os, urllib.request
def api(base,key,path,method="GET",body=None,prefer=None):
 h={"apikey":key,"Authorization":"Bearer "+key}
 if body is not None:h["Content-Type"]="application/json"
 if prefer:h["Prefer"]=prefer
 req=urllib.request.Request(base.rstrip("/")+"/"+path,data=body,headers=h,method=method)
 with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.read().decode()
def main():
 base=os.environ.get("SUPABASE_URL","").strip();key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
 if not base or not key:print("Queue intake skipped: Supabase secrets unavailable.");return
 _,raw=api(base,key,"rest/v1/claudia_story_leads?status=eq.new&select=id,title,url,source_name,summary&order=discovered_at.desc&limit=100")
 leads=json.loads(raw);attempts=0
 for l in leads:
  task={"lead_id":l["id"],"task_type":"research_lead","title":l["title"],"priority":60,"result":{"lead_url":l["url"],"source":l["source_name"],"summary":l.get("summary","")}}
  api(base,key,"rest/v1/claudia_research_tasks","POST",json.dumps(task).encode(),"resolution=ignore-duplicates,return=minimal")
  attempts+=1
 print(f"Queue intake: {len(leads)} new leads; {attempts} idempotent enqueue attempts. No research or publication performed.")
if __name__=="__main__":main()
