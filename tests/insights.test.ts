import { describe, it, expect } from 'vitest';
import {
  bestChannel,
  buildChannelFunnel,
  funnelTotals,
  type FunnelApplication,
  type FunnelOutreach,
} from '@/lib/insights';
import type { ApplicationStatus, Channel, OutreachStatus } from '@/types/database';

const app = (channel: Channel | null, status: ApplicationStatus): FunnelApplication => ({
  channel,
  status,
});
const out = (channel: Channel | null, status: OutreachStatus): FunnelOutreach => ({
  channel,
  status,
});

describe('buildChannelFunnel', () => {
  it('returns no rows for empty input', () => {
    expect(buildChannelFunnel([], [])).toEqual([]);
  });

  it('counts application funnel stages for one channel', () => {
    const rows = buildChannelFunnel(
      [
        app('Referral', 'To apply'), // not sent
        app('Referral', 'Applied'), // sent
        app('Referral', 'Screening'), // sent, replied, screen
        app('Referral', 'Interview'), // sent, replied, screen, interview
        app('Referral', 'Offer'), // sent, replied, screen, interview, offer
        app('Referral', 'Rejected'), // sent, replied (a rejection is a response)
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.channel).toBe('Referral');
    expect(r.applications).toBe(6);
    expect(r.sent).toBe(5);
    expect(r.replied).toBe(4);
    expect(r.screen).toBe(3);
    expect(r.interview).toBe(2);
    expect(r.offer).toBe(1);
    expect(r.replyRate).toBe(80); // 4/5
    expect(r.interviewRate).toBe(40); // 2/5
    expect(r.offerRate).toBe(20); // 1/5
  });

  it('folds outreach touches into sent + replied', () => {
    const rows = buildChannelFunnel(
      [],
      [
        out('LinkedIn', 'Sent'),
        out('LinkedIn', 'Replied'),
        out('LinkedIn', 'No reply'),
        out('LinkedIn', 'Bounced'),
      ],
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.touches).toBe(4);
    expect(r.sent).toBe(4);
    expect(r.replied).toBe(1);
    expect(r.replyRate).toBe(25);
    expect(r.interview).toBe(0);
    expect(r.offerRate).toBe(0);
  });

  it('combines applications and outreach on the same channel', () => {
    const rows = buildChannelFunnel(
      [app('Detachering', 'Applied'), app('Detachering', 'Interview')],
      [out('Detachering', 'Sent'), out('Detachering', 'Replied')],
    );
    const r = rows[0];
    expect(r.applications).toBe(2);
    expect(r.touches).toBe(2);
    expect(r.sent).toBe(4); // 2 apps sent + 2 touches
    expect(r.replied).toBe(2); // 1 app (Interview) + 1 outreach Replied
    expect(r.interview).toBe(1);
    expect(r.replyRate).toBe(50);
    expect(r.interviewRate).toBe(25);
  });

  it('folds a null channel into Other', () => {
    const rows = buildChannelFunnel([app(null, 'Applied'), app('Other', 'Offer')], [
      out(null, 'Replied'),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('Other');
    expect(rows[0].applications).toBe(2);
    expect(rows[0].touches).toBe(1);
    expect(rows[0].sent).toBe(3); // 2 apps + 1 touch
  });

  it('emits rows in canonical CHANNELS order', () => {
    const rows = buildChannelFunnel(
      [app('Other', 'Applied'), app('Detachering', 'Applied'), app('LinkedIn', 'Applied')],
      [],
    );
    expect(rows.map((r) => r.channel)).toEqual(['Detachering', 'LinkedIn', 'Other']);
  });

  it('rounds rates to the nearest integer percent', () => {
    // 1 reply out of 3 sent = 33.33% -> 33
    const rows = buildChannelFunnel(
      [app('Recruiter', 'Applied'), app('Recruiter', 'Applied'), app('Recruiter', 'Screening')],
      [],
    );
    expect(rows[0].replyRate).toBe(33);
  });
});

describe('funnelTotals', () => {
  it('sums stages across channels and computes overall reply rate', () => {
    const rows = buildChannelFunnel(
      [app('Referral', 'Offer'), app('LinkedIn', 'Applied')],
      [out('LinkedIn', 'Sent'), out('LinkedIn', 'Replied')],
    );
    const t = funnelTotals(rows);
    expect(t.sent).toBe(4); // Referral 1 + LinkedIn (1 app + 2 touches)
    expect(t.replied).toBe(2); // Referral Offer + LinkedIn Replied
    expect(t.offer).toBe(1);
    expect(t.replyRate).toBe(50);
  });

  it('is zero-safe', () => {
    expect(funnelTotals([])).toEqual({
      sent: 0,
      replied: 0,
      screen: 0,
      interview: 0,
      offer: 0,
      replyRate: 0,
    });
  });
});

describe('bestChannel', () => {
  it('picks the highest offer rate', () => {
    const rows = buildChannelFunnel(
      [
        app('Referral', 'Offer'), // 100% offer
        app('LinkedIn', 'Applied'),
        app('LinkedIn', 'Interview'),
      ],
      [],
    );
    expect(bestChannel(rows)).toBe('Referral');
  });

  it('breaks ties by interview then reply rate', () => {
    // Both 0% offer; Detachering has the interview.
    const rows = buildChannelFunnel(
      [app('Detachering', 'Interview'), app('LinkedIn', 'Screening')],
      [],
    );
    expect(bestChannel(rows)).toBe('Detachering');
  });

  it('returns null when nothing has converted', () => {
    const rows = buildChannelFunnel([app('LinkedIn', 'Applied'), app('LinkedIn', 'To apply')], []);
    expect(bestChannel(rows)).toBeNull();
  });
});
