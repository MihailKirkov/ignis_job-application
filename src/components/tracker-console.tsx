'use client';

import { useMemo, useState } from 'react';
import type { ApplicationRow } from '@/types/database';
import type { FitMap } from './app-card';
import { FIT_VERDICT_COLOR } from '@/lib/constants';
import { cn, formatDate, isOverdue, statusColorToken } from '@/lib/utils';
import { StatusLed } from './hud';
import { HudFrame } from './hud-frame';
import { EditApplicationButton } from './application-dialog';
import { DeleteApplicationButton } from './application-actions';

type SortKey = 'status' | 'role' | 'company' | 'location' | 'next' | 'applied' | 'fit';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'status', label: 'STATUS' },
  { key: 'role', label: 'ROLE' },
  { key: 'company', label: 'COMPANY' },
  { key: 'location', label: 'LOCATION' },
  { key: 'next', label: 'NEXT ACTION' },
  { key: 'applied', label: 'APPLIED' },
  { key: 'fit', label: 'FIT' },
];

function sortValue(row: ApplicationRow, key: SortKey, fitMap: FitMap): string | number {
  switch (key) {
    case 'status':
      return row.status;
    case 'role':
      return row.role.toLowerCase();
    case 'company':
      return row.company.toLowerCase();
    case 'location':
      return (row.location ?? '').toLowerCase();
    case 'next':
      return row.next_action_date ?? '9999-12-31';
    case 'applied':
      return row.date_applied ?? '';
    case 'fit':
      return row.job_id ? (fitMap[row.job_id]?.score ?? -1) : -1;
  }
}

export function TrackerConsole({
  applications,
  fitMap,
  readOnly = false,
}: {
  applications: ApplicationRow[];
  fitMap: FitMap;
  readOnly?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('next');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const rows = [...applications];
    rows.sort((a, b) => {
      const va = sortValue(a, sortKey, fitMap);
      const vb = sortValue(b, sortKey, fitMap);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    return rows;
  }, [applications, sortKey, asc, fitMap]);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  // Explicit column widths (table-fixed) so long cells ellipsis-truncate instead
  // of forcing a horizontal scrollbar.
  const widths = readOnly
    ? ['12%', '24%', '17%', '15%', '13%', '13%', '6%']
    : ['12%', '22%', '15%', '13%', '12%', '12%', '6%', '8%'];

  return (
    <HudFrame flush chamfer={['tl', 'br']} accentTone="system">
      <div className="max-h-[calc(100dvh-280px)] overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed border-collapse font-mono text-xs">
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-left font-normal"
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1 uppercase tracking-wider transition-colors',
                      sortKey === c.key ? 'text-system' : 'text-faint hover:text-muted',
                    )}
                  >
                    {c.label}
                    {sortKey === c.key ? (
                      <span className="text-[9px]">{asc ? '▲' : '▼'}</span>
                    ) : null}
                  </button>
                </th>
              ))}
              {readOnly ? null : (
                <th className="sticky top-0 z-10 bg-surface px-3 py-2.5" aria-label="Actions" />
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const token = statusColorToken(row.status);
              const overdue = isOverdue(row.next_action_date);
              const fit = row.job_id ? fitMap[row.job_id] : undefined;
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-[color-mix(in_srgb,var(--color-system)_8%,transparent)]"
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <StatusLed colorToken={token} size={7} />
                      <span className="truncate" style={{ color: `var(--color-${token})` }}>
                        {row.status}
                      </span>
                    </span>
                  </td>
                  <td className="truncate px-3 py-2 text-fg" title={row.role}>
                    {row.link ? (
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-system"
                      >
                        {row.role}
                      </a>
                    ) : (
                      row.role
                    )}
                  </td>
                  <td className="truncate px-3 py-2 text-muted" title={row.company}>
                    {row.company}
                  </td>
                  <td className="truncate px-3 py-2 text-muted" title={row.location ?? undefined}>
                    {row.location ?? '—'}
                  </td>
                  <td className="truncate px-3 py-2">
                    <span className={overdue ? 'text-status-rejected' : 'text-muted'}>
                      {row.next_action_date
                        ? `${formatDate(row.next_action_date)}${overdue ? ' ⚠' : ''}`
                        : '—'}
                    </span>
                  </td>
                  <td className="truncate px-3 py-2 text-faint">
                    {row.date_applied ? formatDate(row.date_applied) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {fit ? (
                      <span
                        className="tabular-nums"
                        style={{
                          color: `var(--color-${FIT_VERDICT_COLOR[fit.verdict ?? 'medium']})`,
                        }}
                      >
                        {Math.round(fit.score)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  {readOnly ? null : (
                    <td className="px-1 py-1 text-right">
                      <span className="flex items-center justify-end">
                        <EditApplicationButton row={row} />
                        <DeleteApplicationButton id={row.id} />
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </HudFrame>
  );
}
