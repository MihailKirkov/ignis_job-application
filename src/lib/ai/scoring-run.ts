import 'server-only';

// SERVER-ONLY glue for async scoring runs. The pure batch logic lives in
// prompt/parse/score/progress (unit-tested); this module is the DB + SDK plumbing:
// create a run, process one chunk (one batched + prompt-cached call), and drive a
// run to completion server-side (the cron path). Works with either a session
// client (RLS-scoped) or the admin client (cron).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  JobRow,
  ProfileRow,
  ScoringRunRow,
  ScoringTrigger,
} from '@/types/database';
import { resolveAnthropicKey } from './resolve-key';
import { anthropicCall } from './client';
import { scoredProfileHash } from './hash';
import { fitColumns, jobToBatchScoring, profileToScoring, runBatchScore } from './score';
import { BATCH_SCORE_CAP } from './prompt';
import { chunkLimit, settleChunk } from './progress';
import type { ScoredJobUpdate, ScoreResult, ScoringChunkResult } from './types';

type DB = SupabaseClient<Database>;

export const NO_KEY_MESSAGE =
  'No Anthropic API key available. Add your own key in Profile → AI to enable scoring.';

export function scoringErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401) return 'Invalid Anthropic API key.';
  if (status === 429) return 'Anthropic rate limit hit — try again shortly.';
  if (err instanceof Error) return err.message;
  return 'Scoring failed.';
}

// "Needs scoring for the current profile" = never attempted for this hash. A
// successful score and a per-job failure both stamp the hash, so a run always
// terminates (a job can't loop forever).
function needyFilter(hash: string): string {
  return `scored_profile_hash.is.null,scored_profile_hash.neq.${hash}`;
}

type RunContext = { key: string; profile: ProfileRow; hash: string };

async function resolveContext(
  supabase: DB,
  userId: string,
): Promise<RunContext | { error: string }> {
  const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();
  if (!profile) return { error: 'Set up your profile first (Profile).' };
  const key = await resolveAnthropicKey(supabase, userId);
  if (!key) return { error: NO_KEY_MESSAGE };
  const p = profile as ProfileRow;
  return { key, profile: p, hash: scoredProfileHash(profileToScoring(p)) };
}

export type CreateRunResult =
  | { ok: true; total: number; runId?: string }
  | { ok: false; error: string };

