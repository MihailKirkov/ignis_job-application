-- =============================================================================
-- AI fit-scoring + per-user Anthropic API key.
-- Adds fit columns to the (already RLS-owned) jobs table, and a separate
-- user_secrets table holding each user's Anthropic API key ENCRYPTED at rest
-- (aes-256-gcm with an app secret in env). The ciphertext is never selected
-- into client-facing reads — only decrypted server-side at call time.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- jobs — AI fit score against the user's profile
-- -----------------------------------------------------------------------------
alter table public.jobs
  add column fit_score           numeric
                                   check (fit_score is null
                                          or (fit_score >= 0 and fit_score <= 100)),
  add column fit_verdict         text
                                   check (fit_verdict in ('strong', 'medium', 'weak')
                                          or fit_verdict is null),
  add column fit_summary         text,
  add column fit_breakdown       jsonb not null default '{}'::jsonb,  -- { matched_skills, gaps }
  add column scored_at           timestamptz,
  -- stable hash of the scoring-relevant profile fields at scoring time; a profile
  -- edit changes the hash, which marks existing scores stale and lets them re-score.
  add column scored_profile_hash text;

-- Default discovery sort when scores exist: highest fit first.
create index jobs_user_fit_idx on public.jobs (user_id, fit_score desc nulls last);

-- -----------------------------------------------------------------------------
-- user_secrets — one row per user, holds the encrypted Anthropic API key
-- -----------------------------------------------------------------------------
create table public.user_secrets (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  anthropic_api_key  text,            -- aes-256-gcm ciphertext (iv.tag.data, base64)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger user_secrets_set_updated_at
  before update on public.user_secrets
  for each row execute function public.set_updated_at();

alter table public.user_secrets enable row level security;

create policy "user_secrets_select_own" on public.user_secrets
  for select using (auth.uid() = user_id);
create policy "user_secrets_insert_own" on public.user_secrets
  for insert with check (auth.uid() = user_id);
create policy "user_secrets_update_own" on public.user_secrets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_secrets_delete_own" on public.user_secrets
  for delete using (auth.uid() = user_id);
