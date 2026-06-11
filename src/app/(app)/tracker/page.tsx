import { createClient } from '@/lib/supabase/server';
import { APPLICATION_STATUSES } from '@/lib/constants';
import { isTerminal } from '@/lib/utils';
import type { ApplicationRow, ApplicationStatus } from '@/types/database';
import { ApplicationCard } from '@/components/application-card';
import { NewApplicationButton } from '@/components/application-dialog';
import { TrackerToolbar } from '@/components/tracker-toolbar';
import { EmptyState, Stat } from '@/components/ui';

// Strip characters that would break PostgREST `.or()` filter syntax.
function sanitize(q: string): string {
  return q.replace(/[,()*]/g, ' ').trim();
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  // Pipeline stats (status column only, all rows).
  const { data: statRows } = await supabase.from('applications').select('status');
  const counts = (statRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const total = statRows?.length ?? 0;
  const active = (statRows ?? []).filter(
    (r) => !isTerminal(r.status as ApplicationStatus),
  ).length;

  // Filtered + sorted list.
  let query = supabase.from('applications').select('*');
  if (status) query = query.eq('status', status as ApplicationStatus);
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Tracker</h1>
          <p className="text-sm text-muted">Your application pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/applications/export"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-3.5 text-sm text-fg transition-colors hover:bg-surface-2/70"
          >
            Export JSON
          </a>
          <NewApplicationButton />
        </div>
      </header>

      {/* Pipeline stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Total" value={total} />
        <Stat label="Active" value={active} accent />
        {APPLICATION_STATUSES.map((s) => (
          <Stat key={s} label={s} value={counts[s] ?? 0} />
        ))}
      </div>

      <TrackerToolbar />

      {applications.length === 0 ? (
        <EmptyState
          title={q || status ? 'No matching applications' : 'No applications yet'}
          hint={
            q || status
              ? 'Try clearing the search or status filter.'
              : 'Add your first application, or promote a discovered job into the pipeline.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {applications.map((row) => (
            <ApplicationCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
