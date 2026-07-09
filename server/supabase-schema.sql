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