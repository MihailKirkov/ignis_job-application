import type { FetchContext, NormalizedJob } from './types';
import { stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// RemoteOK public API.
// GET https://remoteok.com/api  -> array; the FIRST element is a legal/attribution
// notice (not a job) and must be skipped.
// TERMS: must link back to RemoteOK as the source (we keep the job url + label).

const URL = 'https://remoteok.com/api';

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
  legal?: string; // present only on the first (notice) element
}

export async function fetchRemoteOk(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const res = await doFetch(URL, {
    headers: {
      Accept: 'application/json',
      // RemoteOK rejects requests without a descriptive User-Agent.
      'User-Agent': 'job-command-center/1.0 (+personal job tracker)',
    },
  });
  if (!res.ok) throw new Error(`RemoteOK error ${res.status}`);

  const rows = (await res.json()) as RemoteOkJob[];
  if (!Array.isArray(rows)) return [];

  const wantTags = ((config as { tags?: string }).tags ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const out: NormalizedJob[] = [];
  for (const j of rows) {
    if (j.legal || j.id == null || !j.position) continue; // skip notice + malformed
    if (wantTags.length > 0) {
      const tags = (j.tags ?? []).map((t) => t.toLowerCase());
      if (!wantTags.some((t) => tags.includes(t))) continue;
    }
    out.push({
      source: 'remoteok',
      external_id: String(j.id),
      title: j.position,
      company: j.company ?? null,
      location: j.location || 'Remote',
      mode: 'Remote',
      salary_min: typeof j.salary_min === 'number' && j.salary_min > 0 ? j.salary_min : null,
      salary_max: typeof j.salary_max === 'number' && j.salary_max > 0 ? j.salary_max : null,
      currency: j.salary_min || j.salary_max ? 'USD' : null,
      url: j.url ?? j.apply_url ?? null,
      description: stripHtml(j.description),
      posted_at: toIsoDate(j.epoch ?? j.date ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
