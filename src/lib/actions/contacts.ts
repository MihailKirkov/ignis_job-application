'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { logActivity } from '@/lib/activity/log';
import {
  buildContactPayload,
  contactCompanyName,
  validateContact,
  type RawContactInput,
} from '@/lib/contacts';
import type { Database } from '@/types/database';

export type ContactActionState = { ok: boolean; error?: string } | null;

function revalidate() {
  revalidatePath('/contacts');
  revalidatePath('/needs-action');
  revalidatePath('/activity');
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === 'string' ? v : null;
}

function rawFromForm(fd: FormData): RawContactInput {
  return {
    name: str(fd, 'name'),
    company: str(fd, 'company'),
    role: str(fd, 'role'),
    email: str(fd, 'email'),
    linkedin_url: str(fd, 'linkedin_url'),
    channel: str(fd, 'channel'),
    notes: str(fd, 'notes'),
    last_contacted_at: str(fd, 'last_contacted_at'),
    next_follow_up_at: str(fd, 'next_follow_up_at'),
  };
}

// PostgREST ilike treats % and _ as wildcards — escape them for a literal match.
function ilikeLiteral(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

// Idempotent against the unique (user_id, lower(name)) index: link to an existing
// company by case-insensitive name, else create one. The auto-created company is
// a silent link (the contact action emits the single user-facing event) — keeping
// the "exactly one logActivity per mutation" rule intact.
async function findOrCreateCompany(
  supabase: SupabaseClient<Database>,
  userId: string,
  rawName: string | null,
): Promise<string | null> {
  if (!rawName) return null;
  const name = rawName.trim();
  if (name === '') return null;
  const literal = ilikeLiteral(name);

  const existing = await supabase
    .from('companies')
    .select('id')
    .ilike('name', literal)
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const created = await supabase
    .from('companies')
    .insert({ user_id: userId, name })
    .select('id')
    .single();
  if (created.data?.id) return created.data.id;

  // Lost a race against a concurrent insert — re-select the winner.
  if (created.error?.code === '23505') {
    const again = await supabase
      .from('companies')
      .select('id')
      .ilike('name', literal)
      .limit(1)
      .maybeSingle();
    return again.data?.id ?? null;
  }
  return null;
}

export async function createContact(
  _prev: ContactActionState,
  fd: FormData,
): Promise<ContactActionState> {
  const user = await requireUser();
  const raw = rawFromForm(fd);
  const payload = buildContactPayload(raw);
  const error = validateContact(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const companyName = contactCompanyName(raw);
  const companyId = await findOrCreateCompany(supabase, user.id, companyName);

  const { data: created, error: dbError } = await supabase
    .from('contacts')
    .insert({ ...payload, company_id: companyId, user_id: user.id })
    .select('id')
    .single();
  if (dbError) return { ok: false, error: dbError.message };

  await logActivity(supabase, user.id, {
    type: 'contact.created',
    entityType: 'contact',
    entityId: (created as { id: string } | null)?.id ?? null,
    meta: { name: payload.name, company: companyName, company_id: companyId },
  });
  revalidate();
  return { ok: true };
}

export async function updateContact(
  _prev: ContactActionState,
  fd: FormData,
): Promise<ContactActionState> {
  const user = await requireUser();
  const id = str(fd, 'id');
  if (!id) return { ok: false, error: 'Missing contact id.' };
  const raw = rawFromForm(fd);
  const payload = buildContactPayload(raw);
  const error = validateContact(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const companyName = contactCompanyName(raw);
  const companyId = await findOrCreateCompany(supabase, user.id, companyName);

  // RLS guarantees the row belongs to the signed-in user.
  const { error: dbError } = await supabase
    .from('contacts')
    .update({ ...payload, company_id: companyId })
    .eq('id', id);
  if (dbError) return { ok: false, error: dbError.message };

  await logActivity(supabase, user.id, {
    type: 'contact.updated',
    entityType: 'contact',
    entityId: id,
    meta: { name: payload.name, company: companyName, company_id: companyId },
  });
  revalidate();
  return { ok: true };
}

// One-click "clear" for the Needs-action queue: resolves a due follow-up. Silent
// (no event), mirroring clearNextAction for applications.
export async function clearFollowUp(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('contacts').update({ next_follow_up_at: null }).eq('id', id);
  revalidate();
}

export async function deleteContact(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('contacts')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('contacts').delete().eq('id', id);
  const name = (row as { name: string } | null)?.name;
  await logActivity(supabase, user.id, {
    type: 'contact.deleted',
    entityType: 'contact',
    entityId: id,
    meta: { name },
  });
  revalidate();
}
