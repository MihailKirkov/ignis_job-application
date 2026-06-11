import type { FetchContext, NormalizedJob } from './types';
import { guessMode, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Arbeitnow free public job-board API (no key).
// GET https://www.arbeitnow.com/api/job-board-api
// Fields per job: slug, company_name, title, description, remote, url, tags[],
// job_types[], location, created_at (unix seconds).

const URL = 'https://www.arbeitnow.com/api/job-board-api';

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  location?: string;
  created_at?: number;
  tags?: string[];
}

export async function fetchArbeitnow(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const res = await doFetch(URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Arbeitnow error ${res.status}`);

  const json = (await res.json()) as { data?: ArbeitnowJob[] };
  const jobs = json.data ?? [];
  const wantRemote = (config as { remote?: boolean }).remote === true;

  const out: NormalizedJob[] = [];
  for (const j of jobs) {
    if (!j.slug || !j.title) continue;
    if (wantRemote && !j.remote) continue;
    const description = stripHtml(j.description);
    out.push({
      source: 'arbeitnow',
      external_id: j.slug,
      title: j.title,
      company: j.company_name ?? null,
      location: j.location ?? null,
      mode: j.remote ? 'Remote' : guessMode(j.location, j.title, description),
      salary_min: null,
      salary_max: null,
      currency: null,
      url: j.url ?? null,
      description,
      posted_at: toIsoDate(j.created_at ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
