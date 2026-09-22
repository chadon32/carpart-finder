-- Supabase Schema for CarPartsRadar
-- Run this in the Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ============================================
-- SAVED SEARCHES
-- ============================================
create table if not exists public.saved_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year text not null,
  make text not null,
  model text not null,
  trim text,
  part text not null,
  created_at timestamptz default now()
);

-- NOT VALID keeps this migration deployable if old rows need cleanup while
-- enforcing the bounds for every new row immediately.
do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'saved_searches_bounded_fields' and conrelid = 'public.saved_searches'::regclass
  ) then
    alter table public.saved_searches add constraint saved_searches_bounded_fields check (
      year ~ '^[0-9]{4}$'
      and pg_catalog.char_length(pg_catalog.btrim(make)) between 1 and 60
      and pg_catalog.char_length(pg_catalog.btrim(model)) between 1 and 60
      and (trim is null or pg_catalog.char_length(pg_catalog.btrim(trim)) between 1 and 60)
      and pg_catalog.char_length(pg_catalog.btrim(part)) between 1 and 60
    ) not valid;
  end if;
end $$;

-- Enable RLS
alter table public.saved_searches enable row level security;

-- Users can only see their own saved searches
drop policy if exists "Users can view own saved searches" on public.saved_searches;
create policy "Users can view own saved searches"
  on public.saved_searches for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved searches" on public.saved_searches;
create policy "Users can insert own saved searches"
  on public.saved_searches for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saved searches" on public.saved_searches;
create policy "Users can delete own saved searches"
  on public.saved_searches for delete
  using (auth.uid() = user_id);

-- ============================================
-- PRICE ALERTS
-- ============================================
create table if not exists public.price_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  saved_search_id uuid references public.saved_searches(id) on delete cascade not null,
  target_price numeric not null,
  is_active boolean default true,
  last_checked_at timestamptz,
  last_price numeric,
  triggered_at timestamptz,
  created_at timestamptz default now()
);

do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'price_alerts_valid_target' and conrelid = 'public.price_alerts'::regclass
  ) then
    alter table public.price_alerts add constraint price_alerts_valid_target
      check (target_price > 0 and target_price <= 1000000) not valid;
  end if;
end $$;

alter table public.price_alerts enable row level security;

drop policy if exists "Users can view own price alerts" on public.price_alerts;
create policy "Users can view own price alerts"
  on public.price_alerts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own price alerts" on public.price_alerts;
