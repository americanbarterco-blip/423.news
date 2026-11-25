-- Regional advertising network schema for 423.news.
-- Apply only after reviewing the preview branch. This file is NOT run automatically.
-- Existing 423.news ads remain intact and default to edition 423.

create table if not exists public.ad_advertisers (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null default '423',
  business_name text not null check (char_length(business_name) between 1 and 180),
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  website text not null default '',
  category text not null default '',
  service_area text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_packages (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null default '423',
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  placement_key text not null default 'custom',
  duration_days integer not null default 30 check (duration_days between 1 and 365),
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null default '423',
  advertiser_id uuid not null references public.ad_advertisers(id) on delete restrict,
  package_id uuid references public.ad_packages(id) on delete set null,
  name text not null check (char_length(name) between 1 and 180),
  objective text not null default '',
  status text not null default 'draft' check (status in ('draft','pending_review','approved','active','paused','completed','rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  sold_price_cents integer check (sold_price_cents is null or sold_price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create table if not exists public.ad_orders (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null default '423',
  advertiser_id uuid not null references public.ad_advertisers(id) on delete restrict,
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  package_id uuid references public.ad_packages(id) on delete set null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'quoted' check (status in ('quoted','contracted','invoiced','paid','fulfilled','cancelled')),
  reference_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null default '423',
  placement_key text not null,
  name text not null,
  description text not null default '',
  page_targets text not null default 'all',
  format text not null default 'image_video' check (format in ('image','video','image_video','sponsored_content')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, placement_key)
);

create table if not exists public.ad_delivery_events (
  id bigint generated always as identity primary key,
  edition_id text not null default '423',
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  ad_id uuid not null,
  placement_key text not null,
  event_type text not null check (event_type in ('impression','click')),
  event_key uuid not null unique,
  occurred_at timestamptz not null default now()
);

alter table public.news_ads add column if not exists edition_id text not null default '423';
alter table public.news_ads add column if not exists advertiser_id uuid references public.ad_advertisers(id) on delete set null;
alter table public.news_ads add column if not exists campaign_id uuid references public.ad_campaigns(id) on delete set null;
alter table public.news_ads add column if not exists disclosure text not null default 'Advertisement';

create index if not exists ad_advertisers_edition_status_idx on public.ad_advertisers (edition_id, status, created_at desc);
create index if not exists ad_campaigns_edition_status_idx on public.ad_campaigns (edition_id, status, starts_at, ends_at);
create index if not exists ad_campaigns_advertiser_idx on public.ad_campaigns (advertiser_id);
create index if not exists ad_orders_edition_status_idx on public.ad_orders (edition_id, status, created_at desc);
create index if not exists ad_delivery_events_campaign_time_idx on public.ad_delivery_events (edition_id, campaign_id, occurred_at desc);
create index if not exists news_ads_edition_campaign_idx on public.news_ads (edition_id, campaign_id, active);

insert into public.ad_placements (edition_id, placement_key, name, description, page_targets, format)
values
  ('423','top','Top banner','Below the site header','all','image_video'),
  ('423','mid','In-content placement','Within the main content area','all','image_video'),
  ('423','bottom','Footer placement','Above the site footer','all','image_video'),
  ('423','live_video','Live video commercial break','Commercial break in the homepage live video','index','video')
on conflict (edition_id, placement_key) do nothing;

-- These tables contain advertiser contact details and campaign/order information.
-- They are private staff data; the service-role-backed admin Edge Function is the only app access path.
alter table public.ad_advertisers enable row level security;
alter table public.ad_packages enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_orders enable row level security;
alter table public.ad_placements enable row level security;
alter table public.ad_delivery_events enable row level security;

revoke all on public.ad_advertisers, public.ad_packages, public.ad_campaigns,
  public.ad_orders, public.ad_placements, public.ad_delivery_events
  from anon, authenticated;

grant all on public.ad_advertisers, public.ad_packages, public.ad_campaigns,
  public.ad_orders, public.ad_placements, public.ad_delivery_events
  to service_role;

-- Public visitors can continue reading only eligible display ads through the existing RLS policy.
-- The new advertiser, campaign, order and event tables are not exposed to public roles.
