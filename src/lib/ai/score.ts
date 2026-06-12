// Pure orchestrators: build prompt -> call the injected model -> parse. The
// `call` seam (ModelCall) is injected exactly like source fetchers inject
// `fetchImpl`, so these are unit-tested with canned model output and no network.

import type { JobRow, ProfileRow } from '@/types/database';
import { buildPrefillPrompt, buildScorePrompt } from './prompt';
import { parsePrefillResponse, parseScoreResponse } from './parse';
import type {
  CvPrefill,
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

export async function runScore(
  call: ModelCall,
  profile: ScoringProfile,
  job: ScoringJob,
): Promise<ScoreResult> {
  return parseScoreResponse(await call(buildScorePrompt(profile, job)));
}

export async function runPrefill(call: ModelCall, cvText: string): Promise<CvPrefill> {
  return parsePrefillResponse(await call(buildPrefillPrompt(cvText)));
}
