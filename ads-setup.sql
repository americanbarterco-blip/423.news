-- 423.news ads (images AND videos): run once in Supabase -> SQL Editor.
-- Safe to run again. Adds new things only; changes no existing table.
create table if not exists public.news_ads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null default '',
  slot text not null default 'top' check (slot in ('top','mid','bottom')),
  kind text not null default 'image' check (kind in ('image','video')),
  pages text not null default 'all',      -- 'all' or a comma list: index,category,claudia-scanner,desk,conditions,events,hotspots,report
  image_url text not null,                 -- the picture, or the video file, depending on kind
  href text not null,
  alt text not null default 'Advertisement',
  max_width integer not null default 0 check (max_width between 0 and 2000),  -- px, 0 = full width of the slot
  height integer not null default 0 check (height between 0 and 1000),        -- px, 0 = automatic
  fit text not null default 'contain' check (fit in ('contain','cover')),
  seconds integer not null default 20 check (seconds between 3 and 600),       -- how long this ad shows before the next
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  sort integer not null default 0
);
alter table public.news_ads add column if not exists kind text not null default 'image';
alter table public.news_ads add column if not exists pages text not null default 'all';
do $$ begin
  alter table public.news_ads add constraint news_ads_kind_check check (kind in ('image','video'));
exception when duplicate_object then null; end $$;
alter table public.news_ads enable row level security;
drop policy if exists news_ads_public_read on public.news_ads;
create policy news_ads_public_read on public.news_ads for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
-- no insert/update/delete policies: only the admin function (service role) changes ads

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-ads', 'news-ads', true, 26214400,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
