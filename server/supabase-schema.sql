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

alter table public.price_alerts enable row level security;

drop policy if exists "Users can view own price alerts" on public.price_alerts;
create policy "Users can view own price alerts"
  on public.price_alerts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own price alerts" on public.price_alerts;
create policy "Users can insert own price alerts"
  on public.price_alerts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own price alerts" on public.price_alerts;
create policy "Users can update own price alerts"
  on public.price_alerts for update
  using (auth.uid() = user_id);

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

alter table public.guest_alerts enable row level security;

-- One alert per email + search combination (the server lowercases email
-- before insert, and upserts against this index to update the target price).
create unique index if not exists idx_guest_alerts_unique
  on public.guest_alerts (email, year, make, model, part);

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
