import type { FetchContext, NormalizedJob } from './types';
import { guessMode, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Lever public postings API.
// GET https://api.lever.co/v0/postings/{company}?mode=json  -> array of postings.

interface LeverPosting {
  id?: string;
  text?: string; // title
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  createdAt?: number; // ms
  workplaceType?: string; // remote | on-site | hybrid
  categories?: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
  };
}

function modeFromWorkplace(wt?: string): 'Remote' | 'Hybrid' | 'On-site' | null {
  switch ((wt ?? '').toLowerCase()) {
    case 'remote':
      return 'Remote';
    case 'hybrid':
      return 'Hybrid';
    case 'on-site':
    case 'onsite':
      return 'On-site';
    default:
      return null;
  }
}

export async function fetchLever(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const token = (config as { token?: string }).token?.trim();
  if (!token) throw new Error('Lever source needs a company slug in config.token.');
  const companyName = (config as { name?: string }).name ?? token;
  const doFetch = ctx.fetchImpl ?? fetch;

  const res = await doFetch(
    `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Lever error ${res.status} for company "${token}"`);

  const rows = (await res.json()) as LeverPosting[];
  if (!Array.isArray(rows)) return [];

  const out: NormalizedJob[] = [];
  for (const j of rows) {
    if (!j.id || !j.text) continue;
    const location = j.categories?.location ?? null;
    const description = j.descriptionPlain ?? stripHtml(j.description);
    out.push({
      source: 'lever',
      external_id: j.id,
      title: j.text,
      company: companyName,
      location,
      mode: modeFromWorkplace(j.workplaceType) ?? guessMode(location, j.text, description),
      salary_min: null,
      salary_max: null,
      currency: null,
      url: j.hostedUrl ?? j.applyUrl ?? null,
      description,
      posted_at: toIsoDate(j.createdAt ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
