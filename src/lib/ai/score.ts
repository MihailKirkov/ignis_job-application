// Pure orchestrators: build prompt -> call the injected model -> parse. The
// `call` seam (ModelCall) is injected exactly like source fetchers inject
// `fetchImpl`, so these are unit-tested with canned model output and no network.

import type { JobRow, ProfileRow } from '@/types/database';
import { buildBatchScorePrompt, buildPrefillPrompt, buildScorePrompt } from './prompt';
import { parseBatchScoreResponse, parsePrefillResponse, parseScoreResponse } from './parse';
import type {
  BatchScoringJob,
  CvPrefill,
  JobFitColumns,
  ModelCall,
  ScoreResult,
  ScoringJob,
  ScoringProfile,
} from './types';

// Adapt DB rows to the decoupled scoring shapes.
export function profileToScoring(p: ProfileRow): ScoringProfile {
  return {
    headline: p.headline,
    summary: p.summary,
    seniority: p.seniority,
    skills: p.skills,
    target_roles: p.target_roles,
    target_locations: p.target_locations,
    target_salary_min: p.target_salary_min,
    work_modes: p.work_modes,
    languages: p.languages,
    cv_text: p.cv_text,
  };
}

export function jobToScoring(j: JobRow): ScoringJob {
  return {
    title: j.title,
    company: j.company,
    location: j.location,
    mode: j.mode,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    currency: j.currency,
    description: j.description,
  };
}

export function jobToBatchScoring(j: JobRow): BatchScoringJob {
  return { id: j.id, ...jobToScoring(j) };
}

// Turn a parsed result into the `jobs` fit columns written to the DB. Shared by
// the single-job action, the batch chunk processor, and the cron.
export function fitColumns(result: ScoreResult, profileHash: string): JobFitColumns {
  return {
    fit_score: result.score,
    fit_verdict: result.verdict,
    fit_summary: result.summary,
    fit_breakdown: { matched_skills: result.matched_skills, gaps: result.gaps },
    scored_at: new Date().toISOString(),
    scored_profile_hash: profileHash,
  };
}

export async function runScore(
  call: ModelCall,
  profile: ScoringProfile,
  job: ScoringJob,
): Promise<ScoreResult> {
  return parseScoreResponse(await call(buildScorePrompt(profile, job)));
}

// Score a chunk of jobs in one cached request; returns a Map keyed by job id.
// Missing ids (model dropped a job) are simply absent — the caller treats those
// as failures so one bad entry never sinks the whole chunk.
export async function runBatchScore(
  call: ModelCall,
  profile: ScoringProfile,
  jobs: BatchScoringJob[],
): Promise<Map<string, ScoreResult>> {
  if (jobs.length === 0) return new Map();
  const text = await call(buildBatchScorePrompt(profile, jobs));
  return parseBatchScoreResponse(text, jobs.map((j) => j.id));
}

export async function runPrefill(call: ModelCall, cvText: string): Promise<CvPrefill> {
  return parsePrefillResponse(await call(buildPrefillPrompt(cvText)));
}
