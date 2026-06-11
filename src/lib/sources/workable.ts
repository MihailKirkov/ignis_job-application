import type { FetchContext, NormalizedJob } from './types';
import { guessMode, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Workable public widget API.
// GET https://apply.workable.com/api/v1/widget/accounts/{token}
// NOTE: Workable's public surface is fragmented and field names vary by account.
// This fetcher is defensive and best-effort — see README. No salary in this feed.

interface WorkableJob {
  id?: string | number;
  shortcode?: string;
  code?: string;
  title?: string;
  full_title?: string;
  state?: string;
  url?: string;
  application_url?: string;
  telecommuting?: boolean;
  employment_type?: string;
  created_at?: string;
  published_on?: string;
  description?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    telecommuting?: boolean;
  };
}

function formatLocation(loc?: WorkableJob['location']): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export async function fetchWorkable(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const token = (config as { token?: string }).token?.trim();
  if (!token) throw new Error('Workable source needs an account subdomain in config.token.');
  const companyName = (config as { name?: string }).name ?? token;
  const doFetch = ctx.fetchImpl ?? fetch;

  const res = await doFetch(
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Workable error ${res.status} for account "${token}"`);

  const json = (await res.json()) as { jobs?: WorkableJob[] };
  const out: NormalizedJob[] = [];
  for (const j of json.jobs ?? []) {
    const externalId = j.shortcode ?? (j.id != null ? String(j.id) : j.code);
    const title = j.title ?? j.full_title;
    if (!externalId || !title) continue;
    if (j.state && j.state !== 'published') continue;
    const location = formatLocation(j.location);
    const remote = j.telecommuting ?? j.location?.telecommuting ?? false;
    const description = stripHtml(j.description);
    out.push({
      source: 'workable',
      external_id: externalId,
      title,
      company: companyName,
      location,
      mode: remote ? 'Remote' : guessMode(location, title, description),
      salary_min: null,
      salary_max: null,
      currency: null,
      url: j.url ?? j.application_url ?? null,
      description,
      posted_at: toIsoDate(j.published_on ?? j.created_at ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
