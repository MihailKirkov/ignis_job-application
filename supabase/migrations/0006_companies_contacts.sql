-- =============================================================================
-- Companies + Contacts — the relationship/network layer.
--
--   companies — first-class employers that jobs / contacts / applications hang
--               off. Deduped per user by lower(name).
--   contacts  — the people CRM: who you know, how you met them, when to follow
--               up. Optionally linked to a company (set null on company delete).
--
-- Also adds applications.company_id (nullable) so an application can link to a
-- company without losing the existing free-text applications.company.
--
-- Same model as every other table: scoped by user_id, owner-only via RLS,
-- updated_at stamped by the shared trigger.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  website     text,
  location    text,
  ats_type    text,                            -- greenhouse | lever | ... (free text)
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Dedupe: at most one company per user per case-insensitive name. This is the
-- idempotency anchor for "auto-create-or-link a company by name".
create unique index companies_user_name_idx   on public.companies (user_id, lower(name));
create index        companies_user_created_idx on public.companies (user_id, created_at desc);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------
create table public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  company_id         uuid references public.companies (id) on delete set null,
  name               text not null,
  role               text,
  email              text,
  linkedin_url       text,
  -- "how I met them" — reuses the application channel vocabulary (nullable).
  channel            text   check (channel in
                       ('Detachering', 'Brainport portal', 'LinkedIn', 'Recruiter',
                        'Direct', 'Referral', 'Other') or channel is null),
  notes              text,
  last_contacted_at  timestamptz,
  next_follow_up_at  date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index contacts_user_company_idx  on public.contacts (user_id, company_id);
-- Drives the Phase 2 follow-up queue on /needs-action.
create index contacts_user_followup_idx on public.contacts (user_id, next_follow_up_at);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- applications.company_id — link an application to a company (additive; the
-- free-text applications.company column is left untouched).
-- -----------------------------------------------------------------------------
alter table public.applications
  add column company_id uuid references public.companies (id) on delete set null;

create index applications_company_idx on public.applications (company_id);

-- Best-effort backfill: link existing applications to a company that already
-- shares its name. No companies exist yet at apply time (this migration creates
-- the table), so this is a no-op now but keeps the migration self-documenting and
-- idempotent if re-run after companies are seeded. Never creates a company.
update public.applications a
   set company_id = c.id
  from public.companies c
 where a.user_id = c.user_id
   and a.company_id is null
   and a.company is not null
   and lower(a.company) = lower(c.name);

-- =============================================================================
-- Row Level Security — owner-only, four policies each (same shape as the rest)
-- =============================================================================
alter table public.companies enable row level security;
alter table public.contacts  enable row level security;

-- companies
create policy "companies_select_own" on public.companies
  for select using (auth.uid() = user_id);
create policy "companies_insert_own" on public.companies
  for insert with check (auth.uid() = user_id);
create policy "companies_update_own" on public.companies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "companies_delete_own" on public.companies
  for delete using (auth.uid() = user_id);

-- contacts
create policy "contacts_select_own" on public.contacts
  for select using (auth.uid() = user_id);
create policy "contacts_insert_own" on public.contacts
  for insert with check (auth.uid() = user_id);
create policy "contacts_update_own" on public.contacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "contacts_delete_own" on public.contacts
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Widen the activity_events category vocabulary to include company + contact.
-- (The original constraint is the inline check from 0004_activity_ingestion.sql,
-- auto-named activity_events_category_check.)
-- =============================================================================
alter table public.activity_events drop constraint if exists activity_events_category_check;
alter table public.activity_events add constraint activity_events_category_check
  check (category in
    ('application', 'job', 'profile', 'source', 'ingestion', 'company', 'contact'));
