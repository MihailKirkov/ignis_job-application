import type { JobRow } from '@/types/database';
import { SOURCE_META } from '@/lib/constants';
import { formatDate, formatSalaryRange } from '@/lib/utils';
import { JobStateControls } from './job-state-controls';

export function JobCard({ job }: { job: JobRow }) {
  const salary = formatSalaryRange(job.salary_min, job.salary_max, job.currency);
  const sourceLabel = SOURCE_META[job.source as keyof typeof SOURCE_META]?.label ?? job.source;
  const meta = [job.location, job.mode].filter(Boolean);

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

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-faint">
          {job.posted_at ? `posted ${formatDate(job.posted_at)}` : `seen ${formatDate(job.ingested_at)}`}
        </span>
        <JobStateControls id={job.id} state={job.state} />
      </div>
    </div>
  );
}
