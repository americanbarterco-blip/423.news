#!/usr/bin/env python3
"""Stage authorized editor media privately; require source, credit and rights metadata."""
import argparse, hashlib, json, mimetypes, os, re, urllib.parse, urllib.request
from pathlib import Path
BUCKET="claudia-media-staging"; MAX_BYTES=50*1024*1024
ALLOWED={"image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm"}
def validate(path,caption,alt,credit,source_url,rights_basis):
 p=Path(path)
 if not p.is_file(): raise ValueError("Media file not found.")
 size=p.stat().st_size
 if size<=0 or size>MAX_BYTES: raise ValueError("File must be between 1 byte and 50 MB.")
 mime=mimetypes.guess_type(p.name)[0] or "application/octet-stream"
 if mime not in ALLOWED: raise ValueError("Allowed media: JPEG, PNG, WebP, GIF, MP4, WebM.")
 if not caption.strip() or len(caption)>500: raise ValueError("Caption required (max 500 chars).")
 if mime.startswith("image/") and (not alt.strip() or len(alt)>500): raise ValueError("Image alt text required (max 500 chars).")
 if not credit.strip() or len(credit)>300: raise ValueError("Creator credit required (max 300 chars).")
 if not rights_basis.strip() or len(rights_basis)>500: raise ValueError("Rights/permission basis required (max 500 chars).")
 if source_url and not source_url.startswith(("https://","http://")): raise ValueError("Source URL must be HTTP(S).")
 return p,size,mime
def request(url,key,method,path,data=None,extra=None):
 h={"apikey":key,"Authorization":"Bearer "+key}
 if extra:h.update(extra)
 req=urllib.request.Request(url.rstrip("/")+"/"+path,data=data,headers=h,method=method)
 with urllib.request.urlopen(req,timeout=45) as r:return r.status,r.read()
def stage(args):
 base=os.environ.get("SUPABASE_URL","").strip(); key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
 if not base or not key:raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.")
 p,size,mime=validate(args.file,args.caption,args.alt,args.credit,args.source_url,args.rights_basis)
 lead=args.lead_id or ""; digest=hashlib.sha256(p.read_bytes()).hexdigest()
 name=re.sub(r"[^a-zA-Z0-9._-]+","-",p.name)[:120] or "asset"
 path=(lead+"/" if lead else "unlinked/")+digest[:24]+"-"+name
 encoded="/".join(urllib.parse.quote(x,safe="") for x in path.split("/"))
 request(base,key,"POST",f"storage/v1/object/{BUCKET}/{encoded}",p.read_bytes(),{"Content-Type":mime,"x-upsert":"false"})
 rec={"lead_id":lead or None,"bucket":BUCKET,"object_path":path,"media_type":mime,"size_bytes":size,"sha256":digest,"caption":args.caption.strip(),"alt_text":args.alt.strip() or None,"credit":args.credit.strip(),"source_url":args.source_url.strip() or None,"rights_basis":args.rights_basis.strip(),"status":"staged"}
 _,body=request(base,key,"POST","rest/v1/claudia_story_media",json.dumps(rec).encode(),{"Content-Type":"application/json","Prefer":"return=representation"})
 print("Private staged media manifest:",body.decode()[:1200]);print("Status staged only; no public URL or article attachment.")
def main():
 ap=argparse.ArgumentParser(description="Upload approved-rights media to Claudia's private staging bucket.")
 ap.add_argument("file");ap.add_argument("--lead-id",default="");ap.add_argument("--caption",required=True);ap.add_argument("--alt",default="")
 ap.add_argument("--credit",required=True);ap.add_argument("--source-url",default="");ap.add_argument("--rights-basis",required=True)
 stage(ap.parse_args())
if __name__=="__main__":main()
