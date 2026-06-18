'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { logActivity } from '@/lib/activity/log';
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
  revalidatePath('/activity');
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
  const { data: created, error } = await supabase
    .from('applications')
    .insert({ ...payload, user_id: user.id })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  await logActivity(supabase, user.id, {
    type: 'application.created',
    entityType: 'application',
    entityId: (created as { id: string } | null)?.id ?? null,
    meta: { company: payload.company, role: payload.role },
  });
  revalidate();
  return { ok: true };
}

export async function updateApplication(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = str(fd, 'id');
  if (!id) return { ok: false, error: 'Missing application id.' };
  const payload = buildPayload(fd);
  if (!payload.company || !payload.role) {
    return { ok: false, error: 'Company and role are required.' };
  }
  const supabase = await createClient();
  // Capture the prior status so an edit that moves the stage logs a single
  // status_changed event (general edits aren't part of the feed vocabulary).
  const { data: prior } = await supabase
    .from('applications')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  // RLS guarantees the row belongs to the signed-in user.
  const { error } = await supabase.from('applications').update(payload).eq('id', id);
  if (error) return { ok: false, error: error.message };

  const from = (prior as { status: ApplicationStatus } | null)?.status;
  if (from && from !== payload.status) {
    await logActivity(supabase, user.id, {
      type: 'application.status_changed',
      entityType: 'application',
      entityId: id,
      meta: { from, to: payload.status, company: payload.company, role: payload.role },
    });
  }
  revalidate();
  return { ok: true };
}

export async function deleteApplication(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('applications')
    .select('company, role')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('applications').delete().eq('id', id);
  const r = row as { company: string; role: string } | null;
  await logActivity(supabase, user.id, {
    type: 'application.deleted',
    entityType: 'application',
    entityId: id,
    meta: { company: r?.company, role: r?.role },
  });
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
  const user = await requireUser();
  if (!APPLICATION_STATUSES.includes(status)) return;
  const supabase = await createClient();
  const { data: prior } = await supabase
    .from('applications')
    .select('status, company, role')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('applications').update({ status }).eq('id', id);
  const p = prior as { status: ApplicationStatus; company: string; role: string } | null;
  if (p && p.status !== status) {
    await logActivity(supabase, user.id, {
      type: 'application.status_changed',
      entityType: 'application',
      entityId: id,
      meta: { from: p.status, to: status, company: p.company, role: p.role },
    });
  }
  revalidate();
}
