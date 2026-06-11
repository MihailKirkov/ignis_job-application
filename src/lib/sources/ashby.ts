import type { FetchContext, NormalizedJob } from './types';
import { guessMode, parseSalary, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Ashby public job-board posting API.
// GET https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true
// Docs: https://developers.ashbyhq.com/docs/public-job-posting-api

interface AshbyJob {
  id?: string;
  title?: string;
  location?: string;
  isRemote?: boolean;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  compensationTierSummary?: string;
}

export async function fetchAshby(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const token = (config as { token?: string }).token?.trim();
  if (!token) throw new Error('Ashby source needs a job-board name in config.token.');
  const companyName = (config as { name?: string }).name ?? token;
  const doFetch = ctx.fetchImpl ?? fetch;

  const res = await doFetch(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Ashby error ${res.status} for board "${token}"`);

  const json = (await res.json()) as { jobs?: AshbyJob[] };
  const out: NormalizedJob[] = [];
  for (const j of json.jobs ?? []) {
    if (!j.id || !j.title) continue;
    const description = j.descriptionPlain ?? stripHtml(j.descriptionHtml);
    const sal = parseSalary(j.compensationTierSummary);
    out.push({
      source: 'ashby',
      external_id: j.id,
      title: j.title,
      company: companyName,
      location: j.location ?? null,
      mode: j.isRemote ? 'Remote' : guessMode(j.location, j.title, description),
      salary_min: sal.min,
      salary_max: sal.max,
      currency: sal.currency,
      url: j.jobUrl ?? j.applyUrl ?? null,
      description,
      posted_at: toIsoDate(j.publishedAt ?? j.updatedAt ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
