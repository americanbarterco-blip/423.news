#!/usr/bin/env python3
"""Scheduled public community/video lead discovery for Claudia; no auto-publishing."""
from __future__ import annotations
import hashlib,json,os,time,urllib.parse,urllib.request,urllib.error,base64
from pathlib import Path
from datetime import datetime,timezone,timedelta

UA="423.news-Claudia-CommunityResearch/2.0 (+https://423.news/)"
SUBREDDITS=("Chattanooga","Tennessee","ClevelandTN","UTC")
LOCAL_TERMS=("423","chattanooga","cleveland tn","cleveland, tn","hamilton county","bradley county","soddy-daisy","east ridge","dayton tn","polk county tn","rhea county","ooltewah","hixson","signal mountain","sweetwater","meigs county","sequatchie county")
CRIME_TERMS=("shooting","shots fired","police","arrest","robbery","homicide","assault","missing","crash","wreck","fire","rescue","pursuit","burglary","theft","investigation","sheriff","crime","incident","emergency","breaking")
REDDIT_QUERIES=("shooting","police","arrest","crime","fire","crash","missing person","breaking news","incident","robbery","pursuit","rescue")
REDDIT_PUBLIC_QUERIES=("Chattanooga Cleveland Tennessee","Chattanooga police","Cleveland Tennessee police","Hamilton County schools","Bradley County schools","local event","road closure","missing person Tennessee")
YOUTUBE_QUERIES=("Chattanooga Tennessee breaking police crime shooting arrest","Hamilton County Tennessee police incident breaking","Cleveland Tennessee Bradley County crime police arrest","423 Tennessee fire crash rescue emergency","Soddy Daisy East Ridge Hixson police incident")
def fingerprint(url):return hashlib.sha256(url.strip().encode("utf-8")).hexdigest()
def category(text):
 t=text.lower()
 if any(w in t for w in ("shooting","shots fired","homicide","murder","assault")):return "violent-crime"
 if any(w in t for w in ("arrest","robbery","burglary","theft","pursuit","police","sheriff","warrant")):return "crime-public-safety"
 if any(w in t for w in ("missing person","endangered","amber alert")):return "missing-person-alert"
 if any(w in t for w in ("fire","rescue","crash","wreck","emergency")):return "emergency-incident"
 return "community-trending"
def relevant(title,body,subreddit):
 text=(title+" "+body).lower()
 if subreddit.lower() in ("chattanooga","clevelandtn","utc"):return True
 return any(term in text for term in LOCAL_TERMS)
def parse_reddit(payload,subreddit=""):
 rows=[]
 for child in payload.get("data",{}).get("children",[]):
  post=child.get("data",{});title=(post.get("title") or "").strip();sub=(post.get("subreddit") or subreddit).strip();permalink=post.get("permalink") or ""
  if not title or not permalink or not sub:continue
  url=urllib.parse.urljoin("https://www.reddit.com",permalink);body=(post.get("selftext") or "").strip()[:1600]
  if not relevant(title,body,sub):continue
  published=post.get("created_utc");date=datetime.fromtimestamp(published,tz=timezone.utc).isoformat() if published else None
  label=category(title+" "+body)
  rows.append({"title":title[:300],"url":url,"summary":"[LEAD CLASSIFICATION: "+label+"; NOT VERIFIED] "+body,"published":date,"source_name":"Reddit r/"+sub,"source_url":"https://www.reddit.com/r/"+sub+"/","source_type":"community","fingerprint":fingerprint(url)})
 return rows
def parse_youtube(payload):
 rows=[]
 for item in payload.get("items",[]):
  video=item.get("id",{}).get("videoId");snippet=item.get("snippet",{});title=(snippet.get("title") or "").strip()
  if not video or not title:continue
  url="https://www.youtube.com/watch?v="+video;summary=(snippet.get("description") or "").strip()[:1600];channel=snippet.get("channelTitle") or "YouTube";published=snippet.get("publishedAt")
  label=category(title+" "+summary)
  rows.append({"title":title[:300],"url":url,"summary":"[LEAD CLASSIFICATION: "+label+"; NOT VERIFIED] "+summary,"published":published,"source_name":"YouTube · "+channel,"source_url":"https://www.youtube.com/","source_type":"video","fingerprint":fingerprint(url)})
 return rows
def request(url,headers=None,body=None,method="GET"):
 req=urllib.request.Request(url,data=body,headers=headers or {"User-Agent":UA},method=method)
 with urllib.request.urlopen(req,timeout=20) as res:return res.status,json.loads(res.read().decode("utf-8"))
