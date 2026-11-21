#!/usr/bin/env python3
"""Static site coverage and link audit for 423.news; read-only, no deploy/publish."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from urllib.parse import urlparse

HTML_LINK=re.compile(r'''(?:href|src)\s*=\s*["']([^"']+)["']''',re.I)
META_DESCRIPTION=re.compile(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',re.I)
TITLE=re.compile(r'<title>(.*?)</title>',re.I|re.S)
CANONICAL=re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']',re.I)

def classify_link(value):
    v=value.strip()
    if not v or v.startswith(('#','javascript:','mailto:','tel:','data:')): return None
    parsed=urlparse(v)
    if parsed.scheme or parsed.netloc:return None
    path=parsed.path
    if not path:return None
    return path

def resolve_target(root,href):
    path=classify_link(href)
    if path is None:return None
    candidate=(root/path.lstrip('/')) if path.startswith('/') else (root/path)
    candidate=candidate.resolve()
    if root.resolve() not in (candidate,*candidate.parents):return None
    if candidate.is_dir():candidate=candidate/'index.html'
    return candidate

def audit(root):
    root=Path(root).resolve(); entry=root/'index.html'
    if not entry.exists(): raise FileNotFoundError(f'Missing site entry: {entry}')
    source=entry.read_text(encoding='utf-8',errors='replace')
    links=HTML_LINK.findall(source); checked=[]; missing=[]
    for href in sorted(set(links)):
        target=resolve_target(root,href)
        if target is None:continue
        row={'href':href,'target':str(target.relative_to(root))}
        if target.exists():checked.append(row)
        else:missing.append(row)
    title=TITLE.search(source); description=META_DESCRIPTION.search(source); canonical=CANONICAL.search(source)
    checks={'entrypoint':True,'title':bool(title and title.group(1).strip()),'meta_description':bool(description and description.group(1).strip()),'canonical':bool(canonical and canonical.group(1).strip())}
    issues=[]
    for key,val in checks.items():
        if not val:issues.append('Missing/empty '+key)
    if missing:issues.append(f'{len(missing)} broken local links found in index.html')
    report={'site_root':str(root),'entrypoint':'index.html','checked_local_links':len(checked),'missing_local_links':missing,'metadata_checks':checks,'issues':issues,'status':'needs_attention' if issues else 'pass'}
    return report

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',default='.');ap.add_argument('--json-out',default='claudia-site-coverage.json');args=ap.parse_args()
    result=audit(args.root);Path(args.json_out).write_text(json.dumps(result,indent=2)+'\\n',encoding='utf-8')
    print(f"423.news coverage audit: {result['status']} | local links checked: {result['checked_local_links']} | broken: {len(result['missing_local_links'])}")
    for issue in result['issues']:print('ISSUE:',issue)
    for item in result['missing_local_links']:print('BROKEN:',item['href'],'->',item['target'])
if __name__=='__main__':main()
