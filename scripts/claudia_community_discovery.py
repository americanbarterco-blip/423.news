#!/usr/bin/env python3
"""Optional authorized Reddit and YouTube public-source discovery for Claudia.

Reddit requires OAuth client credentials; YouTube uses a Data API key. No anonymous
feed scraping, user names, private content, comments, or publishing.
"""
from __future__ import annotations
import hashlib, json, os, time, urllib.parse, urllib.request
from datetime import datetime,timezone,timedelta

UA="423.news-Claudia-CommunityResearch/1.0 (+https://423.news/)"
SUBREDDITS=("Chattanooga","Tennessee","UTC","ClevelandTN")
LOCAL_TERMS=("423","chattanooga","cleveland tn","cleveland, tn","hamilton county","bradley county","soddy-daisy","east ridge","dayton tn","polk county tn","rhea county","ooltewah","hixson","signal mountain","north georgia","utc","sweetwater")
YOUTUBE_QUERIES=("Chattanooga Tennessee","Cleveland Tennessee","Hamilton County Tennessee","Bradley County Tennessee","423 Tennessee")

def fingerprint(url):
    return hashlib.sha256(url.strip().encode("utf-8")).hexdigest()
def relevant(title,body,subreddit):
    text=(title+" "+body).lower()
    if subreddit.lower() in ("chattanooga","clevelandtn","utc"):return True
    return any(term in text for term in LOCAL_TERMS)
def parse_reddit(payload):
    rows=[]
    for child in payload.get("data",{}).get("children",[]):
        post=child.get("data",{})
        title=(post.get("title") or "").strip()
        subreddit=(post.get("subreddit") or "").strip()
        permalink=post.get("permalink") or ""
        if not title or not permalink or not subreddit:continue
        url=urllib.parse.urljoin("https://www.reddit.com",permalink)
        body=(post.get("selftext") or "").strip()[:1600]
        if not relevant(title,body,subreddit):continue
        published=post.get("created_utc")
        date=datetime.fromtimestamp(published,tz=timezone.utc).isoformat() if published else None
        rows.append({"title":title[:300],"url":url,"summary":body,"published":date,"source_name":"Reddit r/"+subreddit,"source_url":"https://www.reddit.com/r/"+subreddit+"/","source_type":"community","fingerprint":fingerprint(url)})
    return rows
def parse_youtube(payload):
    rows=[]
    for item in payload.get("items",[]):
        video=item.get("id",{}).get("videoId")
        snippet=item.get("snippet",{})
        title=(snippet.get("title") or "").strip()
        if not video or not title:continue
        url="https://www.youtube.com/watch?v="+video
        summary=(snippet.get("description") or "").strip()[:1600]
        channel=(snippet.get("channelTitle") or "YouTube")
        published=snippet.get("publishedAt")
        rows.append({"title":title[:300],"url":url,"summary":summary,"published":published,"source_name":"YouTube · "+channel,"source_url":"https://www.youtube.com/","source_type":"video","fingerprint":fingerprint(url)})
    return rows
def request(url,headers=None,body=None,method="GET"):
    req=urllib.request.Request(url,data=body,headers=headers or {"User-Agent":UA},method=method)
    with urllib.request.urlopen(req,timeout=20) as res:return res.status,json.loads(res.read().decode("utf-8"))
def reddit_fetch():
    client=os.environ.get("REDDIT_CLIENT_ID","").strip();secret=os.environ.get("REDDIT_CLIENT_SECRET","").strip()
    if not client or not secret:print("Reddit discovery skipped: OAuth client credentials missing.");return []
    import base64
    auth=base64.b64encode((client+":"+secret).encode()).decode()
    _,token=request("https://www.reddit.com/api/v1/access_token",{"Authorization":"Basic "+auth,"User-Agent":UA,"Content-Type":"application/x-www-form-urlencoded"},b"grant_type=client_credentials","POST")
    access=token.get("access_token")
    if not access:raise RuntimeError("Reddit OAuth response did not include a token")
    combined="+".join(SUBREDDITS)
    url="https://oauth.reddit.com/r/"+combined+"/new?limit=100"
    _,payload=request(url,{"Authorization":"Bearer "+access,"User-Agent":UA})
    return parse_reddit(payload)
def youtube_fetch():
    key=os.environ.get("YOUTUBE_API_KEY","").strip()
    if not key:print("YouTube discovery skipped: API key missing.");return []
    after=(datetime.now(timezone.utc)-timedelta(days=14)).isoformat(timespec="seconds").replace("+00:00","Z")
    rows=[]
    for query in YOUTUBE_QUERIES:
        params=urllib.parse.urlencode({"part":"snippet","type":"video","q":query,"order":"date","publishedAfter":after,"maxResults":10,"key":key})
        _,payload=request("https://www.googleapis.com/youtube/v3/search?"+params,{"User-Agent":UA})
        rows.extend(parse_youtube(payload))
        time.sleep(0.3)
    unique={}
    for row in rows:unique.setdefault(row["fingerprint"],row)
    return list(unique.values())
def ingest(base,key,leads):
    headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"}
    accepted=0
    for lead in leads:
        req=urllib.request.Request(base.rstrip("/")+"/rest/v1/claudia_story_leads",data=json.dumps(lead).encode(),headers=headers,method="POST")
        with urllib.request.urlopen(req,timeout=20) as res:
            if res.status in (200,201,204):accepted+=1
    return accepted
def main():
    leads=[]
    try:leads.extend(reddit_fetch())
    except Exception as e:print("Reddit discovery error:",type(e).__name__)
    try:leads.extend(youtube_fetch())
    except Exception as e:print("YouTube discovery error:",type(e).__name__)
    unique={}
    for item in leads:unique.setdefault(item["fingerprint"],item)
    leads=list(unique.values())
    base=os.environ.get("SUPABASE_URL","").strip();key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
    print(f"Community/video leads found: {len(leads)}")
    if leads and base and key:
        try:print(f"Community/video leads ingested: {ingest(base,key,leads)}")
        except Exception as e:print("Community/video ingestion failed:",type(e).__name__)
    elif leads:print("Ingestion skipped: Supabase credentials missing.")
if __name__=="__main__":main()
