-- =============================================================================
-- Profiles + CV — one row per user holding their profile and résumé text.
-- Same model as the rest of the schema: scoped by user_id, protected by RLS,
-- updated_at stamped by the shared trigger. Adds a PRIVATE storage bucket for
-- the uploaded CV PDF, also RLS-scoped per user (folder = user id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — one row per user (user_id is the primary key, not a separate id)
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  headline           text,
  location           text,
  summary            text,
  seniority          text
                       check (seniority in
                        ('intern', 'junior', 'medior', 'senior', 'lead', 'principal')
                        or seniority is null),
  skills             text[]  not null default '{}',
  target_roles       text[]  not null default '{}',
  target_locations   text[]  not null default '{}',
  target_salary_min  numeric,
  work_modes         text[]  not null default '{}'
                       -- subset of the three canonical modes
                       check (work_modes <@ array['On-site', 'Hybrid', 'Remote']::text[]),
  languages          text[]  not null default '{}',
  links              jsonb   not null default '[]'::jsonb,  -- [{ label, url }]
  cv_text            text,                                   -- extracted/pasted plain text
  cv_file_path       text,                                   -- path in the private 'cvs' bucket
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security — owner-only, same shape as the other tables
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Storage — private bucket for CV PDFs. Each user can only touch objects under
-- their own top-level folder (the first path segment must equal their uid).
-- App code writes to "<user_id>/cv.pdf".
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

create policy "cvs_select_own" on storage.objects
  for select using (
    bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "cvs_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "cvs_update_own" on storage.objects
  for update using (
    bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "cvs_delete_own" on storage.objects
  for delete using (
    bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text
  );
