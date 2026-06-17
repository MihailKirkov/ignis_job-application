import type { ApplicationRow, ScoreVerdict } from '@/types/database';
import { FIT_VERDICT_COLOR } from '@/lib/constants';
import { cn, formatDate, isOverdue, statusColorToken } from '@/lib/utils';
import { RadialMeter, SectionLabel, StatusLed } from './hud';
import { HudFrame } from './hud-frame';
import { EditApplicationButton } from './application-dialog';
import { ClearActionButton, DeleteApplicationButton } from './application-actions';

export type FitInfo = { score: number; verdict: ScoreVerdict | null };
export type FitMap = Record<string, FitInfo>;

// The ONE application card — reused in Priority Alerts and board lanes. Compact:
// left-edge status accent, status as LED + label, fit as a small RadialMeter,
// tight company/role/location, subtle actions. No large flat blocks.
export function AppCard({
  row,
  fit,
  severity,
  readOnly = false,
  className,
}: {
  row: ApplicationRow;
  fit?: FitInfo;
  // Alert cards on the command bridge are severity-coded. Omitted on the board.
  severity?: 'overdue' | 'due';
  readOnly?: boolean;
  className?: string;
}) {
  const statusToken = statusColorToken(row.status);
  const overdue = severity === 'overdue' || isOverdue(row.next_action_date);
  const edgeToken =
    severity === 'overdue' ? 'status-rejected' : severity === 'due' ? 'accent' : statusToken;
  const meta = [row.company, row.location].filter(Boolean).join(' · ');

  return (
    <HudFrame
      flush
      chamfer={['tl']}
      chamferSize={10}
      tone={severity === 'overdue' ? 'status-rejected' : 'system'}
      accentTone={edgeToken}
      glow={severity === 'overdue'}
      className={cn('bg-surface-2/60 transition-colors hover:bg-surface-2', className)}
    >
      {/* left-edge status / severity accent */}
      <span
        className="absolute inset-y-0 left-0 z-10 w-[3px]"
        style={{ backgroundColor: `var(--color-${edgeToken})` }}
        aria-hidden
      />

      <div className="p-2.5 pl-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StatusLed colorToken={statusToken} alert={severity === 'overdue'} size={7} />
            <SectionLabel style={{ color: `var(--color-${statusToken})` }}>
              {row.status}
            </SectionLabel>
            {severity ? (
              <SectionLabel
                style={{
                  color: `var(--color-${severity === 'overdue' ? 'status-rejected' : 'accent'})`,
                }}
              >
                · {severity === 'overdue' ? 'OVERDUE' : 'DUE TODAY'}
              </SectionLabel>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <h3 className="truncate text-sm font-medium text-fg">{row.role}</h3>
            {row.link ? (
              <a
                href={row.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-faint transition-colors hover:text-system"
                aria-label="Open job link"
                title="Open job link"
              >
                ↗
              </a>
            ) : null}
          </div>
          <div className="truncate text-[11px] text-muted">{meta || '—'}</div>

          {row.next_action ? (
            <div className="mt-1.5 truncate text-xs text-fg">{row.next_action}</div>
          ) : null}
        </div>

        {fit ? (
          <RadialMeter
            value={fit.score}
            size={44}
            thickness={6}
            colorToken={FIT_VERDICT_COLOR[fit.verdict ?? 'medium']}
            label={Math.round(fit.score)}
          />
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn('font-mono text-[11px]', overdue ? 'text-status-rejected' : 'text-faint')}
        >
          {row.next_action_date
            ? `${overdue ? '⚠ ' : 'next '}${formatDate(row.next_action_date)}`
            : row.date_applied
              ? `applied ${formatDate(row.date_applied)}`
              : row.salary ?? '—'}
        </span>
        {readOnly ? null : (
          <div className="flex items-center">
            {row.next_action_date && severity ? <ClearActionButton id={row.id} /> : null}
            <EditApplicationButton row={row} />
            <DeleteApplicationButton id={row.id} />
          </div>
        )}
      </div>
      </div>
    </HudFrame>
  );
}
