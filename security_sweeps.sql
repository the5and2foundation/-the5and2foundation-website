-- ============================================================
--  Run this in your 5&2 Foundation Supabase project (SQL Editor).
--  Stores the monthly security sweep reports.
--  Only the server (service_role) can write or read these rows.
-- ============================================================
create table if not exists public.security_sweeps (
  id            uuid primary key default gen_random_uuid(),
  ran_at        timestamptz not null default now(),
  worst_severity text,
  summary       text,
  findings      jsonb
);

alter table public.security_sweeps enable row level security;
-- No anon policies on purpose: the public key cannot read or write sweeps.
-- The sweep function uses the service_role key, which bypasses RLS.

create index if not exists security_sweeps_ran_idx on public.security_sweeps (ran_at desc);
