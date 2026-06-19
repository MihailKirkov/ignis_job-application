'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { criteriaFromParams, jobRowToNormalized, isCriteriaEmpty } from '@/lib/discovery/filter-params';
import { matchesFilter } from '@/lib/discovery/filters';
import { JOB_STATES } from '@/lib/constants';
import type { JobRow, JobState } from '@/types/database';

// One DB page of the discovery inbox. The inbox can hold hundreds of jobs, so we
// page at the database level (range/limit) instead of loading them all. Active
// filters are applied in-memory per page (the predicate is richer than SQL),
// which can make a page shorter than PAGE_SIZE — the client keeps requesting
// until `done`, so density variation is invisible.
// A 'use server' module may only export async functions, so this constant + the
// page shape stay module-local (nothing external needs them — the client uses
// the returned value structurally).
const DISCOVERY_PAGE_SIZE = 20;

type JobsPage = {
  jobs: JobRow[];
  nextOffset: number;
  done: boolean;
};

export async function loadJobsPage(input: {
  state: JobState;
  params: Record<string, string>;
  offset: number;
}): Promise<JobsPage> {
  await requireUser();
  const state: JobState = JOB_STATES.includes(input.state) ? input.state : 'new';
  const offset = Math.max(0, Math.floor(input.offset) || 0);

  const supabase = await createClient();
  // Consistent ordering keeps DB-level pagination stable across pages. The New
  // inbox is best-fit-first (unscored last) then most-recent; the action tabs
  // are simply most-recent.
  let query = supabase.from('jobs').select('*').eq('state', state);
  if (state === 'new') {
    query = query.order('fit_score', { ascending: false, nullsFirst: false });
  }
  query = query
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false });

  const { data } = await query.range(offset, offset + DISCOVERY_PAGE_SIZE - 1);

  const fetched = (data ?? []) as JobRow[];
  const criteria = criteriaFromParams({ get: (k) => input.params[k] ?? null });
  const jobs = isCriteriaEmpty(criteria)
    ? fetched
    : fetched.filter((j) => matchesFilter(jobRowToNormalized(j), criteria));

  return {
    jobs,
    nextOffset: offset + fetched.length,
    // A short DB read means we've reached the end of this state.
    done: fetched.length < DISCOVERY_PAGE_SIZE,
  };
}
