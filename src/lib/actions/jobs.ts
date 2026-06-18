'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { serverFetchContext } from '@/lib/sources';
import { executeIngestion } from '@/lib/discovery/ingest';
import { logActivity } from '@/lib/activity/log';
import { recordIngestionRun } from '@/lib/activity/record-run';
import { formatSalaryRange } from '@/lib/utils';
import { JOB_STATES } from '@/lib/constants';
import type { JobRow, JobState, SourceRow } from '@/types/database';

function revalidate() {
  revalidatePath('/discovery');
  revalidatePath('/tracker');
  revalidatePath('/needs-action');
  revalidatePath('/activity');
}

// Save / dismiss / un-set a discovered job.
export async function setJobState(id: string, state: JobState): Promise<void> {
  const user = await requireUser();
  if (!JOB_STATES.includes(state)) return;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('company, title')
    .eq('id', id)
    .maybeSingle();
  await supabase.from('jobs').update({ state }).eq('id', id);

  // Only saved/dismissed are user-meaningful feed events (promote has its own).
  const j = job as { company: string | null; title: string } | null;
  if (state === 'saved' || state === 'dismissed') {
    await logActivity(supabase, user.id, {
      type: state === 'saved' ? 'job.saved' : 'job.dismissed',
      entityType: 'job',
      entityId: id,
      meta: { job_id: id, company: j?.company ?? undefined, role: j?.title },
    });
  }
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

  const { data: created, error: insErr } = await supabase
    .from('applications')
    .insert({
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
    })
    .select('id')
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  await supabase.from('jobs').update({ state: 'promoted' }).eq('id', j.id);
  await logActivity(supabase, user.id, {
    type: 'job.promoted',
    entityType: 'application',
    entityId: (created as { id: string } | null)?.id ?? null,
    meta: { job_id: j.id, company: j.company ?? undefined, role: j.title },
  });
  revalidate();
  return { ok: true };
}

export interface IngestionSummary {
  ok: boolean;
  runId?: string;
  fetched: number;
  new: number;
  updated: number;
  perSource: {
    type: string;
    label: string;
    status: string;
    fetched: number;
    new: number;
    updated: number;
    error?: string;
  }[];
  error?: string;
}

function summaryFromOutcome(
  outcome: Awaited<ReturnType<typeof executeIngestion>>,
  runId: string | null,
): IngestionSummary {
  return {
    ok: outcome.status !== 'error',
    runId: runId ?? undefined,
    fetched: outcome.fetched,
    new: outcome.new,
    updated: outcome.updated,
    perSource: outcome.sources.map((s) => ({
      type: s.type,
      label: s.label,
      status: s.status,
      fetched: s.fetched,
      new: s.new,
      updated: s.updated,
      error: s.message ?? undefined,
    })),
  };
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
  if (error)
    return { ok: false, fetched: 0, new: 0, updated: 0, perSource: [], error: error.message };

  const enabled = (sources ?? []) as SourceRow[];
  if (enabled.length === 0) {
    return { ok: true, fetched: 0, new: 0, updated: 0, perSource: [], error: 'No enabled sources.' };
  }

  const startedAt = new Date().toISOString();
  const outcome = await executeIngestion(
    supabase,
    user.id,
    enabled.map((s) => ({ id: s.id, type: s.type, config: s.config })),
    serverFetchContext(),
  );
  const finishedAt = new Date().toISOString();

  await supabase
    .from('sources')
    .update({ last_run_at: finishedAt })
    .in('id', enabled.map((s) => s.id));

  const runId = await recordIngestionRun(supabase, user.id, {
    trigger: 'manual_all',
    startedAt,
    finishedAt,
    outcome,
  });

  revalidate();
  revalidatePath('/sources');
  return summaryFromOutcome(outcome, runId);
}

// Per-source manual run (the play icon on /sources). Runs a single source,
// persists, records the run + event, and bumps last_run_at.
export async function runSingleSource(sourceId: string): Promise<IngestionSummary> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error)
    return { ok: false, fetched: 0, new: 0, updated: 0, perSource: [], error: error.message };
  const source = data as SourceRow | null;
  if (!source)
    return { ok: false, fetched: 0, new: 0, updated: 0, perSource: [], error: 'Source not found.' };

  const startedAt = new Date().toISOString();
  const outcome = await executeIngestion(
    supabase,
    user.id,
    [{ id: source.id, type: source.type, config: source.config }],
    serverFetchContext(),
  );
  const finishedAt = new Date().toISOString();

  await supabase.from('sources').update({ last_run_at: finishedAt }).eq('id', source.id);

  const runId = await recordIngestionRun(supabase, user.id, {
    trigger: 'manual_source',
    startedAt,
    finishedAt,
    outcome,
  });

  revalidate();
  revalidatePath('/sources');
  return summaryFromOutcome(outcome, runId);
}
