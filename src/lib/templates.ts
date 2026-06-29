// Pure message-template helpers — no React, no Supabase, fully unit-tested. The
// Server Actions (src/lib/actions/templates.ts) lean on these so variable
// substitution, parsing, and validation stay deterministic. Mirrors the shape of
// src/lib/contacts.ts.

import type { TemplateKind } from '@/types/database';
import { TEMPLATE_KINDS } from './constants';
import { cleanText, SHORT_TEXT_MAX_LENGTH } from './contacts';

// The known {variable} slots a template body/subject may reference. Anything else
// is left as the literal token (so a user sees what's unfilled), not an error.
//   company — the company name
//   role    — the role / title (for a contact: their role)
//   contact — the contact's name
//   stack   — the candidate's tech stack (profile skills, comma-joined)
//   name    — the sender's own name
export const TEMPLATE_VARS = ['company', 'role', 'contact', 'stack', 'name'] as const;
export type TemplateVar = (typeof TEMPLATE_VARS)[number];
export type TemplateVars = Partial<Record<TemplateVar, string | null | undefined>>;

const BODY_MAX_LENGTH = 8_000;

// Matches {company}, {ROLE}, { stack } — letters/underscore, case-insensitive,
// tolerant of inner whitespace. Capture group 1 is the bare key.
const TOKEN_RE = /\{\s*([a-z_]+)\s*\}/gi;

// Substitute known {variable} tokens. A token whose key has a non-empty value is
// replaced; an unknown key OR a key with no value is left intact (literal token),
// so the user can see and fill the gaps. Pure + idempotent over already-filled text.
export function fillTemplate(text: string | null | undefined, vars: TemplateVars): string {
  if (!text) return '';
  return text.replace(TOKEN_RE, (whole, rawKey: string) => {
    const key = rawKey.toLowerCase() as TemplateVar;
    const value = (vars as Record<string, string | null | undefined>)[key];
    return value != null && value !== '' ? value : whole;
  });
}

// The distinct, lower-cased variable keys referenced in a template (in first-seen
// order). Used to show "uses: {company}, {role}" hints. Unknown keys included.
export function extractVars(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE)) {
    const key = m[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

// ---------------------------------------------------------------- enums

export function normalizeTemplateKind(value: string | null | undefined): TemplateKind {
  if (typeof value !== 'string') return 'other';
  const v = value.trim();
  return (TEMPLATE_KINDS as string[]).includes(v) ? (v as TemplateKind) : 'other';
}

// ---------------------------------------------------------------- template

export type RawTemplateInput = {
  name?: string | null;
  kind?: string | null;
  subject?: string | null;
  body?: string | null;
};

export type TemplatePayload = {
  name: string | null;
  kind: TemplateKind;
  subject: string | null;
  body: string;
};

export function buildTemplatePayload(raw: RawTemplateInput): TemplatePayload {
  return {
    name: cleanText(raw.name, SHORT_TEXT_MAX_LENGTH),
    kind: normalizeTemplateKind(raw.kind),
    subject: cleanText(raw.subject, SHORT_TEXT_MAX_LENGTH),
    // body is NOT NULL in the DB; default to empty string, clamp generously.
    body: cleanText(raw.body, BODY_MAX_LENGTH) ?? '',
  };
}

// Light validation — DB constraints are the real guard; this gives a friendly
// message first. Returns an error, or null. (Length is bounded by the clamp in
// buildTemplatePayload.)
export function validateTemplate(payload: TemplatePayload): string | null {
  if (!payload.name) return 'Template name is required.';
  if (!payload.body) return 'Template body is required.';
  return null;
}
