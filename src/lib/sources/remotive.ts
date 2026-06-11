import type { FetchContext, NormalizedJob } from './types';
import { parseSalary, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Remotive remote-jobs API.
// GET https://remotive.com/api/remote-jobs?search=&category=&limit=
// TERMS: attribution required (link back + name Remotive as source); data delayed
// 24h; keep request rate <= 2/min. We attribute via the job url + source label.

const URL = 'https://remotive.com/api/remote-jobs';

interface RemotiveJob {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
  publication_date?: string;
}

interface RemotiveConfig {
  search?: string;
  category?: string;
  limit?: number;
}

export async function fetchRemotive(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const c = config as RemotiveConfig;
  const doFetch = ctx.fetchImpl ?? fetch;

  const params = new URLSearchParams();
  if (c.search) params.set('search', c.search);
  if (c.category) params.set('category', c.category);
  if (typeof c.limit === 'number') params.set('limit', String(c.limit));
  const qs = params.toString();

  const res = await doFetch(`${URL}${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Remotive error ${res.status}`);

  const json = (await res.json()) as { jobs?: RemotiveJob[] };
  const jobs = json.jobs ?? [];

  const out: NormalizedJob[] = [];
  for (const j of jobs) {
    if (j.id == null || !j.title) continue;
    const sal = parseSalary(j.salary);
    out.push({
      source: 'remotive',
      external_id: String(j.id),
      title: j.title,
      company: j.company_name ?? null,
      location: j.candidate_required_location || 'Remote',
      mode: 'Remote',
      salary_min: sal.min,
      salary_max: sal.max,
      currency: sal.currency,
      url: j.url ?? null,
      description: stripHtml(j.description),
      posted_at: toIsoDate(j.publication_date ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
