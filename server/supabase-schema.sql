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
create policy "Users can view own saved searches"
  on public.saved_searches for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved searches"
  on public.saved_searches for insert
  with check (auth.uid() = user_id);

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

create policy "Users can view own price alerts"
  on public.price_alerts for select
  using (auth.uid() = user_id);

create policy "Users can insert own price alerts"
  on public.price_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own price alerts"
  on public.price_alerts for update
  using (auth.uid() = user_id);

create policy "Users can delete own price alerts"
  on public.price_alerts for delete
  using (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_saved_searches_user_id on public.saved_searches(user_id);
create index if not exists idx_price_alerts_user_id on public.price_alerts(user_id);
create index if not exists idx_price_alerts_saved_search_id on public.price_alerts(saved_search_id);