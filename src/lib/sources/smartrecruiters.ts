import type { FetchContext, NormalizedJob } from './types';
import { guessMode, toIsoDate } from '@/lib/discovery/normalize';

// SmartRecruiters public Posting API (no auth). Widely used by larger NL/EU
// employers. GET https://api.smartrecruiters.com/v1/companies/{token}/postings
//   -> { offset, limit, totalFound, content: [...] }
// Docs: https://developers.smartrecruiters.com/customer-api/posting-api/
// `token` is the public company identifier, e.g. "bosch". The list endpoint
// carries no description text; we link out to the public posting page.

interface SrLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  remote?: boolean;
  hybrid?: boolean;
}

interface SrPosting {
  id?: string | number;
  uuid?: string;
  name?: string; // title
  refNumber?: string;
  releasedDate?: string;
  company?: { identifier?: string; name?: string };
  location?: SrLocation;
}

function formatLocation(loc?: SrLocation): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.region]
    .filter((x): x is string => Boolean(x))
    .map((s) => s.trim())
    .filter((s) => s.toUpperCase() !== 'REMOTE');
  const uniq = [...new Set(parts)];
  if (uniq.length) return uniq.join(', ');
  return loc.remote ? 'Remote' : null;
}

export async function fetchSmartRecruiters(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const token = (config as { token?: string }).token?.trim();
  if (!token)
    throw new Error('SmartRecruiters source needs a company identifier in config.token.');
  const companyName = (config as { name?: string }).name;
  const doFetch = ctx.fetchImpl ?? fetch;

  const res = await doFetch(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=100`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok)
    throw new Error(`SmartRecruiters error ${res.status} for company "${token}"`);

  const json = (await res.json()) as { content?: SrPosting[] };
  const out: NormalizedJob[] = [];
  for (const p of json.content ?? []) {
    if (p.id == null || !p.name) continue;
    const location = formatLocation(p.location);
    out.push({
      source: 'smartrecruiters',
      external_id: String(p.id),
      title: p.name,
      company: companyName ?? p.company?.name ?? token,
      location,
      mode: p.location?.remote
        ? 'Remote'
        : p.location?.hybrid
          ? 'Hybrid'
          : guessMode(location, p.name),
      salary_min: null,
      salary_max: null,
      currency: null,
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(token)}/${p.id}`,
      description: null,
      posted_at: toIsoDate(p.releasedDate ?? null),
      raw: p as Record<string, unknown>,
    });
  }
  return out;
}
