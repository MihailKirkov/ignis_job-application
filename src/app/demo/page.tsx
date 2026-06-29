import Link from 'next/link';
import type { Metadata } from 'next';
import { ACTIVITY_CATEGORY_COLOR, MISSION } from '@/lib/constants';
import { computeVitals } from '@/lib/pipeline';
import { cn, formatDateTime, isDueOrOverdue, isOverdue, isTerminal } from '@/lib/utils';
import type { ApplicationStatus, JobState } from '@/types/database';
import { SideNav, MobileNav } from '@/components/app-shell';
import { CommandBridge } from '@/components/needs-action-view';
import type { AlertItem } from '@/components/alert-cards';
import { TrackerStats } from '@/components/tracker-stats';
import { TrackerBoard } from '@/components/tracker-board';
import { TrackerConsole } from '@/components/tracker-console';
import { DiscoveryTabs } from '@/components/discovery-tabs';
import { JobCard } from '@/components/job-card';
import { HudFrame } from '@/components/hud-frame';
import type { FitMap } from '@/components/app-card';
import type { LogEntry } from '@/components/hud';
import { EmptyState } from '@/components/ui';
import {
  DEMO_ACTIVITY,
  DEMO_APPLICATIONS,
  DEMO_JOBS,
  DEMO_JOB_COUNTS,
  DEMO_TODAY,
} from '@/lib/demo/fixtures';

const DEMO_DESCRIPTION =
  'Take a read-only tour with sample data — walk the AI-scored Discovery inbox, the pipeline Tracker, and the Needs-action queue. No account required.';

export const metadata: Metadata = {
  title: 'Demo',
  description: DEMO_DESCRIPTION,
  alternates: { canonical: '/demo' },
  openGraph: {
    type: 'website',
    siteName: 'Job Command Center',
    locale: 'en',
    url: '/demo',
    title: 'Demo · Job Command Center',
    description: DEMO_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Demo · Job Command Center',
    description: DEMO_DESCRIPTION,
  },
};

type View = 'needs-action' | 'tracker' | 'discovery';
const VIEWS: View[] = ['needs-action', 'tracker', 'discovery'];

// Fit map shared by all demo views (job id → score/verdict).
const FIT_MAP: FitMap = Object.fromEntries(
  DEMO_JOBS.filter((j) => j.fit_score != null).map((j) => [
    j.id,
    { score: j.fit_score as number, verdict: j.fit_verdict },
  ]),
);

// Sidebar badge: due/overdue follow-ups that aren't terminal — same rule as the app.
const NEEDS_ACTION_COUNT = DEMO_APPLICATIONS.filter(
  (r) => isDueOrOverdue(r.next_action_date, DEMO_TODAY) && !isTerminal(r.status),
).length;

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; board?: string; state?: string }>;
}) {
  const { view, board, state } = await searchParams;
  const active: View = VIEWS.includes(view as View) ? (view as View) : 'needs-action';

  return (
    <div className="bg-bg md:grid md:h-dvh md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface md:block">
        <SideNav demo activeView={active} needsActionCount={NEEDS_ACTION_COUNT} />
      </aside>
      <MobileNav demo activeView={active} />
      <main className="min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8 md:py-8">
          <DemoBanner />
          {active === 'needs-action' ? <NeedsActionView /> : null}
          {active === 'tracker' ? (
            <TrackerView board={board === 'console' ? 'console' : 'board'} />
          ) : null}
          {active === 'discovery' ? <DiscoveryView state={discoveryState(state)} /> : null}
        </div>
      </main>
    </div>
  );
}

// One-line value prop + read-only banner + a prominent, persistent sign-in CTA —
// present on every demo surface (and visible on mobile, where the sidebar is hidden).
function DemoBanner() {
  return (
    <HudFrame
      chamfer={['tl', 'br']}
      accentCorner="tl"
      accentTone="accent"
      node
      bodyClassName="px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 border border-accent/40 bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
            Demo · read-only
          </span>
          <p className="text-sm text-muted">
            Ingest jobs, AI-score the fit, and run your whole pipeline.{' '}
            <span className="text-fg">This is sample data — controls are off.</span>
          </p>
        </div>
        <Link
          href="/login"
          className="hud-cut inline-flex h-9 shrink-0 items-center bg-accent px-4 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
        >
          Get started — sign in →
        </Link>
      </div>
    </HudFrame>
  );
}

// --------------------------------------------------------------------------- Needs action
function NeedsActionView() {
  const due = DEMO_APPLICATIONS.filter(
    (r) => isDueOrOverdue(r.next_action_date, DEMO_TODAY) && !isTerminal(r.status),
  );
  // The demo only carries application alerts (no contact/outreach sample data).
  const toItem = (r: (typeof due)[number]): AlertItem => ({
    kind: 'application',
    key: `app-${r.id}`,
    row: r,
    fit: r.job_id ? FIT_MAP[r.job_id] : undefined,
  });
  const overdue = due.filter((r) => isOverdue(r.next_action_date, DEMO_TODAY)).map(toItem);
  const dueToday = due.filter((r) => !isOverdue(r.next_action_date, DEMO_TODAY)).map(toItem);

  const vitals = computeVitals(DEMO_APPLICATIONS.map((r) => r.status));

  // Same TELEMETRY strip as the real page: the unified activity feed, newest first.
  const telemetry: LogEntry[] = DEMO_ACTIVITY.map((e) => ({
    time: formatDateTime(e.created_at),
    colorToken: ACTIVITY_CATEGORY_COLOR[e.category] ?? 'system',
    text: e.summary,
  }));

  return (
    <CommandBridge
      mission={MISSION}
      vitals={vitals}
      overdue={overdue}
      dueToday={dueToday}
      telemetry={telemetry}
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
const DISCOVERY_STATES: JobState[] = ['new', 'saved', 'promoted', 'dismissed'];
function discoveryState(value: string | undefined): JobState {
  return DISCOVERY_STATES.includes(value as JobState) ? (value as JobState) : 'new';
}

function DiscoveryView({ state }: { state: JobState }) {
  const jobs = DEMO_JOBS.filter((j) => j.state === state).sort(
    (a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-fg">Discovery</h1>
        <p className="text-sm text-muted">
          Ingested jobs, scored against the sample profile — best fit first.
        </p>
      </header>

      <DiscoveryTabs active={state} counts={DEMO_JOB_COUNTS} demo />

      {jobs.length === 0 ? (
        <EmptyState title={`No ${state} jobs`} />
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
