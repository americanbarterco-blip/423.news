#!/usr/bin/env python3
"""Bounded, read-only public news/community search for Claudia Green."""
from __future__ import annotations
import html, json, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone

UA="423.news Claudia public search/1.0 (+https://423.news)"
MAX_BYTES=350_000
TIMEOUT=10

def fetch_text(url,headers=None):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/rss+xml,application/atom+xml,application/json,text/xml,*/*",**(headers or {})})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as response:
        raw=response.read(MAX_BYTES+1)
        if len(raw)>MAX_BYTES:raise ValueError("Response exceeds 350 KB limit")
        return raw.decode("utf-8","replace")

def strip_html(text):
    import re
    return " ".join(html.unescape(re.sub(r"<[^>]*>"," ",text or "")).split())[:1000]

def parse_google_news(xml_text):
    root=ET.fromstring(xml_text);rows=[]
    for item in root.iter():
        if item.tag.rsplit("}",1)[-1].lower()!="item":continue
        vals={}
        for child in item:
            name=child.tag.rsplit("}",1)[-1].lower()
            if name in {"title","link","description","pubdate"} and child.text:vals[name]=child.text.strip()
            elif name=="source":
                vals["source"]=child.text.strip() if child.text else "";vals["source_url"]=child.attrib.get("url","")
        link=vals.get("link","");title=strip_html(vals.get("title",""))
        if link.startswith("http") and title:
            rows.append({"source":"Google News RSS","publisher":vals.get("source") or "Publisher unavailable","publisher_url":vals.get("source_url") or None,"title":title,"url":link,"summary":strip_html(vals.get("description","")),"published":vals.get("pubdate")})
    return rows[:8]

def parse_reddit(payload):
    rows=[]
    for child in payload.get("data",{}).get("children",[]):
        post=child.get("data") or {};title=strip_html(post.get("title",""));permalink=post.get("permalink","")
        if not title or not permalink.startswith("/"):continue
        rows.append({"source":"Reddit public search","publisher":"r/"+str(post.get("subreddit","unknown")),"title":title,"url":"https://www.reddit.com"+permalink,"summary":strip_html(post.get("selftext","")),"published":datetime.fromtimestamp(post.get("created_utc",0),tz=timezone.utc).isoformat() if post.get("created_utc") else None,"score":post.get("score"),"comments":post.get("num_comments")})
    return rows[:8]

def parse_youtube(payload):
    rows=[]
    for item in payload.get("items",[]):
        ident=item.get("id",{}).get("videoId");snip=item.get("snippet") or {};title=strip_html(snip.get("title",""))
        if not ident or not title:continue
        rows.append({"source":"YouTube search API","publisher":snip.get("channelTitle") or "Channel unavailable","title":title,"url":"https://www.youtube.com/watch?v="+ident,"summary":strip_html(snip.get("description","")),"published":snip.get("publishedAt")})
    return rows[:5]



def parse_x_search(payload):
    rows=[]
    for post in payload.get("data",[]):
        ident=post.get("id"); title=strip_html(post.get("text",""))
        if not ident or not title: continue
        rows.append({
            "source":"X", "publisher":"X post", "title":title[:300],
            "url":"https://x.com/i/web/status/"+str(ident), "summary":title,
            "published":post.get("created_at"),
            "public_metrics":post.get("public_metrics") or {}, "source_type":"social",
        })
    return rows[:10]

def _x_error_detail(exc):
    """Return a bounded, sanitized X API diagnostic; never include request headers or tokens."""
    status=getattr(exc,"code",None)
    raw=""
    try:
        raw=exc.read(6000).decode("utf-8","replace")
    except Exception:
        pass
    detail=""
    try:
        payload=json.loads(raw) if raw else {}
        errors=payload.get("errors") or []
        if errors:
            detail="; ".join(str(item.get("message") or item.get("detail") or item.get("title") or "") for item in errors[:2])
        if not detail:
            detail=str(payload.get("detail") or payload.get("title") or payload.get("error") or "")
    except Exception:
        detail=""
    detail=" ".join(detail.split())[:260]
    if status:
        return f"HTTP {status}" + (f": {detail}" if detail else "")
    return detail or type(exc).__name__

def search_x(query, area, bearer_token):
    # Keep operators valid and bound user-supplied query length.
    terms=" ".join((query or "").replace('"', " ").split())[:180]
    location=" ".join((area or "").replace('"', " ").split())[:100]
    x_query=f'({terms}) "{location}" -is:retweet'
    params=urllib.parse.urlencode({
        "query": x_query[:450],
        "max_results": 10,
        "tweet.fields": "created_at,public_metrics,lang",
    })
    try:
        raw=fetch_text("https://api.x.com/2/tweets/search/recent?"+params,{
            "Authorization":"Bearer "+bearer_token, "Accept":"application/json",
        })
    except urllib.error.HTTPError as exc:
        raise RuntimeError(_x_error_detail(exc)) from None
    payload=json.loads(raw)
    return parse_x_search(payload)

def search_sources(query,area="423 region",youtube_api_key=None,x_bearer_token=None):
    query=(query or "").strip()[:140]
    area=(area or "423 region").strip()[:100]
    if not query:return {"query":"","area":area,"retrieved_at":datetime.now(timezone.utc).isoformat(),"results":[],"source_status":{},"note":"Provide a topic to search."}
    q=f"{query} {area}".strip()
    results=[];status={}
    # X is checked first when an API bearer token is configured.
    if x_bearer_token:
        try:
            results.extend(search_x(query, area, x_bearer_token))
            status["X"]="ok"
        except Exception as exc: status["X"]="unavailable: "+str(exc)[:300]
    else: status["X"]="not configured (X_API_BEARER_TOKEN missing)"
    news_url="https://news.google.com/rss/search?"+urllib.parse.urlencode({"q":q,"hl":"en-US","gl":"US","ceid":"US:en"})
    try:
        results.extend(parse_google_news(fetch_text(news_url)))
        status["Google News RSS"]="ok"
    except Exception as exc:status["Google News RSS"]="unavailable: "+type(exc).__name__
    reddit_url="https://www.reddit.com/search.json?"+urllib.parse.urlencode({"q":q,"sort":"new","t":"day","limit":8})
    try:
        payload=json.loads(fetch_text(reddit_url,{"Accept":"application/json"}))
        results.extend(parse_reddit(payload));status["Reddit"]="ok"
    except Exception as exc:status["Reddit"]="unavailable: "+type(exc).__name__
    if youtube_api_key:
        yt_url="https://www.googleapis.com/youtube/v3/search?"+urllib.parse.urlencode({"part":"snippet","type":"video","order":"date","q":q,"maxResults":5,"key":youtube_api_key})
        try:
            results.extend(parse_youtube(json.loads(fetch_text(yt_url))))
            status["YouTube"]="ok"
        except Exception as exc:status["YouTube"]="unavailable: "+type(exc).__name__
    else:status["YouTube"]="not configured in voice-agent runtime"
    unique={}
    for item in results:unique.setdefault(item["url"],item)
    candidates=list(unique.values())
    area_lower=area.lower()
    if "cleveland" in area_lower and ("tennessee" in area_lower or " tn" in area_lower):
        # Prevent same-name Cleveland County results outside Tennessee from being mislabeled as Cleveland, TN.
        candidates=[item for item in candidates if not (
            "cleveland county" in (item.get("title","")+" "+item.get("summary","")).lower()
            and "tennessee" not in (item.get("title","")+" "+item.get("summary","")).lower()
            and " tn " not in (" "+(item.get("title","")+" "+item.get("summary","")).lower()+" ")
            and "bradley county" not in (item.get("title","")+" "+item.get("summary","")).lower()
        )]
    return {"query":query,"area":area,"searched_query":q,"retrieved_at":datetime.now(timezone.utc).isoformat(),"source_status":status,"results":candidates[:20],"note":"Search results are public leads, not verified facts. Geographic name collisions are filtered where identified; open original sources and corroborate before reporting allegations or publishing."}

if __name__=="__main__":
    print(json.dumps(search_sources("local schools"),ensure_ascii=False,indent=2))
