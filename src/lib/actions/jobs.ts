'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { serverFetchContext } from '@/lib/sources';
import { runFetchers, persistJobs } from '@/lib/discovery/ingest';
import { formatSalaryRange } from '@/lib/utils';
import { JOB_STATES } from '@/lib/constants';
import type { JobRow, JobState, SourceRow } from '@/types/database';

function revalidate() {
  revalidatePath('/discovery');
  revalidatePath('/tracker');
  revalidatePath('/needs-action');
}

// Save / dismiss / un-set a discovered job.
export async function setJobState(id: string, state: JobState): Promise<void> {
  await requireUser();
  if (!JOB_STATES.includes(state)) return;
  const supabase = await createClient();
  await supabase.from('jobs').update({ state }).eq('id', id);
  revalidate();
}

// Promote a discovered job into the pipeline: create a pre-filled application,
// link it back via job_id, and mark the job as promoted.
export async function promoteJob(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (jobErr || !job) return { ok: false, error: jobErr?.message ?? 'Job not found' };

  const j = job as JobRow;
  const salary = formatSalaryRange(j.salary_min, j.salary_max, j.currency);

  const { error: insErr } = await supabase.from('applications').insert({
    user_id: user.id,
    job_id: j.id,
    company: j.company ?? 'Unknown',
    role: j.title,
    location: j.location,
    mode: (j.mode as never) ?? null,
    status: 'To apply',
    salary,
    link: j.url,
    notes: `Promoted from discovery (${j.source}).`,
  });
  if (insErr) return { ok: false, error: insErr.message };

  await supabase.from('jobs').update({ state: 'promoted' }).eq('id', j.id);
  revalidate();
  return { ok: true };
}

export interface IngestionSummary {
  ok: boolean;
  upserted: number;
  perSource: { type: string; count: number; error?: string }[];
  error?: string;
}

// Manual "refresh inbox now" — runs the user's enabled sources and upserts under
// their own RLS-scoped session. Mirrors what the cron route does per user.
export async function runUserIngestion(): Promise<IngestionSummary> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: sources, error } = await supabase
    .from('sources')
    .select('*')
    .eq('enabled', true);
  if (error) return { ok: false, upserted: 0, perSource: [], error: error.message };

  const enabled = (sources ?? []) as SourceRow[];
  if (enabled.length === 0) {
    return { ok: true, upserted: 0, perSource: [], error: 'No enabled sources.' };
  }

  const { jobs, results } = await runFetchers(
    enabled.map((s) => ({ id: s.id, type: s.type, config: s.config })),
    serverFetchContext(),
  );

  let upserted = 0;
  try {
    upserted = await persistJobs(supabase, user.id, jobs);
  } catch (err) {
    return {
      ok: false,
      upserted: 0,
      perSource: results,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from('sources')
    .update({ last_run_at: nowIso })
    .in(
      'id',
      enabled.map((s) => s.id),
    );

  revalidate();
  return {
    ok: true,
    upserted,
    perSource: results.map((r) => ({ type: r.type, count: r.count, error: r.error })),
  };
}
