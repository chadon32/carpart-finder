-- CarPartsRadar shared API limiter migration.
-- This file contains only the rate-limit objects. Apply it after reviewing it
-- in the intended Supabase project; it does not replay the full fresh schema.

create table if not exists public.api_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
-- The compatibility path may update this table directly when PostgREST has
-- not exposed the function yet. Keep that path service-role-only as well.
grant select, insert, update, delete on table public.api_rate_limits to service_role;
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
