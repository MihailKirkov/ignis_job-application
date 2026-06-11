import type { FetchContext, NormalizedJob } from './types';
import { guessMode, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Official Adzuna jobs search API.
// Docs: https://developer.adzuna.com/docs/search
// GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
//   ?app_id=&app_key=&what=&where=&salary_min=&max_days_old=&full_time=1&sort_by=date
// Free tier is rate-limited — keep pages small and handle non-200 gracefully.

const BASE = 'https://api.adzuna.com/v1/api/jobs';

interface AdzunaResult {
  id?: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
}

interface AdzunaConfig {
  query?: string;
  where?: string;
  country?: string; // 'nl' (default) or 'gb' for the remote/UK query
  salary_min?: number;
  max_days_old?: number;
  full_time?: boolean;
  sort_by?: string; // 'date' | 'relevance' | 'salary'
  results_per_page?: number;
  pages?: number; // how many pages to walk (default 1)
}

function currencyFor(country: string): string {
  return country === 'gb' ? 'GBP' : 'EUR';
}

export async function fetchAdzuna(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const c = config as AdzunaConfig;
  const appId = ctx.adzunaAppId;
  const appKey = ctx.adzunaAppKey;
  if (!appId || !appKey) {
    throw new Error('Adzuna requires ADZUNA_APP_ID and ADZUNA_APP_KEY env vars.');
  }

  const doFetch = ctx.fetchImpl ?? fetch;
  const country = (c.country ?? 'nl').toLowerCase();
  const perPage = Math.min(Math.max(c.results_per_page ?? 50, 1), 50);
  const pages = Math.min(Math.max(c.pages ?? 1, 1), 5);
  const currency = currencyFor(country);

  const out: NormalizedJob[] = [];

  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(perPage),
      'content-type': 'application/json',
    });
    if (c.query) params.set('what', c.query);
    if (c.where) params.set('where', c.where);
    if (typeof c.salary_min === 'number') params.set('salary_min', String(c.salary_min));
    if (typeof c.max_days_old === 'number') params.set('max_days_old', String(c.max_days_old));
    if (c.full_time) params.set('full_time', '1');
    params.set('sort_by', c.sort_by ?? 'date');

    const url = `${BASE}/${country}/search/${page}?${params.toString()}`;
    const res = await doFetch(url, { headers: { Accept: 'application/json' } });

    if (res.status === 429) {
      // Rate limited — stop walking further pages, return what we have.
      break;
    }
    if (!res.ok) {
      if (page === 1) throw new Error(`Adzuna error ${res.status}`);
      break;
    }

    const json = (await res.json()) as { results?: AdzunaResult[] };
    const results = json.results ?? [];
    if (results.length === 0) break;

    for (const r of results) {
      if (r.id == null) continue;
      const title = stripHtml(r.title) ?? r.title ?? '';
      if (!title) continue;
      const location = r.location?.display_name ?? null;
      const description = stripHtml(r.description);
      out.push({
        source: 'adzuna',
        external_id: String(r.id),
        title,
        company: r.company?.display_name ?? null,
        location,
        mode: guessMode(location, title, description),
        salary_min: typeof r.salary_min === 'number' ? r.salary_min : null,
        salary_max: typeof r.salary_max === 'number' ? r.salary_max : null,
        currency,
        url: r.redirect_url ?? null,
        description,
        posted_at: toIsoDate(r.created),
        raw: r as Record<string, unknown>,
      });
    }

    if (results.length < perPage) break;
  }

  return out;
}
