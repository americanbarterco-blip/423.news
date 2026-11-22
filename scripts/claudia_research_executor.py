#!/usr/bin/env python3
"""Bounded public-source research executor for Claudia's private lead queue.

Collects the lead page plus independently hosted, topic-matching pages from configured
public source sites. It records evidence only; it does not write or publish articles.
"""
from __future__ import annotations
import html, ipaddress, json, os, re, socket, time, datetime, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

CONFIG=Path(__file__).resolve().parent/"claudia_sources.json"
UA="423.news-Claudia-Research/1.0 (+https://423.news/)"
MAX_BYTES=1_200_000
TIMEOUT=12
MAX_CANDIDATES=2
STOP=set("the a an and or to in on for of with from by is are was were be this that local news story article city county school today".split())

def safe_url(url):
    p=urllib.parse.urlparse(url)
    if p.scheme not in ("http","https") or not p.hostname or p.username or p.password:
        raise ValueError("URL scheme/host not allowed")
    host=p.hostname.lower()
    if host=="localhost" or host.endswith(".localhost") or host.endswith(".local"):
        raise ValueError("local host not allowed")
    try:
        ip=ipaddress.ip_address(host)
    except ValueError:
        if host.replace(".","").isdigit(): raise ValueError("invalid IP host")
        ip=None
    if ip is not None and not ip.is_global: raise ValueError("non-public IP blocked")
    if ip is None:
        try:
            for info in socket.getaddrinfo(host,None):
                addr=ipaddress.ip_address(info[4][0])
                if not addr.is_global: raise ValueError("DNS resolved to non-public IP")
        except socket.gaierror: pass
    return url

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        safe_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def fetch_raw(url,accept="text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml"):
    safe_url(url)
    opener=urllib.request.build_opener(SafeRedirect())
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":accept})
    with opener.open(req,timeout=TIMEOUT) as r:
        data=r.read(MAX_BYTES+1)
        if len(data)>MAX_BYTES: raise ValueError("page exceeds size cap")
        return data.decode("utf-8","replace"),r.headers.get("Content-Type","").lower(),r.geturl()
def fetch(url):
    body,ctype,final=fetch_raw(url)
    if "html" not in ctype: raise ValueError("not an HTML response")
    return body,final
def feed_items(xml,base):
    root=ET.fromstring(xml); rows=[]
    for node in root.iter():
        if node.tag.rsplit("}",1)[-1].lower() not in {"item","entry"}:continue
        title="";summary="";url=""
        for child in node:
            name=child.tag.rsplit("}",1)[-1].lower()
            if name=="title" and child.text:title=child.text.strip()
            if name in ("summary","description","content") and child.text:summary=child.text.strip()
            if name=="link":url=child.attrib.get("href") or (child.text.strip() if child.text else "")
        url=urllib.parse.urljoin(base,url)
        if title and url.startswith(("http://","https://")):rows.append({"title":title,"summary":summary,"url":url})
    return rows

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__();self.in_title=False;self.title_parts=[];self.meta={};self.text=[];self.links=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="title":self.in_title=True
        if tag in ("script","style","noscript"):self.skip+=1
        if tag=="meta" and (a.get("property") in ("og:title","og:description") or a.get("name") in ("description","twitter:description")):
            self.meta[a.get("property") or a.get("name")]=a.get("content","")
        if tag=="a" and a.get("href"):self.links.append(a["href"])
    def handle_endtag(self,tag):
        if tag=="title":self.in_title=False
        if tag in ("script","style","noscript") and self.skip:self.skip-=1
    def handle_data(self,data):
        if self.skip:return
        if self.in_title:self.title_parts.append(data)
        if data.strip():self.text.append(data.strip())
    def result(self):
        title=" ".join(self.title_parts).strip() if self.title_parts else self.meta.get("og:title","")
        desc=self.meta.get("og:description") or self.meta.get("description") or self.meta.get("twitter:description","")
        body=" ".join(self.text)
        body=re.sub(r"\\s+"," ",html.unescape(body))
        return {"title":title[:300],"summary":desc[:1500],"excerpt":body[:5000],"links":self.links}

def tokens(text):
    return {w for w in re.findall(r"[a-z0-9]{3,}",text.lower()) if w not in STOP}
def similarity(a,b):
    x,y=tokens(a),tokens(b)
    return len(x&y)/len(x|y) if x and y else 0.0

def source_pages(cfg,lead):
    results=[]
    query=lead.get("title","")+" "+lead.get("summary","")
    for source in cfg.get("sources",[]):
        if not source.get("enabled"):continue
        try:
            raw,ctype,final=fetch_raw(source["url"])
            if source.get("type")=="feed" or "xml" in ctype:
                for item in feed_items(raw,final):
                    score=similarity(query,item["title"]+" "+item.get("summary",""))
                    if score>=0.12 and item["url"]!=lead.get("url"):
                        results.append({"url":item["url"],"source_name":source["name"],"source_url":final,"score":round(score,3)})
            else:
                parser=PageParser();parser.feed(raw);data=parser.result()
                for href in parser.links:
                    candidate=urllib.parse.urljoin(final,href)
                    try:safe_url(candidate)
                    except ValueError:continue
                    score=similarity(query,candidate+" "+data["title"]+" "+data["excerpt"])
                    if candidate.split("#")[0]!=lead.get("url","").split("#")[0] and score>=0.12:
                        results.append({"url":candidate,"source_name":source["name"],"source_url":final,"score":round(score,3)})
            time.sleep(float(cfg.get("delay_seconds",0.5)))
        except Exception as e: print(f"Source skipped: {source.get('name','?')} ({type(e).__name__})")
    unique={}
    for item in results:unique.setdefault(item["url"],item)
    return sorted(unique.values(),key=lambda x:x["score"],reverse=True)[:MAX_CANDIDATES]