create policy "Users can insert own price alerts"
  on public.price_alerts for insert
  with check (
    auth.uid() = price_alerts.user_id
    and exists (
      select 1 from public.saved_searches
      where saved_searches.id = price_alerts.saved_search_id
        and saved_searches.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own price alerts" on public.price_alerts;
create policy "Users can update own price alerts"
  on public.price_alerts for update
  using (auth.uid() = price_alerts.user_id)
  with check (
    auth.uid() = price_alerts.user_id
    and exists (
      select 1 from public.saved_searches
      where saved_searches.id = price_alerts.saved_search_id
        and saved_searches.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own price alerts" on public.price_alerts;
create policy "Users can delete own price alerts"
  on public.price_alerts for delete
  using (auth.uid() = user_id);

-- ============================================
-- GUEST ALERTS (email-only price alerts, no account)
-- ============================================
-- Written only by the server with the service-role key; RLS is enabled with
-- no policies so the anon key can neither read nor write these rows.
create table if not exists public.guest_alerts (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  year text not null,
  make text not null,
  model text not null,
  trim text,
  part text not null,
  target_price numeric not null,
  is_active boolean default true,
  last_checked_at timestamptz,
  last_price numeric,
  triggered_at timestamptz,
  created_at timestamptz default now()
);

do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'guest_alerts_bounded_fields' and conrelid = 'public.guest_alerts'::regclass
  ) then
    alter table public.guest_alerts add constraint guest_alerts_bounded_fields check (
      pg_catalog.char_length(pg_catalog.btrim(email)) between 3 and 254
      and year ~ '^[0-9]{4}$'
      and pg_catalog.char_length(pg_catalog.btrim(make)) between 1 and 60
      and pg_catalog.char_length(pg_catalog.btrim(model)) between 1 and 60
      and (trim is null or pg_catalog.char_length(pg_catalog.btrim(trim)) between 1 and 60)
      and pg_catalog.char_length(pg_catalog.btrim(part)) between 1 and 60
      and target_price > 0 and target_price <= 1000000
    ) not valid;
  end if;
end $$;

alter table public.guest_alerts enable row level security;

-- One alert per email + search combination (the server lowercases email
-- before insert, and upserts against this index to update the target price).
create unique index if not exists idx_guest_alerts_unique
  on public.guest_alerts (email, year, make, model, part);

-- Database-level ownership and quota enforcement backs up the API checks and
-- remains effective if a client calls Supabase directly. Advisory locks make
-- the count + insert decision safe under rapid concurrent taps.
create or replace function public.enforce_saved_search_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));

  if exists (
    select 1 from public.saved_searches
    where user_id = new.user_id
      and year = new.year
      and pg_catalog.lower(make) = pg_catalog.lower(new.make)
      and pg_catalog.lower(model) = pg_catalog.lower(new.model)
      and pg_catalog.lower(pg_catalog.coalesce(trim, '')) = pg_catalog.lower(pg_catalog.coalesce(new.trim, ''))
      and pg_catalog.lower(part) = pg_catalog.lower(new.part)
  ) then
    raise exception 'duplicate saved search' using errcode = '23505';
  end if;

  if (select pg_catalog.count(*) from public.saved_searches where user_id = new.user_id) >= 50 then
    raise exception 'saved search limit reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_saved_search_policy_trigger on public.saved_searches;
create trigger enforce_saved_search_policy_trigger
  before insert on public.saved_searches
  for each row execute function public.enforce_saved_search_policy();

create or replace function public.enforce_price_alert_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 1));

  if not exists (
    select 1 from public.saved_searches
    where id = new.saved_search_id and user_id = new.user_id
  ) then
    raise exception 'saved search does not belong to user' using errcode = '42501';
  end if;

  if new.is_active then
    if exists (
      select 1 from public.price_alerts
      where user_id = new.user_id
        and saved_search_id = new.saved_search_id
        and is_active
        and id is distinct from new.id
    ) then
      raise exception 'duplicate active price alert' using errcode = '23505';
    end if;

    if (
      select pg_catalog.count(*) from public.price_alerts
      where user_id = new.user_id and is_active and id is distinct from new.id
    ) >= 20 then
      raise exception 'active price alert limit reached' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_price_alert_policy_trigger on public.price_alerts;
create trigger enforce_price_alert_policy_trigger
  before insert or update of user_id, saved_search_id, is_active on public.price_alerts
  for each row execute function public.enforce_price_alert_policy();

create or replace function public.enforce_guest_alert_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := pg_catalog.lower(pg_catalog.btrim(new.email));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.email, 2));

  -- Let INSERT ... ON CONFLICT reach its UPDATE path; the UPDATE trigger then
  -- checks whether reactivating the existing row would exceed the quota.
  if tg_op = 'INSERT' and exists (
    select 1 from public.guest_alerts
    where email = new.email and year = new.year and make = new.make
      and model = new.model and part = new.part
  ) then
    return new;
  end if;

  if new.is_active and (
    select pg_catalog.count(*) from public.guest_alerts
    where email = new.email and is_active and id is distinct from new.id
  ) >= 5 then
    raise exception 'active guest alert limit reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_guest_alert_policy_trigger on public.guest_alerts;
create trigger enforce_guest_alert_policy_trigger
  before insert or update of email, year, make, model, trim, part, is_active on public.guest_alerts
  for each row execute function public.enforce_guest_alert_policy();

