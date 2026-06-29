-- =============================================================================
-- Message templates — reusable outreach boilerplate with {variable} slots.
--
-- One row per saved template (detachering DM, open-application email, follow-up,
-- recruiter DM, …). The body/subject may contain {company} / {role} / {contact} /
-- {stack} / {name} tokens, substituted when a draft is composed (and optionally
-- AI-personalized). Pure boilerplate the user owns — NOT an event-worthy entity,
-- so saving/editing/deleting a template emits NO activity_events row (unlike every
-- other mutation). This is deliberate: templates are settings, not activity.
--
-- Same model as every other table: scoped by user_id, owner-only via RLS,
-- updated_at stamped by the shared trigger.
-- =============================================================================

create table public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  kind        text not null default 'other'
                check (kind in
                  ('detachering_dm', 'open_app_email', 'follow_up', 'recruiter_dm', 'other')),
  subject     text,
  body        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Newest-first listing on /profile.
create index message_templates_user_created_idx
  on public.message_templates (user_id, created_at desc);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security — owner-only, four policies (same shape as the rest)
-- =============================================================================
alter table public.message_templates enable row level security;

create policy "message_templates_select_own" on public.message_templates
  for select using (auth.uid() = user_id);
create policy "message_templates_insert_own" on public.message_templates
  for insert with check (auth.uid() = user_id);
create policy "message_templates_update_own" on public.message_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "message_templates_delete_own" on public.message_templates
  for delete using (auth.uid() = user_id);
