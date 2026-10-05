-- Additive owner analytics only. No customer tables or auth policies change.
create table if not exists public.website_analytics_events (
  event_id uuid primary key,
  occurred_at timestamptz not null default pg_catalog.now(),
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  event_name text not null check (event_name in (
    'Page Viewed', 'Vehicle Selected', 'Search Started', 'Search Results Viewed',
    'Search Failed', 'Listing Opened', 'Retailer Clicked', 'Added to Watchlist',
    'Price Alert Created', 'Generated AI Repair Guide', 'comparison_checklist_shared',
    'guide_search_started', 'part_identification_demo'
  )),
  properties jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(properties) = 'object'),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  source text not null check (source in ('direct', 'search', 'social', 'referral'))
);
create index if not exists website_analytics_time_idx on public.website_analytics_events (occurred_at);
create index if not exists website_analytics_session_idx on public.website_analytics_events (session_hash, occurred_at);
alter table public.website_analytics_events enable row level security;
revoke all on table public.website_analytics_events from public, anon, authenticated;
grant select, insert on table public.website_analytics_events to service_role;

create or replace function public.website_analytics_summary(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (pg_catalog.now() at time zone 'America/Phoenix')::date;
  first_day date;
  result jsonb;
begin
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'invalid analytics period' using errcode = '22023';
  end if;
  first_day := today - (p_days - 1);
  with raw as materialized (
    select * from public.website_analytics_events
    where occurred_at >= (first_day::timestamp at time zone 'America/Phoenix')
      and occurred_at <= pg_catalog.now()
  ), sessions as (
    select session_hash,
      max(case event_name
        when 'Vehicle Selected' then 1
        when 'Search Started' then 2 when 'Search Failed' then 2
        when 'Search Results Viewed' then 3
        when 'Listing Opened' then 4 when 'Added to Watchlist' then 4
        when 'Retailer Clicked' then 5 else 0 end) as stage,
      pg_catalog.bool_or(event_name <> 'Page Viewed') as engaged,
      (pg_catalog.array_agg(device order by occurred_at, event_id))[1] as device,
      (pg_catalog.array_agg(source order by occurred_at, event_id))[1] as source
    from raw group by session_hash
  ), stages as (
    select s.rank, s.label, pg_catalog.count(v.session_hash) as count
    from (values (0, 'Visited the website'), (1, 'Selected a vehicle'),
      (2, 'Started a part search'), (3, 'Reached search results'),
      (4, 'Opened or saved a listing'), (5, 'Clicked through to a store')) as s(rank, label)
    left join sessions v on v.stage >= s.rank
    group by s.rank, s.label
  ), day_stats as (
    select (occurred_at at time zone 'America/Phoenix')::date as day,
      pg_catalog.count(distinct visitor_hash) as visitors,
      pg_catalog.count(distinct session_hash) as visits,
      pg_catalog.count(*) filter (where event_name = 'Page Viewed') as pageviews,
      pg_catalog.count(*) filter (where event_name = 'Search Started') as searches,
      pg_catalog.count(*) filter (where event_name = 'Retailer Clicked') as clicks
    from raw group by 1
  ), calendar as (
    select d::date as day from pg_catalog.generate_series(first_day::timestamp, today::timestamp, interval '1 day') d
  )
  select pg_catalog.jsonb_build_object(
    'version', 1, 'days', p_days, 'timezone', 'America/Phoenix',
    'startDate', first_day, 'endDate', today,
    'firstTrackedAt', (select pg_catalog.min(occurred_at) from public.website_analytics_events),
    'totals', pg_catalog.jsonb_build_object(
      'dailyVisitors', (select pg_catalog.count(distinct visitor_hash) from raw),
      'visits', (select pg_catalog.count(*) from sessions),
      'pageviews', (select pg_catalog.count(*) from raw where event_name = 'Page Viewed'),
      'searches', (select pg_catalog.count(*) from raw where event_name = 'Search Started'),
      'retailerClicks', (select pg_catalog.count(*) from raw where event_name = 'Retailer Clicked'),
      'engagedVisits', (select pg_catalog.count(*) from sessions where engaged),
      'storeClickVisits', (select pg_catalog.count(*) from sessions where stage = 5),
      'emptySearches', (select pg_catalog.count(*) from raw where event_name = 'Search Results Viewed' and properties->>'hasResults' = 'false'),
      'failedSearches', (select pg_catalog.count(*) from raw where event_name = 'Search Failed')
    ),
    'funnel', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('rank', rank, 'label', label, 'count', count) order by rank) from stages),
    'daily', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'day', c.day, 'visitors', coalesce(s.visitors, 0),
      'visits', coalesce(s.visits, 0), 'pageviews', coalesce(s.pageviews, 0),
      'searches', coalesce(s.searches, 0), 'clicks', coalesce(s.clicks, 0)
    ) order by c.day) from calendar c left join day_stats s on s.day = c.day),
    'devices', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', device, 'count', count) order by count desc, device)
      from (select device, pg_catalog.count(*) as count from sessions group by device) d), '[]'::jsonb),
    'sources', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', source, 'count', count) order by count desc, source)
      from (select source, pg_catalog.count(*) as count from sessions group by source) d), '[]'::jsonb),
    'retailers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', retailer, 'count', count) order by count desc, retailer)
      from (select properties->>'retailerId' as retailer, pg_catalog.count(*) as count from raw
        where event_name = 'Retailer Clicked' group by properties->>'retailerId') d), '[]'::jsonb),
    'pages', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', page, 'count', count) order by count desc, page)
      from (select properties->>'page' as page, pg_catalog.count(*) as count from raw
        where event_name = 'Page Viewed' group by properties->>'page') d), '[]'::jsonb),
    'actions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', event_name, 'count', count) order by count desc, event_name)
      from (select event_name, pg_catalog.count(*) as count from raw where event_name in
        ('Added to Watchlist', 'Price Alert Created', 'Generated AI Repair Guide', 'comparison_checklist_shared') group by event_name) d), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.website_analytics_summary(integer) from public, anon, authenticated;
grant execute on function public.website_analytics_summary(integer) to service_role;
comment on table public.website_analytics_events is 'Allowlisted website events only. Daily HMAC visitor estimates; no raw IP, URL, account, VIN or search text.';
