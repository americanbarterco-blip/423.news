-- Claudia public source discovery: deduplicated story leads, private to service role/editorial workflow.
create table if not exists public.claudia_story_leads (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (char_length(fingerprint)=64),
  title text not null check (char_length(title) between 1 and 300),
  url text not null check (url ~ '^https?://'),
  summary text not null default '' check (char_length(summary)<=1600),
  published text null,
  source_name text not null check (char_length(source_name)<=200),
  source_url text not null check (source_url ~ '^https?://'),
  source_type text not null default 'feed' check (source_type in ('feed','web','community','video','social')),
  status text not null default 'new' check (status in ('new','reviewed','dismissed','researching','drafted')),
  notes text not null default '',
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz null
);
alter table public.claudia_story_leads enable row level security;
alter table public.claudia_story_leads force row level security;
revoke all on public.claudia_story_leads from anon, authenticated;
grant all on public.claudia_story_leads to service_role;
create index if not exists claudia_story_leads_status_time on public.claudia_story_leads(status,discovered_at desc);
create index if not exists claudia_story_leads_source_time on public.claudia_story_leads(source_name,discovered_at desc);
