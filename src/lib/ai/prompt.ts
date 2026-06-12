// Pure prompt builders — turn a profile + job (or a CV) into a ModelRequest.
// No SDK, no network. Kept deterministic (no timestamps/ids) so prompt caching
// stays effective and the output is testable.

import type { ModelRequest, ScoringJob, ScoringProfile } from './types';

// A fast, cheap model — we score many jobs. Verified current id (Claude Haiku
// tier). Note: Haiku does not support the `effort` parameter, so we don't send it.
export const AI_MODEL = 'claude-haiku-4-5';

const CV_CLAMP = 6_000; // keep the CV slice modest for cost/latency

function list(label: string, values?: string[] | null): string {
  const v = (values ?? []).filter(Boolean);
  return v.length ? `${label}: ${v.join(', ')}` : `${label}: (none given)`;
}

function line(label: string, value?: string | number | null): string {
  return `${label}: ${value === null || value === undefined || value === '' ? '(none given)' : value}`;
}

function renderProfile(p: ScoringProfile): string {
  return [
    line('Headline', p.headline),
    line('Seniority', p.seniority),
    list('Skills', p.skills),
    list('Target roles', p.target_roles),
    list('Target locations', p.target_locations),
    line('Target salary floor (yearly)', p.target_salary_min ?? null),
    list('Preferred work modes', p.work_modes),
    list('Languages', p.languages),
    line('Summary', p.summary),
    p.cv_text ? `CV (truncated):\n${p.cv_text.slice(0, CV_CLAMP)}` : 'CV: (none given)',
  ].join('\n');
}

function renderJob(j: ScoringJob): string {
  const salary =
    j.salary_min != null || j.salary_max != null
      ? `${j.salary_min ?? '?'}–${j.salary_max ?? '?'} ${j.currency ?? ''}`.trim()
      : '(not stated)';
  return [
    line('Title', j.title),
    line('Company', j.company),
    line('Location', j.location),
    line('Work mode', j.mode),
    line('Salary', salary),
    line('Description', j.description ? j.description.slice(0, CV_CLAMP) : null),
  ].join('\n');
}

const SCORE_SYSTEM = `You are a precise job-fit evaluator for a software job-seeker.
Compare the candidate profile to a single job posting and rate how well they fit.

Score 0-100 where:
- 80-100 = strong fit (core skills + seniority + location/mode align)
- 50-79  = medium fit (partial overlap, some gaps)
- 0-49   = weak fit (little overlap or clear mismatch)

Be calibrated and concise. Base the score only on the given profile and posting;
do not invent facts. Reply with STRICT JSON only — no prose, no markdown fences —
matching exactly this shape:
{
  "score": <integer 0-100>,
  "verdict": "strong" | "medium" | "weak",
  "matched_skills": [<strings: candidate skills the job wants>],
  "gaps": [<strings: things the job wants the candidate appears to lack>],
  "summary": "<one or two sentences explaining the score>"
}`;

export function buildScorePrompt(profile: ScoringProfile, job: ScoringJob): ModelRequest {
  return {
    model: AI_MODEL,
    max_tokens: 1024,
    system: SCORE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `CANDIDATE PROFILE\n${renderProfile(profile)}\n\nJOB POSTING\n${renderJob(job)}`,
      },
    ],
  };
}

const PREFILL_SYSTEM = `You extract structured profile fields from a CV / résumé.
Read the CV text and return STRICT JSON only — no prose, no markdown fences —
matching exactly this shape:
{
  "skills": [<distinct technical + professional skills, lowercase where natural>],
  "seniority": "intern" | "junior" | "medior" | "senior" | "lead" | "principal" | null,
  "summary": "<2-3 sentence professional summary written in the third person>",
  "target_roles": [<likely target job titles based on experience>]
}
Infer seniority from years of experience and titles; use null if unclear. Only
use information present in the CV; do not invent employers, skills, or dates.`;

export function buildPrefillPrompt(cvText: string): ModelRequest {
  return {
    model: AI_MODEL,
    max_tokens: 1024,
    system: PREFILL_SYSTEM,
    messages: [{ role: 'user', content: `CV TEXT\n${cvText.slice(0, CV_CLAMP * 2)}` }],
  };
}