// Count unscored-for-hash jobs (capped), and create a 'running' run. Returns
// total: 0 (no run) when there's nothing to score. Does NOT score.
export async function createScoringRun(
  supabase: DB,
  userId: string,
  trigger: ScoringTrigger,
  cap: number,
): Promise<CreateRunResult> {
  const ctx = await resolveContext(supabase, userId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('state', 'new')
    .or(needyFilter(ctx.hash));
  const total = Math.min(count ?? 0, cap);
  if (total === 0) return { ok: true, total: 0 };

  const { data, error } = await supabase
    .from('scoring_runs')
    .insert({
      user_id: userId,
      trigger,
      status: 'running',
      total,
      completed: 0,
      failed: 0,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, total, runId: (data as { id: string }).id };
}

function settled(run: ScoringRunRow, extra?: Partial<ScoringChunkResult>): ScoringChunkResult {
  return {
    ok: run.status !== 'error',
    done: true,
    completed: run.completed,
    failed: run.failed,
    total: run.total,
    remaining: Math.max(0, run.total - run.completed - run.failed),
    updated: [],
    error: run.error ?? undefined,
    ...extra,
  };
}

// Process ONE chunk of a run: one batched + cached call scoring up to
// BATCH_SCORE_CAP jobs, writing fit columns and bumping the run counters.
export async function processChunk(
  supabase: DB,
  userId: string,
  runId: string,
): Promise<ScoringChunkResult> {
  const { data: runRow } = await supabase
    .from('scoring_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  const run = runRow as ScoringRunRow | null;
  if (!run) {
    return { ok: false, done: true, completed: 0, failed: 0, total: 0, remaining: 0, updated: [], error: 'Scoring run not found.' };
  }
  // Cancelled / done / error → stop the loop.
  if (run.status !== 'running') return settled(run);

  const ctx = await resolveContext(supabase, userId);
  if ('error' in ctx) {
    await supabase
      .from('scoring_runs')
      .update({ status: 'error', error: ctx.error, finished_at: new Date().toISOString() })
      .eq('id', runId);
    return settled({ ...run, status: 'error', error: ctx.error });
  }

  const limit = chunkLimit(run.total, run.completed, run.failed, BATCH_SCORE_CAP);
  if (limit <= 0) {
    await supabase
      .from('scoring_runs')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', runId);
    return settled(run, { ok: true });
  }

  const { data: jobRows } = await supabase
    .from('jobs')
    .select('*')
    .eq('state', 'new')
    .or(needyFilter(ctx.hash))
    .order('id', { ascending: true })
    .limit(limit);
  const chunk = (jobRows ?? []) as JobRow[];
  if (chunk.length === 0) {
    await supabase
      .from('scoring_runs')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', runId);
    return settled(run, { ok: true });
  }

  let results: Map<string, ScoreResult>;
  try {
    results = await runBatchScore(
      anthropicCall(ctx.key),
      profileToScoring(ctx.profile),
      chunk.map(jobToBatchScoring),
    );
  } catch (err) {
    const error = scoringErrorMessage(err);
    await supabase
      .from('scoring_runs')
      .update({ status: 'error', error, finished_at: new Date().toISOString() })
      .eq('id', runId);
    return settled({ ...run, status: 'error', error });
  }

  const updated: ScoredJobUpdate[] = [];
  let scoredCount = 0;
  const now = new Date().toISOString();
  for (const j of chunk) {
    const result = results.get(j.id);
    if (result) {
      const cols = fitColumns(result, ctx.hash);
      await supabase.from('jobs').update(cols).eq('id', j.id);
      updated.push({ id: j.id, ...cols });
      scoredCount += 1;
    } else {
      // Model dropped this job — stamp the hash so it leaves the needy set and
      // the run can't loop on it. It stays unscored (fit_score null) for a manual rescore.
      await supabase
        .from('jobs')
        .update({ scored_profile_hash: ctx.hash, scored_at: now })
        .eq('id', j.id);
    }
  }

  const tally = settleChunk({
    total: run.total,
    completedBefore: run.completed,
    failedBefore: run.failed,
    scoredCount,
    fetchedCount: chunk.length,
    limit,
  });
  await supabase
    .from('scoring_runs')
    .update({
      completed: tally.completed,
      failed: tally.failed,
      status: tally.done ? 'done' : 'running',
      finished_at: tally.done ? new Date().toISOString() : null,
    })
    .eq('id', runId);

  return {
    ok: true,
    done: tally.done,
    completed: tally.completed,
    failed: tally.failed,
    total: run.total,
    remaining: tally.remaining,
    updated,
  };
}

// Drive a run to completion server-side (the cron path). Bounded by `cap` and a
// wall-clock `deadlineMs` so it never blows the function budget; leftover needy
// jobs roll into the next run. Returns null when scoring is unavailable.
export async function runScoringToCompletion(
  supabase: DB,
  userId: string,
  trigger: ScoringTrigger,
  cap: number,
  deadlineMs: number,
): Promise<{ runId: string | null; total: number; completed: number; failed: number } | null> {
  if (Date.now() > deadlineMs) return { runId: null, total: 0, completed: 0, failed: 0 };

  const created = await createScoringRun(supabase, userId, trigger, cap);
  if (!created.ok) return null;
  if (created.total === 0 || !created.runId) {
    return { runId: null, total: 0, completed: 0, failed: 0 };
  }

  const runId = created.runId;
  let completed = 0;
  let failed = 0;
  for (;;) {
    if (Date.now() > deadlineMs) {
      // Out of time — close the run so it isn't left dangling 'running'.
      await supabase
        .from('scoring_runs')
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('id', runId);
      break;
    }
    const res = await processChunk(supabase, userId, runId);
    completed = res.completed;
    failed = res.failed;
    if (res.done) break;
  }
  return { runId, total: created.total, completed, failed };
}
