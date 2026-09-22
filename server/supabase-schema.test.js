import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const schema = await readFile(new URL('./supabase-schema.sql', import.meta.url), 'utf8')
const rateLimitMigration = await readFile(new URL('./supabase-rate-limit-migration.sql', import.meta.url), 'utf8')

test('account-owned rows cascade from auth users and saved searches', () => {
  assert.match(schema, /user_id uuid references auth\.users\(id\) on delete cascade not null/)
  assert.match(schema, /saved_search_id uuid references public\.saved_searches\(id\) on delete cascade not null/)
})

test('price-alert RLS and trigger require the saved search to belong to the same user', () => {
  assert.match(schema, /saved_searches\.id = price_alerts\.saved_search_id[\s\S]*saved_searches\.user_id = auth\.uid\(\)/)
  assert.match(schema, /where id = new\.saved_search_id and user_id = new\.user_id/)
})

test('database triggers enforce resource quotas under concurrent inserts', () => {
  assert.match(schema, /pg_advisory_xact_lock/)
  assert.match(schema, />= 50 then[\s\S]*saved search limit reached/)
  assert.match(schema, />= 20 then[\s\S]*active price alert limit reached/)
  assert.match(schema, />= 5 then[\s\S]*active guest alert limit reached/)
})

test('shared rate-limit counter is atomic, bounded, and service-role only', () => {
  assert.match(schema, /create table if not exists public\.api_rate_limits/)
  assert.match(schema, /idx_api_rate_limits_updated_at/)
  assert.match(schema, /create or replace function public\.consume_api_rate_limit\([\s\S]*security definer[\s\S]*set search_path = ''/)
  assert.match(schema, /updated_at < now_at - interval '2 days'[\s\S]*limit 100/)
  assert.match(schema, /revoke execute on function public\.consume_api_rate_limit\(text, integer, integer\) from public, anon, authenticated/)
  assert.match(schema, /grant execute on function public\.consume_api_rate_limit\(text, integer, integer\) to service_role/)
})

test('the production migration is narrow and idempotent', () => {
  assert.match(rateLimitMigration, /create table if not exists public\.api_rate_limits/)
  assert.match(rateLimitMigration, /create or replace function public\.consume_api_rate_limit/)
  assert.match(rateLimitMigration, /grant execute on function public\.consume_api_rate_limit\(text, integer, integer\) to service_role/)
  assert.doesNotMatch(rateLimitMigration, /create table if not exists public\.(users|saved_searches|price_alerts)/)
  assert.doesNotMatch(rateLimitMigration, /create trigger|delete_user_data|price_history/)
})
