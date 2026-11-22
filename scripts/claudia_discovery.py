#!/usr/bin/env python3
"""Claudia Green public-source lead discovery. RSS/Atom + public HTML, dedupe, no auto-publishing."""
from __future__ import annotations
import hashlib, json, os, re, sys, time
import urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

CONFIG = Path(__file__).resolve().parent / "claudia_sources.json"
UA = "423.news-Claudia-Discovery/1.0 (+https://423.news/)"
MAX_BYTES = 2_000_000
TIMEOUT = 15

def stamp(): return datetime.now(timezone.utc).isoformat(timespec="seconds")
def fingerprint(url):
    return hashlib.sha256(url.strip().encode("utf-8")).hexdigest()

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        ctype = res.headers.get("Content-Type","")
        data = res.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES: raise ValueError("response exceeds 2 MB limit")
        return data.decode("utf-8", "replace"), ctype

def local_name(tag): return tag.rsplit("}",1)[-1].lower()
def parse_feed(xml, source):
    root = ET.fromstring(xml)
    rows=[]
    for node in root.iter():
        if local_name(node.tag) not in {"item","entry"}: continue
        vals={}
        for child in node:
            name=local_name(child.tag)
            if name in {"title","description","summary","content","pubdate","published","updated","link","guid","id"}:
                if name=="link" and child.attrib.get("href"):
                    vals.setdefault("link", child.attrib["href"])
                elif child.text: vals.setdefault(name, child.text.strip())
        title=vals.get("title","").strip()
        link=vals.get("link") or vals.get("guid") or vals.get("id")
        if link and link.startswith("http") and title:
            summary=re.sub(r"<[^>]+>"," ",vals.get("summary") or vals.get("description") or vals.get("content") or "")
            rows.append({"title":title[:300],"url":link,"summary":" ".join(summary.split())[:1600],"published":vals.get("published") or vals.get("updated") or vals.get("pubdate"),"source_name":source["name"],"source_url":source["url"],"source_type":source.get("type","feed")})
    return rows

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.items=[]; self.href=None; self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="a":
            self.href=dict(attrs).get("href"); self.text=[]
    def handle_data(self,data):
        if self.href is not None: self.text.append(data)
    def handle_endtag(self,tag):
        if tag.lower()=="a" and self.href is not None:
            title=" ".join("".join(self.text).split())
            self.items.append((self.href,title)); self.href=None; self.text=[]

def parse_html(html, source):
    p=Links(); p.feed(html); base=source["url"]; rows=[]
    for href,title in p.items:
        url=urllib.parse.urljoin(base,href)
        parsed=urllib.parse.urlparse(url)
        if parsed.scheme not in {"http","https"} or not title or len(title)<12: continue
        if url.split("#")[0].rstrip("/") == base.split("#")[0].rstrip("/"): continue
        rows.append({"title":title[:300],"url":url,"summary":"","published":None,"source_name":source["name"],"source_url":base,"source_type":source.get("type","web")})
    return rows[:60]

def discover(config):
    leads=[]; errors=[]
    for source in config.get("sources",[]):
        if not source.get("enabled",True): continue
        try:
            body,ctype=fetch(source["url"])
            if source.get("type")=="feed" or "xml" in ctype or body.lstrip().startswith("<?xml") or "<rss" in body[:1000].lower() or "<feed" in body[:1000].lower():
                found=parse_feed(body,source)
            else: found=parse_html(body,source)
            leads.extend(found)
        except Exception as e:
            errors.append({"source":source.get("name","unknown"),"error":type(e).__name__+": "+str(e)[:180]})
        time.sleep(float(config.get("delay_seconds",0.5)))
    dedup={}
    for lead in leads:
        lead["fingerprint"]=fingerprint(lead["url"])
        dedup.setdefault(lead["fingerprint"],lead)
    return {"generated_at":stamp(),"sources_checked":sum(bool(s.get("enabled",True)) for s in config.get("sources",[])),"lead_count":len(dedup),"leads":list(dedup.values()),"errors":errors}

def ingest(payload):
    url=os.environ.get("SUPABASE_URL","").rstrip("/")
    key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
    if not url or not key: raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database ingestion")
    headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"}
    accepted=0
    failed=0
    endpoint=url+"/rest/v1/claudia_story_leads?on_conflict=fingerprint"
    for lead in payload["leads"]:
        req=urllib.request.Request(endpoint,data=json.dumps(lead).encode(),headers=headers,method="POST")
        try:
            with urllib.request.urlopen(req,timeout=20) as res:
                if res.status in (200,201,204): accepted+=1
        except urllib.error.HTTPError as exc:
            failed+=1
            try: detail=exc.read().decode("utf-8","replace")[:500]
            except Exception: detail="(error body unavailable)"
            print(f"Supabase ingest failed for {lead.get('url','unknown URL')}: HTTP {exc.code}: {detail}",file=sys.stderr)
    print(f"Database ingestion: {accepted} accepted/processed, {failed} failed records.")
    return accepted

def main():
    cfg=json.loads(CONFIG.read_text())
    payload=discover(cfg)
    out=Path(os.environ.get("CLAUDIA_DISCOVERY_OUT","claudia-discovery.json"))
    out.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n")
    print(f"Discovered {payload['lead_count']} unique public leads from {payload['sources_checked']} sources. Errors: {len(payload['errors'])}.")
    if os.environ.get("CLAUDIA_DISCOVERY_INGEST","false").lower()=="true":
        count=ingest(payload); print(f"Database ingest completed: {count} accepted response(s).")
    if payload["errors"]: print(json.dumps(payload["errors"],indent=2))
if __name__=="__main__": main()
