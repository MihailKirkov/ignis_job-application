import { describe, expect, it } from 'vitest';
import { computeVitals } from '@/lib/pipeline';
import type { ApplicationStatus } from '@/types/database';

describe('computeVitals', () => {
  it('returns zeroed vitals (0% response) for an empty pipeline', () => {
    expect(computeVitals([])).toEqual({
      active: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      sent: 0,
      replied: 0,
      responseRate: 0,
    });
  });

  it('counts active (non-terminal) and per-stage tallies', () => {
    const statuses: ApplicationStatus[] = [
      'To apply',
      'Applied',
      'Applied',
      'Interview',
      'Offer',
      'Rejected',
      'Closed',
    ];
    const v = computeVitals(statuses);
    expect(v.active).toBe(5); // all except Rejected + Closed
    expect(v.applied).toBe(2);
    expect(v.interview).toBe(1);
    expect(v.offer).toBe(1);
  });

  it('computes response rate as replied / sent, rounded', () => {
    // sent = Applied,Screening,Interview,Offer,Rejected = 4; replied = 3 → 75%
    const v = computeVitals(['Applied', 'Screening', 'Interview', 'Rejected']);
    expect(v.sent).toBe(4);
    expect(v.replied).toBe(3);
    expect(v.responseRate).toBe(75);
  });

  it('excludes "To apply" and "Closed" from sent', () => {
    const v = computeVitals(['To apply', 'Closed', 'Applied']);
    expect(v.sent).toBe(1);
    expect(v.replied).toBe(0);
    expect(v.responseRate).toBe(0);
  });
});
