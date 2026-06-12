'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { resolveAnthropicKey } from '@/lib/ai/resolve-key';
import { anthropicCall } from '@/lib/ai/client';
import { scoredProfileHash } from '@/lib/ai/hash';
import { jobToScoring, profileToScoring, runPrefill, runScore } from '@/lib/ai/score';
import type { ModelCall, CvPrefill } from '@/lib/ai/types';
import type { JobRow, ProfileRow } from '@/types/database';

export type ScoreActionResult = { ok: boolean; error?: string };
export type BatchScoreSummary = {
  ok: boolean;
  scored: number;
  failed: number;
  skipped: number;
  error?: string;
};
export type PrefillResult = { ok: boolean; data?: CvPrefill; error?: string };

const BATCH_CAP = 50; // hard per-run cap for cost control
const CONCURRENCY = 3; // bounded parallelism
const NEW_FETCH_LIMIT = 200; // candidate window before filtering to unscored/stale

const NO_KEY_MESSAGE =
  'No Anthropic API key available. Add your own key in Profile → AI to enable scoring.';

function errorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401) return 'Invalid Anthropic API key.';
  if (status === 429) return 'Anthropic rate limit hit — try again shortly.';
  if (err instanceof Error) return err.message;
  return 'Scoring failed.';
}

// Run `worker` over `items` with at most `limit` in flight at once.
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

function buildUpdate(result: Awaited<ReturnType<typeof runScore>>, hash: string) {
  return {
    fit_score: result.score,
    fit_verdict: result.verdict,
    fit_summary: result.summary,
    fit_breakdown: { matched_skills: result.matched_skills, gaps: result.gaps },
    scored_at: new Date().toISOString(),
    scored_profile_hash: hash,
  };
}

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

  const call: ModelCall = anthropicCall(key);
  let result;
  try {
    result = await runScore(call, profileToScoring(profile as ProfileRow), jobToScoring(row));
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  const { error } = await supabase.from('jobs').update(buildUpdate(result, hash)).eq('id', jobId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/discovery');
  return { ok: true };
}

// Batch-score the user's unscored (or stale) New jobs, bounded + capped.
export async function scoreNewJobs(): Promise<BatchScoreSummary> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase.from('profiles').select('*').maybeSingle();
  if (!profile) {
    return { ok: false, scored: 0, failed: 0, skipped: 0, error: 'Set up your profile first.' };
  }

  const key = await resolveAnthropicKey(supabase, user.id);
  if (!key) return { ok: false, scored: 0, failed: 0, skipped: 0, error: NO_KEY_MESSAGE };

  const hash = scoredProfileHash(profileToScoring(profile as ProfileRow));

  const { data: jobRows, error: fetchErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('state', 'new')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })
    .limit(NEW_FETCH_LIMIT);
  if (fetchErr) {
    return { ok: false, scored: 0, failed: 0, skipped: 0, error: fetchErr.message };
  }

  const candidates = (jobRows ?? []) as JobRow[];
  // Skip jobs already scored for the current profile hash (unless none yet).
  const needScoring = candidates.filter(
    (j) => j.fit_score == null || j.scored_profile_hash !== hash,
  );
  const targets = needScoring.slice(0, BATCH_CAP);

  const call: ModelCall = anthropicCall(key);
  const scoringProfile = profileToScoring(profile as ProfileRow);
  let scored = 0;
  let failed = 0;

  await runPool(targets, CONCURRENCY, async (job) => {
    try {
      const result = await runScore(call, scoringProfile, jobToScoring(job));
      const { error } = await supabase
        .from('jobs')
        .update(buildUpdate(result, hash))
        .eq('id', job.id);
      if (error) failed += 1;
      else scored += 1;
    } catch {
      failed += 1;
    }
  });

  revalidatePath('/discovery');
  return {
    ok: true,
    scored,
    failed,
    skipped: candidates.length - targets.length,
  };
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
    return { ok: false, error: errorMessage(err) };
  }
}
