import { createClient } from '@/lib/supabase/server';
import {
  bestChannel,
  buildChannelFunnel,
  funnelTotals,
  type ChannelFunnel,
  type FunnelApplication,
  type FunnelOutreach,
} from '@/lib/insights';
import { HudFrame, RadialMeter, SectionLabel, StatReadout, TickBar } from '@/components/hud';
import { EmptyState } from '@/components/ui';

export default async function InsightsPage() {
  const supabase = await createClient();
  const [{ data: appRows }, { data: outRows }] = await Promise.all([
    supabase.from('applications').select('channel, status'),
    supabase.from('outreach').select('channel, status'),
  ]);

  const rows = buildChannelFunnel(
    (appRows ?? []) as FunnelApplication[],
    (outRows ?? []) as FunnelOutreach[],
  );
  const totals = funnelTotals(rows);
  const focus = bestChannel(rows);

  return (
    <div className="space-y-5">
      <header>
        <p className="hud-label">ATTRIBUTION</p>
        <h1 className="mt-1.5 text-xl font-semibold text-fg">Insights</h1>
        <p className="text-sm text-muted">
          Sent → reply → screen → interview → offer, by channel — so you can double
          down on what converts.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No attribution yet"
          hint="Set a channel on your applications and log outreach — the funnel fills in as you work the pipeline."
        />
      ) : (
        <>
          {/* ---- Totals ---- */}
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid min-w-[260px] flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              <StatReadout label="Sent" value={totals.sent} active index="F1" />
              <StatReadout
                label="Replied"
                value={totals.replied}
                colorToken="status-applied"
                index="F2"
              />
              <StatReadout
                label="Interview"
                value={totals.interview}
                colorToken="status-interview"
                index="F3"
              />
              <StatReadout
                label="Offer"
                value={totals.offer}
                colorToken="status-offer"
                index="F4"
              />
            </div>
            <HudFrame
              label="REPLY RATE"
              chamfer={['tl', 'br']}
              className="min-w-[200px] flex-1 sm:max-w-[240px]"
              bodyClassName="flex items-center justify-center gap-3 py-2.5"
            >
              <RadialMeter
                value={totals.replyRate}
                colorToken="status-applied"
                label={`${totals.replyRate}%`}
                size={76}
              />
              <div className="font-mono text-[11px] leading-relaxed text-muted">
                <div>
                  <span className="text-fg">{totals.replied}</span> replies
                </div>
                <div>
                  <span className="text-fg">{totals.sent}</span> sent
                </div>
              </div>
            </HudFrame>
          </div>

          {/* ---- Pipeline by channel ---- */}
          <div>
            <SectionLabel className="text-faint">PIPELINE BY CHANNEL</SectionLabel>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <ChannelCard key={r.channel} row={r} focus={r.channel === focus} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChannelCard({ row, focus }: { row: ChannelFunnel; focus: boolean }) {
  const tone = focus ? 'accent' : 'system';
  return (
    <HudFrame
      label={row.channel}
      chamfer={['tl', 'br']}
      accentCorner="tl"
      accentTone={tone}
      node
      right={
        focus ? (
          <span className="font-mono text-[10px] uppercase tracking-wide text-accent">
            ◆ Focus
          </span>
        ) : (
          <span className="font-mono text-[11px] text-faint">{row.sent} sent</span>
        )
      }
    >
      <div className="space-y-1.5">
        <Stage label="SENT" value={row.sent} sent={row.sent} />
        <Stage label="REPLY" value={row.replied} sent={row.sent} />
        <Stage label="SCREEN" value={row.screen} sent={row.sent} />
        <Stage label="INTRVW" value={row.interview} sent={row.sent} />
        <Stage label="OFFER" value={row.offer} sent={row.sent} tone={focus ? 'accent' : 'status-offer'} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 font-mono text-[11px] tabular-nums text-muted">
        <span>
          reply <span className="text-fg">{row.replyRate}%</span>
        </span>
        <span>
          intrvw <span className="text-fg">{row.interviewRate}%</span>
        </span>
        <span>
          offer{' '}
          <span style={{ color: `var(--color-${focus ? 'accent' : 'status-offer'})` }}>
            {row.offerRate}%
          </span>
        </span>
      </div>
    </HudFrame>
  );
}

// One funnel stage: label, a proportional tick bar (lit ∝ value/sent), and the
// mono count. The bar makes the narrowing funnel legible at a glance.
function Stage({
  label,
  value,
  sent,
  tone = 'system',
}: {
  label: string;
  value: number;
  sent: number;
  tone?: string;
}) {
  const total = 12;
  const lit = sent > 0 ? Math.round((value / sent) * total) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="hud-label w-14 shrink-0 text-faint">{label}</span>
      <TickBar total={total} lit={lit} className="flex-1" />
      <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums" style={{ color: `var(--color-${tone})` }}>
        {value}
      </span>
    </div>
  );
}
