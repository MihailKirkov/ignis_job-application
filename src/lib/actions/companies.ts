'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { logActivity } from '@/lib/activity/log';
import { buildCompanyPayload, validateCompany } from '@/lib/contacts';

export type CompanyActionState = { ok: boolean; error?: string } | null;

function revalidate() {
  revalidatePath('/contacts');
  revalidatePath('/tracker');
  revalidatePath('/activity');
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === 'string' ? v : null;
}

function payloadFromForm(fd: FormData) {
  return buildCompanyPayload({
    name: str(fd, 'name'),
    website: str(fd, 'website'),
    location: str(fd, 'location'),
    ats_type: str(fd, 'ats_type'),
    notes: str(fd, 'notes'),
  });
}

export async function createCompany(
  _prev: CompanyActionState,
  fd: FormData,
): Promise<CompanyActionState> {
  const user = await requireUser();
  const payload = payloadFromForm(fd);
  const error = validateCompany(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { data: created, error: dbError } = await supabase
    .from('companies')
    .insert({ ...payload, user_id: user.id })
    .select('id')
    .single();
  if (dbError) {
    // The unique (user_id, lower(name)) index rejects duplicates.
    if (dbError.code === '23505') {
      return { ok: false, error: 'A company with that name already exists.' };
    }
    return { ok: false, error: dbError.message };
  }

  const id = (created as { id: string } | null)?.id ?? null;
  await logActivity(supabase, user.id, {
    type: 'company.created',
    entityType: 'company',
    entityId: id,
    meta: { name: payload.name, company_id: id },
  });
  revalidate();
  return { ok: true };
}

export async function updateCompany(
  _prev: CompanyActionState,
  fd: FormData,
): Promise<CompanyActionState> {
  const user = await requireUser();
  const id = str(fd, 'id');
  if (!id) return { ok: false, error: 'Missing company id.' };
  const payload = payloadFromForm(fd);
  const error = validateCompany(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  // RLS guarantees the row belongs to the signed-in user.
  const { error: dbError } = await supabase.from('companies').update(payload).eq('id', id);
  if (dbError) {
    if (dbError.code === '23505') {
      return { ok: false, error: 'A company with that name already exists.' };
    }
    return { ok: false, error: dbError.message };
  }

  await logActivity(supabase, user.id, {
    type: 'company.updated',
    entityType: 'company',
    entityId: id,
    meta: { name: payload.name, company_id: id },
  });
  revalidate();
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('companies')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  // Contacts / applications FK to companies with ON DELETE SET NULL, so they
  // survive — they just unlink.
  await supabase.from('companies').delete().eq('id', id);
  const name = (row as { name: string } | null)?.name;
  await logActivity(supabase, user.id, {
    type: 'company.deleted',
    entityType: 'company',
    entityId: id,
    meta: { name },
  });
  revalidate();
}
