import type { JobRow } from '@/types/database';
import { FIT_VERDICT_COLOR, SOURCE_META } from '@/lib/constants';
import { formatDate, formatSalaryRange } from '@/lib/utils';
import { RadialMeter, SectionLabel } from './hud';
import { HudFrame } from './hud-frame';
import { JobStateControls, type JobStateControl } from './job-state-controls';
import { JobScoreButton, type JobScoreControl } from './job-score';

// In read-only mode (the public /demo) we keep the full visual — fit dial, AI
// summary, source — but drop every control that would hit a Server Action.
function DemoStatePill({ state }: { state: JobRow['state'] }) {
  if (state === 'promoted') {
    return <span className="text-xs text-status-offer">✓ Promoted to pipeline</span>;
  }
  return (
    <span className="border border-system/25 bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
      {state}
    </span>
  );
}

export function JobCard({
  job,
  aiEnabled = false,
  currentProfileHash = null,
  readOnly = false,
  stateControl,
  scoreControl,
}: {
  job: JobRow;
  aiEnabled?: boolean;
  currentProfileHash?: string | null;
  readOnly?: boolean;
  // Provided by DiscoveryList for optimistic state changes + incremental scoring.
  stateControl?: JobStateControl;
  scoreControl?: JobScoreControl;
}) {
  const salary = formatSalaryRange(job.salary_min, job.salary_max, job.currency);
  const sourceLabel = SOURCE_META[job.source as keyof typeof SOURCE_META]?.label ?? job.source;
  const meta = [job.location, job.mode].filter(Boolean);

  const scored = job.fit_score != null;
  const verdict = job.fit_verdict ?? 'medium';
  const stale =
    scored && currentProfileHash != null && job.scored_profile_hash !== currentProfileHash;
  const breakdown = (job.fit_breakdown ?? {}) as { matched_skills?: string[]; gaps?: string[] };
  const edgeToken = scored ? FIT_VERDICT_COLOR[verdict] : 'system';

  return (
    <HudFrame
      flush
      chamfer={['tl']}
      tone="system"
      accentTone={edgeToken}
      className="bg-surface transition-colors hover:bg-surface-2/40"
    >
      <span
        className="absolute inset-y-0 left-0 z-10 w-[3px]"
        style={{ backgroundColor: `var(--color-${edgeToken})` }}
        aria-hidden
      />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-fg">{job.title}</h3>
              {job.url ? (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-faint transition-colors hover:text-system"
                  aria-label="Open original posting"
                  title="Open original posting"
                >
                  ↗
                </a>
              ) : null}
            </div>
            <div className="truncate text-sm text-muted">{job.company ?? 'Unknown company'}</div>
            {meta.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {meta.map((m, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 ? <span className="text-faint" aria-hidden>·</span> : null}
                    {m}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="flex flex-col items-end gap-1.5">
              <span className="border border-system/25 bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                {sourceLabel}
              </span>
              {salary ? <span className="font-mono text-xs text-muted">{salary}</span> : null}
            </div>
            {scored ? (
              <div className="flex flex-col items-center gap-0.5">
                <RadialMeter
                  value={job.fit_score as number}
                  size={52}
                  thickness={6}
                  colorToken={FIT_VERDICT_COLOR[verdict]}
                  label={Math.round(job.fit_score as number)}
                />
                <SectionLabel style={{ color: `var(--color-${FIT_VERDICT_COLOR[verdict]})` }}>
                  {verdict}
                </SectionLabel>
              </div>
            ) : null}
          </div>
        </div>

        {job.description ? (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{job.description}</p>
        ) : null}

        {scored && job.fit_summary ? (
          <div className="mt-3 border border-system/20 bg-bg/40 p-2.5">
            <p className="text-xs leading-relaxed text-fg">
              {job.fit_summary}
              {stale ? (
                <span className="ml-1.5 border border-border px-1.5 py-0.5 text-[10px] text-faint">
                  profile changed — rescore
                </span>
              ) : null}
            </p>
            {breakdown.matched_skills?.length || breakdown.gaps?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {breakdown.matched_skills?.length ? (
                  <span className="text-status-offer">
                    ✓ {breakdown.matched_skills.slice(0, 6).join(', ')}
                  </span>
                ) : null}
                {breakdown.gaps?.length ? (
                  <span className="text-status-rejected">
                    ✗ {breakdown.gaps.slice(0, 6).join(', ')}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-faint">
              {job.posted_at
                ? `posted ${formatDate(job.posted_at)}`
                : `seen ${formatDate(job.ingested_at)}`}
            </span>
            {aiEnabled && !readOnly ? (
              <JobScoreButton jobId={job.id} scored={scored} control={scoreControl} />
            ) : null}
          </div>
          {readOnly ? (
            <DemoStatePill state={job.state} />
          ) : (
            <JobStateControls id={job.id} state={job.state} control={stateControl} />
          )}
        </div>
      </div>
    </HudFrame>
  );
}
