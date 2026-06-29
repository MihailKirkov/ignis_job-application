-- =============================================================================
-- Outreach — the touch log for relationship-driven job search.
--
-- One row per message/touch you send (detachering DM, open-application email,
-- follow-up). Loosely linked to a contact, a company, and/or an application — all
-- nullable with ON DELETE SET NULL, so the log outlives any of them. The
-- next_bump_at date feeds the follow-up queue on /needs-action.
--
-- Same model as every other table: scoped by user_id, owner-only via RLS,
-- updated_at stamped by the shared trigger.
-- =============================================================================

create table public.outreach (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete set null,
  company_id      uuid references public.companies (id) on delete set null,
  application_id  uuid references public.applications (id) on delete set null,
  -- reuses the application channel vocabulary (nullable).
  channel         text   check (channel in
                    ('Detachering', 'Brainport portal', 'LinkedIn', 'Recruiter',
                     'Direct', 'Referral', 'Other') or channel is null),
  status          text not null default 'Sent'
                    check (status in ('Sent', 'Replied', 'No reply', 'Bounced')),
  subject         text,
  body            text,
  sent_at         timestamptz not null default now(),
  next_bump_at    date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- (user_id, next_bump_at) drives the follow-up queue; the others back the
-- contact/company timelines and the by-status attribution (Phase 3).
create index outreach_user_bump_idx    on public.outreach (user_id, next_bump_at);
create index outreach_user_contact_idx on public.outreach (user_id, contact_id);
create index outreach_user_company_idx on public.outreach (user_id, company_id);
create index outreach_user_status_idx  on public.outreach (user_id, status);

create trigger outreach_set_updated_at
  before update on public.outreach
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security — owner-only, four policies (same shape as the rest)
-- =============================================================================
alter table public.outreach enable row level security;

create policy "outreach_select_own" on public.outreach
  for select using (auth.uid() = user_id);
create policy "outreach_insert_own" on public.outreach
  for insert with check (auth.uid() = user_id);
create policy "outreach_update_own" on public.outreach
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outreach_delete_own" on public.outreach
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Widen the activity_events category vocabulary to include outreach.
-- =============================================================================
alter table public.activity_events drop constraint if exists activity_events_category_check;
alter table public.activity_events add constraint activity_events_category_check
  check (category in
    ('application', 'job', 'profile', 'source', 'ingestion', 'company', 'contact', 'outreach'));
