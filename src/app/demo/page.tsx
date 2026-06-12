import Link from 'next/link';
import type { Metadata } from 'next';
import { APPLICATION_STATUSES } from '@/lib/constants';
import { isDueOrOverdue, isOverdue, isTerminal } from '@/lib/utils';
import type { ApplicationStatus } from '@/types/database';
import { ApplicationCard } from '@/components/application-card';
import { JobCard } from '@/components/job-card';
import { EmptyState, Stat } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  DEMO_APPLICATIONS,
  DEMO_JOBS,
  DEMO_JOB_COUNTS,
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

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const active: View = VIEWS.some((v) => v.id === view) ? (view as View) : 'discovery';

  return (
    <div className="min-h-dvh bg-bg">
      {/* Demo chrome: clearly-labelled, with the two CTAs a recruiter needs. */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-xs tracking-widest text-accent">
              JOB · CC
            </Link>
            <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
              Demo · read-only
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-3 text-sm text-fg transition-colors hover:bg-surface-2/70"
            >
              ← Home
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 md:px-8">
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
                    ? 'border-accent text-fg'
                    : 'border-transparent text-muted hover:text-fg',
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <p className="mb-5 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
          Sample data only — buttons are disabled in the demo. Sign in to ingest
          real jobs, score them against your own profile, and run your pipeline.
        </p>
        {active === 'needs-action' ? <NeedsActionView /> : null}
        {active === 'tracker' ? <TrackerView /> : null}
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-fg">Needs action</h1>
        <p className="text-sm text-muted">
          <span className="font-mono text-fg">{due.length}</span> items due ·{' '}
          <span className="text-status-rejected">{overdue.length} overdue</span>
        </p>
      </header>

      {overdue.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-status-rejected">
            Overdue
          </h2>
          <div className="grid gap-3">
            {overdue.map((row) => (
              <ApplicationCard key={row.id} row={row} highlightAction readOnly />
            ))}
          </div>
        </section>
      ) : null}

      {dueToday.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            Due today
          </h2>
          <div className="grid gap-3">
            {dueToday.map((row) => (
              <ApplicationCard key={row.id} row={row} highlightAction readOnly />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------- Tracker
function TrackerView() {
  const rows = DEMO_APPLICATIONS;
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const active = rows.filter((r) => !isTerminal(r.status as ApplicationStatus)).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-fg">Tracker</h1>
        <p className="text-sm text-muted">Your application pipeline.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Total" value={rows.length} />
        <Stat label="Active" value={active} accent />
        {APPLICATION_STATUSES.map((s) => (
          <Stat key={s} label={s} value={counts[s] ?? 0} />
        ))}
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <ApplicationCard key={row.id} row={row} readOnly />
        ))}
      </div>
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
        <h1 className="text-xl font-semibold text-fg">Discovery</h1>
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
              t.state === 'new' ? 'border-accent text-fg' : 'border-transparent text-muted',
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
