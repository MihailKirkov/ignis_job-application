// Pure profile + CV helpers — no React, no Supabase, fully unit-tested.
// The Server Actions (src/lib/actions/profile.ts) and the CV extractor lean on
// these so the parsing/validation/clamping logic stays deterministic.

import type { ProfileLink, Seniority, WorkMode } from '@/types/database';
import { SENIORITY_LEVELS, WORK_MODES } from './constants';

// Sensible caps so a pasted/extracted CV (or a runaway field) can't bloat a row.
export const CV_TEXT_MAX_LENGTH = 20_000;
export const SUMMARY_MAX_LENGTH = 4_000;
export const SHORT_TEXT_MAX_LENGTH = 200;
export const LIST_ITEM_MAX = 50;

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

// Normalize CV text to clean plain text: unify newlines, strip control chars,
// collapse runs of blank lines and trailing spaces, then clamp the length.
export function sanitizeCvText(
  raw: string | null | undefined,
  max = CV_TEXT_MAX_LENGTH,
): string {
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  const normalized = raw
    .replace(/\r\n?/g, '\n')
    // strip control chars except newline (\x0A) and tab (\x09)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\t/g, ' ')
    // collapse runs of spaces
    .replace(/ {2,}/g, ' ')
    // trim trailing spaces on each line
    .replace(/ +\n/g, '\n')
    // collapse 3+ newlines into a paragraph break
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length > max ? normalized.slice(0, max).trimEnd() : normalized;
}

// ---------------------------------------------------------------- list helpers

// Parse a comma/newline-separated string into a clean, de-duplicated list.
// Dedupe is case-insensitive but keeps the first-seen casing.
export function parseList(input: string | null | undefined): string[] {
  if (typeof input !== 'string') return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of input.split(/[\n,]/)) {
    const item = part.trim().slice(0, LIST_ITEM_MAX).trim();
    if (item === '') continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// Inverse of parseList for pre-filling a textarea (one item per line).
export function serializeList(items: string[] | null | undefined): string {
  return Array.isArray(items) ? items.join('\n') : '';
}

// ---------------------------------------------------------------- enums

export function normalizeSeniority(value: string | null | undefined): Seniority | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (SENIORITY_LEVELS as string[]).includes(v) ? (v as Seniority) : null;
}

// Keep only the canonical work modes, in canonical order, de-duplicated.
export function normalizeWorkModes(values: string[] | null | undefined): WorkMode[] {
  if (!Array.isArray(values)) return [];
  const set = new Set(values.map((v) => (typeof v === 'string' ? v.trim() : '')));
  return WORK_MODES.filter((m) => set.has(m));
}

// ---------------------------------------------------------------- salary

// Parse a salary floor. Accepts "60000", "60.000", "€ 60,000", "60k". Returns a
// non-negative integer, or null when blank/invalid.
export function parseSalaryMin(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (raw === '') return null;
  const hasK = /\d\s*k\b/.test(raw);
  // drop thousands separators (a dot/comma followed by exactly 3 digits), then
  // keep digits and a single decimal point.
  const digits = raw.replace(/[.,](?=\d{3}\b)/g, '').replace(/[^0-9.]/g, '');
  if (digits === '') return null;
  let n = Number.parseFloat(digits);
  if (!Number.isFinite(n)) return null;
  if (hasK) n *= 1000;
  return n >= 0 ? Math.round(n) : null;
}

// ---------------------------------------------------------------- links

// Parse links from one-per-line "Label | https://url" (or "Label: url", or a
// bare url). Only entries with an http(s) url are kept.
export function parseLinks(input: string | null | undefined): ProfileLink[] {
  if (typeof input !== 'string') return [];
  const out: ProfileLink[] = [];
  const seen = new Set<string>();
  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let label = '';
    let url = '';
    const sep =
      trimmed.match(/^(.*?)\|\s*(\S.*)$/) ??
      trimmed.match(/^(.*?):\s*(https?:\/\/\S.*)$/i);
    if (sep) {
      label = sep[1].trim();
      url = sep[2].trim();
    } else {
      url = trimmed;
    }
    if (!/^https?:\/\/\S+$/i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (label === '') label = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    out.push({
      label: label.slice(0, SHORT_TEXT_MAX_LENGTH),
      url: url.slice(0, SHORT_TEXT_MAX_LENGTH * 2),
    });
  }
  return out;
}

// Inverse of parseLinks for pre-filling the textarea.
export function serializeLinks(links: ProfileLink[] | null | undefined): string {
  return Array.isArray(links) ? links.map((l) => `${l.label} | ${l.url}`).join('\n') : '';
}

// ---------------------------------------------------------------- payload

// Raw strings straight off the form (lists/links are the textarea blobs).
export type RawProfileInput = {
  full_name?: string | null;
  headline?: string | null;
  location?: string | null;
  summary?: string | null;
  seniority?: string | null;
  skills?: string | null;
  target_roles?: string | null;
  target_locations?: string | null;
  target_salary_min?: string | null;
  work_modes?: string[] | null;
  languages?: string | null;
  links?: string | null;
};

// The normalized, DB-ready profile payload (excludes cv_text / cv_file_path,
// which the actions manage separately).
export type ProfilePayload = {
  full_name: string | null;
  headline: string | null;
  location: string | null;
  summary: string | null;
  seniority: Seniority | null;
  skills: string[];
  target_roles: string[];
  target_locations: string[];
  target_salary_min: number | null;
  work_modes: WorkMode[];
  languages: string[];
  links: ProfileLink[];
};

export function buildProfilePayload(raw: RawProfileInput): ProfilePayload {
  return {
    full_name: cleanText(raw.full_name),
    headline: cleanText(raw.headline),
    location: cleanText(raw.location),
    summary: cleanText(raw.summary, SUMMARY_MAX_LENGTH),
    seniority: normalizeSeniority(raw.seniority),
    skills: parseList(raw.skills),
    target_roles: parseList(raw.target_roles),
    target_locations: parseList(raw.target_locations),
    target_salary_min: parseSalaryMin(raw.target_salary_min),
    work_modes: normalizeWorkModes(raw.work_modes),
    languages: parseList(raw.languages),
    links: parseLinks(raw.links),
  };
}

// Light validation — the DB constraints are the real guard, this gives a
// friendly message before we hit them. Returns an error string, or null if ok.
export function validateProfile(payload: ProfilePayload): string | null {
  if (payload.target_salary_min != null && payload.target_salary_min > 100_000_000) {
    return 'Target salary looks too large.';
  }
  return null;
}
