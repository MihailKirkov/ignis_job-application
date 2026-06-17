import type { ApplicationRow, ApplicationStatus } from '@/types/database';
import { statusColorToken } from '@/lib/utils';
import { AppCard, type FitMap } from './app-card';
import { HudFrame, SectionLabel, StatusLed } from './hud';

// Active pipeline lanes (left → right). Rejected/Closed go to a collapsed archive.
const ACTIVE_LANES: ApplicationStatus[] = [
  'To apply',
  'Applied',
  'Screening',
  'Interview',
  'Offer',
];
const ARCHIVE_LANES: ApplicationStatus[] = ['Rejected', 'Closed'];

function LaneCount({ count, token }: { count: number; token: string }) {
  return (
    <span
      className="font-mono text-sm font-semibold tabular-nums"
      style={{ color: `var(--color-${token})`, textShadow: `0 0 10px var(--color-${token})` }}
    >
      {count}
    </span>
  );
}

function Lane({
  status,
  rows,
  fitMap,
  readOnly,
}: {
  status: ApplicationStatus;
  rows: ApplicationRow[];
  fitMap: FitMap;
  readOnly: boolean;
}) {
  const token = statusColorToken(status);
  return (
    <HudFrame
      label={status}
      accentTone={token}
      node
      right={<LaneCount count={rows.length} token={token} />}
      bodyClassName="p-2"
    >
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <AppCard
            key={row.id}
            row={row}
            fit={row.job_id ? fitMap[row.job_id] : undefined}
            readOnly={readOnly}
          />
        ))}
        {rows.length === 0 ? (
          <p className="py-2 text-center font-mono text-[10px] text-faint">— empty</p>
        ) : null}
      </div>
    </HudFrame>
  );
}

export function TrackerBoard({
  applications,
  fitMap,
  readOnly = false,
}: {
  applications: ApplicationRow[];
  fitMap: FitMap;
  readOnly?: boolean;
}) {
  const byStatus = (s: ApplicationStatus) => applications.filter((r) => r.status === s);
  const archived = applications.filter((r) => ARCHIVE_LANES.includes(r.status));

  return (
    <div className="space-y-3">
      {/* Fit-to-width grid — wraps responsively, never a horizontal scrollbar. */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ACTIVE_LANES.map((status) => (
          <Lane
            key={status}
            status={status}
            rows={byStatus(status)}
            fitMap={fitMap}
            readOnly={readOnly}
          />
        ))}
      </div>

      {/* Rejected / Closed — collapsed archive. */}
      <details className="group border border-system/25 bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5">
          <span className="flex items-center gap-2">
            <StatusLed colorToken="status-grey" size={7} />
            <SectionLabel>ARCHIVE · REJECTED / CLOSED</SectionLabel>
            <span className="font-mono text-xs text-faint group-open:hidden">▸</span>
            <span className="hidden font-mono text-xs text-faint group-open:inline">▾</span>
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-muted">
            {archived.length}
          </span>
        </summary>
        {archived.length > 0 ? (
          <div className="grid gap-2 px-3.5 pb-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((row) => (
              <AppCard
                key={row.id}
                row={row}
                fit={row.job_id ? fitMap[row.job_id] : undefined}
                readOnly={readOnly}
              />
            ))}
          </div>
        ) : (
          <p className="px-3.5 pb-3.5 font-mono text-[10px] text-faint">— archive empty</p>
        )}
      </details>
    </div>
  );
}
