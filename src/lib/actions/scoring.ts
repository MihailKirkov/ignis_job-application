'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { resolveAnthropicKey } from '@/lib/ai/resolve-key';
import { anthropicCall } from '@/lib/ai/client';
import { scoredProfileHash } from '@/lib/ai/hash';
import {
  fitColumns,
  jobToScoring,
  profileToScoring,
  runPrefill,
  runScore,
} from '@/lib/ai/score';
import {
  NO_KEY_MESSAGE,
  createScoringRun,
  scoringErrorMessage,
} from '@/lib/ai/scoring-run';
import { SCORING_MANUAL_CAP } from '@/lib/constants';
import type { CvPrefill, JobFitColumns } from '@/lib/ai/types';
import type { JobRow, ProfileRow } from '@/types/database';

export type ScoreActionResult = { ok: boolean; error?: string };
// The fit columns written after a score — returned to the client so a single
// card's badge can update in place without a full refetch.
export type JobFitUpdate = JobFitColumns;
export type ScoreOneResult =
  | { ok: true; skipped?: boolean; fit?: JobFitUpdate }
  | { ok: false; error: string };
export type PrefillResult = { ok: boolean; data?: CvPrefill; error?: string };
export type StartScoringResult =
  | { ok: true; total: number; runId?: string }
  | { ok: false; error: string };

// Score a single discovered job against the user's profile.
export async function scoreJob(
  jobId: string,
  opts?: { force?: boolean },
): Promise<ScoreActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();
  if (!profile) return { ok: false, error: 'Set up your profile first (Profile).' };

  const key = await resolveAnthropicKey(supabase, user.id);
  if (!key) return { ok: false, error: NO_KEY_MESSAGE };

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return { ok: false, error: 'Job not found.' };

  const hash = scoredProfileHash(profileToScoring(profile as ProfileRow));
  const row = job as JobRow;
  if (!opts?.force && row.fit_score != null && row.scored_profile_hash === hash) {
    return { ok: true }; // already scored for the current profile
  }

  let result;
  try {
    result = await runScore(anthropicCall(key), profileToScoring(profile as ProfileRow), jobToScoring(row));
  } catch (err) {
    return { ok: false, error: scoringErrorMessage(err) };
  }

  const { error } = await supabase.from('jobs').update(fitColumns(result, hash)).eq('id', jobId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/discovery');
  return { ok: true };
}

// Score one job and RETURN its fit fields, so the client (DiscoveryList) can
// update that card's badge incrementally (per-card "Rescore").
export async function scoreOneJob(
  jobId: string,
  opts?: { force?: boolean },
): Promise<ScoreOneResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();
  if (!profile) return { ok: false, error: 'Set up your profile first (Profile).' };

  const key = await resolveAnthropicKey(supabase, user.id);
  if (!key) return { ok: false, error: NO_KEY_MESSAGE };

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return { ok: false, error: 'Job not found.' };

  const hash = scoredProfileHash(profileToScoring(profile as ProfileRow));
  const row = job as JobRow;
  if (!opts?.force && row.fit_score != null && row.scored_profile_hash === hash) {
    return { ok: true, skipped: true };
  }

  let result;
  try {
    result = await runScore(
      anthropicCall(key),
      profileToScoring(profile as ProfileRow),
      jobToScoring(row),
    );
  } catch (err) {
    return { ok: false, error: scoringErrorMessage(err) };
  }

  const fit = fitColumns(result, hash);
  const { error } = await supabase.from('jobs').update(fit).eq('id', jobId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/needs-action');
  revalidatePath('/tracker');
  return { ok: true, fit };
}

// Kick off an async scoring run over the unscored-for-current-profile New jobs
// (capped). Returns the run id immediately — the client drives /api/scoring/chunk
// to completion, so the UI is never blocked on the whole batch. total: 0 means
// there's nothing to score.
export async function startScoring(): Promise<StartScoringResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const res = await createScoringRun(supabase, user.id, 'manual', SCORING_MANUAL_CAP);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, total: res.total, runId: res.runId };
}

// Cancel a run — stops the client loop (the chunk endpoint sees the status and
// bails). Already-scored jobs persist.
export async function cancelScoring(runId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from('scoring_runs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('status', 'running');
}

// Extract structured fields from the user's CV text for the profile form to
// pre-fill (the user reviews and saves them — this does not write the profile).
export async function prefillFromCv(): Promise<PrefillResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase.from('profiles').select('cv_text').maybeSingle();
  const cv = profile?.cv_text?.trim();
  if (!cv) {
    return { ok: false, error: 'Add CV text first (paste it or upload a PDF).' };
  }

  const key = await resolveAnthropicKey(supabase, user.id);
  if (!key) return { ok: false, error: NO_KEY_MESSAGE };

  try {
    const data = await runPrefill(anthropicCall(key), cv);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: scoringErrorMessage(err) };
  }
}
