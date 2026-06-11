import { createClient } from '@/lib/supabase/server';
import type { JobRow, JobState } from '@/types/database';
import { JobCard } from '@/components/job-card';
import { DiscoveryTabs } from '@/components/discovery-tabs';
import { RefreshInboxButton, ImportPasteButton } from '@/components/discovery-actions';
import { EmptyState } from '@/components/ui';

const STATES: JobState[] = ['new', 'saved', 'dismissed', 'promoted'];

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const active: JobState = STATES.includes(state as JobState) ? (state as JobState) : 'new';

  const supabase = await createClient();

  const { data: stateRows } = await supabase.from('jobs').select('state');
  const counts = (stateRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});

  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('state', active)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false });

  const jobs = (data ?? []) as JobRow[];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Discovery</h1>
          <p className="text-sm text-muted">Review, save, dismiss, or promote ingested jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportPasteButton />
          <RefreshInboxButton />
        </div>
      </header>

      <DiscoveryTabs active={active} counts={counts} />

      {jobs.length === 0 ? (
        <EmptyState
          title={active === 'new' ? 'Inbox is empty' : `No ${active} jobs`}
          hint={
            active === 'new'
              ? 'Add sources, then “Refresh inbox” to ingest jobs — or paste-import from a Cowork recipe.'
              : 'Jobs you act on will show up under the matching tab.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
