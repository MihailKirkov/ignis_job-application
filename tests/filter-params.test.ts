import { describe, it, expect } from 'vitest';
import {
  criteriaFromParams,
  criteriaToParams,
  isCriteriaEmpty,
} from '@/lib/discovery/filter-params';
import type { FilterCriteria } from '@/lib/discovery/filters';

function params(record: Record<string, string>) {
  return new URLSearchParams(record);
}

describe('criteriaFromParams', () => {
  it('parses a full set of params', () => {
    const c = criteriaFromParams(
      params({
        inc: 'react, typescript',
        incMatch: 'all',
        exc: 'php',
        loc: 'eindhoven',
        locText: 'veldhoven',
        salaryMin: '50000',
        sen: 'senior,lead',
        mode: 'Remote,Hybrid',
        days: '14',
        src: 'lever,greenhouse',
        lang: 'en',
        minFit: '70',
      }),
    );
    expect(c).toEqual<FilterCriteria>({
      includeKeywords: ['react', 'typescript'],
      includeMatch: 'all',
      excludeKeywords: ['php'],
      locationScope: 'eindhoven',
      locationText: 'veldhoven',
      salaryMin: 50000,
      seniority: ['senior', 'lead'],
      mode: ['Remote', 'Hybrid'],
      postedWithinDays: 14,
      sources: ['lever', 'greenhouse'],
      language: 'en',
      minFit: 70,
    });
  });

  it('clamps minFit to 100 and drops non-positive values', () => {
    expect(criteriaFromParams(params({ minFit: '150' })).minFit).toBe(100);
    expect(criteriaFromParams(params({ minFit: '0' })).minFit).toBeUndefined();
  });

  it('drops invalid enum values and the "any" scope', () => {
    const c = criteriaFromParams(
      params({ loc: 'any', sen: 'wizard,senior', mode: 'Lunar', lang: 'martian' }),
    );
    expect(c.locationScope).toBeUndefined();
    expect(c.seniority).toEqual(['senior']);
    expect(c.mode).toBeUndefined();
    expect(c.language).toBeUndefined();
  });

  it('ignores non-positive salary/days', () => {
    const c = criteriaFromParams(params({ salaryMin: '0', days: '-3' }));
    expect(c.salaryMin).toBeUndefined();
    expect(c.postedWithinDays).toBeUndefined();
  });
});

describe('criteriaToParams / roundtrip', () => {
  it('round-trips a populated criteria', () => {
    const original: FilterCriteria = {
      includeKeywords: ['go', 'rust'],
      excludeKeywords: ['senior'],
      locationScope: 'remote',
      salaryMin: 60000,
      mode: ['Remote'],
      postedWithinDays: 7,
      sources: ['remoteok'],
      minFit: 75,
    };
    const back = criteriaFromParams(params(criteriaToParams(original)));
    expect(back).toEqual(original);
  });

  it('omits defaults and empty values', () => {
    expect(criteriaToParams({})).toEqual({});
    expect(criteriaToParams({ includeMatch: 'any', locationScope: 'any' })).toEqual({});
  });
});

describe('isCriteriaEmpty', () => {
  it('detects empty vs populated', () => {
    expect(isCriteriaEmpty({})).toBe(true);
    expect(isCriteriaEmpty({ salaryMin: 50000 })).toBe(false);
  });
});
