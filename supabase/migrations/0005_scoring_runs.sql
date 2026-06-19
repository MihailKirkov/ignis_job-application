-- =============================================================================
-- Scoring runs — async, DB-tracked, resumable AI fit-scoring.
--
-- A run scores up to ~100 unscored-for-the-current-profile jobs in bounded
-- chunks (one batched + prompt-cached Anthropic call per chunk). The client (or
-- the cron) creates a run, then drives /api/scoring/chunk until none remain, so
-- the UI never blocks on the whole batch and scored jobs persist across reloads.
--
-- Owner-only via RLS like every other table. Includes an UPDATE policy: the chunk
-- endpoint bumps completed/failed/status as it progresses.
-- =============================================================================

create table public.scoring_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  trigger      text not null check (trigger in ('manual', 'cron')),
  status       text not null
                 check (status in ('queued', 'running', 'done', 'error', 'cancelled')),
  total        integer not null default 0,
  completed    integer not null default 0,
  failed       integer not null default 0,
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create index scoring_runs_user_created_idx on public.scoring_runs (user_id, created_at desc);

-- =============================================================================
-- Row Level Security — owner-only
-- =============================================================================
alter table public.scoring_runs enable row level security;

create policy "scoring_runs_select_own" on public.scoring_runs
  for select using (auth.uid() = user_id);
create policy "scoring_runs_insert_own" on public.scoring_runs
  for insert with check (auth.uid() = user_id);
create policy "scoring_runs_update_own" on public.scoring_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scoring_runs_delete_own" on public.scoring_runs
  for delete using (auth.uid() = user_id);
