-- Persist provider failures so an unavailable AI service does not block the queue.
create table if not exists public.news_translation_auto_failures (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('news_posts','events','news_headlines')),
  source_id text not null,
  attempts integer not null default 1,
  last_error text,
  retry_after timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_translation_auto_failures_source_unique unique (source_table,source_id)
);
create index if not exists news_translation_auto_failures_retry_idx
  on public.news_translation_auto_failures (retry_after);
alter table public.news_translation_auto_failures enable row level security;
revoke all on public.news_translation_auto_failures from public, anon, authenticated;
grant all on public.news_translation_auto_failures to service_role;
