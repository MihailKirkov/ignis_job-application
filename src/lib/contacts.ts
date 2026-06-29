// Pure companies + contacts helpers — no React, no Supabase, fully unit-tested.
// The Server Actions (src/lib/actions/{companies,contacts}.ts) lean on these so
// the parsing/validation/normalization stays deterministic. Mirrors the shape of
// src/lib/profile.ts.

import type { Channel } from '@/types/database';
import { CHANNELS } from './constants';

// Sensible caps so a single field can't bloat a row.
export const NOTES_MAX_LENGTH = 4_000;
export const SHORT_TEXT_MAX_LENGTH = 200;
export const EMAIL_MAX_LENGTH = 320;
export const URL_MAX_LENGTH = 500;

// ---------------------------------------------------------------- text helpers

// Trim, drop empty -> null, and clamp to a max length.
export function cleanText(
  value: string | null | undefined,
  max = SHORT_TEXT_MAX_LENGTH,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

// ---------------------------------------------------------------- email / url

// Normalize an email: trim + lowercase, drop blank -> null. Shape is *validated*
// (not silently dropped) by validateContact so a typo surfaces a friendly error.
export function normalizeEmail(value: string | null | undefined): string | null {
  const cleaned = cleanText(value, EMAIL_MAX_LENGTH);
  return cleaned ? cleaned.toLowerCase() : null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// Normalize a URL (LinkedIn / website). Adds an https:// scheme when missing, and
// requires a dotted host. Returns null for blank or unusable input.
export function normalizeUrl(value: string | null | undefined): string | null {
  const cleaned = cleanText(value, URL_MAX_LENGTH);
  if (!cleaned) return null;
  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  // require scheme + a host with at least one dot
  return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(withScheme) ? withScheme : null;
}

// ---------------------------------------------------------------- enums

export function normalizeChannel(value: string | null | undefined): Channel | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return (CHANNELS as string[]).includes(v) ? (v as Channel) : null;
}

// ---------------------------------------------------------------- company

export type RawCompanyInput = {
  name?: string | null;
  website?: string | null;
  location?: string | null;
  ats_type?: string | null;
  notes?: string | null;
};

export type CompanyPayload = {
  name: string | null;
  website: string | null;
  location: string | null;
  ats_type: string | null;
  notes: string | null;
};

export function buildCompanyPayload(raw: RawCompanyInput): CompanyPayload {
  return {
    name: cleanText(raw.name),
    website: normalizeUrl(raw.website),
    location: cleanText(raw.location),
    ats_type: cleanText(raw.ats_type),
    notes: cleanText(raw.notes, NOTES_MAX_LENGTH),
  };
}

// Light validation — the DB constraints (and the unique index on lower(name)) are
// the real guard; this gives a friendly message first. Returns an error, or null.
export function validateCompany(payload: CompanyPayload): string | null {
  if (!payload.name) return 'Company name is required.';
  return null;
}

// ---------------------------------------------------------------- contact

// Raw strings straight off the form. `company` is the free-text company NAME the
// action auto-creates-or-links; the linked id is resolved server-side.
export type RawContactInput = {
  name?: string | null;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  channel?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
};

// The normalized contact fields (excludes company_id, resolved in the action).
export type ContactPayload = {
  name: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  channel: Channel | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
};

export function buildContactPayload(raw: RawContactInput): ContactPayload {
  return {
    name: cleanText(raw.name),
    role: cleanText(raw.role),
    email: normalizeEmail(raw.email),
    linkedin_url: normalizeUrl(raw.linkedin_url),
    channel: normalizeChannel(raw.channel),
    notes: cleanText(raw.notes, NOTES_MAX_LENGTH),
    last_contacted_at: cleanText(raw.last_contacted_at),
    next_follow_up_at: cleanText(raw.next_follow_up_at),
  };
}

export function validateContact(payload: ContactPayload): string | null {
  if (!payload.name) return 'Contact name is required.';
  if (payload.email && !isValidEmail(payload.email)) return 'That email looks invalid.';
  return null;
}

// The company NAME a contact form carried, cleaned for auto-create-or-link.
export function contactCompanyName(raw: RawContactInput): string | null {
  return cleanText(raw.company);
}
