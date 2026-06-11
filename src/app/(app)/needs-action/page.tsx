import { createClient } from '@/lib/supabase/server';
import { TERMINAL_STATUSES } from '@/lib/constants';
import { isOverdue, todayISO } from '@/lib/utils';
import type { ApplicationRow } from '@/types/database';
import { ApplicationCard } from '@/components/application-card';
import { NewApplicationButton } from '@/components/application-dialog';
import { EmptyState } from '@/components/ui';

export default async function NeedsActionPage() {
  const supabase = await createClient();
  const today = todayISO();

  const notTerminal = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`;
  const { data } = await supabase
    .from('applications')
    .select('*')
    .lte('next_action_date', today)
    .not('status', 'in', notTerminal)
    .order('next_action_date', { ascending: true });

  const rows = (data ?? []) as ApplicationRow[];
  const overdue = rows.filter((r) => isOverdue(r.next_action_date));
  const dueToday = rows.filter((r) => !isOverdue(r.next_action_date));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Needs action</h1>
          <p className="text-sm text-muted">
            {rows.length > 0 ? (
              <>
                <span className="font-mono text-fg">{rows.length}</span> item
                {rows.length === 1 ? '' : 's'} due
                {overdue.length > 0 ? (
                  <>
                    {' '}
                    · <span className="text-status-rejected">{overdue.length} overdue</span>
                  </>
                ) : null}
              </>
            ) : (
              'Everything on your pipeline is up to date.'
            )}
          </p>
        </div>
        <NewApplicationButton />
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Queue is clear ✓"
          hint="No overdue or due-today follow-ups. New items appear here when an application's next-action date arrives."
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-status-rejected">
                Overdue
              </h2>
              <div className="grid gap-3">
                {overdue.map((row) => (
                  <ApplicationCard key={row.id} row={row} highlightAction />
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
                  <ApplicationCard key={row.id} row={row} highlightAction />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
