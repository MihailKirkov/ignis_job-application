'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { resolveAnthropicKey } from '@/lib/ai/resolve-key';
import { anthropicCall } from '@/lib/ai/client';
import { runDraft } from '@/lib/ai/score';
import { NO_KEY_MESSAGE, scoringErrorMessage } from '@/lib/ai/scoring-run';
import { TEMPLATE_KIND_LABEL } from '@/lib/constants';
import {
  buildTemplatePayload,
  fillTemplate,
  validateTemplate,
  type TemplateVars,
} from '@/lib/templates';
import type {
  ContactRow,
  MessageTemplateRow,
  ProfileRow,
} from '@/types/database';

// Templates are settings, not activity — these mutations emit NO activity_events
// (the one exception to the one-event-per-mutation rule; see 0009 + docs/logging).

export type TemplateActionState = { ok: boolean; error?: string } | null;

function revalidate() {
  revalidatePath('/profile');
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === 'string' ? v : null;
}

function payloadFromForm(fd: FormData) {
  return buildTemplatePayload({
    name: str(fd, 'name'),
    kind: str(fd, 'kind'),
    subject: str(fd, 'subject'),
    body: str(fd, 'body'),
  });
}

// Create or update a template (id present → update). RLS scopes the row.
export async function saveTemplate(
  _prev: TemplateActionState,
  fd: FormData,
): Promise<TemplateActionState> {
  const user = await requireUser();
  const id = str(fd, 'id');
  const payload = payloadFromForm(fd);
  const error = validateTemplate(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  if (id) {
    const { error: dbError } = await supabase.from('message_templates').update(payload).eq('id', id);
    if (dbError) return { ok: false, error: dbError.message };
  } else {
    const { error: dbError } = await supabase
      .from('message_templates')
      .insert({ ...payload, user_id: user.id });
    if (dbError) return { ok: false, error: dbError.message };
  }
  revalidate();
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('message_templates').delete().eq('id', id);
  revalidate();
}

// ----------------------------------------------------------------- draft

export type DraftMessageInput = {
  templateId: string;
  contactId?: string | null;
  companyId?: string | null;
  ai?: boolean;
};

export type DraftMessageResult =
  | { ok: true; subject: string | null; body: string; ai: boolean }
  | { ok: false; error: string };

// Compose a draft from a saved template + the contact/company context. Two modes:
//   ai:false → pure {variable} substitution (no key needed, never fails on AI).
//   ai:true  → the substituted template is then personalized by the model.
// Returns the draft text; it does NOT send or log anything — the user reviews it
// in the outreach composer and clicks Log outreach.
export async function draftMessage(input: DraftMessageInput): Promise<DraftMessageResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: tplRow } = await supabase
    .from('message_templates')
    .select('*')
    .eq('id', input.templateId)
    .maybeSingle();
  if (!tplRow) return { ok: false, error: 'Template not found.' };
  const template = tplRow as MessageTemplateRow;

  // Grounding context: the contact (name/role/company), the company name, and the
  // sender's profile. All RLS-scoped reads.
  type ContactCtx = Pick<ContactRow, 'name' | 'role' | 'company_id'>;
  let contact: ContactCtx | null = null;
  if (input.contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('name, role, company_id')
      .eq('id', input.contactId)
      .maybeSingle();
    contact = (data as ContactCtx | null) ?? null;
  }

  const companyId = input.companyId ?? contact?.company_id ?? null;
  let companyName: string | null = null;
  if (companyId) {
    const { data } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle();
    companyName = (data as { name: string } | null)?.name ?? null;
  }

  type ProfileCtx = Pick<ProfileRow, 'full_name' | 'headline' | 'summary' | 'skills'>;
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('full_name, headline, summary, skills')
    .maybeSingle();
  const profile = (profileRow as ProfileCtx | null) ?? null;
  const skills = profile?.skills ?? [];

  const vars: TemplateVars = {
    company: companyName,
    role: contact?.role,
    contact: contact?.name,
    stack: skills.length ? skills.join(', ') : null,
    name: profile?.full_name,
  };
  const filledSubject = template.subject ? fillTemplate(template.subject, vars) : null;
  const filledBody = fillTemplate(template.body, vars);

  // Plain substitution — always available, no key required.
  if (!input.ai) {
    return { ok: true, subject: filledSubject, body: filledBody, ai: false };
  }

  // AI personalization — degrade with NO_KEY_MESSAGE if no key is available.
  const key = await resolveAnthropicKey(supabase, user.id);
  if (!key) return { ok: false, error: NO_KEY_MESSAGE };

  try {
    const draft = await runDraft(anthropicCall(key), {
      kind: TEMPLATE_KIND_LABEL[template.kind],
      template: filledBody,
      subject: filledSubject,
      company: companyName,
      role: contact?.role ?? null,
      stack: skills,
      contactName: contact?.name ?? null,
      contactRole: contact?.role ?? null,
      sender: profile
        ? { name: profile.full_name, headline: profile.headline, summary: profile.summary }
        : null,
    });
    return { ok: true, subject: draft.subject ?? filledSubject, body: draft.body, ai: true };
  } catch (err) {
    return { ok: false, error: scoringErrorMessage(err) };
  }
}
