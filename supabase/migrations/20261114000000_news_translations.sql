-- 423.news bilingual editorial workflow.
-- Apply only after reviewing this PR. This file is not executed by the preview branch.
create table if not exists public.news_translations (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('news_posts','events','news_headlines')),
  source_id text not null,
  locale text not null default 'es' check (locale = 'es'),
  original_content jsonb not null default '{}'::jsonb,
  translated_content jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','pending_review','approved','rejected')),
  review_notes text,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_translations_source_locale_unique unique (source_table, source_id, locale)
);

create index if not exists news_translations_status_updated_idx
  on public.news_translations (status, updated_at desc);
create index if not exists news_translations_source_idx
  on public.news_translations (source_table, source_id);

alter table public.news_translations enable row level security;
revoke all on public.news_translations from public, anon, authenticated;
grant select on public.news_translations to anon, authenticated;
grant all on public.news_translations to service_role;

drop policy if exists news_translations_public_approved_es on public.news_translations;
create policy news_translations_public_approved_es
  on public.news_translations
  for select to anon, authenticated
  using (locale = 'es' and status = 'approved');

comment on table public.news_translations is
  'Human-reviewed Spanish translations for public news posts, events, and sports headlines. Scanner wire reports are intentionally excluded.';
