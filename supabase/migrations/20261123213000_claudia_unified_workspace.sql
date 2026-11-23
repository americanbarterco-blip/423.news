-- Unified Claudia workspace: persistent thread history and controlled action-request staging.
-- Tables are server-only; no public/authenticated policies or grants are created.
create table if not exists public.claudia_workspace_conversations (
  id uuid primary key,
  title text not null default 'Claudia conversation' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.claudia_workspace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.claudia_workspace_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 20000),
  created_at timestamptz not null default now()
);
create index if not exists claudia_workspace_messages_thread_time on public.claudia_workspace_messages(conversation_id,created_at);
create table if not exists public.claudia_workspace_action_requests (
  id uuid primary key default gen_random_uuid(),
  summary text not null check (char_length(summary) <= 200),
  details text not null check (char_length(details) <= 4000),
  action_type text not null default 'site_change' check (char_length(action_type) <= 60),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists claudia_workspace_action_status_time on public.claudia_workspace_action_requests(status,created_at desc);
alter table public.claudia_workspace_conversations enable row level security;
alter table public.claudia_workspace_messages enable row level security;
alter table public.claudia_workspace_action_requests enable row level security;
revoke all on public.claudia_workspace_conversations from anon, authenticated;
revoke all on public.claudia_workspace_messages from anon, authenticated;
revoke all on public.claudia_workspace_action_requests from anon, authenticated;