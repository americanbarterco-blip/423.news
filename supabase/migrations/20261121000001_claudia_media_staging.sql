-- Private media staging bucket and metadata manifest. No public access or auto-attachment.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('claudia-media-staging','claudia-media-staging',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.claudia_story_media(
 id uuid primary key default gen_random_uuid(), lead_id uuid null references public.claudia_story_leads(id) on delete set null,
 bucket text not null default 'claudia-media-staging' check(bucket='claudia-media-staging'), object_path text not null,
 media_type text not null check(media_type in ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm')),
 size_bytes bigint not null check(size_bytes between 1 and 52428800), sha256 text not null check(char_length(sha256)=64),
 caption text not null check(char_length(caption) between 1 and 500), alt_text text null check(alt_text is null or char_length(alt_text)<=500),
 credit text not null check(char_length(credit) between 1 and 300), source_url text null check(source_url is null or source_url ~ '^https?://'),
 rights_basis text not null check(char_length(rights_basis) between 1 and 500),
 status text not null default 'staged' check(status in ('staged','approved','rejected','attached')), created_at timestamptz not null default now());
alter table public.claudia_story_media enable row level security;alter table public.claudia_story_media force row level security;
revoke all on public.claudia_story_media from anon,authenticated;grant all on public.claudia_story_media to service_role;
create index if not exists claudia_story_media_lead on public.claudia_story_media(lead_id,created_at desc);
create index if not exists claudia_story_media_status on public.claudia_story_media(status,created_at desc);
