import { describe, it, expect } from 'vitest';
import { parsePrefillResponse, parseScoreResponse } from '@/lib/ai/parse';

describe('parseScoreResponse', () => {
  const valid = JSON.stringify({
    score: 82,
    verdict: 'strong',
    matched_skills: ['React', 'TypeScript'],
    gaps: ['Kubernetes'],
    summary: 'Strong overlap on the core frontend stack.',
  });

  it('parses a clean JSON response', () => {
    expect(parseScoreResponse(valid)).toEqual({
      score: 82,
      verdict: 'strong',
      matched_skills: ['React', 'TypeScript'],
      gaps: ['Kubernetes'],
      summary: 'Strong overlap on the core frontend stack.',
    });
  });

  it('tolerates ```json fences and surrounding prose', () => {
    const wrapped = 'Here is the result:\n```json\n' + valid + '\n```\nDone.';
    expect(parseScoreResponse(wrapped).score).toBe(82);
  });

  it('clamps and rounds the score into 0..100', () => {
    expect(parseScoreResponse(JSON.stringify({ ...JSON.parse(valid), score: 140 })).score).toBe(100);
    expect(parseScoreResponse(JSON.stringify({ ...JSON.parse(valid), score: -5 })).score).toBe(0);
    expect(parseScoreResponse(JSON.stringify({ ...JSON.parse(valid), score: 73.6 })).score).toBe(74);
  });

  it('dedupes/trims skill + gap lists', () => {
    const out = parseScoreResponse(
      JSON.stringify({ ...JSON.parse(valid), matched_skills: ['React', ' react ', ''] }),
    );
    expect(out.matched_skills).toEqual(['React']);
  });

  it('throws on non-JSON', () => {
    expect(() => parseScoreResponse('the candidate is a great fit')).toThrow();
  });

  it('throws on a bad verdict enum', () => {
    expect(() =>
      parseScoreResponse(JSON.stringify({ ...JSON.parse(valid), verdict: 'amazing' })),
    ).toThrow(/Malformed score response/);
  });

  it('throws when a required field is missing', () => {
    expect(() => parseScoreResponse(JSON.stringify({ score: 50, verdict: 'medium' }))).toThrow();
  });
});

describe('parsePrefillResponse', () => {
  it('parses and normalizes seniority', () => {
    const out = parsePrefillResponse(
      JSON.stringify({
        skills: ['React', 'react', 'Go'],
        seniority: 'Senior',
        summary: '  A frontend engineer.  ',
        target_roles: ['Frontend Engineer'],
      }),
    );
    expect(out).toEqual({
      skills: ['React', 'Go'],
      seniority: 'senior',
      summary: 'A frontend engineer.',
      target_roles: ['Frontend Engineer'],
    });
  });

  it('coerces an unknown/null seniority to null', () => {
    expect(
      parsePrefillResponse(
        JSON.stringify({ skills: [], seniority: 'staff', summary: 's', target_roles: [] }),
      ).seniority,
    ).toBeNull();
    expect(
      parsePrefillResponse(
        JSON.stringify({ skills: [], seniority: null, summary: 's', target_roles: [] }),
      ).seniority,
    ).toBeNull();
  });

  it('throws on malformed prefill output', () => {
    expect(() => parsePrefillResponse('not json')).toThrow();
    expect(() => parsePrefillResponse(JSON.stringify({ skills: 'react' }))).toThrow();
  });
});
