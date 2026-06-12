import { describe, it, expect } from 'vitest';
import { scoredProfileHash } from '@/lib/ai/hash';
import type { ScoringProfile } from '@/lib/ai/types';

const base: ScoringProfile = {
  headline: 'Frontend Engineer',
  summary: 'Builds web apps.',
  seniority: 'medior',
  skills: ['React', 'TypeScript'],
  target_roles: ['Frontend Engineer'],
  target_locations: ['Eindhoven'],
  target_salary_min: 60000,
  work_modes: ['Hybrid'],
  languages: ['English'],
  cv_text: 'Some CV text.',
};

describe('scoredProfileHash', () => {
  it('is deterministic and a short hex string', () => {
    const h = scoredProfileHash(base);
    expect(h).toBe(scoredProfileHash(base));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is order- and case-insensitive for list fields', () => {
    expect(scoredProfileHash({ ...base, skills: ['typescript', 'react'] })).toBe(
      scoredProfileHash(base),
    );
  });

  it('ignores whitespace differences in text fields', () => {
    expect(scoredProfileHash({ ...base, summary: '  Builds   web apps.  ' })).toBe(
      scoredProfileHash(base),
    );
  });

  it('changes when a scoring-relevant field changes', () => {
    expect(scoredProfileHash({ ...base, skills: ['React', 'Go'] })).not.toBe(
      scoredProfileHash(base),
    );
    expect(scoredProfileHash({ ...base, seniority: 'senior' })).not.toBe(scoredProfileHash(base));
    expect(scoredProfileHash({ ...base, target_salary_min: 70000 })).not.toBe(
      scoredProfileHash(base),
    );
    expect(scoredProfileHash({ ...base, cv_text: 'Different CV.' })).not.toBe(
      scoredProfileHash(base),
    );
  });
});
