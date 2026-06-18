-- =============================================================================
-- Activity log (unified human feed) + operational ingestion log.
--
--   activity_events       — one append-only row per user-meaningful action,
--                           with a precomputed `summary` for trivial rendering.
--   ingestion_runs        — one row per ingestion run (manual / per-source / cron)
--                           with rolled-up fetched/new/updated counts.
--   ingestion_run_sources — per-source breakdown for a run.
--
-- All three are scoped by user_id and owner-only via RLS, like every other table.
-- activity_events deliberately has NO hard FK on entity_id so the log survives
-- the deletion of the entity it references.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- activity_events
-- -----------------------------------------------------------------------------
create table public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null,                  -- e.g. application.status_changed
  category     text not null
                 check (category in ('application', 'job', 'profile', 'source', 'ingestion')),
  entity_type  text,                           -- application | job | profile | source | ingestion_run
  entity_id    uuid,                           -- nullable, NO FK: log outlives the entity
  summary      text not null,                  -- precomputed human line
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index activity_events_user_created_idx  on public.activity_events (user_id, created_at desc);
create index activity_events_user_category_idx on public.activity_events (user_id, category);

-- -----------------------------------------------------------------------------
-- ingestion_runs
-- -----------------------------------------------------------------------------
create table public.ingestion_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  trigger       text not null check (trigger in ('manual_all', 'manual_source', 'cron')),
  status        text not null check (status in ('ok', 'partial', 'error')),
  sources_run   integer not null default 0,
  jobs_fetched  integer not null default 0,
  jobs_new      integer not null default 0,
  jobs_updated  integer not null default 0,
  started_at    timestamptz,
  finished_at   timestamptz,
  duration_ms   integer,
  created_at    timestamptz not null default now()
);

create index ingestion_runs_user_created_idx on public.ingestion_runs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- ingestion_run_sources (per-source breakdown; user_id denormalized for RLS)
-- -----------------------------------------------------------------------------
create table public.ingestion_run_sources (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.ingestion_runs (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  source_id     uuid references public.sources (id) on delete set null,
  source_type   text not null,
  source_label  text,
  status        text not null check (status in ('ok', 'error', 'skipped')),
  http_status   integer,
  jobs_fetched  integer not null default 0,
  jobs_new      integer not null default 0,
  jobs_updated  integer not null default 0,
  duration_ms   integer,
  message       text,                           -- secrets REDACTED before storing
  created_at    timestamptz not null default now()
);

create index ingestion_run_sources_user_created_idx on public.ingestion_run_sources (user_id, created_at desc);
create index ingestion_run_sources_run_idx          on public.ingestion_run_sources (run_id);
create index ingestion_run_sources_user_source_idx  on public.ingestion_run_sources (user_id, source_id);

-- =============================================================================
-- Row Level Security — owner-only on all three
-- =============================================================================
alter table public.activity_events       enable row level security;
alter table public.ingestion_runs         enable row level security;
alter table public.ingestion_run_sources  enable row level security;

-- activity_events
create policy "activity_events_select_own" on public.activity_events
  for select using (auth.uid() = user_id);
create policy "activity_events_insert_own" on public.activity_events
  for insert with check (auth.uid() = user_id);
create policy "activity_events_delete_own" on public.activity_events
  for delete using (auth.uid() = user_id);

-- ingestion_runs
create policy "ingestion_runs_select_own" on public.ingestion_runs
  for select using (auth.uid() = user_id);
create policy "ingestion_runs_insert_own" on public.ingestion_runs
  for insert with check (auth.uid() = user_id);
create policy "ingestion_runs_delete_own" on public.ingestion_runs
  for delete using (auth.uid() = user_id);

-- ingestion_run_sources
create policy "ingestion_run_sources_select_own" on public.ingestion_run_sources
  for select using (auth.uid() = user_id);
create policy "ingestion_run_sources_insert_own" on public.ingestion_run_sources
  for insert with check (auth.uid() = user_id);
create policy "ingestion_run_sources_delete_own" on public.ingestion_run_sources
  for delete using (auth.uid() = user_id);
