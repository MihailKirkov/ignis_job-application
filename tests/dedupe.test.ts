import { describe, it, expect } from 'vitest';
import { dedupeExact, dedupeFuzzy, dedupeJobs } from '@/lib/discovery/dedupe';
import type { NormalizedJob } from '@/lib/sources/types';

function job(overrides: Partial<NormalizedJob>): NormalizedJob {
  return {
    source: 'adzuna',
    external_id: Math.random().toString(36).slice(2),
    title: 'Software Engineer',
    company: 'ASML',
    location: 'Eindhoven',
    mode: null,
    salary_min: null,
    salary_max: null,
    currency: null,
    url: null,
    description: null,
    posted_at: null,
    raw: {},
    ...overrides,
  };
}

describe('dedupeExact', () => {
  it('drops duplicate (source, external_id), keeping the first', () => {
    const a = job({ source: 'adzuna', external_id: '1', title: 'First' });
    const b = job({ source: 'adzuna', external_id: '1', title: 'Second' });
    const c = job({ source: 'adzuna', external_id: '2' });
    const out = dedupeExact([a, b, c]);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('First');
  });

  it('keeps same external_id across different sources', () => {
    const a = job({ source: 'adzuna', external_id: '1' });
    const b = job({ source: 'lever', external_id: '1' });
    expect(dedupeExact([a, b])).toHaveLength(2);
  });
});

describe('dedupeFuzzy', () => {
  it('collapses the same role from different sources, preferring the ATS copy', () => {
    const aggregator = job({
      source: 'remoteok',
      external_id: 'r1',
      company: 'ASML',
      title: 'Senior Backend Engineer (m/f/d)',
      location: 'Eindhoven, NL',
    });
    const ats = job({
      source: 'greenhouse',
      external_id: 'g1',
      company: 'asml',
      title: 'Senior Backend Engineer',
      location: 'Eindhoven',
      salary_min: 70000,
    });
    const out = dedupeFuzzy([aggregator, ats]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('greenhouse');
  });

  it('does not merge genuinely different roles', () => {
    const a = job({ title: 'Backend Engineer', external_id: 'a' });
    const b = job({ title: 'Frontend Engineer', external_id: 'b' });
    expect(dedupeFuzzy([a, b])).toHaveLength(2);
  });

  it('never merges jobs that produce an empty title key', () => {
    const a = job({ title: '', company: '', location: '', external_id: 'a' });
    const b = job({ title: '', company: '', location: '', external_id: 'b' });
    expect(dedupeFuzzy([a, b])).toHaveLength(2);
  });
});

describe('dedupeJobs', () => {
  it('applies exact then fuzzy', () => {
    const a = job({ source: 'adzuna', external_id: '1', salary_min: 50000 });
    const aDup = job({ source: 'adzuna', external_id: '1' });
    const ats = job({ source: 'lever', external_id: 'x', salary_min: 60000 });
    const out = dedupeJobs([a, aDup, ats]);
    // a and aDup collapse exact; a and ats collapse fuzzy -> lever wins (higher rank)
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('lever');
  });
});
