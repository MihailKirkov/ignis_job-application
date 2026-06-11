'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import {
  APPLICATION_STATUSES,
  CHANNELS,
  WORK_MODES,
} from '@/lib/constants';
import type { ApplicationStatus, Channel, WorkMode } from '@/types/database';

export type ActionState = { ok: boolean; error?: string } | null;

// Empty string -> null; trims everything else.
function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function enumOrNull<T extends string>(value: string | null, allowed: T[]): T | null {
  return value && (allowed as string[]).includes(value) ? (value as T) : null;
}

function buildPayload(fd: FormData) {
  const status =
    enumOrNull(str(fd, 'status'), APPLICATION_STATUSES) ?? ('To apply' as ApplicationStatus);
  return {
    company: str(fd, 'company'),
    role: str(fd, 'role'),
    location: str(fd, 'location'),
    mode: enumOrNull<WorkMode>(str(fd, 'mode'), WORK_MODES),
    channel: enumOrNull<Channel>(str(fd, 'channel'), CHANNELS),
    status,
    salary: str(fd, 'salary'),
    link: str(fd, 'link'),
    contact: str(fd, 'contact'),
    date_applied: str(fd, 'date_applied'),
    next_action: str(fd, 'next_action'),
    next_action_date: str(fd, 'next_action_date'),
    notes: str(fd, 'notes'),
    job_id: str(fd, 'job_id'),
  };
}

function revalidate() {
  revalidatePath('/tracker');
  revalidatePath('/needs-action');
  revalidatePath('/discovery');
}

export async function createApplication(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const payload = buildPayload(fd);
  if (!payload.company || !payload.role) {
    return { ok: false, error: 'Company and role are required.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('applications')
    .insert({ ...payload, user_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateApplication(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  await requireUser();
  const id = str(fd, 'id');
  if (!id) return { ok: false, error: 'Missing application id.' };
  const payload = buildPayload(fd);
  if (!payload.company || !payload.role) {
    return { ok: false, error: 'Company and role are required.' };
  }
  const supabase = await createClient();
  // RLS guarantees the row belongs to the signed-in user.
  const { error } = await supabase.from('applications').update(payload).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteApplication(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('applications').delete().eq('id', id);
  revalidate();
}

// One-click "clear" for the Needs-action queue: resolves the pending action.
export async function clearNextAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from('applications')
    .update({ next_action: null, next_action_date: null })
    .eq('id', id);
  revalidate();
}

// Quick status change (used by the pipeline controls).
export async function setStatus(id: string, status: ApplicationStatus): Promise<void> {
  await requireUser();
  if (!APPLICATION_STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from('applications').update({ status }).eq('id', id);
  revalidate();
}
