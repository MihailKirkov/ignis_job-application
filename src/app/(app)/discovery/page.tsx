import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { JobState, ProfileRow, SavedFilterRow } from '@/types/database';
import { criteriaFromParams, isCriteriaEmpty } from '@/lib/discovery/filter-params';
import { loadJobsPage } from '@/lib/actions/discovery';
import { hasAnthropicKey } from '@/lib/ai/resolve-key';
import { scoredProfileHash } from '@/lib/ai/hash';
import { profileToScoring } from '@/lib/ai/score';
import { DiscoveryList, type ResumableRun } from '@/components/discovery-list';
import { DiscoveryTabs } from '@/components/discovery-tabs';
import { FilterPanel } from '@/components/filter-panel';
import { PresetBar } from '@/components/preset-bar';
import { RefreshInboxButton, ImportPasteButton } from '@/components/discovery-actions';
import { SkeletonJobList } from '@/components/hud-skeleton';

const STATES: JobState[] = ['new', 'saved', 'dismissed', 'promoted'];

// Reduce the raw search params to the flat string record the filter helpers +
// loadJobsPage understand (drops `state`, arrays, and undefined).
function filterParams(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k !== 'state' && typeof v === 'string') out[k] = v;
  }
  return out;
}

// The genuinely slow section — first DB page of jobs + profile/AI metadata — is
// streamed so the page frame (header, tabs, filters) paints immediately.
async function DiscoveryFeed({
  state,
  params,
  hasFilters,
  emptyTitle,
  emptyHint,
}: {
  state: JobState;
  params: Record<string, string>;
  hasFilters: boolean;
  emptyTitle: string;
  emptyHint: string;
}) {
  const supabase = await createClient();
  const [page, { data: profileRow }, aiEnabled] = await Promise.all([
    loadJobsPage({ state, params, offset: 0 }),
    supabase.from('profiles').select('*').maybeSingle(),
    hasAnthropicKey(supabase),
  ]);

  const profile = (profileRow ?? null) as ProfileRow | null;
  const profileHash = profile ? scoredProfileHash(profileToScoring(profile)) : null;

  // Offer to resume an in-progress run (e.g. the user navigated away mid-scan).
  let resumableRun: ResumableRun | null = null;
  if (aiEnabled) {
    const { data: runRow } = await supabase
      .from('scoring_runs')
      .select('id, total, completed, failed')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runRow && runRow.total - runRow.completed - runRow.failed > 0) {
      resumableRun = {
        runId: runRow.id,
        total: runRow.total,
        completed: runRow.completed,
        failed: runRow.failed,
      };
    }
  }

  return (
    <>
      {aiEnabled ? (
        <p className="text-xs text-faint">
          Fit scores run on your own Anthropic API key (set it in{' '}
          <span className="text-muted">Profile → AI</span>).
        </p>
      ) : null}
      <DiscoveryList
        initialJobs={page.jobs}
        state={state}
        params={params}
        aiEnabled={aiEnabled}
        profileHash={profileHash}
        initialDone={page.done}
        initialOffset={page.nextOffset}
        hasFilters={hasFilters}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        resumableRun={resumableRun}
      />
    </>
  );
}

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
  const params = filterParams(sp);
  const hasFilters = !isCriteriaEmpty(criteriaFromParams({ get }));

  const supabase = await createClient();

  // Lightweight shell metadata (tab counts + presets) — kept out of the streamed
  // feed so tabs/filters render without waiting on the job list.
  const [{ data: stateRows }, { data: presetRows }] = await Promise.all([
    supabase.from('jobs').select('state'),
    supabase.from('saved_filters').select('*').order('created_at', { ascending: true }),
  ]);

  const counts = (stateRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});

  const presets = ((presetRows ?? []) as SavedFilterRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    criteria: p.criteria as Record<string, string>,
  }));

  const stateTotal = counts[active] ?? 0;
  const filteredEmpty = stateTotal > 0 && hasFilters;
  const emptyTitle = filteredEmpty
    ? 'No jobs match these filters'
    : active === 'new'
      ? 'Inbox is empty'
      : `No ${active} jobs`;
  const emptyHint = filteredEmpty
    ? 'Loosen or clear the filters to see more.'
    : active === 'new'
      ? 'Add sources, then “Refresh inbox” to ingest jobs — or paste-import from a Cowork recipe.'
      : 'Jobs you act on will show up under the matching tab.';

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

      <FilterPanel />
      <PresetBar presets={presets} />

      <Suspense
        key={`${active}:${JSON.stringify(params)}`}
        fallback={<SkeletonJobList rows={5} />}
      >
        <DiscoveryFeed
          state={active}
          params={params}
          hasFilters={hasFilters}
          emptyTitle={emptyTitle}
          emptyHint={emptyHint}
        />
      </Suspense>
    </div>
  );
}
