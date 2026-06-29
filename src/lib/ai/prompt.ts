// Pure prompt builders — turn a profile + job (or a CV) into a ModelRequest.
// No SDK, no network. Kept deterministic (no timestamps/ids) so prompt caching
// stays effective and the output is testable.

import type {
  BatchScoringJob,
  DraftRequest,
  ModelRequest,
  ScoringJob,
  ScoringProfile,
} from './types';

// Max jobs scored in a single batched request. Capped low so one call stays fast
// and the JSON stays well-formed; also the chunk size for a scoring run.
export const BATCH_SCORE_CAP = 8;

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

// Batch variant: score up to BATCH_SCORE_CAP jobs in one request. The system
// block carries the (stable) candidate profile so it can be PROMPT-CACHED across
// the chunks of a run — the volatile job list goes in the user message, after
// the cached prefix. The model returns ONE object per job, keyed by job_id.
const BATCH_SCORE_SYSTEM = `You are a precise job-fit evaluator for a software job-seeker.
For EACH job posting, compare it to the candidate profile and rate the fit.

Score 0-100 where:
- 80-100 = strong fit (core skills + seniority + location/mode align)
- 50-79  = medium fit (partial overlap, some gaps)
- 0-49   = weak fit (little overlap or clear mismatch)

Score every job independently and be calibrated and concise. Base each score only
on the given profile and that posting; do not invent facts. Reply with STRICT JSON
only — no prose, no markdown fences — a JSON ARRAY with exactly one object per job,
each echoing the job's id, matching this shape:
[
  {
    "job_id": "<the id given for the job>",
    "score": <integer 0-100>,
    "verdict": "strong" | "medium" | "weak",
    "matched_skills": [<strings: candidate skills the job wants>],
    "gaps": [<strings: things the job wants the candidate appears to lack>],
    "summary": "<one or two sentences explaining the score>"
  }
]`;

export function buildBatchScorePrompt(
  profile: ScoringProfile,
  jobs: BatchScoringJob[],
): ModelRequest {
  const slice = jobs.slice(0, BATCH_SCORE_CAP);
  const rendered = slice
    .map((j) => `--- JOB job_id=${j.id} ---\n${renderJob(j)}`)
    .join('\n\n');
  return {
    model: AI_MODEL,
    // Room for one result object per job (matched_skills/gaps/summary) + overhead.
    max_tokens: Math.min(8192, 512 + slice.length * 400),
    // Stable instructions + profile → cacheable prefix reused across chunks.
    system: `${BATCH_SCORE_SYSTEM}\n\nCANDIDATE PROFILE\n${renderProfile(profile)}`,
    cacheSystem: true,
    messages: [
      {
        role: 'user',
        content: `JOBS TO SCORE (${slice.length}) — return one JSON object per job_id:\n\n${rendered}`,
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

// Message drafting: personalize a base template into a ready-to-send outreach
// message. The model is told to keep the user's intent + structure, fill any gaps
// from the context, and never invent facts. Returns STRICT JSON {subject, body}.
const DRAFT_SYSTEM = `You are an assistant that drafts concise, professional job-search outreach messages on behalf of a candidate.
You are given a BASE TEMPLATE (the candidate's own boilerplate, possibly with gaps) plus context about the company, role, contact, and sender.

Rewrite the template into a polished, personalized, ready-to-send message:
- Keep the candidate's intent, tone, and overall structure; improve clarity and flow.
- Fill naturally from the given context; do NOT invent employers, facts, numbers, or links.
- Keep it brief and human — no buzzword padding, no placeholder tokens like {company} left in.
- If a subject is relevant (email), provide one; otherwise return null for it.

Reply with STRICT JSON only — no prose, no markdown fences — matching exactly this shape:
{
  "subject": <string or null>,
  "body": "<the message body>"
}`;

function renderStack(stack?: string[] | null): string {
  const v = (stack ?? []).filter(Boolean);
  return v.length ? v.join(', ') : '(none given)';
}

export function buildDraftPrompt(req: DraftRequest): ModelRequest {
  const context = [
    line('Template kind', req.kind),
    line('Company', req.company),
    line('Role', req.role),
    line('Contact name', req.contactName),
    line('Contact role', req.contactRole),
    line('Candidate tech stack', renderStack(req.stack)),
    line('Sender name', req.sender?.name ?? null),
    line('Sender headline', req.sender?.headline ?? null),
    line('Sender summary', req.sender?.summary ?? null),
    line('Extra guidance', req.notes),
  ].join('\n');
  return {
    model: AI_MODEL,
    max_tokens: 1024,
    system: DRAFT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `CONTEXT\n${context}\n\nBASE SUBJECT\n${req.subject?.trim() || '(none)'}\n\nBASE TEMPLATE\n${req.template.trim() || '(empty — write from the context)'}`,
      },
    ],
  };
}

export function buildPrefillPrompt(cvText: string): ModelRequest {
  return {
    model: AI_MODEL,
    max_tokens: 1024,
    system: PREFILL_SYSTEM,
    messages: [{ role: 'user', content: `CV TEXT\n${cvText.slice(0, CV_CLAMP * 2)}` }],
  };
}