-- ============================================
-- SHARED API RATE LIMITS
-- ============================================
-- The web/API deployment can run on many short-lived instances. Keep only a
-- one-way client key hash here; raw IPs and account identifiers never enter
-- the rate-limit table. The service-role-only function performs the window
-- rollover and increment atomically under the row's unique-key lock.
create table if not exists public.api_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
create index if not exists idx_api_rate_limits_updated_at on public.api_rate_limits(updated_at);

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table(allowed boolean, count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := pg_catalog.now();
  entry public.api_rate_limits%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400
    or p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  -- Bound maintenance work so expiry cleanup cannot become a request-sized
  -- table scan during a burst of traffic.
  delete from public.api_rate_limits
   where key_hash in (
     select key_hash from public.api_rate_limits
      where updated_at < now_at - interval '2 days'
      order by updated_at
      limit 100
   );

  insert into public.api_rate_limits(key_hash, window_start, request_count, updated_at)
  values (p_key_hash, now_at, 1, now_at)
  on conflict (key_hash) do update set
    request_count = case
      when public.api_rate_limits.window_start <= now_at - (p_window_seconds * interval '1 second') then 1
      else public.api_rate_limits.request_count + 1
    end,
    window_start = case
      when public.api_rate_limits.window_start <= now_at - (p_window_seconds * interval '1 second') then now_at
      else public.api_rate_limits.window_start
    end,
    updated_at = now_at
  returning * into entry;

  return query select
    entry.request_count <= p_limit,
    entry.request_count,
    entry.window_start + (p_window_seconds * interval '1 second');
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

-- ============================================
-- ACCOUNT DELETION
-- ============================================
-- The API calls this function with the service-role client after it has
-- authenticated the request. Keeping application-row cleanup in one
-- transaction prevents a failed delete from leaving a half-cleaned account.
-- The function is not callable by client roles; Auth deletion happens next on
-- the trusted server through auth.admin.deleteUser(..., false).
create or replace function public.delete_user_data(
  p_user_id uuid,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  -- Delete children explicitly so this remains correct even if a future
  -- migration changes a foreign key action.
  delete from public.price_alerts where user_id = p_user_id;
  delete from public.saved_searches where user_id = p_user_id;

  -- Guest alerts are not FK-linked to auth.users, but an authenticated user
  -- may have created one with the same email before signing up. Remove those
  -- email-owned rows as part of the user's personal-data deletion.
  if p_email is not null and pg_catalog.btrim(p_email) <> '' then
    delete from public.guest_alerts
      where pg_catalog.lower(email) = pg_catalog.lower(pg_catalog.btrim(p_email));
  end if;
end;
$$;

revoke execute on function public.delete_user_data(uuid, text) from public;
revoke execute on function public.delete_user_data(uuid, text) from anon, authenticated;
grant execute on function public.delete_user_data(uuid, text) to service_role;

-- ============================================
-- PRICE HISTORY (daily observed lows per search signature)
-- ============================================
-- Written only by the server with the service-role key (organic searches and
-- the alert cron); RLS is enabled with no policies so the anon key can neither
-- read nor write. make/model/part are stored normalized lowercase.
create table if not exists public.price_history (
  id uuid primary key default uuid_generate_v4(),
  year text not null,
  make text not null,
  model text not null,
  part text not null,
  observed_date date not null,
  price numeric not null,
  created_at timestamptz default now()
);

alter table public.price_history enable row level security;

create unique index if not exists idx_price_history_daily
  on public.price_history (year, make, model, part, observed_date);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_saved_searches_user_id on public.saved_searches(user_id);
create index if not exists idx_price_alerts_user_id on public.price_alerts(user_id);
create index if not exists idx_price_alerts_saved_search_id on public.price_alerts(saved_search_id);
create index if not exists idx_guest_alerts_active on public.guest_alerts(is_active);
