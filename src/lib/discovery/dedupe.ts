import type { NormalizedJob } from '@/lib/sources/types';
import { fuzzyKey } from './normalize';

// Trust ranking: a posting straight from the employer's ATS beats an aggregator
// copy of the same role, which beats a remote-board copy.
const SOURCE_RANK: Record<string, number> = {
  greenhouse: 5,
  lever: 5,
  ashby: 5,
  workable: 5,
  import: 4,
  adzuna: 3,
  arbeitnow: 3,
  remotive: 2,
  remoteok: 2,
};

function rank(source: string): number {
  return SOURCE_RANK[source] ?? 1;
}

// Higher = preferred when two postings collide on the fuzzy key.
function score(job: NormalizedJob): number {
  let s = rank(job.source) * 100;
  if (job.salary_min != null || job.salary_max != null) s += 20;
  if (job.posted_at) s += 5;
  if (job.description) s += Math.min(10, job.description.length / 500);
  return s;
}

export function fuzzyKeyOf(job: NormalizedJob): string {
  return fuzzyKey(job.company, job.title, job.location);
}

// Collapse exact duplicates within a batch by (source, external_id), keeping the
// first occurrence. The DB also enforces this via UNIQUE(user_id, source, external_id).
export function dedupeExact(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Map<string, NormalizedJob>();
  for (const j of jobs) {
    const key = `${j.source}::${j.external_id}`;
    if (!seen.has(key)) seen.set(key, j);
  }
  return [...seen.values()];
}

// Collapse near-duplicates across sources by fuzzy key (company+title+location),
// keeping the highest-scoring posting. Jobs whose key has no title segment are
// never merged (kept under a unique fallback key).
export function dedupeFuzzy(jobs: NormalizedJob[]): NormalizedJob[] {
  const best = new Map<string, NormalizedJob>();
  let fallback = 0;
  for (const j of jobs) {
    const key = fuzzyKeyOf(j);
    const titleSegment = key.split('|')[1] ?? '';
    const useKey = titleSegment.trim() ? key : `__nokey_${fallback++}`;
    const cur = best.get(useKey);
    if (!cur || score(j) > score(cur)) best.set(useKey, j);
  }
  return [...best.values()];
}

// Full dedupe pipeline: exact first (cheap), then fuzzy across sources.
export function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  return dedupeFuzzy(dedupeExact(jobs));
}