def request_supabase(base,key,path,method="GET",body=None,prefer=None):
    headers={"apikey":key,"Authorization":"Bearer "+key}
    if body is not None:headers["Content-Type"]="application/json"
    if prefer:headers["Prefer"]=prefer
    req=urllib.request.Request(base.rstrip("/")+"/"+path,data=body,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=25) as res:return res.status,res.read().decode("utf-8","replace")
def claim(base,key,worker):
    _,raw=request_supabase(base,key,"rest/v1/rpc/claudia_claim_research_task","POST",json.dumps({"worker_id":worker}).encode())
    rows=json.loads(raw);return rows[0] if rows else None
def evidence_insert_path():
    """PostgREST upsert target for the evidence table unique key."""
    return "rest/v1/claudia_story_evidence?on_conflict=lead_id,evidence_type,url"

def evidence_record(lead_id,kind,url,source_name,excerpt,notes):
    return {"lead_id":lead_id,"evidence_type":kind,"url":url,"source_name":source_name,"excerpt":excerpt[:2000],"reliability_notes":notes[:500]}
def process(task,base,key,cfg):
    result=task.get("result") or {};lead_url=result.get("lead_url");lead_id=task.get("lead_id")
    if not lead_url or not lead_id:raise ValueError("task missing lead URL or lead ID")
    raw,final=fetch(lead_url);p=PageParser();p.feed(raw);page=p.result()
    evidence=[evidence_record(lead_id,"source",final,result.get("source","Lead source"),page["excerpt"],"Lead page retrieved; this is not independent verification.")]
    candidates=[]
    for item in source_pages(cfg,task):
        try:
            raw,url=fetch(item["url"]);parser=PageParser();parser.feed(raw);data=parser.result()
            actual_score=similarity(task.get("title","")+" "+(result.get("summary","") or ""),data["title"]+" "+data["summary"]+" "+data["excerpt"])
            if (data["excerpt"] or data["summary"]) and actual_score>=0.12:
                evidence.append(evidence_record(lead_id,"corroboration",url,item["source_name"],data["excerpt"] or data["summary"],f"Fetched page relevance {actual_score:.3f}; not fact verification."))
                candidates.append({"url":url,"source_name":item["source_name"],"topic_overlap":round(actual_score,3),"title":data["title"]})
        except Exception as e:print(f"Candidate skipped: {type(e).__name__}")
    for rec in evidence:request_supabase(base,key,evidence_insert_path(),"POST",json.dumps(rec).encode(),"resolution=ignore-duplicates,return=minimal")
    status="completed" if evidence else "blocked"
    update={"status":status,"locked_at":None,"locked_by":None,"last_error":None if evidence else "No evidence retrieved","result":{"lead_url":lead_url,"evidence_count":len(evidence),"candidate_sources":candidates,"editorial_status":"needs human review; not verified","completed_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}}
    request_supabase(base,key,"rest/v1/claudia_research_tasks?id=eq."+urllib.parse.quote(task["id"],safe=""),"PATCH",json.dumps(update).encode(),"return=minimal")
    print(f"Task {task['id']}: evidence={len(evidence)}, corroborating_pages={len(candidates)}, state={status}")
def retry_patch(task,error):
    attempts=int(task.get("attempt_count",1));maximum=int(task.get("max_attempts",4))
    message=(type(error).__name__+": "+str(error))[:500]
    common={"locked_at":None,"locked_by":None,"last_error":message}
    if attempts<maximum:
        delay=min(3600,300*(2**max(0,attempts-1)))
        common.update({"status":"queued","available_at":(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=delay)).isoformat()})
        return common,delay
    common["status"]="blocked"
    return common,None

def main():
    base=os.environ.get("SUPABASE_URL","").strip();key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
    if not base or not key:print("Research executor skipped: Supabase credentials missing.");return
    cfg=json.loads(CONFIG.read_text());worker=os.environ.get("CLAUDIA_RESEARCH_WORKER","github-actions")
    for _ in range(int(os.environ.get("CLAUDIA_RESEARCH_BATCH","3"))):
        task=claim(base,key,worker)
        if not task:print("Research queue empty.");break
        try:process(task,base,key,cfg)
        except Exception as e:
            patch,delay=retry_patch(task,e)
            if delay is None:print(f"Task blocked after {task.get('attempt_count',1)} attempts: {patch['last_error']}")
            else:print(f"Task retry scheduled in {delay}s: {patch['last_error']}")
            request_supabase(base,key,"rest/v1/claudia_research_tasks?id=eq."+urllib.parse.quote(task["id"],safe=""),"PATCH",json.dumps(patch).encode(),"return=minimal")
if __name__=="__main__":main()
