-- Claudia resumable research tasks, evidence ledger and draft records.
create table if not exists public.claudia_research_tasks(
 id uuid primary key default gen_random_uuid(), lead_id uuid null references public.claudia_story_leads(id) on delete set null,
 task_type text not null default 'research_lead' check(task_type in ('research_lead','verify','draft','media_review','coverage_audit')),
 title text not null, priority integer not null default 50 check(priority between 0 and 100),
 status text not null default 'queued' check(status in ('queued','in_progress','blocked','completed','dismissed')),
 attempt_count integer not null default 0, max_attempts integer not null default 4 check(max_attempts between 1 and 10),
 available_at timestamptz not null default now(), locked_at timestamptz null, locked_by text null,
 last_error text null, result jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.claudia_story_evidence(
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.claudia_story_leads(id) on delete cascade,
 evidence_type text not null check(evidence_type in ('source','corroboration','official_record','media','interview','correction')),
 url text null check(url is null or url ~ '^https?://'), source_name text not null, excerpt text not null default '',
 observed_at timestamptz not null default now(), reliability_notes text not null default '', created_at timestamptz not null default now());
create table if not exists public.claudia_story_drafts(
 id uuid primary key default gen_random_uuid(), lead_id uuid null references public.claudia_story_leads(id) on delete set null,
 title text not null, slug text null, body_markdown text not null, summary text not null default '',
 status text not null default 'draft' check(status in ('draft','needs_review','approved','published','rejected')),
 verification_status text not null default 'unverified' check(verification_status in ('unverified','in_progress','verified','needs_correction')),
 source_count integer not null default 0 check(source_count>=0), author_agent text not null default 'Claudia Green',
 editor_notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz null);
create unique index if not exists claudia_tasks_one_type_per_lead on public.claudia_research_tasks(lead_id,task_type) where lead_id is not null;
alter table public.claudia_research_tasks enable row level security;alter table public.claudia_research_tasks force row level security;
alter table public.claudia_story_evidence enable row level security;alter table public.claudia_story_evidence force row level security;
alter table public.claudia_story_drafts enable row level security;alter table public.claudia_story_drafts force row level security;
revoke all on public.claudia_research_tasks,public.claudia_story_evidence,public.claudia_story_drafts from anon,authenticated;
grant all on public.claudia_research_tasks,public.claudia_story_evidence,public.claudia_story_drafts to service_role;
create index if not exists claudia_tasks_ready on public.claudia_research_tasks(status,available_at,priority desc);
create index if not exists claudia_tasks_lead on public.claudia_research_tasks(lead_id);
create index if not exists claudia_evidence_lead on public.claudia_story_evidence(lead_id,observed_at desc);
create index if not exists claudia_drafts_status on public.claudia_story_drafts(status,updated_at desc);
