// Stable hash of the scoring-relevant profile fields. Stored on a job at scoring
// time (jobs.scored_profile_hash); when the profile changes, the hash changes,
// which marks existing scores stale so they re-score. Pure + deterministic.

import { createHash } from 'node:crypto';
import type { ScoringProfile } from './types';

function norm(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Order-independent: sort + lowercase so reordering a list doesn't change the hash.
function normList(values?: string[] | null): string[] {
  return [...new Set((values ?? []).map((v) => norm(v)).filter(Boolean))].sort();
}

export function scoredProfileHash(p: ScoringProfile): string {
  const canonical = JSON.stringify({
    headline: norm(p.headline),
    summary: norm(p.summary),
    seniority: p.seniority ?? null,
    skills: normList(p.skills),
    target_roles: normList(p.target_roles),
    target_locations: normList(p.target_locations),
    target_salary_min: p.target_salary_min ?? null,
    work_modes: normList(p.work_modes),
    languages: normList(p.languages),
    cv_text: norm(p.cv_text),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}
