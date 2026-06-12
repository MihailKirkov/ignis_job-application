// Shared AI types. Pure — no SDK, no DB, safe to import anywhere (incl. tests).

import type { ScoreVerdict, Seniority } from '@/types/database';

export type { ScoreVerdict };

// A single Messages-API request, as a plain payload. The thin client wrapper in
// `client.ts` turns this into an Anthropic SDK call; tests inject a fake.
export type ChatMessage = { role: 'user'; content: string };

export type ModelRequest = {
  model: string;
  max_tokens: number;
  system: string;
  messages: ChatMessage[];
};

// The injectable model-call seam — mirrors how source fetchers inject `fetchImpl`.
// Takes a request, returns the assistant's text. Unit tests pass a canned impl
// so the pure orchestrator hits no network.
export type ModelCall = (req: ModelRequest) => Promise<string>;

// The profile fields that actually drive scoring (subset of ProfileRow). Kept
// decoupled from the DB row so the prompt/hash stay easy to test.
export type ScoringProfile = {
  headline?: string | null;
  summary?: string | null;
  seniority?: Seniority | null;
  skills?: string[];
  target_roles?: string[];
  target_locations?: string[];
  target_salary_min?: number | null;
  work_modes?: string[];
  languages?: string[];
  cv_text?: string | null;
};

// The job fields shown to the model when scoring.
export type ScoringJob = {
  title: string;
  company?: string | null;
  location?: string | null;
  mode?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  description?: string | null;
};

// The validated, coerced fit-score result.
export type ScoreResult = {
  score: number; // integer 0..100
  verdict: ScoreVerdict;
  matched_skills: string[];
  gaps: string[];
  summary: string;
};

// Structured fields extracted from a CV to pre-fill the profile form.
export type CvPrefill = {
  skills: string[];
  seniority: Seniority | null;
  summary: string;
  target_roles: string[];
};
