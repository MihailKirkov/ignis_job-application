// Pure channel-attribution insights — no React, no Supabase, fully unit-tested.
// Answers "which methods convert?" by folding applications + outreach into a
// per-channel funnel (sent → reply → screen → interview → offer) with rates.

import type { ApplicationStatus, Channel, OutreachStatus } from '@/types/database';
import { CHANNELS } from './constants';
import { REPLIED_STATUSES, SENT_STATUSES } from './pipeline';

// Minimal shapes so the funnel decouples from full DB rows (and stays testable).
export type FunnelApplication = { channel: Channel | null; status: ApplicationStatus };
export type FunnelOutreach = { channel: Channel | null; status: OutreachStatus };

// Application stages beyond "replied" (the deeper the funnel, the rarer).
const SCREEN_STATUSES: ApplicationStatus[] = ['Screening', 'Interview', 'Offer'];
const INTERVIEW_STATUSES: ApplicationStatus[] = ['Interview', 'Offer'];
const OFFER_STATUSES: ApplicationStatus[] = ['Offer'];

export type ChannelFunnel = {
  channel: Channel;
  // raw volumes
  applications: number; // all apps on this channel (incl. "To apply")
  touches: number; // all outreach on this channel
  // funnel stages (apps + outreach combined at the top; apps-only deeper down)
  sent: number; // submitted applications + outreach touches
  replied: number; // app responses + outreach "Replied"
  screen: number; // reached Screening+
  interview: number; // reached Interview+
  offer: number; // reached Offer
  // conversion rates, as integer percent of `sent` (0 when sent is 0)
  replyRate: number;
  interviewRate: number;
  offerRate: number;
};

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

// Unattributed (null) channel folds into "Other" — the vocabulary's catch-all.
function norm(channel: Channel | null): Channel {
  return channel ?? 'Other';
}

// Build the per-channel funnel. Returns one row per channel that has any activity
// (applications or outreach), in canonical CHANNELS order.
export function buildChannelFunnel(
  applications: FunnelApplication[],
  outreach: FunnelOutreach[],
): ChannelFunnel[] {
  const blank = (): Omit<ChannelFunnel, 'channel' | 'replyRate' | 'interviewRate' | 'offerRate'> => ({
    applications: 0,
    touches: 0,
    sent: 0,
    replied: 0,
    screen: 0,
    interview: 0,
    offer: 0,
  });
  const acc = new Map<Channel, ReturnType<typeof blank>>();
  const bucket = (c: Channel) => {
    let m = acc.get(c);
    if (!m) {
      m = blank();
      acc.set(c, m);
    }
    return m;
  };

  for (const app of applications) {
    const m = bucket(norm(app.channel));
    m.applications += 1;
    if (SENT_STATUSES.includes(app.status)) m.sent += 1;
    if (REPLIED_STATUSES.includes(app.status)) m.replied += 1;
    if (SCREEN_STATUSES.includes(app.status)) m.screen += 1;
    if (INTERVIEW_STATUSES.includes(app.status)) m.interview += 1;
    if (OFFER_STATUSES.includes(app.status)) m.offer += 1;
  }

  for (const o of outreach) {
    const m = bucket(norm(o.channel));
    m.touches += 1;
    m.sent += 1; // every touch is a "sent"
    if (o.status === 'Replied') m.replied += 1;
  }

  return CHANNELS.filter((c) => acc.has(c)).map((channel) => {
    const m = acc.get(channel)!;
    return {
      channel,
      ...m,
      replyRate: pct(m.replied, m.sent),
      interviewRate: pct(m.interview, m.sent),
      offerRate: pct(m.offer, m.sent),
    };
  });
}

// Grand totals across all channels (for the summary readouts).
export function funnelTotals(rows: ChannelFunnel[]): {
  sent: number;
  replied: number;
  screen: number;
  interview: number;
  offer: number;
  replyRate: number;
} {
  const t = rows.reduce(
    (a, r) => ({
      sent: a.sent + r.sent,
      replied: a.replied + r.replied,
      screen: a.screen + r.screen,
      interview: a.interview + r.interview,
      offer: a.offer + r.offer,
    }),
    { sent: 0, replied: 0, screen: 0, interview: 0, offer: 0 },
  );
  return { ...t, replyRate: pct(t.replied, t.sent) };
}

// The "act here" channel: where to double down — the strongest converter. Picks
// the max offerRate, then interviewRate, then replyRate, requiring real volume
// (sent ≥ 1) and at least one positive outcome. Null when nothing has converted.
export function bestChannel(rows: ChannelFunnel[]): Channel | null {
  let best: ChannelFunnel | null = null;
  for (const r of rows) {
    if (r.sent < 1) continue;
    if (r.offer === 0 && r.interview === 0 && r.replied === 0) continue;
    if (
      best === null ||
      r.offerRate > best.offerRate ||
      (r.offerRate === best.offerRate && r.interviewRate > best.interviewRate) ||
      (r.offerRate === best.offerRate &&
        r.interviewRate === best.interviewRate &&
        r.replyRate > best.replyRate)
    ) {
      best = r;
    }
  }
  return best?.channel ?? null;
}
