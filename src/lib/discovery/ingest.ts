import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SourceRow, SourceType } from '@/types/database';
import type { FetchContext, NormalizedJob } from '@/lib/sources/types';
import { getFetcher } from '@/lib/sources';
import { dedupeJobs, fuzzyKeyOf } from './dedupe';

export interface SourceResult {
  sourceId: string;
  type: SourceType;
  count: number;
  error?: string;
}

export interface IngestionRun {
  jobs: NormalizedJob[];
  results: SourceResult[];
}

// Fetch every source, isolating failures so one bad source can't sink the run.
// Returns deduped normalized jobs plus a per-source report. Pure w.r.t. the DB.
export async function runFetchers(
  sources: Pick<SourceRow, 'id' | 'type' | 'config'>[],
  ctx: FetchContext,
): Promise<IngestionRun> {
  const results: SourceResult[] = [];
  const all: NormalizedJob[] = [];

  for (const source of sources) {
    const fetcher = getFetcher(source.type);
    if (!fetcher) {
      results.push({ sourceId: source.id, type: source.type, count: 0, error: 'Unknown source type' });
      continue;
    }
    try {
      const jobs = await fetcher(source.config ?? {}, ctx);
      all.push(...jobs);
      results.push({ sourceId: source.id, type: source.type, count: jobs.length });
    } catch (err) {
      results.push({
        sourceId: source.id,
        type: source.type,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { jobs: dedupeJobs(all), results };
}

// Map normalized jobs to upsert rows. `state` and `ingested_at` are deliberately
// omitted so re-ingestion preserves a job's user state (new/saved/dismissed/
// promoted) and original ingest time, while refreshing content + fuzzy_key.
export function toJobRows(userId: string, jobs: NormalizedJob[]) {
  return jobs.map((j) => ({
    user_id: userId,
    source: j.source,
    external_id: j.external_id,
    title: j.title,
    company: j.company,
    location: j.location,
    mode: j.mode,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    currency: j.currency,
    url: j.url,
    description: j.description,
    posted_at: j.posted_at,
    raw: j.raw,
    fuzzy_key: fuzzyKeyOf(j),
  }));
}

// Idempotent upsert keyed by the (user_id, source, external_id) unique index.
export async function persistJobs(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobs: NormalizedJob[],
): Promise<number> {
  if (jobs.length === 0) return 0;
  const rows = toJobRows(userId, jobs);
  const { error, count } = await supabase
    .from('jobs')
    .upsert(rows, { onConflict: 'user_id,source,external_id', count: 'exact' });
  if (error) throw new Error(error.message);
  return count ?? rows.length;
}
