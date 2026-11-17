-- Dashboard sync setup for Supabase. Run this once.
-- Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
--
-- How it keeps your data private:
--   * Your data lives in one table that nobody can read or write directly.
--   * The page can only call two functions, and each needs your long random
--     sync code (48 characters). Without that code there is nothing to find.
--   * Anyone who has your setup code can read and change your dashboard data,
--     so keep it private.

create table if not exists public.dashboards (
  code       text primary key check (char_length(code) >= 32),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row level security on, with no policies: no direct access to the table.
alter table public.dashboards enable row level security;

create or replace function public.get_dashboard(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.dashboards where code = p_code;
$$;

create or replace function public.put_dashboard(p_code text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code is null or char_length(p_code) < 32 then
    raise exception 'invalid code';
  end if;
  if octet_length(p_data::text) > 500000 then
    raise exception 'data too large';
  end if;
  insert into public.dashboards (code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (code) do update
    set data = excluded.data, updated_at = now();
end;
$$;

revoke all on function public.get_dashboard(text) from public;
revoke all on function public.put_dashboard(text, jsonb) from public;
grant execute on function public.get_dashboard(text) to anon;
grant execute on function public.put_dashboard(text, jsonb) to anon;
