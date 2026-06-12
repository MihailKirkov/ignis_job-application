import type { JobRow, ScoreVerdict } from '@/types/database';
import { FIT_VERDICT_COLOR, SOURCE_META } from '@/lib/constants';
import { formatDate, formatSalaryRange } from '@/lib/utils';
import { Badge } from './ui';
import { JobStateControls } from './job-state-controls';
import { JobScoreButton } from './job-score';

function FitBadge({ score, verdict }: { score: number; verdict: ScoreVerdict | null }) {
  const v = verdict ?? 'medium';
  return (
    <Badge colorToken={FIT_VERDICT_COLOR[v]}>
      <span className="font-mono">{Math.round(score)}</span>
      <span className="uppercase tracking-wide">{v}</span>
    </Badge>
  );
}

export function JobCard({
  job,
  aiEnabled = false,
  currentProfileHash = null,
}: {
  job: JobRow;
  aiEnabled?: boolean;
  currentProfileHash?: string | null;
}) {
  const salary = formatSalaryRange(job.salary_min, job.salary_max, job.currency);
  const sourceLabel = SOURCE_META[job.source as keyof typeof SOURCE_META]?.label ?? job.source;
  const meta = [job.location, job.mode].filter(Boolean);

  const scored = job.fit_score != null;
  const stale =
    scored && currentProfileHash != null && job.scored_profile_hash !== currentProfileHash;
  const breakdown = (job.fit_breakdown ?? {}) as { matched_skills?: string[]; gaps?: string[] };

  return (
    <div className="rounded-[10px] border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-fg">{job.title}</h3>
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-faint transition-colors hover:text-accent"
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {scored ? <FitBadge score={job.fit_score as number} verdict={job.fit_verdict} /> : null}
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
            {sourceLabel}
          </span>
          {salary ? <span className="font-mono text-xs text-muted">{salary}</span> : null}
        </div>
      </div>

      {job.description ? (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">
          {job.description}
        </p>
      ) : null}

      {scored && job.fit_summary ? (
        <div className="mt-3 rounded-md border border-border bg-bg/40 p-2.5">
          <p className="text-xs leading-relaxed text-fg">
            {job.fit_summary}
            {stale ? (
              <span className="ml-1.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-faint">
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
            {job.posted_at ? `posted ${formatDate(job.posted_at)}` : `seen ${formatDate(job.ingested_at)}`}
          </span>
          {aiEnabled ? <JobScoreButton jobId={job.id} scored={scored} /> : null}
        </div>
        <JobStateControls id={job.id} state={job.state} />
      </div>
    </div>
  );
}
