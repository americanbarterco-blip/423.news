#!/usr/bin/env python3
"""Idempotent lead-to-task queue intake. Does not conduct research or publish."""
import json, os, urllib.parse, urllib.request, urllib.error

def api(base,key,path,method="GET",body=None,prefer=None):
 h={"apikey":key,"Authorization":"Bearer "+key}
 if body is not None:h["Content-Type"]="application/json"
 if prefer:h["Prefer"]=prefer
 req=urllib.request.Request(base.rstrip("/")+"/"+path,data=body,headers=h,method=method)
 with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.read().decode()

def filter_unqueued(leads,existing_ids):
 """Return only leads without an existing research_lead task, preserving order."""
 seen=set(existing_ids);out=[]
 for lead in leads:
  lead_id=lead.get("id")
  if lead_id and lead_id not in seen:
   seen.add(lead_id);out.append(lead)
 return out

def fetch_existing_task_lead_ids(base,key,leads):
 ids=[l.get("id") for l in leads if l.get("id")]
 existing=set()
 # Keep REST URLs bounded; PostgREST accepts the UUID list as an in-filter.
 for start in range(0,len(ids),100):
  batch=ids[start:start+100]
  if not batch:continue
  path="rest/v1/claudia_research_tasks?select=lead_id&lead_id=in.("+",".join(batch)+")&task_type=eq.research_lead"
  _,raw=api(base,key,path)
  existing.update(row.get("lead_id") for row in json.loads(raw) if row.get("lead_id"))
 return existing

def main():
 base=os.environ.get("SUPABASE_URL","").strip();key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
 if not base or not key:print("Queue intake skipped: Supabase secrets unavailable.");return
 _,raw=api(base,key,"rest/v1/claudia_story_leads?status=eq.new&select=id,title,url,source_name,summary&order=discovered_at.desc&limit=1000")
 leads=json.loads(raw)
 existing=fetch_existing_task_lead_ids(base,key,leads)
 missing=filter_unqueued(leads,existing)
 queued=0;failed=0
 for l in missing:
  task={"lead_id":l["id"],"task_type":"research_lead","title":l["title"],"priority":60,"result":{"lead_url":l["url"],"source":l["source_name"],"summary":l.get("summary","")}}
  try:
   api(base,key,"rest/v1/claudia_research_tasks","POST",json.dumps(task).encode(),"return=minimal")
   queued+=1
  except urllib.error.HTTPError as exc:
   failed+=1
   try:detail=exc.read().decode("utf-8","replace")[:300]
   except Exception:detail="(response body unavailable)"
   # Unique-constraint races are benign; other failures are visible and do not abort intake.
   print(f"Queue insert failed for lead {l.get('id','?')}: HTTP {exc.code}: {detail}")
  except Exception as exc:
   failed+=1
   print(f"Queue insert failed for lead {l.get('id','?')}: {type(exc).__name__}: {str(exc)[:300]}")
 print(f"Queue intake: {len(leads)} new leads checked, {len(existing)} already had tasks, {queued} queued, {failed} failed. No research or publication performed.")
if __name__=="__main__":main()
