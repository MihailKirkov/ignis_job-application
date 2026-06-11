-- =============================================================================
-- Job Discovery + Application Tracker — initial schema
-- Multi-user from day one: every table is scoped by user_id and protected by RLS.
-- A user can only ever read/write rows where user_id = auth.uid().
-- =============================================================================

-- gen_random_uuid() lives in pgcrypto; Supabase ships it but enable defensively.
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- jobs — discovered postings ingested from sources (created before applications
-- because applications.job_id references it)
-- -----------------------------------------------------------------------------
create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  source       text not null,                 -- adzuna | arbeitnow | remotive | remoteok | greenhouse | lever | ashby | workable | import
  external_id  text not null,                 -- source-native id (stable per source)
  title        text not null,
  company      text,
  location     text,
  mode         text,                          -- On-site | Hybrid | Remote | null
  salary_min   numeric,
  salary_max   numeric,
  currency     text,
  url          text,
  description  text,
  posted_at    timestamptz,
  raw          jsonb not null default '{}'::jsonb,
  fuzzy_key    text,                           -- normalized company+title+location, for fuzzy dedupe
  state        text not null default 'new'
                 check (state in ('new', 'saved', 'dismissed', 'promoted')),
  ingested_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Hard dedupe key: one row per (user, source, external_id).
  unique (user_id, source, external_id)
);

create index jobs_user_state_idx     on public.jobs (user_id, state);
create index jobs_user_fuzzy_idx     on public.jobs (user_id, fuzzy_key);
create index jobs_user_posted_idx    on public.jobs (user_id, posted_at desc);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- applications — the owner's real pipeline
-- -----------------------------------------------------------------------------
create table public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  job_id            uuid references public.jobs (id) on delete set null,
  company           text not null,
  role              text not null,
  location          text,
  mode              text   check (mode in ('On-site', 'Hybrid', 'Remote') or mode is null),
  channel           text   check (channel in
                      ('Detachering', 'Brainport portal', 'LinkedIn', 'Recruiter',
                       'Direct', 'Referral', 'Other') or channel is null),
  status            text not null default 'To apply'
                      check (status in
                       ('To apply', 'Applied', 'Screening', 'Interview',
                        'Offer', 'Rejected', 'Closed')),
  salary            text,                       -- free text, e.g. "€60–70k"
  link              text,
  contact           text,
  date_applied      date,
  next_action       text,
  next_action_date  date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index applications_user_status_idx      on public.applications (user_id, status);
create index applications_user_nextaction_idx  on public.applications (user_id, next_action_date);
create index applications_job_idx               on public.applications (job_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- sources — per-user ingestion config (which feeds/company boards are enabled)
-- -----------------------------------------------------------------------------
create table public.sources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null,                  -- adzuna | arbeitnow | remotive | remoteok | greenhouse | lever | ashby | workable
  config       jsonb not null default '{}'::jsonb,  -- e.g. { "token": "acme" } or { "query": "react", "where": "Eindhoven" }
  enabled      boolean not null default true,
  last_run_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index sources_user_enabled_idx on public.sources (user_id, enabled);

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- saved_filters — reusable discovery-inbox filter presets
-- -----------------------------------------------------------------------------
create table public.saved_filters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  criteria    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index saved_filters_user_idx on public.saved_filters (user_id);

create trigger saved_filters_set_updated_at
  before update on public.saved_filters
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security — enable + per-table owner-only policies
-- =============================================================================
alter table public.jobs          enable row level security;
alter table public.applications  enable row level security;
alter table public.sources       enable row level security;
alter table public.saved_filters enable row level security;

-- jobs
create policy "jobs_select_own" on public.jobs
  for select using (auth.uid() = user_id);
create policy "jobs_insert_own" on public.jobs
  for insert with check (auth.uid() = user_id);
create policy "jobs_update_own" on public.jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "jobs_delete_own" on public.jobs
  for delete using (auth.uid() = user_id);

-- applications
create policy "applications_select_own" on public.applications
  for select using (auth.uid() = user_id);
create policy "applications_insert_own" on public.applications
  for insert with check (auth.uid() = user_id);
create policy "applications_update_own" on public.applications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "applications_delete_own" on public.applications
  for delete using (auth.uid() = user_id);

-- sources
create policy "sources_select_own" on public.sources
  for select using (auth.uid() = user_id);
create policy "sources_insert_own" on public.sources
  for insert with check (auth.uid() = user_id);
create policy "sources_update_own" on public.sources
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sources_delete_own" on public.sources
  for delete using (auth.uid() = user_id);

-- saved_filters
create policy "saved_filters_select_own" on public.saved_filters
  for select using (auth.uid() = user_id);
create policy "saved_filters_insert_own" on public.saved_filters
  for insert with check (auth.uid() = user_id);
create policy "saved_filters_update_own" on public.saved_filters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_filters_delete_own" on public.saved_filters
  for delete using (auth.uid() = user_id);
