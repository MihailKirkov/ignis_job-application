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
  // When true, the client marks the `system` block with `cache_control: ephemeral`
  // so a stable prefix (system instructions + profile/CV) is reused across the
  // chunks of a batch-scoring run. A no-op below the model's min cacheable prefix.
  cacheSystem?: boolean;
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

// A job in a batch carries its DB id so results can be mapped back by job_id.
export type BatchScoringJob = ScoringJob & { id: string };

// The validated, coerced fit-score result.
export type ScoreResult = {
  score: number; // integer 0..100
  verdict: ScoreVerdict;
  matched_skills: string[];
  gaps: string[];
  summary: string;
};

// The `jobs` columns written after a score — built from a ScoreResult so the
// per-job action, the batch chunk processor, and the cron all write the same
// shape.
export type JobFitColumns = {
  fit_score: number;
  fit_verdict: ScoreVerdict;
  fit_summary: string;
  fit_breakdown: { matched_skills: string[]; gaps: string[] };
  scored_at: string;
  scored_profile_hash: string;
};

// One job's fit columns plus its id — returned by a chunk so the client can fill
// the badge in place. Pure wire shape (no DB/SDK), safe to import into the client.
export type ScoredJobUpdate = { id: string } & JobFitColumns;

// The result of processing one chunk of a scoring run.
export type ScoringChunkResult = {
  ok: boolean;
  done: boolean;
  completed: number;
  failed: number;
  total: number;
  remaining: number;
  updated: ScoredJobUpdate[];
  error?: string;
};

// AI message drafting (Phase 4). Takes a base template (its {variables} already
// substituted) plus grounding context and asks the model to produce a polished,
// personalized outreach message. Pure wire shape — no SDK/DB.
export type DraftRequest = {
  kind: string; // a human label for the template kind, guides tone/structure
  template: string; // the base template body (variables already filled), may be empty
  subject?: string | null; // base subject line (variables already filled)
  company?: string | null;
  role?: string | null;
  stack?: string[] | null;
  contactName?: string | null;
  contactRole?: string | null;
  sender?: { name?: string | null; headline?: string | null; summary?: string | null } | null;
  notes?: string | null; // freeform extra guidance from the user
};

// The drafted message. subject is null when the channel/template has none.
export type DraftResult = {
  subject: string | null;
  body: string;
};

// Structured fields extracted from a CV to pre-fill the profile form.
export type CvPrefill = {
  skills: string[];
  seniority: Seniority | null;
  summary: string;
  target_roles: string[];
};
