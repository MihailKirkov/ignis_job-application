import { describe, it, expect } from 'vitest';
import { matchesFilter, filterJobs } from '@/lib/discovery/filters';
import type { NormalizedJob } from '@/lib/sources/types';

function job(overrides: Partial<NormalizedJob>): NormalizedJob {
  return {
    source: 'adzuna',
    external_id: 'x',
    title: 'Software Engineer',
    company: 'ASML',
    location: 'Eindhoven, NL',
    mode: null,
    salary_min: null,
    salary_max: null,
    currency: null,
    url: null,
    description: 'We use React and TypeScript.',
    posted_at: null,
    raw: {},
    ...overrides,
  };
}

const NOW = new Date('2026-06-11T12:00:00Z');

describe('include / exclude keywords', () => {
  it('include matches any term by default', () => {
    expect(matchesFilter(job({}), { includeKeywords: ['react', 'go'] })).toBe(true);
  });
  it('include "all" requires every term', () => {
    expect(
      matchesFilter(job({}), { includeKeywords: ['react', 'go'], includeMatch: 'all' }),
    ).toBe(false);
    expect(
      matchesFilter(job({}), {
        includeKeywords: ['react', 'typescript'],
        includeMatch: 'all',
      }),
    ).toBe(true);
  });
  it('exclude rejects when any term present', () => {
    expect(matchesFilter(job({}), { excludeKeywords: ['php'] })).toBe(true);
    expect(matchesFilter(job({}), { excludeKeywords: ['react'] })).toBe(false);
  });
});

describe('location scope', () => {
  it('eindhoven scope matches Brainport towns', () => {
    expect(matchesFilter(job({ location: 'Veldhoven' }), { locationScope: 'eindhoven' })).toBe(
      true,
    );
    expect(matchesFilter(job({ location: 'Berlin' }), { locationScope: 'eindhoven' })).toBe(
      false,
    );
  });
  it('nl scope matches Dutch cities and remote', () => {
    expect(matchesFilter(job({ location: 'Amsterdam' }), { locationScope: 'nl' })).toBe(true);
    expect(
      matchesFilter(job({ location: 'Anywhere', mode: 'Remote' }), { locationScope: 'nl' }),
    ).toBe(true);
    expect(matchesFilter(job({ location: 'Paris' }), { locationScope: 'nl' })).toBe(false);
  });
  it('remote scope matches remote mode or text', () => {
    expect(
      matchesFilter(job({ location: 'Remote', description: 'fully remote' }), {
        locationScope: 'remote',
      }),
    ).toBe(true);
    expect(matchesFilter(job({ location: 'Eindhoven', description: 'on-site' }), {
      locationScope: 'remote',
    })).toBe(false);
  });
});

describe('salary floor', () => {
  it('rejects known salary below floor', () => {
    expect(matchesFilter(job({ salary_max: 40000 }), { salaryMin: 50000 })).toBe(false);
  });
  it('keeps salary at/above floor', () => {
    expect(matchesFilter(job({ salary_max: 60000 }), { salaryMin: 50000 })).toBe(true);
  });
  it('keeps jobs with unknown salary', () => {
    expect(matchesFilter(job({}), { salaryMin: 50000 })).toBe(true);
  });
});

describe('seniority / mode', () => {
  it('filters by guessed seniority', () => {
    expect(
      matchesFilter(job({ title: 'Senior Engineer' }), { seniority: ['senior'] }),
    ).toBe(true);
    expect(
      matchesFilter(job({ title: 'Junior Engineer' }), { seniority: ['senior'] }),
    ).toBe(false);
  });
  it('filters by mode, using guess when null', () => {
    expect(
      matchesFilter(job({ mode: null, description: 'hybrid role' }), { mode: ['Hybrid'] }),
    ).toBe(true);
    expect(matchesFilter(job({ mode: 'On-site' }), { mode: ['Remote'] })).toBe(false);
  });
});

describe('postedWithinDays', () => {
  it('keeps recent, drops stale and undated', () => {
    expect(
      matchesFilter(job({ posted_at: '2026-06-10T00:00:00Z' }), { postedWithinDays: 7 }, NOW),
    ).toBe(true);
    expect(
      matchesFilter(job({ posted_at: '2026-05-01T00:00:00Z' }), { postedWithinDays: 7 }, NOW),
    ).toBe(false);
    expect(matchesFilter(job({ posted_at: null }), { postedWithinDays: 7 }, NOW)).toBe(false);
  });
});

describe('source + language', () => {
  it('filters by source', () => {
    expect(matchesFilter(job({ source: 'lever' }), { sources: ['lever'] })).toBe(true);
    expect(matchesFilter(job({ source: 'adzuna' }), { sources: ['lever'] })).toBe(false);
  });
  it('naive Dutch detection', () => {
    const nl = job({
      title: 'Software Ontwikkelaar',
      description: 'Wij zoeken een ervaren developer en jij past in het team van de afdeling.',
    });
    expect(matchesFilter(nl, { language: 'nl' })).toBe(true);
    expect(matchesFilter(job({}), { language: 'nl' })).toBe(false);
  });
});

describe('filterJobs', () => {
  it('combines criteria across a list', () => {
    const jobs = [
      job({ external_id: '1', title: 'Senior React Engineer', salary_max: 70000 }),
      job({ external_id: '2', title: 'Junior PHP Developer', salary_max: 30000 }),
      job({ external_id: '3', title: 'Senior Go Engineer', salary_max: 80000 }),
    ];
    const out = filterJobs(jobs, {
      seniority: ['senior'],
      excludeKeywords: ['php'],
      salaryMin: 60000,
    });
    expect(out.map((j) => j.external_id)).toEqual(['1', '3']);
  });
});
