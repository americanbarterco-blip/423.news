#!/usr/bin/env python3
"""Private review console for Claudia staged media manifests.

This tool reads the private staging manifest and allows an editor to mark media
approved/rejected. It does not make media public, create public URLs, or attach
media to articles. Approval means rights/credit/caption/alt text were reviewed.
"""
import argparse, json, os, urllib.parse, urllib.request

BASE=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
TABLE="claudia_story_media"

def request(method, path, data=None, headers=None):
    if not BASE or not KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    h={"apikey":KEY,"Authorization":"Bearer "+KEY}
    h.update(headers or {})
    req=urllib.request.Request(BASE+"/"+path,data=data,headers=h,method=method)
    with urllib.request.urlopen(req,timeout=30) as resp:
        body=resp.read()
        return json.loads(body) if body else None

def list_items(limit):
    q=urllib.parse.urlencode({"select":"id,lead_id,object_path,media_type,size_bytes,caption,alt_text,credit,source_url,rights_basis,status,created_at","order":"created_at.desc","limit":str(limit)})
    return request("GET","rest/v1/"+TABLE+"?"+q,headers={"Accept":"application/json"})

def review(media_id, status):
    if status not in ("approved","rejected"):
        raise ValueError("Review status must be approved or rejected.")
    q=urllib.parse.urlencode({"id":"eq."+media_id,"status":"eq.staged"})
    body=json.dumps({"status":status}).encode()
    result=request("PATCH","rest/v1/"+TABLE+"?"+q,body,{"Content-Type":"application/json","Prefer":"return=representation"})
    if not result:
        raise RuntimeError("No staged row updated. Confirm the ID exists and is still staged.")
    print(json.dumps(result,indent=2))

def main():
    ap=argparse.ArgumentParser(description="Review Claudia's privately staged media.")
    sub=ap.add_subparsers(dest="cmd",required=True)
    ls=sub.add_parser("list"); ls.add_argument("--limit",type=int,default=30)
    rv=sub.add_parser("review"); rv.add_argument("media_id"); rv.add_argument("--status",choices=["approved","rejected"],required=True)
    args=ap.parse_args()
    if args.cmd=="list":
        print(json.dumps(list_items(max(1,min(args.limit,100))),indent=2))
    else:
        review(args.media_id,args.status)
if __name__=="__main__": main()