def reddit_public_fetch():
 rows=[]
 for query in REDDIT_PUBLIC_QUERIES:
  q=query
  params=urllib.parse.urlencode({"q":q,"sort":"new","t":"week","limit":30})
  url="https://www.reddit.com/search.json?"+params
  try:
   _,payload=request(url,{"User-Agent":UA,"Accept":"application/json"})
   rows.extend(parse_reddit(payload))
  except urllib.error.HTTPError as e:
   try:detail=e.read().decode("utf-8","replace")[:200]
   except Exception:detail=""
   print(f"Public Reddit search skipped {query}: HTTP {e.code} {e.reason} {detail}")
  except Exception as e:print("Public Reddit search skipped",query,type(e).__name__)
  time.sleep(0.2)
 unique={}
 for row in rows:unique.setdefault(row["fingerprint"],row)
 return list(unique.values())

def reddit_fetch():
 client=os.environ.get("REDDIT_CLIENT_ID","").strip();secret=os.environ.get("REDDIT_CLIENT_SECRET","").strip()
 if not client or not secret:print("Reddit OAuth unavailable; using public Reddit search.");return reddit_public_fetch()
 auth=base64.b64encode((client+":"+secret).encode()).decode()
 _,token=request("https://www.reddit.com/api/v1/access_token",{"Authorization":"Basic "+auth,"User-Agent":UA,"Content-Type":"application/x-www-form-urlencoded"},b"grant_type=client_credentials","POST")
 access=token.get("access_token")
 if not access:raise RuntimeError("Reddit OAuth response missing access token")
 rows=[]
 for sub in SUBREDDITS:
  for query in REDDIT_QUERIES:
   params=urllib.parse.urlencode({"q":query,"restrict_sr":"1","sort":"new","t":"week","limit":30})
   url="https://oauth.reddit.com/r/"+sub+"/search?"+params
   try:
    _,payload=request(url,{"Authorization":"Bearer "+access,"User-Agent":UA})
    rows.extend(parse_reddit(payload,sub))
   except Exception as e:print("Reddit search skipped",sub,query,type(e).__name__)
   time.sleep(0.35)
 unique={}
 for row in rows:unique.setdefault(row["fingerprint"],row)
 return list(unique.values())
def youtube_fetch():
 key=os.environ.get("YOUTUBE_API_KEY","").strip()
 if not key:print("YouTube discovery skipped: API key missing.");return []
 after=(datetime.now(timezone.utc)-timedelta(days=3)).isoformat(timespec="seconds").replace("+00:00","Z");rows=[]
 for query in YOUTUBE_QUERIES:
  params=urllib.parse.urlencode({"part":"snippet","type":"video","q":query,"order":"date","publishedAfter":after,"maxResults":15,"key":key})
  _,payload=request("https://www.googleapis.com/youtube/v3/search?"+params,{"User-Agent":UA})
  rows.extend(parse_youtube(payload));time.sleep(0.25)
 unique={}
 for row in rows:unique.setdefault(row["fingerprint"],row)
 return list(unique.values())
def community_ingest_path():
 return "rest/v1/claudia_story_leads?on_conflict=fingerprint"

def ingest(base,key,leads):
 headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"};accepted=0;failed=0
 for lead in leads:
  req=urllib.request.Request(base.rstrip("/")+"/"+community_ingest_path(),data=json.dumps(lead).encode(),headers=headers,method="POST")
  try:
   with urllib.request.urlopen(req,timeout=20) as res:
    if res.status in (200,201,204):accepted+=1
  except urllib.error.HTTPError as exc:
   failed+=1
   try:detail=exc.read().decode("utf-8","replace")[:240]
   except Exception:detail="(response body unavailable)"
   print(f"Community lead insert failed HTTP {exc.code}: {detail}")
  except Exception as exc:
   failed+=1;print(f"Community lead insert failed: {type(exc).__name__}: {str(exc)[:240]}")
 print(f"Community ingestion: {accepted} accepted, {failed} failed; remaining records still attempted.")
 return accepted
def main():
 leads=[]
 try:leads.extend(reddit_fetch())
 except Exception as e:
  print("Reddit OAuth discovery failed; attempting public fallback:",type(e).__name__)
  try:leads.extend(reddit_public_fetch())
  except Exception as fallback_error:print("Public Reddit fallback failed:",type(fallback_error).__name__)
 try:leads.extend(youtube_fetch())
 except Exception as e:print("YouTube discovery error:",type(e).__name__)
 unique={}
 for item in leads:unique.setdefault(item["fingerprint"],item)
 leads=list(unique.values());
 payload={"generated_at":datetime.now(timezone.utc).isoformat(),"lead_count":len(leads),"leads":leads};
 Path(os.environ.get("CLAUDIA_COMMUNITY_OUT","claudia-community-discovery.json")).write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n",encoding="utf-8");
 base=os.environ.get("SUPABASE_URL","").strip();key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip(); print(f"Social/video leads found: {len(leads)}")
 if leads and base and key:
  try:print(f"Social/video leads ingested: {ingest(base,key,leads)}")
  except Exception as e:print("Social/video ingestion failed:",type(e).__name__)
 elif leads:print("Ingestion skipped: Supabase credentials missing.")
if __name__=="__main__":main()
