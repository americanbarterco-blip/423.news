-- Private Claudia persistent memory table; service role only.
create table if not exists public.claudia_memories (
 id uuid primary key default gen_random_uuid(),
 content text not null check (char_length(content) between 1 and 5000),
 kind text not null check (kind in ('fact','episode','decision','lesson','project','goal','research')),
 tags text[] not null default '{}' check (cardinality(tags)<=16),
 importance smallint not null default 3 check (importance between 1 and 5),
 project text not null default '423.news' check (char_length(project)<=100),
 source_ref text null check (source_ref is null or char_length(source_ref)<=500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.claudia_memories enable row level security;
alter table public.claudia_memories force row level security;
revoke all on public.claudia_memories from anon, authenticated;
grant all on public.claudia_memories to service_role;
create index if not exists claudia_memories_project_kind_updated on public.claudia_memories(project,kind,updated_at desc);
create index if not exists claudia_memories_updated on public.claudia_memories(updated_at desc);
