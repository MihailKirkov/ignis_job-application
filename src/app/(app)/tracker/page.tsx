import { createClient } from '@/lib/supabase/server';
import { isTerminal } from '@/lib/utils';
import type { ApplicationRow, ApplicationStatus, ScoreVerdict } from '@/types/database';
import { NewApplicationButton } from '@/components/application-dialog';
import { TrackerToolbar } from '@/components/tracker-toolbar';
import { TrackerViewToggle } from '@/components/tracker-toggle';
import { TrackerBoard } from '@/components/tracker-board';
import { TrackerConsole } from '@/components/tracker-console';
import { TrackerStats } from '@/components/tracker-stats';
import type { FitMap } from '@/components/app-card';
import { EmptyState } from '@/components/ui';

// Strip characters that would break PostgREST `.or()` filter syntax.
function sanitize(q: string): string {
  return q.replace(/[,()*]/g, ' ').trim();
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const { q, status, view } = await searchParams;
  const activeView: 'board' | 'console' = view === 'console' ? 'console' : 'board';
  const supabase = await createClient();

  // Pipeline stats (status column only, all rows).
  const { data: statRows } = await supabase.from('applications').select('status');
  const counts = (statRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const active = (statRows ?? []).filter(
    (r) => !isTerminal(r.status as ApplicationStatus),
  ).length;

  // Filtered + sorted list. The status filter only applies in console view —
  // the board needs every lane populated for cross-column dragging.
  let query = supabase.from('applications').select('*');
  if (status && activeView === 'console') query = query.eq('status', status as ApplicationStatus);
  const cleaned = q ? sanitize(q) : '';
  if (cleaned) {
    query = query.or(
      `company.ilike.%${cleaned}%,role.ilike.%${cleaned}%,location.ilike.%${cleaned}%,notes.ilike.%${cleaned}%`,
    );
  }
  query = query
    .order('next_action_date', { ascending: true, nullsFirst: false })
    .order('date_applied', { ascending: false, nullsFirst: false });

  const { data: rows } = await query;
  const applications = (rows ?? []) as ApplicationRow[];

  // Fit scores for any applications promoted from a discovered job.
  const jobIds = applications.map((a) => a.job_id).filter((id): id is string => Boolean(id));
  const fitMap: FitMap = {};
  if (jobIds.length > 0) {
    const { data: jobFit } = await supabase
      .from('jobs')
      .select('id, fit_score, fit_verdict')
      .in('id', jobIds)
      .not('fit_score', 'is', null);
    for (const j of (jobFit ?? []) as {
      id: string;
      fit_score: number;
      fit_verdict: ScoreVerdict | null;
    }[]) {
      fitMap[j.id] = { score: j.fit_score, verdict: j.fit_verdict };
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hud-label">PIPELINE CONTROL</p>
          <h1 className="mt-1.5 text-xl font-semibold text-fg">Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <TrackerViewToggle active={activeView} />
          <a
            href="/api/applications/export"
            className="inline-flex h-9 items-center border border-system/30 bg-surface-2 px-3.5 text-sm text-fg transition-colors hover:border-system/60 hover:text-system"
          >
            Export JSON
          </a>
          <NewApplicationButton />
        </div>
      </header>

      <TrackerStats counts={counts} active={active} />

      <TrackerToolbar view={activeView} />

      {applications.length === 0 ? (
        <EmptyState
          title={q || status ? 'No matching applications' : 'No applications yet'}
          hint={
            q || status
              ? 'Try clearing the search or status filter.'
              : 'Add your first application, or promote a discovered job into the pipeline.'
          }
        />
      ) : activeView === 'console' ? (
        <TrackerConsole applications={applications} fitMap={fitMap} />
      ) : (
        <TrackerBoard applications={applications} fitMap={fitMap} />
      )}
    </div>
  );
}
