import type { WorkMode } from '@/types/database';
import type { NormalizedJob } from '@/lib/sources/types';
import { toIsoDate } from './normalize';
import { WORK_MODES } from '@/lib/constants';

// Validates + normalizes the payload accepted by POST /api/import (used by the
// Cowork on-demand recipe and manual paste-import). Accepts either a bare array
// or { jobs: [...] }. Pure so it can be unit-tested.

// Stable id from content when a source omits external_id (keeps imports idempotent).
function hashId(parts: Array<string | null | undefined>): string {
  const s = parts.filter(Boolean).join('|').toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `import_${h.toString(36)}`;
}

function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asMode(v: unknown): WorkMode | null {
  return typeof v === 'string' && (WORK_MODES as string[]).includes(v) ? (v as WorkMode) : null;
}

export interface ImportParseResult {
  jobs: NormalizedJob[];
  errors: string[];
}

export function parseImportPayload(body: unknown): ImportParseResult {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { jobs?: unknown }).jobs)
      ? (body as { jobs: unknown[] }).jobs
      : null;

  if (!list) {
    return { jobs: [], errors: ['Body must be an array of jobs or { "jobs": [...] }.'] };
  }

  const jobs: NormalizedJob[] = [];
  const errors: string[] = [];

  list.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Item ${i}: not an object.`);
      return;
    }
    const o = raw as Record<string, unknown>;
    const title = asString(o.title);
    if (!title) {
      errors.push(`Item ${i}: missing required "title".`);
      return;
    }
    const source = asString(o.source) ?? 'import';
    const company = asString(o.company);
    const location = asString(o.location);
    const url = asString(o.url);
    const external_id =
      asString(o.external_id) ?? hashId([source, title, company, location, url]);

    jobs.push({
      source,
      external_id,
      title,
      company,
      location,
      mode: asMode(o.mode),
      salary_min: asNumber(o.salary_min),
      salary_max: asNumber(o.salary_max),
      currency: asString(o.currency),
      url,
      description: asString(o.description),
      posted_at: toIsoDate((o.posted_at as string | number | null) ?? null),
      raw: o,
    });
  });

  return { jobs, errors };
}
