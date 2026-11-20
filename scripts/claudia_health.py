#!/usr/bin/env python3
"""Claudia Green: read-only production health checks for 423.news.

Checks public HTTP routes, XML sitemap validity, robots sitemap references,
and the age of the static fallback feed. This script never writes to production.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

BASE = os.environ.get("CLAUDIA_SITE_URL", "https://423.news").rstrip("/")
UA = "ClaudiaGreenHealthCheck/1.0 (+https://423.news)"
TIMEOUT = 20
MAX_SITEMAP_SAMPLE = 12
STALE_FEED_HOURS = 48

ROUTES = ["/", "/news.html", "/live-wire", "/desk", "/sitemap.xml", "/robots.txt", "/feed.json"]


def fetch(url: str, method: str = "GET") -> dict:
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            body = res.read(2_000_000) if method == "GET" else b""
            return {"url": url, "final_url": res.geturl(), "status": res.status,
                    "content_type": res.headers.get("Content-Type", ""),
                    "body": body.decode("utf-8", "replace"), "latency_ms": round((time.monotonic()-started)*1000)}
    except urllib.error.HTTPError as e:
        return {"url": url, "final_url": e.geturl(), "status": e.code,
                "content_type": e.headers.get("Content-Type", "") if e.headers else "",
                "body": e.read(1000).decode("utf-8", "replace"), "latency_ms": round((time.monotonic()-started)*1000),
                "error": "HTTP error"}
    except Exception as e:
        return {"url": url, "final_url": url, "status": None, "content_type": "",
                "body": "", "latency_ms": round((time.monotonic()-started)*1000), "error": type(e).__name__}


def finding(level: str, title: str, detail: str, evidence: str = "") -> dict:
    return {"level": level, "title": title, "detail": detail, "evidence": evidence}


def run() -> dict:
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    findings, checks = [], []
    page_results = {}
    for path in ROUTES:
        url = BASE + path
        result = fetch(url)
        page_results[path] = result
        ok = result["status"] is not None and 200 <= result["status"] < 400
        checks.append({"name": "HTTP " + path, "ok": ok, "status": result["status"], "latency_ms": result["latency_ms"]})
        if not ok:
            findings.append(finding("high", "Route failed: " + path, "Public route did not return a successful response.", f"HTTP {result['status']} / {result.get('error','')}".strip()))

    robots = page_results.get("/robots.txt", {}).get("body", "")
    sitemap_refs = re.findall(r"(?im)^\s*sitemap:\s*(https?://\S+)", robots)
    if sitemap_refs and BASE + "/sitemap.xml" not in sitemap_refs:
        findings.append(finding("medium", "robots.txt sitemap mismatch", "robots.txt lists sitemap URL(s) that do not include the primary sitemap.xml.", "; ".join(sitemap_refs)))
    elif not sitemap_refs:
        findings.append(finding("medium", "robots.txt has no Sitemap directive", "Search crawlers are not being directed to a sitemap through robots.txt."))

    sitemap = page_results.get("/sitemap.xml", {})
    sitemap_body = sitemap.get("body", "")
    sitemap_urls = []
    sitemap_valid = False
    if sitemap.get("status") and 200 <= sitemap["status"] < 300:
        try:
            root = ET.fromstring(sitemap_body)
            root_name = root.tag.split("}")[-1]
            sitemap_valid = root_name in {"urlset", "sitemapindex"}
            if root_name == "urlset":
                sitemap_urls = [el.text.strip() for el in root.findall(".//{*}loc") if el.text and el.text.strip()]
            elif root_name == "sitemapindex":
                sitemap_urls = [el.text.strip() for el in root.findall(".//{*}loc") if el.text and el.text.strip()]
            if not sitemap_valid:
                findings.append(finding("high", "Sitemap XML root is invalid", f"Expected urlset or sitemapindex; found {root_name}."))
        except ET.ParseError as e:
            findings.append(finding("high", "Sitemap is not valid XML", "Search engines may reject this sitemap.", str(e)))
    else:
        findings.append(finding("high", "Sitemap request failed", "Could not retrieve sitemap.xml.", str(sitemap.get("status"))))

    checks.append({"name": "Sitemap XML", "ok": sitemap_valid, "url_count": len(sitemap_urls), "status": sitemap.get("status")})
    if sitemap_valid and not sitemap_urls:
        findings.append(finding("medium", "Sitemap has zero URLs", "Valid sitemap XML was found but it contains no loc entries."))
    if sitemap_valid:
        sample = sitemap_urls[:MAX_SITEMAP_SAMPLE]
        for url in sample:
            if not url.startswith(BASE):
                continue
            result = fetch(url, "HEAD")
            if result["status"] in (403, 405):
                result = fetch(url, "GET")
            ok = result["status"] is not None and 200 <= result["status"] < 400
            checks.append({"name": "Sitemap URL", "url": url, "ok": ok, "status": result["status"]})
            if not ok:
                findings.append(finding("medium", "Sitemap URL failed", "A sampled sitemap URL returned a non-success response.", f"{url} => HTTP {result['status']}"))
            elif result.get("final_url") and result["final_url"] != url:
                findings.append(finding("medium", "Sitemap URL redirects", "A sampled sitemap URL redirects instead of resolving directly.", f"{url} => {result['final_url']}"))

    feed_result = page_results.get("/feed.json", {})
    try:
        feed = json.loads(feed_result.get("body", ""))
        generated = feed.get("generated_at")
        age_hours = None
        if generated:
            dt = datetime.fromisoformat(generated.replace("Z", "+00:00"))
            age_hours = round((datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()/3600, 1)
        checks.append({"name": "Static fallback feed freshness", "ok": age_hours is not None and age_hours <= STALE_FEED_HOURS, "age_hours": age_hours, "generated_at": generated})
        if age_hours is not None and age_hours > STALE_FEED_HOURS:
            findings.append(finding("info", "Static fallback feed is old", "feed.json may be an intentionally static fallback; its timestamp is old, so confirm the live database feed is the primary source.", f"generated_at={generated}; age={age_hours}h"))
    except Exception as e:
        findings.append(finding("medium", "Static feed JSON could not be parsed", "The fallback feed endpoint is not valid JSON.", str(e)))
        checks.append({"name": "Static fallback feed JSON", "ok": False})

    return {"site": BASE, "checked_at": checked_at, "checks": checks, "findings": findings,
            "summary": {"checks": len(checks), "passed": sum(bool(c.get("ok")) for c in checks), "findings": len(findings)}}


def main() -> int:
    report = run()
    with open("claudia-health.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    lines = [f"# Claudia Green — 423.news health report", "", f"Checked: {report['checked_at']}", "",
              f"**{report['summary']['passed']}/{report['summary']['checks']} checks passed · {report['summary']['findings']} findings**", "", "## Checks"]
    for c in report["checks"]:
        lines.append(f"- {'PASS' if c.get('ok') else 'FAIL'} — {c['name']}: {c.get('status', c.get('age_hours', ''))}")
    lines.extend(["", "## Findings"])
    if not report["findings"]:
        lines.append("No findings in this run.")
    for f in report["findings"]:
        lines.append(f"- **{f['level'].upper()}: {f['title']}** — {f['detail']}")
        if f.get("evidence"):
            lines.append(f"  - Evidence: {f['evidence']}")
    lines.extend(["", "## Scope", "Automated read-only checks only. This run does not validate all page JavaScript, authentication, database write paths, or editorial content quality."])
    with open("claudia-health.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(json.dumps(report["summary"]))
    return 1 if any(f["level"] in {"high", "medium"} for f in report["findings"]) else 0


if __name__ == "__main__":
    sys.exit(main())
