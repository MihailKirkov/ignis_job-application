import type { FetchContext, NormalizedJob } from './types';
import { guessMode, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Greenhouse public Job Board API.
// GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
// `content` comes back HTML-entity-encoded, so decode entities before stripping.

interface GreenhouseJob {
  id?: number;
  title?: string;
  updated_at?: string;
  absolute_url?: string;
  content?: string;
  location?: { name?: string };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function fetchGreenhouse(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const token = (config as { token?: string }).token?.trim();
  if (!token) throw new Error('Greenhouse source needs a board token in config.token.');
  const companyName = (config as { name?: string }).name ?? token;
  const doFetch = ctx.fetchImpl ?? fetch;

  const res = await doFetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Greenhouse error ${res.status} for board "${token}"`);

  const json = (await res.json()) as { jobs?: GreenhouseJob[] };
  const out: NormalizedJob[] = [];
  for (const j of json.jobs ?? []) {
    if (j.id == null || !j.title) continue;
    const location = j.location?.name ?? null;
    const description = j.content ? stripHtml(decodeEntities(j.content)) : null;
    out.push({
      source: 'greenhouse',
      external_id: String(j.id),
      title: j.title,
      company: companyName,
      location,
      mode: guessMode(location, j.title, description),
      salary_min: null,
      salary_max: null,
      currency: null,
      url: j.absolute_url ?? null,
      description,
      posted_at: toIsoDate(j.updated_at ?? null),
      raw: j as Record<string, unknown>,
    });
  }
  return out;
}
