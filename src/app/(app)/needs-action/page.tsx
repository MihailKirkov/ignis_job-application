import { createClient } from '@/lib/supabase/server';
import { TERMINAL_STATUSES } from '@/lib/constants';
import { isOverdue, todayISO } from '@/lib/utils';
import type { ApplicationRow, ProfileRow } from '@/types/database';
import { ApplicationCard } from '@/components/application-card';
import { NewApplicationButton } from '@/components/application-dialog';
import { OnboardingChecklist, type OnboardingStep } from '@/components/onboarding-checklist';
import { EmptyState } from '@/components/ui';

export default async function NeedsActionPage() {
  const supabase = await createClient();
  const today = todayISO();

  const notTerminal = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`;
  const [
    { data },
    { data: profileRow },
    { count: sourceCount },
    { count: jobCount },
    { count: scoredCount },
  ] = await Promise.all([
    supabase
      .from('applications')
      .select('*')
      .lte('next_action_date', today)
      .not('status', 'in', notTerminal)
      .order('next_action_date', { ascending: true }),
    supabase.from('profiles').select('full_name, skills, cv_text').maybeSingle(),
    supabase.from('sources').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('id', { count: 'exact', head: true }),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .not('fit_score', 'is', null),
  ]);

  const profile = profileRow as Pick<ProfileRow, 'full_name' | 'skills' | 'cv_text'> | null;
  const steps: OnboardingStep[] = [
    {
      label: 'Set up your profile & CV',
      hint: 'Your details and CV power matching and AI fit-scoring.',
      href: '/profile',
      done: Boolean(profile?.full_name || profile?.skills?.length || profile?.cv_text),
    },
    {
      label: 'Add a job source',
      hint: 'Connect Adzuna or a company ATS board to ingest roles.',
      href: '/sources',
      done: (sourceCount ?? 0) > 0,
    },
    {
      label: 'Refresh your inbox',
      hint: 'Pull the latest jobs into Discovery.',
      href: '/discovery',
      done: (jobCount ?? 0) > 0,
    },
    {
      label: 'Score jobs against your profile',
      hint: 'Let Claude rank your inbox by fit.',
      href: '/discovery',
      done: (scoredCount ?? 0) > 0,
    },
  ];
  const onboardingComplete = steps.every((s) => s.done);

  const rows = (data ?? []) as ApplicationRow[];
  const overdue = rows.filter((r) => isOverdue(r.next_action_date));
  const dueToday = rows.filter((r) => !isOverdue(r.next_action_date));

  return (
    <div className="space-y-6">
      {onboardingComplete ? null : <OnboardingChecklist steps={steps} />}

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
