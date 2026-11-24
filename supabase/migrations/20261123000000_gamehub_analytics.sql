-- 423 Arcade: privacy-conscious first-party analytics
create table if not exists public.gamehub_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view','game_launch','download')),
  game_slug text not null default '' check (length(game_slug) <= 80),
  visitor_id uuid not null,
  session_id uuid not null,
  item_name text not null default '' check (length(item_name) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists gamehub_events_created_idx on public.gamehub_events(created_at desc);
create index if not exists gamehub_events_game_idx on public.gamehub_events(game_slug, event_type, created_at desc);
create index if not exists gamehub_events_visitor_idx on public.gamehub_events(visitor_id, created_at desc);
alter table public.gamehub_events enable row level security;
revoke all on public.gamehub_events from anon, authenticated;
revoke all on sequence public.gamehub_events_id_seq from anon, authenticated;

create or replace function public.gamehub_admin_stats()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from public.gamehub_events),
    'active_sessions_15m', (select count(distinct session_id) from public.gamehub_events where created_at >= now()-interval '15 minutes'),
    'page_views', (select count(*) from public.gamehub_events where event_type='page_view'),
    'game_launches', (select count(*) from public.gamehub_events where event_type='game_launch'),
    'downloads', (select count(*) from public.gamehub_events where event_type='download'),
    'registered_users', (select count(*) from public.news_profiles),
    'per_game', coalesce((select jsonb_agg(jsonb_build_object('game',game_slug,'launches',launches,'downloads',downloads) order by launches desc)
      from (select game_slug, count(*) filter (where event_type='game_launch') launches, count(*) filter (where event_type='download') downloads
        from public.gamehub_events where game_slug<>'' group by game_slug) g),'[]'::jsonb)
  );
$$;
revoke all on function public.gamehub_admin_stats() from public, anon, authenticated;
grant execute on function public.gamehub_admin_stats() to service_role;
