-- ============================================================
--  THE 5&2 FOUNDATION — Supabase Schema
--  DEDICATED PROJECT. Entirely separate from Restore & Rise.
--  Run this ONLY inside your NEW Foundation Supabase project
--  (Supabase Dashboard → SQL Editor → paste → Run).
--  It never references or touches any Restore & Rise resource.
-- ============================================================

-- ── VOLUNTEER SIGNUPS ──────────────────────────────────────
-- Wired live to the website "Ready to serve?" volunteer form.
create table if not exists public.volunteer_signups (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  area_of_interest text,
  availability     text,
  notes            text,
  status           text not null default 'new',
  source           text not null default 'website'
);

-- ── CONTACT MESSAGES ───────────────────────────────────────
-- Ready for when you add a contact form.
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text,
  email      text,
  subject    text,
  message    text,
  status     text not null default 'new'
);

-- ── PARTNER INQUIRIES ──────────────────────────────────────
-- Ready for the Partners section (Loaves / Fish / Miracle tiers).
create table if not exists public.partner_inquiries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  organization text,
  contact_name text,
  email        text,
  phone        text,
  tier         text,
  message      text,
  status       text not null default 'new'
);

-- ── DONATION INTENTS ───────────────────────────────────────
-- Logs which give-button/amount a visitor chose. This is NOT a
-- payment record. Actual money must move through a payment
-- processor (e.g. Stripe). Keep this only if you want click data.
create table if not exists public.donation_intents (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fund       text,
  amount     text,
  status     text not null default 'intent'
);

-- ============================================================
--  ROW LEVEL SECURITY
--  The public website uses the PUBLIC anon key. RLS restricts
--  the anon role to INSERT ONLY: visitors can submit forms, but
--  CANNOT read, edit, or delete any row with that key. You read
--  submissions from the Supabase dashboard, or from a server
--  using the service_role key (never put service_role in the site).
-- ============================================================

alter table public.volunteer_signups enable row level security;
alter table public.contact_messages   enable row level security;
alter table public.partner_inquiries  enable row level security;
alter table public.donation_intents   enable row level security;

-- Insert-only access for the anon (public) role.
grant insert on public.volunteer_signups to anon;
grant insert on public.contact_messages  to anon;
grant insert on public.partner_inquiries to anon;
grant insert on public.donation_intents  to anon;

create policy "anon insert volunteer_signups"
  on public.volunteer_signups for insert to anon with check (true);
create policy "anon insert contact_messages"
  on public.contact_messages  for insert to anon with check (true);
create policy "anon insert partner_inquiries"
  on public.partner_inquiries for insert to anon with check (true);
create policy "anon insert donation_intents"
  on public.donation_intents  for insert to anon with check (true);

-- No SELECT / UPDATE / DELETE policies are defined for anon,
-- so those actions are denied by default. Reads happen in the
-- dashboard or via the service_role key on a trusted server.

-- Optional: speed up dashboard sorting by newest first.
create index if not exists volunteer_signups_created_idx on public.volunteer_signups (created_at desc);
create index if not exists contact_messages_created_idx   on public.contact_messages   (created_at desc);
create index if not exists partner_inquiries_created_idx  on public.partner_inquiries  (created_at desc);
create index if not exists donation_intents_created_idx   on public.donation_intents   (created_at desc);
