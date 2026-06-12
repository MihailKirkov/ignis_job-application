import type { WorkMode } from '@/types/database';

// The single shape every source is normalized into before it touches the DB.
// `raw` preserves the untouched source payload (stored as jsonb).
export interface NormalizedJob {
  source: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  mode: WorkMode | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  url: string | null;
  description: string | null;
  posted_at: string | null; // ISO 8601
  raw: Record<string, unknown>;
  // Optional AI fit score (0..100). Set only when adapting a stored JobRow that
  // has been scored; source fetchers leave it undefined. Used by the min-fit filter.
  fit_score?: number | null;
}

// A source knows how to fetch + normalize. `fetchJobs` returns normalized jobs;
// throwing is fine — the ingestion runner isolates failures per source.
export interface JobSource {
  type: string;
  fetchJobs(config: Record<string, unknown>): Promise<NormalizedJob[]>;
}

export interface FetchContext {
  // Injected so sources stay pure/testable instead of reading process.env.
  adzunaAppId?: string;
  adzunaAppKey?: string;
  fetchImpl?: typeof fetch;
}
