import Link from 'next/link';
import type { Metadata } from 'next';
import { MISSION, SOURCE_META } from '@/lib/constants';
import { computeVitals } from '@/lib/pipeline';
import {
  cn,
  formatDateTime,
  isDueOrOverdue,
  isOverdue,
  isTerminal,
  statusColorToken,
} from '@/lib/utils';
import type { ApplicationStatus } from '@/types/database';
import { CommandBridge } from '@/components/needs-action-view';
import { TrackerStats } from '@/components/tracker-stats';
import { TrackerBoard } from '@/components/tracker-board';
import { TrackerConsole } from '@/components/tracker-console';
import { JobCard } from '@/components/job-card';
import type { FitMap } from '@/components/app-card';
import type { LogEntry } from '@/components/hud';
import { EmptyState } from '@/components/ui';
import {
  DEMO_APPLICATIONS,
  DEMO_JOBS,
  DEMO_JOB_COUNTS,
  DEMO_SOURCES,
  DEMO_TODAY,
} from '@/lib/demo/fixtures';

export const metadata: Metadata = {
  title: 'Demo — Job Command Center',
  description: 'A read-only tour of the Job Command Center with sample data.',
};

type View = 'needs-action' | 'tracker' | 'discovery';
const VIEWS: { id: View; label: string }[] = [
  { id: 'needs-action', label: 'Needs action' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'discovery', label: 'Discovery' },
];

// Fit map shared by all demo views (job id → score/verdict).
const FIT_MAP: FitMap = Object.fromEntries(
  DEMO_JOBS.filter((j) => j.fit_score != null).map((j) => [
    j.id,
    { score: j.fit_score as number, verdict: j.fit_verdict },
  ]),
);

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; board?: string }>;
}) {
  const { view, board } = await searchParams;
  const active: View = VIEWS.some((v) => v.id === view) ? (view as View) : 'needs-action';

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-xs tracking-widest text-system">
              JOB · CC
            </Link>
            <span className="border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
              Demo · read-only
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hud-cut inline-flex h-8 items-center bg-accent px-3 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="inline-flex h-8 items-center border border-system/30 bg-surface-2 px-3 text-sm text-fg transition-colors hover:border-system/60 hover:text-system"
            >
              ← Home
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 md:px-8">
          {VIEWS.map((v) => {
            const isActive = v.id === active;
            return (
              <Link
                key={v.id}
                href={`/demo?view=${v.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'border-system text-fg'
                    : 'border-transparent text-muted hover:text-fg',
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-6">
        <p className="mb-4 border border-system/20 bg-surface px-3 py-2 text-xs text-muted">
          Sample data only — buttons are disabled in the demo. Sign in to ingest
          real jobs, score them against your own profile, and run your pipeline.
        </p>
        {active === 'needs-action' ? <NeedsActionView /> : null}
        {active === 'tracker' ? <TrackerView board={board === 'console' ? 'console' : 'board'} /> : null}
        {active === 'discovery' ? <DiscoveryView /> : null}
      </main>
    </div>
  );
}

// --------------------------------------------------------------------------- Needs action
function NeedsActionView() {
  const due = DEMO_APPLICATIONS.filter(
    (r) => isDueOrOverdue(r.next_action_date, DEMO_TODAY) && !isTerminal(r.status),
  );
  const overdue = due.filter((r) => isOverdue(r.next_action_date, DEMO_TODAY));
  const dueToday = due.filter((r) => !isOverdue(r.next_action_date, DEMO_TODAY));

  const vitals = computeVitals(DEMO_APPLICATIONS.map((r) => r.status));

  const sourceEvents = DEMO_SOURCES.map((s) => ({
    ts: new Date(s.last_run_at).getTime(),
    time: formatDateTime(s.last_run_at),
    colorToken: 'status-applied',
    text: (
      <>
        Ingestion run ·{' '}
        <span className="text-fg">
          {SOURCE_META[s.type as keyof typeof SOURCE_META]?.label ?? s.type}
        </span>
      </>
    ),
  }));
  const appEvents = [...DEMO_APPLICATIONS]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)
    .map((a) => ({
      ts: new Date(a.updated_at).getTime(),
      time: formatDateTime(a.updated_at),
      colorToken: statusColorToken(a.status),
      text: (
        <>
          <span className="text-fg">{a.company}</span> → {a.status}
        </>
      ),
    }));
  const telemetry: LogEntry[] = [...sourceEvents, ...appEvents]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ time, text, colorToken }) => ({ time, text, colorToken }));

  return (
    <CommandBridge
      mission={MISSION}
      vitals={vitals}
      overdue={overdue}
      dueToday={dueToday}
      telemetry={telemetry}
      fitMap={FIT_MAP}
      readOnly
    />
  );
}

// --------------------------------------------------------------------------- Tracker
function TrackerView({ board }: { board: 'board' | 'console' }) {
  const rows = DEMO_APPLICATIONS;
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const active = rows.filter((r) => !isTerminal(r.status as ApplicationStatus)).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hud-label">PIPELINE CONTROL</p>
          <h1 className="mt-1.5 text-xl font-semibold text-fg">Tracker</h1>
        </div>
        <div className="inline-flex items-center gap-0.5 border border-system/25 bg-surface p-0.5">
          {(['board', 'console'] as const).map((b) => (
            <Link
              key={b}
              href={`/demo?view=tracker&board=${b}`}
              aria-current={board === b ? 'page' : undefined}
              className={cn(
                'px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors',
                board === b ? 'bg-surface-2 text-system' : 'text-muted hover:text-fg',
              )}
              style={board === b ? { boxShadow: 'var(--glow-system)' } : undefined}
            >
              {b === 'board' ? '▦ Board' : '≡ Console'}
            </Link>
          ))}
        </div>
      </header>

      <TrackerStats counts={counts} active={active} />

      {board === 'console' ? (
        <TrackerConsole applications={rows} fitMap={FIT_MAP} readOnly />
      ) : (
        <TrackerBoard applications={rows} fitMap={FIT_MAP} readOnly />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- Discovery
function DiscoveryView() {
  const jobs = DEMO_JOBS.filter((j) => j.state === 'new').sort(
    (a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1),
  );
  const TABS: { state: string; label: string }[] = [
    { state: 'new', label: 'New' },
    { state: 'saved', label: 'Saved' },
    { state: 'promoted', label: 'Promoted' },
    { state: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <div className="space-y-5">
      <header>
        <p className="hud-label">SIGNAL INBOX</p>
        <h1 className="mt-1.5 text-xl font-semibold text-fg">Discovery</h1>
        <p className="text-sm text-muted">
          Ingested jobs, scored against the sample profile — best fit first.
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <span
            key={t.state}
            aria-current={t.state === 'new' ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm',
              t.state === 'new' ? 'border-system text-fg' : 'border-transparent text-muted',
            )}
          >
            {t.label}
            <span className="font-mono text-xs text-faint">
              {DEMO_JOB_COUNTS[t.state as keyof typeof DEMO_JOB_COUNTS]}
            </span>
          </span>
        ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="Inbox is empty" />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} readOnly />
          ))}
        </div>
      )}
    </div>
  );
}
