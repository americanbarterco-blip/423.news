#!/usr/bin/env python3
"""Create a bounded daily work plan from Claudia's public health report."""
from datetime import datetime, timezone
import json
from pathlib import Path
BASE=[
{"id":"editorial-research","priority":"P1","area":"Editorial","task":"Research fresh 423-region stories from primary sources; record links, dates, confidence and draft corroborated stories.","approval":"Publication requires human approval."},
{"id":"spanish-queue","priority":"P2","area":"Spanish desk","task":"Check Spanish coverage parity; draft translations preserving facts and source links while respecting existing approval rules.","approval":"Never edit English originals or override pending human review."},
{"id":"seo-indexing","priority":"P2","area":"SEO","task":"Audit canonical URLs, sitemap, robots, metadata, structured data, internal links and indexability; report actionable issues.","approval":"No DNS, account or production-setting changes."},
{"id":"maintenance","priority":"P2","area":"Engineering","task":"Review health findings and recent code changes; suggest isolated fixes with tests and PR.","approval":"No secrets, auth, RLS, database or deployment changes."},
{"id":"audience-growth","priority":"P3","area":"Growth","task":"Prepare zero-cost story-sharing, community outreach ideas and draft copy.","approval":"No external posting, messages or paid activity without approval."}]
def build_plan(health):
 findings=health.get("findings",[]) if isinstance(health,dict) else []
 tasks=[dict(x) for x in BASE]
 if any(str(f.get("level","")).lower() in ("high","medium") for f in findings):
  tasks.append({"id":"site-incident","priority":"P0","area":"Site reliability","task":"Triage and document medium/high site-health findings before routine work.","approval":"Diagnosis is automatic; code changes require a reviewed PR."})
 tasks.sort(key=lambda t:({"P0":0,"P1":1,"P2":2,"P3":3}.get(t["priority"],4),t["id"]))
 return {"generated_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),"site":health.get("site"),"health_checked_at":health.get("checked_at"),"health_findings_count":len(findings),"tasks":tasks,"safety_limits":["Drafts are not publication.","External outreach is not sent.","Production/security changes require owner review."]}
def main():
 health=json.loads(Path("claudia-health.json").read_text()) if Path("claudia-health.json").exists() else {}
 plan=build_plan(health)
 Path("claudia-daily-plan.json").write_text(json.dumps(plan,indent=2)+"\n")
 lines=["# Claudia Green — Daily Work Plan", "",f"Generated: {plan['generated_at']}",f"Health findings: {plan['health_findings_count']}",""]
 for t in plan["tasks"]: lines += [f"## {t['priority']} · {t['area']} · {t['id']}",t["task"],f"**Guardrail:** {t['approval']}",""]
 lines += ["## Operating limits",""]+[f"- {s}" for s in plan["safety_limits"]]
 Path("claudia-daily-plan.md").write_text("\n".join(lines)+"\n")
 print(f"Planner generated {len(plan['tasks'])} tasks.")
if __name__=="__main__": main()
