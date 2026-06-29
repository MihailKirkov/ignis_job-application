'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { logActivity } from '@/lib/activity/log';
import { CHANNELS, OUTREACH_STATUSES } from '@/lib/constants';
import type { Channel, OutreachStatus } from '@/types/database';

export type OutreachActionState = { ok: boolean; error?: string } | null;

function revalidate() {
  revalidatePath('/contacts');
  revalidatePath('/needs-action');
  revalidatePath('/activity');
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function enumOrNull<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

// Log a single touch. Optionally linked to a contact / company / application.
// Logging a touch stamps the linked contact's last_contacted_at.
export async function logOutreach(
  _prev: OutreachActionState,
  fd: FormData,
): Promise<OutreachActionState> {
  const user = await requireUser();
  const contactId = str(fd, 'contact_id');
  const companyId = str(fd, 'company_id');
  const applicationId = str(fd, 'application_id');
  const companyName = str(fd, 'company'); // free text, for the activity summary only
  const channel = enumOrNull<Channel>(str(fd, 'channel'), CHANNELS);
  const status = enumOrNull<OutreachStatus>(str(fd, 'status'), OUTREACH_STATUSES) ?? 'Sent';

  const sentAt = new Date().toISOString();
  const payload = {
    contact_id: contactId,
    company_id: companyId,
    application_id: applicationId,
    channel,
    status,
    subject: str(fd, 'subject'),
    body: str(fd, 'body'),
    next_bump_at: str(fd, 'next_bump_at'),
    notes: str(fd, 'notes'),
    sent_at: sentAt,
  };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from('outreach')
    .insert({ ...payload, user_id: user.id })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  // Stamp the contact's last_contacted_at so the CRM reflects the touch.
  if (contactId) {
    await supabase.from('contacts').update({ last_contacted_at: sentAt }).eq('id', contactId);
  }

  await logActivity(supabase, user.id, {
    type: 'outreach.logged',
    entityType: 'outreach',
    entityId: (created as { id: string } | null)?.id ?? null,
    meta: { channel, company: companyName, company_id: companyId, contact_id: contactId },
  });
  revalidate();
  return { ok: true };
}

// Change an outreach's status (Sent → Replied, …). companyName is passed from the
// client purely to render a nice "Sioux: Sent → Replied" summary line.
export async function setOutreachStatus(
  id: string,
  status: OutreachStatus,
  companyName?: string | null,
): Promise<void> {
  const user = await requireUser();
  if (!OUTREACH_STATUSES.includes(status)) return;
  const supabase = await createClient();
  const { data: prior } = await supabase
    .from('outreach')
    .select('status, company_id')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('outreach').update({ status }).eq('id', id);
  const p = prior as { status: OutreachStatus; company_id: string | null } | null;
  if (p && p.status !== status) {
    await logActivity(supabase, user.id, {
      type: 'outreach.status_changed',
      entityType: 'outreach',
      entityId: id,
      meta: { from: p.status, to: status, company: companyName, company_id: p.company_id },
    });
  }
  revalidate();
}

// One-click "clear" for the Needs-action queue: drops a due bump. Silent (no
// event), mirroring clearNextAction.
export async function clearBump(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('outreach').update({ next_bump_at: null }).eq('id', id);
  revalidate();
}
