import type { ApplicationRow } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { AppCard, type FitMap } from './app-card';
import { CountdownTimer } from './hud-clock';
import { HudFrame } from './hud-frame';
import { LogFeed, RadialMeter, SectionLabel, StatReadout, type LogEntry } from './hud';

export type Vitals = {
  active: number;
  applied: number;
  interview: number;
  offer: number;
  responseRate: number;
  replied: number;
  sent: number;
};

export type Mission = {
  label: string;
  targetDate: string;
  milestone: { label: string; date: string };
};

// Thin cyan connector rail with small nodes — wires the vitals row together.
function ConnectorRail({ nodes = 6 }: { nodes?: number }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 px-1" aria-hidden>
      {Array.from({ length: nodes }).map((_, i) => (
        <span key={i} className="flex flex-1 items-center gap-1.5 last:flex-none">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-system"
            style={{ boxShadow: '0 0 5px -1px var(--color-system)' }}
          />
          {i < nodes - 1 ? <span className="h-px flex-1 bg-system/25" /> : null}
        </span>
      ))}
    </div>
  );
}

// Presentational "command bridge". Both the real Needs-action page and the public
// /demo compute the data and render this, so they stay visually identical.
export function CommandBridge({
  mission,
  vitals,
  overdue,
  dueToday,
  telemetry,
  fitMap,
  readOnly = false,
  actions,
}: {
  mission: Mission;
  vitals: Vitals;
  overdue: ApplicationRow[];
  dueToday: ApplicationRow[];
  telemetry: LogEntry[];
  fitMap: FitMap;
  readOnly?: boolean;
  actions?: React.ReactNode;
}) {
  const total = overdue.length + dueToday.length;
  const fitFor = (row: ApplicationRow) => (row.job_id ? fitMap[row.job_id] : undefined);

  return (
    <div className="space-y-4">
      {/* ---- Command bar ---- */}
      <HudFrame chamfer={['tl', 'br']} accentCorner="tl" node bodyClassName="px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <SectionLabel>COMMAND BRIDGE</SectionLabel>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-fg">Needs action</h1>
            <p className="text-sm text-muted">
              {total > 0 ? (
                <>
                  <span className="font-mono text-fg">{total}</span> due
                  {overdue.length > 0 ? (
                    <>
                      {' · '}
                      <span className="text-status-rejected">{overdue.length} overdue</span>
                    </>
                  ) : null}
                </>
              ) : (
                'All systems nominal — pipeline up to date.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <CountdownTimer target={mission.targetDate} label={`T-MINUS · ${mission.label}`} />
            <div className="flex flex-col gap-1">
              <SectionLabel>{mission.milestone.label}</SectionLabel>
              <span className="font-mono text-sm leading-none text-muted">
                {formatDate(mission.milestone.date)}
              </span>
            </div>
            {actions ? <div className="flex items-center">{actions}</div> : null}
          </div>
        </div>
      </HudFrame>

      {/* ---- Vitals ---- */}
      <div>
        <ConnectorRail />
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid min-w-[260px] flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <StatReadout label="Active" value={vitals.active} colorToken="system" active index="V1" />
            <StatReadout label="Applied" value={vitals.applied} colorToken="status-applied" index="V2" />
            <StatReadout
              label="Interview"
              value={vitals.interview}
              colorToken="status-interview"
              ledAlert={vitals.interview > 0}
              index="V3"
            />
            <StatReadout label="Offer" value={vitals.offer} colorToken="status-offer" index="V4" />
          </div>
          <HudFrame
            label="RESPONSE RATE"
            chamfer={['tl', 'br']}
            className="min-w-[200px] flex-1 sm:max-w-[240px]"
            bodyClassName="flex items-center justify-center gap-3 py-2.5"
          >
            <RadialMeter
              value={vitals.responseRate}
              colorToken="status-offer"
              label={`${vitals.responseRate}%`}
              size={76}
            />
            <div className="font-mono text-[11px] leading-relaxed text-muted">
              <div>
                <span className="text-fg">{vitals.replied}</span> replies
              </div>
              <div>
                <span className="text-fg">{vitals.sent}</span> sent
              </div>
            </div>
          </HudFrame>
        </div>
      </div>

      {/* ---- Alerts + Telemetry ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <HudFrame
          label="PRIORITY ALERTS"
          chamfer={['tl', 'br']}
          className="lg:col-span-2"
          right={<span className="font-mono text-[11px] text-faint">{total} ACTIVE</span>}
        >
          {total === 0 ? (
            <p className="font-mono text-xs text-faint">— queue clear · no follow-ups due</p>
          ) : (
            <div className="space-y-3">
              {overdue.length > 0 ? (
                <div className="space-y-2">
                  <SectionLabel className="text-status-rejected">
                    OVERDUE · {overdue.length}
                  </SectionLabel>
                  <div className="grid gap-2">
                    {overdue.map((row) => (
                      <AppCard
                        key={row.id}
                        row={row}
                        fit={fitFor(row)}
                        severity="overdue"
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {dueToday.length > 0 ? (
                <div className="space-y-2">
                  <SectionLabel className="text-accent">DUE TODAY · {dueToday.length}</SectionLabel>
                  <div className="grid gap-2">
                    {dueToday.map((row) => (
                      <AppCard
                        key={row.id}
                        row={row}
                        fit={fitFor(row)}
                        severity="due"
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </HudFrame>

        <HudFrame
          label="TELEMETRY"
          chamfer={['tl']}
          right={<span className="font-mono text-[11px] text-faint">LIVE</span>}
        >
          <LogFeed entries={telemetry} empty="— no ingestion runs or status changes yet" className="max-h-[200px] overflow-scroll" />
        </HudFrame>
      </div>
    </div>
  );
}
