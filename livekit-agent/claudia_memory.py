"""Claudia Green private long-term memory: Supabase-backed, service-role gated."""
from __future__ import annotations
import json, os, re, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone

BASE = os.environ.get("CLAUDIA_MEMORY_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("CLAUDIA_MEMORY_SERVICE_KEY", "")
TABLE = "claudia_memories"
KINDS = {"fact", "episode", "decision", "lesson", "project", "goal", "research"}
MAX_CONTENT = 5000
MAX_TAGS = 16

def stamp():
    return datetime.now(timezone.utc).isoformat()

def _request(method, path, payload=None, headers=None):
    if not BASE or not KEY:
        raise RuntimeError("Private Claudia memory is disabled: memory URL and service key are required.")
    url = BASE + "/rest/v1/" + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "apikey": KEY, "Authorization": "Bearer " + KEY,
        "Accept": "application/json", "Content-Type": "application/json",
        **(headers or {})
    })
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw=resp.read().decode("utf-8")
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        raise RuntimeError("Claudia memory service returned HTTP " + str(e.code)) from None

def normalize(text):
    return re.findall(r"[a-z0-9]{2,}", (text or "").lower())

def save_memory(content, kind="fact", tags=None, importance=3, source_ref=None, project="423.news"):
    content=(content or "").strip()
    if not content or len(content)>MAX_CONTENT: raise ValueError("Memory text is empty or too long.")
    if kind not in KINDS: raise ValueError("Invalid memory category.")
    importance=max(1,min(5,int(importance)))
    tags=list(dict.fromkeys(str(t).strip().lower()[:40] for t in (tags or []) if str(t).strip()))[:MAX_TAGS]
    # Duplicate check uses exact normalized content, avoiding broad accidental merging.
    q=urllib.parse.urlencode({"select":"id,content","kind":"eq."+kind,"limit":"50","order":"updated_at.desc"})
    existing=_request("GET",TABLE+"?"+q)
    for row in existing:
        if row.get("content","").strip().casefold()==content.casefold():
            _request("PATCH",TABLE+"?id=eq."+urllib.parse.quote(str(row["id"])),{
                "tags":tags,"importance":importance,"source_ref":source_ref,"project":project,"updated_at":stamp()
            },headers={"Prefer":"return=minimal"})
            return {"action":"updated","id":row["id"]}
    row={"content":content,"kind":kind,"tags":tags,"importance":importance,"source_ref":source_ref,
         "project":project,"created_at":stamp(),"updated_at":stamp()}
    result=_request("POST",TABLE,row,headers={"Prefer":"return=representation"})
    return {"action":"saved","id":result[0]["id"] if result else None}

def recall(query, limit=8, project=None, kind=None):
    limit=max(1,min(20,int(limit)))
    params={"select":"id,content,kind,tags,importance,project,source_ref,created_at,updated_at",
            "order":"updated_at.desc","limit":"100"}
    if project: params["project"]="eq."+project
    if kind and kind in KINDS: params["kind"]="eq."+kind
    rows=_request("GET",TABLE+"?"+urllib.parse.urlencode(params))
    terms=set(normalize(query)); scored=[]
    for row in rows:
        content_terms=set(normalize(row.get("content","")))
        tag_terms=set(normalize(" ".join(row.get("tags") or [])))
        overlap=len(terms & (content_terms|tag_terms))
        score=overlap*3 + int(row.get("importance",3))*0.25
        if terms and overlap==0: continue
        scored.append((score,row))
    scored.sort(key=lambda x:(x[0],x[1].get("updated_at","")),reverse=True)
    return [r for _,r in scored[:limit]

def forget(memory_id):
    _request("DELETE",TABLE+"?id=eq."+urllib.parse.quote(str(memory_id)),headers={"Prefer":"return=minimal"})
    return {"deleted":True}
