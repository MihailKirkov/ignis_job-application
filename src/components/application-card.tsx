import type { ApplicationRow } from '@/types/database';
import { StatusBadge } from './status-badge';
import { EditApplicationButton } from './application-dialog';
import { ClearActionButton, DeleteApplicationButton } from './application-actions';
import { cn, formatDate, isOverdue } from '@/lib/utils';

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted">{children}</span>;
}

export function ApplicationCard({
  row,
  highlightAction = false,
  readOnly = false,
}: {
  row: ApplicationRow;
  highlightAction?: boolean;
  // The public /demo renders cards without any write controls (Edit/Delete/Clear).
  readOnly?: boolean;
}) {
  const overdue = isOverdue(row.next_action_date);
  const meta = [row.location, row.mode, row.channel].filter(Boolean);

  return (
    <div className="rounded-[10px] border border-border bg-surface p-4 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-fg">{row.role}</h3>
            {row.link ? (
              <a
                href={row.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-faint transition-colors hover:text-accent"
                aria-label="Open job link"
                title="Open job link"
              >
                ↗
              </a>
            ) : null}
          </div>
          <div className="truncate text-sm text-muted">{row.company}</div>
          {meta.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {meta.map((m, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 ? <span className="text-faint" aria-hidden>·</span> : null}
                  <Meta>{m}</Meta>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={row.status} />
          {row.salary ? (
            <span className="font-mono text-xs text-muted">{row.salary}</span>
          ) : null}
        </div>
      </div>

      {/* Next-action strip */}
      {row.next_action || row.next_action_date ? (
        <div
          className={cn(
            'mt-3 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs',
            highlightAction || overdue
              ? 'border border-accent/30 bg-accent-soft'
              : 'bg-surface-2',
          )}
        >
          <div className="min-w-0">
            <span className="text-fg">{row.next_action ?? 'Action due'}</span>
            {row.next_action_date ? (
              <span
                className={cn(
                  'ml-2 font-mono',
                  overdue ? 'text-status-rejected' : 'text-muted',
                )}
              >
                {formatDate(row.next_action_date)}
                {overdue ? ' · overdue' : ''}
              </span>
            ) : null}
          </div>
          {row.next_action_date && !readOnly ? <ClearActionButton id={row.id} /> : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-[11px] text-faint">
          {row.date_applied ? <span>applied {formatDate(row.date_applied)}</span> : null}
        </div>
        {readOnly ? null : (
          <div className="flex items-center gap-1">
            <EditApplicationButton row={row} />
            <DeleteApplicationButton id={row.id} />
          </div>
        )}
      </div>
    </div>
  );
}
