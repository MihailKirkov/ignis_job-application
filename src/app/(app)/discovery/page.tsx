import { createClient } from '@/lib/supabase/server';
import type { JobRow, JobState, ProfileRow, SavedFilterRow } from '@/types/database';
import { criteriaFromParams, jobRowToNormalized } from '@/lib/discovery/filter-params';
import { matchesFilter } from '@/lib/discovery/filters';
import { isCriteriaEmpty } from '@/lib/discovery/filter-params';
import { hasAnthropicKey } from '@/lib/ai/resolve-key';
import { scoredProfileHash } from '@/lib/ai/hash';
import { profileToScoring } from '@/lib/ai/score';
import { JobCard } from '@/components/job-card';
import { DiscoveryTabs } from '@/components/discovery-tabs';
import { FilterPanel } from '@/components/filter-panel';
import { PresetBar } from '@/components/preset-bar';
import { RefreshInboxButton, ImportPasteButton } from '@/components/discovery-actions';
import { ScoreNewButton } from '@/components/score-new-button';
import { EmptyState } from '@/components/ui';

const STATES: JobState[] = ['new', 'saved', 'dismissed', 'promoted'];

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string | null =>
    typeof sp[k] === 'string' ? (sp[k] as string) : null;

  const stateParam = get('state');
  const active: JobState = STATES.includes(stateParam as JobState)
    ? (stateParam as JobState)
    : 'new';
  const criteria = criteriaFromParams({ get });

  const supabase = await createClient();

  const [
    { data: stateRows },
    { data: jobRows },
    { data: presetRows },
    { data: profileRow },
    aiEnabled,
  ] = await Promise.all([
    supabase.from('jobs').select('state'),
    supabase
      .from('jobs')
      .select('*')
      .eq('state', active)
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('ingested_at', { ascending: false }),
    supabase.from('saved_filters').select('*').order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').maybeSingle(),
    hasAnthropicKey(supabase),
  ]);

  const counts = (stateRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});

  const profile = (profileRow ?? null) as ProfileRow | null;
  const currentProfileHash = profile ? scoredProfileHash(profileToScoring(profile)) : null;

  const allJobs = (jobRows ?? []) as JobRow[];
  const hasFilters = !isCriteriaEmpty(criteria);
  const filtered = hasFilters
    ? allJobs.filter((j) => matchesFilter(jobRowToNormalized(j), criteria))
    : allJobs;

  // When scores exist, sort the New inbox best-fit first (stable; unscored last).
  const hasScores = filtered.some((j) => j.fit_score != null);
  const jobs =
    active === 'new' && hasScores
      ? [...filtered].sort((a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1))
      : filtered;

  const presets = ((presetRows ?? []) as SavedFilterRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    criteria: p.criteria as Record<string, string>,
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Discovery</h1>
          <p className="text-sm text-muted">Review, save, dismiss, or promote ingested jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          {aiEnabled ? <ScoreNewButton /> : null}
          <ImportPasteButton />
          <RefreshInboxButton />
        </div>
      </header>

      {aiEnabled ? (
        <p className="text-xs text-faint">
          Fit scores run on your own Anthropic API key (set it in{' '}
          <span className="text-muted">Profile → AI</span>).
        </p>
      ) : null}

      <DiscoveryTabs active={active} counts={counts} />

      <FilterPanel />
      <PresetBar presets={presets} />

      {jobs.length === 0 ? (
        <EmptyState
          title={
            allJobs.length > 0 && hasFilters
              ? 'No jobs match these filters'
              : active === 'new'
                ? 'Inbox is empty'
                : `No ${active} jobs`
          }
          hint={
            allJobs.length > 0 && hasFilters
              ? 'Loosen or clear the filters to see more.'
              : active === 'new'
                ? 'Add sources, then “Refresh inbox” to ingest jobs — or paste-import from a Cowork recipe.'
                : 'Jobs you act on will show up under the matching tab.'
          }
        />
      ) : (
        <>
          <p className="text-xs text-faint">
            <span className="font-mono">{jobs.length}</span>
            {hasFilters ? ` of ${allJobs.length}` : ''} job{jobs.length === 1 ? '' : 's'}
          </p>
          <div className="grid gap-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                aiEnabled={aiEnabled}
                currentProfileHash={currentProfileHash}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
